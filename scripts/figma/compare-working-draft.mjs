// Figma prototype: a selected snapshot stays on the left; the right target may be the working draft.
import fs from 'node:fs';
import {connect} from './talk-channel.mjs';
const dir=new URL('../../_workspace/2026-11-08-interactions/',import.meta.url),statePath=new URL('state.json',dir);
const state=JSON.parse(fs.readFileSync(statePath,'utf8')),c=await connect(process.argv[2]||'tuh6hpb7');
const save=()=>fs.writeFileSync(statePath,JSON.stringify(state,null,2));
const walk=n=>[n,...(n.children||[]).flatMap(walk)];
const label=n=>walk(n).filter(x=>x.type==='TEXT').map(x=>x.characters||'').filter(Boolean).join(' ');
const outer=n=>walk(n).filter(x=>x.type==='INSTANCE'&&!x.id.startsWith('I'));
const rgb=h=>({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255});
const info=nodeId=>c.call('get_node_info',{nodeId});
const size=(nodeId,width,height)=>c.call('resize_node',{nodeId,width,height});
const set=(nodeId,text)=>c.call('set_text_content',{nodeId,text});
function route(id,to,mode='NAVIGATE'){state.routes=state.routes.filter(r=>r.id!==id);state.routes.push({id,to,mode});save();}
async function frame(parentId,name,width,height,layoutMode='VERTICAL',extra={}){return c.call('create_frame',{...(parentId?{parentId}:{}),name,width,height,x:0,y:0,layoutMode,fillColor:rgb('#FFFFFF'),paddingLeft:0,paddingRight:0,paddingTop:0,paddingBottom:0,itemSpacing:0,...extra});}
async function clone(nodeId,parentId){const n=await c.call('clone_node',{nodeId});if(parentId)await c.call('set_parent',{nodeId:n.id,parentId});return n;}
async function text(parent,value,width,height=26,kind='compact'){
 const n=await clone({compact:'5:629',caption:'5:540',label:'5:539'}[kind],parent);await set(n.id,value);await size(n.id,width,height);await c.call('rename_node',{nodeId:n.id,name:value.slice(0,50)});return n;
}
async function button(parent,value,width,to,mode='NAVIGATE'){
 const n=await clone('4:187',parent),d=await info(n.id);await set(walk(d).find(n=>n.type==='TEXT').id,value);await size(n.id,width,36);await c.call('rename_node',{nodeId:n.id,name:value});if(to)route(n.id,to,mode);return n;
}
function changes(a,b){
 const A=a.match(/\s+|[^\s]+/gu)||[],B=b.match(/\s+|[^\s]+/gu)||[];
 const dp=Array.from({length:A.length+1},()=>new Uint16Array(B.length+1));
 for(let i=A.length-1;i>=0;i--)for(let j=B.length-1;j>=0;j--)dp[i][j]=A[i]===B[j]?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
 const left=[],right=[];let i=0,j=0;
 while(i<A.length||j<B.length){if(i<A.length&&j<B.length&&A[i]===B[j]){left.push({text:A[i],hit:false});right.push({text:B[j],hit:false});i++;j++;}else if(i<A.length&&(j===B.length||dp[i+1][j]>=dp[i][j+1]))left.push({text:A[i++],hit:true});else right.push({text:B[j++],hit:true});}
 return{left,right};
}
const measure=s=>[...s].reduce((w,ch)=>w+(/\s/u.test(ch)?3.6:/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF\u3000-\u9FFF]/u.test(ch)?13.6:7.7),0);
function lines(parts,width){
 const result=[];let row=[],used=0;
 function flush(){if(row.length){result.push(row);row=[];used=0;}}
 for(const part of parts){
  if(part.text.includes('\n')){flush();if(!result.at(-1)?.blank)result.push({blank:true});continue;}
  let str=part.text;if(!row.length&&/^\s+$/.test(str))continue;
  const pad=part.hit&&!/^\s+$/.test(str)?4:0;
  if(used+measure(str)+pad>width&&row.length)flush();
  if(!row.length&&/^\s+$/.test(str))continue;
  if(measure(str)+pad>width){for(const ch of str){if(used+measure(ch)+4>width)flush();row.push({text:ch,hit:part.hit});used+=measure(ch)+4;}continue;}
  const last=row.at(-1);if(last&&last.hit===part.hit){last.text+=str;used+=measure(str);}else{row.push({text:str,hit:part.hit});used+=measure(str)+pad;}
 }
 flush();return result;
}
async function renderText(parent,parts,width,height,side){
 const stack=await frame(parent,'본문 / '+side,width,height,'VERTICAL',{itemSpacing:3});
 for(const segments of lines(parts,width)){
  if(segments.blank){await frame(stack.id,'문단 간격',width,12,'NONE');continue;}
  const row=await frame(stack.id,'본문 줄',width,26,'HORIZONTAL');
  for(const seg of segments){
   const highlighted=seg.hit&&seg.text.trim().length,w=Math.ceil(measure(seg.text))+(highlighted?4:1);
   if(highlighted){const hit=await frame(row.id,'변경 구절',w,26,'HORIZONTAL',{paddingLeft:2,paddingRight:2,fillColor:rgb(side==='left'?'#F0F1F4':'#DCE4F6')});await text(hit.id,seg.text,w-4);}
   else await text(row.id,seg.text,w);
  }
 }
 return stack;
}
async function newRoot(source,name,index){
 const n=await frame(null,name,1440,900,'VERTICAL',{strokeColor:rgb('#E6E6E6'),strokeWeight:1});
 await c.call('move_node',{nodeId:n.id,x:10400+(index%3)*1540,y:100+Math.floor(index/3)*1040});
 const d=await info(source);for(const child of d.children||[])await clone(child.id,n.id);
 state.screens[name]=n.id;save();return n.id;
}
async function dataFor(id){
 const d=await info(id),essay=walk(d).find(n=>n.name==='자소서');if(!essay)throw Error('Essay missing '+id);
 const e=await info(essay.id),paragraphs=e.children.filter(n=>n.type==='TEXT').map(n=>n.characters||'').filter(Boolean);
 const question=walk(e).find(n=>n.type==='TEXT'&&n.characters?.includes('작성해 주세요.'))?.characters||walk(e).find(n=>n.type==='TEXT'&&n.characters?.includes('설명해 주세요.'))?.characters;
 return{d,text:paragraphs.join('\n\n'),question};
}
async function render(root,left,right){
 const d=await info(root),center=walk(d).find(n=>n.name==='작성·비교'),toolbar=walk(d).find(n=>n.name==='문항·작성 도구');
 const old=center.children.find(n=>n.name==='작성 본문'||n.name==='두 스냅샷 비교');if(!old)throw Error('Body missing '+root);
 const w=center.absoluteBoundingBox.width,h=old.absoluteBoundingBox.height;
 const body=await frame(center.id,'두 스냅샷 비교',w,h,'VERTICAL',{paddingLeft:32,paddingRight:32,paddingTop:24,paddingBottom:24,itemSpacing:16});
 const width=w-64,col=(width-25)/2;
 const heading=await clone('5:609',body.id),hd=await info(heading.id),ts=walk(hd).filter(n=>n.type==='TEXT');
 await set(ts[0].id,left.question);await set(ts[1].id,`${left.text.length} → ${right.text.length}자`);await size(heading.id,width,40);
 const heads=await frame(body.id,'기록과 비교 대상',width,36,'HORIZONTAL',{itemSpacing:12});
 const leftHead=await frame(heads.id,'왼쪽 / 선택한 기록',col,36,'HORIZONTAL',{counterAxisAlignItems:'CENTER'});await text(leftHead.id,left.title,col,22,'label');
 await frame(heads.id,'열 간격',1,36,'NONE');
 const rightHead=await frame(heads.id,'오른쪽 / 비교 대상',col,36,'HORIZONTAL',{itemSpacing:8,counterAxisAlignItems:'CENTER'});await text(rightHead.id,'비교 대상',55,20,'caption');
 const selectBox=await frame(rightHead.id,'비교 대상 선택',col-63,36,'HORIZONTAL',{strokeColor:rgb('#D8D8DC'),strokeWeight:1});
 const choose=await button(selectBox.id,right.title+'  ⌄',col-63,state.workingCompare.pickers[left.id],'OVERLAY');
 const content=await frame(body.id,'비교 본문',width,h-48-40-16-36-16,'HORIZONTAL',{itemSpacing:12});
 const diff=changes(left.text,right.text),textHeight=content.height||h-156;
 await renderText(content.id,diff.left,col,textHeight,'left');await frame(content.id,'열 구분선',1,textHeight,'NONE',{fillColor:rgb('#E6E6E6')});await renderText(content.id,diff.right,col,textHeight,'right');
 await c.call('delete_node',{nodeId:old.id});
 // Keep the selected record's actions in the toolbar while comparing, including with a draft.
 for(const [name,target,mode] of [['병합',left.merge.to,['OVERLAY','SWAP'].includes(left.merge.mode)?'OVERLAY':left.merge.mode],['분기',left.branch.to,'NAVIGATE']]){
  let b=outer(toolbar).find(n=>label(n)===name);if(b)route(b.id,target,mode);else b=await button(toolbar.id,name,64,target,mode);
 }
 const sourceInfo=await info(root),graph=walk(sourceInfo).find(n=>n.name==='버전 그래프');if(graph)for(const b of outer(await info(graph.id))){
  const t=walk(b).find(n=>n.type==='TEXT'),shown=t?.characters?.split(' · ')[0],selected=shown===left.key;
  await c.call('set_fill_color',{nodeId:b.id,...rgb(selected?'#EDF1FA':'#F7F7F8')});if(t)await c.call('set_fill_color',{nodeId:t.id,...rgb(selected?'#274690':shown==='작성 중'?'#727272':'#302B27')});
 }
 state.workingCompare.targets[root]={button:choose.id,left:left.id,right:right.id,workspace:right.id==='workspace',snapshotCreated:false};save();
}
try{
 state.workingCompare??={items:[],drafts:{},views:{},pickers:{},built:[],targets:{}};const st=state.workingCompare;
 if(!st.items.length){
  for(const id of state.nodeNavigation.completed){
   const {d,text:content,question}=await dataFor(id),row=walk(d).find(n=>n.name==='선택한 기록과 작업'),rawTitle=row.children.find(n=>n.type==='TEXT').characters.replace(' · 읽기 전용',''),title=rawTitle.startsWith('Q2 ·')?'v2 · 해결 과정 구체화':rawTitle,q=d.name.includes('Q2')?'Q2':'Q1';
   const actions=state.nodeNavigation.bodyActions[id];st.items.push({id,key:title.split(' · ')[0],title,q,text:content,question,merge:state.routes.find(r=>r.id===actions['병합']),branch:state.routes.find(r=>r.id===actions['분기'])});
  }
  for(const [q,id] of [['Q1','5:530'],['Q2','42:2327']]){const d=await dataFor(id);st.drafts[q]={id:'workspace',title:'작성 중',q,text:d.text,question:d.question};}
  save();
 }
 const unique=q=>[...new Map(st.items.filter(x=>x.q===q&&x.id!==state.q2Read).map(x=>[x.key,x])).values()];
 // Register the frames before adding links so every picker has a concrete destination.
 for(const left of st.items){
  if(!st.pickers[left.id]){const count=unique(left.q).filter(x=>x.key!==left.key).length+1,p=await frame(null,'비교 대상 / '+left.q+' '+left.key,340,94+count*40,'VERTICAL',{paddingLeft:16,paddingRight:16,paddingTop:16,paddingBottom:16,itemSpacing:4,strokeColor:rgb('#E6E6E6'),strokeWeight:1});await c.call('move_node',{nodeId:p.id,x:15000,y:100+Object.keys(st.pickers).length*500});st.pickers[left.id]=p.id;save();}
  const options=[st.drafts[left.q],...unique(left.q).filter(x=>x.key!==left.key)];
  for(const right of options){const key=left.id+'|'+right.id;if(st.views[key])continue;
   let id=right.id==='workspace'?left.id:null;
   if(!id&&left.q==='Q1'){const a={v3:'v3','v3-A':'v3A',v4:'v4'}[left.key],b={v3:'v3','v3-A':'v3A',v4:'v4'}[right.key];if(a&&b)id=state.pairs[a+'|'+b];}
   if(!id)id=await newRoot(left.id,'비교 / '+left.q+' '+left.key+' → '+right.key+' / '+left.id,Object.keys(st.views).length);
   st.views[key]=id;save();
  }
 }
 for(const left of st.items){
  const options=[st.drafts[left.q],...unique(left.q).filter(x=>x.key!==left.key)],picker=await info(st.pickers[left.id]);
  if(!picker.children.length){await text(picker.id,'비교 대상',308,22,'label');for(const right of options)await button(picker.id,right.title,308,st.views[left.id+'|'+right.id]);await button(picker.id,'닫기',308,'CLOSE','CLOSE');}
  for(const right of options){const key=left.id+'|'+right.id;if(st.built.includes(key))continue;await render(st.views[key],left,right);st.built.push(key);save();console.log('Rendered',st.built.length,'/',Object.keys(st.views).length);}
 }
 st.enabled=true;save();console.log(JSON.stringify({sources:st.items.length,views:Object.keys(st.views).length,pickers:Object.keys(st.pickers).length,draftCreatesSnapshot:false}));
}finally{save();c.close();}
