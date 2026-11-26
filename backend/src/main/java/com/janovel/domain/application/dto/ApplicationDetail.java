package com.janovel.domain.application.dto;

import com.janovel.domain.application.entity.Application;
import com.janovel.domain.application.entity.ApplicationSection;
import com.janovel.domain.application.entity.ApplicationStage;
import com.janovel.domain.application.model.ApplicationStatus;
import com.janovel.domain.writing.entity.EssayQuestion;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "지원 건 상세")
public record ApplicationDetail(
        @Schema(description = "지원 건 번호") long id,
        @Schema(description = "회사명") String company,
        @Schema(description = "직무") String role,
        @Schema(description = "지원 상태. 새 지원 건은 `interested`다.") ApplicationStatus status,
        @Schema(description = "현재 전형 번호. 고르지 않았으면 `null`", nullable = true) Long currentStageId,
        @Schema(description = "종료할 때의 현재 전형 이름. 종료하지 않았거나 전형을 고르지 않았으면 `null`", nullable = true) String outcomeStageName,
        @Schema(description = "마감. 모르면 `null`") Deadline deadline,
        @Schema(description = "공고 주소. 없으면 `null`") String sourceUrl,
        @Schema(description = "공고 원문. 없으면 `null`") String sourceText,
        @Schema(description = "공고 항목. 등록한 순서") List<Section> sections,
        @Schema(description = "채용 전형. 등록한 순서") List<Stage> stages,
        @Schema(description = "자소서 문항. 등록한 순서") List<Question> questions) {

    public static ApplicationDetail of(Application application, List<ApplicationSection> sections,
                                       List<ApplicationStage> stages, List<EssayQuestion> questions) {
        return new ApplicationDetail(application.getId(), application.getCompany(), application.getRole(),
                application.getStatus(), application.getCurrentStageId(), application.getOutcomeStageName(),
                ApplicationSummary.deadlineOf(application), application.getSourceUrl(),
                application.getSourceText(),
                sections.stream().map(section -> new Section(section.getId(), section.getTitle(), section.getBody()))
                        .toList(),
                stages.stream().map(stage -> new Stage(stage.getId(), stage.getName())).toList(),
                questions.stream().map(question -> new Question(question.getId(), question.getPrompt(),
                        question.getCharLimit())).toList());
    }

    @Schema(name = "ApplicationSection", description = "공고 항목")
    public record Section(long id, String title, String body) {
    }

    @Schema(name = "ApplicationQuestion", description = "자소서 문항")
    public record Question(long id, String prompt,
                           @Schema(description = "글자 수 제한. 모르면 `null`", nullable = true) Integer limit) {
    }

    @Schema(name = "ApplicationStage", description = "채용 전형")
    public record Stage(long id, String name) {
    }
}
