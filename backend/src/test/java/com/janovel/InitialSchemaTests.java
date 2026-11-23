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
    @DisplayName("다른 문항의 스냅샷을 부모로 연결할 수 없다")
    void rejectsSnapshotParentFromAnotherQuestion() {
        jdbc.update("""
                INSERT INTO essay_questions (id, application_id, prompt, char_limit, position)
                VALUES (41, 10, '지원 동기', 500, 1), (42, 10, '프로젝트 경험', 500, 2)
                """);
        jdbc.update("INSERT INTO writing_versions (id, question_id, name) VALUES (51, 41, '초안'), (52, 42, '초안')");
        jdbc.update("""
                INSERT INTO snapshots (id, question_id, version_id, body)
                VALUES (61, 41, 51, '동기 답변'), (62, 42, 52, '경험 답변'), (63, 41, 51, '동기 답변 초안')
                """);

        String insertParent = """
                INSERT INTO snapshot_parents (question_id, child_snapshot_id, parent_snapshot_id)
                VALUES (41, 61, ?)
                """;
        assertEquals(1, jdbc.update(insertParent, 63L));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(insertParent, 62L));
    }
}
