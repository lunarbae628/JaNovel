package com.janovel.domain.writing.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

@Schema(description = "현재 문항에서 보내는 AI 채팅 요청")
public record WritingChatRequest(
        @Schema(description = "초안 작성(draft) 또는 대화(chat)") @NotBlank @Pattern(regexp = "draft|chat") String kind,
        @Schema(description = "공고와 문항, 선택한 경험 또는 현재 본문") @NotBlank @Size(max = 100_000) String context,
        @Schema(description = "사용자의 새 요청") @NotBlank @Size(max = 4_000) String request,
        @Schema(description = "이 문항의 최근 대화") @NotNull @Size(max = 8) List<@NotNull @Valid Turn> history) {

    public record Turn(
            @Schema(description = "사용자 또는 AI") @NotBlank @Pattern(regexp = "user|assistant") String role,
            @Schema(description = "대화 내용") @NotBlank @Size(max = 12_000) String text) {
    }
}
