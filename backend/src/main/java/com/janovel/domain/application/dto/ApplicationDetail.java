package com.janovel.domain.application.dto;

import com.janovel.domain.application.entity.Application;
import com.janovel.domain.application.entity.ApplicationSection;
import com.janovel.domain.application.entity.ApplicationStage;
import com.janovel.domain.application.model.ApplicationStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "지원 건 상세")
public record ApplicationDetail(
        @Schema(description = "지원 건 번호") long id,
        @Schema(description = "회사명") String company,
        @Schema(description = "직무") String role,
        @Schema(description = "지원 상태. 새 지원 건은 `interested`다.") ApplicationStatus status,
        @Schema(description = "마감. 모르면 `null`") Deadline deadline,
        @Schema(description = "공고 주소. 없으면 `null`") String sourceUrl,
        @Schema(description = "공고 원문. 없으면 `null`") String sourceText,
        @Schema(description = "공고 항목. 등록한 순서") List<Section> sections,
        @Schema(description = "채용 전형. 등록한 순서") List<Stage> stages) {

    public static ApplicationDetail of(Application application, List<ApplicationSection> sections,
                                       List<ApplicationStage> stages) {
        return new ApplicationDetail(application.getId(), application.getCompany(), application.getRole(),
                application.getStatus(), ApplicationSummary.deadlineOf(application), application.getSourceUrl(),
                application.getSourceText(),
                sections.stream().map(section -> new Section(section.getId(), section.getTitle(), section.getBody()))
                        .toList(),
                stages.stream().map(stage -> new Stage(stage.getId(), stage.getName())).toList());
    }

    @Schema(name = "ApplicationSection", description = "공고 항목")
    public record Section(long id, String title, String body) {
    }

    @Schema(name = "ApplicationStage", description = "채용 전형")
    public record Stage(long id, String name) {
    }
}
