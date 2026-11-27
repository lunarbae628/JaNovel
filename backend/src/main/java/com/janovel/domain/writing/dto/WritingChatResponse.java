package com.janovel.domain.writing.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "현재 문항의 AI 답변")
public record WritingChatResponse(
        @Schema(description = "답변 또는 피드백") String reply,
        @Schema(description = "초안 또는 수정안. 해당 내용이 없으면 빈 문자열") String candidate) {
}
