package com.janovel.domain.writing.dto;

import tools.jackson.databind.JsonNode;

public final class CharLimit {

    private CharLimit() {
    }

    public static Integer parse(JsonNode limit) {
        if (limit == null || limit.isNull()) {
            return null;
        }
        if (!limit.isIntegralNumber() || !limit.canConvertToInt()) {
            throw new IllegalArgumentException("limit must be an integer");
        }
        return limit.intValue();
    }
}
