package com.janovel.domain.application.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ApplicationRegistration(
        @NotBlank @Size(max = 100) @Pattern(regexp = "[^\\x00]*") String company,
        @NotBlank @Size(max = 150) @Pattern(regexp = "[^\\x00]*") String role,
        @Valid Deadline deadline,
        @Size(max = 2048) @Pattern(regexp = "[^\\x00]*") String sourceUrl,
        @Size(max = 30000) @Pattern(regexp = "[^\\x00]*") String sourceText,
        @Size(max = 30) List<@NotNull @Valid Section> sections,
        @Size(max = 20) List<@NotBlank @Size(max = 100) @Pattern(regexp = "[^\\x00]*") String> stages) {

    public ApplicationRegistration {
        company = company == null ? null : company.strip();
        role = role == null ? null : role.strip();
        sections = sections == null ? List.of() : sections;
        stages = stages == null ? List.of() : stages.stream().map(name -> name == null ? null : name.strip()).toList();
    }

    public record Section(@NotBlank @Size(max = 100) @Pattern(regexp = "[^\\x00]*") String title,
                          @NotNull @Size(max = 20000) @Pattern(regexp = "[^\\x00]*") String body) {
    }
}
