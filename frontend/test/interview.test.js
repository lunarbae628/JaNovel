import assert from 'node:assert/strict';
import test from 'node:test';
import {emptyInterview, isInterview, patchInterviewQuestion, startPracticeRecord} from '../src/interview.js';

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
