package com.janovel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.sql.SQLException;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@Transactional
class InitialSchemaTests {

    private final JdbcTemplate jdbc;

    @Autowired
    InitialSchemaTests(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @BeforeEach
    void createApplication() {
        jdbc.update("INSERT INTO users (id, email, name) VALUES (1, 'owner@example.com', '지원자')");
        jdbc.update("INSERT INTO applications (id, user_id, company, role) VALUES (10, 1, '회사', '백엔드')");
    }

    @Test
    @DisplayName("이름이 없는 사용자 행을 저장할 수 없다")
    void rejectsUserWithoutName() {
        var failure = assertThrows(DataIntegrityViolationException.class, () ->
                jdbc.update("INSERT INTO users (id, email, name) VALUES (2, 'unnamed@example.com', NULL)"));
        assertEquals("23502", ((SQLException) failure.getMostSpecificCause()).getSQLState());
    }

    @Test
    @DisplayName("같은 지원 건의 전형 순서를 한 트랜잭션에서 교환한다")
    void swapsStagePositions() {
        jdbc.update("""
                INSERT INTO application_stages (id, application_id, name, position)
                VALUES (21, 10, '서류', 1), (22, 10, '면접', 2)
                """);

        jdbc.execute("SET CONSTRAINTS application_stages_application_id_position_key DEFERRED");
        jdbc.update("UPDATE application_stages SET position = 2 WHERE id = 21");
        jdbc.update("UPDATE application_stages SET position = 1 WHERE id = 22");
        jdbc.execute("SET CONSTRAINTS application_stages_application_id_position_key IMMEDIATE");

        List<Long> orderedStageIds = jdbc.queryForList(
                "SELECT id FROM application_stages WHERE application_id = 10 ORDER BY position",
                Long.class
        );
        assertEquals(List.of(22L, 21L), orderedStageIds);
    }

    @Test
    @DisplayName("현재 전형을 삭제하면 지원 건과 진행 상태를 유지하고 현재 전형만 비운다")
    void clearsCurrentStageOnDeletion() {
        jdbc.update("INSERT INTO application_stages (id, application_id, name, position) VALUES (21, 10, '서류', 1)");
        jdbc.update("UPDATE applications SET current_stage_id = 21, status = 'in_progress' WHERE id = 10");

        jdbc.update("DELETE FROM application_stages WHERE id = 21");

        var application = jdbc.queryForMap("SELECT current_stage_id, status::text FROM applications WHERE id = 10");
        assertNull(application.get("current_stage_id"));
        assertEquals("in_progress", application.get("status"));
    }

    @Test
    @DisplayName("종료 결과 옵션을 보관 처리해도 지원 건에서 결과를 읽을 수 있다")
    void archivesOutcomeOption() {
        jdbc.update("""
                INSERT INTO application_outcome_options (id, user_id, name, position)
                VALUES (31, 1, '최종 합격', 1)
                """);
        jdbc.update("UPDATE applications SET status = 'closed', outcome_option_id = 31 WHERE id = 10");

        jdbc.update("UPDATE application_outcome_options SET archived_at = now() WHERE id = 31");

        String outcome = jdbc.queryForObject("""
                SELECT o.name FROM applications a
                JOIN application_outcome_options o ON (a.user_id, a.outcome_option_id) = (o.user_id, o.id)
                WHERE a.id = 10 AND o.archived_at IS NOT NULL
                """, String.class);
        assertEquals("최종 합격", outcome);
        assertThrows(DataIntegrityViolationException.class, () ->
                jdbc.update("DELETE FROM application_outcome_options WHERE id = 31"));
    }

    @Test
    @DisplayName("문항의 글자 수 제한은 비워 둘 수 있고 값이 있으면 1~100000이어야 한다")
    void allowsUnknownCharLimitAndRejectsOutOfRange() {
        jdbc.update("""
                INSERT INTO essay_questions (id, application_id, prompt, char_limit, position)
                VALUES (43, 10, '제한 미확인', NULL, 1), (44, 10, '제한 있음', 500, 2)
                """);

        assertNull(jdbc.queryForObject("SELECT char_limit FROM essay_questions WHERE id = 43", Integer.class));
        var zero = assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("""
                INSERT INTO essay_questions (id, application_id, prompt, char_limit, position)
                VALUES (45, 10, '0자 제한', 0, 3)
                """));
        assertEquals("23514", ((SQLException) zero.getMostSpecificCause()).getSQLState());
    }

