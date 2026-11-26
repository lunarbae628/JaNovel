package com.janovel.domain.application.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import tools.jackson.databind.JsonNode;

@Schema(description = "채용 전형 목록 수정 요청. 보낸 목록이 새 전형 목록이 된다.")
public record StagesUpdate(
        @Schema(description = "새 순서대로 나열한 전형. 최대 20개. 번호가 있으면 그 전형의 이름을 바꾸고, 없으면 새로 만들며, 빠진 전형은 지운다.")
        @NotNull @Size(max = 20) List<@NotNull @Valid Stage> stages) {

    @Schema(name = "ApplicationStageInput", description = "채용 전형")
    public record Stage(
            @Schema(description = "기존 전형 번호. 새 전형이면 생략", nullable = true) Long id,
            @Schema(description = "전형 이름. 앞뒤 공백을 제거한 뒤 1~100자", example = "1차 면접") @NotBlank @Size(max = 100) @Pattern(regexp = "[^\\x00]*") String name) {

        public Stage {
            name = name == null ? null : name.strip();
        }

        @JsonCreator
        public static Stage fromJson(@JsonProperty("id") JsonNode id, @JsonProperty("name") JsonNode name) {
            return new Stage(StrictId.parse(id), name == null || name.isNull() ? null : name.stringValue());
        }
    }
}
