package com.janovel.domain.application.client;

import jakarta.annotation.PreDestroy;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.util.Timeout;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.Header;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.io.CloseMode;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Component;

@Component
public class PostingPageClient implements AutoCloseable {

    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private static final int MAX_IMAGE_BYTES = 32 * 1024 * 1024;
    private static final Set<String> IMAGE_TYPES = Set.of("image/png", "image/jpeg");
    private static final Set<String> HTML_TYPES = Set.of("text/html", "application/xhtml+xml");
    private static final Set<Integer> REDIRECT_CODES = Set.of(301, 302, 303, 307, 308);

    private final CloseableHttpClient client;

    public PostingPageClient() {
        this(HttpClients.custom()
            .setConnectionManager(PoolingHttpClientConnectionManagerBuilder.create()
                    .setDnsResolver(new PublicPostingDnsResolver())
                    .setDefaultConnectionConfig(ConnectionConfig.custom()
                            .setConnectTimeout(Timeout.ofSeconds(3))
                            .setSocketTimeout(Timeout.ofSeconds(5))
                            .build())
                    .build())
            .setDefaultRequestConfig(RequestConfig.custom()
                    .setConnectionRequestTimeout(Timeout.ofSeconds(2))
                    .setResponseTimeout(Timeout.ofSeconds(5))
                    .build())
            .disableRedirectHandling()
            .disableAutomaticRetries()
            .disableCookieManagement()
            .build());
    }

    PostingPageClient(CloseableHttpClient client) {
        this.client = client;
    }

    public Document fetch(String url) throws IOException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(12);
        return get(url, "text/html, application/xhtml+xml", deadline, (entity, uri) -> readPage(entity, uri, deadline));
    }

    public byte[] fetchImage(String url, long deadline) throws IOException {
        return get(url, "image/png, image/jpeg", deadline, (entity, uri) -> readImage(entity, deadline));
    }

    private <T> T get(String url, String accept, long deadline, EntityReader<T> reader) throws IOException {
        URI uri = URI.create(url.strip());
        for (int attempt = 0; attempt < 5; attempt++) {
            validate(uri);
            checkTime(deadline);
            HttpGet request = new HttpGet(uri);
            request.setHeader("Accept", accept);
            var response = (CloseableHttpResponse) client.executeOpen(null, request, null);
            try {
                if (REDIRECT_CODES.contains(response.getCode())) {
                    Header location = response.getFirstHeader("Location");
                    if (location == null) {
                        throw new IOException("공고 이동 주소가 없습니다.");
                    }
                    uri = uri.resolve(location.getValue());
                    continue;
                }
                if (response.getCode() < 200 || response.getCode() > 299) {
                    throw new IOException("공고 페이지가 오류를 반환했습니다.");
                }
                return reader.read(response.getEntity(), uri);
            } finally {
                response.close(CloseMode.IMMEDIATE);
            }
        }
        throw new IOException("공고 페이지의 이동 횟수가 너무 많습니다.");
    }

    private interface EntityReader<T> {
        T read(HttpEntity entity, URI uri) throws IOException;
    }

    private byte[] readImage(HttpEntity entity, long deadline) throws IOException {
        if (entity == null) {
            throw new IOException("공고 이미지에 본문이 없습니다.");
        }
        ContentType contentType = entity.getContentType() != null
                ? ContentType.parseLenient(entity.getContentType()) : null;
        if (contentType == null || !IMAGE_TYPES.contains(contentType.getMimeType())) {
            throw new IOException("지원하지 않는 공고 이미지 형식입니다.");
        }
        if (entity.getContentLength() > MAX_IMAGE_BYTES) {
            throw new IOException("공고 이미지가 너무 큽니다.");
        }
        return readBody(entity.getContent(), deadline, MAX_IMAGE_BYTES);
    }

    private Document readPage(HttpEntity entity, URI uri, long deadline) throws IOException {
        if (entity == null) {
            throw new IOException("공고 페이지에 본문이 없습니다.");
        }
        ContentType contentType = entity.getContentType() != null
                ? ContentType.parseLenient(entity.getContentType()) : null;
        if (contentType == null || !HTML_TYPES.contains(contentType.getMimeType())) {
            throw new IOException("HTML 공고 페이지가 아닙니다.");
        }
        if (entity.getContentLength() > MAX_BYTES) {
            throw new IOException("공고 페이지가 너무 큽니다.");
        }
        byte[] bytes = readBody(entity.getContent(), deadline, MAX_BYTES);
        String charset = contentType.getCharset() != null ? contentType.getCharset().name() : null;
        return Jsoup.parse(new ByteArrayInputStream(bytes), charset, uri.toString());
    }

    public static void validate(URI uri) {
        String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase(Locale.ROOT) : "";
        if (uri.toString().length() > 2048 || (!scheme.equals("http") && !scheme.equals("https"))
                || uri.getUserInfo() != null) {
            throw new IllegalArgumentException("공개 HTTP 또는 HTTPS 주소가 필요합니다.");
        }

        String host = uri.getHost() != null ? uri.getHost() : "";
        if (host.endsWith(".")) {
            host = host.substring(0, host.length() - 1);
        }
        int lastDot = host.lastIndexOf('.');
        // Numeric hosts can bypass a client's DNS resolver. Only resolve named public sites.
        if (lastDot < 0 || lastDot + 1 >= host.length() || !Character.isLetter(host.charAt(lastDot + 1))) {
            throw new IllegalArgumentException("공개 도메인 주소가 필요합니다.");
        }

        int defaultPort = scheme.equals("https") ? 443 : 80;
        if (uri.getPort() != -1 && uri.getPort() != defaultPort) {
            throw new IllegalArgumentException("HTTP 또는 HTTPS 기본 포트가 필요합니다.");
        }
    }

    private byte[] readBody(InputStream input, long deadline, int maxBytes) throws IOException {
        var output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        while (true) {
            checkTime(deadline);
            int count = input.read(buffer);
            if (count == -1) {
                return output.toByteArray();
            }
            if (output.size() + count > maxBytes) {
                throw new IOException("공고 페이지가 너무 큽니다.");
            }
            output.write(buffer, 0, count);
        }
    }

    private void checkTime(long deadline) throws SocketTimeoutException {
        if (System.nanoTime() - deadline >= 0) {
            throw new SocketTimeoutException("공고 가져오기 시간이 초과되었습니다.");
        }
    }

    @PreDestroy
    @Override
    public void close() throws IOException {
        client.close();
    }
}
