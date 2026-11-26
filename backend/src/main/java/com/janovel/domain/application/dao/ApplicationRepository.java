package com.janovel.domain.application.dao;

import com.janovel.domain.application.entity.Application;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

    List<Application> findAllByUserIdOrderByIdDesc(long userId);

    Optional<Application> findByIdAndUserId(long id, long userId);

    /** 문항 순번을 정하는 동안 같은 지원 건의 다른 변경을 기다리게 한다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Application> findWithLockByIdAndUserId(long id, long userId);

    /**
     * 항목·전형·문항과 작성본은 DB의 `ON DELETE CASCADE`로 지운다. 같은 트랜잭션에 읽어 둔 하위 엔티티가
     * 지운 지원 건을 가리키지 않도록 영속성 컨텍스트를 비운다.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from Application a where a.id = :id")
    void deleteDirectly(@Param("id") long id);
}
