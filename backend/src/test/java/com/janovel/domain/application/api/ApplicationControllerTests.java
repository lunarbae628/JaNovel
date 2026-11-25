package com.janovel.domain.application.api;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.HttpHeaders.CACHE_CONTROL;
import static org.springframework.http.HttpHeaders.LOCATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ApplicationControllerTests {

    private static final String FULL_REQUEST = """
            {
              "company": "  예시 회사  ",
              "role": " 백엔드 개발자 ",
              "deadline": {"kind": "fixed", "date": "2026-12-16", "time": "23:59"},
              "sourceUrl": "https://careers.example.com/jobs/1",
              "sourceText": "공고 원문",
              "sections": [{"title": "업무", "body": "API 개발"}, {"title": "우대 사항", "body": "Docker 경험"}],
              "stages": ["서류전형", "1차 면접", "합격"]
            }
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
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id")).longValue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "Bearer invalid", "Basic abcdef"})
    @DisplayName("접근 키가 없거나 형식이 틀리면 목록 조회와 등록이 401 APPLICATION_UNAUTHORIZED로 거부된다")
    void rejectsMissingOrMalformedKey(String header) throws Exception {
        var list = get("/api/applications");
        var create = post("/api/applications").contentType(MediaType.APPLICATION_JSON)
                .content("{\"company\":\"예시 회사\",\"role\":\"백엔드\"}");
        if (!header.isEmpty()) {
            list.header(AUTHORIZATION, header);
            create.header(AUTHORIZATION, header);
        }

        mvc.perform(list).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("APPLICATION_UNAUTHORIZED"));
        mvc.perform(create).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("APPLICATION_UNAUTHORIZED"));
    }

    @Test
    @DisplayName("처음 조회하는 접근 키는 캐시하지 않는 빈 목록을 받는다")
    void listsNothingForNewKey() throws Exception {
        mvc.perform(get("/api/applications").header(AUTHORIZATION, newKey()))
                .andExpect(status().isOk())
                .andExpect(header().string(CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("마감·원문·항목·전형을 함께 등록하고 같은 값을 상세 조회한다")
    void registersAndFindsFullApplication() throws Exception {
        String key = newKey();

        var created = mvc.perform(post("/api/applications").header(AUTHORIZATION, key)
                        .contentType(MediaType.APPLICATION_JSON).content(FULL_REQUEST))
                .andExpect(status().isCreated())
                .andExpect(header().string(LOCATION, startsWith("/api/applications/")))
                .andExpect(jsonPath("$.company").value("예시 회사"))
                .andExpect(jsonPath("$.role").value("백엔드 개발자"))
                .andExpect(jsonPath("$.status").value("interested"))
                .andExpect(jsonPath("$.deadline.kind").value("fixed"))
                .andExpect(jsonPath("$.deadline.date").value("2026-12-16"))
                .andExpect(jsonPath("$.deadline.time").value("23:59"))
                .andExpect(jsonPath("$.sections.length()").value(2))
                .andExpect(jsonPath("$.sections[0].title").value("업무"))
                .andExpect(jsonPath("$.stages.length()").value(3))
                .andExpect(jsonPath("$.stages[2].name").value("합격"))
                .andReturn();
        long id = ((Number) JsonPath.read(created.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id")).longValue();

        mvc.perform(get("/api/applications/" + id).header(AUTHORIZATION, key))
                .andExpect(status().isOk())
                .andExpect(header().string(CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.sourceUrl").value("https://careers.example.com/jobs/1"))
                .andExpect(jsonPath("$.sections[1].body").value("Docker 경험"))
                .andExpect(jsonPath("$.stages[0].name").value("서류전형"));
    }

    @Test
    @DisplayName("회사와 직무만 등록하면 마감은 null이고 항목과 전형은 빈 배열이다")
    void registersMinimalApplication() throws Exception {
        mvc.perform(post("/api/applications").header(AUTHORIZATION, newKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"company\":\"두 번째 회사\",\"role\":\"디자이너\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.deadline").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.sections.length()").value(0))
                .andExpect(jsonPath("$.stages.length()").value(0));
    }

    @Test
    @DisplayName("목록은 최근에 등록한 순서이고 다른 접근 키에는 보이지 않으며 상세 조회는 404다")
    void separatesOwners() throws Exception {
        String owner = newKey();
        String other = newKey();
        long first = register(owner, FULL_REQUEST);
        register(owner, "{\"company\":\"두 번째 회사\",\"role\":\"디자이너\"}");

        mvc.perform(get("/api/applications").header(AUTHORIZATION, owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].company").value("두 번째 회사"))
                .andExpect(jsonPath("$[1].deadline.date").value("2026-12-16"));
        mvc.perform(get("/api/applications").header(AUTHORIZATION, other))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/applications/" + first).header(AUTHORIZATION, other))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("APPLICATION_NOT_FOUND"));
    }

    @Test
    @DisplayName("없는 지원 건 상세 조회는 404 APPLICATION_NOT_FOUND다")
    void returnsNotFoundForMissingApplication() throws Exception {
        mvc.perform(get("/api/applications/999999999").header(AUTHORIZATION, newKey()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("APPLICATION_NOT_FOUND"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"company\":\"   \",\"role\":\"백엔드\"}",
            "{\"company\":\"예시 회사\",\"role\":\"백엔드\",\"deadline\":{\"kind\":\"fixed\"}}",
            "{\"company\":\"예시 회사\",\"role\":\"백엔드\",\"deadline\":{\"kind\":\"always_open\",\"date\":\"2026-12-16\"}}",
            "{\"company\":\"예시 회사\",\"role\":\"백엔드\",\"deadline\":{\"kind\":\"someday\"}}",
            "{\"company\":\"예시 회사\",\"role\":\"백엔드\",\"stages\":[\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\",\"10\",\"11\",\"12\",\"13\",\"14\",\"15\",\"16\",\"17\",\"18\",\"19\",\"20\",\"21\"]}"
    })
    @DisplayName("회사명이 공백이거나 마감 조합·종류가 틀리거나 전형이 20개를 넘으면 400 INVALID_REQUEST다")
    void rejectsInvalidRequest(String body) throws Exception {
        mvc.perform(post("/api/applications").header(AUTHORIZATION, newKey())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
    }
}
