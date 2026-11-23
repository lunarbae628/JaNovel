package com.janovel.domain.application.entity

import com.janovel.domain.user.entity.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "application_outcome_options")
class ApplicationOutcomeOption(
	@field:ManyToOne(fetch = FetchType.LAZY, optional = false)
	@field:JoinColumn(name = "user_id", nullable = false)
	var user: User,

	@field:Column(nullable = false)
	var name: String,

	@field:Column(nullable = false)
	var position: Int,

	var color: String? = null,

	@field:Column(name = "archived_at")
	var archivedAt: Instant? = null,
) {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	var id: Long? = null
		protected set
}
