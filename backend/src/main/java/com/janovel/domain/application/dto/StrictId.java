package com.janovel.domain.application.dto;

import tools.jackson.databind.JsonNode;

/** 요청 본문의 번호를 정수로만 받는다. `1.9`나 `"1"`이 조용히 `1`로 바뀌지 않게 한다. */
public final class StrictId {

    private StrictId() {
    }

    public static Long parse(JsonNode id) {
        if (id == null || id.isNull()) {
            return null;
        }
        if (!id.isIntegralNumber() || !id.canConvertToLong()) {
            throw new IllegalArgumentException("id must be an integer");
        }
        return id.longValue();
    }
}
