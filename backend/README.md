# JaNovel 백엔드

Java 21·Spring Boot 백엔드다. PostgreSQL 스키마와 JPA 엔티티, 공고 링크 가져오기 API가 구현되어 있다. 지원 건 저장 API와 서버 인증은 다음 단계다. [제품 기획과 저장 설계](../docs/planning/01-product-plan.md)

## 공고 링크 가져오기

공개 공고 링크는 HTTP·Jsoup으로 먼저 읽고, 상세 본문이 부족하면 Chromium으로 렌더링해서 읽는다. Java가 수집한 본문을 OpenAI Responses API로 전달한다. **정확하게 가져오기**나 **다시 시도하기**는 공고 영역을 캡처해 모델에 보내고, 사용자 첨부 이미지도 바로 모델에 보낸다. 화면에서 등록한 지원 건은 현재 브라우저에 저장된다. [API 명세와 실행 예제](../docs/api/README.md)

`backend/.env`의 `OPENAI_API_KEY=` 뒤에 키를 넣고 `backend/`에서 백엔드를 실행한다. 배포 환경에서는 같은 이름의 환경 변수를 지정할 수 있다. 키가 비어 있으면 서버는 시작되고 공고 가져오기 요청에 `503 POSTING_MODEL_UNAVAILABLE`을 반환한다. [OpenAI API 키 가이드](https://developers.openai.com/api/docs/quickstart)

공고 모델의 기본값은 `gpt-6-luna`다. 다른 모델을 쓰려면 같은 파일이나 배포 환경에 `OPENAI_POSTING_MODEL`을 지정하고 백엔드를 다시 실행한다. 모델은 Responses API의 이미지 입력과 Structured Outputs를 지원해야 한다.

```dotenv
OPENAI_POSTING_MODEL=gpt-5.4-mini-2026-03-17
```

브라우저 경로를 쓰려면 `backend/`에서 `./gradlew installPostingBrowser`를 한 번 실행한다. 이미 설치된 Chrome을 사용할 때는 `JANOVEL_POSTINGS_BROWSER_CHANNEL=chrome`으로 백엔드를 실행한다. 브라우저 워커는 기본 두 개이며 `JANOVEL_POSTINGS_BROWSER_WORKERS=1`로 줄일 수 있다.

이미지 요청은 작업을 접수하고 프론트가 완료 상태를 조회한다. 대기열은 최대 세 건, 실행 슬롯은 기본 한 개다. 링크에 쓰는 요청과 이미지에 쓰는 요청을 합쳐 한 인스턴스에서 OpenAI 호출을 최대 네 건 처리한다. [구조화 계획과 검증](../docs/planning/08-posting-structured-import.md)

## 스키마와 패키지

Flyway가 빈 PostgreSQL에 [V1 초기 스키마](src/main/resources/db/migration/V1__initial_schema.sql)를 적용해 테이블 11개를 만든다. 사용자 이름은 필수이고, 지원 건은 사용자가 선택한 결과 옵션의 ID를 저장한다. 통합 전 V1~V3를 적용한 DB는 기존 Flyway 이력에 맞는 마이그레이션 파일을 사용해야 한다.

이미 적용한 스키마를 바꿀 때는 새 마이그레이션을 추가한다.

엔티티는 `com.janovel.domain` 아래에서 [사용자·OAuth 계정](src/main/java/com/janovel/domain/user/entity), [지원 건·공고 항목·전형·결과 옵션](src/main/java/com/janovel/domain/application/entity), [자소서 문항·버전·스냅샷·제출본](src/main/java/com/janovel/domain/writing/entity)으로 나눈다.

## 실행과 테스트

Gradle 빌드와 프로젝트 설정은 Groovy DSL로 관리한다. [build.gradle](build.gradle) · [settings.gradle](settings.gradle)

JDK 21과 실행 중인 Docker가 필요하다. 저장소 루트에서 다음과 같이 실행한다.

```sh
cd backend
./gradlew bootRun
```

로컬에서 `bootRun`을 실행하면 Spring Boot의 Docker Compose 연동이 `compose.yaml`의 개발용 PostgreSQL을 사용한다. 개발 DB 설정은 [Compose 파일](compose.yaml)에서 확인한다.

```sh
cd backend
./gradlew test
```

테스트는 Testcontainers로 별도 PostgreSQL을 시작해 마이그레이션, 전형 순서·삭제, 결과 옵션 보관, 자소서 이력의 키 매핑을 확인한다. [스키마 테스트](src/test/java/com/janovel/InitialSchemaTests.java) · [자소서 이력 매핑 테스트](src/test/java/com/janovel/AdditionalEntityMappingsTests.java) · [컨테이너 설정](src/test/java/com/janovel/TestcontainersConfiguration.java)
