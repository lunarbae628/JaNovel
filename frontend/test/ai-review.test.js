import test from 'node:test';
import assert from 'node:assert/strict';
import {createReview,changeStatus,decideChange,acceptAllChanges,revertAllChanges,toggleSentence,reviewCounts,stepChange,nextPendingChange,reviewSegments,changeSummary,reviewCards,draftRequestBranch} from '../src/ai-review.js';

const draft='결제는 신뢰가 중요한 영역입니다. 그래서 결제 플랫폼에서 일하고 싶습니다.\n입사 후에는 장애 대응을 배우고 싶습니다.';
const candidate='결제는 신뢰가 중요한 영역입니다. 결제 플랫폼에서 이 책임을 함께 지고 싶습니다.\n입사 후 1년 안에 장애 대응을 익히겠습니다.';
const idOf=(review,word)=>{const change=review.merge.changes.find(c=>c.left.includes(word)||c.right.includes(word));assert.ok(change,'"'+word+'"가 든 변경이 없음');return change.id;};

test('각 AI 초안은 바로 앞의 요청에 저장된 작성 버전을 사용한다',()=>{
 const first={id:'answer-a',role:'assistant',kind:'draft'},second={id:'answer-b',role:'assistant',kind:'draft'};
 const messages=[
  {id:'ask-a',role:'user',kind:'draft',source:'draft:version-a'},first,
  {id:'ask-b',role:'user',kind:'draft',source:'draft:version-b'},second,
 ];
 assert.equal(draftRequestBranch(messages,first),'version-a');
 assert.equal(draftRequestBranch(messages,second),'version-b');
 assert.equal(draftRequestBranch([first],first),null);
});

test('AI 수정안 검토는 작성 중 본문 그대로 시작하고 모든 변경이 검토 전이다',()=>{
 const review=createReview(candidate,draft);
 assert.equal(review.merge.text,draft);
 assert.ok(review.merge.changes.length>=2);
 assert.ok(review.merge.changes.every(change=>changeStatus(review,change.id)==='pending'));
 assert.deepEqual(reviewCounts(review),{total:review.merge.changes.length,accepted:0,pending:review.merge.changes.length});
});

test('변경을 반영하면 본문에 수정안 문구가 들어가고 되돌리면 원래 본문으로 돌아간다',()=>{
 let review=createReview(candidate,draft);const id=idOf(review,'책임');
 review=decideChange(review,id,'accept');
 assert.equal(changeStatus(review,id),'accepted');
 assert.match(review.merge.text,/이 책임을 함께 지고/);
 review=decideChange(review,id,'undo');
 assert.equal(changeStatus(review,id),'pending');
 assert.equal(review.merge.text,draft);
});

test('그대로 두기로 한 변경은 본문을 바꾸지 않고, 반영했던 변경을 그대로 두면 원래 문구로 돌아간다',()=>{
 let review=createReview(candidate,draft);const id=idOf(review,'책임');
 review=decideChange(review,id,'reject');
 assert.equal(changeStatus(review,id),'rejected');
 assert.equal(review.merge.text,draft);
 review=decideChange(review,id,'accept');
 assert.equal(changeStatus(review,id),'accepted');
 review=decideChange(review,id,'reject');
 assert.equal(changeStatus(review,id),'rejected');
 assert.equal(review.merge.text,draft);
 review=decideChange(review,id,'undo');
 assert.equal(changeStatus(review,id),'pending');
});

test('모두 반영하면 수정안과 같은 본문이 되고 모두 되돌리면 작성 중 본문으로 돌아간다',()=>{
 let review=decideChange(createReview(candidate,draft),0,'reject');
 review=acceptAllChanges(review);
 assert.equal(review.merge.text,candidate);
 assert.equal(reviewCounts(review).accepted,review.merge.changes.length);
 review=revertAllChanges(review);
 assert.equal(review.merge.text,draft);
 assert.equal(reviewCounts(review).pending,review.merge.changes.length);
});

test('부분 수정 카드를 누르면 그 문장의 변경을 함께 반영하고 다시 누르면 되돌린다',()=>{
 let review=createReview(candidate,draft);
 const card=reviewCards(review).find(item=>item.reference.some(part=>part.text.includes('익히겠습니다')));
 assert.ok(card);
 review=toggleSentence(review,card.ids);
 assert.ok(card.ids.every(id=>changeStatus(review,id)==='accepted'));
 assert.match(review.merge.text,/1년 안에 장애 대응을 익히겠습니다/);
 review=toggleSentence(review,card.ids);
 assert.equal(review.merge.text,draft);
});

test('다음 검토할 변경은 처리한 변경을 건너뛰고 끝에서 처음으로 돌아간다',()=>{
 let review=createReview(candidate,draft);
 const order=review.merge.ranges.map(range=>range.id);
 assert.equal(stepChange(review,order.at(-1),1),order[0]);
 assert.equal(stepChange(review,order[0],-1),order.at(-1));
 review=decideChange(review,order[1],'accept');
 assert.equal(nextPendingChange(review,order[0]),order[2]??order[0]);
 for(const id of order)review=decideChange(review,id,'reject');
 assert.equal(nextPendingChange(review,order[0]),null);
});

test('본문 조각은 검토 전 변경에 지금 글과 제안 글을 함께 담고 반영한 변경은 본문 그대로 보여 준다',()=>{
 let review=createReview(candidate,draft);const id=idOf(review,'책임');
 const pending=reviewSegments(review).find(part=>part.id===id);
 assert.equal(pending.status,'pending');
 assert.match(pending.current,/일하고/);
 assert.match(pending.proposed,/책임/);
 assert.equal(reviewSegments(review).map(part=>part.text).join(''),draft);
 review=decideChange(review,id,'accept');
 assert.equal(reviewSegments(review).map(part=>part.text).join(''),review.merge.text);
});

test('수정안 요약은 작성 중 본문과 달라진 곳의 수와 글자 수 차이를 알려 준다',()=>{
 const summary=changeSummary(candidate,draft);
 assert.equal(summary.count,createReview(candidate,draft).merge.changes.length);
 assert.equal(summary.delta,candidate.length-draft.length);
 assert.deepEqual(changeSummary(draft,draft),{count:0,delta:0});
});
