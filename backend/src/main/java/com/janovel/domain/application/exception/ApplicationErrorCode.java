package com.janovel.domain.application.exception;

import com.janovel.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

public enum ApplicationErrorCode implements ErrorCode {
    APPLICATION_UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "접근 키를 확인해 주세요."),
    APPLICATION_NOT_FOUND(HttpStatus.NOT_FOUND, "지원 건을 찾을 수 없어요."),
    QUESTION_NOT_FOUND(HttpStatus.NOT_FOUND, "자소서 문항을 찾을 수 없어요."),
    QUESTION_LIMIT_EXCEEDED(HttpStatus.CONFLICT, "자소서 문항은 지원 건마다 30개까지 둘 수 있어요."),
    QUESTION_ORDER_MISMATCH(HttpStatus.BAD_REQUEST, "순서에는 지금 있는 문항을 빠짐없이 한 번씩 담아 주세요.");

    private final HttpStatus status;
    private final String message;

    ApplicationErrorCode(HttpStatus status, String message) {
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
