import fs from 'node:fs';
import {connect} from './talk-channel.mjs';
import {keywordDiff} from './keyword-diff.mjs';
import {createHash} from 'node:crypto';
const base=new URL('../../',import.meta.url),file=new URL('_workspace/2026-11-08-interactions/state.json',base),s=JSON.parse(fs.readFileSync(file));
const out=new URL('_workspace/2026-11-09-product-design/',base),ledger=new URL('corrections.json',out);
fs.mkdirSync(out,{recursive:true});
const p=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger)):{scenes:{},links:{},panels:{},checks:[]};
const c=await connect(process.argv[2]),phase=process.argv[3]||'context';
const raw=c.call;c.call=async(command,params)=>{try{return await raw(command,params);}catch(e){console.error(command,JSON.stringify(params).slice(0,1400));throw e;}};
const save=()=>{s.productCorrections=p;fs.writeFileSync(file,JSON.stringify(s,null,2));fs.writeFileSync(ledger,JSON.stringify(p,null,2));};
const walk=n=>[n,...(n.children||[]).flatMap(walk)],label=n=>walk(n).filter(x=>x.type==='TEXT').map(x=>x.characters||'').filter(Boolean).join(' ');
const info=nodeId=>c.call('get_node_info',{nodeId}),patch=patches=>c.call('janovel_patch_nodes',{patches});
const find=(n,name)=>walk(n).find(x=>x.name===name),btn=(n,text)=>walk(n).findLast(x=>x.type==='INSTANCE'&&label(x)===text);
const text=(id,value)=>patch([{id,text:value}]);
function link(id,to,mode='NAVIGATE'){if(!id)throw Error('Missing link source');p.links[id]={id,to,mode};save();}
async function writeLinks(){const links=Object.values(p.links).map(r=>({nodeId:r.id,reactions:[{trigger:{type:'ON_CLICK'},actions:[r.mode==='CLOSE'?{type:'CLOSE'}:r.mode==='URL'?{type:'URL',url:r.to,openInNewTab:true}:{type:'NODE',destinationId:r.to,navigation:r.mode,transition:null,resetScrollPosition:false}]}]}));for(let i=0;i<links.length;i+=80)await c.call('janovel_set_reactions',{links:links.slice(i,i+80)});}
async function clone(src,key){if(p.scenes[key])return p.scenes[key];const i=Object.keys(p.scenes).length,r=await c.call('janovel_clone_scene',{nodeId:src,name:key,x:25000+(i%4)*1540,y:100+Math.floor(i/4)*1040});p.scenes[key]=r;s.screens[key]=r.id;save();return r;}
async function replace(root,values){const d=await info(root);const changes=walk(d).filter(n=>n.type==='TEXT'&&values[n.characters]!==undefined).map(n=>({id:n.id,text:values[n.characters]}));if(changes.length)await patch(changes);return d;}
async function buttonText(root,value){const d=await info(root),t=walk(d).find(n=>n.type==='TEXT');await text(t.id,value);}
async function clear(node){for(const child of node.children||[])await c.call('delete_node',{nodeId:child.id});}
const rgb=h=>({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255});
async function frame(parent,name,w,h,mode='VERTICAL',extra={}){return c.call('create_frame',{parentId:parent,name,width:w,height:h,x:0,y:0,layoutMode:mode,paddingLeft:0,paddingRight:0,paddingTop:0,paddingBottom:0,itemSpacing:0,...extra});}
async function line(parent,value,width,size=14){const n=await c.call('clone_node',{nodeId:'5:612'});await c.call('set_parent',{nodeId:n.id,parentId:parent});await patch([{id:n.id,text:value,width,height:28,props:{fontSize:size,lineHeight:{unit:'PIXELS',value:28},textAutoResize:'HEIGHT'}}]);return n;}
async function action(parent,value,width,to,mode='NAVIGATE'){const n=await c.call('clone_node',{nodeId:'4:187'});await c.call('set_parent',{nodeId:n.id,parentId:parent});await buttonText(n.id,value);await c.call('resize_node',{nodeId:n.id,width,height:36});if(to)link(n.id,to,mode);return n;}
async function article(root,content){const d=await info(root),a=find(d,'자소서');if(!a)throw Error('Article missing '+root);const texts=a.children.filter(n=>n.type==='TEXT');for(let i=0;i<texts.length;i++)await text(texts[i].id,content.split('\n\n')[i]||'');const count=walk(a).find(n=>n.type==='TEXT'&&/\d.*\/.*자/.test(n.characters||''));if(count)await text(count.id,content.length+' / '+(d.name.includes('Q2')?'1,000':'700')+'자');}
async function comparison(root,left,right,q,title,picker){
 const d=await info(root),center=find(d,'작성·비교'),old=center.children.find(n=>n.name==='두 스냅샷 비교'||n.name==='작성 본문');
 const width=center.absoluteBoundingBox.width,w=width-64,col=(w-25)/2;
 const body=await frame(center.id,'두 스냅샷 비교',width,old.absoluteBoundingBox.height,'VERTICAL',{paddingLeft:32,paddingRight:32,paddingTop:24,paddingBottom:24,itemSpacing:16});
 const header=await c.call('clone_node',{nodeId:'5:609'});await c.call('set_parent',{nodeId:header.id,parentId:body.id});const hd=await info(header.id),ht=walk(hd).filter(n=>n.type==='TEXT');await text(ht[0].id,s.workingCompare.drafts[q].question);await text(ht[1].id,left.length+' → '+right.text.length+'자');
 const heads=await frame(body.id,'기록과 비교 대상',w,title.includes('\n')?56:36,'HORIZONTAL',{itemSpacing:25});await line(heads.id,title,col);const select=picker?await action(heads.id,right.title+'  ⌄',col,picker,'OVERLAY'):await line(heads.id,right.title,col);
 const columns=await frame(body.id,'비교 본문',w,600,'HORIZONTAL',{itemSpacing:12}),diff=keywordDiff(left,right.text);
 for(const [side,content]of [['left',left],['right',right.text]]){if(side==='right')await frame(columns.id,'열 구분선',1,580,'NONE',{fillColor:rgb('#E3E5EA')});const column=await frame(columns.id,'본문 / '+side,col,580);const node=await line(column.id,content,col,16);await patch([{id:node.id,ranges:diff[side]}]);}
 const removed=new Set(walk(old).map(n=>n.id));for(const id of removed)delete p.links[id];s.routes=s.routes.filter(r=>!removed.has(r.id));await c.call('delete_node',{nodeId:old.id});
 return {button:select.id,leftText:left,rightText:right.text,root,q};
}
try{
 if(phase==='context'){
  // Q2 uses its own text and conversation, including the AI candidate.
  const candidate=await clone('42:458','Q2 AI 수정안 · 비교와 채택');
  await replace(candidate.id,{'Q1':'Q2','Q1 · 기본':'Q2 · 기본','지원한 이유와 입사 후 목표를 작성해 주세요.':s.workingCompare.drafts.Q2.question,'117 → 121자':'128 → 128자','내 경험과 공고를 연결해 다듬어줘.':'해결 과정에서 내가 한 일이 잘 드러나는지 봐줘.','경험을 소개한 부분에서 실제로 어떤 일을 했는지 드러나면 지원 이유가 더 분명해져요.':'문제의 원인과 변경한 흐름을 나누어 설명하면 역할이 더 분명해져요.'});
  const cd=await info(candidate.id),area=find(cd,'비교 본문'),cols=area.children.filter(n=>n.type==='FRAME'&&n.absoluteBoundingBox.width>100);
  for(const [i,col] of cols.entries()){await clear(col);for(const para of s.workingCompare.drafts.Q2.text.split('\n\n'))await line(col.id,para,col.absoluteBoundingBox.width);}
  const now=await info(candidate.id);link(btn(now,'← 작성').id,'42:2327');link(btn(now,'스냅샷으로 채택').id,s.q2Snapshot);link('42:2392',candidate.id);
  const reply=await info(s.q2Reply);const compare=btn(reply,'수정안 비교 →');if(compare)link(compare.id,candidate.id);
  // Other companies start with their own empty workspace; do not show Monolab's draft/history.
  p.companyWriters??={};
  for(const [company,detail] of Object.entries(s.companyDetails)){
   const dd=await info(detail),job=walk(dd).find(n=>n.type==='TEXT'&&['서버 개발자','백엔드 개발자','결제 플랫폼 개발'].includes(n.characters))?.characters||'백엔드 개발자';
   const q1=await clone('42:745',company+' · Q1 처음 작성'),q2=await clone('42:745',company+' · Q2 처음 작성');
   for(const [q,r] of [['Q1',q1],['Q2',q2]]){
    await replace(r.id,{'모노랩':company,'Java / Spring 백엔드':job,...(q==='Q2'?{'Q1':'Q2','Q1 · 기본':'Q2 · 기본','지원한 이유와 입사 후 목표를 작성해 주세요.':s.workingCompare.drafts.Q2.question}:{} )});
    const d=await info(r.id),g=find(d,'버전 그래프');if(g)await clear(g);
    const center=find(d,'작성·비교');for(const b of walk(center).filter(n=>n.type==='INSTANCE'&&['스냅샷','분기','병합'].includes(label(n)))){await patch([{id:b.id,props:{opacity:0.4}}]);p.links[b.id]={id:b.id,to:null,mode:'CLEAR'};}
    for(const b of walk(d).filter(n=>n.type==='INSTANCE')){const t=label(b);if(t==='Q1'&&q!=='Q1')link(b.id,q1.id);if(t==='Q2'&&q!=='Q2')link(b.id,q2.id);if(t==='제출 버전')link(b.id,detail);}
    const companyText=walk(d).find(n=>n.type==='TEXT'&&n.characters===company);if(companyText)link(companyText.id,detail);
   }
   link(btn(dd,'자소서 작성 →').id,q1.id);p.companyWriters[company]={q1:q1.id,q2:q2.id};save();
  }
  await patch([{id:s.statusMenu.id||s.statusMenu,height:376,props:{primaryAxisSizingMode:'AUTO'}}]);
  p.checks.push('question/company routes corrected');save();
 }
 if(phase==='submitted'){
  p.submission??={};const q1s=['v3','v3A','v4'],q2s=['v1','v2'];
  const names={v3:'v3 · 직무 연결',v3A:'v3-A · 문장 정리',v4:'v4 · 병합',v1:'v1 · 문제 정리',v2:'v2 · 해결 과정 구체화'};
  const original=['42:1365','42:1411'];
  for(const a of q1s)for(const b of q2s){
   const key=a+'|'+b;if(p.submission[key])continue;
   const select=key==='v4|v2'?{id:original[0]}:await clone(original[0],'제출 선택 · '+key),frozen=key==='v4|v2'?{id:original[1]}:await clone(original[1],'제출 고정 · '+key);
   const qa=s.workingCompare.items.find(x=>x.q==='Q1'&&x.key===names[a].split(' · ')[0]),qb=s.workingCompare.items.find(x=>x.q==='Q2'&&x.key===b);
   for(const r of [select,frozen]){const d=await info(r.id);for(const n of walk(d).filter(n=>n.type==='TEXT')){
     if(/^v[34](?:-A)? ·/.test(n.characters||''))await text(n.id,names[a]+(r===select?'  ⌄':''));
     if(/^v[12] ·/.test(n.characters||''))await text(n.id,names[b]+(r===select?'  ⌄':''));
     if(n.characters?.startsWith('문항 2개 고정'))await text(n.id,'문항 2개 고정 · Q1 '+a.replace('A','-A')+' / Q2 '+b);
   }
   const bodies=walk(d).filter(n=>n.type==='TEXT'&&(n.characters||'').includes('\n\n'));if(bodies.length!==2)throw Error('Submission body count');await text(bodies[0].id,qa.text);await text(bodies[1].id,qb.text);}
   const picker1=await clone('67:12990','제출 Q1 대상 · '+key),picker2=await clone('67:13016','제출 Q2 대상 · '+key);
   p.submission[key]={a,b,select:select.id,frozen:frozen.id,picker1:picker1.id,picker2:picker2.id};save();
  }
  for(const item of Object.values(p.submission)){
   const d=await info(item.select);link(btn(d,names[item.a]+'  ⌄').id,item.picker1,'OVERLAY');link(btn(d,names[item.b]+'  ⌄').id,item.picker2,'OVERLAY');link(btn(d,'선택한 버전 고정').id,item.frozen);
   for(const [id,keys,q] of [[item.picker1,q1s,1],[item.picker2,q2s,2]]){const pd=await info(id);for(const key of keys){const target=p.submission[q===1?key+'|'+item.b:item.a+'|'+key];link(btn(pd,names[key]).id,target.select);}const close=btn(pd,'닫기');if(close)link(close.id,'CLOSE','CLOSE');}
   const fd=await info(item.frozen);link(btn(fd,'+ 제출 버전').id,item.select);
  }
  p.checks.push('six submitted version combinations');save();
 }
 if(phase==='candidates'){
  p.aiCases??={};
  for(const [q,candidate]of [['Q1','42:458'],['Q2',p.scenes['Q2 AI 수정안 · 비교와 채택'].id]]){
   const original=s.workingCompare.drafts[q].text;
   const proposed=q==='Q1'?original.replace('정상 저장뿐 아니라 실패한 요청이 남기는 데이터까지 확인했습니다.','정상 저장과 실패한 요청에 남는 데이터를 함께 확인했습니다.'):original.replace('작업을 시작할 때','작업 시작 시').replace('복구를 반복 실행해도','반복 복구에도');
   await comparison(candidate,original,{text:proposed,title:'AI 수정안'},q,'요청한 작성본');
   const dialog=q==='Q1'?{id:'42:2194'}:await clone(s.q2Snapshot,'Q2 AI 수정안 · 스냅샷 정보');
   const d=await info(candidate);link(btn(d,'스냅샷으로 채택').id,dialog.id);p.aiCases[q]={q,candidate,dialog:dialog.id,text:proposed};save();
  }
  const sources=[...Object.entries(p.companyWriters).flatMap(([,v])=>[[v.q1,'Q1',v.q1,v.q2],[v.q2,'Q2',v.q1,v.q2]]),[p.aiCases.Q2.candidate,'Q2','5:530','42:2327']];
  for(const [id,q,q1,q2]of sources){
   const d=await info(id),toolbar=find(d,'문항·작성 도구'),old=toolbar.children.filter(n=>n.type==='INSTANCE'&&/^Q[12]$/.test(label(n)));
   for(const n of old){await c.call('delete_node',{nodeId:n.id});delete p.links[n.id];}
   for(const [i,name]of ['Q1','Q2'].entries()){const n=await c.call('create_component_instance',{componentId:q===name?'4:195':'4:193'});await c.call('set_parent',{nodeId:n.id,parentId:toolbar.id,index:i});await buttonText(n.id,name);await c.call('resize_node',{nodeId:n.id,width:48,height:40});if(q!==name)link(n.id,name==='Q1'?q1:q2);}
  }
  const q2=await info('42:2327'),sidebar=find(q2,'문항별 버전 기록'),candidate=await info(p.aiCases.Q2.candidate),work=find(candidate,'작업 공간'),old=find(candidate,'문항별 버전 기록');
  const copy=await c.call('clone_node',{nodeId:sidebar.id});await c.call('set_parent',{nodeId:copy.id,parentId:work.id,index:0});await c.call('delete_node',{nodeId:old.id});
  p.checks.push('AI candidates use the requested working text');save();
 }
 if(phase==='records'){
  p.records??={};
  const fixtures={v3:{feature:'데이터 저장',check:'기록이 정확하게 남는지'},v3A:{feature:'문서 버전 관리',check:'실패한 요청의 복구 경로를'},v4:{feature:'데이터 저장',check:'실패한 요청의 복구 경로를'}};
  const content=v=>['문서 관리 프로젝트에서 '+v.feature+' 기능을 개발했습니다.','저장 이후에도 '+v.check+' 확인하며 데이터의 신뢰성을 높였습니다.','이 경험을 바탕으로 문서 저장과 변경 이력을 안정적으로 다루고 싶습니다.'].join('\n\n');
  const requests=[{key:'Q1 스냅샷',q:'Q1',version:'v5',title:'경험 구체화',description:'검토한 내용을 기록',text:s.workingCompare.drafts.Q1.text,parents:['v4'],source:'5:912'},{key:'Q2 스냅샷',q:'Q2',version:'v3',title:'해결 과정 보강',description:'문제와 해결 과정을 기록',text:s.workingCompare.drafts.Q2.text,parents:['v2'],source:s.q2Snapshot}];
  for(const ai of Object.values(p.aiCases||{}))requests.push({key:ai.q+' AI 채택',q:ai.q,version:ai.q==='Q1'?'v5':'v3',title:'AI 제안 검토',description:'요청한 작성본의 표현을 수정',text:ai.text,parents:[ai.q==='Q1'?'v4':'v2'],source:ai.dialog});
  for(const [pair,states]of Object.entries(s.merges))for(const [bits,merge]of Object.entries(states)){
   const [a,b]=pair.split('|'),v={feature:fixtures[bits[0]==='0'?a:b].feature,check:fixtures[bits[1]==='0'?a:b].check};
   const parents=[a,b].map(k=>k.replace('A','-A')).sort(),key=parents.join('+')+' / '+v.feature+' / '+v.check;
   let r=requests.find(x=>x.key===key);if(!r){r={key,q:'Q1',version:'v5',title:'직무 연결 보강',description:'두 기록에서 선택한 구절 병합',text:content(v),parents,mergeSources:[]};requests.push(r);}r.mergeSources.push(merge);
  }
  for(const req of requests){
   if(p.records[req.key]?.complete)continue;
   const result=await clone(req.q==='Q1'?'67:3049':'67:18133','새 기록 · '+req.key);
   const picker=await clone(s.workingCompare.pickers[req.q==='Q1'?'67:3049':'67:18133'],'새 기록 비교 대상 · '+req.key);
   // The copied picker is rebuilt from the selected question's actual snapshot data.
   await clear(await info(picker.id));
   const options=[s.workingCompare.drafts[req.q],...s.workingCompare.items.filter(x=>x.q===req.q&&['v3','v3-A','v4','v1','v2'].includes(x.key)&&x.id!==s.q2Read)];
   const unique=[...new Map(options.map(x=>[x.id,x])).values()],views={};
   for(const target of unique){const key='새 기록 비교 · '+req.key+' → '+target.id,view=target.id==='workspace'?result:await clone(result.id,key);views[target.id]=view.id;await comparison(view.id,req.text,target,req.q,req.version+' · '+req.title+'\n'+req.description,picker.id);}
   for(const target of unique)await action(picker.id,target.title,308,views[target.id]);await action(picker.id,'닫기',308,'CLOSE','CLOSE');await patch([{id:picker.id,height:44+unique.length*40,props:{primaryAxisSizingMode:'AUTO'}}]);
   const targets=Object.fromEntries(s.workingCompare.items.filter(x=>x.q===req.q&&x.id!==s.q2Read).map(x=>[x.key,x.id]));
   for(const id of Object.values(views))await c.call('janovel_record_graph',{rootId:id,q:req.q,key:req.version,title:req.title,parents:req.parents,targets,recordTo:result.id,workspaceTo:req.q==='Q1'?'5:530':'42:2327'});
   let dialog;
   if(req.source){dialog={id:req.source};await article(req.source,req.text);}
   else{const d=await info(s.mergeNameDialog),actual=d.children.find(x=>x.name.includes('스냅샷')||x.name.includes('병합'));if(!actual)throw Error('Merge dialog missing');dialog=await clone(actual.id,'병합 스냅샷 정보 · '+req.key);await c.call('set_parent',{nodeId:dialog.id,parentId:'0:1'});}
   const dd=await info(dialog.id),box=dd.absoluteBoundingBox.width>900?dd.children.find(n=>n.type==='FRAME'&&n.absoluteBoundingBox.width<700&&walk(n).some(x=>x.name==='JaNovel/Field')):dd,fields=walk(box||dd).filter(n=>n.type==='INSTANCE'&&n.name==='JaNovel/Field');
   // Only the two name/description fields; never overwrite the background chat composer.
   const nameFields=fields;
   for(const [i,f]of nameFields.entries())await buttonText(f.id,i===0?req.title:req.description);
   const ok=btn(dd,'확인')||btn(dd,'스냅샷');if(!ok)throw Error('Snapshot confirm missing');link(ok.id,result.id);
   const cancel=btn(dd,'취소');if(cancel&&!req.source)link(cancel.id,'CLOSE','CLOSE');
   for(const merge of req.mergeSources||[]){const md=await info(merge);link(btn(md,'병합 스냅샷').id,dialog.id,'OVERLAY');}
   p.records[req.key]={...req,result:result.id,views,dialog:dialog.id,complete:true};save();
   console.log('record',Object.keys(p.records).length,'/',requests.length);
  }
  p.checks.push('snapshot and merge results preserve chosen text');save();
 }
 if(phase==='polish'){
  // Reflowing text replaces the old fixed per-line fragments; keyword ranges remain exact.
  p.reflowed??=[];
  for(const [root,meta]of Object.entries(s.workingCompare.targets)){
   if(p.reflowed.includes(root))continue;
   const left=s.workingCompare.items.find(x=>x.id===meta.left),right=meta.workspace?s.workingCompare.drafts[left.q]:s.workingCompare.items.find(x=>x.id===meta.right);
   const r=await comparison(root,left.text,right,left.q,left.title,s.workingCompare.pickers[left.id]);meta.button=r.button;p.reflowed.push(root);save();
  }
  const doc=await c.call('get_document_info');
  for(const root of doc.children.filter(n=>n.type==='FRAME'&&!n.name.startsWith('JaNovel'))){
   const d=await info(root.id),work=find(d,'작업 공간'),center=find(d,'작성·비교');if(!work||!center)continue;
   const changes=[{id:work.id,props:{clipsContent:true}},{id:center.id,props:{layoutSizingHorizontal:'FILL',clipsContent:true}}];
   const company=find(d,'회사와 직무');if(company)changes.push({id:company.id,props:{layoutSizingHorizontal:'FILL'}});
   for(const child of center.children||[])if(child.type==='FRAME')changes.push({id:child.id,props:{layoutSizingHorizontal:'FILL'}});
   const toolbar=find(center,'문항·작성 도구');if(toolbar)changes.push({id:toolbar.id,height:48});
   const articleNode=find(center,'자소서');if(articleNode){changes.push({id:articleNode.id,props:{itemSpacing:20,primaryAxisSizingMode:'AUTO',layoutSizingHorizontal:'FILL'}});for(const t of articleNode.children.filter(n=>n.type==='TEXT'))changes.push({id:t.id,props:{fontSize:16,lineHeight:{unit:'PIXELS',value:28},textAutoResize:'HEIGHT',layoutSizingHorizontal:'FILL'}});}
   const body=center.children.find(n=>n.name==='작성 본문'||n.name==='두 스냅샷 비교');if(body)changes.push({id:body.id,props:{paddingTop:24,paddingLeft:32,paddingRight:32}});
   if(body?.name==='두 스냅샷 비교')for(const f of body.children.filter(n=>n.type==='FRAME'))changes.push({id:f.id,props:{layoutSizingHorizontal:'FILL'}});
   const columns=find(body||{},'비교 본문');if(columns)for(const col of columns.children.filter(n=>n.type==='FRAME')){changes.push({id:col.id,props:{layoutSizingHorizontal:'FILL'}});for(const t of col.children.filter(n=>n.type==='TEXT'))changes.push({id:t.id,props:{textAutoResize:'HEIGHT',layoutSizingHorizontal:'FILL'}});}
   await patch(changes);
  }
  p.checks.push('reflowing keyword comparison and compact toolbar');save();
 }
 if(phase==='panels'){
  const doc=await c.call('get_document_info'),oldFolds=new Set(Object.values(s.folds).flatMap(x=>Object.entries(x).filter(([bits])=>bits!=='00').map(([,id])=>id)));
  const writerPanels=JSON.parse(fs.readFileSync(new URL('writer-panels.json',out)));p.panelSets??={};
  p.panels['5:530']??=writerPanels;
  for(const root of doc.children.filter(n=>n.type==='FRAME'&&!n.name.startsWith('JaNovel')&&!oldFolds.has(n.id))){
   const d=await info(root.id),work=find(d,'작업 공간');if(!work)continue;
   for(const side of ['left','right']){
    const name=side==='left'?'문항별 버전 기록':'AI 대화',panel=work.children.find(n=>n.name===name);
    if(!panel||panel.type==='INSTANCE'||panel.absoluteBoundingBox.width<100)continue;
    p.panels[root.id]??={};if(p.panels[root.id][side])continue;
    const reactions=await c.call('janovel_inspect_reactions',{nodeIds:[panel.id]});
    const structure=walk(panel).map((n,i)=>({type:i===0?'PANEL':n.type,name:n.name,text:n.characters,style:n.style,fills:n.fills,strokes:n.strokes,width:n.absoluteBoundingBox?.width,height:n.absoluteBoundingBox?.height}));
    const actions=reactions[0].controls.map(n=>n.reactions),key=side+createHash('sha256').update(JSON.stringify([structure,actions])).digest('hex');
    const master=p.panelSets[key],i=Object.keys(p.panelSets).length,r=await c.call('janovel_interactive_panel',{rootId:root.id,side,...(master?{expandedId:master.expandedId}:{x:22000+(side==='right'?800:0),y:1200+i*950})});p.panels[root.id][side]=r;p.panelSets[key]??=r;
    const removed=new Set(r.removedNodeIds);s.routes=s.routes.filter(x=>!removed.has(x.id));for(const id of removed)delete p.links[id];save();
   }
  }
  // Legacy demonstration frames are kept, but their hidden chat content must not leak.
  for(const id of oldFolds){const d=await info(id),chat=find(d,'AI 대화');if(!chat)continue;const changes=[{id:chat.id,props:{clipsContent:true}}];if(chat.absoluteBoundingBox.x+chat.absoluteBoundingBox.width>d.absoluteBoundingBox.x+d.absoluteBoundingBox.width+2){changes.push({id:chat.id,width:40});for(const child of chat.children.slice(1))changes.push({id:child.id,props:{visible:false}});const h=chat.children[0];for(const child of h.children.filter(n=>n.type!=='INSTANCE'))changes.push({id:child.id,props:{visible:false}});}await patch(changes);}
  p.checks.push('independent panel component transitions');save();
 }
 if(phase==='finish'){
  const roots=new Set([...Object.keys(s.workingCompare.targets),...Object.values(p.records).flatMap(r=>Object.values(r.views)),...Object.values(p.aiCases||{}).map(x=>x.candidate)]);
  const records=new Map(Object.values(p.records).flatMap(r=>Object.values(r.views).map(id=>[id,r])));
  for(const root of roots){
   const d=await info(root),body=find(d,'두 스냅샷 비교'),columns=find(body,'비교 본문'),heads=find(body,'기록과 비교 대상');
   const patches=[{id:body.id,props:{layoutSizingHorizontal:'FILL'}},{id:columns.id,props:{layoutSizingHorizontal:'FILL',itemSpacing:12}},{id:heads.id,props:{layoutSizingHorizontal:'FILL'}}];
   for(const col of columns.children.filter(n=>n.name==='본문 / left'||n.name==='본문 / right')){patches.push({id:col.id,props:{layoutSizingHorizontal:'FILL'}});for(const t of col.children.filter(n=>n.type==='TEXT'))patches.push({id:t.id,props:{layoutSizingHorizontal:'FILL',textAutoResize:'HEIGHT'}});}
   if(!columns.children.some(n=>n.name==='열 구분선')){const divider=await frame(columns.id,'열 구분선',1,580,'NONE',{fillColor:rgb('#E3E5EA')});await c.call('set_parent',{nodeId:divider.id,parentId:columns.id,index:1});}
   const select=heads.children.find(n=>n.type==='INSTANCE');if(select){await c.call('set_stroke_color',{nodeId:select.id,color:{...rgb('#8A8F9A'),a:1},weight:1});patches.push({id:select.id,props:{cornerRadius:4}});}
   const record=records.get(root);if(record){const t=heads.children.find(n=>n.type==='TEXT');patches.push({id:t.id,text:record.version+' · '+record.title+'\n'+record.description},{id:heads.id,height:56});}
   await patch(patches);
  }
  for(const id of ['5:530','42:2327']){const d=await info(id),body=find(d,'작성 본문'),a=find(d,'자소서');await patch([{id:body.id,props:{counterAxisAlignItems:'CENTER'}},{id:a.id,width:720,props:{layoutSizingHorizontal:'FIXED'}}]);}
  for(const roots of Object.values(p.companyWriters))for(const id of Object.values(roots)){
   const d=await info(id);for(const n of walk(d).filter(n=>n.type==='INSTANCE'&&['전체 보기','피드백 요청','경험 정리하기','제출 버전'].includes(label(n)))){await c.call('janovel_set_reactions',{links:[{nodeId:n.id,reactions:[]}]});delete p.links[n.id];await patch([{id:n.id,props:{opacity:0.4}}]);p.disabled??=[];if(!p.disabled.includes(n.id))p.disabled.push(n.id);}
  }
  p.checks.push('comparison fields, text measure, and unavailable empty-state actions');save();
 }
 if(phase==='fullgraphs'){
  p.widePanels??={};
  const processed=new Set();
  const recordOf=new Map(Object.values(p.records).flatMap(r=>Object.values(r.views).map(id=>[id,r])));
  for(const [root,panels]of Object.entries(p.panels)){
   const meta=panels.left;if(!meta||processed.has(meta.setId)||(p.widePanels[meta.setId]&&process.argv[4]!=='refresh'))continue;processed.add(meta.setId);
   const record=recordOf.get(root),q=record?.q||s.workingCompare.items.find(x=>x.id===s.workingCompare.targets[root]?.left)?.q||(root==='42:2327'||Object.entries(s.screens).some(([name,id])=>id===root&&name.includes('Q2'))||Object.values(p.aiCases||{}).some(x=>x.q==='Q2'&&x.candidate===root)?'Q2':'Q1');
   const d=await info(meta.expandedId),g=find(d,'버전 그래프');if(!g)continue;
   const selected=g.children.find(n=>n.type==='INSTANCE'&&n.fills?.some(f=>String(f.color).toUpperCase()==='#EDF1FA'));
   const key=selected?walk(selected).find(n=>n.type==='TEXT')?.characters?.split(' · ')[0]:'작성 중';
   const history=q==='Q1'?[['v1',0,[]],['v2',0,['v1']],['v2-A',1,['v1']],['v2-B',2,['v1']],['v3',0,['v2']],['v3-A',1,['v2-A']],['v3-B',2,['v2-B']],['v4',0,['v3','v3-A']]]:[['v1',0,[]],['v1-A',1,['v1']],['v2',0,['v1','v1-A']]];
   const items=s.workingCompare.items.filter(x=>x.q===q&&x.id!==s.q2Read),targets=Object.fromEntries(items.map(x=>[x.key,x.id]));
   const nodes=history.map(([key,lane,parents])=>({key,lane,parents,title:items.find(x=>x.key===key)?.title.split(' · ').slice(1).join(' · ')||key}));
   if(record){nodes.push({key:record.version,lane:0,parents:record.parents,title:record.title});targets[record.version]=record.result;}
   const parent=record?.version||(q==='Q1'?'v4':'v2');nodes.push({key:'작성 중',lane:0,parents:[parent],title:parent+'에서 작성'});targets['작성 중']=q==='Q1'?'5:530':'42:2327';
   const recovery=p.widePanels[meta.setId]?.wideId||p.wideRecovery?.[meta.setId];p.widePanels[meta.setId]=await c.call('janovel_wide_panel',{expandedId:meta.expandedId,history:nodes,targets,selected:key,...(recovery?{recoverId:recovery}:{})});save();
  }
  for(const root of [...Object.keys(s.workingCompare.targets),...Object.values(p.records).flatMap(r=>Object.values(r.views))]){const d=await info(root),heads=find(d,'기록과 비교 대상');if(heads)await patch(heads.children.filter(n=>['TEXT','INSTANCE'].includes(n.type)).map(n=>({id:n.id,props:{layoutSizingHorizontal:'FILL'}})));}
  p.checks.push('full graph expands the same sidebar and preserves comparison');save();
 }
 if(phase==='finalchecks'){
  for(const r of Object.values(p.records)){const d=await info(r.dialog),cancel=btn(d,'취소');if(cancel)link(cancel.id,r.source?(Object.values(p.aiCases||{}).find(a=>a.dialog===r.dialog)?.candidate||(r.q==='Q1'?'5:530':'42:2327')):'CLOSE',r.source?'NAVIGATE':'CLOSE');}
  const q2=await info('42:2327'),source=find(q2,'문항별 버전 기록'),sourceToolbar=find(q2,'문항·작성 도구');
  for(const id of [s.q2Snapshot,p.aiCases.Q2.dialog]){const d=await info(id),work=find(d,'작업 공간'),old=find(d,'문항별 버전 기록'),toolbar=find(d,'문항·작성 도구');const panel=await c.call('clone_node',{nodeId:source.id});await c.call('set_parent',{nodeId:panel.id,parentId:work.id,index:0});await c.call('delete_node',{nodeId:old.id});p.panels[id].left={...p.panels['42:2327'].left,instanceId:panel.id};const t=await c.call('clone_node',{nodeId:sourceToolbar.id});await c.call('set_parent',{nodeId:t.id,parentId:find(d,'작성·비교').id,index:0});await c.call('delete_node',{nodeId:toolbar.id});}
  for(const id of [s.q2Snapshot,p.aiCases.Q2.dialog]){const d=await info(id),work=find(d,'작업 공간'),old=find(d,'AI 대화'),chat=await c.call('clone_node',{nodeId:find(q2,'AI 대화').id});await c.call('set_parent',{nodeId:chat.id,parentId:work.id,index:work.children.findIndex(n=>n.id===old.id)});await c.call('delete_node',{nodeId:old.id});p.panels[id].right={...p.panels['42:2327'].right,instanceId:chat.id};}
  await patch(['86:49822','86:49927'].map(id=>({id,width:32,height:32})));
  p.checks=[...new Set(p.checks)];save();
 }
 if(phase==='flows'){p.flowStarts=await c.call('janovel_product_flows');save();}
 if(phase==='compactrecords'){
  const done=new Set();p.compactRecords=[];
  for(const record of Object.values(p.records))for(const root of Object.values(record.views)){
   const meta=p.panels[root]?.left;if(!meta||done.has(meta.expandedId))continue;done.add(meta.expandedId);
   const targets=Object.fromEntries(s.workingCompare.items.filter(x=>x.q===record.q&&x.id!==s.q2Read).map(x=>[x.key,x.id]));
   p.compactRecords.push(await c.call('janovel_record_graph',{rootId:meta.expandedId,q:record.q,key:record.version,title:record.title,parents:record.parents,targets,recordTo:record.result,workspaceTo:record.q==='Q1'?'5:530':'42:2327'}));save();
  }
 }
 // Empty disabled controls have no click action, rather than a fake successful transition.
 const disabled=Object.values(p.links).filter(x=>x.mode==='CLEAR');for(const r of disabled){await c.call('janovel_set_reactions',{links:[{nodeId:r.id,reactions:[]}]});delete p.links[r.id];p.disabled??=[];if(!p.disabled.includes(r.id))p.disabled.push(r.id);}
 await writeLinks();save();console.log(JSON.stringify({phase,scenes:Object.keys(p.scenes).length,links:Object.keys(p.links).length,checks:p.checks}));
}finally{save();c.close();}
