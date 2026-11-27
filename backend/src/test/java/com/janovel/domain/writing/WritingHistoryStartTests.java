package com.janovel.domain.writing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.janovel.TestcontainersConfiguration;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class WritingHistoryStartTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcClient jdbc;

    @Autowired
    private EntityManager entityManager;

    private static String newKey() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return "Bearer " + HexFormat.of().formatHex(bytes);
    }

    private List<Map<String, Object>> histories(long applicationId) {
        entityManager.flush();
        return jdbc.sql("""
                SELECT q.id AS question_id, q.active_version_id, v.id AS version_id, v.name, v.position,
                       v.draft_body, v.draft_revision, v.base_snapshot_id, v.from_snapshot_id
                FROM essay_questions q JOIN writing_versions v ON v.question_id = q.id
                WHERE q.application_id = ? ORDER BY q.position, v.position
                """).param(applicationId).query().listOfRows();
    }

    @Test
    @DisplayName("지원 건 등록과 문항 추가로 만든 문항마다 빈 기본 버전이 하나 생기고 현재 버전으로 지정된다")
    void startsDefaultVersionForEveryNewQuestion() throws Exception {
        var key = newKey();
        var result = mvc.perform(post("/api/applications").header(AUTHORIZATION, key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"company\":\"예시 회사\",\"role\":\"백엔드\",\"questions\":[{\"prompt\":\"지원 동기\"},{\"prompt\":\"협업 경험\"}]}"))
                .andExpect(status().isCreated()).andReturn();
        long applicationId = ((Number) JsonPath.read(result.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id")).longValue();
        mvc.perform(post("/api/applications/" + applicationId + "/questions").header(AUTHORIZATION, key)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"prompt\":\"입사 후 포부\"}"))
                .andExpect(status().isCreated());

        var rows = histories(applicationId);
        assertEquals(3, rows.size());
        for (var row : rows) {
            assertEquals(row.get("version_id"), row.get("active_version_id"));
            assertEquals("기본", row.get("name"));
            assertEquals(1, row.get("position"));
            assertEquals("", row.get("draft_body"));
            assertEquals(0L, row.get("draft_revision"));
            assertEquals(null, row.get("base_snapshot_id"));
            assertEquals(null, row.get("from_snapshot_id"));
        }
    }

    @Test
    @DisplayName("문항이 없는 지원 건은 버전을 만들지 않는다")
    void startsNothingWithoutQuestions() throws Exception {
        var result = mvc.perform(post("/api/applications").header(AUTHORIZATION, newKey())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"company\":\"예시 회사\",\"role\":\"백엔드\"}"))
                .andExpect(status().isCreated()).andReturn();
        long applicationId = ((Number) JsonPath.read(result.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id")).longValue();

        assertEquals(List.of(), histories(applicationId));
    }
}
