import test from 'node:test';
import assert from 'node:assert/strict';
import {questionPayload, questionPublication} from '../src/posting-questions.js';
import {freezeSubmission, validateStore, writingPath} from '../src/model.js';
import {createApplication, seedStore} from '../src/seed.js';

const questions = [{prompt:'지원 동기를 알려 주세요.', limit:null}];

test('문항 없이 등록한 공고를 저장하고 문항 추가 화면으로 이동할 수 있다', () => {
  const application = createApplication({company:'예시 회사', role:'개발', questions:[]});
  const store = seedStore();
  store.applications.push(application);

  assert.deepEqual(application.questions, []);
  assert.equal(validateStore(JSON.parse(JSON.stringify(store))).applications.at(-1).id, application.id);
  assert.equal(writingPath(application), '/posting/' + application.id);
  assert.throws(() => freezeSubmission(application, {}), /EMPTY_TEXT/);
});

test('문항이 있는 지원 건은 첫 문항의 작성 화면으로 이동한다', () => {
  const application = createApplication({company:'예시 회사', role:'개발', questions});
  assert.equal(writingPath(application), '/write/' + application.id + '/' + application.questions[0].id);
});

test('조회가 끝나기 전에도 문항 공유 안내에 쓰는 상태를 반환한다', () => {
  assert.equal(questionPublication('공고 A', '공고 A', null, questions), 'shareable');
  assert.equal(questionPublication('공고 A', '', null, questions), 'shareable');
  assert.equal(questionPublication('공고 A', '공고 A', {available:false}, questions), '');
  assert.equal(questionPublication('공고 A', '공고 A', {version:{id:'first'}}, questions), '');
});

test('공고나 직무가 바뀌면 기존 입력을 새 공고의 공통 문항으로 저장하지 않는다', () => {
  assert.equal(questionPublication('공고 B', '공고 A', null, questions), 'different-posting');
  assert.equal(questionPublication('', '공고 A', null, questions), '');
});

test('빈 문항을 제외하고 글자 수 미확인을 보존한다', () => {
  assert.deepEqual(questionPayload([{prompt:'   ', limit:1000}, {prompt:' 지원 동기를 알려 주세요. ', limit:''}]), questions);
});

test('공유 입력 한도를 넘으면 개인 지원 건으로만 등록할 수 있다', () => {
  assert.equal(questionPublication('공고 A', '공고 A', null, Array(31).fill(questions[0])), 'out-of-range');
  assert.equal(questionPublication('공고 A', '공고 A', null, [{prompt:'가'.repeat(2001), limit:400}]), 'out-of-range');
  assert.equal(questionPublication('공고 A', '공고 A', null, [{...questions[0], limit:100001}]), 'out-of-range');
});
