package com.janovel.domain.application.api;

import com.janovel.domain.application.app.PostingImportJobs;
import com.janovel.domain.application.app.PostingImportService;
import com.janovel.domain.application.dto.PostingImportJobStatus;
import com.janovel.domain.application.dto.ImportedPosting;
import com.janovel.domain.application.dto.PostingImportRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.io.IOException;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "공고 가져오기", description = "공개 공고의 표준 `JobPosting` 데이터와 상세 텍스트를 읽고, 동적 본문·접힌 내용·상세 iframe은 Chromium으로 읽는다. 본문 텍스트와 본문 후보 이미지(최대 4장)를 함께 모델에 보내 구조화한다. 사람인은 별도의 상세 문서를 직접 읽고, 원티드의 접힌 전형과 문항은 내장 데이터에서 읽는다. 인증 없이 호출할 수 있으며 가져온 값은 확인 화면에서 수정한 뒤 등록한다.")
@RestController
@RequestMapping("/api/postings")
public class PostingImportController {

    private final PostingImportService postingImportService;
    private final PostingImportJobs jobs;

    public PostingImportController(PostingImportService postingImportService, PostingImportJobs jobs) {
        this.postingImportService = postingImportService;
        this.jobs = jobs;
    }

    @Operation(summary = "공고 링크 가져오기",
            description = "공고 수집부터 모델 응답까지 서버 제한 시간은 27초다. 모집 직무가 여러 개면 `positions`에 담으며 사용자가 등록할 직무를 먼저 고른다.")
    @ApiResponse(responseCode = "200", description = "공고에서 읽어 낸 값")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: JSON 형식이나 `url`이 잘못됐다. `INVALID_POSTING_URL`: URL 형식이 잘못됐거나 내부 주소 등 허용하지 않는 주소다.")
    @ApiResponse(responseCode = "502", description = "`POSTING_UNREADABLE`: 공고 페이지 응답 오류, 접근 제한 또는 상세 본문 미확인. `POSTING_MODEL_FAILED`: 모델이 유효한 공고 데이터를 반환하지 않았다.")
    @ApiResponse(responseCode = "503", description = "`POSTING_MODEL_UNAVAILABLE`: 모델 설정이나 연결을 사용할 수 없다. `POSTING_IMPORT_BUSY`: 처리 한도에 도달했다.")
    @ApiResponse(responseCode = "504", description = "`POSTING_TIMEOUT`: 공고를 읽는 중 제한 시간을 넘겼다.")
    @PostMapping("/import")
    public ImportedPosting importPosting(@Valid @RequestBody PostingImportRequest request) {
        return postingImportService.importPosting(request.url());
    }

    @Operation(summary = "공고 이미지 가져오기",
            description = "`multipart/form-data`의 `image` 파일 한 개(PNG·JPEG·WebP, 최대 10 MiB)를 모델에 전달한다. 작업을 접수하면 `202`와 `Location`을 반환하고, 결과는 작업 조회 API로 가져온다. 사용자는 완료까지 로딩 화면에서 기다린다.")
    @ApiResponse(responseCode = "202", description = "접수했다. `Location`에서 상태를 조회한다.")
    @ApiResponse(responseCode = "400", description = "`INVALID_REQUEST`: `image` 파트가 없다. `POSTING_INVALID_IMAGE`: 이미지로 읽을 수 없는 파일이다.")
    @ApiResponse(responseCode = "413", description = "`POSTING_IMAGE_TOO_LARGE`: 파일이 10 MiB를 넘거나 디코딩할 이미지가 너무 크다.")
    @ApiResponse(responseCode = "415", description = "`UNSUPPORTED_POSTING_IMAGE`: PNG·JPEG·WebP가 아니다.")
    @ApiResponse(responseCode = "503", description = "`POSTING_IMPORT_BUSY`: 접수 한도를 넘었다.")
    @PostMapping(path = "/import-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PostingImportJobStatus> importImage(@RequestPart("image") MultipartFile image)
            throws IOException {
        return accepted(jobs.submitImage(image.getBytes(), image.getContentType()));
    }

    @Operation(summary = "이미지 가져오기 작업 조회",
            description = "`QUEUED`, `PROCESSING`이면 `Retry-After: 1`에 따라 다시 조회한다. `COMPLETED`면 `result`에 구조화한 항목이 있고 `FAILED`면 `error`가 있다. 완료·실패 결과는 최대 2분간 조회할 수 있다.")
    @ApiResponse(responseCode = "200", description = "현재 작업 상태",
            headers = @Header(name = "Retry-After", description = "작업이 진행 중일 때만 있다. 다시 조회할 때까지 기다릴 초"))
    @ApiResponse(responseCode = "404", description = "`POSTING_IMPORT_JOB_NOT_FOUND`: 작업이 없거나 조회 기간이 지났다.")
    @GetMapping("/import-jobs/{jobId}")
    public ResponseEntity<PostingImportJobStatus> getJob(@PathVariable("jobId") UUID jobId) {
        PostingImportJobStatus job = jobs.find(jobId);
        var response = ResponseEntity.ok().cacheControl(CacheControl.noStore());
        if (job.pending()) {
            response.header(HttpHeaders.RETRY_AFTER, "1");
        }
        return response.body(job);
    }

    private ResponseEntity<PostingImportJobStatus> accepted(PostingImportJobStatus job) {
        return ResponseEntity.accepted()
                .location(URI.create("/api/postings/import-jobs/" + job.jobId()))
                .cacheControl(CacheControl.noStore())
                .body(job);
    }
}
