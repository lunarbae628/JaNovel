package com.janovel.domain.application.app;

import com.janovel.domain.application.client.PostingModelClient;
import com.janovel.domain.application.dto.ImportedPosting;
import com.janovel.domain.application.dto.PostingImportJobStatus;
import com.janovel.domain.application.dto.PostingImportJobStatus.Status;
import com.janovel.domain.application.exception.PostingErrorCode;
import com.janovel.global.exception.CustomException;
import com.janovel.global.exception.ErrorResponse;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.LongFunction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class PostingImportJobs {

    private static final Logger LOG = LoggerFactory.getLogger(PostingImportJobs.class);
    private static final int QUEUE_CAPACITY = 3;
    private static final int MAX_STORED_JOBS = 256;
    private static final long DEADLINE = Duration.ofSeconds(23).toNanos();
    private static final long RESULT_TTL = Duration.ofMinutes(2).toNanos();
    private static final long IMAGE_ESTIMATE = Duration.ofSeconds(8).toNanos();

    private final Map<UUID, Job> jobs = new LinkedHashMap<>();
    private final PostingImportService imports;
    private final ThreadPoolExecutor executor;
    private final int capacity;

    public PostingImportJobs(PostingImportService imports,
                             @Value("${janovel.postings.image-workers:1}") int capacity) {
        if (capacity < 1 || capacity > 3) {
            throw new IllegalArgumentException("공고 이미지 실행 슬롯은 1개에서 3개까지 지정할 수 있습니다.");
        }
        this.imports = imports;
        this.capacity = capacity;
        this.executor = new ThreadPoolExecutor(capacity, capacity, 0, TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(QUEUE_CAPACITY), Thread.ofPlatform().daemon().name("posting-image-", 1).factory());
    }

    public PostingImportJobStatus submitImage(byte[] image, String contentType) {
        PostingModelClient.validateImage(image, contentType);
        imports.requireModel();
        return submit(IMAGE_ESTIMATE, deadline -> imports.importImage(image, contentType, deadline));
    }

    public synchronized PostingImportJobStatus find(UUID jobId) {
        expire(System.nanoTime());
        var job = jobs.get(jobId);
        if (job == null) {
            throw new CustomException(PostingErrorCode.POSTING_IMPORT_JOB_NOT_FOUND);
        }
        return new PostingImportJobStatus(job.id, job.status, job.result, job.error);
    }

    private synchronized PostingImportJobStatus submit(long estimate, LongFunction<ImportedPosting> operation) {
        long now = System.nanoTime();
        expire(now);
        if (earliestStart(now) - now + estimate > DEADLINE) {
            throw new CustomException(PostingErrorCode.POSTING_IMPORT_BUSY);
        }
        if (jobs.size() >= MAX_STORED_JOBS) {
            jobs.values().stream().filter(job -> !job.pending() && !job.running).findFirst()
                    .ifPresent(job -> jobs.remove(job.id));
        }
        var job = new Job(now + DEADLINE, estimate, operation);
        jobs.put(job.id, job);
        try {
            executor.execute(job);
        } catch (RejectedExecutionException exception) {
            jobs.remove(job.id);
            throw new CustomException(PostingErrorCode.POSTING_IMPORT_BUSY, exception);
        }
        return new PostingImportJobStatus(job.id, Status.QUEUED, null, null);
    }

    private long earliestStart(long now) {
        var slots = new PriorityQueue<Long>();
        for (Job job : jobs.values()) {
            if (job.running) {
                long expectedFinish = job.startedAt + job.estimate;
                slots.add(expectedFinish > now ? expectedFinish : Math.max(now, job.deadline));
            }
        }
        while (slots.size() < capacity) {
            slots.add(now);
        }
        for (Job job : jobs.values()) {
            if (job.status == Status.QUEUED) {
                slots.add(slots.remove() + job.estimate);
            }
        }
        return slots.element();
    }

    private void expire(long now) {
        jobs.values().forEach(job -> {
            if (job.pending() && now - job.deadline >= 0) {
                if (job.status == Status.QUEUED) {
                    executor.remove(job);
                    job.operation = null;
                }
                job.fail(PostingErrorCode.POSTING_TIMEOUT, now);
            }
        });
        jobs.values().removeIf(job -> !job.pending() && !job.running && now - job.finishedAt >= RESULT_TTL);
    }

    @PreDestroy
    void close() {
        executor.shutdownNow();
    }

    private final class Job implements Runnable {

        private final UUID id = UUID.randomUUID();
        private final long deadline;
        private final long estimate;
        private LongFunction<ImportedPosting> operation;
        private Status status = Status.QUEUED;
        private long startedAt;
        private long finishedAt;
        private boolean running;
        private ImportedPosting result;
        private ErrorResponse error;

        private Job(long deadline, long estimate, LongFunction<ImportedPosting> operation) {
            this.deadline = deadline;
            this.estimate = estimate;
            this.operation = operation;
        }

        @Override
        public void run() {
            LongFunction<ImportedPosting> work;
            synchronized (PostingImportJobs.this) {
                startedAt = System.nanoTime();
                expire(startedAt);
                if (status != Status.QUEUED) {
                    return;
                }
                work = operation;
                operation = null;
                status = Status.PROCESSING;
                running = true;
            }
            ImportedPosting completed = null;
            ErrorResponse failure = null;
            try {
                completed = work.apply(deadline);
            } catch (CustomException exception) {
                failure = ErrorResponse.from(exception.getErrorCode());
            } catch (RuntimeException exception) {
                LOG.warn("Posting image job {} failed ({})", id, exception.getClass().getSimpleName());
                failure = ErrorResponse.from(PostingErrorCode.POSTING_MODEL_FAILED);
            } finally {
                synchronized (PostingImportJobs.this) {
                    running = false;
                    long now = System.nanoTime();
                    if (status == Status.PROCESSING) {
                        finishedAt = now;
                        if (now - deadline >= 0) {
                            fail(PostingErrorCode.POSTING_TIMEOUT, now);
                        } else if (completed != null) {
                            result = completed;
                            status = Status.COMPLETED;
                        } else {
                            error = failure != null ? failure : ErrorResponse.from(PostingErrorCode.POSTING_MODEL_FAILED);
                            status = Status.FAILED;
                        }
                    }
                }
            }
        }

        private void fail(PostingErrorCode code, long now) {
            status = Status.FAILED;
            error = ErrorResponse.from(code);
            finishedAt = now;
        }

        private boolean pending() {
            return status == Status.QUEUED || status == Status.PROCESSING;
        }
    }
}
