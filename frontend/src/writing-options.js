import {uid,colors,uniqueBranchName,requireFreeName,resolveRecord,updateDraft,snapshot,recordName} from './model.js';

// auto이면 화면이 정한 이름이라 겹치면 번호를 붙이고, 아니면 사용자가 입력한 이름이라 겹치면 DUPLICATE_VERSION_NAME을 던진다.
export function createWritingOption(question,name='',description='',{auto=false}={}){
 const q=structuredClone(question),order=Math.max(-1,...q.branches.map(b=>b.order))+1,id=uid('branch'),time=new Date().toISOString();
 q.branches.push({id,name:auto||!name.trim()?uniqueBranchName(q,name.trim()||'새 버전'):requireFreeName(q,name),description:description.trim(),color:colors[order%colors.length],order,createdAt:time,snapshotIds:[],fromIds:[],draft:{text:'',baseIds:[],dirty:false,closed:true,updatedAt:time}});
 q.activeBranchId=id;return q;
}
export function renameWritingOption(question,id,name,description=''){
 const q=structuredClone(question),b=q.branches.find(b=>b.id===id);if(!b)throw Error('BRANCH_NOT_FOUND');
 if(name.trim())b.name=requireFreeName(q,name,id);b.description=description.trim();return q;
}
export function editOptionSnapshot(question,id,text){
 const record=resolveRecord(question,id),b=question.branches.find(b=>b.id===record.branchId);
 if(record.text===text)return question;
 if(b.draft.dirty&&b.draft.text!==text)throw Error('DRAFT_CONFLICT');
 return updateDraft(question,b.id,text);
}
export function combineWritingOptions(question,{leftId,rightId,text,name='합친 버전',description=''}){
 if(!text.trim())throw Error('EMPTY_TEXT');
 const sources=[leftId,rightId].map(key=>{const r=resolveRecord(question,key),b=question.branches.find(b=>b.id===r.branchId);return {optionId:b.id,optionName:b.name,recordKey:r.kind+':'+r.id,label:recordName(r),title:r.title,text:r.text};});
 let q=createWritingOption(question,name,description);const id=q.activeBranchId;
 q.branches.at(-1).sources=sources;q=snapshot(updateDraft(q,id,text),id,name,description);
 return {question:q,branchId:id,snapshotId:q.snapshots.at(-1).id};
}
// 조합 출처 이름. 예전에 저장한 출처는 스냅샷에도 v번호가 들어 있어 보여 줄 때 스냅샷 이름으로 바꾼다.
export const sourceName=source=>source.recordKey?.startsWith('snapshot:')?source.title:source.label;
export function optionSources(question,id){
 const b=question.branches.find(b=>b.id===id);if(!b)return [];
 return b.sources||b.fromIds.map(key=>{const r=resolveRecord(question,key),source=question.branches.find(n=>n.id===r.branchId);return {optionId:source.id,optionName:source.name,recordKey:'snapshot:'+r.id,label:recordName(r),title:r.title,text:r.text};});
}
