package com.janovel.domain.writing.api;

import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.HttpHeaders.CACHE_CONTROL;
import static org.springframework.http.HttpHeaders.WWW_AUTHENTICATE;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.janovel.TestcontainersConfiguration;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class EssayTemplateControllerTests {

    @Autowired
    private MockMvc mvc;

    private static String newKey() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return "Bearer " + HexFormat.of().formatHex(bytes);
    }

    private void save(String key, String body) throws Exception {
        mvc.perform(put("/api/me/essay-template").header(AUTHORIZATION, key)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("접근 키가 없거나 형식이 틀리면 401 ESSAY_TEMPLATE_UNAUTHORIZED와 Bearer 안내를 반환한다")
    void rejectsMissingOrMalformedKey() throws Exception {
        mvc.perform(get("/api/me/essay-template"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(WWW_AUTHENTICATE, "Bearer"))
                .andExpect(jsonPath("$.error").value("ESSAY_TEMPLATE_UNAUTHORIZED"));
        mvc.perform(put("/api/me/essay-template").header(AUTHORIZATION, "Bearer invalid")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"items\":[]}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("ESSAY_TEMPLATE_UNAUTHORIZED"));
    }

    @Test
    @DisplayName("처음 조회하는 프로필은 캐시하지 않는 빈 양식을 받는다")
    void returnsEmptyTemplateForNewKey() throws Exception {
        mvc.perform(get("/api/me/essay-template").header(AUTHORIZATION, newKey()))
                .andExpect(status().isOk())
                .andExpect(header().string(CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    @DisplayName("저장한 문항 순서와 초안의 공백, 글자 수 제한을 그대로 조회하고 다른 프로필에는 보이지 않는다")
    void savesTemplateInOrderAndIsolatesProfiles() throws Exception {
        String key = newKey();
        save(key, """
                {"items":[
                  {"prompt":" 지원 동기 ","draftBody":" 첫째 문단\\n\\n둘째 문단 ","limit":null},
                  {"prompt":"협업 경험","draftBody":"","limit":800}
                ]}
                """);

        mvc.perform(get("/api/me/essay-template").header(AUTHORIZATION, key))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].prompt").value("지원 동기"))
                .andExpect(jsonPath("$.items[0].draftBody").value(" 첫째 문단\n\n둘째 문단 "))
                .andExpect(jsonPath("$.items[0].limit").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.items[1].prompt").value("협업 경험"))
                .andExpect(jsonPath("$.items[1].limit").value(800));
        mvc.perform(get("/api/me/essay-template").header(AUTHORIZATION, newKey()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"items\":[{\"prompt\":\"성장 과정\",\"limit\":500}]}",
            "{\"items\":[{\"prompt\":\"성장 과정\",\"draftBody\":\"새 초안\",\"limit\":0}]}",
            "{\"items\":[{\"prompt\":\"성장 과정\",\"draftBody\":\"새 초안\",\"limit\":500.5}]}"
    })
    @DisplayName("초안이 없거나 글자 수 제한이 범위 밖이거나 정수가 아니면 400 INVALID_REQUEST다")
    void rejectsInvalidItems(String body) throws Exception {
        mvc.perform(put("/api/me/essay-template").header(AUTHORIZATION, newKey())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
    }

    @Test
    @DisplayName("저장하면 이전 세트가 교체되고 빈 배열로 저장하면 세트가 비워진다")
    void replacesAndClearsTemplate() throws Exception {
        String key = newKey();
        save(key, "{\"items\":[{\"prompt\":\"지원 동기\",\"draftBody\":\"초안\",\"limit\":null}]}");
        save(key, "{\"items\":[{\"prompt\":\"성장 과정\",\"draftBody\":\"새 초안\",\"limit\":500}]}");

        mvc.perform(get("/api/me/essay-template").header(AUTHORIZATION, key))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].prompt").value("성장 과정"));

        save(key, "{\"items\":[]}");
        mvc.perform(get("/api/me/essay-template").header(AUTHORIZATION, key))
                .andExpect(jsonPath("$.items.length()").value(0));
    }
}
