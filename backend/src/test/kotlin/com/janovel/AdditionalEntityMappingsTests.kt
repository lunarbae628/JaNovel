package com.janovel

import com.janovel.domain.application.entity.Application
import com.janovel.domain.user.entity.User
import com.janovel.domain.writing.entity.EssayQuestion
import com.janovel.domain.writing.entity.Snapshot
import com.janovel.domain.writing.entity.SnapshotParent
import com.janovel.domain.writing.entity.SnapshotParentId
import com.janovel.domain.writing.entity.SubmissionAnswer
import com.janovel.domain.writing.entity.WritingVersion
import jakarta.persistence.EntityManager
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

@Import(TestcontainersConfiguration::class)
@SpringBootTest
@Transactional
class AdditionalEntityMappingsTests @Autowired constructor(
	private val entityManager: EntityManager,
	private val jdbc: JdbcTemplate,
) {
	@Test
	@DisplayName("스냅샷 부모 관계는 복합 키로 조회하고 제출본은 문항 키를 공유한다")
	fun storesWritingRelationships() {
		val question = EssayQuestion(createApplication(), prompt = "지원 동기", charLimit = 500, position = 1)
		entityManager.persist(question)
		val version = WritingVersion(question, name = "기본")
		entityManager.persist(version)
		val questionId = requireNotNull(question.id)
		val versionId = requireNotNull(version.id)
		val parent = Snapshot(questionId, versionId, body = "첫 답변")
		val child = Snapshot(questionId, versionId, body = "수정한 답변", title = "수정본")
		entityManager.persist(parent)
		entityManager.persist(child)
		val linkId = SnapshotParentId(requireNotNull(child.id), requireNotNull(parent.id))
		entityManager.persist(SnapshotParent(linkId, questionId))
		val submission = SubmissionAnswer(question, body = "제출할 답변")
		entityManager.persist(submission)
		entityManager.flush()
		assertEquals(questionId, submission.questionId)
		entityManager.clear()

		val storedLink = entityManager.find(SnapshotParent::class.java, linkId)
		val storedAnswer = entityManager.find(SubmissionAnswer::class.java, questionId)
		assertNotNull(storedLink)
		assertEquals(questionId, storedLink.questionId)
		assertEquals(linkId, storedLink.id)
		assertNotNull(storedAnswer)
		assertEquals(questionId, storedAnswer.question.id)
		assertEquals("제출할 답변", storedAnswer.body)
	}

	@Test
	@DisplayName("제출본을 수정하면 데이터베이스가 수정 시각을 갱신한다")
	fun updatesSubmissionTimestamp() {
		val question = EssayQuestion(createApplication(), prompt = "지원 동기", charLimit = 500, position = 1)
		entityManager.persist(question)
		entityManager.persist(SubmissionAnswer(question, body = "처음 제출본"))
		entityManager.flush()
		entityManager.clear()
		val questionId = requireNotNull(question.id)
		jdbc.update("UPDATE submission_answers SET updated_at = TIMESTAMPTZ '2000-01-01 00:00:00+00' WHERE question_id = ?", questionId)

		val answer = entityManager.find(SubmissionAnswer::class.java, questionId)
		answer.body = "수정한 제출본"
		entityManager.flush()
		entityManager.clear()

		val stored = entityManager.find(SubmissionAnswer::class.java, questionId)
		val transactionTime = jdbc.queryForObject("SELECT transaction_timestamp()", OffsetDateTime::class.java)
		assertEquals("수정한 제출본", stored.body)
		assertEquals(requireNotNull(transactionTime).toInstant(), stored.updatedAt)
	}

	private fun createApplication(): Application {
		val owner = User(email = "owner@example.com", name = "지원자")
		entityManager.persist(owner)
		val application = Application(owner, company = "회사", role = "백엔드")
		entityManager.persist(application)
		return application
	}
}
