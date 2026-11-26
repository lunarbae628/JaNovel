package com.janovel.domain.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

@Schema(description = "공고 항목 교체 요청")
public record SectionsReplacement(
        @Schema(description = "새 공고 항목. 최대 30개이며 보낸 순서대로 저장하고 기존 항목은 지운다.")
        @NotNull @Size(max = 30) List<ApplicationRegistration.@NotNull @Valid Section> sections) {
}
