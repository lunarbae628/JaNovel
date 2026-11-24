# JaNovel 프론트엔드

React·Vite로 만든 브라우저 미리보기다. 기능별 현재 동작과 다음 개발 범위는 [제품 기획](../docs/planning/01-product-plan.md)에 정리되어 있다.

## 실행

저장소 루트에서 실행한다.

```sh
npm --prefix frontend ci
npm --prefix frontend run dev
```

[지원 현황](http://127.0.0.1:5173/#/applications)을 열고 로그인 화면에서 **둘러보기**를 선택한다. 브라우저 저장소는 호스트와 포트별로 나뉜다. 기존에 5187 포트를 사용했다면 `npm --prefix frontend run dev -- --port 5187`로 같은 주소를 연다.

**공고 가져오기**를 쓰려면 [백엔드](../backend/README.md)를 8080 포트에서 함께 실행한다. 백엔드에 직접 요청할 때는 성공하는데 Vite 경유 요청이 404라면, Vite를 재시작해 현재 프록시 설정을 불러온다.

가져온 내용이 부족하면 **정확하게 가져오기**, 처음 가져오는 데 실패하면 **다시 시도하기**를 누를 수 있다. 링크와 이미지 가져오기는 백엔드의 `OPENAI_API_KEY` 설정이 필요하다. 기다리는 중에는 **직접 입력하기**를 선택할 수 있고, 재시도 후에도 이미 수정한 입력값은 유지된다.

## 브라우저 데이터

- 지원·자소서·제출본·일정은 localStorage의 `janovel.frontend.v1` 저장 공간을 사용한다. 다른 브라우저나 기기에서는 저장 공간이 다르다.
- 이미지와 질문별 녹음은 IndexedDB에 저장한다. 설정의 JSON 백업으로 지원·작성 데이터를 내보낼 수 있으며 첨부 이미지와 녹음은 백업 파일에 포함되지 않는다.
- 로그인·Google·메일 인증, 친구·채팅·커뮤니티는 로컬 시연이다. 회원가입 화면의 예시 인증번호는 `123456`이다.

## 검증

```sh
npm --prefix frontend test
npm --prefix frontend run build
```
