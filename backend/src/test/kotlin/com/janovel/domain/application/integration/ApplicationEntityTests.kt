package com.janovel.domain.application.integration

import com.janovel.TestcontainersConfiguration
import com.janovel.domain.application.entity.Application
import com.janovel.domain.application.model.ApplicationStatus
import com.janovel.domain.application.model.DeadlineKind
import com.janovel.domain.user.entity.User
import jakarta.persistence.EntityManager
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.LocalTime

@Import(TestcontainersConfiguration::class)
@SpringBootTest
@Transactional
class ApplicationEntityTests @Autowired constructor(
	private val entityManager: EntityManager,
	private val jdbc: JdbcTemplate,
) {
	@Test
	@DisplayName("사용자와 지원 건을 저장하고 기본값과 소유자 관계를 조회한다")
	fun loadsApplicationWithDefaults() {
		val owner = User(email = "owner@example.com", name = "지원자")
		assertNull(owner.createdAt)
		entityManager.persist(owner)
		val application = Application(user = owner, company = "회사", role = "백엔드")
		entityManager.persist(application)
		entityManager.flush()
		val createdAt = owner.createdAt
		assertNotNull(createdAt)
		entityManager.clear()

		val stored = entityManager.find(Application::class.java, requireNotNull(application.id))
		assertEquals(owner.id, stored.user.id)
		assertEquals("owner@example.com", stored.user.email)
		assertEquals("지원자", stored.user.name)
		assertEquals("Asia/Seoul", stored.user.timezone)
		assertEquals(createdAt, stored.user.createdAt)
		assertEquals("회사", stored.company)
		assertEquals("백엔드", stored.role)
		assertEquals(ApplicationStatus.INTERESTED, stored.status)
		assertEquals("Asia/Seoul", stored.deadlineTimezone)
		assertNull(stored.deadlineKind)
		assertNull(stored.currentStageId)
		assertNull(stored.outcomeOptionId)
	}

	@Test
	@DisplayName("마감 방식과 지원 상태를 PostgreSQL enum으로 저장하고 조회한다")
	fun storesPostgresEnumValues() {
		val owner = User(email = "owner@example.com", name = "지원자")
		entityManager.persist(owner)
		val application = Application(
			user = owner,
			company = "회사",
			role = "백엔드",
			deadlineKind = DeadlineKind.UNTIL_FILLED,
			deadlineDate = LocalDate.of(2026, 12, 1),
			deadlineTime = LocalTime.of(18, 0),
			status = ApplicationStatus.IN_PROGRESS,
		)
		entityManager.persist(application)
		entityManager.flush()
		val id = requireNotNull(application.id)
		entityManager.clear()

		val row = jdbc.queryForMap("SELECT deadline_kind::text, status::text FROM applications WHERE id = ?", id)
		assertEquals("until_filled", row["deadline_kind"])
		assertEquals("in_progress", row["status"])

		val stored = entityManager.createQuery(
			"SELECT a FROM Application a WHERE a.id = :id AND a.status = :status",
			Application::class.java,
		).setParameter("id", id)
			.setParameter("status", ApplicationStatus.IN_PROGRESS)
			.singleResult
		assertEquals(DeadlineKind.UNTIL_FILLED, stored.deadlineKind)
		assertEquals(LocalDate.of(2026, 12, 1), stored.deadlineDate)
		assertEquals(LocalTime.of(18, 0), stored.deadlineTime)
	}
}
