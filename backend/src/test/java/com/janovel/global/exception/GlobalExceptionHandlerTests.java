package com.janovel.global.exception;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

class GlobalExceptionHandlerTests {

    @Test
    @DisplayName("컨트롤러 파라미터 검증에 실패하면 공통 요청 오류를 반환한다")
    void returnsInvalidRequestForMethodArgumentValidation() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new ValidationController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mvc.perform(get("/validate").param("keyword", " "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
    }

    @RestController
    static class ValidationController {

        @GetMapping("/validate")
        String validate(@RequestParam("keyword") @NotBlank String keyword) {
            return keyword;
        }
    }
}
