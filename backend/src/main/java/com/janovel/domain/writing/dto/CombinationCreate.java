package com.janovel.domain.writing.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

@Schema(description = "두 본문을 조합한 결과로 새 버전을 만드는 요청. 출처는 저장하지 않는다.")
public record CombinationCreate(
        @Schema(description = "조합한 본문. 새 버전의 초안이자 첫 스냅샷 본문이 된다.")
        @NotNull @Size(max = 100_000) @Pattern(regexp = "[^\\u0000\\uD800-\\uDFFF]*") String body,
        @Schema(description = "새 버전 이름. 비우면 `합친 버전`이고 기본 이름끼리 겹치면 번호를 붙인다. 입력한 이름이 겹치면 `409 DUPLICATE_VERSION_NAME`이다.", nullable = true)
        @Size(max = 100) @Pattern(regexp = "[^\\u0000\\uD800-\\uDFFF]*") String name,
        @Schema(description = "새 버전 설명. 첫 스냅샷 설명으로도 쓴다.", nullable = true)
        @Size(max = 2000) @Pattern(regexp = "[^\\u0000\\uD800-\\uDFFF]*") String description) {

    public CombinationCreate {
        name = OptionalText.normalize(name);
        description = OptionalText.normalize(description);
    }

    @JsonCreator
    public static CombinationCreate fromJson(@JsonProperty("body") JsonNode body, @JsonProperty("name") String name,
                                             @JsonProperty("description") String description) {
        return new CombinationCreate(body == null || body.isNull() ? null : body.stringValue(), name, description);
    }
}
