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

## 지원 건

상태 `구현됨` · 서버 계정 인증 연결 전에는 [내 공통 자소서](#내-공통-자소서)와 같은 미리보기 프로필 접근 키로 사용자를 구분한다.

| 요청 | 요청 본문 | 성공 응답 |
|---|---|---|
| `POST /api/applications` | 지원 건 등록 본문 | `201`, `Location: /api/applications/{id}`, 상세 |
| `GET /api/applications` | 없음 | `200 [{id, company, role, status, deadline}]`, 최근에 등록한 순서 |
| `GET /api/applications/{id}` | 없음 | `200` 상세 |

등록 요청 본문은 아래와 같다. `deadline`, `sourceUrl`, `sourceText`, `sections`, `stages`는 생략하거나 비울 수 있다.

```json
{
  "company": "예시 회사",
  "role": "백엔드 개발자",
  "deadline": {"kind": "fixed", "date": "2026-12-16", "time": "23:59"},
  "sourceUrl": "https://careers.example.com/jobs/1",
  "sourceText": "공고 원문",
  "sections": [{"title": "업무", "body": "API 개발"}],
  "stages": ["서류전형", "1차 면접"]
}
```

- **회사·직무:** 앞뒤 공백을 제거한 뒤 회사는 1~100자, 직무는 1~150자다.
- **마감:** `kind`는 `fixed`, `rolling`, `until_filled`, `always_open` 중 하나다. `fixed`는 `date`(`YYYY-MM-DD`)가 필수이고 `time`(`HH:mm`)은 선택이다. 나머지 종류는 `date`와 `time`을 넣지 않는다. 마감을 모르면 `deadline`을 생략한다.
- **원문:** `sourceUrl`은 최대 2,048자, `sourceText`는 최대 30,000자다.
- **항목·전형:** `sections`와 `stages`는 보낸 순서대로 저장한다. 항목은 최대 30개이고 제목 1~100자, 본문 최대 20,000자다. 전형은 최대 20개이고 이름은 1~100자다.
- **상세 응답:** `{id, company, role, status, deadline, sourceUrl, sourceText, sections: [{id, title, body}], stages: [{id, name}]}`다. 새 지원 건의 `status`는 `interested`다. 자소서 문항은 별도 API에서 다룬다.
- **접근 키:** `Authorization: Bearer <소문자 16진수 64자>` 헤더가 필요하다. 다른 사용자의 지원 건은 없는 지원 건과 똑같이 응답한다.

| 상태 | 코드 | 조건 |
|---|---|---|
| `400` | `INVALID_REQUEST` | 필수값 누락, 길이·형식·마감 조합 오류 |
| `401` | `APPLICATION_UNAUTHORIZED` | 접근 키 누락 또는 형식 오류 |
| `404` | `APPLICATION_NOT_FOUND` | 없거나 내 것이 아닌 지원 건 |

[로컬 확인 요청](../../backend/http/applications.http)

```sh
npx httpyac@6.16.7 send backend/http/applications.http --all
```

## 공고 링크 가져오기

상태 `구현됨`

`POST /api/postings/import`는 공개 공고의 표준 `JobPosting` 데이터와 상세 텍스트를 확인한다. 본문이 없으면 같은 사이트의 대표 주소를 확인한다. 동적 본문, 접힌 내용, 상세 iframe은 Chromium에서 읽는다. 원티드의 접힌 전형과 문항은 같은 공고의 내장 데이터에서 읽는다. 텍스트가 부족하면 공고 이미지를 찾아 읽을 수 있는 크기로 나누어 한 번의 모델 요청으로 보낸다. 기본 모델은 GPT-5.4 mini다. 인증 없이 호출할 수 있으며, 가져온 값은 확인 화면에서 수정한 후 등록한다. [컨트롤러](../../backend/src/main/java/com/janovel/domain/application/api/PostingImportController.java)

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
| `positions` | 배열 | 공고에 명시된 여러 모집 직무. 항목마다 `role`, `deadline`, `deadlineTime`, `sections`, `stages`, `questions`를 포함한다. 공통 값은 상위 필드에 둔다. 모집 직무가 하나면 상위 필드를 채우고 빈 배열을 반환한다. |
| `sourceText` | 문자열 | 링크에서 확보한 본문. 최대 30,000자이며 이미지로 읽은 경우 빈 문자열이다. |

```json
{
  "company": "예시 회사",
  "role": "백엔드 개발자",
  "deadline": "2027-03-30",
  "deadlineTime": "",
  "sections": [{"title": "주요 업무", "body": "API를 개발합니다."}],
  "stages": ["서류전형", "면접"],
  "questions": [],
  "positions": [],
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

모집 직무가 여러 개면 사용자가 등록할 직무를 먼저 선택한다. 확인 화면은 공통 항목과 선택한 직무의 항목을 함께 보여준다.

## 공고 이미지 가져오기

상태 `구현됨`

- `POST /api/postings/import-image`는 `multipart/form-data`의 `image` 파일 한 개를 받아 이미지 입력으로 모델에 전달한다. PNG·JPEG·WebP를 지원하며 파일은 최대 10 MiB다.

이미지 첨부 요청은 작업을 접수하면 `202 Accepted`와 `Location`을 반환한다. `Location`에서 상태를 조회할 수 있다. 접수 한도를 넘으면 `503 POSTING_IMPORT_BUSY`를 반환한다.

```json
{"jobId":"3e0f7de1-970c-44b3-8231-a5a0ffdf93d3","status":"QUEUED"}
```

`GET /api/postings/import-jobs/{jobId}`는 `200`과 현재 작업 상태를 반환한다. `QUEUED`, `PROCESSING`이면 `Retry-After: 1`에 따라 잠시 뒤 조회한다. `COMPLETED`면 `result`에 구조화한 항목을 반환하고 `sourceText`는 빈 문자열이다. `FAILED`면 `error`에 `status`, `message`, `error`가 있다. 완료·실패 결과는 최대 2분간 조회할 수 있으며, 작업이 없거나 조회 기간이 지나면 `404 POSTING_IMPORT_JOB_NOT_FOUND`를 반환한다.

사용자는 이미지 처리 완료까지 로딩 화면에서 기다린다. 결과가 도착하면 확인 화면에 채우고, 실패하면 원문을 보면서 직접 입력할 수 있다. [실행 예제](../../backend/http/posting-images.http) · [공고 구조화 계획](../planning/08-posting-structured-import.md)

## 자소서 문항 자동 채움과 제보

상태 `구현됨` · 서버 인증 연결 전에는 `local` 프로필의 루프백 서버에서 확인할 수 있다.

| 요청 | 요청 본문 | 성공 응답 |
|---|---|---|
| `POST /api/postings/shared-questions/lookup` | `{url, role}` | `200 {id, questions}` 또는 문항이 없으면 `204` |
| `POST /api/postings/shared-questions` | `{url, role, questions}` | 최초 저장 시 `201`, 같은 공고·직무에 이미 저장돼 있으면 `204` |
| `POST /api/postings/shared-questions/{id}/reports` | `{questions}`. 정정 제안이 없으면 `{}` | 제보 저장 시 `201` |

`questions`는 등록 순서대로 나열한 `{prompt, limit}` 배열이다. 문항은 최대 30개, 문항 본문은 최대 2,000자, 확인된 제한은 1~100,000자다. 제한이 미확인이면 `limit`은 `null`이다. 공고는 상세 URL을, 직무는 최대 150자의 이름을 사용한다. 공고별 상세 주소의 경로, 식별 쿼리, 화면 경로는 유지하고 알려진 추적 값만 제거한다. 응답의 `id`는 자동 채운 문항 세트의 버전을 나타내며 제보는 이 버전에 연결된다. 제보는 공통 문항을 변경하지 않는다.

| 상태 | 코드 | 조건 |
|---|---|---|
| `400` | `INVALID_REQUEST` | 필수 값 누락 또는 문항 본문·제한·개수 범위 오류 |
| `400` | `INVALID_POSTING_URL` | 상세 공고 주소로 사용할 수 없는 URL |
| `404` | `POSTING_QUESTIONS_NOT_FOUND` | 제보할 문항 버전이 없음 |

[로컬 확인 요청](../../backend/http/shared-posting-questions.http)

```sh
npx httpyac@6.16.7 send backend/http/shared-posting-questions.http --all
```

## 내 공통 자소서

상태 `구현됨` · 서버 계정 인증 연결 전에는 루프백의 `local` 프로필에서 미리보기 프로필별로 이용한다.

| 요청 | 요청 본문 | 성공 응답 |
|---|---|---|
| `GET /api/me/essay-template` | 없음 | `200 {items}`. 저장한 내용이 없으면 빈 배열 |
| `PUT /api/me/essay-template` | `{items}` | 세트 저장 시 `204`. 빈 배열은 현재 세트 비우기 |

`items`는 저장 순서대로 나열한 `{prompt, draftBody, limit}` 배열이다. 최대 30개까지 저장하고 문항은 1~2,000자, 초안은 최대 20,000자다. 글자 수 제한은 미확인이면 `null`이고 값이 있으면 1~100,000자다. 요청에는 현재 브라우저의 미리보기 프로필이 보유한 32바이트 접근 키를 `Authorization: Bearer <소문자 16진수 64자리>`로 보낸다. 서버는 키로 소유자를 찾는다.

| 상태 | 코드 | 조건 |
|---|---|---|
| `400` | `INVALID_REQUEST` | 배열 또는 항목 형식이나 길이 범위 오류 |
| `401` | `ESSAY_TEMPLATE_UNAUTHORIZED` | 접근 키 누락 또는 형식 오류 |

[로컬 확인 요청](../../backend/http/essay-template.http)

```sh
npx httpyac@6.16.7 send backend/http/essay-template.http --all
```
