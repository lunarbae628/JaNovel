package com.janovel.domain.writing.api;

import com.janovel.domain.user.app.PreviewUsers;
import com.janovel.domain.writing.app.EssayTemplateService;
import com.janovel.domain.writing.dto.EssayTemplate;
import com.janovel.global.exception.ErrorResponse;
import com.janovel.global.openapi.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "내 공통 자소서", description = "자주 쓰는 문항과 답변 초안을 하나의 세트로 저장한다. 접근 키로 소유자를 찾으며 `local` 프로필에서만 켜진다.")
@SecurityRequirement(name = OpenApiConfig.PREVIEW_KEY)
@Profile("local")
@RestController
@RequestMapping("/api/me/essay-template")
public class EssayTemplateController {

    private final EssayTemplateService templates;
    private final PreviewUsers previewUsers;

    public EssayTemplateController(EssayTemplateService templates, PreviewUsers previewUsers) {
        this.templates = templates;
        this.previewUsers = previewUsers;
    }

    @Operation(summary = "공통 자소서 조회", description = "저장한 내용이 없으면 빈 배열을 반환한다.")
    @ApiResponse(responseCode = "200", description = "저장한 공통 자소서")
    @ApiResponse(responseCode = "401", description = "`ESSAY_TEMPLATE_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류",
            headers = @Header(name = "WWW-Authenticate", description = "`Bearer`"))
    @GetMapping
    public ResponseEntity<EssayTemplate> find(@Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false)
                                              String authorization) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(templates.find(accessKey(authorization)));
    }

    @Operation(summary = "공통 자소서 저장", description = "세트 전체를 저장한 순서대로 교체한다. 빈 배열은 현재 세트를 비운다.")
    @ApiResponse(responseCode = "204", description = "저장했다.")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: 배열 또는 항목 형식이나 길이 범위 오류")
    @ApiResponse(responseCode = "401", description = "`ESSAY_TEMPLATE_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류",
            headers = @Header(name = "WWW-Authenticate", description = "`Bearer`"))
    @PutMapping
    public ResponseEntity<Void> replace(@Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false)
                                        String authorization, @Valid @RequestBody EssayTemplate request) {
        templates.replace(accessKey(authorization), request.items());
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(InvalidAccessKeyException.class)
    ResponseEntity<ErrorResponse> handleInvalidAccessKey() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .header(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
                .cacheControl(CacheControl.noStore())
                .body(new ErrorResponse(HttpStatus.UNAUTHORIZED.value(),
                        "공통 자소서 접근 키를 확인해 주세요.", "ESSAY_TEMPLATE_UNAUTHORIZED"));
    }

    private String accessKey(String authorization) {
        return previewUsers.accessKey(authorization).orElseThrow(InvalidAccessKeyException::new);
    }

    private static class InvalidAccessKeyException extends RuntimeException {
    }
}
