package com.janovel.domain.application.dto;

import com.janovel.domain.application.entity.Application;
import com.janovel.domain.application.entity.ApplicationSection;
import com.janovel.domain.application.entity.ApplicationStage;
import com.janovel.domain.application.model.ApplicationStatus;
import java.util.List;

public record ApplicationDetail(long id, String company, String role, ApplicationStatus status, Deadline deadline,
                                String sourceUrl, String sourceText, List<Section> sections, List<Stage> stages) {

    public static ApplicationDetail of(Application application, List<ApplicationSection> sections,
                                       List<ApplicationStage> stages) {
        return new ApplicationDetail(application.getId(), application.getCompany(), application.getRole(),
                application.getStatus(), ApplicationSummary.deadlineOf(application), application.getSourceUrl(),
                application.getSourceText(),
                sections.stream().map(section -> new Section(section.getId(), section.getTitle(), section.getBody()))
                        .toList(),
                stages.stream().map(stage -> new Stage(stage.getId(), stage.getName())).toList());
    }

    public record Section(long id, String title, String body) {
    }

    public record Stage(long id, String name) {
    }
}
