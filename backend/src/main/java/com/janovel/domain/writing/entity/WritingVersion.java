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
import java.time.Instant;
import java.util.Objects;
import org.hibernate.annotations.Generated;

/** 문항 안의 버전. 스냅샷이 쌓이고 맨 끝에 계속 고쳐 쓰는 초안 하나를 가진다. */
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

    @Column(columnDefinition = "text")
    private String description;

    /** 문항 안의 순번. 버전 색과 목록 순서에 쓴다. */
    @Column(nullable = false)
    private int position;

    @Generated
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** 이 버전이 갈라져 나온 스냅샷. 빈 버전과 조합 버전은 비어 있다. */
    @Column(name = "from_snapshot_id")
    private Long fromSnapshotId;

    @Column(name = "draft_body", nullable = false, columnDefinition = "text")
    private String draftBody = "";

    /** 초안이 이어 쓰는 스냅샷. 아직 스냅샷이 없으면 비어 있다. */
    @Column(name = "base_snapshot_id")
    private Long baseSnapshotId;

    /** 초안을 저장할 때마다 1씩 오르는 번호. 오래된 화면의 저장을 거절하는 데 쓴다. */
    @Column(name = "draft_revision", nullable = false)
    private long draftRevision;

    @Column(name = "draft_updated_at", nullable = false)
    private Instant draftUpdatedAt = Instant.now();

    protected WritingVersion() {
    }

    public WritingVersion(EssayQuestion question, String name, int position) {
        this.question = Objects.requireNonNull(question, "question");
        this.name = Objects.requireNonNull(name, "name");
        this.position = position;
    }

    public Long getId() {
        return id;
    }

    public EssayQuestion getQuestion() {
        return question;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = Objects.requireNonNull(name, "name");
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public int getPosition() {
        return position;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Long getFromSnapshotId() {
        return fromSnapshotId;
    }

    public void setFromSnapshotId(Long fromSnapshotId) {
        this.fromSnapshotId = fromSnapshotId;
    }

    public String getDraftBody() {
        return draftBody;
    }

    public Long getBaseSnapshotId() {
        return baseSnapshotId;
    }

    public void setBaseSnapshotId(Long baseSnapshotId) {
        this.baseSnapshotId = baseSnapshotId;
    }

    public long getDraftRevision() {
        return draftRevision;
    }

    public Instant getDraftUpdatedAt() {
        return draftUpdatedAt;
    }

    /**
     * 삭제로 초안의 기준 스냅샷이 바뀔 때 부른다. 본문은 그대로 두고 저장 번호를 올려,
     * 이전 기준을 보던 화면의 저장과 스냅샷 요청이 `DRAFT_CONFLICT`로 거절되게 한다.
     */
    public void moveBase(Long baseSnapshotId) {
        if (Objects.equals(this.baseSnapshotId, baseSnapshotId)) {
            return;
        }
        this.baseSnapshotId = baseSnapshotId;
        this.draftRevision++;
    }

    /** 초안 본문을 바꾸고 저장 번호와 저장 시각을 갱신한다. */
    public void writeDraft(String body) {
        this.draftBody = Objects.requireNonNull(body, "body");
        this.draftRevision++;
        this.draftUpdatedAt = Instant.now();
    }
}
