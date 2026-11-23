package com.janovel.domain.application.model;

import jakarta.persistence.EnumeratedValue;

public enum ApplicationStatus {
    INTERESTED("interested"),
    WRITING("writing"),
    SUBMITTED("submitted"),
    IN_PROGRESS("in_progress"),
    CLOSED("closed");

    @EnumeratedValue
    private final String databaseValue;

    ApplicationStatus(String databaseValue) {
        this.databaseValue = databaseValue;
    }
}