    @Test
    @DisplayName("다른 문항의 스냅샷을 부모로 연결할 수 없다")
    void rejectsSnapshotParentFromAnotherQuestion() {
        jdbc.update("""
                INSERT INTO essay_questions (id, application_id, prompt, char_limit, position)
                VALUES (41, 10, '지원 동기', 500, 1), (42, 10, '프로젝트 경험', 500, 2)
                """);
        jdbc.update("INSERT INTO writing_versions (id, question_id, name, position) VALUES (51, 41, '초안', 1), (52, 42, '초안', 1)");
        jdbc.update("""
                INSERT INTO snapshots (id, question_id, version_id, number, body)
                VALUES (61, 41, 51, 1, '동기 답변'), (62, 42, 52, 1, '경험 답변'), (63, 41, 51, 2, '동기 답변 초안')
                """);

        String insertParent = """
                INSERT INTO snapshot_parents (question_id, child_snapshot_id, parent_snapshot_id)
                VALUES (41, 61, ?)
                """;
        assertEquals(1, jdbc.update(insertParent, 63L));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(insertParent, 62L));
    }

    /** 거절되는 문장을 세이브포인트 안에서 실행해, 실패 뒤에도 같은 트랜잭션에서 다음 문장을 실행한다. */
    private void rejects(String sql) {
        jdbc.execute("SAVEPOINT rejected");
        try {
            assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(sql));
        } finally {
            jdbc.execute("ROLLBACK TO SAVEPOINT rejected");
        }
    }

    private void createTwoQuestionsWithHistory() {
        jdbc.update("""
                INSERT INTO essay_questions (id, application_id, prompt, char_limit, position)
                VALUES (41, 10, '지원 동기', 500, 1), (42, 10, '프로젝트 경험', 500, 2)
                """);
        jdbc.update("INSERT INTO writing_versions (id, question_id, name, position) VALUES (51, 41, '기본', 1), (52, 42, '기본', 1)");
        jdbc.update("""
                INSERT INTO snapshots (id, question_id, version_id, number, body)
                VALUES (61, 41, 51, 1, '동기 답변'), (62, 42, 52, 1, '경험 답변')
                """);
    }

    @Test
    @DisplayName("버전의 시작·기준 스냅샷, 현재 버전, 제출본 출처는 같은 문항의 기록만 가리킨다")
    void keepsWritingReferencesInsideQuestion() {
        createTwoQuestionsWithHistory();

        assertEquals(1, jdbc.update("UPDATE writing_versions SET from_snapshot_id = 61, base_snapshot_id = 61 WHERE id = 51"));
        rejects("UPDATE writing_versions SET from_snapshot_id = 62 WHERE id = 51");
        rejects("UPDATE writing_versions SET base_snapshot_id = 62 WHERE id = 51");
        assertEquals(1, jdbc.update("UPDATE essay_questions SET active_version_id = 51 WHERE id = 41"));
        rejects("UPDATE essay_questions SET active_version_id = 52 WHERE id = 41");
        rejects("""
                INSERT INTO submission_answers (question_id, body, source_version_id, source_snapshot_id)
                VALUES (41, '제출본', 52, 62)
                """);
    }

    @Test
    @DisplayName("스냅샷을 지우면 그 스냅샷을 가리키던 참조만 비우고 버전을 지우면 현재 버전 지정만 비운다")
    void clearsWritingReferencesOnDeletion() {
        createTwoQuestionsWithHistory();
        jdbc.update("INSERT INTO writing_versions (id, question_id, name, position, from_snapshot_id, base_snapshot_id) VALUES (53, 41, '짧은 안', 2, 61, 61)");
        jdbc.update("UPDATE writing_versions SET base_snapshot_id = 61 WHERE id = 51");
        jdbc.update("UPDATE essay_questions SET active_version_id = 53 WHERE id = 41");
        jdbc.update("""
                INSERT INTO submission_answers (question_id, body, source_version_id, source_snapshot_id, label)
                VALUES (41, '동기 답변', 51, 61, 'v1 · 기본')
                """);

        jdbc.update("DELETE FROM snapshots WHERE id = 61");

        assertEquals(2, jdbc.queryForObject("""
                SELECT count(*) FROM writing_versions WHERE question_id = 41 AND from_snapshot_id IS NULL AND base_snapshot_id IS NULL
                """, Integer.class));
        assertEquals(51L, jdbc.queryForObject("SELECT source_version_id FROM submission_answers WHERE question_id = 41", Long.class));
        assertNull(jdbc.queryForObject("SELECT source_snapshot_id FROM submission_answers WHERE question_id = 41", Long.class));
        assertEquals("동기 답변", jdbc.queryForObject("SELECT body FROM submission_answers WHERE question_id = 41", String.class));

        jdbc.update("DELETE FROM writing_versions WHERE id = 53");
        assertNull(jdbc.queryForObject("SELECT active_version_id FROM essay_questions WHERE id = 41", Long.class));
        jdbc.update("DELETE FROM writing_versions WHERE id = 51");
        assertNull(jdbc.queryForObject("SELECT source_version_id FROM submission_answers WHERE question_id = 41", Long.class));
    }

    @Test
    @DisplayName("같은 문항 안에서 스냅샷 번호와 버전 순번은 겹칠 수 없지만 다른 문항과는 같아도 된다")
    void keepsNumbersUniqueInsideQuestion() {
        createTwoQuestionsWithHistory();

        rejects("INSERT INTO snapshots (question_id, version_id, number, body) VALUES (41, 51, 1, '겹침')");
        rejects("INSERT INTO writing_versions (question_id, name, position) VALUES (41, '겹침', 1)");
        assertEquals(0L, jdbc.queryForObject("SELECT draft_revision FROM writing_versions WHERE id = 51", Long.class));
    }

    @Test
    @DisplayName("지원 건의 마지막 문항은 그 지원 건의 문항만 가리키고 문항을 지우면 비워진다")
    void keepsLastQuestionInsideApplication() {
        jdbc.update("INSERT INTO applications (id, user_id, company, role) VALUES (11, 1, '다른 회사', '백엔드')");
        jdbc.update("""
                INSERT INTO essay_questions (id, application_id, prompt, position)
                VALUES (41, 10, '지원 동기', 1), (42, 11, '협업 경험', 1)
                """);

        assertEquals(1, jdbc.update("UPDATE applications SET last_question_id = 41 WHERE id = 10"));
        rejects("UPDATE applications SET last_question_id = 42 WHERE id = 10");
        jdbc.update("DELETE FROM essay_questions WHERE id = 41");
        assertNull(jdbc.queryForObject("SELECT last_question_id FROM applications WHERE id = 10", Long.class));
    }
}
