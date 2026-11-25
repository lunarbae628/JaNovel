package com.janovel.domain.writing.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.janovel.domain.writing.dto.EssayTemplate.Item;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

class EssayTemplateTests {

    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    @DisplayName("글자 수 제한이 없거나 정수로 주어진 양식을 읽는다")
    void readsItemsWithOptionalLimit() {
        EssayTemplate template = json.readValue("""
                {"items":[
                  {"prompt":"지원 동기","draftBody":"초안","limit":null},
                  {"prompt":"협업 경험","draftBody":"","limit":800},
                  {"prompt":"성장 과정","draftBody":""}
                ]}
                """, EssayTemplate.class);

        assertEquals(List.of(new Item("지원 동기", "초안", null), new Item("협업 경험", "", 800),
                new Item("성장 과정", "", null)), template.items());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"items\":[{\"prompt\":123,\"draftBody\":\"초안\",\"limit\":500}]}",
            "{\"items\":[{\"prompt\":\"지원 동기\",\"draftBody\":true,\"limit\":500}]}",
            "{\"items\":[{\"prompt\":\"지원 동기\",\"draftBody\":\"초안\",\"limit\":\"500\"}]}",
            "{\"items\":[{\"prompt\":\"지원 동기\",\"draftBody\":\"초안\",\"limit\":500.5}]}"
    })
    @DisplayName("문항과 초안은 문자열로, 글자 수 제한은 정수로만 받는다")
    void rejectsMismatchedJsonTypes(String body) {
        assertThrows(JacksonException.class, () -> json.readValue(body, EssayTemplate.class));
    }
}
