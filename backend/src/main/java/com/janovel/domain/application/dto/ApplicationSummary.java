package com.janovel.domain.application.dto;

import com.janovel.domain.application.entity.Application;
import com.janovel.domain.application.model.ApplicationStatus;

public record ApplicationSummary(long id, String company, String role, ApplicationStatus status, Deadline deadline) {

    public static ApplicationSummary from(Application application) {
        return new ApplicationSummary(
                application.getId(),
                application.getCompany(),
                application.getRole(),
                application.getStatus(),
                deadlineOf(application)
        );
    }

    static Deadline deadlineOf(Application application) {
        if (application.getDeadlineKind() == null) {
            return null;
        }
        return new Deadline(application.getDeadlineKind(), application.getDeadlineDate(),
                application.getDeadlineTime());
    }
}
