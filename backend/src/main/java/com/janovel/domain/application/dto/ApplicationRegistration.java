package com.janovel.domain.application.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.janovel.domain.writing.dto.CharLimit;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import tools.jackson.databind.JsonNode;

@Schema(description = "지원 건 등록 요청. 마감, 원문, 항목, 전형, 자소서 문항은 생략하거나 비울 수 있다.")
public record ApplicationRegistration(
        @Schema(description = "회사명. 앞뒤 공백을 제거한 뒤 1~100자", example = "예시 회사") @NotBlank @Size(max = 100) @Pattern(regexp = "[^\\x00]*") String company,
        @Schema(description = "직무. 앞뒤 공백을 제거한 뒤 1~150자", example = "백엔드 개발자") @NotBlank @Size(max = 150) @Pattern(regexp = "[^\\x00]*") String role,
        @Schema(description = "마감. 모르면 생략한다.") @Valid Deadline deadline,
        @Schema(description = "공고 주소. 최대 2,048자") @Size(max = 2048) @Pattern(regexp = "[^\\x00]*") String sourceUrl,
        @Schema(description = "공고 원문. 최대 30,000자") @Size(max = 30000) @Pattern(regexp = "[^\\x00]*") String sourceText,
        @Schema(description = "공고 항목. 최대 30개이며 보낸 순서대로 저장한다.") @Size(max = 30) List<@NotNull @Valid Section> sections,
        @Schema(description = "채용 전형 이름. 최대 20개, 이름은 1~100자이며 보낸 순서대로 저장한다.", example = "[\"서류전형\", \"1차 면접\"]") @Size(max = 20) List<@NotBlank @Size(max = 100) @Pattern(regexp = "[^\\x00]*") String> stages,
        @Schema(description = "자소서 문항. 최대 30개이며 보낸 순서대로 저장한다.") @Size(max = 30) List<@NotNull @Valid Question> questions) {

    public ApplicationRegistration {
        company = company == null ? null : company.strip();
        role = role == null ? null : role.strip();
        sections = sections == null ? List.of() : sections;
        stages = stages == null ? List.of() : stages.stream().map(name -> name == null ? null : name.strip()).toList();
        questions = questions == null ? List.of() : questions;
    }

    @Schema(name = "ApplicationSectionInput", description = "공고 항목")
    public record Section(
            @Schema(description = "항목 제목. 1~100자", example = "업무") @NotBlank @Size(max = 100) @Pattern(regexp = "[^\\x00]*") String title,
            @Schema(description = "항목 본문. 최대 20,000자", example = "API 개발") @NotNull @Size(max = 20000) @Pattern(regexp = "[^\\x00]*") String body) {
    }

    @Schema(name = "ApplicationQuestionInput", description = "자소서 문항")
    public record Question(
            @Schema(description = "문항. 앞뒤 공백을 제거한 뒤 1~2,000자", example = "지원 동기를 알려 주세요.") @NotBlank @Size(max = 2000) @Pattern(regexp = "[^\\x00]*") String prompt,
            @Schema(description = "글자 수 제한. 모르면 생략하거나 `null`이고 값이 있으면 1~100,000", nullable = true) @Min(1) @Max(100000) Integer limit) {

        public Question {
            prompt = prompt == null ? null : prompt.strip();
        }

        @JsonCreator
        public static Question fromJson(@JsonProperty("prompt") JsonNode prompt, @JsonProperty("limit") JsonNode limit) {
            return new Question(prompt == null ? null : prompt.stringValue(), CharLimit.parse(limit));
        }
    }
}
