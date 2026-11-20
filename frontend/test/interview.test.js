import assert from 'node:assert/strict';
import test from 'node:test';
import {emptyInterview, isInterview, materialQuestions, patchInterviewQuestion, startPracticeRecord} from '../src/interview.js';

const a = {id: 'a', prompt: '첫 질문', basis: 'Q1', answer: ''};
const b = {id: 'b', prompt: '둘째 질문', basis: '', answer: '다른 답변'};
const interview = {...emptyInterview(), questions: [a, b]};

test('editing one question leaves the other answer and practice history intact', () => {
  const record = startPracticeRecord('r1', interview.questions, 89, '2026-11-20T12:00:00.000Z');
  const next = patchInterviewQuestion({...interview, records: [record]}, 'a', {answer: '작성한 답변'});
  assert.equal(next.questions[0].answer, '작성한 답변');
  assert.equal(next.questions[1].answer, '다른 답변');
  assert.equal(next.records[0].questions[0].prompt, '첫 질문');
  assert.equal(isInterview(next), true);
});

test('a backup rejects duplicate interview question IDs', () => {
  assert.equal(isInterview({...interview, questions: [a, a]}), false);
});

test('material practice covers each supplied document and records its mode', () => {
  const questions = materialQuestions([
    {kind: '이력서', text: '결제 API에서 중복 요청을 차단하고 지연 시간을 줄였습니다.'},
    {kind: '포트폴리오', text: '재시도 실패를 재현하고 운영 대시보드로 확인했습니다.'},
  ]);
  assert.match(questions[0].prompt, /결제 API에서 중복 요청/);
  assert.match(questions[1].prompt, /재시도 실패를 재현/);
  assert.notEqual(questions[0].id, questions[1].id);
  assert.deepEqual(materialQuestions([{kind: '이력서', text: '이력서\n010-0000-0000'}]), []);
  const record = startPracticeRecord('r1', questions, 10, '2026-11-20T12:00:00.000Z', 'materials');
  assert.equal(record.mode, 'materials');
  assert.equal(isInterview({...interview, records: [record]}), true);
  assert.equal(isInterview({...interview, records: [{...record, mode: 'unknown'}]}), false);
});

test('control characters from PDF text do not leak into questions', () => {
  const [question] = materialQuestions([{kind: '이력서', text: '결제 \u0001 정합성을 검증하고 재시도 경로를 개선했습니다.'}]);
  assert.match(question.prompt, /결제 정합성을 검증하고/);
});
