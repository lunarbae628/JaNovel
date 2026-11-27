package com.janovel.domain.writing.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.janovel.domain.application.dto.StrictId;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

@Schema(description = "초안 저장 요청. 본문은 비울 수 있다.")
public record DraftWrite(
        @NotNull @Size(max = 100_000) @Pattern(regexp = "[^\\u0000\\uD800-\\uDFFF]*") String body,
        @NotNull @PositiveOrZero Long revision) {

    @JsonCreator
    public static DraftWrite fromJson(@JsonProperty("body") JsonNode body, @JsonProperty("revision") JsonNode revision) {
        return new DraftWrite(body == null ? null : body.stringValue(), StrictId.parse(revision));
    }
}
