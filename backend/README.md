# JaNovel 백엔드

Kotlin·Spring Boot 프로젝트의 기본 구성이다. 현재 PostgreSQL 개발 환경, JPA·Flyway 의존성, 테스트용 PostgreSQL 컨테이너 설정이 있다. 제품 API와 도메인 마이그레이션은 설계 단계다. [제품 기획과 저장 설계](../docs/planning/01-product-plan.md)

## 실행과 테스트

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

현재 테스트는 Testcontainers로 별도 PostgreSQL을 시작해 Spring 애플리케이션 컨텍스트가 뜨는지 확인한다. [테스트 코드](src/test/kotlin/com/janovel/JanovelApplicationTests.kt) · [컨테이너 설정](src/test/kotlin/com/janovel/TestcontainersConfiguration.kt)
