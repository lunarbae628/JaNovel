package com.janovel.domain.application.exception;

import com.janovel.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

public enum PostingErrorCode implements ErrorCode {
    INVALID_POSTING_URL(HttpStatus.BAD_REQUEST, "공개 HTTP 또는 HTTPS 공고 주소를 입력해 주세요."),
    POSTING_TIMEOUT(HttpStatus.GATEWAY_TIMEOUT, "공고 가져오기가 제시간에 끝나지 않았어요."),
    POSTING_UNREADABLE(HttpStatus.BAD_GATEWAY, "공고 페이지의 내용을 읽을 수 없어요."),
    POSTING_IMAGE_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE, "이미지 크기를 줄여 다시 시도해 주세요."),
    UNSUPPORTED_POSTING_IMAGE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "JPG, PNG, WebP 이미지를 선택해 주세요."),
    POSTING_INVALID_IMAGE(HttpStatus.BAD_REQUEST, "이미지 파일을 확인해 주세요."),
    POSTING_IMPORT_BUSY(HttpStatus.SERVICE_UNAVAILABLE, "다른 공고를 읽고 있어요. 잠시 후 다시 시도해 주세요."),
    POSTING_IMPORT_JOB_NOT_FOUND(HttpStatus.NOT_FOUND, "가져오기 요청을 찾을 수 없어요. 다시 시도해 주세요."),
    POSTING_MODEL_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "공고 정리 서비스를 사용할 수 없어요. 잠시 후 다시 시도해 주세요."),
    POSTING_MODEL_FAILED(HttpStatus.BAD_GATEWAY, "공고 내용을 정리하지 못했어요. 원문을 확인하고 직접 입력할 수 있어요.");

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
