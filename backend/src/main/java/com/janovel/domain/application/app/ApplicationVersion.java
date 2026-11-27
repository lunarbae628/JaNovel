package com.janovel.domain.application.app;

import com.janovel.domain.application.exception.ApplicationErrorCode;
import com.janovel.global.exception.CustomException;
import java.util.regex.Pattern;

/**
 * 지원 건 낙관적 잠금 버전을 요청 헤더와 주고받는다. 수정 요청은 상세 조회 때 받은 버전을 {@code If-Match}로 보내고,
 * 응답의 {@code ETag}로 새 버전을 받는다.
 */
public final class ApplicationVersion {

    private static final Pattern TAG = Pattern.compile("(?:W/)?\"?(\\d{1,18})\"?");

    private ApplicationVersion() {
    }

    /** {@code If-Match} 값을 버전으로 읽는다. 없으면 버전 확인 없이 고친다. 숫자가 아니면 400이다. */
    public static Long parse(String ifMatch) {
        if (ifMatch == null || ifMatch.isBlank()) {
            return null;
        }
        var match = TAG.matcher(ifMatch.strip());
        if (!match.matches()) {
            throw new CustomException(ApplicationErrorCode.INVALID_VERSION);
        }
        return Long.parseLong(match.group(1));
    }

    public static String tag(long version) {
        return "\"" + version + "\"";
    }
}
