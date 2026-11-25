package com.janovel.domain.application.client;

import com.janovel.domain.application.exception.PostingErrorCode;
import com.janovel.global.exception.CustomException;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Frame;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.options.Proxy;
import com.microsoft.playwright.options.ServiceWorkerPolicy;
import com.microsoft.playwright.options.WaitUntilState;
import com.microsoft.playwright.options.WaitForSelectorState;
import jakarta.annotation.PreDestroy;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Function;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;
import java.util.stream.IntStream;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PostingBrowserClient {

    private static final Logger LOG = LoggerFactory.getLogger(PostingBrowserClient.class);
    private static final String DETAIL_CONTROLS = "button,[role=button],details:not([open]) > summary";
    private static final String DETAIL_FRAMES = "iframe[title*='요강'],iframe[title*='채용공고'],"
            + "iframe[title*='공고 상세'],iframe[title*='job description' i],"
            + "iframe[title*='job posting' i],iframe[title*='job detail' i]";
    private static final Set<String> SKIPPED_RESOURCES = Set.of("media", "font");
    private static final Pattern EXPAND_DETAIL = Pattern.compile(
            "^(?:(?:채용|공고)\\s*상세(?:\\s*(?:더\\s*보기|펼치기))?|"
                    + "상세\\s*(?:정보|내용)\\s*(?:더\\s*보기|펼치기)|"
                    + "(?:show|read|view)\\s+(?:the\\s+)?(?:full\\s+)?(?:job\\s+)?(?:description|details))$",
            Pattern.CASE_INSENSITIVE);
    private static final String POSTING_VISIBLE = """
            frames => /주요\\s*업무|자격\\s*요건|담당\\s*업무|지원\\s*자격|모집\\s*부문|업무를\\s*통해|responsibilities|qualifications/i
                .test(document.body?.innerText ?? '')
                || document.querySelector(frames) !== null
                || Array.from(document.images).some(image => {
                    const bounds = image.getBoundingClientRect();
                    return image.complete && image.naturalWidth >= 320 && bounds.width >= 300 && bounds.height >= 420
                        && !image.closest('nav, footer, aside, [aria-hidden=true]');
                })
            """;
    private static final int TILE_HEIGHT = 1_200;
    private static final int TILE_OVERLAP = 100;
    private static final int MAX_TILES = 12;

    private final List<BrowserWorker> workers;

    public PostingBrowserClient(@Value("${janovel.postings.browser-channel:}") String channel,
                                @Value("${janovel.postings.browser-workers:2}") int workerCount) {
        if (workerCount < 1 || workerCount > 2) {
            throw new IllegalArgumentException("공고 브라우저 워커는 1개 또는 2개여야 합니다.");
        }
        workers = IntStream.rangeClosed(1, workerCount).mapToObj(index -> new BrowserWorker(channel, index)).toList();
    }

    public static boolean hasCollapsedDetails(Document document) {
        return document.select(DETAIL_CONTROLS).stream()
                .anyMatch(button -> EXPAND_DETAIL.matcher(button.text()).matches()
                        && !"true".equals(button.attr("aria-expanded")));
    }

    public RenderedPosting collect(String url, long deadline, Function<Document, String> extract) {
        return browse(url, deadline, page -> {
            expandPosting(page);
            Document document = Jsoup.parse(page.content(), page.url());
            RenderedPosting embedded = embeddedPosting(page, document, extract);
            if (embedded != null) {
                return embedded;
            }
            String text = extract.apply(document);
            if (text != null) {
                return new RenderedPosting(text, List.of());
            }
            return new RenderedPosting(null, screenshotTiles(page.mainFrame()));
        });
    }

    public record RenderedPosting(String text, List<byte[]> images) {
    }

    private RenderedPosting embeddedPosting(Page page, Document document, Function<Document, String> extract) {
        var frames = page.locator(DETAIL_FRAMES);
        if (frames.count() == 0) {
            return null;
        }
        try {
            var element = frames.first().elementHandle(new Locator.ElementHandleOptions().setTimeout(1_500));
            Frame frame;
            try {
                frame = element.contentFrame();
            } finally {
                element.dispose();
            }
            if (frame == null) {
                return null;
            }
            var body = frame.locator("body");
            body.waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE).setTimeout(2_000));
            frame.waitForFunction("() => document.body.innerText.trim().length >= 40 || document.images.length > 0",
                    null, new Frame.WaitForFunctionOptions().setTimeout(2_000)).dispose();
            Document detail = document.clone();
            detail.body().empty().appendElement("article").html(body.innerHTML());
            String text = extract.apply(detail);
            if (text != null) {
                return new RenderedPosting(text, List.of());
            }
            loadPostingImages(frame);
            return new RenderedPosting(null, screenshotTiles(frame));
        } catch (PlaywrightException exception) {
            LOG.debug("Could not read embedded posting ({})", exception.getClass().getSimpleName());
            return null;
        } catch (CustomException exception) {
            if (exception.getErrorCode() == PostingErrorCode.POSTING_UNREADABLE) {
                return null;
            }
            throw exception;
        }
    }

    private void expandPosting(Page page) {
        var controls = page.locator(DETAIL_CONTROLS)
                .filter(new Locator.FilterOptions().setHasText(EXPAND_DETAIL));
        Number initialTextSize = (Number) page.evaluate("() => document.body?.innerText.length ?? 0");
        boolean expanded = false;
        for (Locator button : controls.all().stream().limit(3).toList()) {
            if (button.isVisible() && button.isEnabled() && !"true".equals(button.getAttribute("aria-expanded"))) {
                try {
                    button.click(new Locator.ClickOptions().setTimeout(600));
                    expanded = true;
                } catch (com.microsoft.playwright.TimeoutError ignored) {
                    // Other public content may still be readable.
                }
            }
        }
        if (expanded) {
            try {
                page.waitForFunction("size => document.body?.innerText.length > size", initialTextSize,
                        new Page.WaitForFunctionOptions().setTimeout(800));
            } catch (com.microsoft.playwright.TimeoutError ignored) {
                // The expanded panel may already have been present in the HTML.
            }
        }
        loadPostingImages(page.mainFrame());
    }

    private List<byte[]> screenshotTiles(Frame frame) {
        int index;
        try {
            var ready = frame.waitForFunction("""
                    () => {
                        let selected = 0, best = 0;
                        const directImage = document.contentType.startsWith('image/');
                        Array.from(document.images).forEach((image, index) => {
                            const bounds = image.getBoundingClientRect();
                            const inContent = image.closest('main, article, [role=main], [itemprop=description]');
                            const minimumHeight = directImage ? 120 : inContent ? 420 : 600;
                            const score = bounds.height * (inContent ? 1.25 : 1);
                            if (image.complete && image.naturalWidth >= 320 && bounds.width >= 300
                                    && bounds.height >= minimumHeight && score > best
                                    && !image.closest('nav, footer, aside, [aria-hidden=true]')
                                    && getComputedStyle(image).visibility === 'visible') {
                                selected = index + 1;
                                best = score;
                            }
                        });
                        return selected;
                    }
                    """, null, new Frame.WaitForFunctionOptions().setTimeout(2_000));
            try {
                index = ((Number) ready.jsonValue()).intValue() - 1;
            } finally {
                ready.dispose();
            }
        } catch (com.microsoft.playwright.TimeoutError exception) {
            throw new CustomException(PostingErrorCode.POSTING_UNREADABLE, exception);
        }
        var image = frame.locator("img").nth(index);
        var bounds = image.boundingBox();
        if (bounds == null || bounds.width * bounds.height > 20_000_000
                || bounds.height > TILE_HEIGHT + (MAX_TILES - 1) * (TILE_HEIGHT - TILE_OVERLAP)) {
            throw new CustomException(PostingErrorCode.POSTING_IMAGE_TOO_LARGE);
        }
        try {
            var fullImage = ImageIO.read(new ByteArrayInputStream(image.screenshot()));
            if (fullImage == null) {
                throw new CustomException(PostingErrorCode.POSTING_UNREADABLE);
            }
            var tiles = new ArrayList<byte[]>();
            for (int top = 0; ; top += TILE_HEIGHT - TILE_OVERLAP) {
                int height = Math.min(TILE_HEIGHT, fullImage.getHeight() - top);
                var output = new ByteArrayOutputStream();
                ImageIO.write(fullImage.getSubimage(0, top, fullImage.getWidth(), height), "png", output);
                tiles.add(output.toByteArray());
                if (top + height == fullImage.getHeight()) {
                    return tiles;
                }
            }
        } catch (IOException exception) {
            throw new CustomException(PostingErrorCode.POSTING_UNREADABLE, exception);
        }
    }

    private void loadPostingImages(Frame frame) {
        frame.locator("img[loading=lazy]").evaluateAll("""
                images => images.forEach(image => {
                    if (!image.closest('nav, footer, aside')) image.loading = 'eager';
                })
                """);
    }

    private <T> T browse(String url, long deadline, Function<Page, T> read) {
        try {
            PostingPageClient.validate(URI.create(url.strip()));
        } catch (IllegalArgumentException exception) {
            throw new CustomException(PostingErrorCode.INVALID_POSTING_URL, exception);
        }
        var worker = acquire();
        long executionDeadline = Math.min(deadline, System.nanoTime() + TimeUnit.SECONDS.toNanos(10));
        if (executionDeadline - System.nanoTime() <= 0) {
            release(worker);
            throw new CustomException(PostingErrorCode.POSTING_TIMEOUT);
        }
        Future<T> result;
        try {
            result = worker.executor.submit(() -> {
                try {
                    try (var context = worker.openBrowser().newContext(new Browser.NewContextOptions()
                            .setServiceWorkers(ServiceWorkerPolicy.BLOCK).setDeviceScaleFactor(1))) {
                        context.setDefaultTimeout(2_000);
                        context.route("**/*", route -> {
                            if (SKIPPED_RESOURCES.contains(route.request().resourceType())) {
                                route.abort();
                            } else {
                                route.resume();
                            }
                        });
                        var page = context.newPage();
                        var response = page.navigate(url.strip(), new Page.NavigateOptions()
                                .setWaitUntil(WaitUntilState.DOMCONTENTLOADED).setTimeout(4_000));
                        if (response == null || !response.ok()) {
                            throw new CustomException(PostingErrorCode.POSTING_UNREADABLE);
                        }
                        try {
                            loadPostingImages(page.mainFrame());
                            page.waitForFunction(POSTING_VISIBLE, DETAIL_FRAMES,
                                    new Page.WaitForFunctionOptions().setTimeout(4_000)).dispose();
                        } catch (com.microsoft.playwright.TimeoutError ignored) {
                            // A page can have readable content without any of the expected headings.
                        }
                        return read.apply(page);
                    }
                } finally {
                    release(worker);
                }
            });
        } catch (RejectedExecutionException exception) {
            release(worker);
            throw new CustomException(PostingErrorCode.POSTING_IMPORT_BUSY, exception);
        }
        try {
            return result.get(Math.max(1, executionDeadline - System.nanoTime()), TimeUnit.NANOSECONDS);
        } catch (TimeoutException exception) {
            throw new CustomException(PostingErrorCode.POSTING_TIMEOUT, exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new CustomException(PostingErrorCode.POSTING_TIMEOUT, exception);
        } catch (ExecutionException exception) {
            if (exception.getCause() instanceof CustomException failure) {
                throw failure;
            }
            var code = exception.getCause() instanceof com.microsoft.playwright.TimeoutError
                    ? PostingErrorCode.POSTING_TIMEOUT : PostingErrorCode.POSTING_UNREADABLE;
            LOG.debug("Browser posting extraction failed ({})", exception.getCause().getClass().getSimpleName());
            throw new CustomException(code, exception.getCause());
        }
    }

    private BrowserWorker acquire() {
        for (BrowserWorker worker : workers) {
            if (worker.available.tryAcquire()) {
                return worker;
            }
        }
        throw new CustomException(PostingErrorCode.POSTING_IMPORT_BUSY);
    }

    private void release(BrowserWorker worker) {
        worker.available.release();
    }

    @PreDestroy
    void close() {
        workers.forEach(BrowserWorker::close);
        workers.forEach(BrowserWorker::awaitClose);
    }

    private static final class BrowserWorker {

        private final ExecutorService executor;
        private final String channel;
        private final Semaphore available = new Semaphore(1);
        private Playwright playwright;
        private Browser browser;
        private PublicPostingProxy proxy;

        private BrowserWorker(String channel, int index) {
            this.channel = channel;
            executor = Executors.newSingleThreadExecutor(
                    Thread.ofPlatform().daemon().name("posting-browser-" + index).factory());
        }

        private Browser openBrowser() throws IOException, PlaywrightException {
            if (browser != null && browser.isConnected()) {
                return browser;
        }
            if (playwright == null) {
                playwright = Playwright.create(new Playwright.CreateOptions()
                        .setEnv(Map.of("PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD", "1")));
        }
            if (proxy == null) {
                proxy = new PublicPostingProxy();
        }
            var options = new BrowserType.LaunchOptions().setTimeout(5_000).setChromiumSandbox(true)
                    .setProxy(new Proxy(proxy.address()).setBypass("<-loopback>"))
                    .setArgs(List.of("--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
                            "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"));
            if (!channel.isBlank()) {
                options.setChannel(channel);
        }
            browser = playwright.chromium().launch(options);
            return browser;
        }

        private void close() {
            executor.submit(() -> {
                try {
                    if (playwright != null) {
                        playwright.close();
                    }
                } finally {
                    if (proxy != null) {
                        proxy.close();
                    }
                }
                return null;
            });
            executor.shutdown();
        }

        private void awaitClose() {
            try {
                if (!executor.awaitTermination(8, TimeUnit.SECONDS)) {
                    executor.shutdownNow();
                }
            } catch (InterruptedException exception) {
                executor.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }
}
