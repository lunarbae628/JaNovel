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

export function startPracticeRecord(id, questions, duration, createdAt) {
  return {id, createdAt, duration, note: '', questions: questions.map(({id, prompt}) => ({id, prompt}))};
}

export function isInterview(value) {
  const text = item => typeof item === 'string';
  const isPrompt = item => item && text(item.id) && item.id && text(item.prompt) && item.prompt.trim();
  const unique = items => new Set(items.map(item => item.id)).size === items.length;
  return Boolean(value && text(value.source) && Array.isArray(value.questions) &&
    value.questions.every(item => isPrompt(item) && text(item.basis) && text(item.answer)) && unique(value.questions) &&
    Array.isArray(value.records) && value.records.every(record =>
      record && text(record.id) && record.id && text(record.createdAt) && Number.isFinite(Date.parse(record.createdAt)) &&
      Number.isInteger(record.duration) && record.duration >= 0 && text(record.note) && Array.isArray(record.questions) &&
      record.questions.length && record.questions.every(isPrompt) && unique(record.questions)) && unique(value.records));
}

export function timecode(seconds) {
  return [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}
