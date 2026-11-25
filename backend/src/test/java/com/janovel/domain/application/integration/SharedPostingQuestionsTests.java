package com.janovel.domain.application.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.janovel.TestcontainersConfiguration;
import com.janovel.domain.application.app.SharedPostingQuestions;
import com.janovel.domain.application.dto.ImportedPosting.Question;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@Transactional
class SharedPostingQuestionsTests {

    private static final String POSTING = "https://careers.example.com/postings/17?round=1#/jobs/42";
    private static final List<Question> ORIGINAL = List.of(new Question("지원 동기를 알려 주세요.", null),
            new Question("협업 경험을 알려 주세요.", 800));
    private static final List<Question> CORRECTION = List.of(new Question("지원 동기와 목표를 알려 주세요.", 500));

    @Autowired
    private SharedPostingQuestions shared;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("첫 문항 세트의 순서와 미확인 제한을 보존하고 후속 등록으로 덮어쓰지 않는다")
    void keepsFirstSet() {
        assertTrue(shared.saveFirst(POSTING, "백엔드 개발", ORIGINAL));
        assertFalse(shared.saveFirst(POSTING, "백엔드 개발", CORRECTION));
        assertEquals(ORIGINAL, shared.find(
                "https://CAREERS.example.com:443/postings/17?round=1&utm_source=search#/jobs/42", " 백엔드  개발 ")
                .orElseThrow().questions());
    }

    @Test
    @DisplayName("사람인 공고는 사용자별 추적 값이 달라도 공고 번호가 같으면 같은 문항을 가져온다")
    void matchesSaraminPostingByRecruitmentId() {
        shared.saveFirst("https://www.saramin.co.kr/zf_user/jobs/relay/view?isMypage=no&rec_idx=1000001"
                + "&recommend_ids=AAA&relayNonce=111&gz=1#seq=0", "백엔드", ORIGINAL);
        assertEquals(ORIGINAL, shared.find("https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=1000001"
                + "&relayNonce=222&view_type=list", "백엔드").orElseThrow().questions());
        assertTrue(shared.find("https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=1000002", "백엔드").isEmpty());
    }

    @Test
    @DisplayName("모집 직무와 회차 쿼리 및 해시 경로가 다르면 문항을 가져오지 않는다")
    void separatesPostingScopes() {
        shared.saveFirst(POSTING, "백엔드", ORIGINAL);
        assertTrue(shared.find(POSTING, "프론트엔드").isEmpty());
        assertTrue(shared.find(POSTING.replace("round=1", "round=2"), "백엔드").isEmpty());
        assertTrue(shared.find(POSTING.replace("/42", "/43"), "백엔드").isEmpty());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @DisplayName("같은 공고와 직무를 동시에 등록해도 문항 세트 하나만 생성한다")
    void savesOneSetWhenRegistrationsRace() throws Exception {
        String url = POSTING.replace("/17", "/" + UUID.randomUUID());
        var ready = new CountDownLatch(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> {
                ready.countDown();
                assertTrue(ready.await(5, TimeUnit.SECONDS));
                return shared.saveFirst(url, "백엔드", ORIGINAL);
            });
            var second = executor.submit(() -> {
                ready.countDown();
                assertTrue(ready.await(5, TimeUnit.SECONDS));
                return shared.saveFirst(url, "백엔드", CORRECTION);
            });
            boolean originalWon = first.get(5, TimeUnit.SECONDS);
            assertEquals(!originalWon, second.get(5, TimeUnit.SECONDS));
            assertEquals(originalWon ? ORIGINAL : CORRECTION, shared.find(url, "백엔드").orElseThrow().questions());
        } finally {
            jdbc.update("DELETE FROM shared_posting_question_sets WHERE posting_url = ?", url);
        }
    }

    @Test
    @DisplayName("제보와 정정 제안을 본 문항 버전에 연결하고 공통 문항은 보존한다")
    void recordsReportAgainstVersion() {
        shared.saveFirst(POSTING, "백엔드", ORIGINAL);
        var version = shared.find(POSTING, "백엔드").orElseThrow();
        assertTrue(shared.report(version.id(), List.of()));
        assertTrue(shared.report(version.id(), CORRECTION));
        assertFalse(shared.report(UUID.randomUUID(), CORRECTION));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM shared_posting_question_reports WHERE question_set_id = ?",
                Integer.class, version.id()));
        assertEquals("지원 동기와 목표를 알려 주세요.", jdbc.queryForObject("""
                SELECT proposed_questions->0->>'prompt' FROM shared_posting_question_reports
                WHERE question_set_id = ? AND proposed_questions <> '[]'::jsonb
                """, String.class, version.id()));
        assertEquals(version, shared.find(POSTING, "백엔드").orElseThrow());
    }
}
