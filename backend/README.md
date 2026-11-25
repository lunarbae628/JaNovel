# JaNovel 백엔드

Java 21·Spring Boot 백엔드다. PostgreSQL 스키마와 JPA 엔티티, 공고 링크 가져오기 API가 구현되어 있다. 지원 건 저장 API와 서버 인증은 다음 단계다. [제품 기획과 저장 설계](../docs/planning/01-product-plan.md)

## 공고 링크 가져오기

공개 공고 링크는 표준 `JobPosting` 데이터와 상세 텍스트를 먼저 읽는다. 본문이 부족하면 Chromium으로 렌더링해 접힌 내용과 상세 iframe도 읽는다. Java가 수집한 본문을 OpenAI Responses API로 전달한다. 긴 이미지 공고는 글자 해상도를 유지하도록 세로로 나누어 한 요청으로 보내며, 사용자 첨부 이미지도 모델의 이미지 입력으로 보낸다. 화면에서 등록한 지원 건은 현재 브라우저에 저장된다. [API 명세와 실행 예제](../docs/api/README.md)

`backend/.env`의 `OPENAI_API_KEY=` 뒤에 키를 넣고 `backend/`에서 백엔드를 실행한다. 배포 환경에서는 같은 이름의 환경 변수를 지정할 수 있다. 키가 비어 있으면 서버는 시작되고 공고 가져오기 요청에 `503 POSTING_MODEL_UNAVAILABLE`을 반환한다. [OpenAI API 키 가이드](https://developers.openai.com/api/docs/quickstart)

공고 모델의 기본값은 `gpt-5.4-mini-2026-03-17`이다. 다른 모델을 쓰려면 같은 파일이나 배포 환경에 `OPENAI_POSTING_MODEL`을 지정하고 백엔드를 다시 실행한다. 모델은 Responses API의 이미지 입력과 Structured Outputs를 지원해야 한다.

```dotenv
OPENAI_POSTING_MODEL=gpt-6-luna
```

브라우저 경로를 쓰려면 `backend/`에서 `./gradlew installPostingBrowser`를 한 번 실행한다. 이미 설치된 Chrome을 사용할 때는 `JANOVEL_POSTINGS_BROWSER_CHANNEL=chrome`으로 백엔드를 실행한다. 브라우저 워커는 기본 두 개이며 `JANOVEL_POSTINGS_BROWSER_WORKERS=1`로 줄일 수 있다.

이미지 요청은 작업을 접수하고 프론트가 완료 상태를 조회한다. 대기열은 최대 세 건, 실행 슬롯은 기본 한 개다. 링크에 쓰는 요청과 이미지에 쓰는 요청을 합쳐 한 인스턴스에서 OpenAI 호출을 최대 네 건 처리한다. [구조화 계획과 검증](../docs/planning/08-posting-structured-import.md)

## 자소서 문항 자동 채움 미리보기

`backend/`에서 `./gradlew bootRun`을 실행하면 기본값으로 `local` 프로필을 사용한다. 백엔드를 `127.0.0.1`에 바인딩하고 문항 공유와 내 공통 자소서 API를 활성화한다. 서버 인증 연결 전에는 내 공통 자소서를 브라우저의 미리보기 프로필별로 저장한다. [공유 문항 API](../docs/api/README.md#자소서-문항-자동-채움과-제보) · [내 공통 자소서 API](../docs/api/README.md#내-공통-자소서)

## 스키마와 패키지

Flyway는 빈 PostgreSQL에 [통합 V1 스키마](src/main/resources/db/migration/V1__initial_schema.sql)를 적용한다. 초기 스키마, 공고·직무, 공고 문항 공유·제보와 개인 자소서 템플릿 테이블이 포함된다. 통합 전 DB의 데이터를 옮길 때는 새 DB에 V1을 적용한 뒤 기존 데이터와 시퀀스를 복사한다. 이때 이전 Flyway 이력은 원본 DB에 보존한다. [통합 V1 DBML](../docs/planning/posting-reference-proposal.dbml)

이미 적용한 스키마를 바꿀 때는 새 마이그레이션을 추가한다.

엔티티는 `com.janovel.domain` 아래에서 [사용자·OAuth 계정](src/main/java/com/janovel/domain/user/entity), [지원 건·공고 항목·전형·결과 옵션](src/main/java/com/janovel/domain/application/entity), [자소서 문항·버전·스냅샷·제출본](src/main/java/com/janovel/domain/writing/entity)으로 나눈다.

## 실행과 테스트

Gradle 빌드와 프로젝트 설정은 Groovy DSL로 관리한다. [build.gradle](build.gradle) · [settings.gradle](settings.gradle)

JDK 21과 실행 중인 Docker가 필요하다. 저장소 루트에서 다음과 같이 실행한다.

```sh
cd backend
./gradlew bootRun
```

로컬에서 `bootRun`을 실행하면 개발용 PostgreSQL 컨테이너를 시작한다. 백엔드를 종료해도 컨테이너는 계속 실행된다. 개발 DB 설정은 [Compose 파일](compose.yaml)에서 확인한다.

```sh
cd backend
./gradlew test
```

테스트는 Testcontainers로 별도 PostgreSQL을 시작해 마이그레이션, 전형 순서·삭제, 결과 옵션 보관, 자소서 이력의 키 매핑을 확인한다. [스키마 테스트](src/test/java/com/janovel/InitialSchemaTests.java) · [자소서 이력 매핑 테스트](src/test/java/com/janovel/AdditionalEntityMappingsTests.java) · [컨테이너 설정](src/test/java/com/janovel/TestcontainersConfiguration.java)
