package com.janovel.domain.application.app;

import com.janovel.domain.application.dao.ApplicationRepository;
import com.janovel.domain.application.dto.ApplicationDetail;
import com.janovel.domain.application.dto.ApplicationRegistration;
import com.janovel.domain.application.entity.Application;
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

    private final ApplicationRepository applicationRepository;
    private final EssayQuestionRepository questionRepository;
    private final WritingHistory writingHistory;

    public ApplicationQuestionService(ApplicationRepository applicationRepository,
                                      EssayQuestionRepository questionRepository, WritingHistory writingHistory) {
        this.applicationRepository = applicationRepository;
        this.questionRepository = questionRepository;
        this.writingHistory = writingHistory;
    }

    @Transactional
    public ApplicationDetail.Question add(long userId, long applicationId, ApplicationRegistration.Question request) {
        var application = lockApplication(userId, applicationId);
        if (questionRepository.countByApplicationId(applicationId) >= MAX_QUESTIONS) {
            throw new CustomException(ApplicationErrorCode.QUESTION_LIMIT_EXCEEDED);
        }
        var question = questionRepository.save(new EssayQuestion(application, request.prompt(), request.limit(),
                questionRepository.maxPosition(applicationId) + 1));
        writingHistory.start(List.of(question));
        return toResponse(question);
    }

    @Transactional
    public ApplicationDetail.Question update(long userId, long applicationId, long questionId,
                                             ApplicationRegistration.Question request) {
        lockApplication(userId, applicationId);
        var question = findQuestion(applicationId, questionId);
        question.setPrompt(request.prompt());
        question.setCharLimit(request.limit());
        return toResponse(question);
    }

    /** 문항을 지우면 그 문항에 딸린 작성본과 제출 답안도 함께 지워진다. 남은 문항의 순서는 그대로 둔다. */
    @Transactional
    public void delete(long userId, long applicationId, long questionId) {
        lockApplication(userId, applicationId);
        questionRepository.deleteDirectly(findQuestion(applicationId, questionId).getId());
    }

    @Transactional
    public List<ApplicationDetail.Question> reorder(long userId, long applicationId, List<Long> ids) {
        lockApplication(userId, applicationId);
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
        return ids.stream().map(byId::get).map(ApplicationQuestionService::toResponse).toList();
    }

    private Application lockApplication(long userId, long applicationId) {
        return applicationRepository.findWithLockByIdAndUserId(applicationId, userId)
                .orElseThrow(() -> new CustomException(ApplicationErrorCode.APPLICATION_NOT_FOUND));
    }

    private EssayQuestion findQuestion(long applicationId, long questionId) {
        return questionRepository.findByIdAndApplicationId(questionId, applicationId)
                .orElseThrow(() -> new CustomException(ApplicationErrorCode.QUESTION_NOT_FOUND));
    }

    private static ApplicationDetail.Question toResponse(EssayQuestion question) {
        return new ApplicationDetail.Question(question.getId(), question.getPrompt(), question.getCharLimit());
    }
}
