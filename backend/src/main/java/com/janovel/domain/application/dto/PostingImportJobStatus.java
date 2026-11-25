package com.janovel.domain.application.dto;

import com.janovel.global.exception.ErrorResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "이미지 가져오기 작업 상태")
public record PostingImportJobStatus(
        @Schema(description = "작업 번호") UUID jobId,
        @Schema(description = "`QUEUED`, `PROCESSING`이면 `Retry-After`만큼 뒤에 다시 조회한다.") Status status,
        @Schema(description = "`COMPLETED`일 때의 결과. 완료 전에는 `null`", nullable = true) ImportedPosting result,
        @Schema(description = "`FAILED`일 때의 오류. 실패가 아니면 `null`", nullable = true) ErrorResponse error) {

    public enum Status {
        QUEUED, PROCESSING, COMPLETED, FAILED
    }

    public boolean pending() {
        return status == Status.QUEUED || status == Status.PROCESSING;
    }
}
