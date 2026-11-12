import fs from 'node:fs';
import {connect} from './talk-channel.mjs';
const dir=new URL('../../_workspace/2026-11-08-interactions/',import.meta.url);
const statePath=new URL('state.json',dir),state=JSON.parse(fs.readFileSync(statePath,'utf8'));
const c=await connect(process.argv[2]||'yb890ctk');
const walk=n=>[n,...(n.children||[]).flatMap(walk)];
const label=n=>walk(n).filter(x=>x.type==='TEXT').map(x=>x.characters||'').filter(Boolean).join(' ');
const outer=n=>walk(n).filter(x=>x.type==='INSTANCE'&&!x.id.startsWith('I'));
const info=nodeId=>c.call('get_node_info',{nodeId});
const save=()=>fs.writeFileSync(statePath,JSON.stringify(state,null,2));
const rgb=h=>({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255});
const size=(nodeId,width,height)=>c.call('resize_node',{nodeId,width,height});
const set=(nodeId,text)=>c.call('set_text_content',{nodeId,text});
const fill=(nodeId,h)=>c.call('set_fill_color',{nodeId,...rgb(h)});
async function clone(src,parent){const n=await c.call('clone_node',{nodeId:src});await c.call('set_parent',{nodeId:n.id,parentId:parent});return n;}
function route(id,to,mode='NAVIGATE'){state.routes=state.routes.filter(r=>r.id!==id);state.routes.push({id,to,mode});save();}
async function button(parent,text,width,to,mode='NAVIGATE'){
 const n=await clone('4:187',parent),d=await info(n.id);await set(walk(d).find(x=>x.type==='TEXT').id,text);await size(n.id,width,36);await c.call('rename_node',{nodeId:n.id,name:text});route(n.id,to,mode);return n;
}
try{
 state.nodeNavigation??={readByMenu:{},bodyActions:{},completed:[]};
 const nav=state.nodeNavigation;
 const menus=[...['v3','v3A','v4'].map(v=>state.screens['노드 메뉴 · '+v]),...Object.values(state.historicalMenus),...Object.values(state.q2Menus),state.q2Menu.id];
 for(const id of [...new Set(menus)]){
  const d=await info(id),readButton=outer(d).find(n=>label(n)==='본문 보기');
  const dest=state.routes.find(r=>r.id===readButton.id)?.to;if(!dest)throw Error('Read route missing '+id);
  nav.readByMenu[id]=dest;
  if(nav.completed.includes(dest))continue;
  const title=d.children.find(n=>n.type==='TEXT')?.characters||walk(d).find(n=>n.type==='TEXT')?.characters;
  const source=await info(dest),body=walk(source).find(n=>n.name==='작성 본문'),toolbar=walk(source).find(n=>n.name==='문항·작성 도구');
  if(!body||!toolbar)throw Error('Read layout missing '+dest);
  for(const t of toolbar.children.filter(n=>n.type==='TEXT'&&n.characters?.includes('읽기 전용')))await c.call('delete_node',{nodeId:t.id});
  const back=outer(toolbar).find(n=>label(n)==='작성으로 돌아가기');if(back){await set(walk(back).find(n=>n.type==='TEXT').id,'← 작성');await size(back.id,82,36);}
  if(!back&&!outer(toolbar).some(n=>label(n)==='← 작성'))await button(toolbar.id,'← 작성',82,source.name.includes('Q2')?'42:2327':'5:530');
  await c.call('set_item_spacing',{nodeId:body.id,itemSpacing:20});
  const width=body.absoluteBoundingBox.width-80;
  let row=body.children.find(n=>n.name==='선택한 기록과 작업');
  if(!row){row=await c.call('create_frame',{parentId:body.id,name:'선택한 기록과 작업',width,height:36,layoutMode:'HORIZONTAL',fillColor:rgb('#FFFFFF'),itemSpacing:8,counterAxisAlignItems:'CENTER'});await c.call('set_parent',{nodeId:row.id,parentId:body.id,index:0});
   const t=await clone('5:539',row.id);await set(t.id,title+' · 읽기 전용');await size(t.id,Math.min(350,width-280),22);
   await c.call('create_frame',{parentId:row.id,name:'여백',width:Math.max(8,width-Math.min(350,width-280)-248),height:1,layoutMode:'NONE',fillColor:rgb('#FFFFFF')});
   nav.bodyActions[dest]={};
   for(const [old,name,w] of [['비교하기','비교',64],['병합하기','병합',64],['여기서 분기하기','분기',72]]){
    const b=outer(d).find(n=>label(n)===old),r=state.routes.find(r=>r.id===b?.id);if(!r)throw Error('Action route missing '+old);
    const n=await button(row.id,name,w,r.to,['OVERLAY','SWAP'].includes(r.mode)?'OVERLAY':r.mode);nav.bodyActions[dest][name]=n.id;
   }
  }
  // The chosen snapshot, rather than the working draft, is highlighted while reading.
  const key=(title||'').split(' · ')[0];
  const graph=walk(source).find(n=>n.name==='버전 그래프');
  if(graph)for(const b of outer(graph)){
   const text=walk(b).find(n=>n.type==='TEXT'),shown=(text?.characters||'').split(' · ')[0],selected=shown===key;
   await fill(b.id,selected?'#EDF1FA':'#F7F7F8');if(text)await fill(text.id,selected?'#274690':shown==='작성 중'?'#727272':'#302B27');
  }
  nav.completed.push(dest);save();
 }
 // Remap every graph entry to the existing read screen. A selected node stays selected.
 for(const r of state.routes){const read=nav.readByMenu[r.to];if(read){r.to=read;r.mode='NAVIGATE';}}
 nav.direct=true;save();
 console.log(JSON.stringify({readScreens:nav.completed.length,menusBypassed:Object.keys(nav.readByMenu).length,actions:Object.keys(nav.bodyActions).length}));
}finally{save();c.close();}
