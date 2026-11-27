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

@Schema(description = "현재 본문을 스냅샷으로 남기는 요청")
public record SnapshotCreate(
        @NotNull @Size(max = 100_000) @Pattern(regexp = "[^\\u0000\\uD800-\\uDFFF]*") String body,
        @NotNull @PositiveOrZero Long revision,
        @Size(max = 100) @Pattern(regexp = "[^\\u0000\\uD800-\\uDFFF]*") String title,
        @Size(max = 2000) @Pattern(regexp = "[^\\u0000\\uD800-\\uDFFF]*") String description) {

    public SnapshotCreate {
        title = OptionalText.normalize(title);
        description = OptionalText.normalize(description);
    }

    @JsonCreator
    public static SnapshotCreate fromJson(@JsonProperty("body") JsonNode body,
                                          @JsonProperty("revision") JsonNode revision,
                                          @JsonProperty("title") String title,
                                          @JsonProperty("description") String description) {
        return new SnapshotCreate(body == null ? null : body.stringValue(), StrictId.parse(revision), title, description);
    }
}
