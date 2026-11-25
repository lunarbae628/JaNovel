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

class 옴PostingModelClientTests {

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
                {"company":"예시 회사","deadline":"2027-03-30","deadlineTime":"18:00",
                 "sections":[],"stages":["서류전형","면접","최종합격"],"questions":[],
                 "positions":[{"role":"개발자","deadline":"","deadlineTime":"",
                   "sections":[{"title":"지원 요건","body":"경력 3년"}],"stages":[],"questions":[]}]}
                """);
        String text = "자격요건 경력 3년\n채용 문의 jobs@example.com";

        var result = client("gpt-5.4-mini-2026-03-17").classifyText(text, deadline());

        assertEquals(text, result.sourceText());
        assertEquals("개발자", result.role());
        assertEquals("경력 3년", result.sections().getFirst().body());
        assertEquals("면접", result.stages().get(1));
        assertTrue(result.positions().isEmpty());
        assertEquals("gpt-5.4-mini-2026-03-17", request.get().path("model").asString());
        assertTrue(request.get().at("/text/format/strict").asBoolean());
        assertFalse(request.get().has("tools"));
        assertTrue(request.get().at("/input/0/content/0/text").asString().contains(text));
    }

    @Test
    @DisplayName("모델 설정이 비어 있으면 GPT-5.4 mini에 이미지를 보내고 잘못된 날짜와 전형을 걸러낸다")
    void classifiesImage() {
        response = modelResult("""
                {"company":"예시 회사","deadline":"2027-02-30","deadlineTime":"18:00",
                 "sections":[],"stages":["01","jobs@example.com","면접"],"questions":[],"positions":[]}
                """);

        var result = client("").classifyImage(new byte[]{1, 2}, "image/png", deadline());

        assertEquals("", result.sourceText());
        assertEquals("", result.deadline());
        assertEquals("", result.deadlineTime());
        assertEquals(java.util.List.of("면접"), result.stages());
        assertEquals("gpt-5.4-mini-2026-03-17", request.get().path("model").asString());
        assertEquals("data:image/png;base64,AQI=", request.get().at("/input/0/content/0/image_url").asString());
    }

    @Test
    @DisplayName("모델이 같은 직무를 반복해도 각 항목을 보존하고 공통 문항은 한 번만 반환한다")
    void mergesRepeatedPositionsAndQuestions() {
        response = modelResult("""
                {"company":"예시 회사","deadline":"","deadlineTime":"",
                 "sections":[],"stages":["서류전형"],
                 "questions":[{"prompt":"기술 선택을 설명해 주세요.","limit":null}],
                 "positions":[
                   {"role":"개발자","deadline":"","deadlineTime":"",
                    "sections":[{"title":"주요 업무","body":"API 개발"}],"stages":[],
                    "questions":[{"prompt":"기술  선택을 설명해 주세요.","limit":500}]},
                   {"role":"개발자","deadline":"","deadlineTime":"",
                    "sections":[{"title":"지원 요건","body":"Java 경험"}],"stages":[],"questions":[]}]}
                """);

        var result = client("").classifyText("공고", deadline());

        assertEquals("개발자", result.role());
        assertEquals(java.util.List.of("API 개발", "Java 경험"),
                result.sections().stream().map(section -> section.body()).toList());
        assertEquals(1, result.questions().size());
        assertEquals(500, result.questions().getFirst().limit());
        assertEquals(java.util.List.of("서류전형"), result.stages());
    }

    @Test
    @DisplayName("한 이미지 공고에서 공통 요건과 각 모집 직무의 요건을 구분한다")
    void keepsSeparatePositionsAcrossScreenshots() {
        response = modelResult("""
                {"company":"예시 회사","deadline":"","deadlineTime":"",
                 "sections":[{"title":"공통 요건","body":"대학 졸업"}],"stages":[],"questions":[],
                 "positions":[
                   {"role":"본사 기술 - 품질기술","deadline":"","deadlineTime":"",
                    "sections":[{"title":"지원 요건","body":"건축 관련 전공"}],"stages":[],"questions":[]},
                   {"role":"현장 기술 - 전기","deadline":"","deadlineTime":"",
                    "sections":[{"title":"지원 요건","body":"전기기사"}],"stages":[],"questions":[]}]}
                """);

        var result = client("").classifyScreenshots(java.util.List.of(new byte[]{1}, new byte[]{2}),
                "회사명: 예시 회사", deadline());

        assertEquals("대학 졸업", result.sections().getFirst().body());
        assertEquals("전기기사", result.positions().get(1).sections().getFirst().body());
        assertEquals(3, request.get().at("/input/0/content").size());
        assertEquals("회사명: 예시 회사", request.get().at("/input/0/content/0/text").asString());
        assertEquals("input_image", request.get().at("/input/0/content/1/type").asString());
        assertEquals("", result.sourceText());
        assertFalse(request.get().at("/text/format/schema/properties").has("role"));
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
