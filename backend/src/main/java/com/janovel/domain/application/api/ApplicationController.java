package com.janovel.domain.application.api;

import com.janovel.domain.application.app.ApplicationService;
import com.janovel.domain.application.dto.ApplicationDetail;
import com.janovel.domain.application.dto.ApplicationRegistration;
import com.janovel.domain.application.dto.ApplicationSummary;
import com.janovel.domain.application.exception.ApplicationErrorCode;
import com.janovel.domain.user.app.PreviewUsers;
import com.janovel.global.exception.CustomException;
import com.janovel.global.openapi.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
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

@Tag(name = "지원 건", description = "회사·직무·마감·공고 원문·항목·전형·자소서 문항을 저장하고 조회한다. 다른 사용자의 지원 건은 없는 지원 건과 같은 `404`로 응답한다.")
@SecurityRequirement(name = OpenApiConfig.PREVIEW_KEY)
@RestController
@RequestMapping("/api/applications")
public class ApplicationController {

    private final ApplicationService applications;
    private final PreviewUsers previewUsers;

    public ApplicationController(ApplicationService applications, PreviewUsers previewUsers) {
        this.applications = applications;
        this.previewUsers = previewUsers;
    }

    @Operation(summary = "지원 건 등록",
            description = "마감, 원문, 공고 항목, 전형, 자소서 문항을 한 번에 등록한다. 항목·전형·문항은 보낸 순서대로 저장하고 새 지원 건의 상태는 `interested`다.")
    @ApiResponse(responseCode = "201", description = "등록했다. `Location`에 상세 주소가 있다.")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: 필수값 누락, 길이·형식·마감 조합 오류")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @PostMapping
    public ResponseEntity<ApplicationDetail> register(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @Valid @RequestBody ApplicationRegistration request) {
        var detail = applications.register(userId(authorization), request);
        return ResponseEntity.created(URI.create("/api/applications/" + detail.id()))
                .cacheControl(CacheControl.noStore()).body(detail);
    }

    @Operation(summary = "지원 건 목록", description = "내 지원 건을 최근에 등록한 순서로 반환한다.")
    @ApiResponse(responseCode = "200", description = "지원 건 목록. 없으면 빈 배열")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @GetMapping
    public ResponseEntity<List<ApplicationSummary>> list(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(applications.findAllByUser(userId(authorization)));
    }

    @Operation(summary = "지원 건 상세", description = "공고 항목, 전형, 자소서 문항을 등록한 순서대로 함께 반환한다.")
    @ApiResponse(responseCode = "200", description = "지원 건 상세")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`APPLICATION_NOT_FOUND`: 없거나 내 것이 아닌 지원 건")
    @GetMapping("/{id}")
    public ResponseEntity<ApplicationDetail> find(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable long id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(applications.find(userId(authorization), id));
    }

    private long userId(String authorization) {
        return previewUsers.userId(previewUsers.accessKey(authorization)
                .orElseThrow(() -> new CustomException(ApplicationErrorCode.APPLICATION_UNAUTHORIZED)));
    }
}
