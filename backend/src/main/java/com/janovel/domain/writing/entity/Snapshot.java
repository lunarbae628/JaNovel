package com.janovel.domain.writing.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import org.hibernate.annotations.Generated;

@Entity
@Table(name = "snapshots")
public class Snapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "text")
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "question_id", nullable = false, updatable = false)
    private long questionId;

    @Column(name = "version_id", nullable = false, updatable = false)
    private long versionId;

    @Column(nullable = false, updatable = false, columnDefinition = "text")
    private String body;

    @Generated
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Snapshot() {
    }

    public Snapshot(long questionId, long versionId, String body) {
        this.questionId = questionId;
        this.versionId = versionId;
        this.body = Objects.requireNonNull(body, "body");
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public long getQuestionId() {
        return questionId;
    }

    public long getVersionId() {
        return versionId;
    }

    public String getBody() {
        return body;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
