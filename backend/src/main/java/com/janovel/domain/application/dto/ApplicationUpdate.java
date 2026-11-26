package com.janovel.domain.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "지원 건 기본 정보 수정 요청. 보낸 값으로 모두 바꾸며 생략한 마감·주소·원문은 지운다.")
public record ApplicationUpdate(
        @Schema(description = "회사명. 앞뒤 공백을 제거한 뒤 1~100자", example = "예시 회사") @NotBlank @Size(max = 100) @Pattern(regexp = "[^\\x00]*") String company,
        @Schema(description = "직무. 앞뒤 공백을 제거한 뒤 1~150자", example = "백엔드 개발자") @NotBlank @Size(max = 150) @Pattern(regexp = "[^\\x00]*") String role,
        @Schema(description = "마감. 모르면 생략하거나 `null`") @Valid Deadline deadline,
        @Schema(description = "공고 주소. 최대 2,048자") @Size(max = 2048) @Pattern(regexp = "[^\\x00]*") String sourceUrl,
        @Schema(description = "공고 원문. 최대 30,000자") @Size(max = 30000) @Pattern(regexp = "[^\\x00]*") String sourceText) {

    public ApplicationUpdate {
        company = company == null ? null : company.strip();
        role = role == null ? null : role.strip();
    }
}
