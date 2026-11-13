import {resolveRecord,defaultRecordKey} from './model.js';
export function comparisonSearch(search,reference,target){const params=new URLSearchParams(search);params.set('record',reference);params.set('target',target);params.set('compare','1');return params.toString();}
export function optionView(q,params){
 const read=key=>{try{return key?resolveRecord(q,key):null}catch{return null}};
 const reference=read(params.get('record')),comparing=params.get('compare')==='1',target=comparing?read(params.get('target')):null;
 const branchId=target?.branchId||reference?.branchId||q.branches.find(b=>b.id===q.activeBranchId)?.id||q.branches[0].id;
 return {branchId,key:reference?params.get('record'):defaultRecordKey(q,branchId),target:target?params.get('target'):'draft:'+branchId,comparing};
}
