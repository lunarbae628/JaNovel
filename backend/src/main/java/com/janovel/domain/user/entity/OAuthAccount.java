package com.janovel.domain.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import org.hibernate.annotations.Generated;

@Entity
@Table(name = "oauth_accounts")
public class OAuthAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String provider;

    @Column(name = "provider_user_id", nullable = false)
    private String providerUserId;

    @Generated
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected OAuthAccount() {
    }

    public OAuthAccount(User user, String provider, String providerUserId) {
        this.user = Objects.requireNonNull(user, "user");
        this.provider = Objects.requireNonNull(provider, "provider");
        this.providerUserId = Objects.requireNonNull(providerUserId, "providerUserId");
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = Objects.requireNonNull(user, "user");
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = Objects.requireNonNull(provider, "provider");
    }

    public String getProviderUserId() {
        return providerUserId;
    }

    public void setProviderUserId(String providerUserId) {
        this.providerUserId = Objects.requireNonNull(providerUserId, "providerUserId");
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
