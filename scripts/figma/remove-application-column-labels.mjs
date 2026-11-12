import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from './talk-channel.mjs';
const dir=new URL('../../_workspace/2026-11-08-interactions/',import.meta.url),p=new URL('state.json',dir);
const state=JSON.parse(fs.readFileSync(p)),c=await connect(process.argv[2]||'tuh6hpb7');
const walk=n=>[n,...(n.children||[]).flatMap(walk)];
const text=n=>walk(n).filter(x=>x.type==='TEXT').map(x=>x.characters||'').filter(Boolean);
const headings=['회사','직무','다음 일정','진행 단계'];
const isHeading=n=>headings.every(value=>text(n).includes(value));
try{
 const doc=await c.call('get_document_info'),changed=[],deleted=new Set();
 for(const root of doc.children.filter(n=>n.type==='FRAME'&&!n.name.startsWith('JaNovel'))){
  const d=await c.call('get_node_info',{nodeId:root.id}),tables=walk(d).filter(n=>n.name==='회사별 지원 목록');
  for(const table of tables){const header=table.children.find(isHeading);if(!header)continue;
   const index=table.children.findIndex(n=>n.id===header.id),next=table.children[index+1],remove=[header,...(next?.name==='구분선'?[next]:[])];
   const keep=table.children.filter(n=>!remove.some(x=>x.id===n.id)),before=keep.flatMap(text);
   for(const n of remove)for(const x of walk(n))deleted.add(x.id);
   await c.call('delete_multiple_nodes',{nodeIds:remove.map(n=>n.id)});
   const after=await c.call('get_node_info',{nodeId:table.id});assert(!after.children.some(isHeading));assert.deepEqual(after.children.flatMap(text),before,'Application data changed');
   changed.push({root:root.id,table:table.id,labelsRemoved:headings,retainedRows:after.children.filter(n=>n.name==='회사 헤더').length});
  }
 }
 state.routes=state.routes.filter(r=>!deleted.has(r.id));state.expectedButtons=(state.expectedButtons||[]).filter(r=>!deleted.has(r.id));state.applicationColumnLabelsVisible=false;
 fs.writeFileSync(p,JSON.stringify(state,null,2));
 fs.writeFileSync(new URL('remove-application-labels-verification.json',dir),JSON.stringify({checkedAt:new Date().toISOString(),changed,dataPreserved:true},null,2));
 const image=await c.call('export_node_as_image',{nodeId:'41:345',scale:1});fs.writeFileSync(new URL('41-345.png',dir),Buffer.from(image.imageData,'base64'));
 console.log(JSON.stringify({screensChanged:changed.length,dataPreserved:true,rows:changed.map(x=>x.retainedRows)}));
}finally{c.close()}
