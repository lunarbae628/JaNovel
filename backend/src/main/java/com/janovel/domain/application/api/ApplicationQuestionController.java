package com.janovel.domain.application.api;

import com.janovel.domain.application.app.ApplicationQuestionService;
import com.janovel.domain.application.app.ApplicationVersion;
import com.janovel.domain.application.app.Versioned;
import com.janovel.domain.application.dto.ApplicationDetail;
import com.janovel.domain.application.dto.ApplicationRegistration;
import com.janovel.domain.application.dto.QuestionOrder;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "지원 건 자소서 문항", description = "등록한 지원 건의 자소서 문항을 추가·수정·삭제하고 순서를 바꾼다. 다른 사용자의 지원 건과 문항은 없는 것과 같은 `404`로 응답한다.")
@SecurityRequirement(name = OpenApiConfig.PREVIEW_KEY)
@RestController
@RequestMapping("/api/applications/{applicationId}/questions")
public class ApplicationQuestionController {

    private final ApplicationQuestionService questions;
    private final PreviewUsers previewUsers;

    public ApplicationQuestionController(ApplicationQuestionService questions, PreviewUsers previewUsers) {
        this.questions = questions;
        this.previewUsers = previewUsers;
    }

    @Operation(summary = "문항 추가", description = "문항을 맨 뒤에 추가한다. 지원 건마다 30개까지 둘 수 있다.")
    @ApiResponse(responseCode = "201", description = "추가했다. `Location`에 지원 건 상세 주소가 있다.")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: 문항 내용 누락, 길이·형식 오류. `INVALID_VERSION`: `If-Match`가 버전 번호가 아니다")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`APPLICATION_NOT_FOUND`: 없거나 내 것이 아닌 지원 건")
    @ApiResponse(responseCode = "409", description = "`QUESTION_LIMIT_EXCEEDED`: 이미 문항이 30개다. `APPLICATION_CONFLICT`: 다른 곳에서 먼저 바뀌어 `If-Match` 버전이 지금 버전과 다르다")
    @PostMapping
    public ResponseEntity<ApplicationDetail.Question> add(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @Parameter(description = "상세 조회 때 받은 지원 건 버전. 지금 버전과 다르면 409로 거절한다. 생략하면 확인하지 않는다.")
            @RequestHeader(name = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @PathVariable long applicationId,
            @Valid @RequestBody ApplicationRegistration.Question request) {
        var added = questions.add(userId(authorization), applicationId, ApplicationVersion.parse(ifMatch), request);
        return ResponseEntity.created(URI.create("/api/applications/" + applicationId))
                .cacheControl(CacheControl.noStore()).eTag(ApplicationVersion.tag(added.version())).body(added.body());
    }

    @Operation(summary = "문항 수정", description = "문항 내용과 글자 수 제한을 보낸 값으로 바꾼다. `limit`을 `null`로 보내면 제한이 없어진다.")
    @ApiResponse(responseCode = "200", description = "수정한 문항")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: 문항 내용 누락, 길이·형식 오류. `INVALID_VERSION`: `If-Match`가 버전 번호가 아니다")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`APPLICATION_NOT_FOUND` 또는 `QUESTION_NOT_FOUND`")
    @ApiResponse(responseCode = "409", description = "`APPLICATION_CONFLICT`: 다른 곳에서 먼저 바뀌어 `If-Match` 버전이 지금 버전과 다르다")
    @PutMapping("/{questionId}")
    public ResponseEntity<ApplicationDetail.Question> update(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @Parameter(description = "상세 조회 때 받은 지원 건 버전. 지금 버전과 다르면 409로 거절한다. 생략하면 확인하지 않는다.")
            @RequestHeader(name = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @PathVariable long applicationId, @PathVariable long questionId,
            @Valid @RequestBody ApplicationRegistration.Question request) {
        return versioned(questions.update(userId(authorization), applicationId, questionId,
                ApplicationVersion.parse(ifMatch), request));
    }

    @Operation(summary = "문항 삭제", description = "문항을 지운다. 문항에 딸린 작성본과 제출 답안도 함께 지워지고, 남은 문항의 순서는 그대로다.")
    @ApiResponse(responseCode = "204", description = "삭제했다. `ETag`에 새 지원 건 버전이 있다.")
    @ApiResponse(responseCode = "400", description = "`INVALID_VERSION`: `If-Match`가 버전 번호가 아니다")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`APPLICATION_NOT_FOUND` 또는 `QUESTION_NOT_FOUND`")
    @ApiResponse(responseCode = "409", description = "`APPLICATION_CONFLICT`: 다른 곳에서 먼저 바뀌어 `If-Match` 버전이 지금 버전과 다르다")
    @DeleteMapping("/{questionId}")
    public ResponseEntity<Void> delete(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @Parameter(description = "상세 조회 때 받은 지원 건 버전. 지금 버전과 다르면 409로 거절한다. 생략하면 확인하지 않는다.")
            @RequestHeader(name = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @PathVariable long applicationId, @PathVariable long questionId) {
        long version = questions.delete(userId(authorization), applicationId, questionId, ApplicationVersion.parse(ifMatch));
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).eTag(ApplicationVersion.tag(version)).build();
    }

    @Operation(summary = "문항 순서 변경", description = "보낸 번호 순서대로 문항 순서를 바꾼다. 지금 있는 문항 번호를 빠짐없이 한 번씩 보내야 한다.")
    @ApiResponse(responseCode = "200", description = "바뀐 순서의 문항 목록")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST` 또는 `QUESTION_ORDER_MISMATCH`: 번호가 빠졌거나 겹치거나 모르는 번호가 있다. `INVALID_VERSION`: `If-Match`가 버전 번호가 아니다")
    @ApiResponse(responseCode = "401", description = "`APPLICATION_UNAUTHORIZED`: 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "404", description = "`APPLICATION_NOT_FOUND`: 없거나 내 것이 아닌 지원 건")
    @ApiResponse(responseCode = "409", description = "`APPLICATION_CONFLICT`: 다른 곳에서 먼저 바뀌어 `If-Match` 버전이 지금 버전과 다르다")
    @PutMapping("/order")
    public ResponseEntity<List<ApplicationDetail.Question>> reorder(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @Parameter(description = "상세 조회 때 받은 지원 건 버전. 지금 버전과 다르면 409로 거절한다. 생략하면 확인하지 않는다.")
            @RequestHeader(name = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @PathVariable long applicationId, @Valid @RequestBody QuestionOrder request) {
        return versioned(questions.reorder(userId(authorization), applicationId, ApplicationVersion.parse(ifMatch),
                request.ids()));
    }

    private static <T> ResponseEntity<T> versioned(Versioned<T> result) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).eTag(ApplicationVersion.tag(result.version()))
                .body(result.body());
    }

    private long userId(String authorization) {
        return previewUsers.requireUserId(authorization);
    }
}
