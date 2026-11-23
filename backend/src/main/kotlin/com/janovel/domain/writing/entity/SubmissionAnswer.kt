package com.janovel.domain.writing.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.MapsId
import jakarta.persistence.OneToOne
import jakarta.persistence.Table
import org.hibernate.annotations.SourceType
import org.hibernate.annotations.UpdateTimestamp
import java.time.Instant

@Entity
@Table(name = "submission_answers")
class SubmissionAnswer(
	question: EssayQuestion,

	@field:Column(nullable = false, columnDefinition = "text")
	var body: String,
) {
	@Id
	@Column(name = "question_id")
	var questionId: Long? = null
		protected set

	@MapsId
	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "question_id", nullable = false)
	var question: EssayQuestion = question
		protected set

	@UpdateTimestamp(source = SourceType.DB)
	@Column(name = "updated_at", nullable = false)
	var updatedAt: Instant? = null
		protected set
}
