package com.janovel.domain.application.dao;

import com.janovel.domain.application.entity.Application;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

    List<Application> findAllByUserIdOrderByIdDesc(long userId);

    Optional<Application> findByIdAndUserId(long id, long userId);
}
