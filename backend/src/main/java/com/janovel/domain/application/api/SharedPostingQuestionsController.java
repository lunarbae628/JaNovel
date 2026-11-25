package com.janovel.domain.application.api;

import static com.janovel.domain.application.exception.PostingErrorCode.POSTING_QUESTIONS_NOT_FOUND;

import com.janovel.domain.application.app.SharedPostingQuestions;
import com.janovel.domain.application.app.SharedPostingQuestions.QuestionSet;
import com.janovel.domain.application.dto.ImportedPosting.Question;
import com.janovel.global.exception.CustomException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "공유 문항", description = "같은 공고·직무의 문항을 먼저 입력한 사용자의 세트를 다음 사용자에게 채운다. 문항은 최대 30개이고 본문은 최대 2,000자, 확인된 글자 수 제한은 1~100,000자이며 모르면 `limit`은 `null`이다. 공고는 상세 URL을, 직무는 최대 150자의 이름을 쓴다. 알려진 추적 값만 제거하고 사람인은 공고 번호만으로 같은 공고를 판별한다. `local` 프로필에서만 켜진다.")
@Profile("local")
@RestController
@RequestMapping("/api/postings/shared-questions")
public class SharedPostingQuestionsController {

    private final SharedPostingQuestions shared;

    public SharedPostingQuestionsController(SharedPostingQuestions shared) {
        this.shared = shared;
    }

    @Operation(summary = "공유 문항 조회", description = "같은 공고와 직무로 저장된 문항 세트를 찾는다. 응답의 `id`는 문항 세트의 버전이며 제보가 이 버전에 연결된다.")
    @ApiResponse(responseCode = "200", description = "저장된 문항 세트")
    @ApiResponse(responseCode = "204", description = "저장된 문항이 없다.", content = @io.swagger.v3.oas.annotations.media.Content)
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: 필수 값 누락이나 범위 오류. `INVALID_POSTING_URL`: 상세 공고 주소로 쓸 수 없는 URL")
    @PostMapping("/lookup")
    public ResponseEntity<QuestionSet> lookup(@Valid @RequestBody Scope request) {
        var result = shared.find(request.url(), request.role());
        if (result.isEmpty()) {
            return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(result.get());
    }

    @Operation(summary = "공유 문항 최초 저장", description = "같은 공고·직무의 첫 문항 세트만 저장하고 이후 입력은 덮어쓰지 않는다.")
    @ApiResponse(responseCode = "201", description = "최초로 저장했다.")
    @ApiResponse(responseCode = "204", description = "같은 공고·직무에 이미 저장돼 있다.")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: 필수 값 누락이나 범위 오류. `INVALID_POSTING_URL`: 상세 공고 주소로 쓸 수 없는 URL")
    @PostMapping
    public ResponseEntity<Void> save(@Valid @RequestBody Registration request) {
        return shared.saveFirst(request.url(), request.role(), toQuestions(request.questions()))
                ? ResponseEntity.status(HttpStatus.CREATED).build() : ResponseEntity.noContent().build();
    }

    @Operation(summary = "정정 제보", description = "공유 문항에 대한 정정 제안을 저장한다. 제안이 없으면 `{}`를 보낸다. 제보는 공통 문항을 바꾸지 않는다.")
    @ApiResponse(responseCode = "201", description = "제보를 저장했다.")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: 문항 본문·제한·개수 범위 오류")
    @ApiResponse(responseCode = "404", description = "`POSTING_QUESTIONS_NOT_FOUND`: 제보할 문항 버전이 없다.")
    @PostMapping("/{id}/reports")
    public ResponseEntity<Void> report(@PathVariable UUID id, @Valid @RequestBody Report request) {
        if (!shared.report(id, request.questions() == null ? List.of() : toQuestions(request.questions()))) {
            throw new CustomException(POSTING_QUESTIONS_NOT_FOUND);
        }
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    private List<Question> toQuestions(List<QuestionInput> questions) {
        return questions.stream().map(input -> new Question(input.prompt().strip(), input.limit())).toList();
    }

    @Schema(name = "SharedQuestionsScope", description = "공고와 직무")
    public record Scope(@NotBlank @Size(max = 2048) String url, @NotBlank @Size(max = 150) String role) {
    }

    @Schema(name = "SharedQuestionsRegistration", description = "처음 입력한 문항 세트")
    public record Registration(@NotBlank @Size(max = 2048) String url, @NotBlank @Size(max = 150) String role,
                               @NotNull @Size(min = 1, max = 30) List<@NotNull @Valid QuestionInput> questions) {
    }

    @Schema(name = "SharedQuestionsReport", description = "정정 제안")
    public record Report(@Size(max = 30) List<@NotNull @Valid QuestionInput> questions) {
    }

    @Schema(name = "SharedQuestionInput", description = "문항")
    public record QuestionInput(@NotBlank @Size(max = 2000) String prompt, @Min(1) @Max(100000) Integer limit) {
    }
}
