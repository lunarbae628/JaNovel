package com.janovel.domain.application.api;

import com.janovel.domain.application.app.ApplicationService;
import com.janovel.domain.application.dto.ApplicationDetail;
import com.janovel.domain.application.dto.ApplicationRegistration;
import com.janovel.domain.application.dto.ApplicationSummary;
import com.janovel.domain.application.exception.ApplicationErrorCode;
import com.janovel.domain.user.app.PreviewUsers;
import com.janovel.global.exception.CustomException;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/applications")
public class ApplicationController {

    private final ApplicationService applications;
    private final PreviewUsers previewUsers;

    public ApplicationController(ApplicationService applications, PreviewUsers previewUsers) {
        this.applications = applications;
        this.previewUsers = previewUsers;
    }

    @PostMapping
    public ResponseEntity<ApplicationDetail> register(
            @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @Valid @RequestBody ApplicationRegistration request) {
        var detail = applications.register(userId(authorization), request);
        return ResponseEntity.created(URI.create("/api/applications/" + detail.id()))
                .cacheControl(CacheControl.noStore()).body(detail);
    }

    @GetMapping
    public ResponseEntity<List<ApplicationSummary>> list(
            @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(applications.findAllByUser(userId(authorization)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApplicationDetail> find(
            @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable long id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(applications.find(userId(authorization), id));
    }

    private long userId(String authorization) {
        return previewUsers.userId(previewUsers.accessKey(authorization)
                .orElseThrow(() -> new CustomException(ApplicationErrorCode.APPLICATION_UNAUTHORIZED)));
    }
}
