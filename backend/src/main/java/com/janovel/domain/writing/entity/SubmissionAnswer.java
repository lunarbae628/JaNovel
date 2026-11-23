package com.janovel.domain.writing.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import org.hibernate.annotations.SourceType;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "submission_answers")
public class SubmissionAnswer {

    @Id
    @Column(name = "question_id")
    private Long questionId;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private EssayQuestion question;

    @UpdateTimestamp(source = SourceType.DB)
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected SubmissionAnswer() {
    }

    public SubmissionAnswer(EssayQuestion question, String body) {
        this.question = Objects.requireNonNull(question, "question");
        this.body = Objects.requireNonNull(body, "body");
    }

    public Long getQuestionId() {
        return questionId;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = Objects.requireNonNull(body, "body");
    }

    public EssayQuestion getQuestion() {
        return question;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
