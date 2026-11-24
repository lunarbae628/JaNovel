package com.janovel.domain.application.app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.janovel.domain.application.dto.ImportedPosting;
import com.janovel.domain.application.dto.PostingImportJobStatus;
import com.janovel.domain.application.dto.PostingImportJobStatus.Status;
import com.janovel.domain.application.exception.PostingErrorCode;
import com.janovel.global.exception.CustomException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PostingImportJobsTests {

    @Test
    @DisplayName("이미지 작업을 대기시키고 시간 예산을 벗어나는 추가 요청은 거절한다")
    void queuesWorkWithinEstimatedDeadline() throws Exception {
        var imports = mock(PostingImportService.class);
        var jobs = new PostingImportJobs(imports, 1);
        var started = new CountDownLatch(1);
        var finish = new CountDownLatch(1);
        byte[] image = {1};
        var posting = new ImportedPosting("", "", "", "", List.of(), List.of(), List.of(), "주요 업무");
        when(imports.importImage(same(image), eq("image/png"), anyLong())).thenAnswer(call -> {
            started.countDown();
            assertTrue(finish.await(3, TimeUnit.SECONDS));
            return posting;
        });
        try {
            var first = jobs.submitImage(image, "image/png");
            assertEquals(Status.QUEUED, first.status());
            assertTrue(started.await(3, TimeUnit.SECONDS));
            assertEquals(Status.PROCESSING, jobs.find(first.jobId()).status());

            var second = jobs.submitImage(image, "image/png");
            assertEquals(Status.QUEUED, jobs.find(second.jobId()).status());
            assertEquals(PostingErrorCode.POSTING_IMPORT_BUSY, assertThrows(CustomException.class,
                    () -> jobs.submitImage(image, "image/png")).getErrorCode());

            finish.countDown();
            assertEquals(posting, waitForResult(jobs, first.jobId()).result());
            assertEquals(posting, waitForResult(jobs, second.jobId()).result());
        } finally {
            finish.countDown();
            jobs.close();
        }
    }

    @Test
    @DisplayName("모델 호출 실패 원인을 조회 응답에 보존하고 없는 작업을 구분한다")
    void returnsFailureAndRejectsUnknownJob() throws Exception {
        var imports = mock(PostingImportService.class);
        var jobs = new PostingImportJobs(imports, 1);
        byte[] image = {1};
        when(imports.importImage(same(image), eq("image/png"), anyLong()))
                .thenThrow(new CustomException(PostingErrorCode.POSTING_MODEL_UNAVAILABLE));
        try {
            var accepted = jobs.submitImage(image, "image/png");
            var failed = waitForResult(jobs, accepted.jobId());
            assertEquals(Status.FAILED, failed.status());
            assertEquals("POSTING_MODEL_UNAVAILABLE", failed.error().error());
            assertEquals(503, failed.error().status());
            assertEquals(PostingErrorCode.POSTING_IMPORT_JOB_NOT_FOUND, assertThrows(CustomException.class,
                    () -> jobs.find(UUID.randomUUID())).getErrorCode());
        } finally {
            jobs.close();
        }
    }

    private PostingImportJobStatus waitForResult(PostingImportJobs jobs, UUID id) throws InterruptedException {
        long limit = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
        var status = jobs.find(id);
        while (status.pending() && System.nanoTime() < limit) {
            Thread.sleep(10);
            status = jobs.find(id);
        }
        assertTrue(!status.pending());
        return status;
    }
}
