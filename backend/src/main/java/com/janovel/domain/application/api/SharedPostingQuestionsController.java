package com.janovel.domain.application.api;

import static com.janovel.domain.application.exception.PostingErrorCode.POSTING_QUESTIONS_NOT_FOUND;

import com.janovel.domain.application.app.SharedPostingQuestions;
import com.janovel.domain.application.app.SharedPostingQuestions.QuestionSet;
import com.janovel.domain.application.dto.ImportedPosting.Question;
import com.janovel.global.exception.CustomException;
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

@Profile("local")
@RestController
@RequestMapping("/api/postings/shared-questions")
public class SharedPostingQuestionsController {

    private final SharedPostingQuestions shared;

    public SharedPostingQuestionsController(SharedPostingQuestions shared) {
        this.shared = shared;
    }

    @PostMapping("/lookup")
    public ResponseEntity<QuestionSet> lookup(@Valid @RequestBody Scope request) {
        var result = shared.find(request.url(), request.role());
        if (result.isEmpty()) {
            return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(result.get());
    }

    @PostMapping
    public ResponseEntity<Void> save(@Valid @RequestBody Registration request) {
        return shared.saveFirst(request.url(), request.role(), toQuestions(request.questions()))
                ? ResponseEntity.status(HttpStatus.CREATED).build() : ResponseEntity.noContent().build();
    }

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

    public record Scope(@NotBlank @Size(max = 2048) String url, @NotBlank @Size(max = 150) String role) {
    }

    public record Registration(@NotBlank @Size(max = 2048) String url, @NotBlank @Size(max = 150) String role,
                               @NotNull @Size(min = 1, max = 30) List<@NotNull @Valid QuestionInput> questions) {
    }

    public record Report(@Size(max = 30) List<@NotNull @Valid QuestionInput> questions) {
    }

    public record QuestionInput(@NotBlank @Size(max = 2000) String prompt, @Min(1) @Max(100000) Integer limit) {
    }
}
