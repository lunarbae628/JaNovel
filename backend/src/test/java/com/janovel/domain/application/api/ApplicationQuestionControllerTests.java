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
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ApplicationQuestionControllerTests {

    private static final String REGISTRATION = """
            {"company": "예시 회사", "role": "백엔드",
             "questions": [{"prompt": "지원 동기", "limit": 500}, {"prompt": "협업 경험", "limit": null}, {"prompt": "입사 후 포부"}]}
            """;

    @Autowired
    private MockMvc mvc;

    private static String newKey() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return "Bearer " + HexFormat.of().formatHex(bytes);
    }

    private long register(String key, String body) throws Exception {
        var result = mvc.perform(post("/api/applications").header(AUTHORIZATION, key)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated()).andReturn();
        return ((Number) JsonPath.read(body(result), "$.id")).longValue();
    }

    private static String body(MvcResult result) throws Exception {
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private List<Long> questionIds(String key, long applicationId) throws Exception {
        var result = mvc.perform(get("/api/applications/" + applicationId).header(AUTHORIZATION, key))
                .andExpect(status().isOk()).andReturn();
        List<Number> ids = JsonPath.read(body(result), "$.questions[*].id");
        return ids.stream().map(Number::longValue).toList();
    }

    private static String idsJson(List<Long> ids) {
        return "{\"ids\":[" + ids.stream().map(String::valueOf).collect(Collectors.joining(",")) + "]}";
    }

    @Test
    @DisplayName("문항을 추가하면 맨 뒤에 붙고 상세 조회에 보인다")
    void addsQuestionAtEnd() throws Exception {
        var key = newKey();
        long id = register(key, REGISTRATION);

        mvc.perform(post("/api/applications/" + id + "/questions").header(AUTHORIZATION, key)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"prompt\":\"  성장 과정  \",\"limit\":700}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/applications/" + id))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.prompt").value("성장 과정"))
                .andExpect(jsonPath("$.limit").value(700));

        mvc.perform(get("/api/applications/" + id).header(AUTHORIZATION, key))
                .andExpect(jsonPath("$.questions.length()").value(4))
                .andExpect(jsonPath("$.questions[3].prompt").value("성장 과정"));
    }

    @Test
    @DisplayName("문항이 하나도 없는 지원 건에도 문항을 추가할 수 있다")
    void addsFirstQuestion() throws Exception {
        var key = newKey();
        long id = register(key, "{\"company\":\"예시 회사\",\"role\":\"백엔드\"}");

        mvc.perform(post("/api/applications/" + id + "/questions").header(AUTHORIZATION, key)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"prompt\":\"지원 동기\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.limit").doesNotExist());
    }

    @Test
    @DisplayName("문항이 30개인 지원 건에 추가하면 409 QUESTION_LIMIT_EXCEEDED다")
    void rejectsAddBeyondLimit() throws Exception {
        var key = newKey();
        var questions = IntStream.rangeClosed(1, 30).mapToObj(i -> "{\"prompt\":\"문항 " + i + "\"}")
                .collect(Collectors.joining(","));
        long id = register(key, "{\"company\":\"예시 회사\",\"role\":\"백엔드\",\"questions\":[" + questions + "]}");

        mvc.perform(post("/api/applications/" + id + "/questions").header(AUTHORIZATION, key)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"prompt\":\"하나 더\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("QUESTION_LIMIT_EXCEEDED"));
    }

    @Test
    @DisplayName("문항 내용과 글자 수 제한을 바꾸고 limit을 null로 보내면 제한이 없어진다")
    void updatesQuestion() throws Exception {
        var key = newKey();
        long id = register(key, REGISTRATION);
        long first = questionIds(key, id).get(0);

        mvc.perform(put("/api/applications/" + id + "/questions/" + first).header(AUTHORIZATION, key)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"prompt\":\"바꾼 문항\",\"limit\":900}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(first))
                .andExpect(jsonPath("$.prompt").value("바꾼 문항")).andExpect(jsonPath("$.limit").value(900));
        mvc.perform(put("/api/applications/" + id + "/questions/" + first).header(AUTHORIZATION, key)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"prompt\":\"바꾼 문항\",\"limit\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.limit").doesNotExist());

        mvc.perform(get("/api/applications/" + id).header(AUTHORIZATION, key))
                .andExpect(jsonPath("$.questions[0].prompt").value("바꾼 문항"))
                .andExpect(jsonPath("$.questions[1].prompt").value("협업 경험"));
    }

    @Test
    @DisplayName("문항 내용이 비었거나 글자 수 제한이 범위를 벗어나면 400 INVALID_REQUEST다")
    void rejectsInvalidQuestion() throws Exception {
        var key = newKey();
        long id = register(key, REGISTRATION);
        long first = questionIds(key, id).get(0);

        for (var body : List.of("{\"prompt\":\"   \"}", "{}", "{\"prompt\":\"문항\",\"limit\":0}",
                "{\"prompt\":\"문항\",\"limit\":500.5}")) {
            mvc.perform(post("/api/applications/" + id + "/questions").header(AUTHORIZATION, key)
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
            mvc.perform(put("/api/applications/" + id + "/questions/" + first).header(AUTHORIZATION, key)
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        }
    }

    @Test
    @DisplayName("문항을 삭제하면 사라지고 남은 문항의 순서는 유지되며 새 문항은 맨 뒤에 붙는다")
    void deletesQuestion() throws Exception {
        var key = newKey();
        long id = register(key, REGISTRATION);
        var ids = questionIds(key, id);

        mvc.perform(delete("/api/applications/" + id + "/questions/" + ids.get(1)).header(AUTHORIZATION, key))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/applications/" + id + "/questions").header(AUTHORIZATION, key)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"prompt\":\"새 문항\"}"))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/applications/" + id).header(AUTHORIZATION, key))
                .andExpect(jsonPath("$.questions.length()").value(3))
                .andExpect(jsonPath("$.questions[0].prompt").value("지원 동기"))
                .andExpect(jsonPath("$.questions[1].prompt").value("입사 후 포부"))
                .andExpect(jsonPath("$.questions[2].prompt").value("새 문항"));
        mvc.perform(delete("/api/applications/" + id + "/questions/" + ids.get(1)).header(AUTHORIZATION, key))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("QUESTION_NOT_FOUND"));
    }

    @Test
    @DisplayName("순서를 바꾸면 보낸 번호 순서대로 저장되고 상세 조회에도 같은 순서로 나온다")
    void reordersQuestions() throws Exception {
        var key = newKey();
        long id = register(key, REGISTRATION);
        var ids = questionIds(key, id);
        var reversed = List.of(ids.get(2), ids.get(1), ids.get(0));

        mvc.perform(put("/api/applications/" + id + "/questions/order").header(AUTHORIZATION, key)
                        .contentType(MediaType.APPLICATION_JSON).content(idsJson(reversed)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value(reversed.get(0)))
                .andExpect(jsonPath("$[0].prompt").value("입사 후 포부"));

        mvc.perform(get("/api/applications/" + id).header(AUTHORIZATION, key))
                .andExpect(jsonPath("$.questions[0].prompt").value("입사 후 포부"))
                .andExpect(jsonPath("$.questions[1].prompt").value("협업 경험"))
                .andExpect(jsonPath("$.questions[2].prompt").value("지원 동기"));
        // 한 번 더 바꿔도 순번 충돌 없이 처리된다.
        mvc.perform(put("/api/applications/" + id + "/questions/order").header(AUTHORIZATION, key)
                        .contentType(MediaType.APPLICATION_JSON).content(idsJson(ids)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].prompt").value("지원 동기"));
    }

    @Test
    @DisplayName("순서에 문항이 빠졌거나 겹치거나 남의 번호가 섞이면 400 QUESTION_ORDER_MISMATCH다")
    void rejectsMismatchedOrder() throws Exception {
        var key = newKey();
        long id = register(key, REGISTRATION);
        var ids = questionIds(key, id);

        for (var order : List.of(List.of(ids.get(0), ids.get(1)),
                List.of(ids.get(0), ids.get(0), ids.get(1)),
                List.of(ids.get(0), ids.get(1), ids.get(2), ids.get(2)),
                List.of(ids.get(0), ids.get(1), Long.MAX_VALUE),
                List.<Long>of())) {
            mvc.perform(put("/api/applications/" + id + "/questions/order").header(AUTHORIZATION, key)
                            .contentType(MediaType.APPLICATION_JSON).content(idsJson(order)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("QUESTION_ORDER_MISMATCH"));
        }
        for (var body : List.of("{}", "{\"ids\":null}", "{\"ids\":\"1\"}",
                "{\"ids\":[" + ids.get(0) + ".9," + ids.get(1) + "," + ids.get(2) + "]}",
                "{\"ids\":[\"" + ids.get(0) + "\"," + ids.get(1) + "," + ids.get(2) + "]}",
                "{\"ids\":[null," + ids.get(1) + "," + ids.get(2) + "]}")) {
            mvc.perform(put("/api/applications/" + id + "/questions/order").header(AUTHORIZATION, key)
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        }
        assertEquals(ids, questionIds(key, id));
    }

    @Test
    @DisplayName("다른 사용자의 지원 건과 문항은 추가·수정·삭제·순서 변경 모두 404이고 바뀌지 않는다")
    void blocksOtherUsers() throws Exception {
        var owner = newKey();
        var other = newKey();
        long id = register(owner, REGISTRATION);
        var ids = questionIds(owner, id);
        long otherApplication = register(other, REGISTRATION);
        var otherIds = questionIds(other, otherApplication);
        var json = MediaType.APPLICATION_JSON;

        mvc.perform(post("/api/applications/" + id + "/questions").header(AUTHORIZATION, other)
                .contentType(json).content("{\"prompt\":\"침입\"}")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("APPLICATION_NOT_FOUND"));
        mvc.perform(put("/api/applications/" + id + "/questions/" + ids.get(0)).header(AUTHORIZATION, other)
                .contentType(json).content("{\"prompt\":\"침입\"}")).andExpect(status().isNotFound());
        mvc.perform(delete("/api/applications/" + id + "/questions/" + ids.get(0)).header(AUTHORIZATION, other))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/applications/" + id + "/questions/order").header(AUTHORIZATION, other)
                .contentType(json).content(idsJson(ids))).andExpect(status().isNotFound());
        // 내 지원 건 주소에 다른 지원 건의 문항 번호를 섞어도 찾지 못한다.
        mvc.perform(put("/api/applications/" + otherApplication + "/questions/" + ids.get(0)).header(AUTHORIZATION, other)
                .contentType(json).content("{\"prompt\":\"침입\"}")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("QUESTION_NOT_FOUND"));

        assertEquals(ids, questionIds(owner, id));
        mvc.perform(get("/api/applications/" + id).header(AUTHORIZATION, owner))
                .andExpect(jsonPath("$.questions[0].prompt").value("지원 동기"));
        assertEquals(3, otherIds.size());
    }

    @Test
    @DisplayName("접근 키가 없으면 401 APPLICATION_UNAUTHORIZED다")
    void rejectsMissingKey() throws Exception {
        mvc.perform(post("/api/applications/1/questions").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prompt\":\"문항\"}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("APPLICATION_UNAUTHORIZED"));
        mvc.perform(delete("/api/applications/1/questions/1")).andExpect(status().isUnauthorized());
    }
}
