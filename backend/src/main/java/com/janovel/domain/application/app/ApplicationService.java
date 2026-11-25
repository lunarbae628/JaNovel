package com.janovel.domain.application.app;

import com.janovel.domain.application.dao.ApplicationRepository;
import com.janovel.domain.application.dao.ApplicationSectionRepository;
import com.janovel.domain.application.dao.ApplicationStageRepository;
import com.janovel.domain.application.dto.ApplicationDetail;
import com.janovel.domain.application.dto.ApplicationRegistration;
import com.janovel.domain.application.dto.ApplicationSummary;
import com.janovel.domain.application.entity.Application;
import com.janovel.domain.application.entity.ApplicationSection;
import com.janovel.domain.application.entity.ApplicationStage;
import com.janovel.domain.application.exception.ApplicationErrorCode;
import com.janovel.domain.user.dao.UserRepository;
import com.janovel.domain.writing.dao.EssayQuestionRepository;
import com.janovel.domain.writing.entity.EssayQuestion;
import com.janovel.global.exception.CustomException;
import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import java.util.stream.IntStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final ApplicationSectionRepository sectionRepository;
    private final ApplicationStageRepository stageRepository;
    private final EssayQuestionRepository questionRepository;
    private final UserRepository userRepository;

    public ApplicationService(ApplicationRepository applicationRepository,
                              ApplicationSectionRepository sectionRepository,
                              ApplicationStageRepository stageRepository,
                              EssayQuestionRepository questionRepository, UserRepository userRepository) {
        this.applicationRepository = applicationRepository;
        this.sectionRepository = sectionRepository;
        this.stageRepository = stageRepository;
        this.questionRepository = questionRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public ApplicationDetail register(long userId, ApplicationRegistration request) {
        var user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("사용자를 찾을 수 없습니다."));
        var application = new Application(user, request.company(), request.role());
        if (request.deadline() != null) {
            application.setDeadlineKind(request.deadline().kind());
            application.setDeadlineDate(request.deadline().date());
            application.setDeadlineTime(request.deadline().time());
        }
        application.setSourceUrl(request.sourceUrl());
        application.setSourceText(request.sourceText());
        applicationRepository.save(application);

        var sections = sectionRepository.saveAll(IntStream.range(0, request.sections().size())
                .mapToObj(index -> new ApplicationSection(application, request.sections().get(index).title(),
                        request.sections().get(index).body(), index + 1))
                .toList());
        var stages = stageRepository.saveAll(IntStream.range(0, request.stages().size())
                .mapToObj(index -> new ApplicationStage(application, request.stages().get(index), index + 1))
                .toList());
        var questions = questionRepository.saveAll(IntStream.range(0, request.questions().size())
                .mapToObj(index -> new EssayQuestion(application, request.questions().get(index).prompt(),
                        request.questions().get(index).limit(), index + 1))
                .toList());
        return ApplicationDetail.of(application, sections, stages, questions);
    }

    @Transactional(readOnly = true)
    public ApplicationDetail find(long userId, long applicationId) {
        var application = applicationRepository.findByIdAndUserId(applicationId, userId)
                .orElseThrow(() -> new CustomException(ApplicationErrorCode.APPLICATION_NOT_FOUND));
        return ApplicationDetail.of(application, sectionRepository.findAllByApplicationIdOrderByPosition(applicationId),
                stageRepository.findAllByApplicationIdOrderByPosition(applicationId),
                questionRepository.findAllByApplicationIdOrderByPosition(applicationId));
    }

    @Transactional
    public ApplicationSummary create(long userId, String company, String role) {
        String companyName = company.strip();
        String roleName = role.strip();
        if (companyName.isEmpty() || companyName.length() > 100) {
            throw new IllegalArgumentException("회사명은 1자 이상 100자 이하여야 합니다.");
        }
        if (roleName.isEmpty() || roleName.length() > 150) {
            throw new IllegalArgumentException("직무는 1자 이상 150자 이하여야 합니다.");
        }

        var user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("사용자를 찾을 수 없습니다."));
        var application = applicationRepository.save(new Application(user, companyName, roleName));
        return ApplicationSummary.from(application);
    }

    @Transactional(readOnly = true)
    public List<ApplicationSummary> findAllByUser(long userId) {
        return applicationRepository.findAllByUserIdOrderByIdDesc(userId).stream()
                .map(ApplicationSummary::from)
                .toList();
    }
}
