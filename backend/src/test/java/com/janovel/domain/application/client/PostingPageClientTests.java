package com.janovel.domain.application.client;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayOutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.zip.GZIPOutputStream;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.HttpHost;
import org.apache.hc.core5.util.Timeout;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PostingPageClientTests {

    @Test
    @DisplayName("gzip으로 전송된 공고 본문을 읽으면 마지막 청크를 기다리지 않고 반환한다")
    void returnsGzipPostingWithoutWaitingForFinalChunk() throws Exception {
        var html = new ByteArrayOutputStream();
        try (var gzip = new GZIPOutputStream(html)) {
            gzip.write("<h1>공고 본문</h1>".getBytes(StandardCharsets.UTF_8));
        }

        var finishResponse = new CountDownLatch(1);
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.getResponseHeaders().set("Content-Encoding", "gzip");
            exchange.sendResponseHeaders(200, 0);
            try (var body = exchange.getResponseBody()) {
                html.writeTo(body);
                body.flush();
                finishResponse.await(5, TimeUnit.SECONDS);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
        });
        server.start();

        var proxy = new HttpHost("http", "127.0.0.1", server.getAddress().getPort());
        try (var client = new PostingPageClient(HttpClients.custom()
                .setProxy(proxy)
                .setDefaultRequestConfig(RequestConfig.custom().setResponseTimeout(Timeout.ofSeconds(2)).build())
                .build())) {
            assertEquals("공고 본문", client.fetch("http://careers.example.com/posting").body().text());
        } finally {
            finishResponse.countDown();
            server.stop(0);
        }
    }
}
