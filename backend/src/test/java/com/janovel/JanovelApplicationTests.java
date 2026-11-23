package com.janovel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class JanovelApplicationTests {

    @Test
    @DisplayName("백엔드 애플리케이션 컨텍스트를 시작한다")
    void contextLoads() {
    }
}
