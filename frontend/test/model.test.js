import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuestion, updateDraft, snapshot, editSnapshot, branchFrom, mergeDraft, freezeSubmission, graphRecords, postingSections, validateStore, importPostingText } from '../src/model.js';
const saved=()=>{let q=createQuestion('지원동기',700);q=updateDraft(q,q.branches[0].id,'첫 본문');q=snapshot(q,q.branches[0].id,'첫 초안','설명');return q;};
test('최신 기록 수정은 기존 브랜치의 초안만 바꾸고 스냅샷을 보존한다',()=>{const q=saved(),old=structuredClone(q);const r=editSnapshot(q,q.snapshots[0].id,'바꾼 본문');assert.equal(r.question.branches.length,1);assert.equal(r.question.branches[0].draft.text,'바꾼 본문');assert.equal(r.question.snapshots[0].text,'첫 본문');assert.deepEqual(q,old);});
test('중간 스냅샷 수정은 새 브랜치와 별도 초안을 만든다',()=>{let q=saved();q=updateDraft(q,q.branches[0].id,'두 번째');q=snapshot(q,q.branches[0].id,'두 번째');const r=editSnapshot(q,q.snapshots[0].id,'다른 방향');assert.equal(r.question.branches.length,2);assert.equal(r.question.branches[0].draft.text,'두 번째');assert.equal(r.question.branches[1].draft.text,'다른 방향');assert.deepEqual(r.question.branches[1].draft.baseIds,[q.snapshots[0].id]);});
test('내용이 같으면 자동 분기를 생성하지 않는다',()=>{const q=saved();const r=editSnapshot(q,q.snapshots[0].id,'첫 본문');assert.deepEqual(r.question,q);});
test('이미 수정된 초안이 있으면 자동으로 덮어쓰지 않는다',()=>{let q=saved();q=updateDraft(q,q.branches[0].id,'작성해 둔 초안');assert.throws(()=>editSnapshot(q,q.snapshots[0].id,'새 타이핑'),/DRAFT_CONFLICT/);const r=editSnapshot(q,q.snapshots[0].id,'새 타이핑',{forceBranch:true});assert.equal(r.question.branches[0].draft.text,'작성해 둔 초안');assert.equal(r.question.branches.length,2);});
test('새 브랜치 병합은 두 부모의 결과 스냅샷을 만들고 원문을 보존한다',()=>{let q=saved();q=branchFrom(q,q.snapshots[0].id,'다른 도입');q=updateDraft(q,q.branches[1].id,'다른 본문');q=snapshot(q,q.branches[1].id,'다른 안');const old=structuredClone(q);const r=mergeDraft(q,{leftId:q.snapshots[0].id,rightId:q.snapshots[1].id,text:'병합 본문',name:'병합안',mode:'new'});assert.equal(r.question.branches.length,3);assert.equal(r.question.snapshots.length,3);assert.equal(r.question.branches[2].draft.text,'병합 본문');assert.deepEqual(r.question.snapshots.at(-1).parentIds,q.snapshots.map(n=>n.id));assert.deepEqual(r.question.branches[2].draft.baseIds,[r.snapshotId]);assert.deepEqual(q,old);});
test('기존 브랜치 병합도 명시적 덮어쓰기 전에는 초안을 보호한다',()=>{let q=saved();q=updateDraft(q,q.branches[0].id,'보호할 초안');const args={leftId:q.snapshots[0].id,rightId:q.snapshots[0].id,text:'합친 본문',mode:'existing',branchId:q.branches[0].id};assert.throws(()=>mergeDraft(q,args),/DRAFT_CONFLICT/);const r=mergeDraft(q,{...args,overwrite:true});assert.equal(r.question.branches.length,1);assert.deepEqual(r.question.snapshots.at(-1).parentIds,[q.snapshots[0].id]);assert.deepEqual(r.question.branches[0].draft.baseIds,[r.snapshotId]);});
test('제출본은 원문을 복제해 이후 초안 변경과 분리된다',()=>{const q=saved();const a={id:'app',company:'회사',questions:[q]};const s=freezeSubmission(a,{[q.id]:{kind:'draft',id:q.branches[0].id}},'제출본');q.branches[0].draft.text='나중 수정';assert.equal(s.answers[0].text,'첫 본문');});
test('그래프에는 부모가 먼저 나오고 브랜치별 작성 중이 구분된다',()=>{let q=saved();q=branchFrom(q,q.snapshots[0].id,'다른 방향');const rows=graphRecords(q);assert.equal(rows.filter(n=>n.kind==='draft').length,2);assert.ok(rows.findIndex(n=>n.id===q.snapshots[0].id)<rows.findIndex(n=>n.kind==='draft'));});
test('손상되거나 부모가 없는 백업을 거부한다',()=>{assert.throws(()=>validateStore({version:1,applications:[{questions:[{snapshots:[{id:'s',parentIds:['missing']}],branches:[]}]}]}));});
test('직접 입력한 공고의 실제 문항만 추출한다',()=>{const r=importPostingText('주요 업무\nAPI 개발\n자격 요건\nJava 경험\n자기소개서\n1. 지원동기를 작성해 주세요. (700자)\n2. 문제 해결 경험을 작성해 주세요. (1000자)');assert.equal(r.questions.length,2);assert.equal(r.questions[0].limit,700);assert.match(r.duties,/API/);assert.match(r.requirements,/Java/);});
import {seedStore} from '../src/seed.js';
import {designateQuestionSubmission, designatedSubmissionAnswers, reviseQuestionSubmission, updateQuestion, writingPath} from '../src/model.js';
test('지연된 메시지 추가는 최신 초안과 스냅샷을 유지한다',()=>{const store=seedStore(),a=store.applications[0],q=a.questions[0],bid=q.branches[0].id;const append=current=>({...current,messages:[...current.messages,{id:'reply',role:'user',text:'피드백 요청'}]});let next=updateQuestion(store,a.id,q.id,current=>snapshot(updateDraft(current,bid,'클립보드 대기 중 수정한 본문'),bid,'나중 기록'));next=updateQuestion(next,a.id,q.id,append);const result=next.applications[0].questions[0];assert.equal(result.branches[0].draft.text,'클립보드 대기 중 수정한 본문');assert.equal(result.snapshots.at(-1).title,'나중 기록');assert.equal(result.messages.length,1);});
test('화면 필수 필드와 기록 소유권이 손상된 백업을 교체 전에 거부한다',()=>{const valid=seedStore();assert.equal(validateStore(valid),valid);for(const corrupt of [s=>s.applications[0].questions[0].limit=null,s=>s.applications[0].questions.push(s.applications[0].questions[0]),s=>s.applications[0].events.push({id:'e',title:'면접',type:'면접',date:null,time:'',note:''}),s=>s.applications[0].submissions.push({id:'s',name:'제출본',answers:null}),s=>s.applications[0].questions[0].branches[0].snapshotIds.push(s.applications[0].questions[0].snapshots.at(-1).id),s=>s.applications[0].questions[0].messages.push({id:'m',role:'assistant',text:{bad:true}})]){const data=structuredClone(valid);corrupt(data);assert.throws(()=>validateStore(data),/INVALID_BACKUP/);}});
test('병합 스냅샷 수정 후 원문 복귀는 작성 중을 닫고 확정 기록을 유지한다',()=>{let q=saved();const b=q.branches[0].id,old=q.snapshots[0].id;q=snapshot(updateDraft(q,b,'최신 본문'),b,'최신 기록');q=mergeDraft(q,{leftId:old,rightId:old,text:'첫 본문',mode:'existing',branchId:b}).question;q=updateDraft(updateDraft(q,b,'첫 본문!'),b,'첫 본문');assert.equal(q.branches[0].draft.dirty,false);assert.equal(q.branches[0].draft.closed,true);assert.equal(q.snapshots.length,3);assert.equal(q.snapshots.at(-1).text,'첫 본문');assert.throws(()=>snapshot(q,b,'같은 본문 중복 저장'),/NO_CHANGES/);});

