package com.janovel.domain.writing.api;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class WritingCombinationAndSubmissionTests {

    @Autowired
    private MockMvc mvc;

    @Test
    @DisplayName("조합하면 출처와 연결하지 않는 새 버전과 첫 스냅샷이 생기고 현재 버전이 된다")
    void combinesIntoIndependentVersion() throws Exception {
        var entry = register();

        long combined = id(send(post("/api/questions/{id}/combinations", entry.first()), entry.key(),
                "{\"body\":\"두 본문을 합친 답변\",\"description\":\" 좋은 문장만 \"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("합친 버전"))
                .andExpect(jsonPath("$.description").value("좋은 문장만"))
                .andExpect(jsonPath("$.fromSnapshotId").value(nullValue()))
                .andExpect(jsonPath("$.draft.body").value("두 본문을 합친 답변"))
                .andExpect(jsonPath("$.draft.dirty").value(false))
                .andExpect(jsonPath("$.snapshots.length()").value(1))
                .andExpect(jsonPath("$.snapshots[0].title").value("합친 버전"))
                .andExpect(jsonPath("$.snapshots[0].description").value("좋은 문장만"))
                .andExpect(jsonPath("$.snapshots[0].parentIds").isEmpty()), "$.id");

        history(entry, entry.first()).andExpect(jsonPath("$.activeVersionId").value(combined))
                .andExpect(jsonPath("$.versions[1].draft.baseSnapshotId").isNotEmpty());
        send(post("/api/questions/{id}/combinations", entry.first()), entry.key(), "{\"body\":\"다시 합친 답변\"}")
                .andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("합친 버전 2"));
    }

    @Test
    @DisplayName("조합에 입력한 이름이 겹치면 409이고 빈 본문이면 400 EMPTY_TEXT이며 다른 사용자 문항이면 404다")
    void rejectsInvalidCombination() throws Exception {
        var entry = register();

        send(post("/api/questions/{id}/combinations", entry.first()), entry.key(), "{\"body\":\"답변\",\"name\":\"기본\"}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("DUPLICATE_VERSION_NAME"));
        send(post("/api/questions/{id}/combinations", entry.first()), entry.key(), "{\"body\":\" \\u00a0\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("EMPTY_TEXT"));
        send(post("/api/questions/{id}/combinations", entry.first()), entry.key(), "{}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        send(post("/api/questions/{id}/combinations", entry.first()), register().key(), "{\"body\":\"답변\"}")
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("QUESTION_NOT_FOUND"));
        history(entry, entry.first()).andExpect(jsonPath("$.versions.length()").value(1));
    }

    @Test
    @DisplayName("연 버전을 기억하면 문항의 현재 버전과 지원 건의 마지막 문항이 바뀌고 그 문항을 지우면 마지막 문항이 비워진다")
    void remembersOpenedVersionAndQuestion() throws Exception {
        var entry = register();
        long second = id(send(post("/api/questions/{id}/versions", entry.second()), entry.key(), "{\"name\":\"짧은 안\"}"), "$.id");
        long firstVersion = activeVersion(entry, entry.first());

        application(entry).andExpect(jsonPath("$.lastQuestionId").value(nullValue()));
        send(put("/api/questions/{id}/active-version", entry.second()), entry.key(), "{\"versionId\":" + second + "}")
                .andExpect(status().isNoContent());
        history(entry, entry.second()).andExpect(jsonPath("$.activeVersionId").value(second));
        application(entry).andExpect(jsonPath("$.lastQuestionId").value(entry.second()));
        mvc.perform(get("/api/applications").header(AUTHORIZATION, entry.key()))
                .andExpect(jsonPath("$[0].lastQuestionId").value(entry.second()));

        send(put("/api/questions/{id}/active-version", entry.second()), entry.key(), "{\"versionId\":" + firstVersion + "}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("VERSION_MISMATCH"));
        send(put("/api/questions/{id}/active-version", entry.second()), entry.key(), "{\"versionId\":1.5}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        send(put("/api/questions/{id}/active-version", entry.second()), register().key(), "{\"versionId\":" + second + "}")
                .andExpect(status().isNotFound());

        send(delete("/api/applications/{a}/questions/{q}", entry.applicationId(), entry.second()), entry.key(), null)
                .andExpect(status().isNoContent());
        application(entry).andExpect(jsonPath("$.lastQuestionId").value(nullValue()));
    }

    @Test
    @DisplayName("제출본은 스냅샷이나 초안 본문을 복사하고 원본을 고쳐도 그대로이며 직접 고치면 출처를 두고 이름만 직접 수정이 된다")
    void designatesAndRevisesSubmission() throws Exception {
        var entry = register();
        long version = activeVersion(entry, entry.first());
        long snapshot = id(send(post("/api/versions/{id}/snapshots", version), entry.key(),
                "{\"body\":\"제출할 답변\",\"revision\":0,\"title\":\"제출 전\"}").andExpect(status().isCreated()), "$.snapshot.id");

        submit(entry, "{\"snapshotId\":" + snapshot + "}").andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("제출할 답변"))
                .andExpect(jsonPath("$.sourceSnapshotId").value(snapshot))
                .andExpect(jsonPath("$.sourceVersionId").value(version))
                .andExpect(jsonPath("$.label").value("제출 전"))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());
        send(put("/api/versions/{id}/draft", version), entry.key(), "{\"body\":\"고친 초안\",\"revision\":1}")
                .andExpect(status().isOk());
        history(entry, entry.first()).andExpect(jsonPath("$.submission.body").value("제출할 답변"));

        submit(entry, "{\"versionId\":" + version + "}").andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("고친 초안"))
                .andExpect(jsonPath("$.sourceSnapshotId").value(nullValue()))
                .andExpect(jsonPath("$.label").value("초안 · 기본"));
        submit(entry, "{\"body\":\"제출 직전에 고친 답변\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("제출 직전에 고친 답변"))
                .andExpect(jsonPath("$.sourceVersionId").value(version))
                .andExpect(jsonPath("$.label").value("직접 수정"));
        history(entry, entry.first()).andExpect(jsonPath("$.submission.label").value("직접 수정"));
    }

    @Test
    @DisplayName("제출본이 없을 때 본문만 고치면 409이고 출처를 하나만 보내지 않거나 빈 본문이거나 다른 문항 기록이면 400이다")
    void rejectsInvalidSubmission() throws Exception {
        var entry = register();
        long version = activeVersion(entry, entry.first());
        long otherSnapshot = id(send(post("/api/versions/{id}/snapshots", activeVersion(entry, entry.second())), entry.key(),
                "{\"body\":\"다른 문항 답변\",\"revision\":0}"), "$.snapshot.id");

        submit(entry, "{\"body\":\"바로 고친 답변\"}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("SUBMISSION_REQUIRED"));
        submit(entry, "{}").andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        submit(entry, "{\"versionId\":" + version + ",\"body\":\"답변\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        submit(entry, "{\"versionId\":" + version + "}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("EMPTY_TEXT"));
        submit(entry, "{\"snapshotId\":" + otherSnapshot + "}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("SNAPSHOT_MISMATCH"));
        submit(entry, "{\"versionId\":" + activeVersion(entry, entry.second()) + "}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VERSION_MISMATCH"));
        history(entry, entry.first()).andExpect(jsonPath("$.submission").value(nullValue()));
    }

    @Test
    @DisplayName("제출본을 해제하면 비워지고 다시 해제해도 204이며 다른 사용자는 지정·해제 모두 404다")
    void clearsSubmission() throws Exception {
        var entry = register();
        long version = activeVersion(entry, entry.first());
        send(put("/api/versions/{id}/draft", version), entry.key(), "{\"body\":\"초안 답변\",\"revision\":0}");
        submit(entry, "{\"versionId\":" + version + "}").andExpect(status().isOk());
        var other = register();

        send(put("/api/questions/{id}/submission", entry.first()), other.key(), "{\"versionId\":" + version + "}")
                .andExpect(status().isNotFound());
        send(delete("/api/questions/{id}/submission", entry.first()), other.key(), null).andExpect(status().isNotFound());
        history(entry, entry.first()).andExpect(jsonPath("$.submission.body").value("초안 답변"));

        send(delete("/api/questions/{id}/submission", entry.first()), entry.key(), null).andExpect(status().isNoContent());
        send(delete("/api/questions/{id}/submission", entry.first()), entry.key(), null).andExpect(status().isNoContent());
        history(entry, entry.first()).andExpect(jsonPath("$.submission").value(nullValue()));
    }

    private Entry register() throws Exception {
        var bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        String key = "Bearer " + HexFormat.of().formatHex(bytes);
        var body = mvc.perform(post("/api/applications").header(AUTHORIZATION, key)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"company":"예시 회사","role":"백엔드","questions":[{"prompt":"지원 동기"},{"prompt":"협업 경험"}]}
                                """))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return new Entry(key, number(body, "$.id"), number(body, "$.questions[0].id"), number(body, "$.questions[1].id"));
    }

    private ResultActions history(Entry entry, long questionId) throws Exception {
        return mvc.perform(get("/api/questions/{id}/writing", questionId).header(AUTHORIZATION, entry.key()))
                .andExpect(status().isOk());
    }

    private ResultActions application(Entry entry) throws Exception {
        return mvc.perform(get("/api/applications/{id}", entry.applicationId()).header(AUTHORIZATION, entry.key()))
                .andExpect(status().isOk());
    }

    private long activeVersion(Entry entry, long questionId) throws Exception {
        return id(history(entry, questionId), "$.activeVersionId");
    }

    private ResultActions submit(Entry entry, String body) throws Exception {
        return send(put("/api/questions/{id}/submission", entry.first()), entry.key(), body);
    }

    private ResultActions send(MockHttpServletRequestBuilder request, String key, String body) throws Exception {
        request.header(AUTHORIZATION, key);
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        return mvc.perform(request);
    }

    private static long id(ResultActions result, String path) throws Exception {
        return number(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), path);
    }

    private static long number(String json, String path) {
        return ((Number) JsonPath.read(json, path)).longValue();
    }

    private record Entry(String key, long applicationId, long first, long second) {
    }
}
