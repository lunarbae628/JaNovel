package com.janovel.domain.application.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.Objects;

@Entity
@Table(name = "application_sections")
public class ApplicationSection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    @Column(nullable = false, columnDefinition = "text")
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(nullable = false)
    private int position;

    protected ApplicationSection() {
    }

    public ApplicationSection(Application application, String title, String body, int position) {
        this.application = Objects.requireNonNull(application, "application");
        this.title = Objects.requireNonNull(title, "title");
        this.body = Objects.requireNonNull(body, "body");
        this.position = position;
    }

    public Long getId() {
        return id;
    }

    public Application getApplication() {
        return application;
    }

    public void setApplication(Application application) {
        this.application = Objects.requireNonNull(application, "application");
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = Objects.requireNonNull(title, "title");
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = Objects.requireNonNull(body, "body");
    }

    public int getPosition() {
        return position;
    }

    public void setPosition(int position) {
        this.position = position;
    }
}
