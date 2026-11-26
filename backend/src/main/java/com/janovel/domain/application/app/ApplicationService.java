package com.janovel.domain.application.app;

import com.janovel.domain.application.dao.ApplicationRepository;
import com.janovel.domain.application.dao.ApplicationSectionRepository;
import com.janovel.domain.application.dao.ApplicationStageRepository;
import com.janovel.domain.application.dto.ApplicationDetail;
import com.janovel.domain.application.dto.ApplicationProgress;
import com.janovel.domain.application.dto.ApplicationRegistration;
import com.janovel.domain.application.dto.ApplicationSummary;
import com.janovel.domain.application.dto.ApplicationUpdate;
import com.janovel.domain.application.dto.StagesUpdate;
import com.janovel.domain.application.entity.Application;
import com.janovel.domain.application.entity.ApplicationSection;
import com.janovel.domain.application.entity.ApplicationStage;
import com.janovel.domain.application.exception.ApplicationErrorCode;
import com.janovel.domain.application.model.ApplicationStatus;
import com.janovel.domain.user.dao.UserRepository;
import com.janovel.domain.writing.dao.EssayQuestionRepository;
import com.janovel.domain.writing.entity.EssayQuestion;
import com.janovel.global.exception.CustomException;
import jakarta.persistence.EntityNotFoundException;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
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

    /** 지원 건과 항목·전형·문항을 한 시점의 스냅샷으로 읽어 수정·삭제와 겹쳐도 섞이지 않게 한다. */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ApplicationDetail find(long userId, long applicationId) {
        return detail(applicationRepository.findByIdAndUserId(applicationId, userId)
                .orElseThrow(() -> new CustomException(ApplicationErrorCode.APPLICATION_NOT_FOUND)));
    }

    @Transactional
    public ApplicationDetail update(long userId, long applicationId, ApplicationUpdate request) {
        var application = lock(userId, applicationId);
        application.setCompany(request.company());
        application.setRole(request.role());
        var deadline = request.deadline();
        application.setDeadlineKind(deadline == null ? null : deadline.kind());
        application.setDeadlineDate(deadline == null ? null : deadline.date());
        application.setDeadlineTime(deadline == null ? null : deadline.time());
        application.setSourceUrl(request.sourceUrl());
        application.setSourceText(request.sourceText());
        return detail(application);
    }

    /**
     * 상태와 현재 전형은 서로 묶지 않고 사용자가 고른 대로 저장한다. 종료하면 그때의 전형 이름을 남기고,
     * 종료를 풀면 종료 기록을 지운다.
     */
    @Transactional
    public ApplicationDetail changeProgress(long userId, long applicationId, ApplicationProgress request) {
        var application = lock(userId, applicationId);
        var stages = stageRepository.findAllByApplicationIdOrderByPosition(applicationId);
        ApplicationStage current = null;
        if (request.currentStageId() != null) {
            current = stages.stream().filter(stage -> stage.getId().equals(request.currentStageId())).findFirst()
                    .orElseThrow(() -> new CustomException(ApplicationErrorCode.STAGE_MISMATCH));
        }
        Long currentId = current == null ? null : current.getId();
        boolean closing = request.status() == ApplicationStatus.CLOSED;
        boolean keepsClosedStage = application.getStatus() == ApplicationStatus.CLOSED
                && Objects.equals(application.getCurrentStageId(), currentId);
        application.setStatus(request.status());
        application.setCurrentStageId(currentId);
        if (closing && !keepsClosedStage) {
            application.setOutcomeStageName(current == null ? null : current.getName());
        } else if (!closing) {
            application.setOutcomeStageName(null);
            application.setOutcomeOptionId(null);
        }
        return detail(application);
    }

    @Transactional
    public List<ApplicationDetail.Section> replaceSections(long userId, long applicationId,
                                                           List<ApplicationRegistration.Section> sections) {
        var application = lock(userId, applicationId);
        sectionRepository.deleteAllByApplicationId(applicationId);
        return sectionRepository.saveAll(IntStream.range(0, sections.size())
                        .mapToObj(index -> new ApplicationSection(application, sections.get(index).title(),
                                sections.get(index).body(), index + 1))
                        .toList()).stream()
                .map(section -> new ApplicationDetail.Section(section.getId(), section.getTitle(), section.getBody()))
                .toList();
    }

    /** 번호가 있는 전형은 유지해 현재 전형 선택을 지키고, 빠진 전형만 지운다. */
    @Transactional
    public List<ApplicationDetail.Stage> updateStages(long userId, long applicationId, List<StagesUpdate.Stage> request) {
        var application = lock(userId, applicationId);
        var existing = stageRepository.findAllByApplicationIdOrderByPosition(applicationId).stream()
                .collect(Collectors.toMap(ApplicationStage::getId, Function.identity()));
        var keptIds = request.stream().map(StagesUpdate.Stage::id).filter(Objects::nonNull).toList();
        if (new HashSet<>(keptIds).size() != keptIds.size() || !existing.keySet().containsAll(keptIds)) {
            throw new CustomException(ApplicationErrorCode.STAGE_MISMATCH);
        }

        var removed = existing.values().stream().filter(stage -> !keptIds.contains(stage.getId())).toList();
        if (removed.stream().anyMatch(stage -> stage.getId().equals(application.getCurrentStageId()))) {
            application.setCurrentStageId(null);
        }
        stageRepository.deleteAll(removed);
        stageRepository.flush();

        stageRepository.deferPositionCheck();
        var stages = IntStream.range(0, request.size()).mapToObj(index -> {
            var input = request.get(index);
            if (input.id() == null) {
                return new ApplicationStage(application, input.name(), index + 1);
            }
            var stage = existing.get(input.id());
            stage.setName(input.name());
            stage.setPosition(index + 1);
            return stage;
        }).toList();
        stageRepository.saveAllAndFlush(stages);
        stageRepository.checkPositions();
        return stages.stream().map(stage -> new ApplicationDetail.Stage(stage.getId(), stage.getName())).toList();
    }

    @Transactional
    public void delete(long userId, long applicationId) {
        lock(userId, applicationId);
        applicationRepository.deleteDirectly(applicationId);
    }

    private Application lock(long userId, long applicationId) {
        return applicationRepository.findWithLockByIdAndUserId(applicationId, userId)
                .orElseThrow(() -> new CustomException(ApplicationErrorCode.APPLICATION_NOT_FOUND));
    }

    private ApplicationDetail detail(Application application) {
        long applicationId = application.getId();
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
