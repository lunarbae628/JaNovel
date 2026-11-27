package com.janovel.domain.writing.dao;

import com.janovel.domain.writing.entity.WritingVersion;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WritingVersionRepository extends JpaRepository<WritingVersion, Long> {

    List<WritingVersion> findAllByQuestionIdOrderByPosition(long questionId);

    /** 이름 중복만 확인하려고 다른 버전의 이름만 읽는다. 초안 본문은 읽지 않는다. */
    @Query("select v.name from WritingVersion v where v.question.id = :questionId and v.id <> :excludedId")
    Set<String> findNamesByQuestionIdExcept(@Param("questionId") long questionId, @Param("excludedId") long excludedId);

    @Query("select coalesce(max(v.position), 0) from WritingVersion v where v.question.id = :questionId")
    int maxPosition(@Param("questionId") long questionId);

    @Query("""
            select v.question.application.id from WritingVersion v
            where v.id = :versionId and v.question.application.user.id = :userId
            """)
    Optional<Long> findApplicationIdByVersionAndOwner(@Param("versionId") long versionId,
                                                     @Param("userId") long userId);

    /**
     * 스냅샷과 부모 연결은 DB의 `ON DELETE CASCADE`로, 다른 기록의 참조는 `ON DELETE SET NULL`로 정리된다.
     * 지운 버전을 가리키는 엔티티가 남지 않도록 영속성 컨텍스트를 비운다.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from WritingVersion v where v.id = :id")
    void deleteDirectly(@Param("id") long id);
}
