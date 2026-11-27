package com.janovel.domain.writing.entity;

import com.janovel.domain.application.entity.Application;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.Objects;

@Entity
@Table(name = "essay_questions")
public class EssayQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    @Column(nullable = false, columnDefinition = "text")
    private String prompt;

    @Column(name = "char_limit")
    private Integer charLimit;

    @Column(nullable = false)
    private int position;

    /** 마지막으로 연 버전. 작성 화면을 다시 열 때 이 버전으로 시작한다. */
    @Column(name = "active_version_id")
    private Long activeVersionId;

    protected EssayQuestion() {
    }

    public EssayQuestion(Application application, String prompt, Integer charLimit, int position) {
        this.application = Objects.requireNonNull(application, "application");
        this.prompt = Objects.requireNonNull(prompt, "prompt");
        this.charLimit = charLimit;
        this.position = position;
    }

    public Long getId() {
        return id;
    }

    public Application getApplication() {
        return application;
    }

    public void setApplication(Application application) {
        this.application = Objects.requireNonNull(application, "application");
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = Objects.requireNonNull(prompt, "prompt");
    }

    public Integer getCharLimit() {
        return charLimit;
    }

    public void setCharLimit(Integer charLimit) {
        this.charLimit = charLimit;
    }

    public int getPosition() {
        return position;
    }

    public void setPosition(int position) {
        this.position = position;
    }

    public Long getActiveVersionId() {
        return activeVersionId;
    }

    public void setActiveVersionId(Long activeVersionId) {
        this.activeVersionId = activeVersionId;
    }
}
