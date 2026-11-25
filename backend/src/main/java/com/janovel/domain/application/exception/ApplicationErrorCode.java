package com.janovel.domain.application.exception;

import com.janovel.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

public enum ApplicationErrorCode implements ErrorCode {
    APPLICATION_UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "접근 키를 확인해 주세요."),
    APPLICATION_NOT_FOUND(HttpStatus.NOT_FOUND, "지원 건을 찾을 수 없어요.");

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
