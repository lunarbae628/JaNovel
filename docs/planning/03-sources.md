# 근거와 조사 한계

조사 기준일 2026-10-15. 공식 제품 페이지와 문서를 우선했다. 공개 안내에 있는 기능은 확인했지만 로그인 후 전체 기능이나 유료 기능의 실제 품질은 시험하지 않았다. 경쟁사의 사용자 수·합격률·시간 절약 광고 수치는 이번 결론의 근거로 쓰지 않았다.

모델 선택 자료는 2026-10-16에 추가 확인했다. 기획서 9절의 단계별 모델 배정은 공식 안내를 참고한 운영 권고이며 이 프로젝트에서 성능을 비교한 결과는 아니다.

2026-10-21에는 Docsa의 변경점 비교가 이미 구현됐는지 로컬 코드를 추가 확인했다. README의 기능 설명과 프론트엔드 비교 화면은 확인했지만, 새 서비스로 옮겼을 때의 사용성·데이터 호환성은 검증하지 않았다.

같은 날 MCP와 향후 서비스 내부 AI API의 역할을 OpenAI 공식 문서로 확인했다. 공통 데이터와 피드백 구조를 두고 호출 경로를 추가할 수 있다는 판단은 이 문서를 바탕으로 한 설계 제안이며, 특정 개인 GPT 연결 권한이나 대화·기억 이전 가능성을 보장하지 않는다.

2026-10-23에는 서비스 내부 채팅과 Sign in with ChatGPT(SIWC)의 구독 사용 경로를 추가 조사했다. 일반 API와 SIWC의 지원 기능을 구분하고, 개인용 오픈소스 자가 호스팅 절차를 다중 사용자 웹서비스 제공 승인으로 확대 해석하지 않았다. 계정 연결·호출·자격 승인 시험은 수행하지 않았다.

## 외부 자료

