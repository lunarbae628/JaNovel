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

    long countByApplicationId(long applicationId);

    @Query("select coalesce(max(q.position), 0) from EssayQuestion q where q.application.id = :applicationId")
    int maxPosition(@Param("applicationId") long applicationId);

    /** 순번에 유니크 인덱스가 있어 재배치 전에 음수로 비워 둔다. 영속성 컨텍스트도 함께 비운다. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update EssayQuestion q set q.position = -q.position where q.application.id = :applicationId")
    void negatePositions(@Param("applicationId") long applicationId);
}
