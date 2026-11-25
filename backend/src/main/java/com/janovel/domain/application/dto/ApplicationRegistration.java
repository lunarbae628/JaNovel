package com.janovel.domain.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

@Schema(description = "지원 건 등록 요청. 마감, 원문, 항목, 전형은 생략하거나 비울 수 있다.")
public record ApplicationRegistration(
        @Schema(description = "회사명. 앞뒤 공백을 제거한 뒤 1~100자", example = "예시 회사") @NotBlank @Size(max = 100) @Pattern(regexp = "[^\\x00]*") String company,
        @Schema(description = "직무. 앞뒤 공백을 제거한 뒤 1~150자", example = "백엔드 개발자") @NotBlank @Size(max = 150) @Pattern(regexp = "[^\\x00]*") String role,
        @Schema(description = "마감. 모르면 생략한다.") @Valid Deadline deadline,
        @Schema(description = "공고 주소. 최대 2,048자") @Size(max = 2048) @Pattern(regexp = "[^\\x00]*") String sourceUrl,
        @Schema(description = "공고 원문. 최대 30,000자") @Size(max = 30000) @Pattern(regexp = "[^\\x00]*") String sourceText,
        @Schema(description = "공고 항목. 최대 30개이며 보낸 순서대로 저장한다.") @Size(max = 30) List<@NotNull @Valid Section> sections,
        @Schema(description = "채용 전형 이름. 최대 20개, 이름은 1~100자이며 보낸 순서대로 저장한다.", example = "[\"서류전형\", \"1차 면접\"]") @Size(max = 20) List<@NotBlank @Size(max = 100) @Pattern(regexp = "[^\\x00]*") String> stages) {

    public ApplicationRegistration {
        company = company == null ? null : company.strip();
        role = role == null ? null : role.strip();
        sections = sections == null ? List.of() : sections;
        stages = stages == null ? List.of() : stages.stream().map(name -> name == null ? null : name.strip()).toList();
    }

    @Schema(name = "ApplicationSectionInput", description = "공고 항목")
    public record Section(
            @Schema(description = "항목 제목. 1~100자", example = "업무") @NotBlank @Size(max = 100) @Pattern(regexp = "[^\\x00]*") String title,
            @Schema(description = "항목 본문. 최대 20,000자", example = "API 개발") @NotNull @Size(max = 20000) @Pattern(regexp = "[^\\x00]*") String body) {
    }
}
