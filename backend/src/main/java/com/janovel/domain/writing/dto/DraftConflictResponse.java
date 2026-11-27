package com.janovel.domain.writing.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "저장 번호가 달라 기존 본문을 보존한 응답")
public record DraftConflictResponse(int status, String message, String error, WritingHistoryDetail.Draft currentDraft) {
}
