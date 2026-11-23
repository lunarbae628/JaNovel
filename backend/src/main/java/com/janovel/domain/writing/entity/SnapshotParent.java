package com.janovel.domain.writing.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.Objects;

@Entity
@Table(name = "snapshot_parents")
public class SnapshotParent {

    @EmbeddedId
    private SnapshotParentId id;

    @Column(name = "question_id", nullable = false, updatable = false)
    private long questionId;

    protected SnapshotParent() {
    }

    public SnapshotParent(SnapshotParentId id, long questionId) {
        this.id = Objects.requireNonNull(id, "id");
        this.questionId = questionId;
    }

    public SnapshotParentId getId() {
        return id;
    }

    public long getQuestionId() {
        return questionId;
    }
}
