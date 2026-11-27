package com.janovel.global.exception;

import org.springframework.http.HttpStatus;

public enum CommonErrorCode implements ErrorCode {
    REQUEST_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE, "요청이 너무 커요. 2MB 이하로 보내 주세요.");

    private final HttpStatus status;
    private final String message;

    CommonErrorCode(HttpStatus status, String message) {
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
