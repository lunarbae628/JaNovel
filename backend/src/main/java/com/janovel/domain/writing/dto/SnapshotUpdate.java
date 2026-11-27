package com.janovel.domain.writing.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "스냅샷 이름·설명 수정 요청. 본문은 바꿀 수 없고, 비운 값은 지운다.")
public record SnapshotUpdate(
        @Schema(description = "스냅샷 이름", nullable = true)
        @Size(max = 100) @Pattern(regexp = "[^\\u0000\\uD800-\\uDFFF]*") String title,
        @Schema(description = "스냅샷 설명", nullable = true)
        @Size(max = 2000) @Pattern(regexp = "[^\\u0000\\uD800-\\uDFFF]*") String description) {

    public SnapshotUpdate {
        title = OptionalText.normalize(title);
        description = OptionalText.normalize(description);
    }
}
