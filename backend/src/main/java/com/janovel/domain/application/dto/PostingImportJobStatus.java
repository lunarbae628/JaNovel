package com.janovel.domain.application.dto;

import com.janovel.global.exception.ErrorResponse;
import java.util.UUID;

public record PostingImportJobStatus(UUID jobId, Status status, ImportedPosting result, ErrorResponse error) {

    public enum Status {
        QUEUED, PROCESSING, COMPLETED, FAILED
    }

    public boolean pending() {
        return status == Status.QUEUED || status == Status.PROCESSING;
    }
}
