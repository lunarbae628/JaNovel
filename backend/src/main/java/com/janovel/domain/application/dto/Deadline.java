package com.janovel.domain.application.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.janovel.domain.application.model.DeadlineKind;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalTime;

@Schema(description = "지원 마감. `fixed`는 날짜가 필수이고 나머지 종류는 날짜와 시각을 넣지 않는다.")
public record Deadline(
        @Schema(description = "마감 종류") @NotNull DeadlineKind kind,
        @Schema(description = "마감 날짜", example = "2026-12-16") LocalDate date,
        @Schema(description = "마감 시각. 날짜가 있을 때만 쓴다.", type = "string", pattern = "^([01][0-9]|2[0-3]):[0-5][0-9]$",
                example = "23:59") @JsonFormat(pattern = "HH:mm") LocalTime time) {

    @JsonIgnore
    @AssertTrue
    public boolean isConsistent() {
        if (kind == DeadlineKind.FIXED) {
            return date != null;
        }
        return date == null && time == null;
    }
}