test('병합 후에도 모든 분기의 초안 데이터와 그래프 부모 연결을 보존한다',()=>{let q=saved();q=branchFrom(q,q.snapshots[0].id,'다른 도입');const other=q.branches[1].id;q=snapshot(updateDraft(q,other,'다른 경험'),other,'경험안');q=mergeDraft(q,{leftId:q.snapshots[0].id,rightId:q.snapshots[1].id,text:'병합할 본문',name:'병합안',mode:'new'}).question;const rows=graphRecords(q),drafts=rows.filter(r=>r.kind==='draft');assert.equal(drafts.length,q.branches.length);assert.deepEqual(new Set(drafts.map(r=>r.branchId)),new Set(q.branches.map(b=>b.id)));for(const row of rows)for(const parent of row.parentIds)assert.ok(rows.findIndex(r=>r.kind==='snapshot'&&r.id===parent)<rows.indexOf(row));});

test('문항별 지정본은 이후 수정과 분리되며 면접 자료에는 지정된 문항만 포함한다', () => {
  const store = seedStore();
  const [application] = store.applications;
  const [first, second] = application.questions;
  const branch = first.branches[0].id;
  const key = 'draft:' + branch;
  const original = '지원 당시 작성안 본문을 그대로 면접 자료에 남깁니다.';
  const updated = '면접 연습 이후 새로운 내용으로 수정합니다.';
  let question = designateQuestionSubmission(updateDraft(first, branch, original), key);
  assert.match(question.submissionHistory[0].label, /^초안 · /);
  question = updateDraft(question, branch, updated);
  assert.equal(designatedSubmissionAnswers({...application, questions: [question, second]})[0].text, original);
  question = designateQuestionSubmission(question, key);
  assert.deepEqual(question.submissionHistory.map(answer => answer.text), [original, updated]);
  application.questions = [question, second];
  assert.equal(validateStore(structuredClone(store)).applications[0].questions[0].submissionHistory.length, 2);
  assert.deepEqual(designatedSubmissionAnswers(application).map(answer => [answer.number, answer.text]), [[1, updated]]);
  application.questions[0].submissionHistory[0].questionId = second.id;
  assert.throws(() => validateStore(store), /INVALID_BACKUP/);
});

