package com.janovel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.janovel.domain.application.entity.Application;
import com.janovel.domain.user.entity.User;
import com.janovel.domain.writing.entity.EssayQuestion;
import com.janovel.domain.writing.entity.Snapshot;
import com.janovel.domain.writing.entity.SnapshotParent;
import com.janovel.domain.writing.entity.SnapshotParentId;
import com.janovel.domain.writing.entity.SubmissionAnswer;
import com.janovel.domain.writing.entity.WritingVersion;
import jakarta.persistence.EntityManager;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@Transactional
class AdditionalEntityMappingsTests {

    private final EntityManager entityManager;
    private final JdbcTemplate jdbc;

    @Autowired
    AdditionalEntityMappingsTests(EntityManager entityManager, JdbcTemplate jdbc) {
        this.entityManager = entityManager;
        this.jdbc = jdbc;
    }

    @Test
    @DisplayName("스냅샷 부모 관계는 복합 키로 조회하고 버전 초안·스냅샷 번호·현재 버전·제출본 출처를 저장한다")
    void storesWritingRelationships() {
        var question = new EssayQuestion(createApplication(), "지원 동기", 500, 1);
        entityManager.persist(question);
        var version = new WritingVersion(question, "기본", 1);
        entityManager.persist(version);
        long questionId = question.getId();
        long versionId = version.getId();
        var parent = new Snapshot(questionId, versionId, 1, "첫 답변");
        var child = new Snapshot(questionId, versionId, 2, "수정한 답변");
        child.setTitle("수정본");
        entityManager.persist(parent);
        entityManager.persist(child);
        var linkId = new SnapshotParentId(child.getId(), parent.getId());
        entityManager.persist(new SnapshotParent(linkId, questionId));
        version.writeDraft("이어 쓰는 답변");
        version.setBaseSnapshotId(child.getId());
        question.setActiveVersionId(versionId);
        var submission = new SubmissionAnswer(question, "제출할 답변");
        submission.replace("제출할 답변", versionId, child.getId(), "v2 · 기본");
        entityManager.persist(submission);
        entityManager.flush();
        assertEquals(questionId, submission.getQuestionId());
        entityManager.clear();

        var storedLink = entityManager.find(SnapshotParent.class, linkId);
        var storedAnswer = entityManager.find(SubmissionAnswer.class, questionId);
        assertNotNull(storedLink);
        assertEquals(questionId, storedLink.getQuestionId());
        assertEquals(linkId, storedLink.getId());
        assertNotNull(storedAnswer);
        assertEquals(questionId, storedAnswer.getQuestion().getId());
        assertEquals("제출할 답변", storedAnswer.getBody());
        assertEquals(child.getId(), storedAnswer.getSourceSnapshotId());
        assertEquals("v2 · 기본", storedAnswer.getLabel());
        var storedVersion = entityManager.find(WritingVersion.class, versionId);
        assertEquals("이어 쓰는 답변", storedVersion.getDraftBody());
        assertEquals(1, storedVersion.getDraftRevision());
        assertEquals(child.getId(), storedVersion.getBaseSnapshotId());
        assertNotNull(storedVersion.getCreatedAt());
        assertEquals(2, entityManager.find(Snapshot.class, child.getId()).getNumber());
        assertEquals(versionId, entityManager.find(EssayQuestion.class, questionId).getActiveVersionId());
    }

    @Test
    @DisplayName("제출본을 수정하면 데이터베이스가 수정 시각을 갱신한다")
    void updatesSubmissionTimestamp() {
        var question = new EssayQuestion(createApplication(), "지원 동기", 500, 1);
        entityManager.persist(question);
        entityManager.persist(new SubmissionAnswer(question, "처음 제출본"));
        entityManager.flush();
        entityManager.clear();
        long questionId = question.getId();
        jdbc.update("""
                UPDATE submission_answers SET updated_at = TIMESTAMPTZ '2000-01-01 00:00:00+00'
                WHERE question_id = ?
                """, questionId);

        var answer = entityManager.find(SubmissionAnswer.class, questionId);
        answer.setBody("수정한 제출본");
        entityManager.flush();
        entityManager.clear();

        var stored = entityManager.find(SubmissionAnswer.class, questionId);
        var transactionTime = jdbc.queryForObject("SELECT transaction_timestamp()", OffsetDateTime.class);
        assertNotNull(transactionTime);
        assertEquals("수정한 제출본", stored.getBody());
        assertEquals(transactionTime.toInstant(), stored.getUpdatedAt());
    }

    private Application createApplication() {
        var owner = new User("owner@example.com", "지원자");
        entityManager.persist(owner);
        var application = new Application(owner, "회사", "백엔드");
        entityManager.persist(application);
        return application;
    }
}
