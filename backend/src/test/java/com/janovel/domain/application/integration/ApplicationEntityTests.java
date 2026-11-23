package com.janovel.domain.application.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.janovel.TestcontainersConfiguration;
import com.janovel.domain.application.entity.Application;
import com.janovel.domain.application.model.ApplicationStatus;
import com.janovel.domain.application.model.DeadlineKind;
import com.janovel.domain.user.entity.User;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.LocalTime;
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
class ApplicationEntityTests {

    private final EntityManager entityManager;
    private final JdbcTemplate jdbc;

    @Autowired
    ApplicationEntityTests(EntityManager entityManager, JdbcTemplate jdbc) {
        this.entityManager = entityManager;
        this.jdbc = jdbc;
    }

    @Test
    @DisplayName("사용자와 지원 건을 저장하고 기본값과 소유자 관계를 조회한다")
    void loadsApplicationWithDefaults() {
        var owner = new User("owner@example.com", "지원자");
        assertNull(owner.getCreatedAt());
        entityManager.persist(owner);
        var application = new Application(owner, "회사", "백엔드");
        entityManager.persist(application);
        entityManager.flush();
        var createdAt = owner.getCreatedAt();
        assertNotNull(createdAt);
        entityManager.clear();

        var stored = entityManager.find(Application.class, application.getId());
        assertEquals(owner.getId(), stored.getUser().getId());
        assertEquals("owner@example.com", stored.getUser().getEmail());
        assertEquals("지원자", stored.getUser().getName());
        assertEquals("Asia/Seoul", stored.getUser().getTimezone());
        assertEquals(createdAt, stored.getUser().getCreatedAt());
        assertEquals("회사", stored.getCompany());
        assertEquals("백엔드", stored.getRole());
        assertEquals(ApplicationStatus.INTERESTED, stored.getStatus());
        assertEquals("Asia/Seoul", stored.getDeadlineTimezone());
        assertNull(stored.getDeadlineKind());
        assertNull(stored.getCurrentStageId());
        assertNull(stored.getOutcomeOptionId());
    }

    @Test
    @DisplayName("마감 방식과 지원 상태를 PostgreSQL enum으로 저장하고 조회한다")
    void storesPostgresEnumValues() {
        var owner = new User("owner@example.com", "지원자");
        entityManager.persist(owner);
        var application = new Application(owner, "회사", "백엔드");
        application.setDeadlineKind(DeadlineKind.UNTIL_FILLED);
        application.setDeadlineDate(LocalDate.of(2026, 12, 1));
        application.setDeadlineTime(LocalTime.of(18, 0));
        application.setStatus(ApplicationStatus.IN_PROGRESS);
        entityManager.persist(application);
        entityManager.flush();
        long id = application.getId();
        entityManager.clear();

        var row = jdbc.queryForMap("SELECT deadline_kind::text, status::text FROM applications WHERE id = ?", id);
        assertEquals("until_filled", row.get("deadline_kind"));
        assertEquals("in_progress", row.get("status"));

        var stored = entityManager.createQuery(
                "SELECT a FROM Application a WHERE a.id = :id AND a.status = :status",
                Application.class
        ).setParameter("id", id)
                .setParameter("status", ApplicationStatus.IN_PROGRESS)
                .getSingleResult();
        assertEquals(DeadlineKind.UNTIL_FILLED, stored.getDeadlineKind());
        assertEquals(LocalDate.of(2026, 12, 1), stored.getDeadlineDate());
        assertEquals(LocalTime.of(18, 0), stored.getDeadlineTime());
    }
}
