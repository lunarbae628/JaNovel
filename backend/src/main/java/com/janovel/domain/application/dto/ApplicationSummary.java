package com.janovel.domain.application.dto;

import com.janovel.domain.application.entity.Application;
import com.janovel.domain.application.model.ApplicationStatus;

public record ApplicationSummary(long id, String company, String role, ApplicationStatus status) {

    public static ApplicationSummary from(Application application) {
        return new ApplicationSummary(
                application.getId(),
                application.getCompany(),
                application.getRole(),
                application.getStatus()
        );
    }
}
