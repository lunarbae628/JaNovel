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

`POST /api/postings/import`는 공개 공고 HTML에서 지원 건 등록에 필요한 값을 읽어 반환한다. 인증 없이 호출할 수 있으며, 가져온 값은 확인 화면에서 수정한 후 등록한다. [컨트롤러](../../backend/src/main/java/com/janovel/domain/application/api/PostingImportController.java)

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
| `role` | 문자열 | 직무명 또는 페이지 제목. 최대 150자이며 가져오지 못하면 빈 문자열을 반환한다. |
| `deadline` | 문자열 | 공고에 표기된 마감일의 날짜 부분 `YYYY-MM-DD`. 가져오지 못하면 빈 문자열을 반환한다. |
| `sourceText` | 문자열 | 줄바꿈을 포함한 공고 본문. 최대 30,000자다. |

```json
{
  "company": "예시 회사",
  "role": "백엔드 개발자",
  "deadline": "2027-03-30",
  "sourceText": "주요 업무\nAPI를 개발합니다.\n지원 요건\nSpring 개발 경험"
}
```

### 오류 응답

`status`는 HTTP 상태 번호, `message`는 사용자에게 표시할 메시지, `error`는 클라이언트가 분기에 사용하는 문자열이다.

| HTTP 상태 | `error` | 반환 조건 |
| --- | --- | --- |
| `400` | `INVALID_REQUEST` | JSON 형식이 잘못되었거나 본문 또는 `url`이 비어 있거나 `url` 길이 제한을 넘었다. |
| `400` | `INVALID_POSTING_URL` | URL 형식이 잘못되었거나 내부 주소 등 허용하지 않는 주소다. |
| `502` | `POSTING_UNREADABLE` | 공고 페이지가 오류를 반환했거나 읽을 수 있는 HTML 본문을 가져오지 못했다. |
| `504` | `POSTING_TIMEOUT` | 공고 페이지를 읽는 중 응답 제한 시간을 넘겼다. |

```json
{
  "status": 400,
  "message": "공개 HTTP 또는 HTTPS 공고 주소를 입력해 주세요.",
  "error": "INVALID_POSTING_URL"
}
```
