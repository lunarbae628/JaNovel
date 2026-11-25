package com.janovel.domain.application.app;

import static com.janovel.domain.application.exception.PostingErrorCode.INVALID_POSTING_URL;

import com.janovel.domain.application.client.PostingPageClient;
import com.janovel.domain.application.dto.ImportedPosting.Question;
import com.janovel.global.exception.CustomException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Service
public class SharedPostingQuestions {

    private static final TypeReference<List<Question>> QUESTIONS = new TypeReference<>() {};
    private static final List<String> SARAMIN_VIEW_PATHS = List.of("/zf_user/jobs/relay/view", "/zf_user/jobs/view");
    private static final Set<String> AD_CLICK_PARAMS = Set.of("gclid", "fbclid", "msclkid");

    private final JdbcClient jdbc;
    private final JsonMapper json;

    public SharedPostingQuestions(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public Optional<QuestionSet> find(String url, String role) {
        return jdbc.sql("""
                SELECT id, questions FROM shared_posting_question_sets
                WHERE posting_key = :postingKey AND role_key = :roleKey
                """)
                .param("postingKey", fingerprint(normalizeUrl(url)))
                .param("roleKey", normalizeRole(role))
                .query((row, index) -> new QuestionSet(row.getObject("id", UUID.class),
                        json.readValue(row.getString("questions"), QUESTIONS)))
                .optional();
    }

    public boolean saveFirst(String url, String role, List<Question> questions) {
        String postingUrl = normalizeUrl(url);
        return jdbc.sql("""
                INSERT INTO shared_posting_question_sets (id, posting_key, posting_url, role_key, questions)
                VALUES (:id, :postingKey, :postingUrl, :roleKey, CAST(:questions AS jsonb))
                ON CONFLICT (posting_key, role_key) DO NOTHING
                """)
                .param("id", UUID.randomUUID())
                .param("postingKey", fingerprint(postingUrl))
                .param("postingUrl", postingUrl)
                .param("roleKey", normalizeRole(role))
                .param("questions", json.writeValueAsString(questions))
                .update() == 1;
    }

    public boolean report(UUID questionSetId, List<Question> proposedQuestions) {
        return jdbc.sql("""
                INSERT INTO shared_posting_question_reports (question_set_id, proposed_questions)
                SELECT id, CAST(:questions AS jsonb) FROM shared_posting_question_sets WHERE id = :id
                """)
                .param("id", questionSetId)
                .param("questions", json.writeValueAsString(proposedQuestions))
                .update() == 1;
    }

    private String normalizeUrl(String value) {
        URI url;
        try {
            url = URI.create(value.strip());
            PostingPageClient.validate(url);
        } catch (IllegalArgumentException exception) {
            throw new CustomException(INVALID_POSTING_URL, exception);
        }

        String host = url.getHost().toLowerCase(Locale.ROOT).replaceFirst("\\.$", "");
        String rawPath = url.getRawPath().isEmpty() ? "/" : url.getRawPath();
        boolean saramin = host.equals("www.saramin.co.kr") && SARAMIN_VIEW_PATHS.contains(rawPath);
        String path = saramin ? SARAMIN_VIEW_PATHS.get(0) : rawPath;
        String query = url.getRawQuery() == null ? "" : Arrays.stream(url.getRawQuery().split("&"))
                .filter(parameter -> !parameter.isEmpty() && !isTrackingParameter(host, path, saramin, parameter))
                .collect(Collectors.joining("&"));
        String fragment = url.getRawFragment();
        if (saramin && fragment != null && fragment.matches("seq=\\d+")) {
            fragment = null;
        }
        if (path.equals("/") && query.isEmpty() && (fragment == null || fragment.isEmpty())) {
            throw new CustomException(INVALID_POSTING_URL);
        }
        return url.getScheme().toLowerCase(Locale.ROOT) + "://" + host + path
                + (query.isEmpty() ? "" : "?" + query)
                + (fragment == null || fragment.isEmpty() ? "" : "#" + fragment);
    }

    private boolean isTrackingParameter(String host, String path, boolean saramin, String parameter) {
        String key = parameter.split("=", 2)[0].toLowerCase(Locale.ROOT);
        if (key.startsWith("utm_") || AD_CLICK_PARAMS.contains(key)) {
            return true;
        }
        if (saramin) {
            return !key.equals("rec_idx");
        }
        if (host.equals("www.jobkorea.co.kr") && path.matches("/Recruit/GI_Read/\\d+")) {
            return Set.of("oem_code", "logpath", "stext", "listno", "sc").contains(key);
        }
        return false;
    }

    private String normalizeRole(String role) {
        return Normalizer.normalize(role, Normalizer.Form.NFC).strip()
                .replaceAll("(?U)\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private String fingerprint(String url) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(url.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public record QuestionSet(UUID id, List<Question> questions) {
    }
}
