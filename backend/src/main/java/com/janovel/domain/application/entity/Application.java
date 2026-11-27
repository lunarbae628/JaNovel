package com.janovel.domain.application.entity;

import com.janovel.domain.application.model.ApplicationStatus;
import com.janovel.domain.application.model.DeadlineKind;
import com.janovel.domain.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "applications")
public class Application {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, columnDefinition = "text")
    private String company;

    @Column(nullable = false, columnDefinition = "text")
    private String role;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "deadline_kind", columnDefinition = "deadline_kind")
    private DeadlineKind deadlineKind;

    @Column(name = "deadline_date")
    private LocalDate deadlineDate;

    @Column(name = "deadline_time")
    private LocalTime deadlineTime;

    @Column(name = "deadline_timezone", nullable = false)
    private String deadlineTimezone = "Asia/Seoul";

    @Column(name = "source_url", columnDefinition = "text")
    private String sourceUrl;

    @Column(name = "source_text", columnDefinition = "text")
    private String sourceText;

    @Column(name = "source_image_key", columnDefinition = "text")
    private String sourceImageKey;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "application_status")
    private ApplicationStatus status = ApplicationStatus.INTERESTED;

    @Column(name = "current_stage_id")
    private Long currentStageId;

    @Column(name = "outcome_option_id")
    private Long outcomeOptionId;

    @Column(name = "outcome_stage_name", columnDefinition = "text")
    private String outcomeStageName;

    /** 마지막으로 연 문항. 지원 건을 다시 열면 이 문항으로 간다. 문항을 지우면 비워진다. */
    @Column(name = "last_question_id")
    private Long lastQuestionId;

    protected Application() {
    }

    public Application(User user, String company, String role) {
        this.user = Objects.requireNonNull(user, "user");
        this.company = Objects.requireNonNull(company, "company");
        this.role = Objects.requireNonNull(role, "role");
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = Objects.requireNonNull(user, "user");
    }

    public String getCompany() {
        return company;
    }

    public void setCompany(String company) {
        this.company = Objects.requireNonNull(company, "company");
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = Objects.requireNonNull(role, "role");
    }

    public DeadlineKind getDeadlineKind() {
        return deadlineKind;
    }

    public void setDeadlineKind(DeadlineKind deadlineKind) {
        this.deadlineKind = deadlineKind;
    }

    public LocalDate getDeadlineDate() {
        return deadlineDate;
    }

    public void setDeadlineDate(LocalDate deadlineDate) {
        this.deadlineDate = deadlineDate;
    }

    public LocalTime getDeadlineTime() {
        return deadlineTime;
    }

    public void setDeadlineTime(LocalTime deadlineTime) {
        this.deadlineTime = deadlineTime;
    }

    public String getDeadlineTimezone() {
        return deadlineTimezone;
    }

    public void setDeadlineTimezone(String deadlineTimezone) {
        this.deadlineTimezone = Objects.requireNonNull(deadlineTimezone, "deadlineTimezone");
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
    }

    public String getSourceText() {
        return sourceText;
    }

    public void setSourceText(String sourceText) {
        this.sourceText = sourceText;
    }

    public String getSourceImageKey() {
        return sourceImageKey;
    }

    public void setSourceImageKey(String sourceImageKey) {
        this.sourceImageKey = sourceImageKey;
    }

    public ApplicationStatus getStatus() {
        return status;
    }

    public void setStatus(ApplicationStatus status) {
        this.status = Objects.requireNonNull(status, "status");
    }

    public Long getCurrentStageId() {
        return currentStageId;
    }

    public void setCurrentStageId(Long currentStageId) {
        this.currentStageId = currentStageId;
    }

    public Long getOutcomeOptionId() {
        return outcomeOptionId;
    }

    public void setOutcomeOptionId(Long outcomeOptionId) {
        this.outcomeOptionId = outcomeOptionId;
    }

    public String getOutcomeStageName() {
        return outcomeStageName;
    }

    public void setOutcomeStageName(String outcomeStageName) {
        this.outcomeStageName = outcomeStageName;
    }

    public Long getLastQuestionId() {
        return lastQuestionId;
    }

    public void setLastQuestionId(Long lastQuestionId) {
        this.lastQuestionId = lastQuestionId;
    }
}
