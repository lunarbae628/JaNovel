package com.janovel.global.web;

import com.janovel.global.exception.CommonErrorCode;
import com.janovel.global.exception.ErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Locale;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.json.JsonMapper;

/**
 * 파일 업로드(multipart)가 아닌 요청 본문을 2MB로 제한한다. 접근 키 검사와 JSON 파싱 전에 거절해, 큰 본문으로
 * 서버 메모리를 소모시키지 못하게 한다. 가장 큰 정상 요청인 지원 건 등록도 보통 이보다 훨씬 작다.
 * 파일 업로드는 `spring.servlet.multipart`의 11MB 제한을 따른다.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestSizeLimitFilter extends OncePerRequestFilter {

    public static final long MAX_BODY_BYTES = 2L * 1024 * 1024;

    private final JsonMapper json;

    public RequestSizeLimitFilter(JsonMapper json) {
        this.json = json;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String contentType = request.getContentType();
        if (contentType != null && contentType.toLowerCase(Locale.ROOT).startsWith("multipart/")) {
            chain.doFilter(request, response);
            return;
        }
        if (request.getContentLengthLong() > MAX_BODY_BYTES) {
            reject(response);
            return;
        }
        chain.doFilter(new LimitedRequest(request), response);
    }

    private void reject(HttpServletResponse response) throws IOException {
        var code = CommonErrorCode.REQUEST_TOO_LARGE;
        response.setStatus(code.getStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Connection", "close");
        json.writeValue(response.getOutputStream(), ErrorResponse.from(code));
    }

    /** 길이를 알리지 않은(chunked) 본문도 읽은 바이트를 세어 상한을 넘으면 멈춘다. */
    private static final class LimitedRequest extends HttpServletRequestWrapper {

        private ServletInputStream limited;

        LimitedRequest(HttpServletRequest request) {
            super(request);
        }

        @Override
        public ServletInputStream getInputStream() throws IOException {
            if (limited == null) {
                limited = new LimitedInputStream(super.getInputStream());
            }
            return limited;
        }
    }

    private static final class LimitedInputStream extends ServletInputStream {

        private final ServletInputStream input;
        private long read;

        LimitedInputStream(ServletInputStream input) {
            this.input = input;
        }

        @Override
        public int read() throws IOException {
            int value = input.read();
            if (value != -1) {
                count(1);
            }
            return value;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            int count = input.read(buffer, offset, length);
            if (count > 0) {
                count(count);
            }
            return count;
        }

        private void count(int bytes) throws RequestBodyTooLargeException {
            read += bytes;
            if (read > MAX_BODY_BYTES) {
                throw new RequestBodyTooLargeException();
            }
        }

        @Override
        public boolean isFinished() {
            return input.isFinished();
        }

        @Override
        public boolean isReady() {
            return input.isReady();
        }

        @Override
        public void setReadListener(ReadListener listener) {
            input.setReadListener(listener);
        }
    }
}
