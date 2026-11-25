package com.janovel.domain.writing.api;

import com.janovel.domain.user.app.PreviewUsers;
import com.janovel.domain.writing.app.EssayTemplateService;
import com.janovel.domain.writing.dto.EssayTemplate;
import com.janovel.global.exception.ErrorResponse;
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

    @GetMapping
    public ResponseEntity<EssayTemplate> find(@RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false)
                                              String authorization) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(templates.find(accessKey(authorization)));
    }

    @PutMapping
    public ResponseEntity<Void> replace(@RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false)
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
