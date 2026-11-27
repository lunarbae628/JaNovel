package com.janovel.domain.writing.exception;

import com.janovel.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

public enum WritingErrorCode implements ErrorCode {
    VERSION_NOT_FOUND(HttpStatus.NOT_FOUND, "작성 버전을 찾을 수 없어요."),
    SNAPSHOT_NOT_FOUND(HttpStatus.NOT_FOUND, "스냅샷을 찾을 수 없어요."),
    SNAPSHOT_MISMATCH(HttpStatus.BAD_REQUEST, "이 문항의 스냅샷에서만 버전을 만들 수 있어요."),
    SNAPSHOT_IN_USE(HttpStatus.CONFLICT, "버전의 마지막 스냅샷이고 다른 기록이나 버전이 참조하지 않을 때만 지울 수 있어요."),
    LAST_VERSION(HttpStatus.CONFLICT, "버전은 하나 이상 남겨야 해요."),
    DUPLICATE_VERSION_NAME(HttpStatus.CONFLICT, "같은 이름의 버전이 있어요. 다른 이름을 입력해 주세요."),
    VERSION_MISMATCH(HttpStatus.BAD_REQUEST, "이 문항의 버전만 고를 수 있어요."),
    SUBMISSION_REQUIRED(HttpStatus.CONFLICT, "먼저 제출본으로 쓸 기록을 골라 주세요."),
    EMPTY_TEXT(HttpStatus.BAD_REQUEST, "본문을 입력해 주세요."),
    NO_CHANGES(HttpStatus.CONFLICT, "이전 스냅샷과 본문이 같아요."),
    DRAFT_CONFLICT(HttpStatus.CONFLICT, "다른 곳에서 초안이 바뀌었어요.");

    private final HttpStatus status;
    private final String message;

    WritingErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    @Override
    public HttpStatus getStatus() {
        return status;
    }

    @Override
    public String getMessage() {
        return message;
    }

    @Override
    public String getCode() {
        return name();
    }
}
