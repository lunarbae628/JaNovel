// Read-only review: inspect current Figma data, not the last generated routing table.
import fs from 'node:fs';
import {connect} from './talk-channel.mjs';
const dir=new URL('../../_workspace/2026-11-09-design-review/',import.meta.url);fs.mkdirSync(dir,{recursive:true});
const c=await connect(process.argv[2]||'tuh6hpb7');
const walk=n=>[n,...(n.children||[]).flatMap(walk)];
const label=n=>walk(n).filter(x=>x.type==='TEXT').map(x=>x.characters||'').filter(Boolean).join(' ');
try{
 const doc=await c.call('get_document_info'),roots=doc.children.filter(x=>x.type==='FRAME'&&!x.name.startsWith('JaNovel')),trees=[],actual=[];
 for(const r of roots)trees.push(await c.call('get_node_info',{nodeId:r.id}));
 for(let i=0;i<roots.length;i+=20)actual.push(...await c.call('janovel_inspect_reactions',{nodeIds:roots.slice(i,i+20).map(r=>r.id)}));
 fs.writeFileSync(new URL('trees.json',dir),JSON.stringify(trees));fs.writeFileSync(new URL('reactions.json',dir),JSON.stringify(actual));
 const flat=trees.flatMap(walk),byId=new Map(flat.map(n=>[n.id,n])),rootOf=new Map(trees.flatMap(r=>walk(r).map(n=>[n.id,r.id]))),re=new Map(actual.flatMap(r=>r.controls).map(n=>[n.id,n.reactions]));
 const control=(root,text)=>walk(byId.get(root)).findLast(n=>n.type==='INSTANCE'&&!n.id.startsWith('I')&&label(n)===text);
 const action=id=>re.get(id)?.find(x=>x.trigger?.type==='ON_CLICK')?.actions?.[0];
 const clicks=actual.flatMap(r=>r.controls).filter(n=>re.get(n.id)?.some(r=>r.trigger?.type==='ON_CLICK'));
 const dangling=clicks.flatMap(n=>re.get(n.id).flatMap(r=>(r.actions||[]).filter(a=>a.type==='NODE'&&['NAVIGATE','OVERLAY','SWAP'].includes(a.navigation)&&!byId.has(a.destinationId)).map(a=>({source:n.id,to:a.destinationId}))));
 const trace=(root,text)=>{const n=control(root,text),a=n&&action(n.id),target=a?.destinationId&&byId.get(a.destinationId);return{sourceRoot:root,label:text,control:n?.id,action:a,destination:target&&{id:target.id,name:target.name,texts:walk(target).filter(x=>x.type==='TEXT'&&x.characters).map(x=>x.characters).slice(0,14)}};};
 const cases={q2AiCompare:trace('42:2327','수정안 비교 →'),otherCompanyEditor:trace('67:18270','자소서 작성 →'),submittedQ1:trace('42:1365','v4 · 병합  ⌄'),submittedQ2:trace('42:1365','v2 · 해결 과정 구체화  ⌄'),scheduleDelete:trace('42:2063','일정 삭제'),snapshotConfirm:trace('5:912','확인')};
 const obsoleteLabels=flat.filter(n=>n.type==='TEXT'&&n.characters?.replace(/\s/g,'')==='이기록으로복원').map(n=>({id:n.id,root:rootOf.get(n.id)}));
 const headerLabels=[];for(const r of trees)for(const table of walk(r).filter(n=>n.name==='회사별 지원 목록'))for(const row of table.children||[])if(['회사','직무','다음 일정','진행 단계'].every(v=>walk(row).some(n=>n.type==='TEXT'&&n.characters===v)))headerLabels.push({root:r.id,row:row.id});
 const fonts=[...new Set(flat.filter(n=>n.type==='TEXT'&&n.characters).map(n=>n.style?.fontFamily))];
 const outside=[];for(const r of trees){const b=r.absoluteBoundingBox;for(const t of walk(r).filter(n=>n.type==='TEXT'&&n.characters)){const a=t.absoluteBoundingBox;if(a&&(a.x<b.x-2||a.y<b.y-2||a.x+a.width>b.x+b.width+2||a.y+a.height>b.y+b.height+2))outside.push({root:r.id,node:t.id,text:t.characters.slice(0,60),bounds:a});}}
 const result={checkedAt:new Date().toISOString(),screens:trees.length,clickableNodes:clicks.length,dangling,obsoleteLabels,headerLabels,fonts,outside,cases};
 fs.writeFileSync(new URL('audit.json',dir),JSON.stringify(result,null,2));
 console.log(JSON.stringify({...result,outside:outside.slice(0,8)},null,2));
}finally{c.close()}
