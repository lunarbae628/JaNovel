package com.janovel.domain.application.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.HttpHeaders.IF_MATCH;
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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ApplicationVersionControllerTests {

    private static final String REGISTRATION = """
            {"company": "예시 회사", "role": "백엔드", "stages": ["서류전형", "면접"],
             "questions": [{"prompt": "지원 동기", "limit": 500}, {"prompt": "협업 경험", "limit": 700}]}
            """;
    private static final String UPDATE = """
            {"company": "바꾼 회사", "role": "백엔드"}
            """;

    @Autowired
    private MockMvc mvc;

    private final String key = newKey();

    private static String newKey() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return "Bearer " + HexFormat.of().formatHex(bytes);
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, String body) {
        return request.header(AUTHORIZATION, key).contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private long register() throws Exception {
        var result = mvc.perform(json(post("/api/applications"), REGISTRATION))
                .andExpect(status().isCreated()).andExpect(header().string("ETag", "\"0\""))
                .andExpect(jsonPath("$.version").value(0)).andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id"))
                .longValue();
    }

    @Test
    @DisplayName("지원 건을 고칠 때마다 버전이 오르고 응답 ETag와 상세·목록에 새 버전이 나온다")
    void increasesVersionOnEveryChange() throws Exception {
        long id = register();
        var base = "/api/applications/" + id;

        mvc.perform(json(put(base), UPDATE).header(IF_MATCH, "\"0\""))
                .andExpect(status().isOk()).andExpect(header().string("ETag", "\"1\""))
                .andExpect(jsonPath("$.version").value(1));
        mvc.perform(json(put(base + "/sections"), "{\"sections\": [{\"title\": \"업무\", \"body\": \"API\"}]}")
                        .header(IF_MATCH, "\"1\""))
                .andExpect(status().isOk()).andExpect(header().string("ETag", "\"2\""));
        mvc.perform(json(put(base + "/stages"), "{\"stages\": [{\"name\": \"서류\"}]}").header(IF_MATCH, "2"))
                .andExpect(status().isOk()).andExpect(header().string("ETag", "\"3\""));
        mvc.perform(json(put(base + "/progress"), "{\"status\": \"writing\"}").header(IF_MATCH, "\"3\""))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(4));
        mvc.perform(json(post(base + "/questions"), "{\"prompt\": \"입사 후 포부\"}").header(IF_MATCH, "\"4\""))
                .andExpect(status().isCreated()).andExpect(header().string("ETag", "\"5\""));

        mvc.perform(get(base).header(AUTHORIZATION, key))
                .andExpect(header().string("ETag", "\"5\"")).andExpect(jsonPath("$.version").value(5));
        mvc.perform(get("/api/applications").header(AUTHORIZATION, key))
                .andExpect(jsonPath("$[0].version").value(5));
    }

    @Test
    @DisplayName("다른 곳에서 먼저 고친 지원 건을 예전 버전으로 고치면 409로 거절하고 내용을 바꾸지 않는다")
    void rejectsStaleVersion() throws Exception {
        long id = register();
        var base = "/api/applications/" + id;
        mvc.perform(json(put(base), UPDATE).header(IF_MATCH, "\"0\"")).andExpect(status().isOk());

        mvc.perform(json(put(base), "{\"company\": \"오래된 화면\", \"role\": \"백엔드\"}").header(IF_MATCH, "\"0\""))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("APPLICATION_CONFLICT"));
        mvc.perform(json(put(base + "/stages"), "{\"stages\": []}").header(IF_MATCH, "\"0\""))
                .andExpect(status().isConflict());
        mvc.perform(json(post(base + "/questions"), "{\"prompt\": \"새 문항\"}").header(IF_MATCH, "\"0\""))
                .andExpect(status().isConflict());
        mvc.perform(delete(base).header(AUTHORIZATION, key).header(IF_MATCH, "\"0\""))
                .andExpect(status().isConflict());

        var detail = mvc.perform(get(base).header(AUTHORIZATION, key))
                .andExpect(jsonPath("$.company").value("바꾼 회사")).andExpect(jsonPath("$.version").value(1))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertEquals(2, ((java.util.List<?>) JsonPath.read(detail, "$.stages")).size());
        assertEquals(2, ((java.util.List<?>) JsonPath.read(detail, "$.questions")).size());
    }

    @Test
    @DisplayName("문항 수정·삭제·순서 변경도 버전을 확인하고 올린다")
    void checksVersionOnQuestionChanges() throws Exception {
        long id = register();
        var base = "/api/applications/" + id;
        var detail = mvc.perform(get(base).header(AUTHORIZATION, key)).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        long first = ((Number) JsonPath.read(detail, "$.questions[0].id")).longValue();
        long second = ((Number) JsonPath.read(detail, "$.questions[1].id")).longValue();

        mvc.perform(json(put(base + "/questions/" + first), "{\"prompt\": \"고친 문항\", \"limit\": 300}")
                        .header(IF_MATCH, "\"0\""))
                .andExpect(status().isOk()).andExpect(header().string("ETag", "\"1\""));
        mvc.perform(json(put(base + "/questions/order"), "{\"ids\": [" + second + ", " + first + "]}")
                        .header(IF_MATCH, "\"0\""))
                .andExpect(status().isConflict());
        mvc.perform(json(put(base + "/questions/order"), "{\"ids\": [" + second + ", " + first + "]}")
                        .header(IF_MATCH, "\"1\""))
                .andExpect(status().isOk()).andExpect(header().string("ETag", "\"2\""));
        mvc.perform(delete(base + "/questions/" + first).header(AUTHORIZATION, key).header(IF_MATCH, "\"2\""))
                .andExpect(status().isNoContent()).andExpect(header().string("ETag", "\"3\""));
    }

    @Test
    @DisplayName("If-Match를 생략하면 버전을 확인하지 않고 고친다")
    void allowsChangeWithoutVersion() throws Exception {
        long id = register();
        mvc.perform(json(put("/api/applications/" + id), UPDATE))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
    }

    @Test
    @DisplayName("If-Match가 버전 번호가 아니면 400 INVALID_VERSION으로 거절한다")
    void rejectsMalformedVersion() throws Exception {
        long id = register();
        mvc.perform(json(put("/api/applications/" + id), UPDATE).header(IF_MATCH, "*"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_VERSION"));
    }

    @Test
    @DisplayName("마지막으로 연 문항을 기억해도 지원 건 버전은 오르지 않는다")
    void activeVersionDoesNotIncreaseVersion() throws Exception {
        long id = register();
        var detail = mvc.perform(get("/api/applications/" + id).header(AUTHORIZATION, key)).andReturn()
                .getResponse().getContentAsString(StandardCharsets.UTF_8);
        long question = ((Number) JsonPath.read(detail, "$.questions[1].id")).longValue();
        var writing = mvc.perform(get("/api/questions/" + question + "/writing").header(AUTHORIZATION, key))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        long version = ((Number) JsonPath.read(writing, "$.versions[0].id")).longValue();

        mvc.perform(json(put("/api/questions/" + question + "/active-version"), "{\"versionId\": " + version + "}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/applications/" + id).header(AUTHORIZATION, key))
                .andExpect(jsonPath("$.lastQuestionId").value(question)).andExpect(jsonPath("$.version").value(0));
    }
}
