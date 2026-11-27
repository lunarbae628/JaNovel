package com.janovel.domain.application.app;

/** 수정 결과와 수정 뒤의 지원 건 버전. 컨트롤러가 버전을 {@code ETag}로 돌려준다. */
public record Versioned<T>(T body, long version) {
}
