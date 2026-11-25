package com.janovel.domain.application.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.janovel.TestcontainersConfiguration;
import com.janovel.domain.application.app.ApplicationService;
import com.janovel.domain.application.dto.ApplicationRegistration;
import com.janovel.domain.application.dto.ApplicationRegistration.Section;
import com.janovel.domain.application.dto.Deadline;
import com.janovel.domain.application.exception.ApplicationErrorCode;
import com.janovel.domain.application.model.ApplicationStatus;
import com.janovel.domain.application.model.DeadlineKind;
import com.janovel.domain.user.entity.User;
import com.janovel.global.exception.CustomException;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.LocalTime;
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
class ApplicationDetailServiceTests {

    @Autowired
    private ApplicationService applicationService;

    @Autowired
    private EntityManager entityManager;

    private long newUser(String email) {
        var user = new User(email, "지원자");
        entityManager.persist(user);
        return user.getId();
    }

    @Test
    @DisplayName("등록한 마감과 항목, 전형을 보낸 순서대로 다시 조회한다")
    void registersAndFindsDetailInOrder() {
        long userId = newUser("detail@example.com");
        var registration = new ApplicationRegistration("예시 회사", "백엔드", 
                new Deadline(DeadlineKind.FIXED, LocalDate.of(2026, 12, 16), LocalTime.of(23, 59)),
                "https://careers.example.com/jobs/1", "공고 원문",
                List.of(new Section("업무", "API 개발"), new Section("우대 사항", "Docker 경험")),
                List.of("서류전형", "1차 면접", "합격"));

        var saved = applicationService.register(userId, registration);
        entityManager.flush();
        entityManager.clear();
        var found = applicationService.find(userId, saved.id());

        assertEquals(ApplicationStatus.INTERESTED, found.status());
        assertEquals(registration.deadline(), found.deadline());
        assertEquals("https://careers.example.com/jobs/1", found.sourceUrl());
        assertEquals(List.of("업무", "우대 사항"), found.sections().stream().map(section -> section.title()).toList());
        assertEquals(List.of("서류전형", "1차 면접", "합격"), found.stages().stream().map(stage -> stage.name()).toList());
    }

    @Test
    @DisplayName("마감과 원문 없이 등록하면 해당 값은 비어 있다")
    void registersWithoutOptionalValues() {
        long userId = newUser("minimal@example.com");

        var saved = applicationService.register(userId, new ApplicationRegistration("회사", "직무", null, null, null,
                null, null));

        assertNull(saved.deadline());
        assertNull(saved.sourceUrl());
        assertEquals(List.of(), saved.sections());
        assertEquals(List.of(), saved.stages());
    }

    @Test
    @DisplayName("다른 사용자의 지원 건은 없는 지원 건과 같은 오류로 응답한다")
    void hidesOtherUsersApplication() {
        long ownerId = newUser("owner@example.com");
        long otherId = newUser("other@example.com");
        var saved = applicationService.register(ownerId, new ApplicationRegistration("회사", "직무", null, null, null,
                null, null));

        var otherUser = assertThrows(CustomException.class, () -> applicationService.find(otherId, saved.id()));
        var missing = assertThrows(CustomException.class, () -> applicationService.find(ownerId, saved.id() + 9999));

        assertEquals(ApplicationErrorCode.APPLICATION_NOT_FOUND, otherUser.getErrorCode());
        assertEquals(ApplicationErrorCode.APPLICATION_NOT_FOUND, missing.getErrorCode());
    }
}
