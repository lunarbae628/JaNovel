package com.janovel.domain.writing.entity

import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.Table

@Entity
@Table(name = "snapshot_parents")
class SnapshotParent(id: SnapshotParentId, questionId: Long) {
	@EmbeddedId
	var id: SnapshotParentId = id
		protected set

	@Column(name = "question_id", nullable = false, updatable = false)
	var questionId: Long = questionId
		protected set
}
