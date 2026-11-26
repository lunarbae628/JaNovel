package com.janovel.domain.application.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.janovel.TestcontainersConfiguration;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ApplicationEditControllerTests {

    private static final String REGISTRATION = """
            {"company": "예시 회사", "role": "백엔드",
             "deadline": {"kind": "fixed", "date": "2026-12-16", "time": "23:59"},
             "sourceUrl": "https://careers.example.com/jobs/1", "sourceText": "공고 원문",
             "sections": [{"title": "업무", "body": "API 개발"}, {"title": "우대 사항", "body": "Docker"}],
             "stages": ["서류전형", "1차 면접", "최종 면접"],
             "questions": [{"prompt": "지원 동기", "limit": 500}]}
            """;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcClient jdbc;

    private static String newKey() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return "Bearer " + HexFormat.of().formatHex(bytes);
    }

    private static String body(MvcResult result) throws Exception {
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, String key, String body) {
        return request.header(AUTHORIZATION, key).contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private long register(String key) throws Exception {
        var result = mvc.perform(json(post("/api/applications"), key, REGISTRATION))
                .andExpect(status().isCreated()).andReturn();
        return ((Number) JsonPath.read(body(result), "$.id")).longValue();
    }

    private List<Long> stageIds(String key, long id) throws Exception {
        var result = mvc.perform(get("/api/applications/" + id).header(AUTHORIZATION, key))
                .andExpect(status().isOk()).andReturn();
        List<Number> ids = JsonPath.read(body(result), "$.stages[*].id");
        return ids.stream().map(Number::longValue).toList();
    }

    private String progress(String status, Long stageId) {
        return "{\"status\":\"" + status + "\",\"currentStageId\":" + stageId + "}";
    }

    @Test
    @DisplayName("기본 정보를 수정하면 보낸 값으로 바뀌고 생략한 마감·주소·원문은 지워지며 항목·전형·문항은 그대로다")
    void updatesBasicInfo() throws Exception {
        var key = newKey();
        long id = register(key);

        mvc.perform(json(put("/api/applications/" + id), key,
                        "{\"company\":\" 바뀐 회사 \",\"role\":\"프론트엔드\",\"deadline\":{\"kind\":\"rolling\"}}"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.company").value("바뀐 회사"))
                .andExpect(jsonPath("$.role").value("프론트엔드"))
                .andExpect(jsonPath("$.deadline.kind").value("rolling"))
                .andExpect(jsonPath("$.sourceUrl").doesNotExist())
                .andExpect(jsonPath("$.sourceText").doesNotExist())
                .andExpect(jsonPath("$.sections.length()").value(2))
                .andExpect(jsonPath("$.stages.length()").value(3))
                .andExpect(jsonPath("$.questions.length()").value(1));

        mvc.perform(json(put("/api/applications/" + id), key, "{\"company\":\"바뀐 회사\",\"role\":\"프론트엔드\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.deadline").doesNotExist());
        mvc.perform(get("/api/applications").header(AUTHORIZATION, key))
                .andExpect(jsonPath("$[0].company").value("바뀐 회사"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"company\":\"  \",\"role\":\"백엔드\"}",
            "{\"company\":\"회사\"}",
            "{\"company\":\"회사\",\"role\":\"백엔드\",\"deadline\":{\"kind\":\"fixed\"}}",
            "{\"company\":\"회사\",\"role\":\"백엔드\",\"deadline\":{\"kind\":\"rolling\",\"date\":\"2026-12-01\"}}"})
    @DisplayName("기본 정보 수정에 회사명·직무가 비었거나 마감 조합이 틀리면 400 INVALID_REQUEST다")
    void rejectsInvalidUpdate(String request) throws Exception {
        var key = newKey();
        long id = register(key);

        mvc.perform(json(put("/api/applications/" + id), key, request))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        mvc.perform(get("/api/applications/" + id).header(AUTHORIZATION, key))
                .andExpect(jsonPath("$.company").value("예시 회사"));
    }

    @Test
    @DisplayName("상태와 현재 전형을 바꾸고 종료하면 그때의 전형 이름을 남기며 종료를 풀면 지운다")
    void changesProgress() throws Exception {
        var key = newKey();
        long id = register(key);
        var stages = stageIds(key, id);

        mvc.perform(json(put("/api/applications/" + id + "/progress"), key, progress("in_progress", stages.get(1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("in_progress"))
                .andExpect(jsonPath("$.currentStageId").value(stages.get(1)))
                .andExpect(jsonPath("$.outcomeStageName").doesNotExist());

        mvc.perform(json(put("/api/applications/" + id + "/progress"), key, progress("closed", stages.get(1))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.outcomeStageName").value("1차 면접"));
        // 종료한 뒤 전형 이름을 바꿔도 종료 당시 이름은 남는다.
        mvc.perform(json(put("/api/applications/" + id + "/stages"), key,
                "{\"stages\":[{\"id\":" + stages.get(0) + ",\"name\":\"서류\"},{\"id\":" + stages.get(1)
                        + ",\"name\":\"실무 면접\"},{\"id\":" + stages.get(2) + ",\"name\":\"최종 면접\"}]}"))
                .andExpect(status().isOk());
        mvc.perform(json(put("/api/applications/" + id + "/progress"), key, progress("closed", stages.get(1))))
                .andExpect(jsonPath("$.outcomeStageName").value("1차 면접"));

        mvc.perform(json(put("/api/applications/" + id + "/progress"), key, progress("writing", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("writing"))
                .andExpect(jsonPath("$.currentStageId").doesNotExist())
                .andExpect(jsonPath("$.outcomeStageName").doesNotExist());
        mvc.perform(get("/api/applications").header(AUTHORIZATION, key))
                .andExpect(jsonPath("$[0].status").value("writing"));
    }

    @Test
    @DisplayName("다른 지원 건의 전형을 현재 전형으로 고르면 400 STAGE_MISMATCH이고 상태가 틀리면 400 INVALID_REQUEST다")
    void rejectsInvalidProgress() throws Exception {
        var key = newKey();
        long id = register(key);
        long otherStage = stageIds(key, register(key)).get(0);

        mvc.perform(json(put("/api/applications/" + id + "/progress"), key, progress("in_progress", otherStage)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("STAGE_MISMATCH"));
        for (var request : List.of("{\"currentStageId\":null}", "{\"status\":\"done\"}",
                "{\"status\":\"writing\",\"currentStageId\":1.5}", "{\"status\":\"writing\",\"currentStageId\":\"1\"}")) {
            mvc.perform(json(put("/api/applications/" + id + "/progress"), key, request))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        }
        mvc.perform(get("/api/applications/" + id).header(AUTHORIZATION, key))
                .andExpect(jsonPath("$.status").value("interested"));
    }

    @Test
    @DisplayName("공고 항목을 교체하면 보낸 목록만 보낸 순서로 남고 빈 목록이면 모두 지워진다")
    void replacesSections() throws Exception {
        var key = newKey();
        long id = register(key);

        mvc.perform(json(put("/api/applications/" + id + "/sections"), key,
                        "{\"sections\":[{\"title\":\"자격 요건\",\"body\":\"Java\"},{\"title\":\"업무\",\"body\":\"API 개발\"},{\"title\":\"복지\",\"body\":\"\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].title").value("자격 요건"))
                .andExpect(jsonPath("$[2].body").value(""));
        mvc.perform(get("/api/applications/" + id).header(AUTHORIZATION, key))
                .andExpect(jsonPath("$.sections[*].title").value(org.hamcrest.Matchers.contains("자격 요건", "업무", "복지")));

        mvc.perform(json(put("/api/applications/" + id + "/sections"), key, "{\"sections\":[]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(json(put("/api/applications/" + id + "/sections"), key, "{\"sections\":[{\"title\":\"\",\"body\":\"x\"}]}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        mvc.perform(json(put("/api/applications/" + id + "/sections"), key, "{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
    }

    @Test
    @DisplayName("전형을 수정하면 번호가 있는 전형은 이름·순서만 바뀌고 새 전형은 추가되며 빠진 전형은 지워진다")
    void updatesStages() throws Exception {
        var key = newKey();
        long id = register(key);
        var stages = stageIds(key, id);

        var result = mvc.perform(json(put("/api/applications/" + id + "/stages"), key,
                        "{\"stages\":[{\"id\":" + stages.get(2) + ",\"name\":\" 임원 면접 \"},{\"name\":\"과제 전형\"},{\"id\":"
                                + stages.get(0) + ",\"name\":\"서류전형\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value(stages.get(2)))
                .andExpect(jsonPath("$[0].name").value("임원 면접"))
                .andExpect(jsonPath("$[1].name").value("과제 전형"))
                .andExpect(jsonPath("$[2].id").value(stages.get(0)))
                .andReturn();
        long created = ((Number) JsonPath.read(body(result), "$[1].id")).longValue();

        assertEquals(List.of(stages.get(2), created, stages.get(0)), stageIds(key, id));
        // 반대로 한 번 더 바꿔도 순번 충돌 없이 처리된다.
        mvc.perform(json(put("/api/applications/" + id + "/stages"), key,
                        "{\"stages\":[{\"id\":" + stages.get(0) + ",\"name\":\"서류전형\"},{\"id\":" + created
                                + ",\"name\":\"과제 전형\"},{\"id\":" + stages.get(2) + ",\"name\":\"임원 면접\"}]}"))
                .andExpect(status().isOk());
        assertEquals(List.of(stages.get(0), created, stages.get(2)), stageIds(key, id));
    }

    @Test
    @DisplayName("현재 전형을 지우면 현재 전형 선택이 비워진다")
    void clearsCurrentStageWhenDeleted() throws Exception {
        var key = newKey();
        long id = register(key);
        var stages = stageIds(key, id);
        mvc.perform(json(put("/api/applications/" + id + "/progress"), key, progress("in_progress", stages.get(1))))
                .andExpect(status().isOk());

        mvc.perform(json(put("/api/applications/" + id + "/stages"), key,
                        "{\"stages\":[{\"id\":" + stages.get(0) + ",\"name\":\"서류전형\"}]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));

        mvc.perform(get("/api/applications/" + id).header(AUTHORIZATION, key))
                .andExpect(jsonPath("$.status").value("in_progress"))
                .andExpect(jsonPath("$.currentStageId").doesNotExist())
                .andExpect(jsonPath("$.stages.length()").value(1));
    }

    @Test
    @DisplayName("전형 수정에 모르는 번호·겹치는 번호·다른 지원 건의 번호가 있으면 400 STAGE_MISMATCH이고 바뀌지 않는다")
    void rejectsMismatchedStages() throws Exception {
        var key = newKey();
        long id = register(key);
        var stages = stageIds(key, id);
        long otherStage = stageIds(key, register(key)).get(0);

        for (var request : List.of(
                "{\"stages\":[{\"id\":" + stages.get(0) + ",\"name\":\"a\"},{\"id\":" + stages.get(0) + ",\"name\":\"b\"}]}",
                "{\"stages\":[{\"id\":" + otherStage + ",\"name\":\"a\"}]}",
                "{\"stages\":[{\"id\":" + Long.MAX_VALUE + ",\"name\":\"a\"}]}")) {
            mvc.perform(json(put("/api/applications/" + id + "/stages"), key, request))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("STAGE_MISMATCH"));
        }
        for (var request : List.of("{}", "{\"stages\":[{\"name\":\" \"}]}", "{\"stages\":[{\"id\":1.5,\"name\":\"a\"}]}")) {
            mvc.perform(json(put("/api/applications/" + id + "/stages"), key, request))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        }
        assertEquals(stages, stageIds(key, id));
    }

    @Test
    @DisplayName("지원 건을 삭제하면 상세·목록에서 사라지고 항목·전형·문항도 함께 지워진다")
    void deletesApplication() throws Exception {
        var key = newKey();
        long id = register(key);
        var stages = stageIds(key, id);
        mvc.perform(json(put("/api/applications/" + id + "/progress"), key, progress("in_progress", stages.get(0))))
                .andExpect(status().isOk());

        mvc.perform(delete("/api/applications/" + id).header(AUTHORIZATION, key)).andExpect(status().isNoContent());

        mvc.perform(get("/api/applications/" + id).header(AUTHORIZATION, key))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("APPLICATION_NOT_FOUND"));
        mvc.perform(get("/api/applications").header(AUTHORIZATION, key)).andExpect(jsonPath("$.length()").value(0));
        for (var table : List.of("application_sections", "application_stages", "essay_questions")) {
            assertEquals(0L, jdbc.sql("SELECT count(*) FROM " + table + " WHERE application_id = ?").param(id)
                    .query(Long.class).single());
        }
        mvc.perform(delete("/api/applications/" + id).header(AUTHORIZATION, key)).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("다른 사용자의 지원 건은 수정·상태 변경·항목·전형·삭제 모두 404이고 바뀌지 않는다")
    void blocksOtherUsers() throws Exception {
        var owner = newKey();
        var other = newKey();
        long id = register(owner);
        var stages = stageIds(owner, id);
        var base = "/api/applications/" + id;

        mvc.perform(json(put(base), other, "{\"company\":\"침입\",\"role\":\"침입\"}")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("APPLICATION_NOT_FOUND"));
        mvc.perform(json(put(base + "/progress"), other, progress("closed", stages.get(0)))).andExpect(status().isNotFound());
        mvc.perform(json(put(base + "/sections"), other, "{\"sections\":[]}")).andExpect(status().isNotFound());
        mvc.perform(json(put(base + "/stages"), other, "{\"stages\":[]}")).andExpect(status().isNotFound());
        mvc.perform(delete(base).header(AUTHORIZATION, other)).andExpect(status().isNotFound());

        mvc.perform(get(base).header(AUTHORIZATION, owner))
                .andExpect(jsonPath("$.company").value("예시 회사"))
                .andExpect(jsonPath("$.status").value("interested"))
                .andExpect(jsonPath("$.sections.length()").value(2))
                .andExpect(jsonPath("$.stages.length()").value(3));
    }

    @Test
    @DisplayName("접근 키가 없으면 수정과 삭제가 401 APPLICATION_UNAUTHORIZED다")
    void rejectsMissingKey() throws Exception {
        mvc.perform(put("/api/applications/1").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"company\":\"회사\",\"role\":\"백엔드\"}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("APPLICATION_UNAUTHORIZED"));
        mvc.perform(delete("/api/applications/1")).andExpect(status().isUnauthorized());
    }
}
