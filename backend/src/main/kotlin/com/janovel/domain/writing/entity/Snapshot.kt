package com.janovel.domain.writing.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.Generated
import java.time.Instant

@Entity
@Table(name = "snapshots")
class Snapshot(
	questionId: Long,
	versionId: Long,
	body: String,

	@field:Column(columnDefinition = "text")
	var title: String? = null,

	@field:Column(columnDefinition = "text")
	var description: String? = null,
) {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	var id: Long? = null
		protected set

	@Column(name = "question_id", nullable = false, updatable = false)
	var questionId: Long = questionId
		protected set

	@Column(name = "version_id", nullable = false, updatable = false)
	var versionId: Long = versionId
		protected set

	@Column(nullable = false, updatable = false, columnDefinition = "text")
	var body: String = body
		protected set

	@Generated
	@Column(name = "created_at", nullable = false, updatable = false)
	var createdAt: Instant? = null
		protected set
}
