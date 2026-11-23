package com.janovel.domain.application.app;

import com.janovel.domain.application.client.PostingPageClient;
import com.janovel.domain.application.dto.ImportedPosting;
import com.janovel.domain.application.exception.PostingErrorCode;
import com.janovel.global.exception.CustomException;
import java.io.IOException;
import java.net.SocketTimeoutException;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.TextNode;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.MissingNode;

@Service
public class PostingImportService {

    private static final Pattern DATE_PREFIX = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}(?=T|$)");

    private final PostingPageClient pageClient;
    private final JsonMapper jsonMapper;

    public PostingImportService(PostingPageClient pageClient, JsonMapper jsonMapper) {
        this.pageClient = pageClient;
        this.jsonMapper = jsonMapper;
    }

    public ImportedPosting importPosting(String url) {
        Document page = fetchPage(url);
        JsonNode job = readJobPosting(page);

        String role = job.path("title").asString("");
        Element heading = page.selectFirst("h1");
        if (role.isBlank() && heading != null) {
            role = heading.text();
        }
        if (role.isBlank()) {
            Element metaTitle = page.selectFirst("meta[property=og:title]");
            role = metaTitle != null ? metaTitle.attr("content") : "";
        }

        String company = job.path("hiringOrganization").path("name").asString("");
        var dateMatcher = DATE_PREFIX.matcher(job.path("validThrough").asString(""));
        String deadline = dateMatcher.find() ? dateMatcher.group() : "";
        String description = job.path("description").asString("");
        String structuredText = postingText(Jsoup.parseBodyFragment(description).body());

        page.select("header,nav,footer,aside,form").remove();
        Element main = page.selectFirst("main, article, [role=main]");
        String visibleText = main != null ? postingText(main) : "";
        if (visibleText.isBlank()) {
            visibleText = postingText(page.body());
        }

        String sourceText = structuredText;
        if (structuredText.isEmpty()
                || (visibleText.length() > structuredText.length()
                    && visibleText.contains(structuredText.lines().findFirst().orElseThrow()))) {
            sourceText = visibleText;
        }
        if (sourceText.isBlank()) {
            throw new CustomException(PostingErrorCode.POSTING_UNREADABLE);
        }

        return new ImportedPosting(
                limit(company.strip(), 100),
                limit(role.strip(), 150),
                deadline,
                limit(sourceText, 30_000)
        );
    }

    private Document fetchPage(String url) {
        try {
            return pageClient.fetch(url);
        } catch (IllegalArgumentException exception) {
            throw new CustomException(PostingErrorCode.INVALID_POSTING_URL, exception);
        } catch (SocketTimeoutException exception) {
            throw new CustomException(PostingErrorCode.POSTING_TIMEOUT, exception);
        } catch (IOException exception) {
            throw new CustomException(PostingErrorCode.POSTING_UNREADABLE, exception);
        }
    }

    private JsonNode readJobPosting(Document page) {
        for (Element script : page.select("script[type=application/ld+json]")) {
            try {
                JsonNode job = findJobPosting(jsonMapper.readTree(script.data()));
                if (job != null) {
                    return job;
                }
            } catch (JacksonException ignored) {
                // Other metadata and the visible posting can still be read.
            }
        }
        return MissingNode.getInstance();
    }

    private JsonNode findJobPosting(JsonNode node) {
        if (node == null) {
            return null;
        }
        if (node.isArray()) {
            for (JsonNode item : node) {
                JsonNode job = findJobPosting(item);
                if (job != null) {
                    return job;
                }
            }
            return null;
        }
        if (!node.isObject()) {
            return null;
        }

        JsonNode type = node.path("@type");
        if (isJobPostingType(type)) {
            return node;
        }
        if (type.isArray()) {
            for (JsonNode item : type) {
                if (isJobPostingType(item)) {
                    return node;
                }
            }
        }
        return findJobPosting(node.path("@graph"));
    }

    private boolean isJobPostingType(JsonNode node) {
        String name = node.asString("");
        return name.substring(name.lastIndexOf('/') + 1).equals("JobPosting");
    }

    private String postingText(Element element) {
        Element content = element.clone();
        content.select("script,style,noscript,template,[hidden]").remove();
        content.select("h1,h2,h3,h4,h5,h6,p,li,tr,div,section,blockquote")
                .forEach(block -> block.after(new TextNode("\n")));
        return content.wholeText().lines()
                .map(String::strip)
                .filter(line -> !line.isEmpty())
                .collect(Collectors.joining("\n"));
    }

    private String limit(String value, int length) {
        return value.substring(0, Math.min(value.length(), length));
    }
}
