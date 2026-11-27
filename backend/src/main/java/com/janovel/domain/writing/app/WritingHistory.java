package com.janovel.domain.writing.app;

import com.janovel.domain.application.dao.ApplicationRepository;
import com.janovel.domain.application.exception.ApplicationErrorCode;
import com.janovel.domain.writing.dao.EssayQuestionRepository;
import com.janovel.domain.writing.dao.SnapshotParentRepository;
import com.janovel.domain.writing.dao.SnapshotRepository;
import com.janovel.domain.writing.dao.SubmissionAnswerRepository;
import com.janovel.domain.writing.dao.WritingVersionRepository;
import com.janovel.domain.writing.dto.DraftWrite;
import com.janovel.domain.writing.dto.SnapshotCreate;
import com.janovel.domain.writing.dto.SnapshotUpdate;
import com.janovel.domain.writing.dto.VersionCreate;
import com.janovel.domain.writing.dto.VersionUpdate;
import com.janovel.domain.writing.dto.WritingHistoryDetail;
import com.janovel.domain.writing.entity.EssayQuestion;
import com.janovel.domain.writing.entity.Snapshot;
import com.janovel.domain.writing.entity.SnapshotParent;
import com.janovel.domain.writing.entity.SnapshotParentId;
import com.janovel.domain.writing.entity.WritingVersion;
import com.janovel.domain.writing.exception.DraftConflictException;
import com.janovel.domain.writing.exception.WritingErrorCode;
import com.janovel.global.exception.CustomException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 문항의 작성 이력. 버전·초안·스냅샷 규칙을 이곳에 모은다. */
@Service
public class WritingHistory {

    static final String DEFAULT_VERSION_NAME = "기본";
    private static final String NEW_VERSION_NAME = "새 버전";
    private static final int NAME_BASE_LENGTH = 90;

    private final WritingVersionRepository versionRepository;
    private final EssayQuestionRepository questionRepository;
    private final ApplicationRepository applicationRepository;
    private final SnapshotRepository snapshotRepository;
    private final SnapshotParentRepository parentRepository;
    private final SubmissionAnswerRepository submissionRepository;

    public WritingHistory(WritingVersionRepository versionRepository, EssayQuestionRepository questionRepository,
                          ApplicationRepository applicationRepository, SnapshotRepository snapshotRepository,
                          SnapshotParentRepository parentRepository, SubmissionAnswerRepository submissionRepository) {
        this.versionRepository = versionRepository;
        this.questionRepository = questionRepository;
        this.applicationRepository = applicationRepository;
        this.snapshotRepository = snapshotRepository;
        this.parentRepository = parentRepository;
        this.submissionRepository = submissionRepository;
    }

