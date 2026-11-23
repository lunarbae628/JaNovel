package com.janovel.domain.application.model

import jakarta.persistence.EnumeratedValue

enum class ApplicationStatus(@field:EnumeratedValue private val databaseValue: String) {
	INTERESTED("interested"),
	WRITING("writing"),
	SUBMITTED("submitted"),
	IN_PROGRESS("in_progress"),
	CLOSED("closed"),
}
