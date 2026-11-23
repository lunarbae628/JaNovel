package com.janovel.domain.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PostingImportRequest(@NotBlank @Size(max = 2048) String url) {
}
