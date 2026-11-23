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

    @Column(name = "char_limit", nullable = false)
    private int charLimit;

    @Column(nullable = false)
    private int position;

    protected EssayQuestion() {
    }

    public EssayQuestion(Application application, String prompt, int charLimit, int position) {
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

    public int getCharLimit() {
        return charLimit;
    }

    public void setCharLimit(int charLimit) {
        this.charLimit = charLimit;
    }

    public int getPosition() {
        return position;
    }

    public void setPosition(int position) {
        this.position = position;
    }
}