    /** 새 문항마다 빈 "기본" 버전을 만들고 현재 버전으로 지정한다. 문항을 저장한 같은 트랜잭션에서 부른다. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void start(List<EssayQuestion> questions) {
        var versions = versionRepository.saveAll(questions.stream()
                .map(question -> new WritingVersion(question, DEFAULT_VERSION_NAME, 1))
                .toList());
        for (var version : versions) {
            version.getQuestion().setActiveVersionId(version.getId());
        }
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public WritingHistoryDetail find(long userId, long questionId) {
        var question = questionRepository.findByIdAndApplicationUserId(questionId, userId)
                .orElseThrow(() -> new CustomException(ApplicationErrorCode.QUESTION_NOT_FOUND));
        return history(question);
    }

    @Transactional
    public WritingHistoryDetail.Draft saveDraft(long userId, long versionId, DraftWrite request) {
        var version = lockVersion(userId, versionId);
        var base = baseSnapshot(version);
        requireRevision(version, base, request.revision());
        version.writeDraft(request.body());
        return draftDetail(version, base);
    }

    @Transactional
    public WritingHistoryDetail.SnapshotSaved createSnapshot(long userId, long versionId, SnapshotCreate request) {
        var version = lockVersion(userId, versionId);
        var base = baseSnapshot(version);
        requireRevision(version, base, request.revision());
        if (request.body().codePoints().allMatch(codePoint ->
                Character.isWhitespace(codePoint) || Character.isSpaceChar(codePoint) || codePoint == '﻿')) {
            throw new CustomException(WritingErrorCode.EMPTY_TEXT);
        }
        if (base != null && base.getVersionId() == versionId && base.getBody().equals(request.body())) {
            throw new CustomException(WritingErrorCode.NO_CHANGES);
        }

        long questionId = version.getQuestion().getId();
        int number = snapshotRepository.maxNumber(questionId) + 1;
        var snapshot = new Snapshot(questionId, versionId, number, request.body());
        snapshot.setTitle(request.title() == null ? defaultTitle(number) : request.title());
        snapshot.setDescription(request.description());
        snapshotRepository.save(snapshot);
        List<Long> parentIds = List.of();
        if (base != null) {
            parentRepository.save(new SnapshotParent(new SnapshotParentId(snapshot.getId(), base.getId()), questionId));
            parentIds = List.of(base.getId());
        }
        version.writeDraft(request.body());
        version.setBaseSnapshotId(snapshot.getId());
        return new WritingHistoryDetail.SnapshotSaved(snapshotDetail(snapshot, parentIds), draftDetail(version, snapshot));
    }

    /** 빈 버전이나 스냅샷에서 갈라진 버전을 맨 뒤에 만들고 현재 버전으로 지정한다. */
    @Transactional
    public WritingHistoryDetail.Version createVersion(long userId, long questionId, VersionCreate request) {
        var question = lockQuestion(userId, questionId);
        Snapshot from = null;
        if (request.fromSnapshotId() != null) {
            from = snapshotRepository.findById(request.fromSnapshotId())
                    .filter(snapshot -> snapshot.getQuestionId() == questionId)
                    .orElseThrow(() -> new CustomException(WritingErrorCode.SNAPSHOT_MISMATCH));
        }
        var taken = versionRepository.findNamesByQuestionIdExcept(questionId, 0L);
        String fallback = from == null ? NEW_VERSION_NAME : from.getTitle() + "에서 시작";
        String name = request.name() == null ? defaultName(fallback, taken) : requireFreeName(request.name(), taken);
        var version = new WritingVersion(question, name,
                versionRepository.maxPosition(questionId) + 1);
        version.setDescription(request.description());
        if (from != null) {
            version.setFromSnapshotId(from.getId());
            version.setBaseSnapshotId(from.getId());
            version.writeDraft(from.getBody());
        }
        versionRepository.save(version);
        question.setActiveVersionId(version.getId());
        return versionDetail(version, from, List.of());
    }

    /**
     * 이름을 비우면 지금 이름을 유지하고, 다른 버전과 이름이 겹치면 `DUPLICATE_VERSION_NAME`으로 거절한다.
     * 초안과 스냅샷은 바뀌지 않으므로 읽지 않고 최종 이름·설명만 돌려준다.
     */
    @Transactional
    public WritingHistoryDetail.VersionInfo updateVersion(long userId, long versionId, VersionUpdate request) {
        var version = lockVersion(userId, versionId);
        if (request.name() != null) {
            version.setName(requireFreeName(request.name(),
                    versionRepository.findNamesByQuestionIdExcept(version.getQuestion().getId(), versionId)));
        }
        version.setDescription(request.description());
        return new WritingHistoryDetail.VersionInfo(version.getId(), version.getName(), version.getDescription());
    }

