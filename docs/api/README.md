# JaNovel API 명세

## API 개발 순서

1. 구현 전에 이 문서에 API 경로, 요청, 성공 응답과 오류 응답을 적고 `초안`으로 표시한다.
2. 명세를 보면서 컨트롤러부터 구현하고 필요한 서비스와 저장 계층을 연결한다.
3. 백엔드를 띄우고 `backend/http/`의 요청을 httpYac으로 보내 명세와 응답을 대조한다. 확인한 API는 `구현됨`으로 표시한다.

## 로컬에서 확인하기

백엔드를 실행한 뒤 저장소 루트에서 아래 명령을 실행한다. 공고 예시 링크가 만료되면 `postings.http`의 `postingUrl`을 현재 열리는 공개 공고 링크로 바꾼다. [백엔드 실행 방법](../../backend/README.md#실행과-테스트) · [실행 예제](../../backend/http/postings.http)

```sh
npx httpyac@6.16.7 send backend/http/postings.http --all
```

### curl, Postman, IntelliJ에서 실행하기

터미널에서 아래 `curl` 명령으로 공고 가져오기를 한 건 호출할 수 있다.

```sh
curl --request POST 'http://127.0.0.1:8080/api/postings/import' \
  --header 'Content-Type: application/json' \
  --data-raw '{"url":"https://recruit.wanted.co.kr/wd/391542"}'
```

Postman 데스크톱 앱에서는 위 `curl` 명령 전체를 **Import**에 붙여 넣고 가져온 요청에서 **Send**를 누른다. [Postman 가져오기 안내](https://learning.postman.com/docs/getting-started/importing-and-exporting/importing-data#import-a-curl-command-into-postman)

IntelliJ IDEA Ultimate의 HTTP Client를 사용하면 각 `.http` 요청 옆의 실행 버튼으로 호출할 수 있다. [실행 예제](../../backend/http/postings.http)

## 공고 링크 가져오기

상태 `구현됨`

`POST /api/postings/import`는 공개 공고의 본문을 HTTP로 읽고, 본문이 부족하면 Chromium으로 읽는다. Java가 확보한 본문을 설정된 OpenAI 모델에 전달해 지원 건 초안을 만든다. 기본 모델은 GPT-6 Luna다. 인증 없이 호출할 수 있으며, 가져온 값은 확인 화면에서 수정한 후 등록한다. [컨트롤러](../../backend/src/main/java/com/janovel/domain/application/api/PostingImportController.java)

### 요청

`Content-Type: application/json`

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `url` | 문자열 | 예 | 공개 `http` 또는 `https` 공고 URL. 빈 값과 공백만 있는 값은 허용하지 않으며 최대 2,048자다. |

```json
{
  "url": "https://recruit.wanted.co.kr/wd/391542"
}
```

### 성공 응답 `200 OK`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `company` | 문자열 | 회사명. 최대 100자이며 가져오지 못하면 빈 문자열을 반환한다. |
| `role` | 문자열 | 직무명. 최대 150자이며 확인하지 못하면 빈 문자열을 반환한다. |
| `deadline` | 문자열 | 공고에 표기된 마감일의 날짜 부분 `YYYY-MM-DD`. 가져오지 못하면 빈 문자열을 반환한다. |
| `deadlineTime` | 문자열 | 확인된 마감 시각 `HH:mm`. 확인하지 못하면 빈 문자열이다. |
| `sections` | 배열 | 공고 항목 `{title, body}`. |
| `stages` | 문자열 배열 | 공고에 나온 채용 전형 순서. |
| `questions` | 배열 | 자소서 문항 `{prompt, limit}`. 글자 수를 확인하지 못하면 `limit`은 `null`이다. |
| `sourceText` | 문자열 | 링크에서 확보한 본문. 최대 30,000자이며 이미지 입력에서는 빈 문자열이다. |

```json
{
  "company": "예시 회사",
  "role": "백엔드 개발자",
  "deadline": "2027-03-30",
  "deadlineTime": "",
  "sections": [{"title": "주요 업무", "body": "API를 개발합니다."}],
  "stages": ["서류전형", "면접"],
  "questions": [],
  "sourceText": "주요 업무\nAPI를 개발합니다.\n지원 요건\nSpring 개발 경험"
}
```

### 오류 응답

`status`는 HTTP 상태 번호, `message`는 사용자에게 표시할 메시지, `error`는 클라이언트가 분기에 사용하는 문자열이다.

| HTTP 상태 | `error` | 반환 조건 |
| --- | --- | --- |
| `400` | `INVALID_REQUEST` | JSON 형식이 잘못되었거나 본문 또는 `url`이 비어 있거나 `url` 길이 제한을 넘었다. |
| `400` | `INVALID_POSTING_URL` | URL 형식이 잘못되었거나 내부 주소 등 허용하지 않는 주소다. |
| `502` | `POSTING_UNREADABLE` | 공고 페이지 응답 오류, 접근 제한 또는 상세 본문 미확인이다. |
| `502` | `POSTING_MODEL_FAILED` | 모델이 유효한 공고 데이터를 반환하지 않았다. |
| `503` | `POSTING_MODEL_UNAVAILABLE` | 모델 API 설정이나 연결을 사용할 수 없다. |
| `503` | `POSTING_IMPORT_BUSY` | 공고를 가져오는 작업이 처리 한도에 도달했다. |
| `504` | `POSTING_TIMEOUT` | 공고를 읽는 중 제한 시간을 넘겼다. |

공고 수집부터 모델 응답까지 서버 제한 시간은 27초다. [구조화 계획과 검증](../planning/08-posting-structured-import.md)

```json
{
  "status": 400,
  "message": "공개 HTTP 또는 HTTPS 공고 주소를 입력해 주세요.",
  "error": "INVALID_POSTING_URL"
}
```

## 공고 이미지 가져오기

상태 `구현됨`

- `POST /api/postings/import/retry`는 기존 `{"url":"https://…"}`를 받아 공고 본문을 캡처해 이미지 입력으로 모델에 전달한다. 확인 화면에서 사용자가 재시도를 선택할 때 호출한다.
- `POST /api/postings/import-image`는 `multipart/form-data`의 `image` 파일 한 개를 받아 이미지 입력으로 모델에 전달한다. PNG·JPEG·WebP를 지원하며 파일은 최대 10 MiB다.

두 이미지 요청은 작업을 접수하면 `202 Accepted`와 `Location`을 반환한다. `Location`에서 상태를 조회할 수 있다. 접수 한도를 넘으면 `503 POSTING_IMPORT_BUSY`를 반환한다.

```json
{"jobId":"3e0f7de1-970c-44b3-8231-a5a0ffdf93d3","status":"QUEUED"}
```

`GET /api/postings/import-jobs/{jobId}`는 `200`과 현재 작업 상태를 반환한다. `QUEUED`, `PROCESSING`이면 `Retry-After: 1`에 따라 잠시 뒤 조회한다. `COMPLETED`면 `result`에 구조화한 항목을 반환하고 `sourceText`는 빈 문자열이다. `FAILED`면 `error`에 `status`, `message`, `error`가 있다. 완료·실패 결과는 최대 2분간 조회할 수 있으며, 작업이 없거나 조회 기간이 지나면 `404 POSTING_IMPORT_JOB_NOT_FOUND`를 반환한다.

사용자는 이미지 처리 완료까지 로딩 화면에서 기다린다. 결과가 도착하면 확인 화면에 채우고, 실패하면 원문을 보면서 재시도하거나 직접 입력할 수 있다. [실행 예제](../../backend/http/posting-images.http) · [공고 구조화 계획](../planning/08-posting-structured-import.md)
