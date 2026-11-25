package com.janovel.domain.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "공고에서 읽어 낸 값. 가져오지 못한 값은 빈 문자열이나 빈 배열이다.")
public record ImportedPosting(
        @Schema(description = "회사명. 최대 100자") String company,
        @Schema(description = "직무명. 최대 150자") String role,
        @Schema(description = "마감 날짜 `YYYY-MM-DD`. 접수 시작일이나 게시일은 마감일이 아니다. 모르거나 상시채용·채용시까지처럼 끝이 정해지지 않았으면 빈 문자열", example = "2026-12-16") String deadline,
        @Schema(description = "확인된 마감 시각 `HH:mm`. 없으면 빈 문자열", example = "23:59") String deadlineTime,
        @Schema(description = "공고 항목") List<Section> sections,
        @Schema(description = "공고에 나온 채용 전형 순서") List<String> stages,
        @Schema(description = "자소서 문항. 글자 수를 모르면 `limit`이 `null`") List<Question> questions,
        @Schema(description = "공고에 명시된 여러 모집 직무. 직무가 하나면 빈 배열이고 상위 필드를 쓴다. 공통 값은 상위 필드에 둔다.") List<Position> positions,
        @Schema(description = "링크에서 확보한 본문. 최대 30,000자이며 이미지로 읽었으면 빈 문자열") String sourceText) {

    @Schema(name = "PostingPosition", description = "모집 직무")
    public record Position(String role, String deadline, String deadlineTime, List<Section> sections,
                           List<String> stages, List<Question> questions) {
    }

    @Schema(name = "PostingSection", description = "공고 항목")
    public record Section(String title, String body) {
    }

    @Schema(name = "PostingQuestion", description = "자소서 문항")
    public record Question(
            @Schema(description = "문항 원문") String prompt,
            @Schema(description = "글자 수 제한. 모르면 `null`", nullable = true) Integer limit) {
    }
}
