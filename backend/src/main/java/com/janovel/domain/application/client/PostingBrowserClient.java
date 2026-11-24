package com.janovel.domain.application.client;

import com.janovel.domain.application.exception.PostingErrorCode;
import com.janovel.global.exception.CustomException;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.options.Proxy;
import com.microsoft.playwright.options.ServiceWorkerPolicy;
import com.microsoft.playwright.options.WaitUntilState;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.net.URI;
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
    private static final String CONTENT = "main, article, [role=main]";
    private static final Set<String> TEXT_ONLY_SKIPS = Set.of("image", "media", "font");
    private static final String POSTING_VISIBLE = """
            () => /주요\\s*업무|자격\\s*요건|담당\\s*업무|지원\\s*자격|모집\\s*부문|responsibilities|qualifications/i
                .test(document.body?.innerText ?? '')
            """;

    private final List<BrowserWorker> workers;
    private final Object availability = new Object();

    public PostingBrowserClient(@Value("${janovel.postings.browser-channel:}") String channel,
                                @Value("${janovel.postings.browser-workers:2}") int workerCount) {
        if (workerCount < 1 || workerCount > 2) {
            throw new IllegalArgumentException("공고 브라우저 워커는 1개 또는 2개여야 합니다.");
        }
        workers = IntStream.rangeClosed(1, workerCount).mapToObj(index -> new BrowserWorker(channel, index)).toList();
    }

    public Document render(String url) {
        return browse(url, false, System.nanoTime() + TimeUnit.SECONDS.toNanos(8),
                page -> Jsoup.parse(page.content(), page.url()));
    }

    public byte[] capture(String url, long deadline) {
        return browse(url, true, deadline, page -> {
            var area = page.locator("main article, [role=main] article").first();
            if (area.count() == 0) {
                area = page.locator(CONTENT).first();
            }
            if (area.count() == 0) {
                area = page.locator("body");
            }
            area.evaluate("node => { for (const image of node.querySelectorAll('img[loading=lazy]')) image.loading = 'eager'; }");
            var bounds = area.boundingBox();
            if (bounds == null) {
                throw new CustomException(PostingErrorCode.POSTING_UNREADABLE);
            }
            if (bounds.width * bounds.height > 20_000_000) {
                throw new CustomException(PostingErrorCode.POSTING_IMAGE_TOO_LARGE);
            }
            return area.screenshot();
        });
    }

    private <T> T browse(String url, boolean capture, long deadline, Function<Page, T> read) {
        try {
            PostingPageClient.validate(URI.create(url.strip()));
        } catch (IllegalArgumentException exception) {
            throw new CustomException(PostingErrorCode.INVALID_POSTING_URL, exception);
        }
        var worker = acquire(capture, deadline);
        long executionDeadline = Math.min(deadline, System.nanoTime() + TimeUnit.SECONDS.toNanos(8));
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
                            if (!capture && TEXT_ONLY_SKIPS.contains(route.request().resourceType())) {
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
                            String ready = capture
                                    ? "() => document.body?.innerText.trim().length > 120 || document.querySelector('main img, article img')?.complete"
                                    : POSTING_VISIBLE;
                            page.waitForFunction(ready, null, new Page.WaitForFunctionOptions().setTimeout(2_000));
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

    private BrowserWorker acquire(boolean waitForSlot, long deadline) {
        synchronized (availability) {
            while (deadline - System.nanoTime() > 0) {
                for (BrowserWorker worker : workers) {
                    if (worker.available.tryAcquire()) {
                        return worker;
                    }
                }
                if (!waitForSlot) {
                    throw new CustomException(PostingErrorCode.POSTING_IMPORT_BUSY);
                }
                try {
                    long remaining = deadline - System.nanoTime();
                    if (remaining > 0) {
                        TimeUnit.NANOSECONDS.timedWait(availability, remaining);
                    }
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new CustomException(PostingErrorCode.POSTING_TIMEOUT, exception);
                }
            }
            throw new CustomException(PostingErrorCode.POSTING_TIMEOUT);
        }
    }

    private void release(BrowserWorker worker) {
        synchronized (availability) {
            worker.available.release();
            availability.notifyAll();
        }
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
