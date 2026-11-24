package com.janovel.domain.application.api;

import com.janovel.domain.application.app.PostingImportJobs;
import com.janovel.domain.application.app.PostingImportService;
import com.janovel.domain.application.dto.PostingImportJobStatus;
import com.janovel.domain.application.dto.ImportedPosting;
import com.janovel.domain.application.dto.PostingImportRequest;
import jakarta.validation.Valid;
import java.io.IOException;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/postings")
public class PostingImportController {

    private final PostingImportService postingImportService;
    private final PostingImportJobs jobs;

    public PostingImportController(PostingImportService postingImportService, PostingImportJobs jobs) {
        this.postingImportService = postingImportService;
        this.jobs = jobs;
    }

    @PostMapping("/import")
    public ImportedPosting importPosting(@Valid @RequestBody PostingImportRequest request) {
        return postingImportService.importPosting(request.url());
    }

    @PostMapping({"/import/retry", "/import/ocr"})
    public ResponseEntity<PostingImportJobStatus> retryWithImage(@Valid @RequestBody PostingImportRequest request) {
        return accepted(jobs.submitLink(request.url()));
    }

    @PostMapping(path = "/import-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PostingImportJobStatus> importImage(@RequestPart("image") MultipartFile image)
            throws IOException {
        return accepted(jobs.submitImage(image.getBytes(), image.getContentType()));
    }

    @GetMapping("/import-jobs/{jobId}")
    public ResponseEntity<PostingImportJobStatus> getJob(@PathVariable("jobId") UUID jobId) {
        PostingImportJobStatus job = jobs.find(jobId);
        var response = ResponseEntity.ok().cacheControl(CacheControl.noStore());
        if (job.pending()) {
            response.header(HttpHeaders.RETRY_AFTER, "1");
        }
        return response.body(job);
    }

    private ResponseEntity<PostingImportJobStatus> accepted(PostingImportJobStatus job) {
        return ResponseEntity.accepted()
                .location(URI.create("/api/postings/import-jobs/" + job.jobId()))
                .cacheControl(CacheControl.noStore())
                .body(job);
    }
}
