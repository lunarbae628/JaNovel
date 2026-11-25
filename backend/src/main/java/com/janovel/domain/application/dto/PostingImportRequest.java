package com.janovel.domain.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "공고 가져오기 요청")
public record PostingImportRequest(
        @Schema(description = "공개 http 또는 https 공고 주소. 최대 2,048자", example = "https://careers.example.com/jobs/1")
        @NotBlank @Size(max = 2048) String url) {
}
