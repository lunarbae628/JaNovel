package com.janovel.domain.writing.api;

import com.janovel.domain.user.app.PreviewUsers;
import com.janovel.domain.writing.app.WritingHistory;
import com.janovel.domain.writing.dto.DraftConflictResponse;
import com.janovel.domain.writing.dto.DraftWrite;
import com.janovel.domain.writing.dto.SnapshotCreate;
import com.janovel.domain.writing.dto.SnapshotUpdate;
import com.janovel.domain.writing.dto.VersionCreate;
import com.janovel.domain.writing.dto.VersionUpdate;
import com.janovel.domain.writing.dto.WritingHistoryDetail;
import com.janovel.domain.writing.exception.DraftConflictException;
import com.janovel.global.exception.ErrorResponse;
import com.janovel.global.openapi.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "자소서 작성 이력", description = "버전별 초안을 저장하고 원하는 시점에 스냅샷을 남긴다. 버전을 만들거나 지우고 스냅샷을 정리한다. 다른 사용자의 문항·버전·스냅샷은 없는 것과 같은 `404`로 응답한다.")
@SecurityRequirement(name = OpenApiConfig.PREVIEW_KEY)
@RestController
@RequestMapping("/api")
public class WritingHistoryController {

    private final WritingHistory writing;
    private final PreviewUsers previewUsers;

    public WritingHistoryController(WritingHistory writing, PreviewUsers previewUsers) {
        this.writing = writing;
        this.previewUsers = previewUsers;
    }

    @Operation(summary = "작성 이력 조회", description = "현재 버전, 버전별 초안·스냅샷과 제출본을 읽는다.")
    @ApiResponse(responseCode = "200", description = "문항의 작성 이력")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`QUESTION_NOT_FOUND`: 없거나 내 것이 아닌 문항")
    @GetMapping("/questions/{questionId}/writing")
    public ResponseEntity<WritingHistoryDetail> find(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable long questionId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(writing.find(userId(authorization), questionId));
    }

