package com.janovel.domain.application.client;

import com.janovel.domain.application.exception.PostingErrorCode;
import com.janovel.global.exception.CustomException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

@Component
public class PostingOcrClient {

    public static final int MAX_IMAGE_BYTES = 10 * 1024 * 1024;
    private static final Set<String> FORMATS = Set.of("image/png", "image/jpeg", "image/webp");
    private static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(12);

    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1)).build();
    private final JsonMapper json;
    private final URI endpoint;

    public PostingOcrClient(JsonMapper json, @Value("${janovel.postings.ocr-url:http://127.0.0.1:8091}") URI baseUrl) {
        this.json = json;
        this.endpoint = baseUrl.resolve("/internal/ocr");
    }

    public static void validateImage(byte[] image, String contentType) {
        if (image.length == 0) {
            throw new CustomException(PostingErrorCode.POSTING_INVALID_IMAGE);
        }
        if (image.length > MAX_IMAGE_BYTES) {
            throw new CustomException(PostingErrorCode.POSTING_IMAGE_TOO_LARGE);
        }
        if (contentType == null || !FORMATS.contains(contentType)) {
            throw new CustomException(PostingErrorCode.UNSUPPORTED_POSTING_IMAGE);
        }
    }

    public String read(byte[] image, String contentType, long deadline) {
        validateImage(image, contentType);
        long budget = Math.min(RESPONSE_TIMEOUT.toNanos(), deadline - System.nanoTime());
        if (budget <= 0) {
            throw new CustomException(PostingErrorCode.POSTING_TIMEOUT);
        }
        long callDeadline = System.nanoTime() + budget;
        var request = HttpRequest.newBuilder(endpoint).timeout(Duration.ofNanos(budget))
                .header("Content-Type", contentType).header("X-Request-Id", UUID.randomUUID().toString())
                .POST(HttpRequest.BodyPublishers.ofByteArray(image)).build();
        var call = client.sendAsync(request, HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> response;
        try {
            response = call.get(Math.max(1, callDeadline - System.nanoTime()), TimeUnit.NANOSECONDS);
        } catch (TimeoutException exception) {
            call.cancel(true);
            throw new CustomException(PostingErrorCode.POSTING_TIMEOUT, exception);
        } catch (InterruptedException exception) {
            call.cancel(true);
            Thread.currentThread().interrupt();
            throw new CustomException(PostingErrorCode.POSTING_TIMEOUT, exception);
        } catch (ExecutionException exception) {
            var code = exception.getCause() instanceof HttpTimeoutException
                    ? PostingErrorCode.POSTING_TIMEOUT : PostingErrorCode.POSTING_OCR_UNAVAILABLE;
            throw new CustomException(code, exception.getCause());
        }
        try {
            var payload = json.readTree(response.body());
            if (response.statusCode() != 200) {
                var code = switch (response.statusCode()) {
                    case 400 -> PostingErrorCode.POSTING_INVALID_IMAGE;
                    case 413 -> PostingErrorCode.POSTING_IMAGE_TOO_LARGE;
                    case 415 -> PostingErrorCode.UNSUPPORTED_POSTING_IMAGE;
                    case 503 -> payload.path("error").asString("").equals("OCR_BUSY")
                            ? PostingErrorCode.POSTING_IMPORT_BUSY : PostingErrorCode.POSTING_OCR_UNAVAILABLE;
                    case 504 -> PostingErrorCode.POSTING_TIMEOUT;
                    default -> PostingErrorCode.POSTING_OCR_FAILED;
                };
                throw new CustomException(code);
            }
            var text = payload.path("text");
            if (!text.isString()) {
                throw new CustomException(PostingErrorCode.POSTING_OCR_FAILED);
            }
            return text.asString();
        } catch (JacksonException exception) {
            throw new CustomException(PostingErrorCode.POSTING_OCR_FAILED, exception);
        }
    }
}
