package com.janovel.domain.application.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.janovel.TestcontainersConfiguration;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class SharedPostingQuestionsControllerTests {

    private static final String BASE = "/api/postings/shared-questions";

    @Autowired
    private MockMvc mvc;

    private ResultActions send(String path, String body) throws Exception {
        return mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    @DisplayName("처음 등록한 문항 세트는 보존되고 다음 사용자가 같은 공고·직무로 조회하며 정정 제보를 남긴다")
    void sharesFirstQuestionSetAndAcceptsReports() throws Exception {
        String url = "https://careers.example.com/jobs/" + UUID.randomUUID();

        send(BASE + "/lookup", "{\"url\":\"" + url + "\",\"role\":\"Backend\"}").andExpect(status().isNoContent());
        send(BASE, "{\"url\":\"" + url + "\",\"role\":\"Backend\",\"questions\":["
                + "{\"prompt\":\"지원 동기를 알려 주세요.\",\"limit\":null},{\"prompt\":\"협업 경험을 알려 주세요.\",\"limit\":800}]}")
                .andExpect(status().isCreated());
        send(BASE, "{\"url\":\"" + url + "\",\"role\":\"Backend\",\"questions\":[{\"prompt\":\"다른 문항\",\"limit\":500}]}")
                .andExpect(status().isNoContent());

        var found = send(BASE + "/lookup", "{\"url\":\"" + url + "?utm_source=newsletter\",\"role\":\"backend\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions[0].prompt").value("지원 동기를 알려 주세요."))
                .andExpect(jsonPath("$.questions[1].limit").value(800))
                .andReturn();
        String setId = JsonPath.read(found.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id");

        send(BASE + "/lookup", "{\"url\":\"" + url + "\",\"role\":\"Frontend\"}").andExpect(status().isNoContent());
        send(BASE + "/" + setId + "/reports",
                "{\"questions\":[{\"prompt\":\"지원 동기와 입사 후 목표를 알려 주세요.\",\"limit\":700}]}")
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("존재하지 않는 문항 세트에 제보하면 404 POSTING_QUESTIONS_NOT_FOUND다")
    void rejectsReportForMissingSet() throws Exception {
        send(BASE + "/00000000-0000-0000-0000-000000000000/reports", "{}")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("POSTING_QUESTIONS_NOT_FOUND"));
    }

    @Test
    @DisplayName("상세 공고 주소가 아니면 400 INVALID_POSTING_URL이다")
    void rejectsNonDetailUrl() throws Exception {
        send(BASE + "/lookup", "{\"url\":\"https://careers.example.com/\",\"role\":\"Backend\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_POSTING_URL"));
    }

    @Test
    @DisplayName("공백뿐인 문항은 저장할 수 없고 400 INVALID_REQUEST다")
    void rejectsBlankQuestion() throws Exception {
        send(BASE, "{\"url\":\"https://careers.example.com/jobs/1\",\"role\":\"Backend\",\"questions\":[{\"prompt\":\" \",\"limit\":800}]}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
    }
}
