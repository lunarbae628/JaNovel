# JaNovel 로컬 OCR

이 문서는 로컬 OCR 경로를 사용한 당시 기획과 검증 기록이다. [현재 공고 가져오기](../../docs/planning/08-posting-structured-import.md)

Python 3.10 환경에서 아래 명령으로 실행한다.

```sh
cd backend/ocr
python3.10 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python server.py
```

기본 주소는 `http://127.0.0.1:8091`이다. 처음 시작할 때 PaddleOCR 모델을 내려받으며, 저장된 모델과 CPU로 공고 이미지를 읽는다. 모델이 준비됐는지 확인하려면 아래 명령을 실행한다.

```sh
curl -i http://127.0.0.1:8091/readyz
curl -i -H 'Content-Type: image/png' --data-binary @posting.png \
  http://127.0.0.1:8091/internal/ocr
```

기본 실행은 작업 프로세스 한 개와 프로세스당 CPU 스레드 설정 4개를 사용한다. 두 건을 동시에 처리하도록 실행하려면 `.venv/bin/python server.py --workers 2 --cpu-threads 2`를 사용한다. 각 프로세스가 모델을 따로 올리므로 프로세스를 늘리면 메모리 사용량도 늘어난다.

긴 캡처는 긴 변을 최대 1,280px로 줄여 글자 영역을 찾고, 원본의 해당 영역에서 글자를 읽는다. 준비된 프로세스가 하나라도 있으면 `/readyz`는 `200`을 반환한다. 준비된 프로세스가 모두 처리 중이면 `503 OCR_BUSY`, 준비된 프로세스가 없으면 `503 OCR_NOT_READY`를 반환한다. 디코딩과 추론에 10초가 지나면 `504`를 반환하고 해당 작업 프로세스를 다시 준비한다.

Compose 내부에서 호출할 경우 `--host 0.0.0.0`으로 실행하고 OCR 포트는 호스트에 공개하지 않는다. [공고 OCR 기획](../../docs/planning/06-posting-ocr-plan.md)
