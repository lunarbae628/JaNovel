package com.janovel.domain.writing.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.util.Objects;
import org.springframework.data.domain.Persistable;

/** 같은 문항 안의 부모·자식 스냅샷 연결. 키를 직접 정하므로 새 연결은 merge 대신 바로 persist한다. */
@Entity
@Table(name = "snapshot_parents")
public class SnapshotParent implements Persistable<SnapshotParentId> {

    @EmbeddedId
    private SnapshotParentId id;

    @Column(name = "question_id", nullable = false, updatable = false)
    private long questionId;

    @Transient
    private boolean isNew = true;

    protected SnapshotParent() {
    }

    public SnapshotParent(SnapshotParentId id, long questionId) {
        this.id = Objects.requireNonNull(id, "id");
        this.questionId = questionId;
    }

    @Override
    public SnapshotParentId getId() {
        return id;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    @PostLoad
    @PostPersist
    void markStored() {
        isNew = false;
    }

    public long getQuestionId() {
        return questionId;
    }
}
