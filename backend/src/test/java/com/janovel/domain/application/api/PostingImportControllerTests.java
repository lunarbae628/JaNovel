package com.janovel.domain.application.api;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.janovel.domain.application.app.PostingImportService;
import com.janovel.domain.application.app.PostingImportJobs;
import com.janovel.domain.application.client.PostingBrowserClient;
import com.janovel.domain.application.client.PostingOcrClient;
import com.janovel.domain.application.client.PostingPageClient;
import com.janovel.global.exception.GlobalExceptionHandler;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;

class PostingImportControllerTests {

    @Test
    @DisplayName("공개 공고의 회사, 직무와 읽을 수 있는 본문을 확인 화면에 반환한다")
    void importsJobPosting() throws Exception {
        String url = "https://careers.example.com/jobs/1";
        var client = mock(PostingPageClient.class);
        when(client.fetch(url)).thenReturn(Jsoup.parse("""
                <script type="application/ld+json">
                {"@graph":[{"@type":"JobPosting","title":"백엔드 개발자","hiringOrganization":{"name":"예시 회사"},
                "description":"<h2>주요 업무</h2><p>API를 개발합니다.</p>","validThrough":"2027-03-30T18:00:00+09:00"}]}
                </script>
                <main><h2>주요 업무</h2><p>API를 개발합니다.</p><h2>지원 요건</h2><p>Spring 개발 경험</p></main>
                """));

        mvc(client).perform(post("/api/postings/import")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"url\":\"" + url + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.company").value("예시 회사"))
                .andExpect(jsonPath("$.role").value("백엔드 개발자"))
                .andExpect(jsonPath("$.deadline").value("2027-03-30"))
                .andExpect(jsonPath("$.sourceText").value("주요 업무\nAPI를 개발합니다.\n지원 요건\nSpring 개발 경험"));
    }

    @Test
    @DisplayName("서버 내부 주소는 공고 가져오기 요청으로 받을 수 없다")
    void rejectsLocalUrl() throws Exception {
        try (var client = new PostingPageClient()) {
            mvc(client).perform(post("/api/postings/import")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"url\":\"http://127.0.0.1/internal\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("INVALID_POSTING_URL"));
        }
    }

    private MockMvc mvc(PostingPageClient client) {
        return MockMvcBuilders
                .standaloneSetup(new PostingImportController(new PostingImportService(client,
                        mock(PostingBrowserClient.class), mock(PostingOcrClient.class), JsonMapper.builder().build()),
                        mock(PostingImportJobs.class)))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }
}
