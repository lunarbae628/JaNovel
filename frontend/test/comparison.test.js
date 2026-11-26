import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRows,paragraphs,differingRanges} from '../src/comparison.js';
import {createMergeState,chooseMergeRegion,chooseAllRegions,editMergeText,mergeHighlights,changeCards,toggleCard,followRanges} from '../src/merge-state.js';
import {firstDraft,polished,revised,aiSuggestion,shortened,addComparisonSample} from '../src/comparison-sample.js';
import {createQuestion,updateDraft,snapshot,branchFrom,graphRecords,visibleGraphRecords,activateBranch,validateStore} from '../src/model.js';
import {seedStore} from '../src/seed.js';
test('기본 그래프와 전체보기 모두 분기별 초안을 표시하며 원문을 보존한다',()=>{let q=createQuestion();const main=q.branches[0].id;q=snapshot(updateDraft(q,main,'첫 본문'),main,'기록');q=branchFrom(q,q.snapshots[0].id,'다른 안');const other=q.branches[1].id;q=updateDraft(q,other,'다른 초안');q=updateDraft(q,main,'기본 미저장 초안');const before=structuredClone(q);const basic=visibleGraphRecords(q,other),all=visibleGraphRecords(q,other,true);assert.equal(basic.filter(r=>r.kind==='draft').length,2);assert.deepEqual(new Set(basic.filter(r=>r.kind==='draft').map(r=>r.branchId)),new Set([main,other]));assert.equal(all.filter(r=>r.kind==='draft').length,2);assert.equal(basic.filter(r=>r.kind==='snapshot').length,q.snapshots.length);assert.equal(graphRecords(q).filter(r=>r.kind==='draft').length,2);assert.deepEqual(q,before);});
test('활성 브랜치 변경은 다른 초안과 스냅샷을 수정하지 않고 백업도 통과한다',()=>{const store=seedStore(),q=store.applications[0].questions[0],before=structuredClone(q);const bid=q.branches[1].id,next=activateBranch(q,bid);assert.equal(next.activeBranchId,bid);assert.deepEqual(next.branches,q.branches);assert.deepEqual(next.snapshots,q.snapshots);assert.deepEqual(q,before);store.applications[0].questions[0]=next;assert.equal(validateStore(store),store);assert.throws(()=>activateBranch(q,'missing'),/BRANCH_NOT_FOUND/);});
import {mergeDraft} from '../src/model.js';
test('새 병합안을 만든 뒤 다시 진입해도 그 브랜치가 활성 초안이다',()=>{let q=createQuestion();const bid=q.branches[0].id;q=snapshot(updateDraft(q,bid,'기록 본문'),bid,'기록');const id=q.snapshots[0].id;const result=mergeDraft(q,{leftId:id,rightId:id,text:'합친 초안',mode:'new'});assert.equal(result.question.activeBranchId,result.branchId);});

// 비교 화면 흐름을 흉내 낸다. 왼쪽(참고본)의 달라진 부분을 누르면 오른쪽(작성 중)에 반영하고, 다시 누르면 취소한다.
function session(reference,current){
 let s=createMergeState(reference,current,'right');
 const find=word=>{const change=s.changes.find(c=>c.left.includes(word));assert.ok(change,'왼쪽에 "'+word+'"가 든 달라진 부분이 없음');return change.id;};
 return {
  click(word){s=chooseMergeRegion(s,find(word),'left');return this;},
  type(next){s=editMergeText(s,typeof next==='function'?next(s.text):next);return this;},
  get text(){return s.text;},get state(){return s;},
 };
}

