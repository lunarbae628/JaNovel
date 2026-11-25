package com.janovel.domain.writing.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.janovel.TestcontainersConfiguration;
import com.janovel.domain.writing.app.EssayTemplateService;
import com.janovel.domain.writing.dto.EssayTemplate.Item;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@ActiveProfiles("local")
class EssayTemplateServiceTests {

    private static final String FIRST_KEY = "a".repeat(64);
    private static final String SECOND_KEY = "b".repeat(64);
    private static final List<Item> ORIGINAL = List.of(new Item("지원 동기", "첫째 문단\n\n둘째 문단 ", null),
            new Item("협업 경험", "", 800));
    private static final List<Item> REPLACEMENT = List.of(new Item("성장 과정", "새 초안", 500));

    @Autowired
    private EssayTemplateService templates;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @Transactional
    @DisplayName("미저장 접근 키로 조회해도 계정 행이 생성되지 않는다")
    void lookupDoesNotCreateOwner() {
        Integer usersBefore = jdbc.queryForObject("SELECT count(*) FROM users", Integer.class);

        assertTrue(templates.find(FIRST_KEY).items().isEmpty());

        assertEquals(usersBefore, jdbc.queryForObject("SELECT count(*) FROM users", Integer.class));
    }

    @Test
    @Transactional
    @DisplayName("저장 순서와 초안의 줄바꿈을 보존하고 다른 접근 키의 양식을 격리한다")
    void preservesOrderAndIsolatesTemplates() {
        templates.replace(FIRST_KEY, ORIGINAL);
        templates.replace(SECOND_KEY, REPLACEMENT);

        assertEquals(ORIGINAL, templates.find(FIRST_KEY).items());
        assertEquals(REPLACEMENT, templates.find(SECOND_KEY).items());
    }

    @Test
    @Transactional
    @DisplayName("저장 세트를 교체하고 빈 배열을 보내면 이전 항목을 모두 지운다")
    void replacesAndClearsTemplate() {
        templates.replace(FIRST_KEY, ORIGINAL);
        templates.replace(FIRST_KEY, REPLACEMENT);
        assertEquals(REPLACEMENT, templates.find(FIRST_KEY).items());

        templates.replace(FIRST_KEY, List.of());
        assertTrue(templates.find(FIRST_KEY).items().isEmpty());
    }

    @Test
    @DisplayName("같은 접근 키의 저장이 겹쳐도 두 세트의 항목을 섞지 않는다")
    void replacesAsOneSetWhenWritesRace() throws Exception {
        String key = "c".repeat(64);
        var ready = new CountDownLatch(2);

        templates.replace(key, List.of(new Item("기존 문항", "기존 초안", 300)));
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> {
                ready.countDown();
                assertTrue(ready.await(5, TimeUnit.SECONDS));
                templates.replace(key, ORIGINAL);
                return null;
            });
            var second = executor.submit(() -> {
                ready.countDown();
                assertTrue(ready.await(5, TimeUnit.SECONDS));
                templates.replace(key, REPLACEMENT);
                return null;
            });
            first.get(5, TimeUnit.SECONDS);
            second.get(5, TimeUnit.SECONDS);

            List<Item> current = templates.find(key).items();
            assertTrue(current.equals(ORIGINAL) || current.equals(REPLACEMENT), () -> current.toString());
        }
    }
}
