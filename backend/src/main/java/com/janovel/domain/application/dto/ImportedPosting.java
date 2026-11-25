package com.janovel.domain.application.dto;

import java.util.List;

public record ImportedPosting(String company, String role, String deadline, String deadlineTime,
                              List<Section> sections, List<String> stages, List<Question> questions,
                              List<Position> positions, String sourceText) {

    public record Position(String role, String deadline, String deadlineTime, List<Section> sections,
                           List<String> stages, List<Question> questions) {
    }

    public record Section(String title, String body) {
    }

    public record Question(String prompt, Integer limit) {
    }
}