    @Operation(summary = "초안 저장", description = "현재 저장 번호가 일치하면 초안을 저장하고 새 번호를 반환한다.")
    @ApiResponse(responseCode = "200", description = "저장한 초안")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: 본문 또는 저장 번호 형식 오류")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`VERSION_NOT_FOUND`: 없거나 내 것이 아닌 버전")
    @ApiResponse(responseCode = "409", description = "`DRAFT_CONFLICT`: 저장 번호가 달라 최신 초안을 반환한다.",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DraftConflictResponse.class)))
    @PutMapping("/versions/{versionId}/draft")
    public ResponseEntity<WritingHistoryDetail.Draft> saveDraft(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable long versionId, @Valid @RequestBody DraftWrite request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(writing.saveDraft(userId(authorization), versionId, request));
    }

    @Operation(summary = "스냅샷 생성", description = "본문을 고정된 기록으로 남기고 초안의 기준 스냅샷과 저장 번호를 갱신한다.")
    @ApiResponse(responseCode = "201", description = "스냅샷과 갱신된 초안")
    @ApiResponse(responseCode = "400", description = "`EMPTY_TEXT`: 빈 본문. `INVALID_REQUEST`: 길이·형식 오류")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`VERSION_NOT_FOUND`: 없거나 내 것이 아닌 버전")
    @ApiResponse(responseCode = "409", description = "`NO_CHANGES`: 이전 스냅샷과 본문이 같음. `DRAFT_CONFLICT`: 저장 번호가 다름.",
            content = @Content(mediaType = "application/json",
                    schema = @Schema(anyOf = {DraftConflictResponse.class, ErrorResponse.class})))
    @PostMapping("/versions/{versionId}/snapshots")
    public ResponseEntity<WritingHistoryDetail.SnapshotSaved> createSnapshot(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable long versionId, @Valid @RequestBody SnapshotCreate request) {
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(writing.createSnapshot(userId(authorization), versionId, request));
    }

    @Operation(summary = "버전 만들기",
            description = "빈 버전을 만들거나, `fromSnapshotId`에 스냅샷 id를 주면 그 스냅샷 본문에서 갈라진 버전을 만든다. 새 버전은 맨 뒤에 붙고 현재 버전이 된다. 입력한 이름이 다른 버전과 같으면 거절한다.")
    @ApiResponse(responseCode = "201", description = "만든 버전")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: 길이·형식 오류. `SNAPSHOT_MISMATCH`: 이 문항의 스냅샷이 아니다")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`QUESTION_NOT_FOUND`: 없거나 내 것이 아닌 문항")
    @ApiResponse(responseCode = "409", description = "`DUPLICATE_VERSION_NAME`: 같은 문항에 같은 이름의 버전이 있다")
    @PostMapping("/questions/{questionId}/versions")
    public ResponseEntity<WritingHistoryDetail.Version> createVersion(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable long questionId, @Valid @RequestBody VersionCreate request) {
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(writing.createVersion(userId(authorization), questionId, request));
    }

    @Operation(summary = "버전 이름·설명 수정",
            description = "이름을 비우면 지금 이름을 유지하고, 설명을 비우면 지운다. 다른 버전과 이름이 같으면 거절한다.")
    @ApiResponse(responseCode = "200", description = "수정한 버전의 이름·설명. 초안과 스냅샷은 바뀌지 않아 돌려주지 않는다.")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: 길이·형식 오류")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`VERSION_NOT_FOUND`: 없거나 내 것이 아닌 버전")
    @ApiResponse(responseCode = "409", description = "`DUPLICATE_VERSION_NAME`: 같은 문항에 같은 이름의 버전이 있다")
    @PatchMapping("/versions/{versionId}")
    public ResponseEntity<WritingHistoryDetail.VersionInfo> updateVersion(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable long versionId, @Valid @RequestBody VersionUpdate request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(writing.updateVersion(userId(authorization), versionId, request));
    }

    @Operation(summary = "버전 삭제",
            description = "버전과 그 버전의 스냅샷을 지우고 바뀐 작성 이력을 돌려준다. 다른 기록이 지운 스냅샷을 부모·시작·기준으로 가리키면 남는 가장 가까운 조상으로 다시 잇는다. 현재 버전을 지우면 남은 첫 버전이 현재 버전이 된다.")
    @ApiResponse(responseCode = "200", description = "삭제 뒤 작성 이력")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`VERSION_NOT_FOUND`: 없거나 내 것이 아닌 버전")
    @ApiResponse(responseCode = "409", description = "`LAST_VERSION`: 문항의 마지막 버전")
    @DeleteMapping("/versions/{versionId}")
    public ResponseEntity<WritingHistoryDetail> deleteVersion(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable long versionId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(writing.deleteVersion(userId(authorization), versionId));
    }

    @Operation(summary = "스냅샷 이름·설명 수정", description = "본문은 바꾸지 않는다. 비운 값은 지운다.")
    @ApiResponse(responseCode = "200", description = "수정한 스냅샷의 이름·설명")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: 길이·형식 오류")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`SNAPSHOT_NOT_FOUND`: 없거나 내 것이 아닌 스냅샷")
    @PatchMapping("/snapshots/{snapshotId}")
    public ResponseEntity<WritingHistoryDetail.SnapshotInfo> updateSnapshot(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable long snapshotId, @Valid @RequestBody SnapshotUpdate request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(writing.updateSnapshot(userId(authorization), snapshotId, request));
    }

    @Operation(summary = "스냅샷 삭제",
            description = "버전의 마지막 스냅샷이고 다음 스냅샷이나 다른 버전이 참조하지 않을 때만 지우고 바뀐 작성 이력을 돌려준다. 지운 스냅샷이 초안의 기준이었으면 그 부모가 기준이 된다. 다른 스냅샷 번호는 그대로다.")
    @ApiResponse(responseCode = "200", description = "삭제 뒤 작성 이력")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`SNAPSHOT_NOT_FOUND`: 없거나 내 것이 아닌 스냅샷")
    @ApiResponse(responseCode = "409", description = "`SNAPSHOT_IN_USE`: 마지막 스냅샷이 아니거나 다른 기록·버전이 참조한다")
    @DeleteMapping("/snapshots/{snapshotId}")
    public ResponseEntity<WritingHistoryDetail> deleteSnapshot(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @PathVariable long snapshotId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(writing.deleteSnapshot(userId(authorization), snapshotId));
    }

    @ExceptionHandler(DraftConflictException.class)
    public ResponseEntity<DraftConflictResponse> handleDraftConflict(DraftConflictException exception) {
        var code = exception.getErrorCode();
        var error = new DraftConflictResponse(code.getStatus().value(), code.getMessage(), code.getCode(),
                exception.getCurrentDraft());
        return ResponseEntity.status(code.getStatus()).cacheControl(CacheControl.noStore()).body(error);
    }

    private long userId(String authorization) {
        return previewUsers.requireUserId(authorization);
    }
}
