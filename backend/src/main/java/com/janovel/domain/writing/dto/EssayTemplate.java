package com.janovel.domain.writing.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import tools.jackson.databind.JsonNode;

@Schema(description = "내 공통 자소서")
public record EssayTemplate(
        @Schema(description = "저장 순서대로 나열한 문항. 최대 30개") @NotNull @Size(max = 30) List<@NotNull @Valid Item> items) {

    @Schema(name = "EssayTemplateItem", description = "공통 자소서 문항")
    public record Item(
            @Schema(description = "문항. 1~2,000자") @NotBlank @Size(max = 2000) @Pattern(regexp = "[^\\x00]*") String prompt,
            @Schema(description = "답변 초안. 최대 20,000자") @NotNull @Size(max = 20000) @Pattern(regexp = "[^\\x00]*") String draftBody,
            @Schema(description = "글자 수 제한. 모르면 `null`이고 값이 있으면 1~100,000", nullable = true) @Min(1) @Max(100000) Integer limit) {

        @JsonCreator
        public static Item fromJson(@JsonProperty("prompt") JsonNode prompt,
                                    @JsonProperty("draftBody") JsonNode draftBody,
                                    @JsonProperty("limit") JsonNode limit) {
            Integer charLimit = null;
            if (limit != null && !limit.isNull()) {
                if (!limit.isIntegralNumber() || !limit.canConvertToInt()) {
                    throw new IllegalArgumentException("limit must be an integer");
                }
                charLimit = limit.intValue();
            }
            return new Item(prompt == null ? null : prompt.stringValue(),
                    draftBody == null ? null : draftBody.stringValue(), charLimit);
        }
    }
}
