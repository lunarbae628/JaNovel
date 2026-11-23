package com.janovel.domain.application.model

import jakarta.persistence.EnumeratedValue

enum class DeadlineKind(@field:EnumeratedValue private val databaseValue: String) {
	FIXED("fixed"),
	ROLLING("rolling"),
	UNTIL_FILLED("until_filled"),
	ALWAYS_OPEN("always_open"),
}
