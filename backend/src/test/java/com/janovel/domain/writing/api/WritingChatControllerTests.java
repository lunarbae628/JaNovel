package com.janovel.domain.writing.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.janovel.TestcontainersConfiguration;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
class WritingChatControllerTests {

    private static final AtomicReference<String> MODEL_REQUEST = new AtomicReference<>();
    private static final HttpServer MODEL = startModel();
    private static final String KEY = "Bearer " + "a".repeat(64);
    private static final String REQUEST = """
            {"kind":"draft","context":"공고와 선택한 경험 원문","request":"AI 초안을 작성해 주세요.",
             "history":[{"role":"assistant","text":"이전 대화"}]}
            """;

    @Autowired
    private MockMvc mvc;

    @DynamicPropertySource
    static void modelProperties(DynamicPropertyRegistry registry) {
        registry.add("janovel.writing.model-endpoint", () -> "http://127.0.0.1:" + MODEL.getAddress().getPort() + "/responses");
        registry.add("OPENAI_API_KEY", () -> "test-key");
        registry.add("OPENAI_WRITING_MODEL", () -> "test-model");
    }

    @AfterAll
    static void stopModel() {
        MODEL.stop(0);
    }

    @Test
    @DisplayName("선택 경험과 이전 대화를 모델에 보내고 새 초안을 반환한다")
    void returnsDraftFromModel() throws Exception {
        mvc.perform(post("/api/me/writing-chat").header(AUTHORIZATION, KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.candidate").value("지원서 초안입니다."));
        assertThat(MODEL_REQUEST.get()).contains("공고와 선택한 경험 원문", "이전 대화", "test-model", "\"store\":false");
    }

    @Test
    @DisplayName("접근 키가 잘못된 요청은 처리하지 않는다")
    void rejectsMalformedKey() throws Exception {
        mvc.perform(post("/api/me/writing-chat").header(AUTHORIZATION, "Bearer invalid")
                        .contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("모델 지시 역할을 대화 이력에 넣을 수 없다")
    void rejectsUnsupportedHistoryRole() throws Exception {
        mvc.perform(post("/api/me/writing-chat").header(AUTHORIZATION, KEY).contentType(MediaType.APPLICATION_JSON)
                        .content(REQUEST.replace("\"assistant\"", "\"developer\"")))
                .andExpect(status().isBadRequest());
    }

    private static HttpServer startModel() {
        try {
            var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/responses", exchange -> {
                try (exchange) {
                    MODEL_REQUEST.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                    byte[] response = """
                            {"status":"completed","output":[{"type":"message","content":[
                              {"type":"output_text","text":"{\\"reply\\":\\"\\",\\"candidate\\":\\"지원서 초안입니다.\\"}"}]}]}
                            """.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, response.length);
                    exchange.getResponseBody().write(response);
                }
            });
            server.start();
            return server;
        } catch (IOException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
