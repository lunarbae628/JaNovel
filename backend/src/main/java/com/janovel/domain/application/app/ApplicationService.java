package com.janovel.domain.application.app;

import com.janovel.domain.application.dao.ApplicationRepository;
import com.janovel.domain.application.dto.ApplicationSummary;
import com.janovel.domain.application.entity.Application;
import com.janovel.domain.user.dao.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;

    public ApplicationService(ApplicationRepository applicationRepository, UserRepository userRepository) {
        this.applicationRepository = applicationRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public ApplicationSummary create(long userId, String company, String role) {
        String companyName = company.strip();
        String roleName = role.strip();
        if (companyName.isEmpty() || companyName.length() > 100) {
            throw new IllegalArgumentException("회사명은 1자 이상 100자 이하여야 합니다.");
        }
        if (roleName.isEmpty() || roleName.length() > 150) {
            throw new IllegalArgumentException("직무는 1자 이상 150자 이하여야 합니다.");
        }

        var user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("사용자를 찾을 수 없습니다."));
        var application = applicationRepository.save(new Application(user, companyName, roleName));
        return ApplicationSummary.from(application);
    }

    @Transactional(readOnly = true)
    public List<ApplicationSummary> findAllByUser(long userId) {
        return applicationRepository.findAllByUserIdOrderByIdDesc(userId).stream()
                .map(ApplicationSummary::from)
                .toList();
    }
}
