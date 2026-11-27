package com.janovel.domain.writing.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.janovel.domain.application.dto.StrictId;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import tools.jackson.databind.JsonNode;

@Schema(description = "작성 화면에서 연 버전. 이 문항의 현재 버전과 지원 건의 마지막 문항을 함께 기억한다.")
public record ActiveVersionChange(
        @Schema(description = "연 버전의 id. 이 문항의 버전만 고를 수 있다.") @NotNull Long versionId) {

    @JsonCreator
    public static ActiveVersionChange fromJson(@JsonProperty("versionId") JsonNode versionId) {
        return new ActiveVersionChange(StrictId.parse(versionId));
    }
}
