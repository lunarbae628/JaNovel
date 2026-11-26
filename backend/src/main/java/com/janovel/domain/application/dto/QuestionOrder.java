package com.janovel.domain.application.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;

@Schema(description = "자소서 문항 순서")
public record QuestionOrder(
        @Schema(description = "새 순서대로 나열한 문항 번호. 지금 있는 문항을 빠짐없이 한 번씩 담는다.")
        @NotNull @Size(max = 30) List<@NotNull Long> ids) {

    @JsonCreator
    public static QuestionOrder fromJson(@JsonProperty("ids") JsonNode ids) {
        if (ids == null || ids.isNull()) {
            return new QuestionOrder(null);
        }
        if (!ids.isArray()) {
            throw new IllegalArgumentException("ids must be an array");
        }
        var parsed = new ArrayList<Long>();
        for (var id : ids) {
            parsed.add(StrictId.parse(id));
        }
        return new QuestionOrder(parsed);
    }
}