test('비교를 시작하면 작성 중 본문은 그대로이고 문단은 비슷한 문단끼리 짝지어진다',()=>{
 for(const [a,b] of [[aiSuggestion,revised],[firstDraft,revised],[revised,shortened],[polished,revised]])assert.equal(createMergeState(a,b,'right').text,b);
 assert.deepEqual(compareRows(aiSuggestion,revised).map(r=>r.status),['modified','modified','modified']);
 assert.deepEqual(paragraphs('첫 문단\n\n둘째 문단').map(p=>[p.text,p.sep]),[['첫 문단',''],['둘째 문단','\n\n']]);
});
test('AI 첨삭의 달라진 부분을 누르면 그 부분만 바뀌고 다시 누르면 원래대로 돌아간다',()=>{
 const s=session(aiSuggestion,revised).click('이 책임을 함께 지고');
 assert.ok(s.text.includes('플랫폼에서 이 책임을 함께 지고 싶어 지원했습니다.'));
 assert.equal(s.text.replace('이 책임을 함께 지고','일하고'),revised);
 assert.equal(s.click('이 책임을 함께 지고').text,revised);
});
test('완전히 다른 문단은 지금 문단을 바꾸지 않고 그 자리에 새 문단으로 들어간다',()=>{
 const reference='대학 시절 동아리에서 회계를 맡아 매달 장부를 정리했습니다.\n둘째 문단은 같습니다.',current='저는 결제 서비스의 안정성에 관심이 많습니다.\n둘째 문단은 같습니다.';
 assert.deepEqual(compareRows(reference,current).map(r=>r.status),['deleted','added','same']);
 const s=session(reference,current).click('동아리');
 assert.equal(s.text,'대학 시절 동아리에서 회계를 맡아 매달 장부를 정리했습니다.\n저는 결제 서비스의 안정성에 관심이 많습니다.\n둘째 문단은 같습니다.');
 assert.equal(s.click('동아리').text,current);
});
test('같은 문단 안에서 내용이 전혀 다른 문장은 바꾸지 않고 덧붙인다',()=>{
 const reference='인턴 기간에 주문 API를 개선했습니다. 팀원들과 매주 코드 리뷰를 진행하며 규칙을 정했습니다. 이 경험으로 성장했습니다.',
  current='인턴 기간에 주문 API를 개선했습니다. 장애가 나면 로그부터 확인하는 습관을 들였습니다. 이 경험으로 성장했습니다.';
 const s=session(reference,current).click('코드 리뷰');
 assert.ok(s.text.includes('코드 리뷰를 진행하며 규칙을 정했습니다.'));assert.ok(s.text.includes('로그부터 확인하는 습관을 들였습니다.'));
 assert.equal(s.click('코드 리뷰').text,current);
});
test('500자 버전에서 빠진 문장은 원래 자리에 다시 들어가고 모두 누르면 원래 본문이 된다',()=>{
 const s=session(revised,shortened).click('같은 패턴의 쿼리');
 assert.ok(s.text.includes('줄였습니다. 같은 패턴의 쿼리 6개도 찾아 함께 개선했습니다.'));
 const all=session(revised,shortened);for(const change of all.state.changes)if(change.left)all.click(change.left.trim());
 assert.equal(all.text,revised);
});
test('지운 문단을 여러 개 되살리면 누른 순서와 상관없이 참고본 순서를 지킨다',()=>{
 const reference='첫째 문단입니다.\n둘째로 넣을 이야기입니다.\n셋째로 넣을 다른 이야기입니다.\n마지막 문단입니다.',current='첫째 문단입니다.\n마지막 문단입니다.';
 const s=session(reference,current).click('셋째').click('둘째');
 assert.equal(s.text,reference);
});
test('반영한 부분을 다시 누르면 순서와 상관없이 그 반영만 취소되고 모두 취소하면 원래 본문이 된다',()=>{
 const s=session(aiSuggestion,revised).click('이 책임을 함께 지고').click('75%').click('1년 안에');
 s.click('75%');assert.ok(!s.text.includes('75%'));assert.ok(s.text.includes('이 책임을 함께 지고'));assert.ok(s.text.includes('1년 안에'));
 s.click('1년 안에').click('이 책임을 함께 지고');assert.equal(s.text,revised);
});
test('반영한 뒤 직접 입력한 내용은 취소해도 남는다',()=>{
 const s=session(aiSuggestion,revised).click('75%').type(text=>text+'\n직접 쓴 마무리입니다.');
 s.click('75%');assert.equal(s.text,revised+'\n직접 쓴 마무리입니다.');
});
test('오른쪽 칸에는 반영한 부분과 원래 달랐던 부분을 출처별로 표시한다',()=>{
 const s=session(aiSuggestion,revised).click('75%');
 const marks=mergeHighlights(s.state).map(m=>[m.side,s.text.slice(m.start,m.end)]);
 assert.ok(marks.some(([side,text])=>side==='left'&&text.includes('75%')));
 assert.ok(marks.some(([side,text])=>side==='right'&&text.includes('일하고')));
 assert.equal(s.state.last.side,'left');
});
test('같은 문단은 달라진 부분으로 표시하지 않는다',()=>{
 const rows=compareRows(revised,polished);assert.equal(rows[0].status,'same');
 assert.ok(rows.every(r=>r.status!=='same'||r.left.text===r.right.text));
});
const sentence=parts=>parts.map(part=>part.text).join('');
test('부분 수정 카드는 달라진 문장마다 지금 문장과 참고본 문장을 한 쌍으로 보여 준다',()=>{
 const cards=changeCards(createMergeState(aiSuggestion,revised,'right'));
 assert.equal(cards.length,4);
 assert.equal(sentence(cards[1].current),'인턴 기간에 주문 API의 응답이 느리다는 문의를 받았습니다.');
 assert.equal(sentence(cards[1].reference),'인턴 기간에 주문 API가 느리다는 문의를 받았습니다.');
 assert.ok(cards[1].reference.some(part=>part.changed&&part.text.includes('API가')));
 assert.ok(cards.every(card=>!card.applied));
});
test('카드를 누르면 그 문장의 구절을 모두 반영하고 다시 누르면 원래 본문으로 돌아간다',()=>{
 let s=createMergeState(aiSuggestion,revised,'right');const card=changeCards(s)[2];
 s=toggleCard(s,card.ids);
 assert.ok(s.text.includes('실행 계획을 확인해 보니 인덱스 없이 전체 테이블을 조회하고 있었고, 복합 인덱스를 추가해 평균 응답 시간을 1.2초에서 0.3초로 75% 줄였습니다.'));
 assert.ok(changeCards(s)[2].applied);
 assert.equal(toggleCard(s,card.ids).text,revised);
});
test('한쪽에만 있는 문단과 문장도 카드가 되고 반영하면 참고본과 같아진다',()=>{
 let s=createMergeState(revised,shortened,'right');const cards=changeCards(s);
 assert.ok(cards.some(card=>sentence(card.reference).includes('같은 패턴의 쿼리 6개도')));
 for(const card of cards)s=toggleCard(s,card.ids);
 assert.equal(s.text,revised);
 const only=changeCards(createMergeState('첫째 문단입니다.\n마지막 문단입니다.','첫째 문단입니다.\n작성 중에만 있는 다른 이야기입니다.\n마지막 문단입니다.','right'));
 assert.equal(only.length,1);assert.deepEqual(only[0].reference,[]);
});
test('오른쪽 내 본문에는 참고본과 다른 구간만 칠하고 같은 본문이면 칠하지 않는다',()=>{
 const marked=differingRanges(aiSuggestion,revised).map(range=>revised.slice(range.start,range.end));
 assert.ok(marked.includes('일하고'));assert.ok(marked.includes('API의 응답이'));
 assert.ok(marked.every(text=>text===text.trim()&&text));
 assert.deepEqual(differingRanges(revised,revised),[]);
 const added=differingRanges('첫 문단입니다.','첫 문단입니다.\n전혀 다른 내용의 새 문단을 덧붙였습니다.').map(range=>range.end-range.start);
 assert.deepEqual(added,['전혀 다른 내용의 새 문단을 덧붙였습니다.'.length]);
});
test('직접 고쳐 달라진 문장의 카드는 숨기고 눌러도 내 본문을 바꾸지 않는다',()=>{
 let s=createMergeState('저는 Python으로 개발했습니다.','저는 Java로 개발했습니다.','right');
 const card=changeCards(s)[0];
 s=editMergeText(s,'저는 고객 상담을 맡았습니다.');
 assert.deepEqual(changeCards(s),[]);
 assert.equal(toggleCard(s,card.ids).text,'저는 고객 상담을 맡았습니다.');
 assert.equal(chooseAllRegions(s,'left',{intact:true}).text,'저는 고객 상담을 맡았습니다.');
});
test('반영한 카드는 다른 문단을 직접 고친 뒤에도 다시 눌러 취소할 수 있다',()=>{
 let s=createMergeState(aiSuggestion,revised,'right');const card=changeCards(s)[1];
 s=toggleCard(s,card.ids);s=editMergeText(s,s.text+' 직접 덧붙인 문장.');
 assert.ok(changeCards(s).find(c=>c.key===card.key).applied);
 assert.equal(toggleCard(s,card.ids).text,revised+' 직접 덧붙인 문장.');
});
test('앞뒤 공백과 들여쓰기가 있는 본문도 비교를 시작하고 반영을 취소하면 원문과 같다',()=>{
 const draft='\n  첫 문단은 같습니다.\n둘째 문단에서 Java를 썼습니다.  \n\n',reference='  첫 문단은 같습니다.\n둘째 문단에서 Python을 썼습니다.  ';
 let s=createMergeState(reference,draft,'right');
 assert.equal(s.text,draft);
 const card=changeCards(s)[0];s=toggleCard(s,card.ids);
 assert.ok(s.text.includes('Python을'));assert.equal(toggleCard(s,card.ids).text,draft);
 assert.equal(createMergeState(reference,'   ','right').text,'   ');
});
test('긴 본문은 같은 앞뒤 문단을 건너뛰고 문단 쌍이 많아도 가까운 쌍만 비교해 빨리 끝난다',()=>{
 const line=(k,t)=>t+' 문단 '+k+'에서는 서비스 운영과 장애 대응 경험을 바탕으로 개선한 내용을 설명합니다.';
 const left=Array.from({length:150},(_,k)=>line(k,'왼쪽')).join('\n'),right=Array.from({length:150},(_,k)=>line(k*7%150,'오른쪽 다른')).join('\n');
 let start=performance.now();differingRanges(left,right);const different=performance.now()-start;
 start=performance.now();const one=differingRanges(left,left.replace('문단 5에서','문단 5에선'));const edit=performance.now()-start;
 assert.equal(one.length,1);assert.ok(edit<20,'한 문단 수정 '+edit+'ms');assert.ok(different<400,'다른 본문 '+different+'ms');
});
test('계산 전 입력에도 칠한 구간이 같은 글자를 따라간다',()=>{
 const ranges=differingRanges(aiSuggestion,revised),typed='앞에 넣은 문장. '+revised;
 const moved=followRanges(ranges,revised,typed);
 assert.deepEqual(moved.map(r=>typed.slice(r.start,r.end)),ranges.map(r=>revised.slice(r.start,r.end)));
});
test('비교 연습 데이터는 기존 지원 건을 지우지 않고 한 번만 추가되며 저장 검증을 통과한다',()=>{
 const store=seedStore(),before=structuredClone(store.applications);
 const first=addComparisonSample(store),again=addComparisonSample(first.store);
 assert.deepEqual(first.store.applications.slice(0,before.length),before);
 assert.equal(first.store.applications.length,before.length+1);
 assert.equal(again.store,first.store);assert.equal(again.applicationId,first.applicationId);
 const q=first.store.applications.at(-1).questions[0];
 assert.deepEqual(q.branches.map(b=>b.draft.text),[revised,aiSuggestion,shortened]);
 assert.deepEqual(q.snapshots.filter(n=>n.branchId===q.branches[0].id).map(n=>n.text),[firstDraft,polished,revised]);
 assert.equal(validateStore(structuredClone(first.store)).applications.length,before.length+1);
});

