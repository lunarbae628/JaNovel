package com.janovel.domain.application.app;

import com.janovel.domain.application.dto.ApplicationDetail;
import com.janovel.domain.application.dto.ApplicationRegistration;
import com.janovel.domain.application.exception.ApplicationErrorCode;
import com.janovel.domain.writing.app.WritingHistory;
import com.janovel.domain.writing.dao.EssayQuestionRepository;
import com.janovel.domain.writing.entity.EssayQuestion;
import com.janovel.global.exception.CustomException;
import java.util.HashSet;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 이미 등록한 지원 건의 자소서 문항을 추가·수정·삭제하고 순서를 바꾼다. */
@Service
public class ApplicationQuestionService {

    static final int MAX_QUESTIONS = 30;

    private final EssayQuestionRepository questionRepository;
    private final WritingHistory writingHistory;
    private final ApplicationChanges changes;

    public ApplicationQuestionService(EssayQuestionRepository questionRepository, WritingHistory writingHistory,
                                      ApplicationChanges changes) {
        this.questionRepository = questionRepository;
        this.writingHistory = writingHistory;
        this.changes = changes;
    }

    @Transactional
    public Versioned<ApplicationDetail.Question> add(long userId, long applicationId, Long expectedVersion,
                                                     ApplicationRegistration.Question request) {
        var application = changes.begin(userId, applicationId, expectedVersion);
        if (questionRepository.countByApplicationId(applicationId) >= MAX_QUESTIONS) {
            throw new CustomException(ApplicationErrorCode.QUESTION_LIMIT_EXCEEDED);
        }
        var question = questionRepository.save(new EssayQuestion(application, request.prompt(), request.limit(),
                questionRepository.maxPosition(applicationId) + 1));
        writingHistory.start(List.of(question));
        return new Versioned<>(toResponse(question), application.getVersion());
    }

    @Transactional
    public Versioned<ApplicationDetail.Question> update(long userId, long applicationId, long questionId,
                                                        Long expectedVersion, ApplicationRegistration.Question request) {
        var application = changes.begin(userId, applicationId, expectedVersion);
        var question = findQuestion(applicationId, questionId);
        question.setPrompt(request.prompt());
        question.setCharLimit(request.limit());
        return new Versioned<>(toResponse(question), application.getVersion());
    }

    /** 문항을 지우면 그 문항에 딸린 작성본과 제출 답안도 함께 지워진다. 남은 문항의 순서는 그대로 둔다. */
    @Transactional
    public long delete(long userId, long applicationId, long questionId, Long expectedVersion) {
        var application = changes.begin(userId, applicationId, expectedVersion);
        questionRepository.deleteDirectly(findQuestion(applicationId, questionId).getId());
        return application.getVersion();
    }

    @Transactional
    public Versioned<List<ApplicationDetail.Question>> reorder(long userId, long applicationId, Long expectedVersion,
                                                               List<Long> ids) {
        var application = changes.begin(userId, applicationId, expectedVersion);
        var current = questionRepository.findAllByApplicationIdOrderByPosition(applicationId);
        var currentIds = current.stream().map(EssayQuestion::getId).collect(Collectors.toSet());
        if (ids.size() != currentIds.size() || !new HashSet<>(ids).equals(currentIds)) {
            throw new CustomException(ApplicationErrorCode.QUESTION_ORDER_MISMATCH);
        }

        questionRepository.negatePositions(applicationId);
        var byId = questionRepository.findAllByApplicationIdOrderByPosition(applicationId).stream()
                .collect(Collectors.toMap(EssayQuestion::getId, Function.identity()));
        IntStream.range(0, ids.size()).forEach(index -> byId.get(ids.get(index)).setPosition(index + 1));
        questionRepository.flush();
        return new Versioned<>(ids.stream().map(byId::get).map(ApplicationQuestionService::toResponse).toList(),
                application.getVersion());
    }

    private EssayQuestion findQuestion(long applicationId, long questionId) {
        return questionRepository.findByIdAndApplicationId(questionId, applicationId)
                .orElseThrow(() -> new CustomException(ApplicationErrorCode.QUESTION_NOT_FOUND));
    }

    private static ApplicationDetail.Question toResponse(EssayQuestion question) {
        return new ApplicationDetail.Question(question.getId(), question.getPrompt(), question.getCharLimit());
    }
}
