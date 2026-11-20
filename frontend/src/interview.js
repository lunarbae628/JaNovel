const examples = [
  '실패한 요청의 복구 경로를 어떻게 설계했나요?',
  '정합성이 개선됐다는 것을 어떻게 확인했나요?',
  '의견이 달랐을 때 어떻게 조율했나요?',
  '작업 기록 자체가 실패하면 어떻게 처리하나요?',
  '서버 운영에 이 경험을 어떻게 활용하겠나요?',
  '이 회사와 직무를 선택한 이유는 무엇인가요?',
];

export const emptyInterview = () => ({questions: [], records: [], source: ''});

export function interviewFor(application) {
  if (application.interview) return application.interview;
  const value = emptyInterview();
  if (application.example && application.company === '솔빛테크') {
    value.questions = examples.map((prompt, index) => ({
      id: 'example-' + (index + 1), prompt, basis: !index ? '제출본 Q2' : '',
      answer: !index ? '실패 유형을 나누어 확인한 뒤 복구에 필요한 정보를 작업 시작 전에 남겼습니다.\n\n복구 동작과 반복 실행 시 중복 처리 여부를 통합 테스트로 확인했습니다.' : '',
    }));
  }
  return value;
}

export function patchInterviewQuestion(interview, id, patch) {
  return {...interview, questions: interview.questions.map(question =>
    question.id === id ? {...question, ...patch} : question)};
}

export const practiceModeLabels = {expected: '예상 질문 연습', materials: '자료 기반 연습'};
export const materialKinds = ['이력서', '포트폴리오', '자기소개서'];

const materialFollowups = {
  이력서: ['이 경험에서 맡은 역할과 직접 내린 결정을 설명해 주세요.', '그 성과를 어떻게 확인했나요?'],
  포트폴리오: ['이 작업에서 가장 어려웠던 문제를 어떻게 해결했나요?', '다른 접근도 검토했다면 무엇을 비교했나요?'],
  자기소개서: ['이 경험을 보여 주는 구체적인 상황과 본인의 행동을 설명해 주세요.', '이 경험을 지원 직무에서 어떻게 활용할 수 있나요?'],
};

export function materialExcerpts(text) {
  const lines = text.split(/\n+|(?<=[.!?])\s+/u)
    .map(line => line.replace(/[\s\p{Cc}]+/gu, ' ').trim());
  const body = lines.filter(line => (line.match(/\p{L}/gu)?.length ?? 0) >= 12 &&
    !/@|https?:\/\/|\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/u.test(line));
  return [...new Set(body.map(line => line.length > 104 ? line.slice(0, 104).trimEnd() + '…' : line))].slice(0, 2);
}

export function materialQuestions(documents) {
  const sources = documents.map(({kind, text}) => ({kind, excerpts: materialExcerpts(text)}));
  return [0, 1].flatMap(index => sources.flatMap(({kind, excerpts}, sourceIndex) => excerpts[index] ? [{
    id: 'material-' + sourceIndex + '-' + index,
    prompt: `“${excerpts[index]}” — ${materialFollowups[kind][index]}`,
  }] : []));
}

export function startPracticeRecord(id, questions, duration, createdAt, mode) {
  return {id, createdAt, duration, note: '', ...(mode && {mode}), questions: questions.map(({id, prompt}) => ({id, prompt}))};
}

export function isInterview(value) {
  const text = item => typeof item === 'string';
  const isPrompt = item => item && text(item.id) && item.id && text(item.prompt) && item.prompt.trim();
  const unique = items => new Set(items.map(item => item.id)).size === items.length;
  return Boolean(value && text(value.source) && Array.isArray(value.questions) &&
    value.questions.every(item => isPrompt(item) && text(item.basis) && text(item.answer)) && unique(value.questions) &&
    Array.isArray(value.records) && value.records.every(record =>
      record && text(record.id) && record.id && text(record.createdAt) && Number.isFinite(Date.parse(record.createdAt)) &&
      (record.mode === undefined || Object.hasOwn(practiceModeLabels, record.mode)) &&
      Number.isInteger(record.duration) && record.duration >= 0 && text(record.note) && Array.isArray(record.questions) &&
      record.questions.length && record.questions.every(isPrompt) && unique(record.questions)) && unique(value.records));
}

export function timecode(seconds) {
  return [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}
