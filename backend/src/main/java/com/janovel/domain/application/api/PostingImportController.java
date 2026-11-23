package com.janovel.domain.application.api;

import com.janovel.domain.application.app.PostingImportService;
import com.janovel.domain.application.dto.ImportedPosting;
import com.janovel.domain.application.dto.PostingImportRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/postings")
public class PostingImportController {

    private final PostingImportService postingImportService;

    public PostingImportController(PostingImportService postingImportService) {
        this.postingImportService = postingImportService;
    }

    @PostMapping("/import")
    public ImportedPosting importPosting(@Valid @RequestBody PostingImportRequest request) {
        return postingImportService.importPosting(request.url());
    }
}
