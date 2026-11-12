import {updateDraft} from './model.js';

export function canDeleteSnapshot(q,id){
 const s=q.snapshots.find(s=>s.id===id);if(!s)return false;
 const own=q.branches.find(b=>b.id===s.branchId);
 return own?.snapshotIds.at(-1)===id&&!q.snapshots.some(s=>s.parentIds.includes(id))&&!q.branches.some(b=>b.id!==s.branchId&&(b.fromIds.includes(id)||b.draft.baseIds.includes(id)));
}
export function deleteSnapshot(question,id){
 if(!canDeleteSnapshot(question,id))throw Error('SNAPSHOT_IN_USE');
 const q=structuredClone(question),s=q.snapshots.find(s=>s.id===id),b=q.branches.find(b=>b.id===s.branchId);
 q.snapshots=q.snapshots.filter(s=>s.id!==id);b.snapshotIds=b.snapshotIds.filter(s=>s!==id);
 b.draft.baseIds=[...new Set(b.draft.baseIds.flatMap(parent=>parent===id?s.parentIds:[parent]))];
 const next=updateDraft(q,b.id,b.draft.text);next.branches.find(n=>n.id===b.id).draft.closed=!!b.draft.closed;return next;
}
export function deleteBranch(question,id){
 if(!question.branches.some(b=>b.id===id))throw Error('BRANCH_NOT_FOUND');
 if(question.branches.length===1)throw Error('LAST_BRANCH');
 const q=structuredClone(question),removed=new Map(q.snapshots.filter(s=>s.branchId===id).map(s=>[s.id,s]));
 const reconnect=ids=>{
  const pending=[...ids].reverse(),visited=new Set(),parents=new Set();
  while(pending.length){const id=pending.pop();if(visited.has(id))continue;visited.add(id);if(removed.has(id))pending.push(...[...removed.get(id).parentIds].reverse());else parents.add(id);}
  return [...parents];
 };
 q.snapshots=q.snapshots.filter(s=>s.branchId!==id);q.branches=q.branches.filter(b=>b.id!==id);
 for(const s of q.snapshots)s.parentIds=reconnect(s.parentIds);
 for(const b of q.branches){
  b.fromIds=reconnect(b.fromIds);if(removed.has(b.autoFromId))delete b.autoFromId;const previous=b.draft.baseIds;b.draft.baseIds=reconnect(previous);
  if(previous.some(parent=>removed.has(parent)))b.draft.dirty=b.draft.dirty||b.draft.baseIds.length!==1||b.draft.text!==q.snapshots.find(s=>s.id===b.draft.baseIds[0])?.text;
 }
 if(q.activeBranchId===id)q.activeBranchId=q.branches[0].id;
 return q;
}
