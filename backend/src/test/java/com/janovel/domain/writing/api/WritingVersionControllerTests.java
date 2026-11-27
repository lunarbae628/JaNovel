package com.janovel.domain.writing.api;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
class WritingVersionControllerTests {

    @Autowired
    private MockMvc mvc;

    @Test
    @DisplayName("빈 버전은 맨 뒤에 붙고 현재 버전이 되며 기본 이름끼리는 번호를 붙이고 입력한 이름이 겹치면 409 DUPLICATE_VERSION_NAME이다")
    void createsEmptyVersions() throws Exception {
        var entry = createQuestion();

        createVersion(entry, "{}").andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("새 버전"))
                .andExpect(jsonPath("$.position").value(2))
                .andExpect(jsonPath("$.fromSnapshotId").value(nullValue()))
                .andExpect(jsonPath("$.draft.body").value(""))
                .andExpect(jsonPath("$.draft.dirty").value(false))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());
        createVersion(entry, "{\"name\":\"  \"}").andExpect(jsonPath("$.name").value("새 버전 2"));
        createVersion(entry, "{\"name\":\" 기본 \"}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("DUPLICATE_VERSION_NAME"));
        long named = id(createVersion(entry, "{\"name\":\" 짧은 안 \",\"description\":\" 짧게 \"}")
                .andExpect(jsonPath("$.name").value("짧은 안"))
                .andExpect(jsonPath("$.description").value("짧게")), "$.id");

        history(entry).andExpect(jsonPath("$.activeVersionId").value(named))
                .andExpect(jsonPath("$.versions[*].name").value(contains("기본", "새 버전", "새 버전 2", "짧은 안")));
    }

    @Test
    @DisplayName("스냅샷에서 갈라진 버전은 그 본문으로 시작하고 이름은 v번호 대신 스냅샷 이름을 쓰며 첫 스냅샷의 부모가 시작 스냅샷이 된다")
    void branchesFromSnapshot() throws Exception {
        var entry = createQuestion();
        long base = activeVersion(entry);
        long first = snapshotId(snapshot(entry.key(), base, "첫 답변", 0));

        long branch = id(createVersion(entry, "{\"fromSnapshotId\":" + first + "}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("스냅샷 1에서 시작"))
                .andExpect(jsonPath("$.fromSnapshotId").value(first))
                .andExpect(jsonPath("$.draft.body").value("첫 답변"))
                .andExpect(jsonPath("$.draft.baseSnapshotId").value(first))
                .andExpect(jsonPath("$.draft.dirty").value(false)), "$.id");

        snapshot(entry.key(), branch, "갈라져 고친 답변", 1).andExpect(status().isCreated())
                .andExpect(jsonPath("$.snapshot.number").value(2))
                .andExpect(jsonPath("$.snapshot.parentIds").value(contains((int) first)));
    }

    @Test
    @DisplayName("다른 문항의 스냅샷에서 갈라지면 400 SNAPSHOT_MISMATCH이고 번호가 정수가 아니거나 이름이 길면 400 INVALID_REQUEST다")
    void rejectsInvalidVersionCreation() throws Exception {
        var entry = createQuestion();
        var other = createQuestion(entry.key());
        long foreign = snapshotId(snapshot(entry.key(), activeVersion(other), "다른 문항 답변", 0));

        createVersion(entry, "{\"fromSnapshotId\":" + foreign + "}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("SNAPSHOT_MISMATCH"));
        createVersion(entry, "{\"fromSnapshotId\":1.5}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        createVersion(entry, "{\"name\":\"" + "가".repeat(101) + "\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        history(entry).andExpect(jsonPath("$.versions.length()").value(1));
    }

    @Test
    @DisplayName("버전 이름을 비우면 유지하고 다른 버전과 같으면 409이며 응답에는 이름·설명만 담는다")
    void updatesVersion() throws Exception {
        var entry = createQuestion();
        long version = id(createVersion(entry, "{\"name\":\"짧은 안\",\"description\":\"500자\"}"), "$.id");

        send(patch("/api/versions/{id}", version), entry.key(), "{\"name\":\"  \",\"description\":\" \"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("짧은 안"))
                .andExpect(jsonPath("$.description").value(nullValue()))
                .andExpect(jsonPath("$.draft").doesNotExist())
                .andExpect(jsonPath("$.snapshots").doesNotExist());
        send(patch("/api/versions/{id}", version), entry.key(), "{\"name\":\"기본\"}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("DUPLICATE_VERSION_NAME"));
        send(patch("/api/versions/{id}", version), entry.key(), "{\"name\":\"짧은 안\",\"description\":\"다시\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("짧은 안"))
                .andExpect(jsonPath("$.description").value("다시"));
        history(entry).andExpect(jsonPath("$.versions[*].name").value(contains("기본", "짧은 안")));
    }

    @Test
    @DisplayName("문항의 마지막 버전은 지울 수 없고 현재 버전을 지우면 남은 첫 버전이 현재 버전이 된다")
    void deletesVersionAndMovesActiveVersion() throws Exception {
        var entry = createQuestion();
        long base = activeVersion(entry);

        send(delete("/api/versions/{id}", base), entry.key(), null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("LAST_VERSION"));

        long extra = id(createVersion(entry, "{}"), "$.id");
        send(delete("/api/versions/{id}", extra), entry.key(), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.activeVersionId").value(base))
                .andExpect(jsonPath("$.versions.length()").value(1));
    }

    @Test
    @DisplayName("버전을 지우면 그 버전 스냅샷을 가리키던 부모·시작·기준을 남는 가장 가까운 조상으로 다시 잇고 다른 번호는 유지한다")
    void reconnectsHistoryWhenVersionIsDeleted() throws Exception {
        var entry = createQuestion();
        long main = activeVersion(entry);
        long v1 = snapshotId(snapshot(entry.key(), main, "첫 답변", 0));
        long v2 = snapshotId(snapshot(entry.key(), main, "고친 답변", 1));
        long middle = id(createVersion(entry, "{\"name\":\"중간\",\"fromSnapshotId\":" + v2 + "}"), "$.id");
        long v3 = snapshotId(snapshot(entry.key(), middle, "중간에서 고친 답변", 1));
        long draftOnly = id(createVersion(entry, "{\"name\":\"초안만\",\"fromSnapshotId\":" + v3 + "}"), "$.id");
        long child = id(createVersion(entry, "{\"name\":\"자식\",\"fromSnapshotId\":" + v3 + "}"), "$.id");
        long v4 = snapshotId(snapshot(entry.key(), child, "자식에서 고친 답변", 1));

        send(delete("/api/versions/{id}", middle), entry.key(), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.activeVersionId").value(child))
                .andExpect(jsonPath("$.versions[*].name").value(contains("기본", "초안만", "자식")))
                .andExpect(jsonPath("$.versions[0].snapshots[*].number").value(contains(1, 2)))
                .andExpect(jsonPath("$.versions[1].fromSnapshotId").value(v2))
                .andExpect(jsonPath("$.versions[1].draft.baseSnapshotId").value(v2))
                .andExpect(jsonPath("$.versions[1].draft.body").value("중간에서 고친 답변"))
                .andExpect(jsonPath("$.versions[1].draft.dirty").value(true))
                .andExpect(jsonPath("$.versions[2].fromSnapshotId").value(v2))
                .andExpect(jsonPath("$.versions[2].snapshots[0].id").value(v4))
                .andExpect(jsonPath("$.versions[2].snapshots[0].number").value(4))
                .andExpect(jsonPath("$.versions[2].snapshots[0].parentIds").value(contains((int) v2)));
        history(entry).andExpect(jsonPath("$.versions[0].snapshots[1].parentIds").value(contains((int) v1)));
    }

    @Test
    @DisplayName("스냅샷은 버전의 마지막이고 다음 스냅샷·다른 버전이 참조하지 않을 때만 지우고 초안 기준은 그 부모로 옮긴다")
    void deletesOnlyUnreferencedLatestSnapshot() throws Exception {
        var entry = createQuestion();
        long main = activeVersion(entry);
        long v1 = snapshotId(snapshot(entry.key(), main, "첫 답변", 0));
        long v2 = snapshotId(snapshot(entry.key(), main, "고친 답변", 1));

        send(delete("/api/snapshots/{id}", v1), entry.key(), null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("SNAPSHOT_IN_USE"));
        long branch = id(createVersion(entry, "{\"fromSnapshotId\":" + v2 + "}"), "$.id");
        send(delete("/api/snapshots/{id}", v2), entry.key(), null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("SNAPSHOT_IN_USE"));
        send(delete("/api/versions/{id}", branch), entry.key(), null).andExpect(status().isOk());

        send(delete("/api/snapshots/{id}", v2), entry.key(), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.versions[0].snapshots[*].id").value(contains((int) v1)))
                .andExpect(jsonPath("$.versions[0].draft.baseSnapshotId").value(v1))
                .andExpect(jsonPath("$.versions[0].draft.body").value("고친 답변"))
                .andExpect(jsonPath("$.versions[0].draft.dirty").value(true));
        send(delete("/api/snapshots/{id}", v1), entry.key(), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.versions[0].snapshots").isEmpty())
                .andExpect(jsonPath("$.versions[0].draft.baseSnapshotId").value(nullValue()));
    }

    @Test
    @DisplayName("갈라진 버전의 첫 스냅샷을 지우면 초안 기준이 시작 스냅샷으로 돌아간다")
    void returnsBranchBaseToStartingSnapshot() throws Exception {
        var entry = createQuestion();
        long v1 = snapshotId(snapshot(entry.key(), activeVersion(entry), "첫 답변", 0));
        long branch = id(createVersion(entry, "{\"fromSnapshotId\":" + v1 + "}"), "$.id");
        long v2 = snapshotId(snapshot(entry.key(), branch, "갈라져 고친 답변", 1));

        send(delete("/api/snapshots/{id}", v2), entry.key(), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.versions[1].snapshots").isEmpty())
                .andExpect(jsonPath("$.versions[1].draft.baseSnapshotId").value(v1))
                .andExpect(jsonPath("$.versions[1].draft.dirty").value(true));
    }

    @Test
    @DisplayName("스냅샷 이름·설명만 바꾸고 본문은 그대로 두며 이름을 비우면 기본 이름, 설명을 비우면 없음이 된다")
    void updatesSnapshotInfo() throws Exception {
        var entry = createQuestion();
        long v1 = snapshotId(snapshot(entry.key(), activeVersion(entry), "첫 답변", 0));

        send(patch("/api/snapshots/{id}", v1), entry.key(), "{\"title\":\" 제출 전 \",\"description\":\"최종 점검\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("제출 전"))
                .andExpect(jsonPath("$.description").value("최종 점검"))
                .andExpect(jsonPath("$.body").doesNotExist());
        send(patch("/api/snapshots/{id}", v1), entry.key(), "{\"title\":\"\u00a0\"}")
                .andExpect(jsonPath("$.title").value("스냅샷 1"))
                .andExpect(jsonPath("$.description").value(nullValue()));
    }

    @Test
    @DisplayName("다른 사용자의 문항·버전·스냅샷은 만들기·수정·삭제 모두 404이고 바뀌지 않는다")
    void blocksOtherUsers() throws Exception {
        var entry = createQuestion();
        long main = activeVersion(entry);
        long v1 = snapshotId(snapshot(entry.key(), main, "첫 답변", 0));
        long extra = id(createVersion(entry, "{}"), "$.id");
        var other = createQuestion();

        send(post("/api/questions/{id}/versions", entry.questionId()), other.key(), "{}")
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("QUESTION_NOT_FOUND"));
        send(patch("/api/versions/{id}", extra), other.key(), "{\"name\":\"침입\"}")
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("VERSION_NOT_FOUND"));
        send(delete("/api/versions/{id}", extra), other.key(), null).andExpect(status().isNotFound());
        send(patch("/api/snapshots/{id}", v1), other.key(), "{\"title\":\"침입\"}")
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("SNAPSHOT_NOT_FOUND"));
        send(delete("/api/snapshots/{id}", v1), other.key(), null).andExpect(status().isNotFound());
        // 다른 사용자는 자기 문항에서도 남의 스냅샷으로 갈라질 수 없다.
        createVersion(other, "{\"fromSnapshotId\":" + v1 + "}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("SNAPSHOT_MISMATCH"));

        history(entry).andExpect(jsonPath("$.versions[*].name").value(contains("기본", "새 버전")))
                .andExpect(jsonPath("$.versions[0].snapshots[0].title").value("스냅샷 1"));
    }

    @Test
    @DisplayName("Swagger에 버전·스냅샷 관리 경로와 오류 응답이 표시된다")
    void describesVersionEndpointsInOpenApi() throws Exception {
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/questions/{questionId}/versions'].post.responses", hasKey("400")))
                .andExpect(jsonPath("$.paths['/api/versions/{versionId}'].patch.responses", hasKey("404")))
                .andExpect(jsonPath("$.paths['/api/versions/{versionId}'].delete.responses", hasKey("409")))
                .andExpect(jsonPath("$.paths['/api/snapshots/{snapshotId}'].patch.responses", hasKey("404")))
                .andExpect(jsonPath("$.paths['/api/snapshots/{snapshotId}'].delete.responses", hasKey("409")));
    }

    @Test
    @DisplayName("삭제로 초안의 기준 스냅샷이 바뀌면 저장 번호가 올라 이전 번호의 저장·스냅샷 요청은 409 DRAFT_CONFLICT다")
    void bumpsRevisionWhenDeletionMovesBase() throws Exception {
        var entry = createQuestion();
        long main = activeVersion(entry);
        snapshot(entry.key(), main, "첫 답변", 0);
        long v2 = snapshotId(snapshot(entry.key(), main, "고친 답변", 1));

        send(delete("/api/snapshots/{id}", v2), entry.key(), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.versions[0].draft.revision").value(3));
        send(put("/api/versions/{id}/draft", main), entry.key(), "{\"body\":\"오래된 화면\",\"revision\":2}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("DRAFT_CONFLICT"))
                .andExpect(jsonPath("$.currentDraft.revision").value(3));
        send(post("/api/versions/{id}/snapshots", main), entry.key(), "{\"body\":\"오래된 화면\",\"revision\":2}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("DRAFT_CONFLICT"));
    }

    @Test
    @DisplayName("버전을 지워 다른 버전의 초안 기준이 바뀌면 그 버전의 저장 번호도 오르고 기준이 그대로인 버전은 그대로다")
    void bumpsRevisionOfRebasedVersions() throws Exception {
        var entry = createQuestion();
        long main = activeVersion(entry);
        long v1 = snapshotId(snapshot(entry.key(), main, "첫 답변", 0));
        long middle = id(createVersion(entry, "{\"name\":\"중간\",\"fromSnapshotId\":" + v1 + "}"), "$.id");
        long v2 = snapshotId(snapshot(entry.key(), middle, "중간 답변", 1));
        long rebased = id(createVersion(entry, "{\"name\":\"초안만\",\"fromSnapshotId\":" + v2 + "}")
                .andExpect(jsonPath("$.draft.revision").value(1)), "$.id");

        send(delete("/api/versions/{id}", middle), entry.key(), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.versions[0].draft.revision").value(1))
                .andExpect(jsonPath("$.versions[1].id").value(rebased))
                .andExpect(jsonPath("$.versions[1].draft.baseSnapshotId").value(v1))
                .andExpect(jsonPath("$.versions[1].draft.revision").value(2));
    }

    @Test
    @DisplayName("입력한 이름은 90자를 넘어도 자르지 않고 이름 없이 설명만 고치면 이름을 그대로 둔다")
    void keepsNameWhenOnlyDescriptionChanges() throws Exception {
        var entry = createQuestion();
        String longName = "가".repeat(95);
        long version = id(createVersion(entry, "{\"name\":\"" + longName + "\"}")
                .andExpect(jsonPath("$.name").value(longName)), "$.id");

        send(patch("/api/versions/{id}", version), entry.key(), "{\"description\":\"설명\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value(longName))
                .andExpect(jsonPath("$.description").value("설명"));
    }

    @Test
    @DisplayName("줄바꿈 없는 공백만 넣은 이름과 설명은 프론트처럼 빈 값으로 본다")
    void treatsNonBreakingSpaceAsBlank() throws Exception {
        var entry = createQuestion();

        createVersion(entry, "{\"name\":\"\u00a0\\ufeff \",\"description\":\"\u00a0\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("새 버전"))
                .andExpect(jsonPath("$.description").value(nullValue()));
        createVersion(entry, "{\"name\":\"\u00a0짧은 안\u00a0\"}").andExpect(jsonPath("$.name").value("짧은 안"));
    }

    private Entry createQuestion() throws Exception {
        var bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return createQuestion("Bearer " + HexFormat.of().formatHex(bytes));
    }

    private Entry createQuestion(String key) throws Exception {
        var result = mvc.perform(post("/api/applications").header(AUTHORIZATION, key)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"company":"예시 회사","role":"백엔드","questions":[{"prompt":"지원 동기"}]}
                                """))
                .andExpect(status().isCreated()).andReturn();
        return new Entry(key, ((Number) JsonPath.read(result.getResponse().getContentAsString(StandardCharsets.UTF_8),
                "$.questions[0].id")).longValue());
    }

    private ResultActions history(Entry entry) throws Exception {
        return mvc.perform(get("/api/questions/{id}/writing", entry.questionId()).header(AUTHORIZATION, entry.key()))
                .andExpect(status().isOk());
    }

    private long activeVersion(Entry entry) throws Exception {
        return id(history(entry), "$.activeVersionId");
    }

    private ResultActions createVersion(Entry entry, String body) throws Exception {
        return send(post("/api/questions/{id}/versions", entry.questionId()), entry.key(), body);
    }

    private ResultActions snapshot(String key, long version, String body, long revision) throws Exception {
        return send(post("/api/versions/{id}/snapshots", version), key,
                "{\"body\":\"" + body + "\",\"revision\":" + revision + "}")
                .andExpect(status().isCreated());
    }

    private long snapshotId(ResultActions result) throws Exception {
        return id(result, "$.snapshot.id");
    }

    private ResultActions send(MockHttpServletRequestBuilder request, String key, String body) throws Exception {
        request.header(AUTHORIZATION, key);
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        return mvc.perform(request);
    }

    private static long id(ResultActions result, String path) throws Exception {
        return ((Number) JsonPath.read(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), path))
                .longValue();
    }

    private record Entry(String key, long questionId) {
    }
}
