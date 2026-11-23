package com.janovel.domain.writing.entity;

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
@Table(name = "writing_versions")
public class WritingVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private EssayQuestion question;

    @Column(nullable = false)
    private String name;

    @Column(name = "draft_body", nullable = false, columnDefinition = "text")
    private String draftBody = "";

    protected WritingVersion() {
    }

    public WritingVersion(EssayQuestion question, String name) {
        this.question = Objects.requireNonNull(question, "question");
        this.name = Objects.requireNonNull(name, "name");
    }

    public Long getId() {
        return id;
    }

    public EssayQuestion getQuestion() {
        return question;
    }

    public void setQuestion(EssayQuestion question) {
        this.question = Objects.requireNonNull(question, "question");
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = Objects.requireNonNull(name, "name");
    }

    public String getDraftBody() {
        return draftBody;
    }

    public void setDraftBody(String draftBody) {
        this.draftBody = Objects.requireNonNull(draftBody, "draftBody");
    }
}
