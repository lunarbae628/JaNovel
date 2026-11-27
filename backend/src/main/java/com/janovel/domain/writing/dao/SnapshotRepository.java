package com.janovel.domain.writing.dao;

import com.janovel.domain.writing.entity.Snapshot;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SnapshotRepository extends JpaRepository<Snapshot, Long> {

    List<Snapshot> findAllByQuestionIdOrderByNumber(long questionId);

    @Query("select s.id from Snapshot s where s.versionId = :versionId")
    List<Long> findIdsByVersionId(@Param("versionId") long versionId);

    @Query("select coalesce(max(s.number), 0) from Snapshot s where s.questionId = :questionId")
    int maxNumber(@Param("questionId") long questionId);

    @Query("select coalesce(max(s.number), 0) from Snapshot s where s.versionId = :versionId")
    int maxNumberInVersion(@Param("versionId") long versionId);

    @Query("""
            select q.application.id from Snapshot s, EssayQuestion q
            where s.id = :snapshotId and q.id = s.questionId and q.application.user.id = :userId
            """)
    Optional<Long> findApplicationIdBySnapshotAndOwner(@Param("snapshotId") long snapshotId,
                                                      @Param("userId") long userId);
}
