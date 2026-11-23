package com.janovel.domain.writing.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;

@Embeddable
public record SnapshotParentId(
        @Column(name = "child_snapshot_id") long childSnapshotId,
        @Column(name = "parent_snapshot_id") long parentSnapshotId
) implements Serializable {
}
