import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuestion,updateDraft,snapshot,visibleGraphRecords,branchFrom,mergeDraft} from '../src/model.js';
import {createWritingOption,combineWritingOptions} from '../src/writing-options.js';
import {deleteBranch} from '../src/history-actions.js';
import * as overview from '../src/overview-graph.js';

function combined(){let q=createQuestion();const a=q.branches[0].id;q=snapshot(updateDraft(q,a,'기술'),a,'첫 글');const left=q.snapshots[0].id;q=createWritingOption(q,'협업');const b=q.activeBranchId;q=updateDraft(q,b,'팀장 경험');const result=combineWritingOptions(q,{leftId:left,rightId:'draft:'+b,text:'기술과 협업',name:'조합'});return {...result,a,b,left};}
test('독립 조합을 원본 스냅샷과 당시 초안에 연결하고 저장 데이터는 바꾸지 않는다',()=>{
 const {question:q,snapshotId,b,left}=combined(),before=structuredClone(q),view=overview.overviewGraphQuestion(q);
 const result=view.snapshots.find(s=>s.id===snapshotId);assert.equal(result.parentIds.length,2);assert.equal(result.parentIds[0],left);
 const frozen=view.snapshots.find(s=>s.id===result.parentIds[1]);assert.equal(frozen.sourcePreview.text,'팀장 경험');assert.equal(frozen.sourcePreview.optionId,b);
 assert.deepEqual(q,before);const rows=visibleGraphRecords(view);for(const r of rows)for(const id of r.parentIds)assert.ok(rows.findIndex(n=>n.id===id&&n.kind==='snapshot')<rows.indexOf(r));
});
test('현재 초안을 고쳐도 그래프의 조합 출처는 당시 본문이다',()=>{
 let {question:q,b,snapshotId}=combined();q=updateDraft(q,b,'다른 내용');const view=overview.overviewGraphQuestion(q),r=view.snapshots.find(s=>s.id===snapshotId),frozen=view.snapshots.find(s=>s.id===r.parentIds[1]);assert.equal(frozen.text,'팀장 경험');assert.equal(view.branches.find(n=>n.id===b).draft.text,'다른 내용');
});
test('원본 작성안을 삭제해도 참고 본문 노드와 조합 연결을 표시한다',()=>{
 let {question:q,a,b,snapshotId}=combined();q=deleteBranch(deleteBranch(q,a),b);const view=overview.overviewGraphQuestion(q),r=view.snapshots.find(s=>s.id===snapshotId);
 assert.equal(r.parentIds.length,2);assert.deepEqual(r.parentIds.map(id=>view.snapshots.find(s=>s.id===id).text),['기술','팀장 경험']);assert.doesNotThrow(()=>visibleGraphRecords(view));assert.equal(q.branches.length,1);
});
test('빈 작성안은 그대로 두고 옛 분기에서 나온 작성안도 독립적으로 시작한다',()=>{
 let q=createQuestion();assert.deepEqual(overview.overviewGraphQuestion(q),q);const b=q.branches[0].id;q=snapshot(updateDraft(q,b,'원문'),b,'기록');q=branchFrom(q,q.snapshots[0].id,'옛 분기');const other=q.branches.at(-1).id;q=updateDraft(q,other,'다른 초안');
 const before=structuredClone(q),view=overview.overviewGraphQuestion(q);assert.deepEqual(view.branches.find(b=>b.id===other).draft.baseIds,[]);assert.deepEqual(q,before);
});
test('다른 작성안에서 갈라지는 선은 없애고 작성안 내부의 수정선은 유지한다',()=>{
 let q=createQuestion();const a=q.branches[0].id;q=snapshot(updateDraft(q,a,'첫 글'),a,'첫 기록');const original=q.snapshots[0].id;q=branchFrom(q,original,'다른 주제');const b=q.branches.at(-1).id;
 q=snapshot(updateDraft(q,b,'다른 주제 초안'),b,'다른 주제 초안');const first=q.snapshots.at(-1).id;q=snapshot(updateDraft(q,b,'다른 주제 보강'),b,'보강');const second=q.snapshots.at(-1).id;
 const view=overview.overviewGraphQuestion(q);assert.deepEqual(view.snapshots.find(s=>s.id===first).parentIds,[]);assert.deepEqual(view.snapshots.find(s=>s.id===second).parentIds,[first]);assert.deepEqual(q.snapshots.find(s=>s.id===first).parentIds,[original]);
});
test('작성안은 독립적으로 시작하면서 기존 실제 병합의 두 출처는 남긴다',()=>{
 let q=createQuestion();const a=q.branches[0].id;q=snapshot(updateDraft(q,a,'기술'),a,'기술');const left=q.snapshots[0].id;q=branchFrom(q,left,'협업');const b=q.branches.at(-1).id;q=snapshot(updateDraft(q,b,'협업'),b,'협업');const right=q.snapshots.at(-1).id;
 const result=mergeDraft(q,{leftId:left,rightId:right,text:'조합',name:'옛 병합'});q=result.question;const view=overview.overviewGraphQuestion(q);
 assert.deepEqual(view.snapshots.find(s=>s.id===right).parentIds,[]);assert.deepEqual(view.snapshots.find(s=>s.id===result.snapshotId).parentIds,[left,right]);assert.doesNotThrow(()=>visibleGraphRecords(view));
});