test('제출본 직접 수정은 이전 제출본과 초안을 보존하고 최신 답변만 내보낸다', () => {
  const store = seedStore();
  const [application] = store.applications;
  const [first, second] = application.questions;
  const saved = designateQuestionSubmission(first, 'snapshot:' + first.snapshots[0].id);
  const revised = reviseQuestionSubmission(saved, '직접 수정한 제출본');
  assert.deepEqual(revised.snapshots, first.snapshots);
  assert.deepEqual(revised.branches, first.branches);
  assert.deepEqual(revised.submissionHistory[0], saved.submissionHistory[0]);
  assert.notEqual(revised.submissionHistory[1].id, revised.submissionHistory[0].id);
  assert.equal(reviseQuestionSubmission(revised, '직접 수정한 제출본'), revised);
  assert.throws(() => reviseQuestionSubmission(revised, '  '), /EMPTY_TEXT/);
  assert.throws(() => reviseQuestionSubmission(second, '아직 지정하지 않은 문항'), /SELECTION_REQUIRED/);

  application.questions = [revised, second];
  assert.equal(validateStore(structuredClone(store)).applications[0].questions[0].submissionHistory.length, 2);
  assert.deepEqual(designatedSubmissionAnswers(application).map(answer => [answer.number, answer.text]), [[1, '직접 수정한 제출본']]);
});

test('공고 원문에서 우대 사항과 사용자가 지정한 제목을 섹션으로 가져온다', () => {
  const result = importPostingText([
    '회사명: 모노랩',
    '직무: 플랫폼 개발자',
    '주요 업무',
    '지원 기록 API 개발',
    '우대 사항: PostgreSQL 경험',
    '## 근무 형태',
    '주 2회 재택',
    '마감일: 2026.12.03',
    '채용 절차',
    '서류 → 면접',
    '자기소개서',
    '1. 지원 동기 (700자)',
  ].join('\n'));

  assert.equal(result.company, '모노랩');
  assert.equal(result.role, '플랫폼 개발자');
  assert.deepEqual(result.sections, [
    {title: '주요 업무', body: '지원 기록 API 개발'},
    {title: '우대 사항', body: 'PostgreSQL 경험'},
    {title: '근무 형태', body: '주 2회 재택'},
  ]);
  assert.equal(result.deadline, '2026-12-03');
  assert.deepEqual(result.stages, ['서류', '면접']);
  assert.deepEqual(result.questions, [{prompt: '지원 동기', limit: 700}]);
});

