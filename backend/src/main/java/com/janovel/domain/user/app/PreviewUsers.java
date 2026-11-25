package com.janovel.domain.user.app;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PreviewUsers {

    private static final Pattern BEARER_KEY = Pattern.compile("(?i:Bearer) ([0-9a-f]{64})");

    private final JdbcClient jdbc;

    public PreviewUsers(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<String> accessKey(String authorization) {
        var match = BEARER_KEY.matcher(authorization == null ? "" : authorization);
        return match.matches() ? Optional.of(match.group(1)) : Optional.empty();
    }

    public static String ownerEmail(String key) {
        HexFormat hex = HexFormat.of();
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(hex.parseHex(key));
            return "essay-template+" + hex.formatHex(hash) + "@janovel.invalid";
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    @Transactional
    public long userId(String key) {
        String email = ownerEmail(key);
        jdbc.sql("""
                INSERT INTO users (email, name) VALUES (:email, '미리보기 사용자')
                ON CONFLICT (email) DO NOTHING
                """)
                .param("email", email)
                .update();
        return jdbc.sql("SELECT id FROM users WHERE email = :email")
                .param("email", email)
                .query(Long.class)
                .single();
    }
}
