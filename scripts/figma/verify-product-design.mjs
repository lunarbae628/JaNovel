// Independent readback checks: compare actual rendered content and native reactions.
import fs from 'node:fs';import assert from 'node:assert/strict';import {connect} from './talk-channel.mjs';
const base=new URL('../../_workspace/',import.meta.url),dir=new URL('2026-11-09-product-design/',base),s=JSON.parse(fs.readFileSync(new URL('2026-11-08-interactions/state.json',base))),p=s.productCorrections,c=await connect(process.argv[2]);
const walk=n=>[n,...(n.children||[]).flatMap(walk)],label=n=>walk(n).filter(x=>x.type==='TEXT').map(x=>x.characters||'').filter(Boolean).join(' '),find=(n,name)=>walk(n).find(x=>x.name===name);
const trees=[],native=[],cache=new Map(),info=async id=>{if(!cache.has(id)){const n=await c.call('get_node_info',{nodeId:id});cache.set(id,n);trees.push(n);}return cache.get(id);};
const normal=s=>s.replace(/\s/gu,'');let checks=0;
try{
 const doc=await c.call('get_document_info');
 const ids=new Set([...Object.keys(p.panels),...Object.values(p.scenes).map(n=>n.id),...Object.keys(s.workingCompare.targets),'42:1365','42:1411','42:2327','5:530','67:18270','67:18337','67:18404',...Object.values(s.merges).flatMap(x=>Object.values(x))]);
 for(const id of ids)await info(id);
 for(let i=0;i<[...ids].length;i+=20)native.push(...await c.call('janovel_inspect_reactions',{nodeIds:[...ids].slice(i,i+20)}));
 const reactions=new Map(native.flatMap(r=>r.controls).map(n=>[n.id,n.reactions]));
 function destination(id){const action=reactions.get(id)?.find(r=>r.trigger?.type==='ON_CLICK')?.actions?.[0];assert(action,'Missing click '+id);return action.destinationId;}
 const button=(d,name)=>walk(d).findLast(n=>n.type==='INSTANCE'&&label(n)===name);
 for(const [company,roots]of Object.entries(p.companyWriters)){
  const detail=await info(s.companyDetails[company]);assert.equal(destination(button(detail,'자소서 작성 →').id),roots.q1);
  for(const [q,id]of Object.entries(roots)){const d=await info(id),header=find(d,'회사와 직무');assert(label(header).includes(company));assert(!label(d).includes('모노랩'),company+' contains another company');assert(label(d).includes(q==='q1'?s.workingCompare.drafts.Q1.question:s.workingCompare.drafts.Q2.question));checks++;}
 }
 const q2Source=await info('42:2327'),candidate=await info(destination(button(q2Source,'수정안 비교 →').id));assert(label(candidate).includes(s.workingCompare.drafts.Q2.question));assert(!label(candidate).includes(s.workingCompare.drafts.Q1.question));checks++;
 for(const item of Object.values(p.submission))for(const id of [item.select,item.frozen]){
  const d=await info(id),text=label(d),a=s.workingCompare.items.find(x=>x.q==='Q1'&&x.key===item.a.replace('A','-A')),b=s.workingCompare.items.find(x=>x.q==='Q2'&&x.key===item.b);
  assert(text.includes(a.text),'Q1 submission text '+id);assert(text.includes(b.text),'Q2 submission text '+id);
  if(id===item.select)assert.equal(destination(button(d,'선택한 버전 고정').id),item.frozen);checks++;
 }
 for(const record of Object.values(p.records)){
  const dialog=await info(record.dialog),confirm=button(dialog,'확인')||button(dialog,'스냅샷');assert.equal(destination(confirm.id),record.result);
  for(const [target,id]of Object.entries(record.views)){
   const d=await info(id),columns=find(d,'비교 본문'),left=find(columns,'본문 / left'),right=find(columns,'본문 / right');
   assert.equal(label(left),record.text,'Saved record text changed '+id);
   const expected=target==='workspace'?s.workingCompare.drafts[record.q].text:s.workingCompare.items.find(x=>x.id===target).text;
   assert.equal(label(right),expected,'Comparison target changed '+id);checks++;
  }
  for(const id of record.mergeSources||[]){const d=await info(id),mid=walk(d).find(n=>n.type==='FRAME'&&n.name==='병합 결과 · 직접 수정');assert.equal(normal(label(mid).replace('병합 결과 · 직접 수정','')),normal(record.text),'Merge result lost '+id);assert.equal(destination(button(d,'병합 스냅샷').id),record.dialog);checks++;}
 }
 for(const [id,meta]of Object.entries(s.workingCompare.targets)){
  const d=await info(id),body=find(d,'비교 본문'),left=s.workingCompare.items.find(x=>x.id===meta.left),right=meta.workspace?s.workingCompare.drafts[left.q]:s.workingCompare.items.find(x=>x.id===meta.right);
  assert.equal(label(find(body,'본문 / left')),left.text);assert.equal(label(find(body,'본문 / right')),right.text);checks++;
 }
 const panelIds=[],setReactions=new Map();
 for(const [root,panels]of Object.entries(p.panels))for(const [side,meta]of Object.entries(panels)){
  const folded=await info(meta.foldedId),expanded=await info(meta.expandedId);assert.equal(folded.absoluteBoundingBox.width,40);assert.equal(folded.children.length,1);assert.equal(walk(folded).filter(n=>n.type==='TEXT').length,0,'Collapsed panel has text');
  if(!setReactions.has(meta.setId))setReactions.set(meta.setId,(await c.call('janovel_inspect_reactions',{nodeIds:[meta.setId]}))[0].controls);const controls=setReactions.get(meta.setId);
  for(const [id,to]of [[meta.expandedToggle,meta.foldedId],[meta.foldedToggle,meta.expandedId]]){const action=controls.find(n=>n.id===id).reactions.find(r=>r.trigger.type==='ON_CLICK').actions[0];assert.equal(action.navigation,'CHANGE_TO');assert.equal(action.destinationId,to);}
  assert(expanded.absoluteBoundingBox.width>=200);panelIds.push(meta.instanceId);checks++;
 }
 const fonts=[...new Set(trees.flatMap(walk).filter(n=>n.type==='TEXT'&&n.characters).map(n=>n.style?.fontFamily))];assert.deepEqual(fonts,['Noto Sans KR']);
 for(const wide of Object.values(p.widePanels||{}).filter(x=>x.wideId)){
  const d=await info(wide.wideId),graph=find(d,'버전 그래프'),nodes=graph.children.filter(n=>n.type==='ELLIPSE');assert.equal(d.absoluteBoundingBox.width,400);
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i].absoluteBoundingBox,b=nodes[j].absoluteBoundingBox;assert(Math.abs(a.x-b.x)>10||Math.abs(a.y-b.y)>10,'Overlapping graph nodes '+nodes[i].id+' '+nodes[j].id);}checks++;
 }
 const result={checkedAt:new Date().toISOString(),passed:checks,companyWorkspaces:6,submittedCombinations:6,recordResults:Object.keys(p.records).length,comparisons:Object.keys(s.workingCompare.targets).length,interactivePanels:panelIds.length,fonts,limitations:['finite Figma fixtures; no live typing, storage or AI integration','pointer checks cover representative flows, not every combination','cloud synchronization must be confirmed in Figma']};
 fs.writeFileSync(new URL('trees-after.json',dir),JSON.stringify(trees));fs.writeFileSync(new URL('reactions-after.json',dir),JSON.stringify(native));fs.writeFileSync(new URL('verification.json',dir),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{c.close()}
