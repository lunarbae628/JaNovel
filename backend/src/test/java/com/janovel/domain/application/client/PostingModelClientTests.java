package com.janovel.domain.application.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.janovel.domain.application.exception.PostingErrorCode;
import com.janovel.global.exception.CustomException;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class PostingModelClientTests {

    private final JsonMapper json = JsonMapper.builder().build();
    private final AtomicReference<JsonNode> request = new AtomicReference<>();
    private HttpServer server;
    private String response;

    @BeforeEach
    void startModelStub() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/responses", exchange -> {
            try (exchange) {
                request.set(json.readTree(exchange.getRequestBody()));
                byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, bytes.length);
                exchange.getResponseBody().write(bytes);
            }
        });
        server.start();
    }

    @AfterEach
    void stopModelStub() {
        server.stop(0);
    }

    @Test
    @DisplayName("설정한 mini 모델에 링크 본문과 엄격한 스키마를 보낸다")
    void classifiesCollectedText() {
        response = modelResult("""
                {"company":"예시 회사","role":"개발자","deadline":"2027-03-30","deadlineTime":"18:00",
                 "sections":[{"title":"지원 요건","body":"경력 3년"}],
                 "stages":["서류전형","면접","최종합격"],"questions":[]}
                """);
        String text = "자격요건 경력 3년\n채용 문의 jobs@example.com";

        var result = client("gpt-5.4-mini-2026-03-17").classifyText(text, deadline());

        assertEquals(text, result.sourceText());
        assertEquals("경력 3년", result.sections().getFirst().body());
        assertEquals("면접", result.stages().get(1));
        assertEquals("gpt-5.4-mini-2026-03-17", request.get().path("model").asString());
        assertTrue(request.get().at("/text/format/strict").asBoolean());
        assertFalse(request.get().has("tools"));
        assertTrue(request.get().at("/input/0/content/0/text").asString().contains(text));
    }

    @Test
    @DisplayName("모델 설정이 비어 있으면 Luna에 이미지를 보내고 잘못된 날짜와 전형을 걸러낸다")
    void classifiesImage() {
        response = modelResult("""
                {"company":"예시 회사","role":"개발자","deadline":"2027-02-30","deadlineTime":"18:00",
                 "sections":[],"stages":["01","jobs@example.com","면접"],"questions":[]}
                """);

        var result = client("").classifyImage(new byte[]{1, 2}, "image/png", deadline());

        assertEquals("", result.sourceText());
        assertEquals("", result.deadline());
        assertEquals("", result.deadlineTime());
        assertEquals(java.util.List.of("면접"), result.stages());
        assertEquals("gpt-6-luna", request.get().path("model").asString());
        assertEquals("data:image/png;base64,AQI=", request.get().at("/input/0/content/0/image_url").asString());
    }

    @Test
    @DisplayName("모델이 응답을 끝내지 못하면 불완전한 결과를 쓰지 않는다")
    void rejectsIncompleteResult() {
        response = "{\"status\":\"incomplete\",\"output\":[]}";

        var failure = assertThrows(CustomException.class, () -> client("").classifyText("공고", deadline()));

        assertEquals(PostingErrorCode.POSTING_MODEL_FAILED, failure.getErrorCode());
    }

    private PostingModelClient client(String model) {
        return new PostingModelClient(json, URI.create("http://127.0.0.1:" + server.getAddress().getPort()
                + "/v1/responses"), "test-secret", model);
    }

    private long deadline() {
        return System.nanoTime() + Duration.ofSeconds(5).toNanos();
    }

    private String modelResult(String content) {
        return json.writeValueAsString(Map.of("status", "completed", "output", java.util.List.of(
                Map.of("type", "message", "content", java.util.List.of(Map.of("type", "output_text", "text", content))))));
    }
}
