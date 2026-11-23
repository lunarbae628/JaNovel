package com.janovel.domain.writing.entity

import com.janovel.domain.application.entity.Application
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
@Table(name = "essay_questions")
class EssayQuestion(
	@field:ManyToOne(fetch = FetchType.LAZY, optional = false)
	@field:JoinColumn(name = "application_id", nullable = false)
	var application: Application,

	@field:Column(nullable = false, columnDefinition = "text")
	var prompt: String,

	@field:Column(name = "char_limit", nullable = false)
	var charLimit: Int,

	@field:Column(nullable = false)
	var position: Int,
) {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	var id: Long? = null
		protected set
}