| 자료 | 이번 검토에서 사용한 범위 | 해석의 한계 |
| --- | --- | --- |
| [TIO 제품 안내](https://tiokorea.com/) | 공고·경험 기반 분석과 자소서 AI 기능 | 마케팅 설명이며 성능·모델 구현 방식의 증거가 아님 |
| [TIO 개인정보처리방침](https://tiokorea.com/privacy) | 외부 AI 업체 기재와 시행일 | 열람 판본 시행일 2026-10-29. 조사일 현재의 실제 배포 구성을 확정할 수 없음 |
| [자소설닷컴](https://jasoseol.com/) | 채용달력·공고·자기소개서 메뉴와 서비스 범위 | 동적 공고 목록과 로그인 후 편집 기능은 별도 검증하지 않음 |
| [Teal Resume Builder](https://www.tealhq.com/tools/resume-builder) | 여러 버전 생성·비교, 회사별 제출 버전 추적, 지원 관리 | 국내 자소서 문항별 변경 이력과 같은 구현인지 확인하지 않음 |
| [Huntr 공식 도움말](https://help.huntr.co/en/articles/10477521-what-is-huntr) | 여러 이력서 버전, 작성 지원, 공고·지원 관리 | 실제 사용성·한국어 품질을 확인하지 않음 |
| [OpenAI MCP 연동](https://developers.openai.com/api/docs/guides/custom-mcp-server) | 외부 도구 연결과 권한을 고려한 연동 계획 | 지원 호스트·플랜·정책은 구현 시 재확인 |
| [OpenAI MCP 도구](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) | AI 클라이언트가 MCP 서버의 도구와 데이터에 접근하는 연결 구조 | 사용자 개인 GPT에서의 사용 가능 여부는 별도 실험 필요 |
| [MCP 서버 구성 요소](https://developers.openai.com/plugins/concepts/mcp-server) · [도구 설계](https://developers.openai.com/plugins/plan/tools) | Tools·Resources·Prompts의 역할과 도구 중심 설계 | 특정 호스트가 모든 구성 요소를 자동 조회·적용한다는 근거는 아님 |
| [MCP 인증](https://developers.openai.com/plugins/build/auth) | 사용자 데이터 접근에 필요한 로그인과 권한 확인 | OAuth 구현 방식은 별도 기술 실험 필요 |
| [ChatGPT 맞춤 MCP 연결](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt) | 계정별 맞춤 MCP 서버 연결·읽기·쓰기 권한 | 2026-10-21 현재 안내. 요금제와 제품 정책은 구현 시 재확인 |
| [ChatGPT 맞춤 GPT 안내](https://help.openai.com/en/articles/8554407-gpts-in-chatgpt) | 맞춤 GPT의 대화·기억 범위와 앱·액션 연동 | 사용자가 말한 '내 GPT'가 맞춤 GPT인지 아직 확인되지 않음 |
| [OpenAI Responses API](https://developers.openai.com/api/reference/responses/overview) | 나중에 서비스 서버가 직접 AI를 호출하는 경로의 후보 | API 연동은 별도 구현·인증·비용이 필요한 작업 |
| [OpenAI 구조화 출력](https://developers.openai.com/api/docs/guides/structured-outputs) | 서비스 내부 API 경로에서 피드백 형식 맞춤 가능성 | MCP 경로의 외부 GPT 출력이 자동으로 같은 구조가 되는 것은 아님 |
| [OpenAI LLM 정확도 개선](https://developers.openai.com/api/docs/guides/optimizing-llm-accuracy) | 프롬프트·맥락·평가를 구분하는 검증 방법 | 특정 자소서 평가 기준의 효과를 보장하지 않음 |
| [OpenAI Voice agents](https://developers.openai.com/api/docs/guides/voice-agents) | 음성 면접 구현 후보 | 한국어 품질·지연·세션 원가 미측정 |
| [AWS 무료 플랜 FAQ](https://aws.amazon.com/free/free-tier-faqs/) | 무료 이용의 대상·기간·사용 조건 존재 | 사용자 계정 자격이나 예상 청구액을 확인한 것은 아님 |
| [OpenAI 모델 선택 안내](https://developers.openai.com/api/docs/guides/model-selection) | Astra와 GPT-6.1 Sol의 역할, 작업별 추론 수준 선택 원칙 | 프로젝트의 각 단계에 대한 배정은 작성자 권고 |
| [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra) · [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) | 모델명과 추론 수준 확인 | API 안내만으로 사용자의 Codex 계정별 이용 한도를 판단하지 않음 |

## 내부 채팅 추가 자료: 2026-10-23

| 자료 | 확인한 범위 | 남은 확인 |
| --- | --- | --- |
| [SIWC 개요](https://developers.openai.com/siwc/token-sharing-open-source) | 구독 사용의 별도 동의, 대화 접근 불포함, 원격·유료 앱의 접근 신청 | 우리 앱의 자격·실제 승인 |
| [자가 호스팅 VM](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms) | 개인이 오픈소스 앱을 원격 VM에서 사용하는 절차 | 우리 홈서버 실행 방식의 적합성. 다중 사용자 SaaS 허용 근거가 아님 |
| [SIWC 프리뷰 제한](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) | hosted MCP 미지원, function/custom 도구, 대화 이력·음성 제한 | 애플리케이션 측 MCP 실행과 자소서 흐름의 실제 동작 |
| [클라이언트 신청](https://developers.openai.com/siwc/request-client-id) | 선택된 상용 파트너와 대기 신청 안내 | 신청하지 않음 |
| [ChatKit](https://developers.openai.com/api/docs/guides/chatkit) | 자체 서버에 연결하는 내부 채팅 UI 후보 | UI 제공 자체가 구독 사용 권한을 뜻하지 않음 |

## 대화와 로컬 자료

제품 방향과 확정 여부는 현재 대화를 기준으로 정리했다. 기존 월요일 GPT 예약은 사용자가 제시한 내용이며 실제 예약 설정을 조회하거나 바꾸지 않았다.

- [Docsa README](/Users/moon/Desktop/Works/docsa/README.md): 기존 문서 버전관리 개념과 재사용 후보 파악. 상세 코드 감사나 이전 가능성 검증은 아님.
- [Docsa 작업 지침](/Users/moon/Desktop/Works/docsa/AGENTS.md): 기획 문서를 Markdown과 HTML로 함께 제공하고 원본 작업 범위를 존중하는 기준 참고.
- [홈 게이트웨이 README](/Users/moon/Desktop/Works/home-gateway/README.md): 기존 배포 구성 참고. 현재 서버 상태·남은 자원·복구 가능성을 확인하지 않음.
- [Docsa 프론트엔드 비교 화면](/Users/moon/Desktop/Works/Docsa_FE/frontend/src/components/DocumentCompareView.tsx): 기존 두 기록의 블록 매칭과 문장 차이 표시를 확인. 자소서 문항형 텍스트에 곧바로 적용할 수 있다는 증거는 아님.
- [Docsa 프론트엔드 차이 계산 도구](/Users/moon/Desktop/Works/Docsa_FE/frontend/src/lib/diffUtils.ts): 기존 텍스트·블록 비교 코드 확인. 현재 비교 화면에서 모든 도구가 사용된다는 뜻은 아님.

## 근거 수준

확정 방향은 사용자가 명시한 요구다. 공식 공개 기능은 해당 문서에서 확인한 사실이다. 경쟁력 판단과 단계별 범위는 작성자의 제안이며, 사용성·AI 품질·유료 수요·운영비는 미검증 가정이다.

시장 규모, 유료 전환율, 합격률 개선, 경쟁 서비스에 없는 기능이라는 주장은 이 조사로 입증되지 않는다. 다음 검증의 목적은 개인 실사용 가치부터 확인하는 것이다.
