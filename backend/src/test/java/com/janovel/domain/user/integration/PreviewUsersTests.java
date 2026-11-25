package com.janovel.domain.user.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.janovel.TestcontainersConfiguration;
import com.janovel.domain.user.app.PreviewUsers;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@Transactional
class PreviewUsersTests {

    private static final String KEY = "a".repeat(64);
    private static final String OTHER_KEY = "b".repeat(64);

    @Autowired
    private PreviewUsers previewUsers;

    @Test
    @DisplayName("Bearer 뒤의 소문자 16진수 64자만 접근 키로 인정한다")
    void readsOnlyWellFormedAccessKeys() {
        assertEquals(Optional.of(KEY), previewUsers.accessKey("Bearer " + KEY));
        assertEquals(Optional.of(KEY), previewUsers.accessKey("bearer " + KEY));
        assertTrue(previewUsers.accessKey(null).isEmpty());
        assertTrue(previewUsers.accessKey("Bearer invalid").isEmpty());
        assertTrue(previewUsers.accessKey("Bearer " + KEY.toUpperCase()).isEmpty());
        assertTrue(previewUsers.accessKey("Bearer " + KEY + "a").isEmpty());
    }

    @Test
    @DisplayName("같은 접근 키는 같은 사용자를, 다른 키는 다른 사용자를 가리킨다")
    void mapsKeyToStableUser() {
        long first = previewUsers.userId(KEY);

        assertEquals(first, previewUsers.userId(KEY));
        assertNotEquals(first, previewUsers.userId(OTHER_KEY));
    }
}
