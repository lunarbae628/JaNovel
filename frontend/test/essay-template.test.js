import test from 'node:test';
import assert from 'node:assert/strict';
import {appendEssayTemplate, createEssayTemplateQuestion, essayTemplateAccessKey, essayTemplateItems} from '../src/essay-template.js';
import {createPostingQuestion, snapshot, updateDraft, validateStore} from '../src/model.js';
import {questionPublication} from '../src/posting-questions.js';
import {createWritingOption} from '../src/writing-options.js';

test('같은 미리보기 프로필은 접근 키를 재사용하고 다른 프로필의 키는 분리한다', () => {
  const values = new Map();
  const storage = {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)};
  const first = essayTemplateAccessKey({email:'first@example.test'}, storage);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(essayTemplateAccessKey({email:'FIRST@example.test'}, storage), first);
  assert.notEqual(essayTemplateAccessKey({email:'second@example.test'}, storage), first);
  assert.notEqual(essayTemplateAccessKey({}, storage), first);
});

test('공통 자소서 초안은 지원 건마다 독립된 첫 작성안으로 복사한다', () => {
  const template = {prompt:'지원 동기', limit:700, draftBody:'내 공통 초안'};
  const first = createPostingQuestion(template);
  const second = createPostingQuestion(template);
  assert.notEqual(first.id, second.id);
  assert.equal(first.branches[0].draft.text, template.draftBody);
  assert.equal(first.branches[0].draft.dirty, true);
  first.branches[0].draft.text = '회사에 맞게 수정';
  assert.equal(second.branches[0].draft.text, template.draftBody);
});

test('개인 템플릿에서 가져온 문항이 있으면 공고 공유 문항으로 저장하지 않는다', () => {
  const questions = [{prompt:'개인 프로젝트 경험', limit:700, personalTemplate:true}];
  assert.equal(questionPublication('공고 A', '공고 A', {available:true}, questions), '');
});

test('기존 저장 문항을 버전 관리용으로 불러오고 선택한 버전의 본문만 복사한다', () => {
  let question = createEssayTemplateQuestion({prompt:'공통 문항', limit:null, draftBody:'기존 저장 본문'});
  question = snapshot(question, question.branches[0].id, '기존 기록');
  question = createWritingOption(question, '신규 버전');
  question = updateDraft(question, question.activeBranchId, '다른 공고에 쓸 본문');

  const saved = JSON.parse(JSON.stringify({version:1, applications:[], essayTemplates:{'': [question]}}));
  assert.equal(validateStore(saved).essayTemplates[''][0].snapshots.length, 1);
  assert.deepEqual(essayTemplateItems(saved.essayTemplates['']), [
    {prompt:'공통 문항', limit:null, draftBody:'다른 공고에 쓸 본문'},
  ]);
});

test('다른 공고의 기존 질문을 유지하고 템플릿 문항만 개인 초안으로 추가한다', () => {
  const current = [{id:'existing', prompt:'공고 문항', limit:600}, {prompt:'', limit:null}];
  const imported = appendEssayTemplate(current, [
    {prompt:'공고 문항', limit:null, draftBody:'겹치는 본문'},
    {prompt:'내 경험', limit:800, draftBody:'복사할 본문'},
  ]);
  assert.deepEqual(imported, [
    current[0], {prompt:'내 경험', limit:800, draftBody:'복사할 본문', personalTemplate:true},
  ]);
  assert.equal(questionPublication('공고', null, null, imported), '');
  assert.equal(createPostingQuestion(imported[1]).branches[0].draft.text, '복사할 본문');
});
