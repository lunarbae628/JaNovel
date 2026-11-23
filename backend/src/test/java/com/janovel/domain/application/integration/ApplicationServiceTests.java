package com.janovel.domain.application.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.janovel.TestcontainersConfiguration;
import com.janovel.domain.application.app.ApplicationService;
import com.janovel.domain.application.dto.ApplicationSummary;
import com.janovel.domain.application.model.ApplicationStatus;
import com.janovel.domain.user.entity.User;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@Transactional
class ApplicationServiceTests {

    private final ApplicationService applicationService;
    private final EntityManager entityManager;

    @Autowired
    ApplicationServiceTests(ApplicationService applicationService, EntityManager entityManager) {
        this.applicationService = applicationService;
        this.entityManager = entityManager;
    }

    @Test
    @DisplayName("각 사용자는 자신이 등록한 지원 건만 ID 내림차순으로 조회한다")
    void createsAndListsApplicationsByOwner() {
        var firstUser = new User("first@example.com", "첫 번째 지원자");
        var secondUser = new User("second@example.com", "두 번째 지원자");
        entityManager.persist(firstUser);
        entityManager.persist(secondUser);
        long firstUserId = firstUser.getId();
        long secondUserId = secondUser.getId();

        var older = applicationService.create(firstUserId, "  첫 회사  ", "  백엔드  ");
        var other = applicationService.create(secondUserId, "다른 회사", "디자이너");
        var newer = applicationService.create(firstUserId, "새 회사", "플랫폼 개발");
        entityManager.flush();
        entityManager.clear();

        var firstApplications = applicationService.findAllByUser(firstUserId);
        assertEquals(List.of(newer.id(), older.id()), firstApplications.stream().map(ApplicationSummary::id).toList());
        assertEquals("첫 회사", firstApplications.getLast().company());
        assertEquals("백엔드", firstApplications.getLast().role());
        assertEquals(ApplicationStatus.INTERESTED, firstApplications.getLast().status());
        var secondApplications = applicationService.findAllByUser(secondUserId);
        assertEquals(List.of(other.id()), secondApplications.stream().map(ApplicationSummary::id).toList());
    }
}
