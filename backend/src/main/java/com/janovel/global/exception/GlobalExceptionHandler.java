package com.janovel.global.exception;

import com.janovel.domain.application.exception.PostingErrorCode;
import com.janovel.global.web.RequestBodyTooLargeException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(CustomException.class)
    public ResponseEntity<ErrorResponse> handleCustomException(CustomException exception) {
        return ResponseEntity.status(exception.getErrorCode().getStatus())
                .body(ErrorResponse.from(exception.getErrorCode()));
    }

    /** 길이를 알리지 않은 본문이 읽는 도중 2MB를 넘으면 JSON 변환 오류로 감싸져 온다. 400이 아니라 413으로 돌려준다. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof RequestBodyTooLargeException) {
                return ResponseEntity.status(CommonErrorCode.REQUEST_TOO_LARGE.getStatus())
                        .body(ErrorResponse.from(CommonErrorCode.REQUEST_TOO_LARGE));
            }
        }
        return handleInvalidRequest();
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, MissingServletRequestPartException.class})
    public ResponseEntity<ErrorResponse> handleInvalidRequest() {
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(HttpStatus.BAD_REQUEST.value(), "요청 내용을 확인해 주세요.", "INVALID_REQUEST"));
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ErrorResponse> handleMethodValidation(HandlerMethodValidationException exception) {
        if (exception.isForReturnValue()) {
            throw exception;
        }
        return handleInvalidRequest();
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleUploadSizeExceeded() {
        return ResponseEntity.status(PostingErrorCode.POSTING_IMAGE_TOO_LARGE.getStatus())
                .body(ErrorResponse.from(PostingErrorCode.POSTING_IMAGE_TOO_LARGE));
    }
}
