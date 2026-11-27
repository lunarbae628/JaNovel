package com.janovel.domain.writing.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.janovel.domain.application.dto.StrictId;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.stream.Stream;
import java.util.Objects;
import tools.jackson.databind.JsonNode;

@Schema(description = """
        제출본 지정·교체·직접 수정 요청. 셋 중 하나만 보낸다.
        `snapshotId`는 그 스냅샷 본문을, `versionId`는 그 버전의 지금 초안을 복사해 제출본으로 지정한다.
        `body`는 지정된 제출본의 본문만 고친다. 원본 버전을 고쳐도 제출본은 바뀌지 않는다.""")
public record SubmissionChange(
        @Schema(description = "제출본으로 쓸 스냅샷 id", nullable = true) Long snapshotId,
        @Schema(description = "지금 초안을 제출본으로 쓸 버전 id", nullable = true) Long versionId,
        @Schema(description = "직접 고친 제출본 본문. 최대 100,000자", nullable = true)
        @Size(max = 100_000) @Pattern(regexp = "[^\\u0000\\uD800-\\uDFFF]*") String body) {

    @JsonIgnore
    @AssertTrue(message = "snapshotId, versionId, body 중 하나만 보내 주세요.")
    public boolean isSingleSource() {
        return Stream.of(snapshotId, versionId, body).filter(Objects::nonNull).count() == 1;
    }

    @JsonCreator
    public static SubmissionChange fromJson(@JsonProperty("snapshotId") JsonNode snapshotId,
                                            @JsonProperty("versionId") JsonNode versionId,
                                            @JsonProperty("body") JsonNode body) {
        return new SubmissionChange(StrictId.parse(snapshotId), StrictId.parse(versionId),
                body == null || body.isNull() ? null : body.stringValue());
    }
}