test('기존 공고의 본문을 표시하고 편집한 섹션과 빈 목록을 그대로 읽는다', () => {
  const store = seedStore();
  const [application] = store.applications;
  assert.equal(postingSections(application)[0].body, application.duties);
  assert.equal(postingSections(application)[1].body, application.requirements);

  application.sections = [{id: 'section1', title: '근무 조건', body: '주 2회 재택'}];
  assert.deepEqual(postingSections(validateStore(store).applications[0]), application.sections);
  application.sections.push({...application.sections[0]});
  assert.throws(() => validateStore(store), /INVALID_BACKUP/);

  application.sections = [];
  assert.deepEqual(postingSections(validateStore(store).applications[0]), []);
});

test('공고 원문에서 접수 기간과 마감일 제목 아래의 날짜를 읽는다', () => {
  const period = importPostingText('접수 기간\n2026.11.20 ~ 2026.12.03\n주요 업무\nAPI 개발');
  assert.equal(period.deadline, '2026-12-03');
  assert.equal(period.sections[0].body, '2026.11.20 ~ 2026.12.03');
  assert.equal(importPostingText('지원 마감일\n2026-12-03\n우대 사항\nSQL 경험').deadline, '2026-12-03');
});

test('스냅샷은 v번호 대신 이름으로 보이고 갈라진 버전과 제출본 출처도 스냅샷 이름을 쓴다', async () => {
 const {recordName} = await import('../src/model.js');
 const {sourceName} = await import('../src/writing-options.js');
 let q = createQuestion('지원 동기', 500);
 const main = q.branches[0].id;
 q = snapshot(updateDraft(q, main, '첫 답변'), main, '제출 전');
 const saved = q.snapshots[0];
 assert.equal(recordName({...saved, kind: 'snapshot'}), '제출 전');

 q = branchFrom(q, saved.id);
 assert.equal(q.branches.at(-1).name, '제출 전에서 시작');
 const answer = designateQuestionSubmission(q, 'snapshot:' + saved.id).submissionHistory.at(-1);
 assert.equal(answer.label, '제출 전');
 assert.doesNotMatch(answer.label, /\bv\d+\b/);
 const drafted = designateQuestionSubmission(q, 'draft:' + main).submissionHistory.at(-1);
 assert.equal(drafted.label, '초안 · 기본');

 assert.equal(sourceName({recordKey: 'snapshot:' + saved.id, label: 'v1', title: '제출 전'}), '제출 전');
 assert.equal(sourceName({recordKey: 'draft:' + main, label: '작성 중', title: '기본'}), '작성 중');
});

test('예전에 v번호와 함께 저장한 제출본 출처 이름은 v번호를 떼고 보여 준다', async () => {
 const {answerLabel} = await import('../src/model.js');
 assert.equal(answerLabel('v3 · 스냅샷 3'), '스냅샷 3');
 assert.equal(answerLabel('v12 · 제출 전'), '제출 전');
 assert.equal(answerLabel('초안 · 기본'), '초안 · 기본');
 assert.equal(answerLabel('직접 수정'), '직접 수정');
 assert.equal(answerLabel(undefined), '');
});

test('지원 건을 열면 마지막으로 쓰던 문항으로 가고 그 문항이 지워졌으면 첫 문항으로 간다', () => {
 const first = createQuestion('지원 동기'), second = createQuestion('협업 경험');
 const application = {id: 'application-1', questions: [first, second]};
 assert.equal(writingPath(application), '/write/application-1/' + first.id);
 assert.equal(writingPath({...application, lastQuestionId: second.id}), '/write/application-1/' + second.id);
 assert.equal(writingPath({...application, lastQuestionId: 'question-deleted'}), '/write/application-1/' + first.id);
 assert.equal(writingPath({id: 'application-2', questions: [], lastQuestionId: second.id}), '/posting/application-2');
});
