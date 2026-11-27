package com.janovel.domain.writing.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "버전 이름·설명 수정 요청. 이름을 비우면 지금 이름을 유지하고, 설명을 비우면 지운다.")
public record VersionUpdate(
        @Schema(description = "버전 이름. 다른 버전과 같으면 `409 DUPLICATE_VERSION_NAME`이다.", nullable = true)
        @Size(max = 100) @Pattern(regexp = "[^\\u0000\\uD800-\\uDFFF]*") String name,
        @Schema(description = "버전 설명", nullable = true)
        @Size(max = 2000) @Pattern(regexp = "[^\\u0000\\uD800-\\uDFFF]*") String description) {

    public VersionUpdate {
        name = OptionalText.normalize(name);
        description = OptionalText.normalize(description);
    }
}
