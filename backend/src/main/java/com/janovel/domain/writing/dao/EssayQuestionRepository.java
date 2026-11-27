package com.janovel.domain.writing.dao;

import com.janovel.domain.writing.entity.EssayQuestion;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EssayQuestionRepository extends JpaRepository<EssayQuestion, Long> {

    List<EssayQuestion> findAllByApplicationIdOrderByPosition(long applicationId);

    Optional<EssayQuestion> findByIdAndApplicationId(long id, long applicationId);

    Optional<EssayQuestion> findByIdAndApplicationUserId(long id, long userId);

    @Query("select q.application.id from EssayQuestion q where q.id = :questionId and q.application.user.id = :userId")
    Optional<Long> findApplicationIdByQuestionAndOwner(@Param("questionId") long questionId, @Param("userId") long userId);

    long countByApplicationId(long applicationId);

    @Query("select coalesce(max(q.position), 0) from EssayQuestion q where q.application.id = :applicationId")
    int maxPosition(@Param("applicationId") long applicationId);

    /** 순번에 유니크 인덱스가 있어 재배치 전에 음수로 비워 둔다. 영속성 컨텍스트도 함께 비운다. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update EssayQuestion q set q.position = -q.position where q.application.id = :applicationId")
    void negatePositions(@Param("applicationId") long applicationId);

    /**
     * 버전·스냅샷·제출본은 DB의 `ON DELETE CASCADE`로 지운다. 같은 트랜잭션에 읽어 둔 버전이
     * 지운 문항을 가리키지 않도록 영속성 컨텍스트를 비운다.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from EssayQuestion q where q.id = :id")
    void deleteDirectly(@Param("id") long id);
}
