package com.janovel.domain.application.app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.janovel.domain.application.client.PostingBrowserClient;
import com.janovel.domain.application.client.PostingOcrClient;
import com.janovel.domain.application.client.PostingPageClient;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class PostingImportServiceTests {

    @Test
    @DisplayName("처음 받은 HTML에 메뉴만 있으면 브라우저에서 본문을 읽고 OCR은 호출하지 않는다")
    void readsRenderedTextWhenInitialPageHasNoPosting() throws Exception {
        String url = "https://careers.example.com/posting";
        var pageClient = mock(PostingPageClient.class);
        var browserClient = mock(PostingBrowserClient.class);
        var ocrClient = mock(PostingOcrClient.class);
        when(pageClient.fetch(url)).thenReturn(Jsoup.parse("<body>로그인\n채용 메뉴</body>", url));
        when(browserClient.render(url)).thenReturn(Jsoup.parse("<main><h2>주요 업무</h2><p>API 개발</p></main>", url));

        var service = new PostingImportService(pageClient, browserClient, ocrClient, JsonMapper.builder().build());

        assertEquals("주요 업무\nAPI 개발", service.importPosting(url).sourceText());
        verifyNoInteractions(ocrClient);
    }
}
