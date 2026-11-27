package com.janovel.domain.writing.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

@Schema(description = "문항의 작성 이력")
public record WritingHistoryDetail(
        long questionId,
        @Schema(nullable = true) Long activeVersionId,
        List<Version> versions,
        @Schema(nullable = true) Submission submission) {

    @Schema(name = "WritingHistoryVersion", description = "작성 버전과 시간순 스냅샷")
    public record Version(long id, String name, @Schema(nullable = true) String description,
                          int position, Instant createdAt, @Schema(nullable = true) Long fromSnapshotId,
                          Draft draft, List<Snapshot> snapshots) {
    }

    @Schema(name = "WritingDraft", description = "자동 저장되는 초안")
    public record Draft(String body, @Schema(nullable = true) Long baseSnapshotId,
                        long revision, Instant updatedAt, boolean dirty) {
    }

    @Schema(name = "WritingSnapshot", description = "저장 시점에 고정한 본문")
    public record Snapshot(long id, int number, @Schema(nullable = true) String title,
                           @Schema(nullable = true) String description, String body, Instant createdAt,
                           List<Long> parentIds) {
    }

    @Schema(name = "WritingSubmission", description = "문항의 제출본")
    public record Submission(String body, @Schema(nullable = true) Long sourceVersionId,
                             @Schema(nullable = true) Long sourceSnapshotId,
                             @Schema(nullable = true) String label, Instant updatedAt) {
    }

    @Schema(name = "WritingVersionInfo", description = "이름·설명을 고친 뒤의 버전. 이름이 겹쳐 번호가 붙었을 수 있다.")
    public record VersionInfo(long id, String name, @Schema(nullable = true) String description) {
    }

    @Schema(name = "WritingSnapshotInfo", description = "이름·설명을 고친 뒤의 스냅샷")
    public record SnapshotInfo(long id, String title, @Schema(nullable = true) String description) {
    }

    @Schema(description = "새 스냅샷과 저장 번호가 갱신된 초안")
    public record SnapshotSaved(Snapshot snapshot, Draft draft) {
    }
}
