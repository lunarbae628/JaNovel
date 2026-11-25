package com.janovel.domain.application.dao;

import com.janovel.domain.application.entity.ApplicationSection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApplicationSectionRepository extends JpaRepository<ApplicationSection, Long> {

    List<ApplicationSection> findAllByApplicationIdOrderByPosition(long applicationId);
}
