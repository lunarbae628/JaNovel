package com.janovel.domain.writing.entity

import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import java.io.Serializable

@Embeddable
data class SnapshotParentId(
	@field:Column(name = "child_snapshot_id")
	val childSnapshotId: Long,

	@field:Column(name = "parent_snapshot_id")
	val parentSnapshotId: Long,
) : Serializable
