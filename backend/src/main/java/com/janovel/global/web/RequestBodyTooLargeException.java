package com.janovel.global.web;

import java.io.IOException;

/** 길이를 알리지 않은 요청 본문이 읽는 도중 상한을 넘었다. 메시지 변환 오류의 원인으로 감싸져 413으로 바뀐다. */
public class RequestBodyTooLargeException extends IOException {

    public RequestBodyTooLargeException() {
        super("request body exceeds " + RequestSizeLimitFilter.MAX_BODY_BYTES + " bytes");
    }
}
