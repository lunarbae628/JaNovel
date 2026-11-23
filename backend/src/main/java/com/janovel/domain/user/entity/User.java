package com.janovel.domain.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import org.hibernate.annotations.Generated;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String name;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(nullable = false)
    private String timezone = "Asia/Seoul";

    @Generated
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected User() {
    }

    public User(String email, String name) {
        this.email = Objects.requireNonNull(email, "email");
        this.name = Objects.requireNonNull(name, "name");
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = Objects.requireNonNull(email, "email");
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = Objects.requireNonNull(name, "name");
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = Objects.requireNonNull(timezone, "timezone");
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
