package com.janovel.domain.writing.dto;

/**
 * 이름·설명처럼 비워 둘 수 있는 글. 앞뒤 공백을 없애고 비었으면 `null`로 저장한다.
 * 프론트의 `trim()`과 같이 줄바꿈 없는 공백(U+00A0)과 BOM(U+FEFF)도 공백으로 본다.
 */
final class OptionalText {

    private OptionalText() {
    }

    static String normalize(String text) {
        if (text == null) {
            return null;
        }
        int start = 0;
        int end = text.length();
        while (start < end && blank(text.codePointAt(start))) {
            start += Character.charCount(text.codePointAt(start));
        }
        while (end > start && blank(text.codePointBefore(end))) {
            end -= Character.charCount(text.codePointBefore(end));
        }
        return start == end ? null : text.substring(start, end);
    }

    private static boolean blank(int codePoint) {
        return Character.isWhitespace(codePoint) || Character.isSpaceChar(codePoint) || codePoint == '\uFEFF';
    }
}
