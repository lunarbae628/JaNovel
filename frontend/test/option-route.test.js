import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuestion,updateDraft,snapshot} from '../src/model.js';
import {createWritingOption} from '../src/writing-options.js';
import * as route from '../src/option-route.js';
test('비교 중 다른 작성안에 편집한 뒤 새로고침해도 두 대상과 활성 작성안을 유지한다',()=>{
 let q=createQuestion();const a=q.branches[0].id;q=snapshot(updateDraft(q,a,'첫 글'),a,'첫 기록');const reference='snapshot:'+q.snapshots[0].id;
 q=createWritingOption(q,'협업');const target='draft:'+q.activeBranchId;
 const params=new URLSearchParams(route.comparisonSearch('record='+reference,reference,target)),state=route.optionView(q,params);
 assert.equal(state.key,reference);assert.equal(state.target,target);assert.equal(state.branchId,q.activeBranchId);assert.equal(state.comparing,true);
 const draftReference='draft:'+a,drafts=route.optionView(q,new URLSearchParams(route.comparisonSearch('',draftReference,target)));
 assert.equal(drafts.key,draftReference);assert.equal(drafts.target,target);assert.equal(drafts.branchId,q.activeBranchId);
});
test('잘못된 주소는 현재 작성안을 안전하게 열고 기존 스냅샷 주소도 지원한다',()=>{
 let q=createQuestion();const id=q.branches[0].id;q=snapshot(updateDraft(q,id,'본문'),id,'기록');const key='snapshot:'+q.snapshots[0].id;
 assert.equal(route.optionView(q,new URLSearchParams('record=missing')).key,key);
 assert.equal(route.optionView(q,new URLSearchParams({record:key})).key,key);
});
