package com.janovel.domain.writing.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import tools.jackson.databind.JsonNode;

public record EssayTemplate(@NotNull @Size(max = 30) List<@NotNull @Valid Item> items) {

    public record Item(@NotBlank @Size(max = 2000) @Pattern(regexp = "[^\\x00]*") String prompt,
                       @NotNull @Size(max = 20000) @Pattern(regexp = "[^\\x00]*") String draftBody,
                       @Min(1) @Max(100000) Integer limit) {

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