    /**
     * 버전과 그 버전의 스냅샷을 지운다. 다른 기록이 지운 스냅샷을 부모·시작·기준으로 가리키면 지워지지 않은
     * 가장 가까운 조상으로 다시 잇는다. 현재 버전을 지우면 남은 첫 버전이 현재 버전이 된다.
     */
    @Transactional
    public WritingHistoryDetail deleteVersion(long userId, long versionId) {
        var version = lockVersion(userId, versionId);
        var question = version.getQuestion();
        long questionId = question.getId();
        var versions = versionRepository.findAllByQuestionIdOrderByPosition(questionId);
        if (versions.size() == 1) {
            throw new CustomException(WritingErrorCode.LAST_VERSION);
        }

        var parentsByChild = parentsByChild(questionId);
        Set<Long> removed = new HashSet<>(snapshotRepository.findIdsByVersionId(versionId));
        for (var link : parentsByChild.entrySet()) {
            long child = link.getKey();
            if (removed.contains(child) || link.getValue().stream().noneMatch(removed::contains)) {
                continue;
            }
            var existing = new HashSet<>(link.getValue());
            for (long ancestor : survivors(link.getValue(), removed, parentsByChild)) {
                if (existing.add(ancestor)) {
                    parentRepository.save(new SnapshotParent(new SnapshotParentId(child, ancestor), questionId));
                }
            }
        }
        for (var other : versions) {
            if (other.getId().equals(versionId)) {
                continue;
            }
            if (other.getFromSnapshotId() != null && removed.contains(other.getFromSnapshotId())) {
                other.setFromSnapshotId(first(survivors(List.of(other.getFromSnapshotId()), removed, parentsByChild)));
            }
            if (other.getBaseSnapshotId() != null && removed.contains(other.getBaseSnapshotId())) {
                other.moveBase(first(survivors(List.of(other.getBaseSnapshotId()), removed, parentsByChild)));
            }
        }
        if (Long.valueOf(versionId).equals(question.getActiveVersionId())) {
            question.setActiveVersionId(versions.stream().map(WritingVersion::getId)
                    .filter(id -> id != versionId).findFirst().orElseThrow());
        }
        versionRepository.deleteDirectly(versionId);
        return history(questionRepository.findById(questionId).orElseThrow());
    }

    /** 본문과 부모 연결은 바뀌지 않으므로 최종 이름·설명만 돌려준다. */
    @Transactional
    public WritingHistoryDetail.SnapshotInfo updateSnapshot(long userId, long snapshotId, SnapshotUpdate request) {
        var snapshot = lockSnapshot(userId, snapshotId);
        snapshot.setTitle(request.title() == null ? defaultTitle(snapshot.getNumber()) : request.title());
        snapshot.setDescription(request.description());
        return new WritingHistoryDetail.SnapshotInfo(snapshot.getId(), snapshot.getTitle(), snapshot.getDescription());
    }

    /**
     * 버전의 마지막 스냅샷이고 다음 스냅샷·다른 버전이 참조하지 않을 때만 지운다. 그 버전 초안의 기준이었으면
     * 지운 스냅샷의 부모가 기준이 된다. 다른 스냅샷 번호는 바뀌지 않는다.
     */
    @Transactional
    public WritingHistoryDetail deleteSnapshot(long userId, long snapshotId) {
        var snapshot = lockSnapshot(userId, snapshotId);
        long questionId = snapshot.getQuestionId();
        long versionId = snapshot.getVersionId();
        var versions = versionRepository.findAllByQuestionIdOrderByPosition(questionId);
        boolean latest = snapshotRepository.maxNumberInVersion(versionId) == snapshot.getNumber();
        boolean referenced = parentRepository.existsByIdParentSnapshotId(snapshotId)
                || versions.stream().anyMatch(version -> version.getId() != versionId
                && (Long.valueOf(snapshotId).equals(version.getFromSnapshotId())
                || Long.valueOf(snapshotId).equals(version.getBaseSnapshotId())));
        if (!latest || referenced) {
            throw new CustomException(WritingErrorCode.SNAPSHOT_IN_USE);
        }

        var own = versions.stream().filter(version -> version.getId() == versionId).findFirst().orElseThrow();
        if (Long.valueOf(snapshotId).equals(own.getBaseSnapshotId())) {
            own.moveBase(first(parentIdsOf(snapshotId)));
        }
        snapshotRepository.delete(snapshot);
        snapshotRepository.flush();
        return history(questionRepository.findById(questionId).orElseThrow());
    }

