package com.janovel.global.openapi;

import com.janovel.global.exception.ErrorResponse;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.models.SpecVersion;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import java.util.Set;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(info = @Info(title = "JaNovel API",
        description = "공고 가져오기, 지원 건, 자소서 문항 공유와 공통 자소서 API. 서버 인증 연결 전에는 미리보기 접근 키로 사용자를 구분한다."))
@SecurityScheme(name = OpenApiConfig.PREVIEW_KEY, type = SecuritySchemeType.HTTP, scheme = "bearer",
        description = "미리보기 프로필의 접근 키. 소문자 16진수 64자이며 `Authorization: Bearer <키>`로 보낸다.")
public class OpenApiConfig {

    public static final String PREVIEW_KEY = "previewKey";

    @Bean
    OpenApiCustomizer errorResponseSchema() {
        return openApi -> {
            if (openApi.getComponents().getSchemas() == null
                    || !openApi.getComponents().getSchemas().containsKey("ErrorResponse")) {
                ModelConverters.getInstance().readAll(ErrorResponse.class).forEach(openApi.getComponents()::addSchemas);
            }
            if (openApi.getSpecVersion() == SpecVersion.V31) {
                allowNullSubmission(openApi.getComponents().getSchemas().get("WritingHistoryDetail"));
            }
            openApi.getPaths().values().forEach(path -> path.readOperations().forEach(operation ->
                    operation.getResponses().forEach((code, response) -> {
                        if ((code.startsWith("4") || code.startsWith("5")) && !hasDraftConflictSchema(response.getContent())) {
                            response.setContent(new Content().addMediaType("application/json",
                                    new MediaType().schema(new Schema<>().$ref("#/components/schemas/ErrorResponse"))));
                        }
                    })));
        };
    }

    private static void allowNullSubmission(Schema<?> history) {
        if (history == null) {
            return;
        }
        Schema<?> submission = history.getProperties().get("submission");
        // OpenAPI 3.1에서는 $ref와 type이 나란히 있으면 두 조건을 모두 만족해야 한다.
        submission.addAnyOfItem(new Schema<>().$ref(submission.get$ref()));
        var empty = new Schema<>();
        empty.setTypes(Set.of("null"));
        submission.addAnyOfItem(empty);
        submission.set$ref(null);
        submission.setTypes(null);
    }

    private static boolean hasDraftConflictSchema(Content content) {
        if (content == null || content.get("application/json") == null) {
            return false;
        }
        Schema<?> schema = content.get("application/json").getSchema();
        return schema != null && (isDraftConflictSchema(schema)
                || (schema.getAnyOf() != null && schema.getAnyOf().stream().anyMatch(OpenApiConfig::isDraftConflictSchema)));
    }

    private static boolean isDraftConflictSchema(Schema<?> schema) {
        return "#/components/schemas/DraftConflictResponse".equals(schema.get$ref());
    }
}
