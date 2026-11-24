package com.janovel.domain.application.app;

import com.janovel.domain.application.client.PostingBrowserClient;
import com.janovel.domain.application.client.PostingOcrClient;
import com.janovel.domain.application.client.PostingPageClient;
import com.janovel.domain.application.dto.ImportedPosting;
import com.janovel.domain.application.exception.PostingErrorCode;
import com.janovel.global.exception.CustomException;
import java.net.URI;
import java.net.SocketTimeoutException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
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
    private static final Pattern BODY_SECTION = Pattern.compile(
            "주요\\s*업무|담당\\s*업무|지원\\s*(자격|요건)|자격\\s*요건|모집\\s*부문|우대\\s*사항|"
                    + "responsibilities|qualifications|requirements", Pattern.CASE_INSENSITIVE);

    private final PostingPageClient pageClient;
    private final PostingBrowserClient browserClient;
    private final PostingOcrClient ocrClient;
    private final JsonMapper jsonMapper;
    private final Semaphore availableHttpRequests = new Semaphore(8);

    public PostingImportService(PostingPageClient pageClient, PostingBrowserClient browserClient,
                                PostingOcrClient ocrClient, JsonMapper jsonMapper) {
        this.pageClient = pageClient;
        this.browserClient = browserClient;
        this.ocrClient = ocrClient;
        this.jsonMapper = jsonMapper;
    }

    public ImportedPosting importPosting(String url) {
        try {
            ImportedPosting initial = extract(fetchPage(url));
            if (initial != null) {
                return initial;
            }
        } catch (CustomException exception) {
            if (exception.getErrorCode() != PostingErrorCode.POSTING_UNREADABLE
                    && exception.getErrorCode() != PostingErrorCode.POSTING_TIMEOUT) {
                throw exception;
            }
        }
        ImportedPosting rendered = extract(browserClient.render(url));
        if (rendered == null) {
            throw new CustomException(PostingErrorCode.POSTING_UNREADABLE);
        }
        return rendered;
    }

    public ImportedPosting retryWithImage(String url, long deadline) {
        return importImage(browserClient.capture(url, deadline), "image/png", deadline);
    }

    public ImportedPosting importImage(byte[] image, String contentType, long deadline) {
        String text = ocrClient.read(image, contentType, deadline).strip();
        if (text.isBlank()) {
            throw new CustomException(PostingErrorCode.POSTING_TEXT_NOT_FOUND);
        }
        return new ImportedPosting("", "", "", limit(text, 30_000));
    }

    private ImportedPosting extract(Document page) {
        JsonNode job = readJobPosting(page);

        String role = job.path("title").asString("");
        String company = job.path("hiringOrganization").path("name").asString("");
        boolean nhnCareers = "careers.nhn.com".equals(URI.create(page.location()).getHost());
        if (nhnCareers) {
            var title = page.select("main header h5 > span");
            if (title.size() >= 2) {
                company = title.get(0).text().replaceFirst("^\\[(.*)]$", "$1");
                role = title.get(1).text();
            }
        }
        Element heading = page.selectFirst("h1");
        if (role.isBlank() && heading != null) {
            role = heading.text();
        }
        if (role.isBlank()) {
            Element metaTitle = page.selectFirst("meta[property=og:title]");
            role = metaTitle != null ? metaTitle.attr("content") : "";
        }

        var dateMatcher = DATE_PREFIX.matcher(job.path("validThrough").asString(""));
        String deadline = dateMatcher.find() ? dateMatcher.group() : "";
        String description = job.path("description").asString("");
        String structuredText = postingText(Jsoup.parseBodyFragment(description).body());

        page.select("header,nav,footer,aside,form").remove();
        Element main = nhnCareers ? page.selectFirst("main article") : null;
        if (main == null) {
            main = page.selectFirst("main, article, [role=main]");
        }
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
        if (structuredText.isBlank() && !BODY_SECTION.matcher(sourceText).find()) {
            return null;
        }

        return new ImportedPosting(
                limit(company.strip(), 100),
                limit(role.strip(), 150),
                deadline,
                limit(sourceText, 30_000)
        );
    }

    private Document fetchPage(String url) {
        if (!availableHttpRequests.tryAcquire()) {
            throw new CustomException(PostingErrorCode.POSTING_IMPORT_BUSY);
        }
        var request = new FutureTask<>(() -> pageClient.fetch(url));
        Thread.startVirtualThread(() -> {
            try {
                request.run();
            } finally {
                availableHttpRequests.release();
            }
        });
        try {
            return request.get(6, TimeUnit.SECONDS);
        } catch (TimeoutException exception) {
            request.cancel(true);
            throw new CustomException(PostingErrorCode.POSTING_TIMEOUT, exception);
        } catch (InterruptedException exception) {
            request.cancel(true);
            Thread.currentThread().interrupt();
            throw new CustomException(PostingErrorCode.POSTING_TIMEOUT, exception);
        } catch (ExecutionException exception) {
            Throwable cause = exception.getCause();
            if (cause instanceof IllegalArgumentException) {
                throw new CustomException(PostingErrorCode.INVALID_POSTING_URL, cause);
            }
            var code = cause instanceof SocketTimeoutException
                    ? PostingErrorCode.POSTING_TIMEOUT : PostingErrorCode.POSTING_UNREADABLE;
            throw new CustomException(code, cause);
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
