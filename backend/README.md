# JaNovel 백엔드

Java 21·Spring Boot 백엔드다. PostgreSQL 스키마와 JPA 엔티티, 공고 링크 가져오기 API가 구현되어 있다. 지원 건 저장 API와 서버 인증은 다음 단계다. [제품 기획과 저장 설계](../docs/planning/01-product-plan.md)

## 공고 링크 가져오기

공개 공고 링크는 HTTP·Jsoup으로 먼저 읽고, 상세 본문이 부족하면 로컬 Chromium을 재사용해 렌더링된 텍스트를 읽는다. 확인 화면에서 **이미지로 다시 가져오기**를 누르거나 이미지 파일을 첨부하면 로컬 OCR을 호출한다. 화면에서 등록한 지원 건은 현재 브라우저에 저장된다. [API 명세와 실행 예제](../docs/api/README.md)

브라우저 경로를 쓰려면 `backend/`에서 `./gradlew installPostingBrowser`를 한 번 실행한다. 이미 설치된 Chrome을 사용할 때는 `JANOVEL_POSTINGS_BROWSER_CHANNEL=chrome`으로 백엔드를 실행한다. OCR을 쓸 때는 다른 터미널에서 Python 서비스를 켠다. 기본 주소는 `http://127.0.0.1:8091`이며, 다른 주소를 쓰면 `JANOVEL_POSTINGS_OCR_URL`로 지정한다. [OCR 설치와 실행](ocr/README.md)

브라우저 워커는 기본 두 개다. 첫 번째 워커가 사용 중일 때 두 번째 워커를 사용한다. 브라우저 메모리가 제한된 환경에서는 `JANOVEL_POSTINGS_BROWSER_WORKERS=1`로 실행한다. [동시 처리 검증](../docs/planning/07-posting-concurrency.md)

OCR은 Java에서 작업을 접수하고 프론트가 완료 상태를 조회한다. 작업은 단일 Java 인스턴스의 메모리에 저장하고, 실행 슬롯 외에는 최대 세 건까지 대기시킨다. 실행 슬롯은 기본 한 개다. Python을 `--workers 2` 또는 `--workers 3`으로 실행하면 Java도 `JANOVEL_POSTINGS_OCR_WORKERS`에 같은 수를 지정한다. [OCR 작업 API](../docs/api/README.md#공고-이미지-가져오기)

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
