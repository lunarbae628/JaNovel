package com.janovel.domain.application.dao;

import com.janovel.domain.application.entity.ApplicationSection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApplicationSectionRepository extends JpaRepository<ApplicationSection, Long> {

    List<ApplicationSection> findAllByApplicationIdOrderByPosition(long applicationId);

    /** 바로 실행해 같은 순번으로 새 항목을 넣을 때 유니크 인덱스와 겹치지 않게 한다. */
    @Modifying(flushAutomatically = true)
    @Query("delete from ApplicationSection s where s.application.id = :applicationId")
    void deleteAllByApplicationId(@Param("applicationId") long applicationId);
}
