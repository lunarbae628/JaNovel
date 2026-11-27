package com.janovel.global.web;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.janovel.TestcontainersConfiguration;
import com.janovel.global.exception.GlobalExceptionHandler;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.http.MockHttpInputMessage;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class RequestSizeLimitFilterTests {

    private static final int LIMIT = (int) RequestSizeLimitFilter.MAX_BODY_BYTES;
    private static final String KEY = "Bearer " + "a".repeat(64);

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JsonMapper json;

    @Test
    @DisplayName("2MB를 넘는 JSON 본문은 접근 키 검사와 파싱 전에 413 REQUEST_TOO_LARGE로 거절한다")
    void rejectsOversizedJsonBeforeAuthentication() throws Exception {
        byte[] body = new byte[LIMIT + 1];
        Arrays.fill(body, (byte) ' ');

        mvc.perform(put("/api/versions/1/draft").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isContentTooLarge())
                .andExpect(jsonPath("$.error").value("REQUEST_TOO_LARGE"));
    }

    @Test
    @DisplayName("2MB 이하 본문은 그대로 처리해 평소처럼 필드 검사 결과를 받는다")
    void passesBodiesWithinLimit() throws Exception {
        String company = "가".repeat((LIMIT - 100) / 3);
        byte[] body = ("{\"company\":\"" + company + "\",\"role\":\"백엔드\"}").getBytes(StandardCharsets.UTF_8);

        mvc.perform(post("/api/applications").header(AUTHORIZATION, KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
    }

    @Test
    @DisplayName("파일 업로드는 이 제한을 받지 않고 업로드 자체 제한을 따른다")
    void leavesMultipartToUploadLimit() throws Exception {
        var image = new MockMultipartFile("image", "posting.png", "image/png", new byte[LIMIT + 1]);

        var result = mvc.perform(multipart("/api/postings/import-image").file(image)).andReturn();

        assertNotEquals(413, result.getResponse().getStatus());
    }

    @Test
    @DisplayName("길이를 알리지 않은 본문도 읽는 도중 2MB를 넘으면 멈추고 그 오류는 413으로 응답한다")
    void stopsStreamedBodyAtLimit() throws Exception {
        var filter = new RequestSizeLimitFilter(json);
        var within = new byte[LIMIT];
        filter.doFilter(streamed(within), new MockHttpServletResponse(),
                (request, response) -> assertArrayEquals(within, request.getInputStream().readAllBytes()));

        assertThrows(RequestBodyTooLargeException.class, () -> filter.doFilter(streamed(new byte[LIMIT + 1]),
                new MockHttpServletResponse(), (request, response) -> request.getInputStream().readAllBytes()));

        var unreadable = new HttpMessageNotReadableException("too large", new RequestBodyTooLargeException(),
                new MockHttpInputMessage(new byte[0]));
        var response = new GlobalExceptionHandler().handleUnreadable(unreadable);
        assertEquals(413, response.getStatusCode().value());
        assertEquals("REQUEST_TOO_LARGE", response.getBody().error());
    }

    private static MockHttpServletRequest streamed(byte[] body) {
        var request = new MockHttpServletRequest("PUT", "/api/versions/1/draft") {
            @Override
            public long getContentLengthLong() {
                return -1;
            }

            @Override
            public int getContentLength() {
                return -1;
            }
        };
        request.setContentType(MediaType.APPLICATION_JSON_VALUE);
        request.setContent(body);
        return request;
    }
}
