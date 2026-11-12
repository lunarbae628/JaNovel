# JaNovel

공고·문항·자소서 수정 이력과 제출본을 한 지원 건에 연결하는 취업 준비 서비스를 기획한다. 핵심은 문항별 자소서 버전관리다.

저장소: [lunarbae628/JaNovel](https://github.com/lunarbae628/JaNovel)

이 프로젝트의 기획, 디자인, 구현 계획과 코드는 이 폴더에서 관리한다. `job-application-service`는 현재 로컬 폴더 이름이다. GitHub 저장소 이름은 JaNovel이다.

Docsa 코드를 바탕으로 별도 프로젝트를 만들 예정이다. 현재는 기획 문서와 핵심 화면 와이어프레임을 정리한 상태이며 실제 백엔드·프론트엔드 코드 가져오기는 이후 진행한다. Docsa는 팀 프로젝트이며, 재사용할 때 원본 출처·기여자와 신규 프로젝트의 변경 범위를 구분한다.

2026-10-21 기획 v1.0으로 첫 버전의 범위와 완료 기준을 정리했다. 공고 원문 보관·수동 입력, 텍스트 자소서, 비교·복원·제출본, 상태·기본 캘린더, MCP 우선 AI 피드백이 범위다. 자동 추출·음성 면접·주간 추천은 이후 단계다. 핵심은 자소서 변경점을 한눈에 확인하는 경험이다. AI 피드백은 사용자의 Plus 계정에서 평소 쓰는 ChatGPT와 MCP를 우선 연결해 시험하고 실제 경험 보존, 문항·직무 적합성, 문장 품질을 모두 평가한다. 계정에서 가능한 MCP 동작은 구현 전 확인하며, 서비스 내부 AI API는 나중에 추가할 수 있게 데이터를 관리한다. 주간 공고 추천은 후순위다. Docsa 코드 재사용 범위도 확인이 필요하다.

2026-10-23 v1.1에서는 내부 채팅과 SIWC 사용자 구독 연결을 조건부 검토 항목으로 추가했다. 첫 버전의 외부 ChatGPT + MCP 경로는 유지한다. 홈서버 개인용 실행과 공개 웹서비스의 자격, SIWC의 hosted MCP 미지원은 기획서 5절에 정리했다. 실제 연결은 미검증이다.

2026-11-01에는 문항별 버전관리를 기준으로 변경했다. 가운데 도구 줄에서 문항을 선택하면 좌측 그래프·작성 내용·AI 대화가 전환되며, 스냅샷과 수정안 적용도 그 문항의 이력에만 남는다. 제출본은 문항별 선택 버전을 고정해 묶는 설계이며 아직 화면은 없다.

공고별 채용 절차를 확인하고 그 절차에 맞는 현재 단계를 고르는 흐름을 공고 등록 미리보기에 연결했다. 현재는 수동 입력·수정과 예시 결과를 제공하며 자동 인식은 연결하지 않았다.

## 문서

- [제품 기획서 v1.5](docs/planning/01-product-plan.md) — 6절: 포함·제외 범위, 10절: 완료 기준, 11절: 선택 이유와 남은 확인
- [경쟁력 검토·의문점·검증 계획](docs/planning/02-critical-review.md)
- [근거와 조사 한계](docs/planning/03-sources.md)
- [전체 문서 HTML](docs/planning/index.html)
- [작성·버전 비교 와이어프레임 검토](docs/design/01-wireframe-review.md) — 버전 그래프·작성·AI 채팅의 3열 배치
- [지원 현황 화면](docs/design/05-application-overview.md) — 목록·캘린더·상태·일정과 작성 화면 왕복
- [작성 화면부터 미리보기](docs/design/wireframes/application-editor.html) — 패널 접기·펼치기와 지원 현황 왕복
- [공고 등록 화면](docs/design/06-posting-registration.md) — 링크·이미지·텍스트 입력, 원문 확인, 문항·절차 수정과 저장
- [스냅샷·분기·병합](docs/design/07-snapshots-branch-merge.md) — 가운데 작성 도구와 문항별 갈래·문단 선택 병합
- [화면 점검과 다음 단계](docs/design/08-readiness-review.md) — 빠진 동선, AI 연결의 미확정 사항과 디자인·구현으로 넘어갈 순서
- [Figma 디자인 초안](https://www.figma.com/design/ArLSPAcNklUKhcpk8V4zyf?node-id=5-530) — 작성·비교·집중·휴대폰·스냅샷 다섯 상태. [작업 기준](docs/design/09-figma-design-brief.md)

- [스냅샷·작성 중 비교 규칙](docs/design/16-snapshot-working-draft-comparison.md) — 선택한 스냅샷과 작성 중 초안 비교, 오른쪽 대상 선택, 시연 범위

- [디자인 점검 결과](docs/design/17-design-review.md) — 회사·문항 맥락, 제출 버전 선택, 병합 완료, 패널 접기의 남은 문제와 보완 순서
- [최신 제품 디자인 고도화·검증 결과](docs/design/18-product-design-workflow.md) — UI UX Pro Max 적용 범위, 글자·간격 기준, 프로토타입 보완과 검증
- [비교 화면 수정과 디자인 시안 A/B/C](docs/design/19-comparison-concepts.md) — 개별 글자 수, 작업 아이콘, 헤더 정렬과 대표 화면 선택
- [선택한 디자인 방향과 아이콘 수정](docs/design/20-icon-refinement.md) — A 기반, 회색 비교 정보 줄·블루 지원 버튼, 얇은 아이콘과 분기·병합 구분
- [선택 기록 중심의 버전 지도](docs/design/21-focused-version-map.md) — Docsa 기술 검토, 카메라·전체 보기 규칙과 React Flow 동작 시안
- [촘촘한 Git 로그형 추가 시안](docs/design/22-compact-history-log.md) — 32px 기록 행, 14px 브랜치 간격과 지도형 비교
- [로그인·가입과 패널 조절·브랜치별 작업장](docs/design/23-auth-resize-workspaces.md) — 인증 화면과 별도 초안 편집 검토
- [Figma 화면 흐름·OAuth·두 병합안](docs/design/24-figma-flow-oauth-merge-alternatives.md) — 정리된 파일 위치와 아직 결정하지 않은 병합 정책

## 폴더 구성

- `docs/planning/`: 기획 문서, HTML과 생성 도구, 문서 검증 기록
- `docs/design/`: 화면 설계 문서와 생성된 와이어프레임
- `scripts/wireframes/`: 와이어프레임 원본과 생성 도구
- `_workspace/`: 문서 작성 과정의 초안과 검토 기록

`_workspace/`는 로컬 검토 자료로 Git에서 제외한다. 문서에 등장하는 이 폴더의 과거 검증 기록과 다른 로컬 프로젝트 참고 경로는 이 저장소에 포함되지 않는다.

## 문서·시안 다시 만들기

Node.js 20 이상과 Python 3가 필요하다.

```sh
npm ci
npm run build
```

기획 HTML은 `docs/planning/index.html`에, 시안은 `docs/design/wireframes/`에 생성한다. 시안은 대화 내 미리보기용 HTML 조각이며 실제 저장·AI·MCP는 연결하지 않았다. 작성 화면 원본은 `scripts/wireframes/editor-source.html`에서 수정하고 `npm run build:wireframes`로 반영한다.

디자인과 구현 계획은 작업을 시작할 때 `docs/` 아래에 정리한다. Docsa 코드의 배치와 저장소 구성은 실제로 가져올 때 결정한다.

## 진행 순서

기획 확정 → 사용 흐름·와이어프레임 → Figma 디자인 → 구현 계획 → 개발 → 실제 취업 준비에 사용하며 개선.

| 단계 | 기본 모델 | 추론 수준 |
| --- | --- | --- |
| 기획 확정 | GPT-6 Astra | High |
| 사용 흐름·와이어프레임 | GPT-6.1 Sol | High |
| Figma 디자인 | GPT-6.1 Sol | Medium |
| 구현 계획 | GPT-6 Astra | High |
| 구현·테스트 | GPT-6.1 Sol | High |
| 실사용·개선 | GPT-6.1 Sol | Medium |

2026-10-16 기준 권장 배정이다. 복잡한 설계 판단이나 해결되지 않는 오류는 Astra로 추가 검토한다. 상세 작업·완료 기준·모델 전환 조건은 [기획서 9절](docs/planning/01-product-plan.md)에 정리했다. 이 표는 프로젝트 제작에 사용할 모델이며 서비스 자체의 AI API 모델 선정은 별도다.

2026-10-16에 Works 공용 `_workspace`에 있던 관련 파일 16개를 이 폴더로 옮겼다. 기획 문서의 내용과 기존 조사 시점은 유지했다.
