package com.janovel.domain.application.app;

import com.janovel.domain.application.client.PostingBrowserClient;
import com.janovel.domain.application.client.PostingImageTiles;
import com.janovel.domain.application.client.PostingModelClient;
import com.janovel.domain.application.client.PostingPageClient;
import com.janovel.domain.application.dto.ImportedPosting;
import com.janovel.domain.application.exception.PostingErrorCode;
import com.janovel.global.exception.CustomException;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
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

    private static final Pattern STANDARD_DEADLINE = Pattern.compile(
            "^(\\d{4}-\\d{2}-\\d{2})(?:T((?:[01]\\d|2[0-3]):[0-5]\\d)(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|[+-]\\d{2}:\\d{2})?)?$");
    private static final Pattern OPEN_ENDED = Pattern.compile(
            "(?:(?:지원|영입|접수)?\\s*마감일?\\s*[:：]?\\s*)?(?:채용\\s*(?:완료\\s*)?시\\s*마감|"
                    + "상시\\s*채용|영입\\s*종료\\s*시|(?:open\\s+)?until\\s+filled)", Pattern.CASE_INSENSITIVE);
    private static final Pattern OPEN_LABEL = Pattern.compile(
            "마감일?\\s*[:：]\\s*(?:상시|수시|채용\\s*시|영입\\s*종료|충원\\s*시)");
    private static final Pattern OPEN_PERIOD = Pattern.compile(
            "(?:접수|지원|모집|공고)\\s*기간[^\\n]*(?:채용\\s*시\\s*까지|충원\\s*시\\s*까지|상시)");
    private static final Pattern CLOSING_LINE = Pattern.compile(
            "마감|접수\\s*기간|지원\\s*기간|모집\\s*기간|상시|채용\\s*시\\s*까지|D-\\d+|deadline|apply\\s+by|until\\s+filled",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern BODY_SECTION = Pattern.compile(
            "주요\\s*업무|담당\\s*업무|지원\\s*(자격|요건)|자격\\s*요건|모집\\s*부문|우대\\s*사항|"
                    + "전형\\s*절차|채용\\s*절차|지원\\s*프로세스|필수\\s*사항|근무\\s*조건|"
                    + "이런\\s*업무를|이런\\s*분(?:을|들을|과)\\s*(?:찾|함께)|업무를\\s*통해|"
                    + "responsibilities|qualifications|requirements|what you['’]ll do|about the role", Pattern.CASE_INSENSITIVE);
    private static final Pattern RELATED_SECTION = Pattern.compile(
            "(?:추천|관련|다른)\\s*(?:채용\\s*)?공고|더\\s*많은\\s*포지션.*|.*목록에서\\s*더\\s*보기|"
                    + "기업정보|지원자\\s*통계|관련\\s*태그|related jobs|similar jobs",
            Pattern.CASE_INSENSITIVE);
    private static final int MAX_CONTENT_IMAGES = 4;
    private static final int MIN_PLAIN_TEXT = 400;
    private static final int MAX_PLAIN_TEXT = 25_000;
    private static final List<String> IMAGE_SOURCES = List.of("data-src", "data-original", "data-lazy-src", "src");
    private static final Pattern NON_CONTENT_IMAGE = Pattern.compile(
            "\\.(?:svg|gif|ico)(?:[?#]|$)|logo|icon|sprite|pixel|tracking|favicon", Pattern.CASE_INSENSITIVE);
    private static final Pattern SARAMIN_VIEW_PATH = Pattern.compile("/zf_user/jobs/(?:relay/)?view/?");
    private static final Pattern INLINE_HIDDEN = Pattern.compile("(?:^|;)\\s*display\\s*:\\s*none\\b", Pattern.CASE_INSENSITIVE);

    private final PostingPageClient pageClient;
    private final PostingBrowserClient browserClient;
    private final PostingModelClient modelClient;
    private final JsonMapper jsonMapper;
    private final Semaphore availableHttpRequests = new Semaphore(8);
    private final ExecutorService imageExecutor = Executors.newVirtualThreadPerTaskExecutor();

    public PostingImportService(PostingPageClient pageClient, PostingBrowserClient browserClient,
                                PostingModelClient modelClient, JsonMapper jsonMapper) {
        this.pageClient = pageClient;
        this.browserClient = browserClient;
        this.modelClient = modelClient;
        this.jsonMapper = jsonMapper;
    }

    public ImportedPosting importPosting(String url) {
        validateUrl(url);
        requireModel();
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(27);
        Document page = tryFetch(url);
        if (page != null) {
            String embedded = wantedDetailText(page);
            if (!embedded.isBlank()) {
                return classify(withMetadata(page, readJobPosting(page), embedded), page, contentImageUrls(page), deadline);
            }
        }
        String collected = page != null ? extract(page) : null;
        if (page != null && collected == null) {
            String canonical = canonicalDetailUrl(page);
            if (canonical != null) {
                Document detail = tryFetch(canonical);
                if (detail != null && sameOrigin(URI.create(page.location()), URI.create(detail.location()))) {
                    page = detail;
                    collected = extract(detail);
                }
            }
        }

        if (page != null) {
            ImportedPosting withDetail = saraminDetail(page, deadline);
            if (withDetail != null) {
                return withDetail;
            }
        }
        if (collected != null && !PostingBrowserClient.hasCollapsedDetails(page)) {
            return classify(collected, page, contentImageUrls(page), deadline);
        }

        var renderedImages = new LinkedHashSet<String>();
        PostingBrowserClient.RenderedPosting rendered;
        try {
            rendered = browserClient.collect(page != null ? page.location() : url, deadline, document -> {
                renderedImages.addAll(contentImageUrls(document));
                return extract(document);
            });
        } catch (CustomException exception) {
            if (collected != null) {
                return classify(collected, page, contentImageUrls(page), deadline);
            }
            throw exception;
        }
        if (rendered.text() != null) {
            return classify(rendered.text(), page, renderedImages, deadline);
        }
        JsonNode job = page == null ? MissingNode.getInstance() : readJobPosting(page);
        String context = job.isMissingNode() ? "" : withMetadata(page, job, "").stripTrailing();
        return fillDeadline(modelClient.classifyScreenshots(rendered.images(), context, deadline), standardDeadline(job));
    }

    private ImportedPosting saraminDetail(Document page, long deadline) {
        String detailUrl = saraminDetailUrl(page);
        if (detailUrl == null) {
            return null;
        }
        Document detail = fetchPage(detailUrl);
        String text = withMetadata(page, readJobPosting(page),
                postingText(cleanedBody(page)) + "\n상세요강\n" + postingText(detail.body()));
        return classify(text, page, contentImageUrls(detail), deadline);
    }

    private String saraminDetailUrl(Document page) {
        URI location = URI.create(page.location());
        if (!"www.saramin.co.kr".equalsIgnoreCase(location.getHost())
                || !SARAMIN_VIEW_PATH.matcher(location.getPath()).matches() || location.getRawQuery() == null) {
            return null;
        }
        return Arrays.stream(location.getRawQuery().split("&"))
                .filter(parameter -> parameter.matches("rec_idx=[0-9]{1,12}")).findFirst()
                .map(parameter -> "https://www.saramin.co.kr/zf_user/jobs/relay/view-detail?" + parameter + "&rec_seq=0")
                .orElse(null);
    }

    private ImportedPosting classify(String text, Document page, Collection<String> imageUrls, long deadline) {
        var tiles = imageTiles(imageUrls, deadline);
        var result = tiles.isEmpty() ? modelClient.classifyText(text, deadline)
                : modelClient.classifyScreenshots(tiles, text, deadline);
        var source = standardDeadline(page == null ? MissingNode.getInstance() : readJobPosting(page));
        if (text.lines().anyMatch(line -> OPEN_ENDED.matcher(line).matches() || OPEN_PERIOD.matcher(line).find()
                        || OPEN_LABEL.matcher(line).find())
                && (!source.date().isBlank() || !result.deadline().isBlank())) {
            return withDeadline(result, new SourceDeadline("", ""));
        }
        return fillDeadline(result, source);
    }

    private List<byte[]> imageTiles(Collection<String> imageUrls, long deadline) {
        List<CompletableFuture<List<byte[]>>> downloads = imageUrls.stream().limit(MAX_CONTENT_IMAGES)
                .map(source -> CompletableFuture.supplyAsync(() -> {
                    try {
                        return PostingImageTiles.split(fetchImage(source, deadline));
                    } catch (CustomException exception) {
                        return List.<byte[]>of();
                    }
                }, imageExecutor)).toList();
        var tiles = new ArrayList<byte[]>();
        for (var download : downloads) {
            var next = download.join();
            if (tiles.size() + next.size() <= PostingImageTiles.MAX_TILES) {
                tiles.addAll(next);
            }
        }
        return tiles;
    }

    private List<String> contentImageUrls(Document document) {
        return document.select("img").stream()
                .filter(image -> image.closest("nav,footer,aside,header,[aria-hidden=true],[hidden]") == null)
                .filter(image -> !INLINE_HIDDEN.matcher(image.attr("style")).find())
                .filter(image -> !smallerThan(image.attr("width"), 200) && !smallerThan(image.attr("height"), 200))
                .map(image -> image.absUrl(IMAGE_SOURCES.stream().filter(image::hasAttr).findFirst().orElse("src")))
                .filter(source -> source.startsWith("http") && !NON_CONTENT_IMAGE.matcher(source).find())
                .distinct().toList();
    }

    private static boolean smallerThan(String attribute, int limit) {
        return attribute.matches("\\d{1,3}") && Integer.parseInt(attribute) < limit;
    }

    private ImportedPosting fillDeadline(ImportedPosting result, SourceDeadline source) {
        if (source.date().isBlank()
                || (!result.deadline().isBlank() && !result.deadline().equals(source.date()))
                || (!result.deadline().isBlank() && (source.time().isBlank() || !result.deadlineTime().isBlank()))) {
            return result;
        }
        return withDeadline(result, source);
    }

    private ImportedPosting withDeadline(ImportedPosting result, SourceDeadline source) {
        return new ImportedPosting(result.company(), result.role(), source.date(), source.time(),
                result.sections(), result.stages(), result.questions(), result.positions(), result.sourceText());
    }

    public ImportedPosting importImage(byte[] image, String contentType, long deadline) {
        return modelClient.classifyImage(image, contentType, deadline);
    }

    void requireModel() {
        modelClient.requireConfigured();
    }

    private static void validateUrl(String url) {
        try {
            PostingPageClient.validate(URI.create(url.strip()));
        } catch (IllegalArgumentException exception) {
            throw new CustomException(PostingErrorCode.INVALID_POSTING_URL, exception);
        }
    }

    private String extract(Document page) {
        JsonNode job = readJobPosting(page);
        String structured = postingText(Jsoup.parseBodyFragment(job.path("description").asString("")).body());
        if (structured.length() < 180 && !BODY_SECTION.matcher(structured).find()) {
            structured = "";
        }
        String visible = visiblePostingText(page);
        if (structured.isBlank() && visible.isBlank()) {
            return null;
        }
        String source = visible.isBlank() ? structured : visible;
        if (!visible.isBlank() && !structured.isBlank()) {
            String normalizedVisible = visible.replaceAll("\\s+", " ");
            String normalizedStructured = structured.replaceAll("\\s+", " ");
            if (normalizedStructured.contains(normalizedVisible)) {
                source = structured;
            } else if (!normalizedVisible.contains(limit(normalizedStructured, 100))) {
                source = visible + "\n공고 설명\n" + structured;
            }
        }
        return withMetadata(page, job, source + closingLines(page, source));
    }

    private String closingLines(Document page, String source) {
        String compact = source.replaceAll("\\s+", " ");
        String lines = postingText(cleanedBody(page)).lines().map(String::strip)
                .filter(line -> line.length() <= 160 && CLOSING_LINE.matcher(line).find())
                .filter(line -> !compact.contains(line.replaceAll("\\s+", " ")))
                .distinct().limit(8).collect(Collectors.joining("\n"));
        return lines.isEmpty() ? "" : "\n마감 관련 원문\n" + lines;
    }

    private String withMetadata(Document page, JsonNode job, String source) {
        String title = job.path("title").asString("");
        if (title.isBlank()) {
            Element heading = page.selectFirst("h1");
            title = heading != null ? heading.text() : page.title();
        }
        String company = job.path("hiringOrganization").path("name").asString("");
        var deadline = standardDeadline(job);
        String dateTime = deadline.time().isBlank() ? deadline.date() : deadline.date() + " " + deadline.time();
        Element description = page.selectFirst("meta[name=description][content]");
        String summary = description == null || description.attr("content").isBlank() ? ""
                : "페이지 설명: " + limit(description.attr("content").strip(), 500) + "\n";
        return limit(metadata(company, title, dateTime) + summary + source, 30_000);
    }

    private SourceDeadline standardDeadline(JsonNode job) {
        var value = STANDARD_DEADLINE.matcher(job.path("validThrough").asString("").strip());
        if (value.matches()) {
            try {
                var date = LocalDate.parse(value.group(1));
                return new SourceDeadline(date.toString(), value.group(2) == null ? "" : value.group(2));
            } catch (DateTimeParseException ignored) {
                // Fall back to the date found in the posting body.
            }
        }
        return new SourceDeadline("", "");
    }

    private record SourceDeadline(String date, String time) {
    }

    private String wantedDetailText(Document page) {
        URI location = URI.create(page.location());
        if (!"www.wanted.co.kr".equalsIgnoreCase(location.getHost()) || !location.getPath().matches("/wd/[0-9]+/?")) {
            return "";
        }
        Element data = page.getElementById("__NEXT_DATA__");
        if (data == null || data.data().isBlank()) {
            return "";
        }
        try {
            JsonNode job = jsonMapper.readTree(data.data()).at("/props/pageProps/initialData");
            if (!location.getPath().replaceFirst("/$", "").equals("/wd/" + job.path("id").asString(""))
                    || job.path("hire_rounds").asString("").isBlank()) {
                return "";
            }
            return List.of(Map.entry("포지션 상세", "intro"), Map.entry("주요 업무", "main_tasks"),
                            Map.entry("지원 요건", "requirements"), Map.entry("우대 사항", "preferred_points"),
                            Map.entry("근무 조건 및 복리후생", "benefits"), Map.entry("고용 조건", "employment_note"),
                            Map.entry("채용 절차", "hire_rounds")).stream()
                    .filter(field -> !job.path(field.getValue()).asString("").isBlank())
                    .map(field -> field.getKey() + "\n" + job.path(field.getValue()).asString("").strip())
                    .collect(Collectors.joining("\n"));
        } catch (JacksonException exception) {
            return "";
        }
    }

    private String visiblePostingText(Document page) {
        Element body = cleanedBody(page);
        String plain = postingText(body);
        boolean enough = plain.codePoints().filter(Character::isLetterOrDigit).count() >= MIN_PLAIN_TEXT;
        return enough && plain.length() <= MAX_PLAIN_TEXT ? plain : scopedText(body);
    }

    private Element cleanedBody(Document page) {
        Element body = page.body().clone();
        body.select("nav,footer,aside,form,[role=navigation],[role=contentinfo],[role=complementary],"
                + "script,style,noscript,template,[hidden],[aria-hidden=true]").remove();
        body.select("[style]").stream().filter(element -> INLINE_HIDDEN.matcher(element.attr("style")).find())
                .toList().forEach(Element::remove);
        URI url = URI.create(page.location());
        String path = url.getPath();
        if (path != null) {
            String directory = path.substring(0, path.lastIndexOf('/') + 1);
            if (directory.length() > 1) {
                body.select("ul,ol,[role=list]").stream().filter(list -> listsOtherPostings(list, url, directory))
                        .toList().forEach(Element::remove);
            }
        }
        return body;
    }

    private String scopedText(Element body) {
        for (Element scope : body.select("main,[role=main],[itemtype$=/JobPosting],article,[itemprop=description]")) {
            String text = detailText(scope);
            if (!text.isEmpty()) {
                return text;
            }
        }
        Element heading = body.selectFirst("h1");
        for (Element scope = heading == null ? body : heading.parent(); scope != null; scope = scope.parent()) {
            String text = detailText(scope);
            if (!text.isEmpty()) {
                return text;
            }
            if (scope == body) {
                return plainText(body);
            }
        }
        return "";
    }

    private String plainText(Element body) {
        String text = postingText(body);
        return text.codePoints().filter(Character::isLetterOrDigit).count() >= MIN_PLAIN_TEXT ? text : "";
    }

    private boolean listsOtherPostings(Element list, URI current, String directory) {
        return list.select("a[href]").stream().map(link -> link.absUrl("href"))
                .filter(link -> !link.isBlank()).distinct()
                .filter(link -> {
                    try {
                        URI target = URI.create(link);
                        String path = target.getPath();
                        return sameOrigin(current, target) && path.startsWith(directory)
                                && !path.equals(current.getPath()) && path.length() > directory.length()
                                && path.indexOf('/', directory.length()) < 0;
                    } catch (IllegalArgumentException exception) {
                        return false;
                    }
                }).limit(2).count() == 2;
    }

    private String detailText(Element scope) {
        if (!BODY_SECTION.matcher(scope.text()).find()) {
            return "";
        }
        var text = new StringBuilder();
        boolean detail = false;
        boolean section = false;
        for (String line : postingText(scope).lines().toList()) {
            if (detail && RELATED_SECTION.matcher(line).matches()) {
                break;
            }
            var heading = BODY_SECTION.matcher(line);
            if (heading.find()) {
                section = true;
                String rest = line.substring(heading.end()).replaceAll("^[\\s:·–—-]+", "");
                detail |= rest.length() >= 5;
            } else if (section && line.codePoints().filter(Character::isLetterOrDigit).count() >= 4) {
                detail = true;
            }
            text.append(line).append('\n');
        }
        return detail ? text.toString().stripTrailing() : "";
    }

    private String metadata(String company, String role, String deadline) {
        return (company.isBlank() ? "" : "회사명: " + limit(company.strip(), 100) + "\n")
                + (role.isBlank() ? "" : "공고 제목: " + limit(role.strip(), 150) + "\n")
                + (deadline.isBlank() ? "" : "마감일: " + deadline + "\n");
    }

    private String canonicalDetailUrl(Document page) {
        Element canonical = page.selectFirst("link[rel=canonical][href]");
        if (canonical == null) {
            return null;
        }
        URI current = URI.create(page.location());
        try {
            URI detail = URI.create(canonical.absUrl("href"));
            PostingPageClient.validate(detail);
            if (!sameOrigin(current, detail) || current.getPath().equals(detail.getPath())
                    || detail.getPath().length() <= 1 || detail.getRawFragment() != null) {
                return null;
            }
            if (current.getRawQuery() != null || detail.getRawQuery() != null) {
                if (current.getRawQuery() == null || detail.getRawQuery() == null) {
                    return null;
                }
                var original = Arrays.asList(current.getRawQuery().split("&"));
                if (!original.containsAll(Arrays.asList(detail.getRawQuery().split("&")))) {
                    return null;
                }
            }
            return detail.toString();
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private boolean sameOrigin(URI first, URI second) {
        return first.getHost() != null && first.getHost().equalsIgnoreCase(second.getHost())
                && first.getScheme().equalsIgnoreCase(second.getScheme()) && first.getPort() == second.getPort();
    }

    private Document tryFetch(String url) {
        try {
            return fetchPage(url);
        } catch (CustomException exception) {
            if (exception.getErrorCode() == PostingErrorCode.POSTING_UNREADABLE
                    || exception.getErrorCode() == PostingErrorCode.POSTING_TIMEOUT) {
                return null;
            }
            throw exception;
        }
    }

    private Document fetchPage(String url) {
        return guarded(() -> pageClient.fetch(url), 6);
    }

    private byte[] fetchImage(String url, long deadline) {
        long seconds = Math.max(1, TimeUnit.NANOSECONDS.toSeconds(deadline - System.nanoTime()) - 12);
        return guarded(() -> pageClient.fetchImage(url, deadline), Math.min(15, seconds));
    }

    private <T> T guarded(Callable<T> task, long seconds) {
        if (!availableHttpRequests.tryAcquire()) {
            throw new CustomException(PostingErrorCode.POSTING_IMPORT_BUSY);
        }
        var request = new FutureTask<>(task);
        Thread.startVirtualThread(() -> {
            try {
                request.run();
            } finally {
                availableHttpRequests.release();
            }
        });
        try {
            return request.get(seconds, TimeUnit.SECONDS);
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
        content.select("th,td").forEach(cell -> cell.after(new TextNode(" ")));
        content.select("br,h1,h2,h3,h4,h5,h6,p,li,dt,dd,tr,div,section,blockquote")
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
