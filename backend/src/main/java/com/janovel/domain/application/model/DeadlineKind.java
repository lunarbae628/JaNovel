package com.janovel.domain.application.model;

import jakarta.persistence.EnumeratedValue;

public enum DeadlineKind {
    FIXED("fixed"),
    ROLLING("rolling"),
    UNTIL_FILLED("until_filled"),
    ALWAYS_OPEN("always_open");

    @EnumeratedValue
    private final String databaseValue;

    DeadlineKind(String databaseValue) {
        this.databaseValue = databaseValue;
    }
}
