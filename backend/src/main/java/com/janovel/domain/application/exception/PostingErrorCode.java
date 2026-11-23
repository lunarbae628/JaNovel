package com.janovel.domain.application.exception;

import com.janovel.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

public enum PostingErrorCode implements ErrorCode {
    INVALID_POSTING_URL(HttpStatus.BAD_REQUEST, "공개 HTTP 또는 HTTPS 공고 주소를 입력해 주세요."),
    POSTING_TIMEOUT(HttpStatus.GATEWAY_TIMEOUT, "공고 페이지가 제시간에 응답하지 않았어요."),
    POSTING_UNREADABLE(HttpStatus.BAD_GATEWAY, "공고 페이지의 내용을 읽을 수 없어요.");

    private final HttpStatus status;
    private final String message;

    PostingErrorCode(HttpStatus status, String message) {
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
