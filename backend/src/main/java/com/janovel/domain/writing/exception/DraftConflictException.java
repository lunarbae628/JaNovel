package com.janovel.domain.writing.exception;

import com.janovel.domain.writing.dto.WritingHistoryDetail;
import com.janovel.global.exception.CustomException;

public class DraftConflictException extends CustomException {

    private final WritingHistoryDetail.Draft currentDraft;

    public DraftConflictException(WritingHistoryDetail.Draft currentDraft) {
        super(WritingErrorCode.DRAFT_CONFLICT);
        this.currentDraft = currentDraft;
    }

    public WritingHistoryDetail.Draft getCurrentDraft() {
        return currentDraft;
    }
}
