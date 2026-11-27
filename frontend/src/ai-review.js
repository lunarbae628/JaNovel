import {createMergeState,choiceOf,chooseMergeRegion,chooseAllRegions,changeCards,toggleCard} from './merge-state.js';

export function draftRequestBranch(messages,message){
 if(message.role!=='assistant'||message.kind!=='draft')return null;
 const request=messages[messages.findIndex(item=>item.id===message.id)-1];
 const source=request?.role==='user'&&request.kind==='draft'?request.source:null;
 return typeof source==='string'&&source.startsWith('draft:')?source.slice(6):null;
}

// AI 수정안을 작성 중 본문 위에서 한 곳씩 반영하거나 그대로 두는 검토 상태.
// merge는 작성 중 본문을 그대로 두고 시작한 비교 상태(left: AI 수정안, right: 작성 중 본문)이고,
// rejected는 그대로 두기로 한 변경이다. 반영한 변경은 merge에서 left를 고른 변경이다.
export function createReview(candidate,draft){return {merge:createMergeState(candidate,draft,'right'),rejected:{}};}

const without=(map,id)=>{const next={...map};delete next[id];return next;};
const flip=(merge,id)=>chooseMergeRegion(merge,id,'left');

export function changeStatus(review,id){
 if(choiceOf(review.merge,id)==='left')return 'accepted';
 return review.rejected[id]?'rejected':'pending';
}

// decision: accept(반영), reject(그대로), undo(검토 전으로)
export function decideChange(review,id,decision){
 const status=changeStatus(review,id);
 if(decision==='accept')return status==='accepted'?review:{merge:flip(review.merge,id),rejected:without(review.rejected,id)};
 if(decision==='reject')return {merge:status==='accepted'?flip(review.merge,id):review.merge,rejected:{...review.rejected,[id]:true}};
 if(status==='accepted')return {...review,merge:flip(review.merge,id)};
 return {...review,rejected:without(review.rejected,id)};
}

export function acceptAllChanges(review){return {merge:chooseAllRegions(review.merge,'left'),rejected:{}};}
export function revertAllChanges(review){return {merge:chooseAllRegions(review.merge,'right'),rejected:{}};}

export const reviewCards=review=>changeCards(review.merge);
// 문장 카드 하나의 변경을 모두 반영하고, 이미 모두 반영했으면 모두 되돌린다.
export function toggleSentence(review,ids){
 const rejected={...review.rejected};for(const id of ids)delete rejected[id];
 return {merge:toggleCard(review.merge,ids),rejected};
}

export function reviewCounts(review){
 const ids=review.merge.changes.map(change=>change.id);
 const accepted=ids.filter(id=>changeStatus(review,id)==='accepted').length;
 return {total:ids.length,accepted,pending:ids.filter(id=>changeStatus(review,id)==='pending').length};
}

// 본문에 나오는 순서대로 본 변경 목록.
const order=review=>[...review.merge.ranges].sort((a,b)=>a.start-b.start||a.id-b.id).map(range=>range.id);
export function stepChange(review,id,step){
 const ids=order(review);if(!ids.length)return null;
 const at=ids.indexOf(id);
 return at<0?ids[0]:ids[(at+step+ids.length)%ids.length];
}
// id 다음의 검토 전 변경. 끝에서 처음으로 돌아가며, 남은 변경이 없으면 null이다.
export function nextPendingChange(review,id){
 const ids=order(review),at=ids.indexOf(id);
 for(let k=1;k<=ids.length;k++){const next=ids[(at+k+ids.length)%ids.length];if(changeStatus(review,next)==='pending')return next;}
 return null;
}

// 결과 본문을 그대로인 글과 변경으로 나눈다. text를 이으면 결과 본문이 되고,
// 변경 조각에는 지금 글(current)과 제안 글(proposed)을 함께 담아 검토 전 변경을 나란히 보여 줄 수 있게 한다.
export function reviewSegments(review){
 const {merge}=review,ranges=[...merge.ranges].sort((a,b)=>a.start-b.start||a.id-b.id),out=[];let at=0;
 for(const range of ranges){
  if(range.start>at)out.push({text:merge.text.slice(at,range.start)});
  const change=merge.changes[range.id];
  out.push({id:range.id,status:changeStatus(review,range.id),text:merge.text.slice(Math.max(at,range.start),range.end),
   current:change.right,proposed:change.left,whole:change.whole});
  at=Math.max(at,range.end);
 }
 if(at<merge.text.length)out.push({text:merge.text.slice(at)});
 return out;
}

// 채팅의 수정안 카드에 보이는 요약. 작성 중 본문과 달라진 곳의 수와 글자 수 차이다.
export function changeSummary(candidate,draft){
 return {count:candidate===draft?0:createMergeState(candidate,draft,'right').changes.length,delta:candidate.length-draft.length};
}
