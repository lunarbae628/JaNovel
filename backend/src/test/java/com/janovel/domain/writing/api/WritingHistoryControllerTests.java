package com.janovel.domain.writing.api;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.janovel.TestcontainersConfiguration;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class WritingHistoryControllerTests {

    @Autowired
    private MockMvc mvc;

    @Test
    @DisplayName("새 문항의 작성 이력에서 현재 버전과 빈 초안을 읽는다")
    void readsInitialHistory() throws Exception {
        var entry = createQuestion();

        history(entry).andExpect(jsonPath("$.questionId").value(entry.questionId()))
                .andExpect(jsonPath("$.versions[0].name").value("기본"))
                .andExpect(jsonPath("$.versions[0].draft.body").value(""))
                .andExpect(jsonPath("$.versions[0].draft.revision").value(0))
                .andExpect(jsonPath("$.versions[0].draft.updatedAt").isNotEmpty())
                .andExpect(jsonPath("$.versions[0].snapshots").isEmpty())
                .andExpect(jsonPath("$.submission").value(nullValue()));
    }

    @Test
    @DisplayName("초안을 저장하면 번호가 오르고 오래된 번호는 최신 초안과 함께 409를 반환한다")
    void savesDraftAndRejectsStaleWrites() throws Exception {
        var entry = createQuestion();
        long version = versionId(entry);

        draft(entry.key(), version, """
                {"body":"최신 초안","revision":0}
                """).andExpect(status().isOk())
                .andExpect(jsonPath("$.revision").value(1));
        draft(entry.key(), version, """
                {"body":"오래된 초안","revision":0}
                """).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("DRAFT_CONFLICT"))
                .andExpect(jsonPath("$.currentDraft.body").value("최신 초안"))
                .andExpect(jsonPath("$.currentDraft.revision").value(1));

        history(entry).andExpect(jsonPath("$.versions[0].draft.body").value("최신 초안"))
                .andExpect(jsonPath("$.versions[0].draft.revision").value(1));
    }

    @Test
    @DisplayName("같은 저장 번호로 동시에 요청하면 하나만 저장되고 다른 요청은 충돌한다")
    void acceptsOnlyOneConcurrentWriteForTheSameRevision() throws Exception {
        var entry = createQuestion();
        long version = versionId(entry);
        var start = new CyclicBarrier(2);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var requests = List.of("첫 탭", "둘째 탭").stream().map(body -> executor.submit(() -> {
                start.await(5, TimeUnit.SECONDS);
                return draft(entry.key(), version, """
                        {"body":"%s","revision":0}
                        """.formatted(body)).andReturn().getResponse();
            })).toList();
            var first = requests.get(0).get(10, TimeUnit.SECONDS);
            var second = requests.get(1).get(10, TimeUnit.SECONDS);
            assertEquals(List.of(200, 409), List.of(first.getStatus(), second.getStatus()).stream().sorted().toList());
            var saved = first.getStatus() == 200 ? first : second;
            var conflict = first.getStatus() == 409 ? first : second;
            String body = JsonPath.read(saved.getContentAsString(StandardCharsets.UTF_8), "$.body");
            assertEquals(body, JsonPath.<String>read(conflict.getContentAsString(StandardCharsets.UTF_8), "$.currentDraft.body"));
            history(entry).andExpect(jsonPath("$.versions[0].draft.body").value(body))
                    .andExpect(jsonPath("$.versions[0].draft.revision").value(1));
        }
    }

    @Test
    @DisplayName("Swagger에 초안 충돌 응답과 스냅샷 생성 응답이 표시된다")
    void describesWritingResponsesInOpenApi() throws Exception {
        mvc.perform(get("/swagger-ui.html")).andExpect(status().is3xxRedirection());
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/questions/{questionId}/writing'].get.responses['200']").exists())
                .andExpect(jsonPath("$.paths['/api/versions/{versionId}/draft'].put.responses['409']"
                        + ".content['application/json'].schema['$ref']").value("#/components/schemas/DraftConflictResponse"))
                .andExpect(jsonPath("$.paths['/api/versions/{versionId}/snapshots'].post.responses['409']"
                        + ".content['application/json'].schema.anyOf[0]['$ref']").value("#/components/schemas/DraftConflictResponse"))
                .andExpect(jsonPath("$.paths['/api/versions/{versionId}/snapshots'].post.responses['201']").exists())
                .andExpect(jsonPath("$.components.schemas.WritingDraft.properties.baseSnapshotId.type",
                        containsInAnyOrder("integer", "null")))
                .andExpect(jsonPath("$.components.schemas.WritingHistoryDetail.properties.submission.anyOf[0]['$ref']")
                        .value("#/components/schemas/WritingSubmission"))
                .andExpect(jsonPath("$.components.schemas.WritingHistoryDetail.properties.submission.anyOf[1].type").value("null"))
                .andExpect(jsonPath("$.components.schemas.WritingHistoryDetail.properties.submission['$ref']").doesNotExist())
                .andExpect(jsonPath("$.components.schemas.WritingHistoryDetail.properties.submission.type").doesNotExist());
    }

    @Test
    @DisplayName("스냅샷은 본문을 고정하고 다음 스냅샷과 부모 관계를 남긴다")
    void freezesSnapshotAndLinksParent() throws Exception {
        var entry = createQuestion();
        long version = versionId(entry);

        var first = snapshot(entry.key(), version, """
                {"body":"첫 번째 본문","revision":0,"title":"첫 기록","description":"설명"}
                """).andExpect(status().isCreated())
                .andExpect(jsonPath("$.snapshot.number").value(1))
                .andExpect(jsonPath("$.snapshot.title").value("첫 기록"))
                .andExpect(jsonPath("$.snapshot.description").value("설명"))
                .andExpect(jsonPath("$.snapshot.parentIds").isEmpty())
                .andExpect(jsonPath("$.draft.revision").value(1))
                .andExpect(jsonPath("$.draft.dirty").value(false))
                .andReturn();
        long firstId = id(first.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.snapshot.id");
        snapshot(entry.key(), version, """
                {"body":"첫 번째 본문","revision":1}
                """).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("NO_CHANGES"));
        snapshot(entry.key(), version, """
                {"body":"두 번째 본문","revision":0}
                """).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("DRAFT_CONFLICT"))
                .andExpect(jsonPath("$.currentDraft.baseSnapshotId").value(firstId));

        snapshot(entry.key(), version, """
                {"body":"두 번째 본문","revision":1}
                """).andExpect(status().isCreated())
                .andExpect(jsonPath("$.snapshot.number").value(2))
                .andExpect(jsonPath("$.snapshot.parentIds[0]").value(firstId))
                .andExpect(jsonPath("$.draft.revision").value(2));
        draft(entry.key(), version, """
                {"body":"보관하지 않은 초안","revision":2}
                """).andExpect(status().isOk())
                .andExpect(jsonPath("$.dirty").value(true));

        history(entry).andExpect(jsonPath("$.versions[0].snapshots[0].body").value("첫 번째 본문"))
                .andExpect(jsonPath("$.versions[0].snapshots[1].body").value("두 번째 본문"))
                .andExpect(jsonPath("$.versions[0].snapshots[1].parentIds[0]").value(firstId))
                .andExpect(jsonPath("$.versions[0].draft.body").value("보관하지 않은 초안"));
    }

    @Test
    @DisplayName("빈 스냅샷과 잘못된 저장 번호는 거절하고 빈 초안은 저장한다")
    void validatesDraftAndSnapshot() throws Exception {
        var entry = createQuestion();
        long version = versionId(entry);

        snapshot(entry.key(), version, """
                {"body":"  ","revision":0}
                """).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("EMPTY_TEXT"));
        snapshot(entry.key(), version, """
                {"body":"\u00a0\uFEFF","revision":0}
                """).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("EMPTY_TEXT"));
        for (String revision : new String[]{"-1", "0.5", "\"0\"", "null"}) {
            draft(entry.key(), version, "{\"body\":\"초안\",\"revision\":" + revision + "}")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        }
        draft(entry.key(), version, """
                {"body":"","revision":0}
                """).andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value(""));
    }

    @Test
    @DisplayName("짝이 없는 유니코드 문자는 거절하고 이모지를 포함한 정상 본문은 그대로 보존한다")
    void rejectsUnpairedSurrogates() throws Exception {
        var entry = createQuestion();
        long version = versionId(entry);
        String invalid = """
                {"body":"A\\uD800B","revision":0}
                """;

        draft(entry.key(), version, invalid).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        snapshot(entry.key(), version, invalid).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        snapshot(entry.key(), version, """
                {"body":"한글 😀","revision":0}
                """).andExpect(status().isCreated())
                .andExpect(jsonPath("$.snapshot.body").value("한글 😀"));
        history(entry).andExpect(jsonPath("$.versions[0].snapshots[0].body").value("한글 😀"));
    }

    @Test
    @DisplayName("문항에 설정할 수 있는 최대 길이의 본문을 초안과 스냅샷으로 저장한다")
    void savesBodyAtMaximumQuestionLength() throws Exception {
        var entry = createQuestion();
        long version = versionId(entry);
        String body = "가".repeat(100_000);
        String request = """
                {"body":"%s","revision":%d}
                """;

        draft(entry.key(), version, request.formatted(body, 0)).andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value(body));
        snapshot(entry.key(), version, request.formatted(body, 1)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.snapshot.body").value(body));
        history(entry).andExpect(jsonPath("$.versions[0].snapshots[0].body").value(body));
    }

    @Test
    @DisplayName("다른 사용자의 작성 이력과 버전은 없는 것처럼 응답한다")
    void blocksOtherUsers() throws Exception {
        var entry = createQuestion();
        var other = createQuestion();
        long version = versionId(entry);

        mvc.perform(get("/api/questions/{id}/writing", entry.questionId()).header(AUTHORIZATION, other.key()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/questions/{id}/writing", entry.questionId()))
                .andExpect(status().isUnauthorized());
        draft(other.key(), version, """
                {"body":"변경","revision":0}
                """).andExpect(status().isNotFound());
        snapshot(other.key(), version, """
                {"body":"변경","revision":0}
                """).andExpect(status().isNotFound());
        history(entry).andExpect(jsonPath("$.versions[0].draft.revision").value(0));
    }

    private Entry createQuestion() throws Exception {
        var bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        String key = "Bearer " + HexFormat.of().formatHex(bytes);
        var result = mvc.perform(post("/api/applications").header(AUTHORIZATION, key)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"company":"예시 회사","role":"백엔드","questions":[{"prompt":"지원 동기"}]}
                                """))
                .andExpect(status().isCreated()).andReturn();
        return new Entry(key, id(result.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.questions[0].id"));
    }

    private ResultActions history(Entry entry) throws Exception {
        return mvc.perform(get("/api/questions/{id}/writing", entry.questionId()).header(AUTHORIZATION, entry.key()))
                .andExpect(status().isOk());
    }

    private long versionId(Entry entry) throws Exception {
        return id(history(entry).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), "$.activeVersionId");
    }

    private ResultActions draft(String key, long version, String body) throws Exception {
        return mvc.perform(put("/api/versions/{id}/draft", version).header(AUTHORIZATION, key)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions snapshot(String key, long version, String body) throws Exception {
        return mvc.perform(post("/api/versions/{id}/snapshots", version).header(AUTHORIZATION, key)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private static long id(String json, String path) {
        return ((Number) JsonPath.read(json, path)).longValue();
    }

    private record Entry(String key, long questionId) {
    }
}
