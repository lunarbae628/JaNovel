package com.janovel.domain.application.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.janovel.domain.application.model.ApplicationStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import tools.jackson.databind.JsonNode;

@Schema(description = "지원 상태와 현재 전형 변경 요청")
public record ApplicationProgress(
        @Schema(description = "지원 상태") @NotNull ApplicationStatus status,
        @Schema(description = "현재 전형 번호. 이 지원 건의 전형만 고를 수 있고 비우려면 `null`", nullable = true) Long currentStageId) {

    @JsonCreator
    public static ApplicationProgress fromJson(@JsonProperty("status") ApplicationStatus status,
                                               @JsonProperty("currentStageId") JsonNode currentStageId) {
        return new ApplicationProgress(status, StrictId.parse(currentStageId));
    }
}
