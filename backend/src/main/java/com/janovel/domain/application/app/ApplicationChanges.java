package com.janovel.domain.application.app;

import com.janovel.domain.application.dao.ApplicationRepository;
import com.janovel.domain.application.entity.Application;
import com.janovel.domain.application.exception.ApplicationErrorCode;
import com.janovel.global.exception.CustomException;
import org.springframework.stereotype.Component;

/** 지원 건을 고치기 전에 행을 잠그고, 보낸 버전이 지금 버전과 다르면 거절한 뒤 버전을 올린다. */
@Component
public class ApplicationChanges {

    private final ApplicationRepository applicationRepository;

    public ApplicationChanges(ApplicationRepository applicationRepository) {
        this.applicationRepository = applicationRepository;
    }

    /** 다른 탭이나 기기에서 먼저 고쳤으면 {@code expectedVersion}이 지금 버전과 달라 409다. {@code null}이면 확인하지 않는다. */
    public Application begin(long userId, long applicationId, Long expectedVersion) {
        var application = applicationRepository.findWithLockByIdAndUserId(applicationId, userId)
                .orElseThrow(() -> new CustomException(ApplicationErrorCode.APPLICATION_NOT_FOUND));
        if (expectedVersion != null && expectedVersion != application.getVersion()) {
            throw new CustomException(ApplicationErrorCode.APPLICATION_CONFLICT);
        }
        application.increaseVersion();
        return application;
    }
}
