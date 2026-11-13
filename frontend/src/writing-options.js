import {uid,colors,uniqueBranchName,resolveRecord,updateDraft,snapshot} from './model.js';

export function createWritingOption(question,name='',description=''){
 const q=structuredClone(question),order=Math.max(-1,...q.branches.map(b=>b.order))+1,id=uid('branch'),time=new Date().toISOString();
 q.branches.push({id,name:uniqueBranchName(q,name||'새 작성안'),description:description.trim(),color:colors[order%colors.length],order,createdAt:time,snapshotIds:[],fromIds:[],draft:{text:'',baseIds:[],dirty:false,closed:true,updatedAt:time}});
 q.activeBranchId=id;return q;
}
export function renameWritingOption(question,id,name,description=''){
 const q=structuredClone(question),b=q.branches.find(b=>b.id===id);if(!b)throw Error('BRANCH_NOT_FOUND');
 b.name=uniqueBranchName({...q,branches:q.branches.filter(n=>n.id!==id)},name||b.name);b.description=description.trim();return q;
}
export function editOptionSnapshot(question,id,text){
 const record=resolveRecord(question,id),b=question.branches.find(b=>b.id===record.branchId);
 if(record.text===text)return question;
 if(b.draft.dirty&&b.draft.text!==text)throw Error('DRAFT_CONFLICT');
 return updateDraft(question,b.id,text);
}
export function combineWritingOptions(question,{leftId,rightId,text,name='합친 작성안',description=''}){
 if(!text.trim())throw Error('EMPTY_TEXT');
 const sources=[leftId,rightId].map(key=>{const r=resolveRecord(question,key),b=question.branches.find(b=>b.id===r.branchId);return {optionId:b.id,optionName:b.name,recordKey:r.kind+':'+r.id,label:r.label,title:r.title,text:r.text};});
 let q=createWritingOption(question,name,description);const id=q.activeBranchId;
 q.branches.at(-1).sources=sources;q=snapshot(updateDraft(q,id,text),id,name,description);
 return {question:q,branchId:id,snapshotId:q.snapshots.at(-1).id};
}
export function optionSources(question,id){
 const b=question.branches.find(b=>b.id===id);if(!b)return [];
 return b.sources||b.fromIds.map(key=>{const r=resolveRecord(question,key),source=question.branches.find(n=>n.id===r.branchId);return {optionId:source.id,optionName:source.name,recordKey:'snapshot:'+r.id,label:r.label,title:r.title,text:r.text};});
}
