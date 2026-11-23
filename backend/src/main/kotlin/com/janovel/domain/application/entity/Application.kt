package com.janovel.domain.application.entity

import com.janovel.domain.application.model.ApplicationStatus
import com.janovel.domain.application.model.DeadlineKind
import com.janovel.domain.user.entity.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.LocalDate
import java.time.LocalTime

@Entity
@Table(name = "applications")
class Application(
	@field:ManyToOne(fetch = FetchType.LAZY, optional = false)
	@field:JoinColumn(name = "user_id", nullable = false)
	var user: User,

	@field:Column(nullable = false, columnDefinition = "text")
	var company: String,

	@field:Column(nullable = false, columnDefinition = "text")
	var role: String,

	@field:Enumerated(EnumType.STRING)
	@field:JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@field:Column(name = "deadline_kind", columnDefinition = "deadline_kind")
	var deadlineKind: DeadlineKind? = null,

	@field:Column(name = "deadline_date")
	var deadlineDate: LocalDate? = null,

	@field:Column(name = "deadline_time")
	var deadlineTime: LocalTime? = null,

	@field:Column(name = "deadline_timezone", nullable = false)
	var deadlineTimezone: String = "Asia/Seoul",

	@field:Column(name = "source_url", columnDefinition = "text")
	var sourceUrl: String? = null,

	@field:Column(name = "source_text", columnDefinition = "text")
	var sourceText: String? = null,

	@field:Column(name = "source_image_key", columnDefinition = "text")
	var sourceImageKey: String? = null,

	@field:Enumerated(EnumType.STRING)
	@field:JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@field:Column(nullable = false, columnDefinition = "application_status")
	var status: ApplicationStatus = ApplicationStatus.INTERESTED,

	@field:Column(name = "current_stage_id")
	var currentStageId: Long? = null,

	@field:Column(name = "outcome_option_id")
	var outcomeOptionId: Long? = null,

	@field:Column(name = "outcome_stage_name", columnDefinition = "text")
	var outcomeStageName: String? = null,
) {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	var id: Long? = null
		protected set
}
