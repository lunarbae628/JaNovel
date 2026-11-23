package com.janovel.global.exception;

public record ErrorResponse(int status, String message, String error) {

    public static ErrorResponse from(ErrorCode errorCode) {
        return new ErrorResponse(errorCode.getStatus().value(), errorCode.getMessage(), errorCode.getCode());
    }
}