    private WritingHistoryDetail history(EssayQuestion question) {
        long questionId = question.getId();
        var snapshots = snapshotRepository.findAllByQuestionIdOrderByNumber(questionId);
        var snapshotById = snapshots.stream().collect(Collectors.toMap(Snapshot::getId, Function.identity()));
        var parentsByChild = parentsByChild(questionId);
        var snapshotsByVersion = snapshots.stream()
                .collect(Collectors.groupingBy(Snapshot::getVersionId, Collectors.mapping(
                        snapshot -> snapshotDetail(snapshot, parentsByChild.getOrDefault(snapshot.getId(), List.of())),
                        Collectors.toList())));

        var versions = versionRepository.findAllByQuestionIdOrderByPosition(questionId).stream()
                .map(version -> versionDetail(version, snapshotById.get(version.getBaseSnapshotId()),
                        snapshotsByVersion.getOrDefault(version.getId(), List.of())))
                .toList();
        var submission = submissionRepository.findById(questionId)
                .map(answer -> new WritingHistoryDetail.Submission(answer.getBody(), answer.getSourceVersionId(),
                        answer.getSourceSnapshotId(), answer.getLabel(), answer.getUpdatedAt()))
                .orElse(null);
        return new WritingHistoryDetail(questionId, question.getActiveVersionId(), versions, submission);
    }

    /** 프론트와 같은 기본 스냅샷 이름. 화면에는 v번호 대신 이 이름이 보인다. */
    private static String defaultTitle(int number) {
        return "스냅샷 " + number;
    }

    private Map<Long, List<Long>> parentsByChild(long questionId) {
        return parentRepository.findAllByQuestionIdOrderByIdParentSnapshotId(questionId).stream()
                .map(SnapshotParent::getId)
                .collect(Collectors.groupingBy(SnapshotParentId::childSnapshotId,
                        Collectors.mapping(SnapshotParentId::parentSnapshotId, Collectors.toList())));
    }

    private List<Long> parentIdsOf(long snapshotId) {
        return parentRepository.findAllByIdChildSnapshotIdOrderByIdParentSnapshotId(snapshotId).stream()
                .map(link -> link.getId().parentSnapshotId())
                .toList();
    }

    /** 지울 스냅샷을 건너뛰며 부모를 따라 올라가 처음 만나는 남는 조상들. 순서를 지키고 겹치지 않게 모은다. */
    private static List<Long> survivors(List<Long> ids, Set<Long> removed, Map<Long, List<Long>> parentsByChild) {
        var found = new LinkedHashSet<Long>();
        var visited = new HashSet<Long>();
        var pending = new ArrayList<>(ids);
        while (!pending.isEmpty()) {
            long id = pending.removeFirst();
            if (!visited.add(id)) {
                continue;
            }
            if (removed.contains(id)) {
                pending.addAll(0, parentsByChild.getOrDefault(id, List.of()));
            } else {
                found.add(id);
            }
        }
        return List.copyOf(found);
    }

    private static Long first(List<Long> ids) {
        return ids.isEmpty() ? null : ids.getFirst();
    }

    /** 사용자가 입력한 이름은 바꾸지 않는다. 같은 문항의 다른 버전과 같으면 거절해 화면에서 알리게 한다. */
    private static String requireFreeName(String requested, Set<String> taken) {
        if (taken.contains(requested)) {
            throw new CustomException(WritingErrorCode.DUPLICATE_VERSION_NAME);
        }
        return requested;
    }

    /**
     * 이름을 비워 서버가 정하는 기본 이름(`새 버전`, `<스냅샷 이름>에서 시작`). 사용자가 입력하지 않았으므로
     * 거절하지 않고, 앞 90자만 남긴 뒤 겹치면 ` 2`, ` 3`을 붙인다.
     */
    private static String defaultName(String fallback, Set<String> taken) {
        String base = fallback;
        if (base.codePointCount(0, base.length()) > NAME_BASE_LENGTH) {
            base = base.substring(0, base.offsetByCodePoints(0, NAME_BASE_LENGTH)).strip();
        }
        String name = base;
        for (int suffix = 2; taken.contains(name); suffix++) {
            name = base + " " + suffix;
        }
        return name;
    }

