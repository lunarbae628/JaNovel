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

    /** 본문을 가져온 버전. 초안에서 가져왔거나 그 버전이 지워지면 비어 있다. */
    @Column(name = "source_version_id")
    private Long sourceVersionId;

    /** 본문을 가져온 스냅샷. 초안에서 가져왔거나 그 스냅샷이 지워지면 비어 있다. */
    @Column(name = "source_snapshot_id")
    private Long sourceSnapshotId;

    /** 화면에 보일 출처 이름. 예: `v3 · 기본`, `직접 수정` */
    @Column(columnDefinition = "text")
    private String label;

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

    public Long getSourceVersionId() {
        return sourceVersionId;
    }

    public Long getSourceSnapshotId() {
        return sourceSnapshotId;
    }

    public String getLabel() {
        return label;
    }

    /** 본문과 출처를 함께 바꾼다. 직접 고친 본문은 출처 없이 이름만 남긴다. */
    public void replace(String body, Long sourceVersionId, Long sourceSnapshotId, String label) {
        this.body = Objects.requireNonNull(body, "body");
        this.sourceVersionId = sourceVersionId;
        this.sourceSnapshotId = sourceSnapshotId;
        this.label = label;
    }

    public EssayQuestion getQuestion() {
        return question;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
