package com.janovel.domain.application.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.janovel.domain.application.model.DeadlineKind;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

class ApplicationRegistrationTests {

    private final JsonMapper json = JsonMapper.builder().build();
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private boolean valid(String body) {
        return validator.validate(json.readValue(body, ApplicationRegistration.class)).isEmpty();
    }

    @Test
    @DisplayName("회사와 직무만 있어도 받고 앞뒤 공백을 제거하며 목록은 빈 배열로 둔다")
    void acceptsMinimalRequest() {
        var request = json.readValue("{\"company\":\"  예시 회사 \",\"role\":\" 백엔드 \"}", ApplicationRegistration.class);

        assertTrue(validator.validate(request).isEmpty());
        assertEquals("예시 회사", request.company());
        assertEquals("백엔드", request.role());
        assertTrue(request.sections().isEmpty());
        assertTrue(request.stages().isEmpty());
    }

    @Test
    @DisplayName("고정 마감은 날짜가 있어야 하고 시각은 HH:mm으로 읽는다")
    void readsFixedDeadline() {
        var request = json.readValue("""
                {"company":"A","role":"B","deadline":{"kind":"fixed","date":"2026-12-16","time":"23:59"}}
                """, ApplicationRegistration.class);

        assertTrue(validator.validate(request).isEmpty());
        assertEquals(new Deadline(DeadlineKind.FIXED, LocalDate.of(2026, 12, 16), LocalTime.of(23, 59)),
                request.deadline());
    }

    @Test
    @DisplayName("마감 종류와 날짜 조합이 맞지 않으면 거부한다")
    void rejectsInconsistentDeadline() {
        assertFalse(valid("{\"company\":\"A\",\"role\":\"B\",\"deadline\":{\"kind\":\"fixed\"}}"));
        assertFalse(valid("{\"company\":\"A\",\"role\":\"B\",\"deadline\":{\"kind\":\"always_open\",\"date\":\"2026-12-16\"}}"));
        assertFalse(valid("{\"company\":\"A\",\"role\":\"B\",\"deadline\":{\"kind\":\"rolling\",\"time\":\"10:00\"}}"));
        assertTrue(valid("{\"company\":\"A\",\"role\":\"B\",\"deadline\":{\"kind\":\"until_filled\"}}"));
    }

    @Test
    @DisplayName("공백뿐인 회사나 긴 직무, 제어 문자가 든 값은 거부한다")
    void rejectsInvalidText() {
        assertFalse(valid("{\"company\":\"   \",\"role\":\"B\"}"));
        assertFalse(valid("{\"company\":\"A\",\"role\":\"" + "가".repeat(151) + "\"}"));
        assertFalse(valid("{\"company\":\"A\\u0000\",\"role\":\"B\"}"));
        assertFalse(valid("{\"company\":\"A\",\"role\":\"B\",\"sections\":[{\"title\":\"\",\"body\":\"본문\"}]}"));
    }

    @Test
    @DisplayName("항목은 30개, 전형은 20개까지만 받는다")
    void limitsListSizes() {
        String sections = IntStream.range(0, 31).mapToObj(index -> "{\"title\":\"t\",\"body\":\"b\"}")
                .collect(Collectors.joining(","));
        String stages = IntStream.range(0, 21).mapToObj(index -> "\"단계\"").collect(Collectors.joining(","));

        assertFalse(valid("{\"company\":\"A\",\"role\":\"B\",\"sections\":[" + sections + "]}"));
        assertFalse(valid("{\"company\":\"A\",\"role\":\"B\",\"stages\":[" + stages + "]}"));
    }

    @Test
    @DisplayName("문항은 앞뒤 공백을 제거하고 글자 수 제한을 생략하면 null로 읽는다")
    void readsQuestions() {
        var request = json.readValue("""
                {"company":"A","role":"B","questions":[{"prompt":"  지원 동기 "},{"prompt":"협업","limit":800}]}
                """, ApplicationRegistration.class);

        assertTrue(validator.validate(request).isEmpty());
        assertEquals("지원 동기", request.questions().get(0).prompt());
        assertNull(request.questions().get(0).limit());
        assertEquals(800, request.questions().get(1).limit());
    }

    @Test
    @DisplayName("문항이 공백이거나 글자 수 제한이 범위 밖이면 거부하고 정수가 아니면 읽지 못한다")
    void rejectsInvalidQuestions() {
        assertFalse(valid("{\"company\":\"A\",\"role\":\"B\",\"questions\":[{\"prompt\":\" \"}]}"));
        assertFalse(valid("{\"company\":\"A\",\"role\":\"B\",\"questions\":[{\"prompt\":\"문항\",\"limit\":0}]}"));
        assertFalse(valid("{\"company\":\"A\",\"role\":\"B\",\"questions\":[{\"prompt\":\"문항\",\"limit\":100001}]}"));
        assertThrows(JacksonException.class, () ->
                json.readValue("{\"company\":\"A\",\"role\":\"B\",\"questions\":[{\"prompt\":\"문항\",\"limit\":500.5}]}",
                        ApplicationRegistration.class));
    }
}