    private EssayQuestion lockQuestion(long userId, long questionId) {
        long applicationId = questionRepository.findApplicationIdByQuestionAndOwner(questionId, userId)
                .orElseThrow(() -> new CustomException(ApplicationErrorCode.QUESTION_NOT_FOUND));
        applicationRepository.findWithLockByIdAndUserId(applicationId, userId)
                .orElseThrow(() -> new CustomException(ApplicationErrorCode.QUESTION_NOT_FOUND));
        return questionRepository.findById(questionId)
                .orElseThrow(() -> new CustomException(ApplicationErrorCode.QUESTION_NOT_FOUND));
    }

    private WritingVersion lockVersion(long userId, long versionId) {
        long applicationId = versionRepository.findApplicationIdByVersionAndOwner(versionId, userId)
                .orElseThrow(() -> new CustomException(WritingErrorCode.VERSION_NOT_FOUND));
        // 문항·지원 건 삭제와 같은 행을 잠근 뒤 버전을 읽어 최신 저장 번호를 검사한다.
        applicationRepository.findWithLockByIdAndUserId(applicationId, userId)
                .orElseThrow(() -> new CustomException(WritingErrorCode.VERSION_NOT_FOUND));
        return versionRepository.findById(versionId)
                .orElseThrow(() -> new CustomException(WritingErrorCode.VERSION_NOT_FOUND));
    }

    private Snapshot lockSnapshot(long userId, long snapshotId) {
        long applicationId = snapshotRepository.findApplicationIdBySnapshotAndOwner(snapshotId, userId)
                .orElseThrow(() -> new CustomException(WritingErrorCode.SNAPSHOT_NOT_FOUND));
        applicationRepository.findWithLockByIdAndUserId(applicationId, userId)
                .orElseThrow(() -> new CustomException(WritingErrorCode.SNAPSHOT_NOT_FOUND));
        return snapshotRepository.findById(snapshotId)
                .orElseThrow(() -> new CustomException(WritingErrorCode.SNAPSHOT_NOT_FOUND));
    }

    private Snapshot baseSnapshot(WritingVersion version) {
        var id = version.getBaseSnapshotId();
        return id == null ? null : snapshotRepository.findById(id).orElseThrow();
    }

    private static void requireRevision(WritingVersion version, Snapshot base, long expected) {
        if (version.getDraftRevision() != expected) {
            throw new DraftConflictException(draftDetail(version, base));
        }
    }

    private static WritingHistoryDetail.Version versionDetail(WritingVersion version, Snapshot base,
                                                              List<WritingHistoryDetail.Snapshot> snapshots) {
        return new WritingHistoryDetail.Version(version.getId(), version.getName(), version.getDescription(),
                version.getPosition(), version.getCreatedAt(), version.getFromSnapshotId(),
                draftDetail(version, base), snapshots);
    }

    private static WritingHistoryDetail.Draft draftDetail(WritingVersion version, Snapshot base) {
        String savedBody = base == null ? "" : base.getBody();
        return new WritingHistoryDetail.Draft(version.getDraftBody(), version.getBaseSnapshotId(),
                version.getDraftRevision(), version.getDraftUpdatedAt(), !version.getDraftBody().equals(savedBody));
    }

    private static WritingHistoryDetail.Snapshot snapshotDetail(Snapshot snapshot, List<Long> parentIds) {
        return new WritingHistoryDetail.Snapshot(snapshot.getId(), snapshot.getNumber(), snapshot.getTitle(),
                snapshot.getDescription(), snapshot.getBody(), snapshot.getCreatedAt(), parentIds);
    }
}
