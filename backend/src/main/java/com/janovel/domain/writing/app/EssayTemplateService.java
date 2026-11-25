package com.janovel.domain.writing.app;

import com.janovel.domain.writing.dto.EssayTemplate;
import com.janovel.domain.writing.dto.EssayTemplate.Item;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Types;
import java.util.HexFormat;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Profile("local")
@Service
public class EssayTemplateService {

    private final JdbcClient jdbc;

    public EssayTemplateService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public EssayTemplate find(String key) {
        List<Item> items = jdbc.sql("""
                SELECT item.prompt, item.draft_body, item.char_limit
                FROM user_essay_template_items item
                JOIN users owner ON owner.id = item.user_id
                WHERE owner.email = :email
                ORDER BY item.position
                """)
                .param("email", ownerEmail(key))
                .query((row, index) -> new Item(row.getString("prompt"), row.getString("draft_body"),
                        row.getObject("char_limit", Integer.class)))
                .list();
        return new EssayTemplate(items);
    }

    @Transactional
    public void replace(String key, List<Item> items) {
        String email = ownerEmail(key);
        jdbc.sql("""
                INSERT INTO users (email, name) VALUES (:email, '공통 자소서 미리보기')
                ON CONFLICT (email) DO NOTHING
                """)
                .param("email", email)
                .update();
        long userId = jdbc.sql("SELECT id FROM users WHERE email = :email FOR UPDATE")
                .param("email", email)
                .query(Long.class)
                .single();

        jdbc.sql("DELETE FROM user_essay_template_items WHERE user_id = :userId")
                .param("userId", userId)
                .update();
        for (int index = 0; index < items.size(); index++) {
            Item item = items.get(index);
            jdbc.sql("""
                    INSERT INTO user_essay_template_items (user_id, position, prompt, draft_body, char_limit)
                    VALUES (:userId, :position, :prompt, :draftBody, :charLimit)
                    """)
                    .param("userId", userId)
                    .param("position", index + 1)
                    .param("prompt", item.prompt().strip())
                    .param("draftBody", item.draftBody())
                    .param("charLimit", item.limit(), Types.INTEGER)
                    .update();
        }
    }

    private String ownerEmail(String key) {
        HexFormat hex = HexFormat.of();
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(hex.parseHex(key));
            return "essay-template+" + hex.formatHex(hash) + "@janovel.invalid";
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
