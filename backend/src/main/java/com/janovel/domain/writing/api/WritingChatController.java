package com.janovel.domain.writing.api;

import com.janovel.domain.user.app.PreviewUsers;
import com.janovel.domain.writing.client.WritingChatModelClient;
import com.janovel.domain.writing.dto.WritingChatRequest;
import com.janovel.domain.writing.dto.WritingChatResponse;
import com.janovel.domain.writing.exception.WritingErrorCode;
import com.janovel.global.exception.CustomException;
import com.janovel.global.openapi.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "작성 AI 채팅", description = "현재 문항의 초안과 후속 답변을 생성한다. local 프로필에서만 사용한다.")
@SecurityRequirement(name = OpenApiConfig.PREVIEW_KEY)
@Profile("local")
@RestController
public class WritingChatController {

    private final PreviewUsers users;
    private final WritingChatModelClient model;

    public WritingChatController(PreviewUsers users, WritingChatModelClient model) {
        this.users = users;
        this.model = model;
    }

    @Operation(summary = "작성 AI 채팅 답변 생성",
            description = "공고·문항과 최근 대화로 요청에 답하고, 초안이나 수정안이 있으면 비교 가능한 본문을 반환한다.")
    @ApiResponse(responseCode = "200", description = "AI 답변과 비교용 본문")
    @ApiResponse(responseCode = "400", description = "INVALID_REQUEST. 요청 형식 또는 길이 오류")
    @ApiResponse(responseCode = "401", description = "WRITING_CHAT_UNAUTHORIZED. 미리보기 접근 키 누락 또는 형식 오류")
    @ApiResponse(responseCode = "502", description = "WRITING_CHAT_FAILED. 모델 응답 형식 오류")
    @ApiResponse(responseCode = "503", description = "WRITING_CHAT_UNAVAILABLE. 모델을 사용할 수 없거나 처리 한도에 도달함")
    @ApiResponse(responseCode = "504", description = "WRITING_CHAT_TIMEOUT. 모델 응답 제한 시간 초과")
    @PostMapping("/api/me/writing-chat")
    public ResponseEntity<WritingChatResponse> reply(
            @Parameter(hidden = true) @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @Valid @RequestBody WritingChatRequest request) {
        users.accessKey(authorization)
                .orElseThrow(() -> new CustomException(WritingErrorCode.WRITING_CHAT_UNAUTHORIZED));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(model.reply(request));
    }
}
