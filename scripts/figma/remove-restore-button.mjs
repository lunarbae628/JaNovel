import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from './talk-channel.mjs';
const dir=new URL('../../_workspace/2026-11-08-interactions/',import.meta.url),p=new URL('state.json',dir);
const state=JSON.parse(fs.readFileSync(p,'utf8')),c=await connect(process.argv[2]||'tuh6hpb7');
const walk=n=>[n,...(n.children||[]).flatMap(walk)];
const normalized=s=>(s||'').replace(/\s/gu,'');
const matches=n=>n.type==='INSTANCE'&&!n.id.startsWith('I')&&walk(n).some(t=>t.type==='TEXT'&&normalized(t.characters)==='이기록으로복원');
try{
 const doc=await c.call('get_document_info'),roots=doc.children.filter(n=>n.type==='FRAME'&&!n.name.startsWith('JaNovel'));
 const removed=[],affected=[],deleted=new Set();
 for(const root of roots){const d=await c.call('get_node_info',{nodeId:root.id}),buttons=walk(d).filter(matches);if(!buttons.length)continue;
  for(const b of buttons){for(const n of walk(b))deleted.add(n.id);removed.push(b.id);}
  await c.call('delete_multiple_nodes',{nodeIds:buttons.map(b=>b.id)});affected.push(root.id);
 }
 for(const id of affected){const d=await c.call('get_node_info',{nodeId:id});assert.equal(walk(d).filter(matches).length,0,`Restore button remains in ${id}`);}
 state.routes=state.routes.filter(r=>!deleted.has(r.id));state.expectedButtons=(state.expectedButtons||[]).filter(r=>!deleted.has(r.id));state.restoreActionVisible=false;
 fs.writeFileSync(p,JSON.stringify(state,null,2));
 const receipt={checkedAt:new Date().toISOString(),screenCount:roots.length,affectedScreens:affected.length,removed:removed.length,remaining:0,nodeIds:removed};
 fs.writeFileSync(new URL('remove-restore-verification.json',dir),JSON.stringify(receipt,null,2));
 const img=await c.call('export_node_as_image',{nodeId:'67:2743',scale:1});fs.writeFileSync(new URL('67-2743.png',dir),Buffer.from(img.imageData,'base64'));
 console.log(JSON.stringify({...receipt,nodeIds:undefined}));
}finally{c.close()}
