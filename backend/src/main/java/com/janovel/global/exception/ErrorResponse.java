package com.janovel.global.exception;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "오류 응답")
public record ErrorResponse(
        @Schema(description = "HTTP 상태 번호", example = "400") int status,
        @Schema(description = "사용자에게 표시할 메시지", example = "요청 내용을 확인해 주세요.") String message,
        @Schema(description = "클라이언트가 분기에 쓰는 오류 코드", example = "INVALID_REQUEST") String error) {

    public static ErrorResponse from(ErrorCode errorCode) {
        return new ErrorResponse(errorCode.getStatus().value(), errorCode.getMessage(), errorCode.getCode());
    }
}
