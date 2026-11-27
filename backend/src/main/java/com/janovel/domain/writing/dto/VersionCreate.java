package com.janovel.domain.writing.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.janovel.domain.application.dto.StrictId;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

@Schema(description = "새 버전 요청. 스냅샷 id를 주면 그 스냅샷 본문에서 시작하고, 없으면 빈 버전이다.")
public record VersionCreate(
        @Schema(description = "버전 이름. 비우면 `새 버전` 또는 `<스냅샷 이름>에서 시작`이며 기본 이름끼리 겹치면 뒤에 번호를 붙인다. 입력한 이름이 다른 버전과 같으면 `409 DUPLICATE_VERSION_NAME`이다.", nullable = true)
        @Size(max = 100) @Pattern(regexp = "[^\\u0000\\uD800-\\uDFFF]*") String name,
        @Schema(description = "버전 설명", nullable = true)
        @Size(max = 2000) @Pattern(regexp = "[^\\u0000\\uD800-\\uDFFF]*") String description,
        @Schema(description = "시작할 스냅샷의 id(`snapshots[].id`). v번호가 아니다. 같은 문항의 스냅샷만 고를 수 있다.", nullable = true) Long fromSnapshotId) {

    public VersionCreate {
        name = OptionalText.normalize(name);
        description = OptionalText.normalize(description);
    }

    @JsonCreator
    public static VersionCreate fromJson(@JsonProperty("name") String name,
                                         @JsonProperty("description") String description,
                                         @JsonProperty("fromSnapshotId") JsonNode fromSnapshotId) {
        return new VersionCreate(name, description, StrictId.parse(fromSnapshotId));
    }
}
