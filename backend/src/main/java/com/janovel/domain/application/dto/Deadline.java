package com.janovel.domain.application.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.janovel.domain.application.model.DeadlineKind;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalTime;

public record Deadline(@NotNull DeadlineKind kind, LocalDate date,
                       @JsonFormat(pattern = "HH:mm") LocalTime time) {

    @JsonIgnore
    @AssertTrue
    public boolean isConsistent() {
        if (kind == DeadlineKind.FIXED) {
            return date != null;
        }
        return date == null && time == null;
    }
}
