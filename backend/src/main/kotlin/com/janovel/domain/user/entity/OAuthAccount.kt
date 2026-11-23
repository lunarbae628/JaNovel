package com.janovel.domain.user.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import org.hibernate.annotations.Generated
import java.time.Instant

@Entity
@Table(name = "oauth_accounts")
class OAuthAccount(
	@field:ManyToOne(fetch = FetchType.LAZY, optional = false)
	@field:JoinColumn(name = "user_id", nullable = false)
	var user: User,

	@field:Column(nullable = false)
	var provider: String,

	@field:Column(name = "provider_user_id", nullable = false)
	var providerUserId: String,
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
