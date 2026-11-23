package com.janovel.domain.writing.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table

@Entity
@Table(name = "writing_versions")
class WritingVersion(
	@field:ManyToOne(fetch = FetchType.LAZY, optional = false)
	@field:JoinColumn(name = "question_id", nullable = false)
	var question: EssayQuestion,

	@field:Column(nullable = false)
	var name: String,

	@field:Column(name = "draft_body", nullable = false, columnDefinition = "text")
	var draftBody: String = "",
) {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	var id: Long? = null
		protected set
}
