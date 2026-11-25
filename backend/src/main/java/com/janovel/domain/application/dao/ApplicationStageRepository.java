package com.janovel.domain.application.dao;

import com.janovel.domain.application.entity.ApplicationStage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApplicationStageRepository extends JpaRepository<ApplicationStage, Long> {

    List<ApplicationStage> findAllByApplicationIdOrderByPosition(long applicationId);
}
