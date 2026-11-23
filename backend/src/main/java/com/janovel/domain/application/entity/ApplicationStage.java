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
@Table(name = "application_stages")
public class ApplicationStage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    @Column(nullable = false, columnDefinition = "text")
    private String name;

    @Column(nullable = false)
    private int position;

    protected ApplicationStage() {
    }

    public ApplicationStage(Application application, String name, int position) {
        this.application = Objects.requireNonNull(application, "application");
        this.name = Objects.requireNonNull(name, "name");
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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = Objects.requireNonNull(name, "name");
    }

    public int getPosition() {
        return position;
    }

    public void setPosition(int position) {
        this.position = position;
    }
}
