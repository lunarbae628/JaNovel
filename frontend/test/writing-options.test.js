import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuestion,updateDraft,snapshot,validateStore} from '../src/model.js';
import {seedStore} from '../src/seed.js';
import {deleteBranch} from '../src/history-actions.js';
import * as options from '../src/writing-options.js';
const validate=q=>{const store=seedStore();store.applications[0].questions=[q];return validateStore(JSON.parse(JSON.stringify(store)));};
const save=(q,id,text)=>snapshot(updateDraft(q,id,text),id,'기록');

test('주제별 새 작성안은 빈 본문과 독립된 기록으로 시작한다',()=>{
 const q=createQuestion(),before=structuredClone(q),next=options.createWritingOption(q,'협업 경험','코드 리뷰');
 assert.deepEqual(q,before);assert.deepEqual(next.branches[0],q.branches[0]);
 const b=next.branches.at(-1);assert.equal(b.name,'협업 경험');assert.equal(b.draft.text,'');assert.deepEqual(b.fromIds,[]);assert.deepEqual(b.draft.baseIds,[]);assert.equal(next.activeBranchId,b.id);validate(next);
});
test('작성안 이름을 바꿔도 본문과 스냅샷은 보존하고 다른 버전과 같은 이름은 번호를 붙이지 않고 거절한다',()=>{
 let q=createQuestion();q=save(q,q.branches[0].id,'기존 본문');q=options.createWritingOption(q,'협업');
 const id=q.branches[0].id;
 assert.throws(()=>options.renameWritingOption(q,id,' 협업 ','새 설명'),/DUPLICATE_VERSION_NAME/);
 const next=options.renameWritingOption(q,id,'리더십','새 설명');
 assert.equal(next.branches[0].name,'리더십');assert.deepEqual(next.snapshots,q.snapshots);assert.deepEqual(next.branches[0].draft,q.branches[0].draft);
 assert.equal(options.renameWritingOption(next,id,'  ','설명만').branches[0].name,'리더십');
 assert.equal(options.renameWritingOption(next,id,'리더십','같은 이름').branches[0].name,'리더십');
});
test('새 버전은 입력한 이름이 겹치면 거절하고 이름을 비우거나 화면이 정한 이름이면 번호를 붙인다',()=>{
 let q=createQuestion();
 assert.throws(()=>options.createWritingOption(q,'기본'),/DUPLICATE_VERSION_NAME/);
 q=options.createWritingOption(q,'');q=options.createWritingOption(q,'  ');
 assert.deepEqual(q.branches.map(b=>b.name),['기본','새 버전','새 버전 2']);
 q=options.createWritingOption(q,'기본 다른 안','',{auto:true});q=options.createWritingOption(q,'기본 다른 안','',{auto:true});
 assert.deepEqual(q.branches.slice(3).map(b=>b.name),['기본 다른 안','기본 다른 안 2']);
});
test('과거 기록 편집은 같은 작성안에 초안을 만들고 기존 미저장 초안과 충돌하면 보호한다',()=>{
 let q=createQuestion();const id=q.branches[0].id;q=save(q,id,'과거');const old=q.snapshots[0];q=save(q,id,'최신');
 const next=options.editOptionSnapshot(q,old.id,'과거를 다듬은 글');assert.equal(next.branches.length,1);assert.equal(next.branches[0].draft.text,'과거를 다듬은 글');assert.deepEqual(next.snapshots,q.snapshots);
 assert.throws(()=>options.editOptionSnapshot(next,old.id,'다른 글'),/DRAFT_CONFLICT/);
 const reverted=updateDraft(next,id,'최신');assert.equal(reverted.branches[0].draft.dirty,false);validate(reverted);
});
test('스냅샷 없는 두 초안의 조합은 원본 상태를 바꾸지 않고 독립된 첫 기록을 만든다',()=>{
 let q=createQuestion();const a=q.branches[0].id;q=updateDraft(q,a,'기술 경험');q=options.createWritingOption(q,'협업');const b=q.activeBranchId;q=updateDraft(q,b,'팀장 경험');const before=structuredClone(q);
 const result=options.combineWritingOptions(q,{leftId:'draft:'+a,rightId:'draft:'+b,text:'기술과 협업',name:'두 경험'}),next=result.question;
 assert.deepEqual(q,before);assert.deepEqual(next.branches.slice(0,2),before.branches);assert.equal(next.snapshots.length,1);
 const created=next.branches.at(-1);assert.deepEqual(created.fromIds,[]);assert.deepEqual(next.snapshots[0].parentIds,[]);assert.equal(next.snapshots[0].text,'기술과 협업');assert.equal(created.draft.closed,true);assert.equal(next.activeBranchId,created.id);
 assert.deepEqual(options.optionSources(next,created.id).map(s=>s.text),['기술 경험','팀장 경험']);validate(next);
});
test('같은 작성안의 서로 다른 기록도 조합하며 출처는 수정·삭제 후에도 남는다',()=>{
 let q=createQuestion();const a=q.branches[0].id;q=save(q,a,'첫 글');const first=q.snapshots[0].id;q=save(q,a,'고친 글');const second=q.snapshots[1].id;
 const result=options.combineWritingOptions(q,{leftId:first,rightId:second,text:'새 조합',name:'조합'});q=result.question;
 q=updateDraft(q,a,'또 다른 글');q=deleteBranch(q,a);
 const sources=options.optionSources(q,result.branchId);assert.deepEqual(sources.map(s=>s.text),['첫 글','고친 글']);assert.equal(sources[0].optionName,'기본');assert.equal(q.snapshots[0].text,'새 조합');validate(q);
});
test('빈 조합 결과와 손상된 출처를 거부한다',()=>{
 const q=createQuestion(),key='draft:'+q.branches[0].id;assert.throws(()=>options.combineWritingOptions(q,{leftId:key,rightId:key,text:' '}),/EMPTY_TEXT/);
 const next=options.combineWritingOptions(updateDraft(q,q.branches[0].id,'원문'),{leftId:key,rightId:key,text:'결과'}).question;
 next.branches.at(-1).sources[0].text=null;assert.throws(()=>validate(next),/INVALID_BACKUP/);
});
