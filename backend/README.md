# JaNovel 백엔드

Java 21·Spring Boot 백엔드다. PostgreSQL 스키마와 JPA 엔티티, 공고 링크 가져오기 API가 구현되어 있다. 지원 건 저장 API와 서버 인증은 다음 단계다. [제품 기획과 저장 설계](../docs/planning/01-product-plan.md)

## 공고 링크 가져오기

`POST /api/postings/import`는 공개 공고에서 읽은 회사명·직무·마감일과 본문을 반환한다. 프론트 확인 화면에서 값을 수정할 수 있다. 화면에서 등록한 지원 건은 현재 브라우저에 저장된다. [API 명세와 실행 예제](../docs/api/README.md)

## 스키마와 패키지

Flyway가 `src/main/resources/db/migration`의 마이그레이션을 순서대로 적용한다. 이미 적용한 스키마를 바꿀 때는 새 마이그레이션을 추가한다.

- [V1 초기 스키마](src/main/resources/db/migration/V1__initial_schema.sql)는 사용자, 지원 건, 자소서 이력 등 테이블 11개를 만든다.
- [V2 사용자 이름 필수화](src/main/resources/db/migration/V2__require_user_name.sql)는 기존 `NULL` 이름을 보정하고 `NOT NULL`을 적용한다.
- [V3 결과 옵션 정리](src/main/resources/db/migration/V3__remove_application_outcome_kind.sql)는 결과 분류 컬럼을 제거한다. 지원 건은 사용자가 선택한 결과 옵션의 ID를 저장한다.

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
