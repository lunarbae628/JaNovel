package com.janovel.domain.application.dao;

import com.janovel.domain.application.entity.ApplicationStage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ApplicationStageRepository extends JpaRepository<ApplicationStage, Long> {

    List<ApplicationStage> findAllByApplicationIdOrderByPosition(long applicationId);

    /** 전형 순번 유니크 제약은 DEFERRABLE이라 순서를 바꾸는 동안 검사를 미룬다. */
    @Modifying
    @Query(value = "SET CONSTRAINTS application_stages_application_id_position_key DEFERRED", nativeQuery = true)
    void deferPositionCheck();

    /** 미뤄 둔 순번 검사를 지금 실행해 충돌이 있으면 이 요청에서 실패하게 한다. */
    @Modifying
    @Query(value = "SET CONSTRAINTS application_stages_application_id_position_key IMMEDIATE", nativeQuery = true)
    void checkPositions();
}
