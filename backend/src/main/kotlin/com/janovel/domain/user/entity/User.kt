package com.janovel.domain.user.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.Generated
import java.time.Instant

@Entity
@Table(name = "users")
class User(
	@field:Column(nullable = false)
	var email: String,

	@field:Column(nullable = false)
	var name: String,

	@field:Column(name = "password_hash")
	var passwordHash: String? = null,

	@field:Column(nullable = false)
	var timezone: String = "Asia/Seoul",
) {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	var id: Long? = null
		protected set

	@Generated
	@Column(name = "created_at", nullable = false, updatable = false)
	var createdAt: Instant? = null
		protected set
}
