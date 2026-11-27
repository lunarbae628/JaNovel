import {sourceName} from './writing-options.js';

export function overviewGraphQuestion(question){
 const q=structuredClone(question);
 const snapshots=new Map(q.snapshots.map(s=>[s.id,s]));
 const independentParents=(ids,owner)=>ids.length>1?ids:ids.filter(id=>snapshots.get(id)?.branchId===owner);
 for(const s of q.snapshots)s.parentIds=independentParents(s.parentIds,s.branchId);
 for(const b of q.branches)b.draft.baseIds=independentParents(b.draft.baseIds,b.id);
 for(const b of [...q.branches]){
  if(!b.sources?.length)continue;
  const result=q.snapshots.filter(s=>s.branchId===b.id).sort((a,b)=>a.order-b.order)[0];if(!result)continue;
  const parents=[],frozen=new Map();
  b.sources.forEach((source,index)=>{
   const original=q.snapshots.find(s=>'snapshot:'+s.id===source.recordKey&&s.text===source.text&&s.order<result.order);
   if(original){parents.push(original.id);return;}
   const key=source.recordKey+'\0'+source.text;if(frozen.has(key)){parents.push(frozen.get(key));return;}
   let owner=q.branches.find(n=>n.id===source.optionId);
   if(!owner){owner={id:source.optionId,name:source.optionName+' (참고)',color:'#9095A0',order:Math.max(...q.branches.map(n=>n.order))+1,snapshotIds:[],fromIds:[],draft:{text:'',baseIds:[],dirty:false,closed:true,updatedAt:''}};q.branches.push(owner);}
   const id='source:'+result.id+':'+index;frozen.set(key,id);parents.push(id);
   q.snapshots.push({id,branchId:owner.id,label:'참고',title:source.optionName+' · '+sourceName(source),description:'조합할 때의 본문',text:source.text,parentIds:[],createdAt:result.createdAt,order:result.order-.5+index*.001,sourcePreview:source});
  });
  result.parentIds=[...new Set([...result.parentIds,...parents])];
 }
 return q;
}
