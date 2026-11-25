package com.janovel.domain.writing.dao;

import com.janovel.domain.writing.entity.EssayQuestion;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EssayQuestionRepository extends JpaRepository<EssayQuestion, Long> {

    List<EssayQuestion> findAllByApplicationIdOrderByPosition(long applicationId);
}
