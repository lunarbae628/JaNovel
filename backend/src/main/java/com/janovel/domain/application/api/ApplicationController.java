package com.janovel.domain.application.api;

import com.janovel.domain.application.app.ApplicationService;
import com.janovel.domain.application.dto.ApplicationDetail;
import com.janovel.domain.application.dto.ApplicationProgress;
import com.janovel.domain.application.dto.ApplicationRegistration;
import com.janovel.domain.application.dto.ApplicationSummary;
import com.janovel.domain.application.dto.ApplicationUpdate;
import com.janovel.domain.application.dto.SectionsReplacement;
import com.janovel.domain.application.dto.StagesUpdate;
import com.janovel.domain.user.app.PreviewUsers;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "지원 건", description = "회사·직무·마감·공고 원문·항목·전형·자소서 문항을 저장·조회·수정·삭제한다. 다른 사용자의 지원 건은 없는 지원 건과 같은 `404`로 응답한다.")
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

    @Operation(summary = "지원 건 기본 정보 수정",
            description = "회사, 직무, 마감, 공고 주소·원문을 보낸 값으로 바꾼다. 생략하거나 `null`인 마감·주소·원문은 지운다. 항목·전형·문항은 각자의 API로 고친다.")
    @ApiResponse(responseCode = "200", description = "수정한 지원 건 상세")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: 필수값 누락, 길이·형식·마감 조합 오류")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`APPLICATION_NOT_FOUND`: 없거나 내 것이 아닌 지원 건")
    @PutMapping("/{id}")
    public ResponseEntity<ApplicationDetail> update(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable long id, @Valid @RequestBody ApplicationUpdate request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(applications.update(userId(authorization), id, request));
    }

    @Operation(summary = "지원 상태와 현재 전형 변경",
            description = "상태와 현재 전형을 함께 바꾼다. 전형 순서로 상태를 추측하지 않는다. `closed`로 바꾸면 그때의 현재 전형 이름을 `outcomeStageName`에 남기고, 다른 상태로 바꾸면 지운다.")
    @ApiResponse(responseCode = "200", description = "변경한 지원 건 상세")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: 상태 누락·오류. `STAGE_MISMATCH`: 이 지원 건의 전형이 아니다")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`APPLICATION_NOT_FOUND`: 없거나 내 것이 아닌 지원 건")
    @PutMapping("/{id}/progress")
    public ResponseEntity<ApplicationDetail> changeProgress(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable long id, @Valid @RequestBody ApplicationProgress request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(applications.changeProgress(userId(authorization), id, request));
    }

    @Operation(summary = "공고 항목 교체", description = "공고 항목을 보낸 목록으로 통째 바꾼다. 항목 번호는 새로 매겨진다.")
    @ApiResponse(responseCode = "200", description = "새 공고 항목. 보낸 순서")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: 항목 제목 누락, 길이·개수 오류")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`APPLICATION_NOT_FOUND`: 없거나 내 것이 아닌 지원 건")
    @PutMapping("/{id}/sections")
    public ResponseEntity<List<ApplicationDetail.Section>> replaceSections(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable long id, @Valid @RequestBody SectionsReplacement request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(applications.replaceSections(userId(authorization), id, request.sections()));
    }

    @Operation(summary = "채용 전형 수정",
            description = "보낸 목록이 새 전형 목록이 된다. 번호가 있는 전형은 이름과 순서를 바꾸고, 번호가 없으면 새로 만들며, 빠진 전형은 지운다. 현재 전형을 지우면 현재 전형 선택이 비워진다.")
    @ApiResponse(responseCode = "200", description = "새 전형 목록. 보낸 순서")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: 이름 누락, 길이·개수 오류. `STAGE_MISMATCH`: 모르는 번호나 겹치는 번호")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`APPLICATION_NOT_FOUND`: 없거나 내 것이 아닌 지원 건")
    @PutMapping("/{id}/stages")
    public ResponseEntity<List<ApplicationDetail.Stage>> updateStages(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable long id, @Valid @RequestBody StagesUpdate request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(applications.updateStages(userId(authorization), id, request.stages()));
    }

    @Operation(summary = "지원 건 삭제", description = "지원 건과 항목·전형·문항·작성본·제출 답안을 모두 지운다. 되돌릴 수 없다.")
    @ApiResponse(responseCode = "204", description = "삭제했다.")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`APPLICATION_NOT_FOUND`: 없거나 내 것이 아닌 지원 건")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable long id) {
        applications.delete(userId(authorization), id);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    private long userId(String authorization) {
        return previewUsers.requireUserId(authorization);
    }
}
