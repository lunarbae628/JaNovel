package com.janovel.domain.application.dao;

import com.janovel.domain.application.entity.Application;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

    List<Application> findAllByUserIdOrderByIdDesc(long userId);

    Optional<Application> findByIdAndUserId(long id, long userId);

    /** 문항 순번을 정하는 동안 같은 지원 건의 다른 변경을 기다리게 한다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Application> findWithLockByIdAndUserId(long id, long userId);
}
