package com.janovel.domain.application.app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.janovel.domain.application.client.PostingBrowserClient;
import com.janovel.domain.application.client.PostingModelClient;
import com.janovel.domain.application.client.PostingPageClient;
import com.janovel.domain.application.dto.ImportedPosting;
import java.util.List;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class PostingImportServiceTests {

    @Test
    @DisplayName("처음 받은 HTML에 메뉴만 있으면 렌더링한 본문을 모델에 전달한다")
    void readsRenderedTextWhenInitialPageHasNoPosting() throws Exception {
        String url = "https://careers.example.com/posting";
        var pageClient = mock(PostingPageClient.class);
        var browserClient = mock(PostingBrowserClient.class);
        var modelClient = mock(PostingModelClient.class);
        when(pageClient.fetch(url)).thenReturn(Jsoup.parse("<body>로그인\n채용 메뉴</body>", url));
        when(browserClient.render(url)).thenReturn(Jsoup.parse("<main><h2>주요 업무</h2><p>API 개발</p></main>", url));

        String collected = "주요 업무\nAPI 개발";
        var posting = new ImportedPosting("", "", "", "", List.of(), List.of(), List.of(), collected);
        when(modelClient.classifyText(eq(collected), anyLong())).thenReturn(posting);
        var service = new PostingImportService(pageClient, browserClient, modelClient, JsonMapper.builder().build());

        assertEquals("주요 업무\nAPI 개발", service.importPosting(url).sourceText());
        verify(modelClient).classifyText(eq(collected), anyLong());
    }
}
