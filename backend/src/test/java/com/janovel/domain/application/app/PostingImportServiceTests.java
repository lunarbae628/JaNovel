package com.janovel.domain.application.app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.janovel.domain.application.client.PostingBrowserClient;
import com.janovel.domain.application.client.PostingModelClient;
import com.janovel.domain.application.client.PostingPageClient;
import com.janovel.domain.application.dto.ImportedPosting;
import java.util.List;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
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
        when(browserClient.collect(eq(url), anyLong(), any())).thenAnswer(call -> {
            java.util.function.Function<org.jsoup.nodes.Document, String> extract = call.getArgument(2);
            return new PostingBrowserClient.RenderedPosting(
                    extract.apply(Jsoup.parse("<main><h2>주요 업무</h2><p>API 개발</p></main>", url)), List.of());
        });

        String collected = "주요 업무\nAPI 개발";
        var posting = new ImportedPosting("", "", "", "", List.of(), List.of(), List.of(), List.of(), collected);
        when(modelClient.classifyText(eq(collected), anyLong())).thenReturn(posting);
        var service = new PostingImportService(pageClient, browserClient, modelClient, JsonMapper.builder().build());

        assertEquals("주요 업무\nAPI 개발", service.importPosting(url).sourceText());
        verify(modelClient).classifyText(eq(collected), anyLong());
    }

    @Test
    @DisplayName("사이트와 상관없이 표준 공고 정보와 펼친 본문을 함께 읽는다")
    void readsStructuredAndExpandedText() throws Exception {
        String url = "https://careers.example.com/jobs/12345";
        var pageClient = mock(PostingPageClient.class);
        var browserClient = mock(PostingBrowserClient.class);
        var modelClient = mock(PostingModelClient.class);
        String metadata = """
                <script type="application/ld+json">
                {"@type":"JobPosting","title":"서비스 개발자","description":"API 개발",
                 "hiringOrganization":{"name":"예시 회사"}}
                </script>
                """;
        when(pageClient.fetch(url)).thenReturn(Jsoup.parse(
                metadata + "<main><details><summary>채용 상세</summary></details></main>", url));
        when(browserClient.collect(eq(url), anyLong(), any())).thenAnswer(call -> {
            java.util.function.Function<org.jsoup.nodes.Document, String> extract = call.getArgument(2);
            return new PostingBrowserClient.RenderedPosting(extract.apply(Jsoup.parse(metadata + """
                    <main><h1>서비스 개발자</h1><p>API 개발</p>
                    <h2>채용 절차</h2><p>서류 검토 ＞ 전화 면접 ＞ 기술 면접 ＞ 최종합격</p>
                    <h2>고용 조건</h2><p>6개월 계약직, 근무 성과에 따라 정규직 채용 가능</p>
                    <ul><li><a href="/jobs/999">다른 개발자 공고</a></li>
                    <li><a href="/jobs/888">다른 기획자 공고</a></li>
                    <li><a href="/jobs/12345">서비스 개발자</a></li></ul>
                    <aside>추천 공고</aside></main>
                    """, url)), List.of());
        });
        var service = new PostingImportService(pageClient, browserClient, modelClient, JsonMapper.builder().build());

        service.importPosting(url);

        var input = ArgumentCaptor.forClass(String.class);
        verify(modelClient).classifyText(input.capture(), anyLong());
        assertTrue(input.getValue().contains("회사명: 예시 회사"));
        assertTrue(input.getValue().contains("서류 검토 ＞ 전화 면접 ＞ 기술 면접 ＞ 최종합격"));
        assertTrue(input.getValue().contains("6개월 계약직, 근무 성과에 따라 정규직 채용 가능"));
        assertFalse(input.getValue().contains("추천 공고"));
        assertFalse(input.getValue().contains("다른 개발자 공고"));
    }

    @Test
    @DisplayName("본문이 없는 전달 페이지는 같은 사이트의 표준 대표 주소에서 상세 본문을 읽는다")
    void readsCanonicalDetailWithoutDomainRule() throws Exception {
        String relay = "https://careers.example.com/jobs/share?source=list&id=12345#job";
        String detail = "https://careers.example.com/jobs/view?id=12345";
        var pageClient = mock(PostingPageClient.class);
        var browserClient = mock(PostingBrowserClient.class);
        var modelClient = mock(PostingModelClient.class);
        when(pageClient.fetch(relay)).thenReturn(Jsoup.parse("""
                <link rel="canonical" href="/jobs/view?id=12345">
                <body><aside><h2>추천 공고</h2><p>추천 공고의 지원자격</p></aside></body>
                """, relay));
        when(pageClient.fetch(detail)).thenReturn(Jsoup.parse("""
                <div><header><a>예시 회사</a><h1>전략기획</h1></header>
                <section><h2>실제 지원 요건</h2><p>학사 이상</p></section>
                <section><h2>접수기간 및 방법</h2><p>마감일 2026.11.25 23:59</p></section></div>
                <aside>추천 공고의 지원자격</aside>
                """, detail));
        var service = new PostingImportService(pageClient, browserClient, modelClient, JsonMapper.builder().build());

        service.importPosting(relay);

        var input = ArgumentCaptor.forClass(String.class);
        verify(modelClient).classifyText(input.capture(), anyLong());
        assertTrue(input.getValue().contains("학사 이상"));
        assertTrue(input.getValue().contains("예시 회사"));
        assertTrue(input.getValue().contains("공고 제목: 전략기획"));
        assertTrue(input.getValue().contains("2026.11.25 23:59"));
        assertFalse(input.getValue().contains("추천 공고"));
        verifyNoInteractions(browserClient);
    }

    @Test
    @DisplayName("공고 제목과 지원 자격 빈 제목만 있는 페이지는 이미지 경로로 읽는다")
    void usesImagesForAHeadingWithoutBody() throws Exception {
        String url = "https://careers.example.com/picture";
        var pageClient = mock(PostingPageClient.class);
        var browserClient = mock(PostingBrowserClient.class);
        var modelClient = mock(PostingModelClient.class);
        var html = Jsoup.parse("<main><h1>개발자 채용</h1><h2>지원 자격</h2><img src='notice.png'></main>", url);
        when(pageClient.fetch(url)).thenReturn(html);
        var images = List.of(new byte[]{1, 2});
        when(browserClient.collect(eq(url), anyLong(), any())).thenReturn(new PostingBrowserClient.RenderedPosting(null, images));
        var service = new PostingImportService(pageClient, browserClient, modelClient, JsonMapper.builder().build());
        service.importPosting(url);

        verify(modelClient).classifyScreenshots(eq(images), eq(""), anyLong());
    }

    @Test
    @DisplayName("원티드의 화면에서 누락되는 전형과 지원 문항은 같은 공고의 내장 데이터에서 확보한다")
    void readsMissingWantedDetailsOnlyForTheMatchingPosting() throws Exception {
        String url = "https://www.wanted.co.kr/wd/12345";
        var pageClient = mock(PostingPageClient.class);
        var browserClient = mock(PostingBrowserClient.class);
        var modelClient = mock(PostingModelClient.class);
        when(pageClient.fetch(url)).thenReturn(Jsoup.parse("""
                <script type="application/ld+json">
                {"@type":"JobPosting","title":"개발자","hiringOrganization":{"name":"예시 회사"}}
                </script>
                <script id="__NEXT_DATA__" type="application/json">
                {"props":{"pageProps":{"initialData":{"id":12345,"main_tasks":"API 개발",
                  "employment_note":"6개월 계약직","hire_rounds":"서류, 1차 면접. 기술 선택을 설명해 주세요."}}}}
                </script>
                <main><button>상세 정보 더 보기</button></main>
                """, url));
        var service = new PostingImportService(pageClient, browserClient, modelClient, JsonMapper.builder().build());

        service.importPosting(url);

        var input = ArgumentCaptor.forClass(String.class);
        verify(modelClient).classifyText(input.capture(), anyLong());
        assertTrue(input.getValue().contains("예시 회사"));
        assertTrue(input.getValue().contains("6개월 계약직"));
        assertTrue(input.getValue().contains("기술 선택을 설명해 주세요."));
        verifyNoInteractions(browserClient);
    }

    @Test
    @DisplayName("짧은 공고 소개밖에 없으면 렌더링한 상세를 읽고 표준 회사명과 마감을 유지한다")
    void rendersWhenStructuredDescriptionIsOnlyASummary() throws Exception {
        String url = "https://careers.example.com/openings/12345";
        var pageClient = mock(PostingPageClient.class);
        var browserClient = mock(PostingBrowserClient.class);
        var modelClient = mock(PostingModelClient.class);
        String summary = """
                <script type="application/ld+json">
                {"@type":"JobPosting","title":"웹 개발자","hiringOrganization":{"name":"예시 회사"},
                 "validThrough":"2026-11-29T23:59","description":"예시 회사에서 개발자를 채용합니다. 자세한 조건은 공고를 확인해 주세요."}
                </script>
                """;
        when(pageClient.fetch(url)).thenReturn(Jsoup.parse(summary, url));
        when(browserClient.collect(eq(url), anyLong(), any())).thenAnswer(call -> {
            java.util.function.Function<org.jsoup.nodes.Document, String> extract = call.getArgument(2);
            return new PostingBrowserClient.RenderedPosting(extract.apply(Jsoup.parse(summary + """
                    <article><h2>이런 업무를 해요</h2><p>웹 애플리케이션 개발</p>
                    <h2>이런 분을 찾고 있어요</h2><p>관련 경력 3년 이상</p></article>
                    """, url)), List.of());
        });
        when(modelClient.classifyText(any(), anyLong()))
                .thenReturn(new ImportedPosting("예시 회사", "웹 개발자", "2026-11-29", "",
                        List.of(), List.of(), List.of(), List.of(), ""));
        var service = new PostingImportService(pageClient, browserClient, modelClient, JsonMapper.builder().build());

        var result = service.importPosting(url);

        var input = ArgumentCaptor.forClass(String.class);
        verify(modelClient).classifyText(input.capture(), anyLong());
        assertTrue(input.getValue().contains("웹 애플리케이션 개발"));
        assertTrue(input.getValue().contains("관련 경력 3년 이상"));
        assertTrue(input.getValue().contains("회사명: 예시 회사"));
        assertTrue(input.getValue().contains("마감일: 2026-11-29 23:59"));
        assertFalse(input.getValue().contains("자세한 조건은 공고"));
        assertEquals("23:59", result.deadlineTime());
    }

    @Test
    @DisplayName("원문이 채용 시 마감이면 모델이 추측한 마감 날짜를 비운다")
    void clearsGuessedDateForOpenEndedPosting() throws Exception {
        String url = "https://careers.example.com/jobs/open";
        var pageClient = mock(PostingPageClient.class);
        var browserClient = mock(PostingBrowserClient.class);
        var modelClient = mock(PostingModelClient.class);
        when(pageClient.fetch(url)).thenReturn(Jsoup.parse("""
                <main><h1>웹 개발자</h1><p>채용 시 마감</p>
                <h2>주요 업무</h2><p>웹 애플리케이션 개발</p></main>
                """, url));
        when(modelClient.classifyText(any(), anyLong()))
                .thenReturn(new ImportedPosting("예시 회사", "웹 개발자", "2026-11-24", "18:00",
                        List.of(), List.of(), List.of(), List.of(), ""));
        var service = new PostingImportService(pageClient, browserClient, modelClient, JsonMapper.builder().build());

        var result = service.importPosting(url);

        assertEquals("", result.deadline());
        assertEquals("", result.deadlineTime());
    }

    @Test
    @DisplayName("사람인 상세 문서의 본문 이미지는 요약 텍스트와 함께 모델에 전달한다")
    void sendsSaraminDetailImagesWithSummary() throws Exception {
        String url = "https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=1000001";
        String detailUrl = "https://www.saramin.co.kr/zf_user/jobs/relay/view-detail?rec_idx=1000001&rec_seq=0";
        String imageUrl = "https://cdn.example.com/body.png";
        var pageClient = mock(PostingPageClient.class);
        var browserClient = mock(PostingBrowserClient.class);
        var modelClient = mock(PostingModelClient.class);
        when(pageClient.fetch(url)).thenReturn(Jsoup.parse(
                "<main><h1>백엔드 개발자</h1><p>우대사항 전공 공학계열 해당직무 근무경험</p></main>", url));
        when(pageClient.fetch(detailUrl)).thenReturn(Jsoup.parse(
                "<body><div class=\"user_content\"><img src=\"" + imageUrl + "\"></div></body>", detailUrl));
        var picture = new java.awt.image.BufferedImage(800, 900, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var png = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(picture, "png", png);
        when(pageClient.fetchImage(eq(imageUrl), anyLong())).thenReturn(png.toByteArray());
        var posting = new ImportedPosting("", "", "", "", List.of(), List.of(), List.of(), List.of(), "");
        when(modelClient.classifyScreenshots(any(), any(), anyLong())).thenReturn(posting);
        var service = new PostingImportService(pageClient, browserClient, modelClient, JsonMapper.builder().build());

        service.importPosting(url);

        var context = ArgumentCaptor.forClass(String.class);
        verify(modelClient).classifyScreenshots(any(), context.capture(), anyLong());
        assertTrue(context.getValue().contains("우대사항 전공 공학계열"));
        verify(modelClient, org.mockito.Mockito.never()).classifyText(any(), anyLong());
    }

    @Test
    @DisplayName("어느 사이트든 본문에 큰 이미지가 있으면 텍스트와 함께 모델에 전달한다")
    void sendsContentImagesWithTextForAnySite() throws Exception {
        String url = "https://careers.example.com/jobs/77";
        String imageUrl = "https://careers.example.com/files/detail.png";
        var pageClient = mock(PostingPageClient.class);
        var modelClient = mock(PostingModelClient.class);
        when(pageClient.fetch(url)).thenReturn(Jsoup.parse(
                "<main><h2>주요 업무</h2><p>API 개발 및 운영</p><img src=\"" + imageUrl + "\">"
                        + "<img src=\"/assets/logo.png\"></main>", url));
        var picture = new java.awt.image.BufferedImage(800, 900, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var png = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(picture, "png", png);
        when(pageClient.fetchImage(eq(imageUrl), anyLong())).thenReturn(png.toByteArray());
        var posting = new ImportedPosting("", "", "", "", List.of(), List.of(), List.of(), List.of(), "");
        when(modelClient.classifyScreenshots(any(), any(), anyLong())).thenReturn(posting);
        var service = new PostingImportService(pageClient, mock(PostingBrowserClient.class), modelClient,
                JsonMapper.builder().build());

        service.importPosting(url);

        verify(modelClient).classifyScreenshots(any(), any(), anyLong());
        verify(pageClient, org.mockito.Mockito.never()).fetchImage(eq("https://careers.example.com/assets/logo.png"), anyLong());
    }

    @Test
    @DisplayName("항목 제목이 알려진 표현과 달라도 본문 텍스트가 충분하면 그대로 모델에 전달한다")
    void sendsPlainTextWhenHeadingsAreUnfamiliar() throws Exception {
        String url = "https://recruit.example.org/detail.jsp?id=7";
        var pageClient = mock(PostingPageClient.class);
        var modelClient = mock(PostingModelClient.class);
        String body = "<div><h3>모집 분야 및 응시자격</h3><p>간호사 면허 소지자 내시경실 경력 1년 이상인 자 "
                + "정규직 주근제 근무</p><h3>전형일정</h3><p>"
                + "서류전형 후 서류합격자에 한하여 개별 면접을 진행합니다. ".repeat(30) + "</p></div>";
        when(pageClient.fetch(url)).thenReturn(Jsoup.parse("<body>" + body + "</body>", url));
        var posting = new ImportedPosting("", "", "", "", List.of(), List.of(), List.of(), List.of(), "");
        when(modelClient.classifyText(any(), anyLong())).thenReturn(posting);
        var service = new PostingImportService(pageClient, mock(PostingBrowserClient.class), modelClient,
                JsonMapper.builder().build());

        service.importPosting(url);

        var text = ArgumentCaptor.forClass(String.class);
        verify(modelClient).classifyText(text.capture(), anyLong());
        assertTrue(text.getValue().contains("내시경실 경력 1년 이상"));
    }

    @Test
    @DisplayName("페이지 메타 설명에만 있는 마감일 같은 정보도 모델에 전달한다")
    void includesMetaDescription() throws Exception {
        String url = "https://careers.example.com/jobs/88";
        var pageClient = mock(PostingPageClient.class);
        var modelClient = mock(PostingModelClient.class);
        when(pageClient.fetch(url)).thenReturn(Jsoup.parse("<head><meta name=\"description\" "
                + "content=\"서비스 개발자, 마감일:2026-12-16\"></head><body><main><h1>서비스 개발자</h1>"
                + "<h2>주요 업무</h2><p>API 개발과 운영</p></main></body>", url));
        var posting = new ImportedPosting("", "", "", "", List.of(), List.of(), List.of(), List.of(), "");
        when(modelClient.classifyText(any(), anyLong())).thenReturn(posting);
        var service = new PostingImportService(pageClient, mock(PostingBrowserClient.class), modelClient,
                JsonMapper.builder().build());

        service.importPosting(url);

        var text = ArgumentCaptor.forClass(String.class);
        verify(modelClient).classifyText(text.capture(), anyLong());
        assertTrue(text.getValue().contains("마감일:2026-12-16"));
    }

    @Test
    @DisplayName("접수기간이 채용시까지이면 모델이 시작일을 마감일로 넣어도 비운다")
    void clearsDeadlineForOpenEndedPeriod() throws Exception {
        String url = "https://careers.example.com/jobs/99";
        var pageClient = mock(PostingPageClient.class);
        var modelClient = mock(PostingModelClient.class);
        when(pageClient.fetch(url)).thenReturn(Jsoup.parse(
                "<main><h1>간호사</h1><h2>모집 부문</h2><p>1) 접수기간 : 2026.10.15( 목 ) ~ 채용시까지</p></main>", url));
        var posting = new ImportedPosting("", "", "2026-10-15", "", List.of(), List.of(), List.of(), List.of(), "");
        when(modelClient.classifyText(any(), anyLong())).thenReturn(posting);
        var service = new PostingImportService(pageClient, mock(PostingBrowserClient.class), modelClient,
                JsonMapper.builder().build());

        assertEquals("", service.importPosting(url).deadline());
    }

    @Test
    @DisplayName("표준 데이터에 마감일이 있어도 화면에 상시채용이 표시되면 마감일을 비운다")
    void clearsStandardDeadlineWhenPageShowsOpenEnded() throws Exception {
        String url = "https://careers.example.com/jobs/101";
        var pageClient = mock(PostingPageClient.class);
        var modelClient = mock(PostingModelClient.class);
        when(pageClient.fetch(url)).thenReturn(Jsoup.parse("""
                <script type="application/ld+json">{"@type":"JobPosting","title":"개발자","validThrough":"2027-11-19T15:00"}</script>
                <main><h1>개발자</h1><h2>주요 업무</h2><p>API 개발</p><p>시작일 2026.11.20</p><p>마감일</p><p>상시채용</p></main>
                """, url));
        var posting = new ImportedPosting("", "", "", "", List.of(), List.of(), List.of(), List.of(), "");
        when(modelClient.classifyText(any(), anyLong())).thenReturn(posting);
        var service = new PostingImportService(pageClient, mock(PostingBrowserClient.class), modelClient,
                JsonMapper.builder().build());

        assertEquals("", service.importPosting(url).deadline());
    }

    @Test
    @DisplayName("선택한 본문 밖에 있는 마감 관련 줄도 모델에 함께 전달한다")
    void appendsClosingLinesOutsideSelectedText() throws Exception {
        String url = "https://careers.example.com/jobs/102";
        var pageClient = mock(PostingPageClient.class);
        var modelClient = mock(PostingModelClient.class);
        when(pageClient.fetch(url)).thenReturn(Jsoup.parse(
                "<main><h1>개발자</h1><h2>주요 업무</h2><p>API 개발과 운영</p></main>"
                        + "<div><p>접수기간 · 방법</p><p>마감일</p><p>상시채용</p></div>", url));
        var posting = new ImportedPosting("", "", "", "", List.of(), List.of(), List.of(), List.of(), "");
        when(modelClient.classifyText(any(), anyLong())).thenReturn(posting);
        var service = new PostingImportService(pageClient, mock(PostingBrowserClient.class), modelClient,
                JsonMapper.builder().build());

        service.importPosting(url);

        var text = ArgumentCaptor.forClass(String.class);
        verify(modelClient).classifyText(text.capture(), anyLong());
        assertTrue(text.getValue().contains("마감 관련 원문"));
        assertTrue(text.getValue().contains("상시채용"));
    }

    @Test
    @DisplayName("메타 설명에 마감일 : 상시채용이 있으면 표준 데이터의 마감일을 비운다")
    void clearsDeadlineFromLabeledOpenEnded() throws Exception {
        String url = "https://careers.example.com/jobs/103";
        var pageClient = mock(PostingPageClient.class);
        var modelClient = mock(PostingModelClient.class);
        when(pageClient.fetch(url)).thenReturn(Jsoup.parse("""
                <head><meta name="description" content="경력 : 3년이상, 마감일 : 상시채용"></head>
                <script type="application/ld+json">{"@type":"JobPosting","title":"개발자","validThrough":"2027-11-19T15:00"}</script>
                <main><h1>개발자</h1><h2>주요 업무</h2><p>API 개발과 운영</p></main>
                """, url));
        var posting = new ImportedPosting("", "", "2027-11-19", "15:00", List.of(), List.of(), List.of(), List.of(), "");
        when(modelClient.classifyText(any(), anyLong())).thenReturn(posting);
        var service = new PostingImportService(pageClient, mock(PostingBrowserClient.class), modelClient,
                JsonMapper.builder().build());

        assertEquals("", service.importPosting(url).deadline());
    }
}
