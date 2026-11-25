package com.janovel.domain.application.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.janovel.TestcontainersConfiguration;
import com.janovel.domain.application.client.PostingModelClient;
import com.janovel.domain.application.dto.ImportedPosting;
import com.janovel.domain.application.exception.PostingErrorCode;
import com.janovel.global.exception.CustomException;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class PostingImageImportControllerTests {

    private static final byte[] IMAGE = {1, 2, 3, 4};

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private PostingModelClient model;

    private MvcResult upload(String contentType, byte[] bytes) throws Exception {
        return mvc.perform(multipart("/api/postings/import-image")
                .file(new MockMultipartFile("image", "posting.png", contentType, bytes))).andReturn();
    }

    private String waitForStatus(String location, String expected) throws Exception {
        for (int attempt = 0; attempt < 100; attempt++) {
            String body = mvc.perform(get(location)).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
            if (expected.equals(JsonPath.read(body, "$.status"))) {
                return body;
            }
            Thread.sleep(50);
        }
        throw new AssertionError("작업이 " + expected + " 상태가 되지 않았습니다.");
    }

    @Test
    @DisplayName("이미지를 접수하면 202와 조회 주소를 반환하고 완료되면 구조화한 결과를 돌려준다")
    void acceptsImageAndCompletesJob() throws Exception {
        when(model.classifyImage(any(), eq("image/png"), anyLong())).thenReturn(
                new ImportedPosting("예시 회사", "백엔드", "2026-12-16", "", List.of(), List.of(), List.of(), List.of(), ""));

        var accepted = upload("image/png", IMAGE);

        assertEquals(202, accepted.getResponse().getStatus());
        String location = accepted.getResponse().getHeader("Location");
        assertTrue(location.startsWith("/api/postings/import-jobs/"));
        assertEquals("no-store", accepted.getResponse().getHeader("Cache-Control"));
        String done = waitForStatus(location, "COMPLETED");
        assertEquals("예시 회사", JsonPath.read(done, "$.result.company"));
    }

    @Test
    @DisplayName("모델이 실패하면 작업이 FAILED가 되고 error에 오류 코드를 담는다")
    void reportsFailedJob() throws Exception {
        when(model.classifyImage(any(), eq("image/png"), anyLong()))
                .thenThrow(new CustomException(PostingErrorCode.POSTING_MODEL_FAILED));

        var accepted = upload("image/png", IMAGE);

        String failed = waitForStatus(accepted.getResponse().getHeader("Location"), "FAILED");
        assertEquals("POSTING_MODEL_FAILED", JsonPath.read(failed, "$.error.error"));
    }

    @Test
    @DisplayName("PNG·JPEG·WebP가 아니면 415, 빈 파일이면 400 POSTING_INVALID_IMAGE로 거부한다")
    void rejectsUnsupportedOrEmptyImage() throws Exception {
        mvc.perform(multipart("/api/postings/import-image")
                        .file(new MockMultipartFile("image", "a.txt", "text/plain", IMAGE)))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.error").value("UNSUPPORTED_POSTING_IMAGE"));
        mvc.perform(multipart("/api/postings/import-image")
                        .file(new MockMultipartFile("image", "a.png", "image/png", new byte[0])))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("POSTING_INVALID_IMAGE"));
    }

    @Test
    @DisplayName("image 파트가 없으면 400 INVALID_REQUEST다")
    void rejectsMissingImagePart() throws Exception {
        mvc.perform(multipart("/api/postings/import-image"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
    }

    @Test
    @DisplayName("모델 설정이 없으면 이미지 접수가 503 POSTING_MODEL_UNAVAILABLE이다")
    void rejectsWhenModelIsNotConfigured() throws Exception {
        doThrow(new CustomException(PostingErrorCode.POSTING_MODEL_UNAVAILABLE)).when(model).requireConfigured();

        mvc.perform(multipart("/api/postings/import-image")
                        .file(new MockMultipartFile("image", "a.png", "image/png", IMAGE)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("POSTING_MODEL_UNAVAILABLE"));
    }

    @Test
    @DisplayName("없는 작업 번호를 조회하면 404 POSTING_IMPORT_JOB_NOT_FOUND다")
    void returnsNotFoundForMissingJob() throws Exception {
        mvc.perform(get("/api/postings/import-jobs/00000000-0000-0000-0000-000000000000"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("POSTING_IMPORT_JOB_NOT_FOUND"));
    }
}
