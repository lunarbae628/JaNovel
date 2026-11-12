import fs from 'node:fs';
import {connect} from './talk-channel.mjs';
const dir='/Users/moon/Desktop/Works/job-application-service/_workspace/2026-11-08-interactions';
fs.mkdirSync(dir,{recursive:true});
const statePath=dir+'/state.json';
const state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):{screens:{},routes:[],completed:[]};
const c=await connect(process.argv[2]||'r0hguhks');
const raw=c.call;
const save=()=>fs.writeFileSync(statePath,JSON.stringify(state,null,2));
async function call(cmd,p={}){let r;try{r=await raw(cmd,p);}catch(e){console.error('FAILED COMMAND',cmd,JSON.stringify(p).slice(0,2000));throw e;}if(r?.replacementsFailed)throw Error('Some text replacements failed');return r;}
const walk=n=>[n,...(n.children||[]).flatMap(walk)];
const info=nodeId=>call('get_node_info',{nodeId});
const C={white:'#FFFFFF',ink:'#302B27',muted:'#727272',blue:'#274690',soft:'#EDF1FA',graph:'#F7F7F8',line:'#E6E6E6',highlight:'#DCE4F6',secondary:'#576CA8'};
const rgb=h=>({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255});
const color=(id,col)=>call('set_fill_color',{nodeId:id,...rgb(C[col]||col)});
const size=(nodeId,width,height)=>call('resize_node',{nodeId,width,height});
async function frame(p,name,w,h,mode='VERTICAL',opts={}){const r=await call('create_frame',{...(p?{parentId:p}:{}),name,width:w,height:h,x:0,y:0,layoutMode:mode,fillColor:rgb(C.white),paddingLeft:0,paddingRight:0,paddingTop:0,paddingBottom:0,...opts});return r;}
async function clone(src,p,x=0,y=0,index){const n=await call('clone_node',{nodeId:src});if(p)await call('set_parent',{nodeId:n.id,parentId:p,x,y,...(index===undefined?{}:{index})});return n;}
async function set(nodeId,text){return call('set_text_content',{nodeId,text});}
async function text(p,value,kind='label',w){const n=await clone({label:'5:539',caption:'5:540',body:'5:612',compact:'5:629',title:'5:610'}[kind],p);await set(n.id,value);await call('rename_node',{nodeId:n.id,name:value.slice(0,50)});if(w)await size(n.id,w,n.height||26);return n;}
function route(id,to,mode='NAVIGATE',extra={}){state.routes=state.routes.filter(r=>r.id!==id);state.routes.push({id,to,mode,...extra});save();}
async function button(p,value,w=180,kind='ghost',to,mode='NAVIGATE'){const n=await clone({ghost:'4:187',primary:'4:173',graphite:'4:181'}[kind],p);const t=walk(await info(n.id)).find(x=>x.type==='TEXT');await set(t.id,value);await call('rename_node',{nodeId:n.id,name:value});await size(n.id,w,36);if(to)route(n.id,to,mode);return n;}
async function replace(root,values){for(const n of walk(await info(root)).filter(n=>n.type==='TEXT'))if(values[n.characters]!==undefined)await set(n.id,values[n.characters]);}
async function root(src,name){if(state.screens[name])return{id:state.screens[name]};const n=await clone(src);const i=Object.keys(state.screens).length;await call('rename_node',{nodeId:n.id,name});await call('move_node',{nodeId:n.id,x:5400+(i%3)*1540,y:100+Math.floor(i/3)*1040});state.screens[name]=n.id;save();return n;}
async function popup(name,w=300,h=260){if(state.screens[name])return{id:state.screens[name]};const i=Object.keys(state.screens).length;const p=await frame(null,name,w,h,'VERTICAL',{paddingLeft:16,paddingRight:16,paddingTop:16,paddingBottom:16,itemSpacing:8,strokeColor:rgb(C.line),strokeWeight:1});await call('move_node',{nodeId:p.id,x:5400+(i%3)*1540,y:100+Math.floor(i/3)*1040});state.screens[name]=p.id;save();return p;}
async function clear(n){const d=await info(n);if(d.children?.length)await call('delete_multiple_nodes',{nodeIds:d.children.map(x=>x.id)});}
async function divider(p,w){return frame(p,'구분선',w,1,'NONE',{fillColor:rgb(C.line)});}
const versionNames={v3:'v3 · 직무 연결',v3A:'v3-A · 문장 정리',v4:'v4 · 병합'};
const versions=Object.keys(versionNames);
const fixture={v3:{feature:'데이터 저장',check:'기록이 정확하게 남는지'},v3A:{feature:'문서 버전 관리',check:'실패한 요청의 복구 경로를'},v4:{feature:'데이터 저장',check:'실패한 요청의 복구 경로를'}};
const paras=v=>['문서 관리 프로젝트에서 '+v.feature+' 기능을 개발했습니다.','저장 이후에도 '+v.check+' 확인하며 데이터의 신뢰성을 높였습니다.','이 경험을 바탕으로 문서 저장과 변경 이력을 안정적으로 다루고 싶습니다.'];
async function rich(p,v,other,w,select){
 const box=await frame(p,'기록 본문',w,330,'VERTICAL',{itemSpacing:20});
 await text(box.id,'문서 관리 프로젝트에서','compact',w);
 const row=await frame(box.id,'기능 변경 구절',w,32,'HORIZONTAL',{itemSpacing:4,counterAxisAlignItems:'CENTER'});
 const hit=await frame(row.id,'기능 선택',Math.min(w,v.feature.length*14+16),30,'HORIZONTAL',{paddingLeft:6,paddingRight:6,counterAxisAlignItems:'CENTER',fillColor:rgb(v.feature===other.feature?C.white:C.highlight)});
 await text(hit.id,v.feature,'compact');if(select)route(hit.id,select('feature'));
 await text(row.id,'기능을 개발했습니다.','compact');
 await text(box.id,'저장 이후에도','compact',w);
 const h=await frame(box.id,'검토 대상 선택',Math.min(w,v.check.length*14+16),30,'HORIZONTAL',{paddingLeft:6,paddingRight:6,counterAxisAlignItems:'CENTER',fillColor:rgb(v.check===other.check?C.white:C.highlight)});
 await text(h.id,v.check,'compact');if(select)route(h.id,select('check'));
 await text(box.id,'확인하며 데이터의 신뢰성을 높였습니다.','compact',w);
 await text(box.id,paras(v)[2],'compact',w);
 return box;
}
async function buildCompare(a,b){
 const key='비교 · '+a+' ↔ '+b;
 const n=(a==='v3'&&b==='v3A')?{id:'5:647'}:await root('5:647',key);
 state.pairs??={};state.pairs[a+'|'+b]=n.id;save();
 const data=await info(n.id),main=walk(data).find(x=>x.name==='두 스냅샷 비교');
 const columns=main.children.find(x=>x.name==='비교 본문');if(columns)await call('delete_node',{nodeId:columns.id});
 const select=walk(main).find(x=>x.name==='비교 대상');
 for(const [index,part] of select.children.filter(x=>x.type==='FRAME').entries()){
   const instances=part.children.filter(x=>x.type==='INSTANCE');
   if(instances.length>1)await call('delete_multiple_nodes',{nodeIds:instances.slice(1).map(x=>x.id)});
   const btn=instances[0];if(btn){const t=walk(btn).find(x=>x.type==='TEXT');await set(t.id,versionNames[index?b:a]+'  ⌄');state.selectors??=[];state.selectors.push({id:btn.id,a,b,side:index?'b':'a'});}
 }
 const count=walk(main).find(x=>x.type==='TEXT'&&/\d+\s*→\s*\d+자/.test(x.characters||''));if(count)await set(count.id,paras(fixture[a]).join('\n\n').length+' → '+paras(fixture[b]).join('\n\n').length+'자');
 const width=main.absoluteBoundingBox.width-64;
 const row=await frame(main.id,'비교 본문',width,420,'HORIZONTAL',{itemSpacing:12});
 const col=(width-25)/2;
 await rich(row.id,fixture[a],fixture[b],col);await frame(row.id,'열 구분선',1,420,'NONE',{fillColor:rgb(C.line)});await rich(row.id,fixture[b],fixture[a],col);
 return n;
}
async function buildCalendar(id,year=2026,month=10){
 const data=await info(id),main=walk(data).find(x=>x.name==='월별 일정');
 if(!main)throw Error('Calendar body missing');
 const old=main.children.find(x=>x.name==='월요일부터 일요일');if(old)await call('delete_node',{nodeId:old.id});
 const headings=walk(main).find(x=>x.type==='TEXT'&&/2026년/.test(x.characters||''));if(headings)await set(headings.id,year+'년 '+(month+1)+'월');
 const grid=await frame(main.id,'월요일부터 일요일',1200,650,'VERTICAL');
 const weekday=await frame(grid.id,'요일',1200,36,'HORIZONTAL');
 for(const day of ['월','화','수','목','금','토','일']){const col=await frame(weekday.id,day,1200/7,36,'HORIZONTAL',{paddingLeft:12,counterAxisAlignItems:'CENTER'});await text(col.id,day,'caption');}
 const first=new Date(Date.UTC(year,month,1)),start=1-(first.getUTCDay()+6)%7;
 const events={12:['솔빛테크','기술 면접','14:00','interview'],16:['브릭스','과제 제출','시간 미정','task'],18:['루트페이','지원 마감','시간 미정','deadline'],20:['모노랩','서류 마감','시간 미정','deadline']};
 state.events??=[];
 for(let week=0;week<6;week++){
  const row=await frame(grid.id,'주 '+(week+1),1200,102,'HORIZONTAL');
  for(let day=0;day<7;day++){
   const date=new Date(Date.UTC(year,month,start+week*7+day)),d=date.getUTCDate(),isCurrent=date.getUTCMonth()===month,isToday=date.getUTCMonth()===10&&d===8;
   const cell=await frame(row.id,`${date.getUTCMonth()+1}.${d}`,1200/7,102,'VERTICAL',{paddingLeft:8,paddingRight:8,paddingTop:6,itemSpacing:3,strokeColor:rgb(C.line),strokeWeight:1,fillColor:rgb(isToday?C.soft:day>4?'#FAFAFA':C.white)});
   const num=await frame(cell.id,'날짜',26,24,'HORIZONTAL',{counterAxisAlignItems:'CENTER',primaryAxisAlignItems:'CENTER',fillColor:rgb(isToday?C.blue:isCurrent?day>4?'#FAFAFA':C.white:C.graph)});
   const numText=await text(num.id,String(d),'caption');if(isToday)await color(numText.id,'white');else if(!isCurrent)await color(numText.id,'#B4B4B4');
   if(month===10&&isCurrent&&events[d]){
    const [company,title,time,kind]=events[d],strong=kind==='deadline';
    const card=await frame(cell.id,'일정 / '+company+' / '+title,1200/7-16,58,'HORIZONTAL',{fillColor:rgb(strong?C.blue:kind==='interview'?C.soft:'#F0F1F4'),itemSpacing:6});
    await frame(card.id,'종류 표시',3,58,'NONE',{fillColor:rgb(kind==='task'?C.secondary:C.blue)});
    const label=await frame(card.id,'일정 제목',143,54,'VERTICAL',{paddingTop:4,itemSpacing:0});
    const a=await text(label.id,(strong?'◷ ':kind==='interview'?'◉ ':'□ ')+company,'caption');
    const b=await text(label.id,title+(kind==='interview'?' · '+time:''),'caption');
    if(strong){await color(a.id,'white');await color(b.id,'white');}else{await color(a.id,'blue');}
    state.events.push({id:card.id,company,title,time,date:d});
   }
  }
 }
 const legend=await frame(main.id,'일정 종류',1200,24,'HORIZONTAL',{itemSpacing:20});
 for(const [label,col] of [['● 오늘',C.blue],['■ 마감',C.blue],['◉ 면접',C.secondary],['□ 과제',C.muted]]){const t=await text(legend.id,label,'caption');await color(t.id,col);}
}

const phase=process.argv[3]||'enhance';
const label=n=>walk(n).filter(x=>x.type==='TEXT').map(x=>x.characters||'').filter(Boolean).join(' ');
const outer=n=>walk(n).filter(x=>x.type==='INSTANCE'&&!x.id.startsWith('I'));
const findLabel=(n,l)=>outer(n).find(x=>label(x)===l);
async function message(name,title,detail,to='CLOSE'){
 const p=await popup(name,400,200);await clear(p.id);await text(p.id,title,'title',368);await text(p.id,detail,'compact',368);await button(p.id,'확인',368,'primary',to,to==='CLOSE'?'CLOSE':'NAVIGATE');return p.id;
}
async function caption(root,textValue){const n=await info(root),tool=walk(n).find(x=>x.name==='문항·작성 도구');if(tool)await text(tool.id,textValue,'caption');}
async function removeToolbarStatus(id){const d=await info(id),tool=walk(d).find(x=>x.name==='문항·작성 도구');for(const b of tool?.children||[])if(b.type==='INSTANCE'&&label(b)==='병합 중'){await call('delete_node',{nodeId:b.id});await text(tool.id,'병합 중','caption');}}
async function setMiddle(id,v){const d=await info(id),mid=walk(d).find(x=>x.name==='병합 결과 · 직접 수정'&&x.type==='FRAME');if(!mid)return;const hits=outer(mid);for(const n of hits){const old=label(n),key=old.includes('기록이')||old.includes('복구')?'check':'feature';const t=walk(n).find(x=>x.type==='TEXT');await set(t.id,v[key]);await size(n.id,Math.min(360,v[key].length*14+16),30);}}
async function foldVariant(src,name,left,right){
 const r=await root(src,name),d=await info(r.id),panel=walk(d).find(x=>x.name==='문항별 버전 기록'),chat=walk(d).find(x=>x.name==='AI 채팅'&&x.type==='FRAME'),center=walk(d).find(x=>x.name==='작성·비교');
 for(const [n,fold,w] of [[panel,left,208],[chat,right,360]])if(n){if(fold){const header=n.children[0],toggle=outer(header).find(x=>x.name.includes('toggle'));for(const ch of n.children.filter(x=>x.id!==header.id))await call('delete_node',{nodeId:ch.id});for(const ch of header.children.filter(x=>x.id!==toggle?.id))await call('delete_node',{nodeId:ch.id});await size(n.id,40,835);await size(header.id,40,56);}else await size(n.id,w,835);}
 if(center)await size(center.id,1440-(left?40:208)-(right?40:360)-2,835);
 return r.id;
}
try{
 if(phase==='enhance'&&!state.completed.includes('enhance')){
  // Calendar navigation is three separate controls; remove duplicate cloned legends.
  for(const id of ['42:1209',state.screens['캘린더 · 2026년 10월'],state.screens['캘린더 · 2026년 12월'],'42:1600','42:2063']){
   const d=await info(id),main=walk(d).find(x=>x.name==='월별 일정');
   for(const legend of main.children.filter(x=>x.name==='일정 종류').slice(1))await call('delete_node',{nodeId:legend.id});
   const old=outer(main).find(x=>label(x).includes('‹')&&label(x).includes('›'));
   if(old){const parent=walk(main).find(x=>x.children?.some(c=>c.id===old.id)),index=parent.children.findIndex(x=>x.id===old.id);await call('delete_node',{nodeId:old.id});
    const nav=await frame(parent.id,'월 이동',156,36,'HORIZONTAL',{itemSpacing:4});await call('set_parent',{nodeId:nav.id,parentId:parent.id,index});
    const prev=id===state.screens['캘린더 · 2026년 12월']?'42:1209':state.screens['캘린더 · 2026년 10월'];
    const next=id===state.screens['캘린더 · 2026년 10월']?'42:1209':state.screens['캘린더 · 2026년 12월'];
    await button(nav.id,'‹',36,'ghost',prev);await button(nav.id,'오늘',72,'ghost','42:1209');await button(nav.id,'›',36,'ghost',next);
   }
  }
  // A read screen and a snapshot/branch result preserve the chosen source context.
  state.branchDialogs??={};state.branchResults??={};
  for(const v of versions){
   const dlg=await root('37:312','분기 만들기 · '+v);await replace(dlg.id,{'v3 · 직무 연결에서 새 분기를 만듭니다.':versionNames[v]+'에서 새 분기를 만듭니다.'});
   const dt=await info(dlg.id),box=dt.children.find(x=>x.name.includes('분기')||x.name.includes('스냅샷 이름'));
   if(box){const fields=outer(box).filter(x=>x.name==='JaNovel/Field');if(fields[0])await set(walk(fields[0]).find(x=>x.type==='TEXT').id,'새 접근 · '+v);}
   const result=await root(state.screens['기록 본문 · '+v],'분기 작성 · '+v);await caption(result.id,'새 접근 · '+v+' · 작성 중');
   const resInfo=await info(result.id),readCaption=walk(resInfo).find(x=>x.type==='TEXT'&&x.characters?.includes('읽기 전용'));if(readCaption)await set(readCaption.id,'새 접근 · '+v);
   const tool=walk(resInfo).find(x=>x.name==='문항·작성 도구');for(const n of tool.children.filter(x=>x.type==='INSTANCE'&&label(x)==='이 기록으로 복원'))await call('delete_node',{nodeId:n.id});await button(tool.id,'스냅샷',100,'primary','5:912');
   state.branchDialogs[v]=dlg.id;state.branchResults[v]=result.id;
   const menu=await info(state.screens['노드 메뉴 · '+v]);route(findLabel(menu,'여기서 분기하기').id,dlg.id);
  }
  // Merge selection: both changed phrases can be selected independently.
  state.merges??={};
  for(const a of versions)for(const b of versions.filter(v=>v!==a)){
   const base=(a==='v3'&&b==='v3A')?{id:'37:441'}:await root('37:441','병합 · '+a+' + '+b);
   await removeToolbarStatus(base.id);
   const d=await info(base.id),panels=walk(d).find(x=>x.name==='원문 · 병합 결과 · 수정본').children.filter(x=>x.type==='FRAME'&&x.absoluteBoundingBox.width>100);
   for(const [i,v] of [[0,a],[2,b]]){
    const pn=panels[i];await set(pn.children.find(x=>x.type==='TEXT').id,versionNames[v]);
    const hits=outer(pn);for(const hit of hits){const t=walk(hit).find(x=>x.type==='TEXT'),key=label(hit).includes('기록이')||label(hit).includes('복구')?'check':'feature';await set(t.id,fixture[v][key]);await size(hit.id,Math.min(360,fixture[v][key].length*14+16),30);}
   }
   const map={};for(const bits of ['00','01','10','11']){
    const r=bits==='01'?base:await root(base.id,'병합 선택 · '+a+' + '+b+' · '+bits);
    await setMiddle(r.id,{feature:fixture[bits[0]==='0'?a:b].feature,check:fixture[bits[1]==='0'?a:b].check});map[bits]=r.id;
   }
   state.merges[a+'|'+b]=map;
   // Every source or result keyword toggles that phrase while preserving the other choice.
   for(const [bits,id] of Object.entries(map)){
    const t=await info(id),p=walk(t).find(x=>x.name==='원문 · 병합 결과 · 수정본').children.filter(x=>x.type==='FRAME'&&x.absoluteBoundingBox.width>100);
    for(const [i,choice] of [[0,'0'],[2,'1']])for(const hit of outer(p[i])){
     const key=label(hit).includes('기록이')||label(hit).includes('복구')?1:0,next=bits.split('');next[key]=choice;route(hit.id,map[next.join('')]);
    }
   }
   const sel=await info(state.screens['병합 상대 선택 · '+a]),btn=findLabel(sel,versionNames[b]);route(btn.id,map['01']);
  }
  state.mergeSnapshot=await message('병합 스냅샷 · 완료','병합 기록을 남겼어요','선택한 구절을 합친 기록은 그래프에서 다시 확인할 수 있어요.',state.screens['기록 본문 · v4']);
  state.snapshotDone=await message('스냅샷 · 완료','스냅샷을 남겼어요','이름과 설명이 있는 기록으로 보관됐어요.','5:530');
  state.restoreDone=await message('복원 · 완료','새 초안으로 불러왔어요','기존 작성본과 스냅샷은 기록에 남아 있어요.','5:530');
  state.copyDone=await message('복사 · 확인','내용 복사','실제 서비스에서는 선택한 제출 버전의 내용을 복사해요.');
  state.saved=await message('변경 · 완료','변경사항을 반영했어요','지원 상세에서 변경한 내용을 확인하세요.','42:1128');
  // Event details keep the actual company, date and event kind.
  state.eventDetails??={};state.eventEdits??={};
  for(const e of state.events){
   const edit=await root('42:2063','일정 수정 · '+e.company);const d=await info(edit.id),dialog=d.children.find(x=>x.name.includes('스냅샷 이름'));
   const fields=outer(dialog).filter(x=>x.name==='JaNovel/Field');
   for(const [i,value] of [e.company,e.title,e.title,`2026.11.${e.date} · ${e.time}`].entries())if(fields[i])await set(walk(fields[i]).find(x=>x.type==='TEXT').id,value);
   const p=await popup('일정 상세 · '+e.company,360,256);await clear(p.id);await text(p.id,e.company+' · '+e.title,'title',328);await text(p.id,`11월 ${e.date}일 · ${e.time}`,'compact',328);await button(p.id,'일정 수정',328,'ghost',edit.id);await button(p.id,'지원 상세 보기',328,'ghost','42:1128');await button(p.id,'닫기',328,'ghost','CLOSE','CLOSE');
   state.eventDetails[e.company]=p.id;state.eventEdits[e.company]=edit.id;
  }
  // Expand/fold each side independently without replacing the document with another mode.
  state.folds??={};
  for(const src of ['5:530','5:647','42:2327']){
   state.folds[src]={'00':src};for(const [key,l,r] of [['10',true,false],['01',false,true],['11',true,true]])state.folds[src][key]=await foldVariant(src,'패널 접기 · '+src+' · '+key,l,r);
  }
  // Clearly distinguish status text from real controls.
  const list=await info('41:345');for(const n of outer(list).filter(n=>['회사','진행 단계'].includes(label(n)))){const t=await text((walk(list).find(x=>x.children?.some(y=>y.id===n.id))).id,label(n),'caption');const par=walk(list).find(x=>x.children?.some(y=>y.id===n.id)),idx=par.children.findIndex(y=>y.id===n.id);await call('set_parent',{nodeId:t.id,parentId:par.id,index:idx});await call('delete_node',{nodeId:n.id});}
  // Form/selector overlays represent design states; text entry remains a development task.
  state.statusMenu=await popup('지원 단계 선택',280,336);await clear(state.statusMenu.id);
  await text(state.statusMenu.id,'진행 단계','label');
  state.statusScreens??={};for(const status of ['관심','서류 전형','코딩테스트','기술 면접','최종 면접','최종 합격']){
   const r=await root('42:1128','지원 상세 · '+status);const d=await info(r.id),s=outer(d).find(x=>label(x).includes('서류 전형')&&label(x).includes('⌄'));if(s)await set(walk(s).find(x=>x.type==='TEXT').id,status+'  ⌄');state.statusScreens[status]=r.id;await button(state.statusMenu.id,status,248,'ghost',r.id);
  }
  await button(state.statusMenu.id,'닫기',248,'ghost','CLOSE','CLOSE');
  state.filter=await popup('지원 현황 · 필터',280,248);await clear(state.filter.id);await text(state.filter.id,'지원 현황 필터','label');
  for(const status of ['전체','서류 전형','기술 면접','과제 전형']){
   const r=await root('41:345','지원 현황 · 필터 '+status),d=await info(r.id),f=outer(d).find(x=>label(x).includes('전체 4건'));if(f)await set(walk(f).find(x=>x.type==='TEXT').id,status+'  ⌄');
   const rows=walk(d).filter(x=>x.type==='FRAME'&&x.name.startsWith('지원 /')); // Names vary: use the row holding each company control instead.
   if(status!=='전체')for(const b of outer(d).filter(x=>['모노랩','솔빛테크','브릭스','루트페이'].includes(label(x)))){const row=walk(d).find(x=>x.children?.some(y=>y.id===b.id));if(!label(row).includes(status))await call('delete_node',{nodeId:row.id});}
   await button(state.filter.id,status,248,'ghost',r.id);
  }
  const submitted=await root('42:1411','제출 버전 · 제출 완료 표시');await replace(submitted.id,{'제출 완료로 표시':'제출 완료 ✓'});state.submitted=submitted.id;
  // Specific confirmation for deletion rather than silently dropping an event.
  state.deleteConfirm=await popup('일정 삭제 · 확인',360,220);await clear(state.deleteConfirm.id);await text(state.deleteConfirm.id,'이 일정을 삭제할까요?','title',328);await text(state.deleteConfirm.id,'지원 기록은 유지돼요.','compact',328);await button(state.deleteConfirm.id,'취소',328,'ghost','CLOSE','CLOSE');await button(state.deleteConfirm.id,'일정 삭제',328,'primary','42:1209');
  // Historical Q2 actions stay in Q2.
  state.q2Menu=await popup('Q2 기록 메뉴',280,260);await clear(state.q2Menu.id);await text(state.q2Menu.id,'Q2 · 해결 과정 구체화','label');await button(state.q2Menu.id,'본문 보기',248,'ghost','42:2327');await button(state.q2Menu.id,'비교하기',248,'ghost','42:2327');await button(state.q2Menu.id,'병합하기',248,'ghost','42:2327');await button(state.q2Menu.id,'닫기',248,'ghost','CLOSE','CLOSE');
  state.completed.push('enhance');save();console.log('Enhanced prototype states created.');
 }
 if(phase==='prepare'&&!state.completed.includes('prepare')){
  // Fix text wrapping and inherited opaque fills discovered in the rendered screenshots.
  const doc=await call('get_document_info');
  for(const top of doc.children.filter(x=>x.type==='FRAME'&&!x.name.startsWith('JaNovel'))){
   const d=await info(top.id);
   for(const n of walk(d).filter(x=>x.name==='기록 본문'&&x.type==='FRAME')){
    await size(n.id,n.absoluteBoundingBox.width,350);
    for(const t of n.children.filter(x=>x.type==='TEXT')){const w=n.absoluteBoundingBox.width;await size(t.id,w,Math.max(26,Math.ceil((t.characters||'').length*13/w)*26));}
   }
   for(const card of walk(d).filter(x=>x.type==='FRAME'&&x.name.startsWith('일정 / '))){const strong=/루트페이|모노랩/.test(card.name),task=card.name.includes('브릭스'),box=card.children.find(x=>x.name==='일정 제목');if(box)await color(box.id,strong?'blue':task?'#F0F1F4':'soft');}
   for(const n of outer(d).filter(x=>['−','+','전체 맞춤'].includes(label(x))))await call('delete_node',{nodeId:n.id});
  }
  state.q2Compare=(await root('5:647','Q2 · 버전 비교')).id;
  state.q2Merge=(await root('37:441','Q2 · 병합')).id;
  for(const id of [state.q2Compare,state.q2Merge]){
   await replace(id,{'지원한 이유와 입사 후 목표를 작성해 주세요.':'개발 과정에서 어려웠던 문제와 해결 과정을 설명해 주세요.','v3 · 직무 연결':'v1 · 문제 정리','v3-A · 문장 정리':'v1-A · 다른 사례','v3 · 직무 연결  ⌄':'v1 · 문제 정리  ⌄','v3-A · 문장 정리  ⌄':'v2 · 해결 과정 구체화  ⌄','문서 관리 프로젝트에서':'문서 저장 API를 개발하며','데이터 저장':'복구 대상 기록','문서 버전 관리':'실패 요청 재처리','기록이 정확하게 남는지':'누락한 요청이 있는지','실패한 요청의 복구 경로를':'재시도와 중복 실행 여부를'});
  }
  const qm=await info(state.q2Menu.id);route(findLabel(qm,'비교하기').id,state.q2Compare);route(findLabel(qm,'병합하기').id,state.q2Merge);
  state.q2Branch=(await root('37:312','Q2 · 분기 이름과 설명')).id;
  const qbm=await info(state.q2Branch);for(const t of walk(qbm).filter(x=>x.type==='TEXT'))if(t.characters?.includes('v3'))await set(t.id,t.characters.replaceAll('v3','Q2 v2'));
  await button(state.q2Menu.id,'여기서 분기하기',248,'ghost',state.q2Branch);
  await size(state.q2Menu.id,280,304);
  state.questionAdd=await popup('문항 추가',440,286);await clear(state.questionAdd.id);await text(state.questionAdd.id,'문항 추가','title',408);await text(state.questionAdd.id,'문항 제목','caption');const fld=await clone('5:1020',state.questionAdd.id);await size(fld.id,408,44);await set(walk(await info(fld.id)).find(x=>x.type==='TEXT').id,'함께 일하는 방식과 협업 경험을 작성해 주세요.');await text(state.questionAdd.id,'최대 700자 · 공백 포함','caption');await button(state.questionAdd.id,'취소',408,'ghost','CLOSE','CLOSE');
  state.q3=(await root('42:745','Q3 작성 · 추가한 문항')).id;await replace(state.q3,{'지원한 이유와 입사 후 목표를 작성해 주세요.':'함께 일하는 방식과 협업 경험을 작성해 주세요.','Q1 · 기본':'Q3 · 기본','Q1':'Q3'});await button(state.questionAdd.id,'문항 추가',408,'primary',state.q3);
  state.addedProcedure=(await root('42:1748','채용 절차 · 단계 추가')).id;
  {const d=await info(state.addedProcedure),rows=walk(d).find(x=>x.name==='회사별 채용 단계'),last=rows.children.find(x=>x.name==='최종 면접');const n=await clone(last.id,rows.id);await call('rename_node',{nodeId:n.id,name:'처우 협의'});const field=outer(await info(n.id)).find(x=>x.name==='JaNovel/Field');await set(walk(field).find(x=>x.type==='TEXT').id,'처우 협의');await call('set_parent',{nodeId:n.id,parentId:rows.id,index:4});await size(rows.id,372,344);const dialog=d.children.find(x=>x.name==='스냅샷 이름·설명');await size(dialog.id,420,528);}
  state.removedProcedure??={};
  for(const stage of ['서류 전형','코딩테스트','기술 면접','최종 면접']){const r=await root('42:1748','채용 절차 · '+stage+' 삭제'),d=await info(r.id),rows=walk(d).find(x=>x.name==='회사별 채용 단계'),row=rows.children.find(x=>x.name===stage);if(row)await call('delete_node',{nodeId:row.id});state.removedProcedure[stage]=r.id;}
  state.uploaded=(await root('42:1314','공고 등록 · 이미지 선택 완료')).id;await replace(state.uploaded,{'이미지를 끌어다 놓거나 파일을 선택하세요.':'채용공고.png · 이미지 1개','파일 선택':'다른 파일 선택'});
  state.submittedPicker=await popup('제출 버전 · Q1 선택',340,224);await clear(state.submittedPicker.id);await text(state.submittedPicker.id,'Q1에 사용할 기록','label');for(const v of versions)await button(state.submittedPicker.id,versionNames[v],308,'ghost','42:1365');await button(state.submittedPicker.id,'닫기',308,'ghost','CLOSE','CLOSE');
  state.submittedQ2Picker=await popup('제출 버전 · Q2 선택',340,180);await clear(state.submittedQ2Picker.id);await text(state.submittedQ2Picker.id,'Q2에 사용할 기록','label');for(const v of ['v1 · 문제 정리','v2 · 해결 과정 구체화'])await button(state.submittedQ2Picker.id,v,308,'ghost','42:1365');await button(state.submittedQ2Picker.id,'닫기',308,'ghost','CLOSE','CLOSE');
  state.completed.push('prepare');save();
 }
 if(phase==='fix2'&&!state.completed.includes('fix2')){
  state.chatReply=(await root('5:530','AI 채팅 · 피드백 응답')).id;
  state.q2Reply=(await root('42:2327','Q2 · AI 채팅 피드백 응답')).id;
  for(const [id,question] of [[state.chatReply,'지원동기'],[state.q2Reply,'문제 해결 경험']]){
   const d=await info(id),chat=walk(d).find(x=>x.name==='AI 채팅'&&x.type==='FRAME');
   if(chat){const response=walk(chat).find(x=>x.name==='AI 응답');if(response){const ts=walk(response).filter(x=>x.type==='TEXT');if(ts[0])await set(ts[0].id,question+'에서 본인이 맡은 행동과 직무의 연결이 보이도록 정리해 보세요.');}}
  }
  state.todayAlias=(await root('42:1209','캘린더 · 오늘로 이동')).id;
  // A static completion badge has no misleading button affordance.
  const completed=await info(state.submitted),done=findLabel(completed,'제출 완료 ✓');if(done){const p=walk(completed).find(x=>x.children?.some(c=>c.id===done.id)),idx=p.children.findIndex(x=>x.id===done.id),t=await text(p.id,'제출 완료 ✓','label');await call('set_parent',{nodeId:t.id,parentId:p.id,index:idx});await call('delete_node',{nodeId:done.id});}
  // Include a version-specific Q2 read screen rather than routing through Q1.
  state.q2Read=(await root('42:2327','Q2 · 기록 본문')).id;await caption(state.q2Read,'v2 · 해결 과정 구체화 · 읽기 전용');
  const q=await info(state.q2Menu.id);route(findLabel(q,'본문 보기').id,state.q2Read);
  state.completed.push('fix2');save();
 }

 if(phase==='context'&&!state.completed.includes('context')){
  state.historicalMenus??={};state.q2Menus??={};state.companyDetails??={};
  for(const [key,title] of Object.entries({'v1':'첫 초안','v2':'경험 구체화','v2-A':'다른 도입','v2-B':'사례 중심 도입','v3-B':'성과 설명 보강'})){
   const read=await root(state.screens['기록 본문 · v3'],'기록 본문 · '+key);await replace(read.id,{'v3 · 직무 연결 · 읽기 전용':key+' · '+title+' · 읽기 전용'});
   const dlg=await root(state.branchDialogs.v3,'분기 만들기 · '+key);const d=await info(dlg.id);for(const t of walk(d).filter(n=>n.type==='TEXT'))if(t.characters?.includes('v3'))await set(t.id,t.characters.replaceAll('v3',key));
   const menu=await popup('노드 메뉴 · '+key,256,268);await clear(menu.id);await text(menu.id,key+' · '+title,'label');await button(menu.id,'본문 보기',224,'ghost',read.id);await button(menu.id,'비교하기',224,'ghost',state.screens['비교 상대 선택 · v3'],'OVERLAY');await button(menu.id,'병합하기',224,'ghost',state.screens['병합 상대 선택 · v3'],'OVERLAY');await button(menu.id,'여기서 분기하기',224,'ghost',dlg.id);await button(menu.id,'닫기',224,'ghost','CLOSE','CLOSE');state.historicalMenus[key]=menu.id;
  }
  for(const [key,title] of Object.entries({'v1':'문제 정리','v1-A':'다른 사례','v2':'해결 과정 구체화'})){
   const read=await root(state.q2Read,'Q2 · 기록 본문 '+key);await replace(read.id,{'v2 · 해결 과정 구체화 · 읽기 전용':key+' · '+title+' · 읽기 전용'});
   const menu=await popup('Q2 노드 메뉴 · '+key,280,276);await clear(menu.id);await text(menu.id,key+' · '+title,'label');await button(menu.id,'본문 보기',248,'ghost',read.id);await button(menu.id,'비교하기',248,'ghost',state.q2Compare);await button(menu.id,'병합하기',248,'ghost',state.q2Merge);await button(menu.id,'여기서 분기하기',248,'ghost',state.q2Branch);await button(menu.id,'닫기',248,'ghost','CLOSE','CLOSE');state.q2Menus[key]=menu.id;
  }
  for(const [company,job] of [['솔빛테크','서버 개발자'],['브릭스','백엔드 개발자'],['루트페이','결제 플랫폼 개발']]){
   const r=await root('42:1128','지원 상세 · '+company);await replace(r.id,{'모노랩':company,'Java / Spring 백엔드':job});state.companyDetails[company]=r.id;
   const ev=await info(state.eventDetails[company]);const b=findLabel(ev,'지원 상세 보기');if(b)route(b.id,r.id);
  }
  // Compare targets are already chosen from the graph. Static names avoid a second competing selector.
  const doc=await call('get_document_info');
  for(const top of doc.children.filter(x=>x.type==='FRAME'&&!x.name.startsWith('JaNovel'))){
   const d=await info(top.id),cmp=walk(d).find(x=>x.name==='두 스냅샷 비교');
   if(cmp&&top.id!=='42:458'&&top.id!=='42:975')for(const grp of walk(cmp).filter(x=>x.name==='비교 대상'))for(const b of outer(grp).filter(x=>label(x).includes('⌄'))){const par=walk(grp).find(x=>x.children?.some(n=>n.id===b.id)),idx=par.children.findIndex(n=>n.id===b.id),t=await text(par.id,label(b).replace(/\s*⌄$/,''),'label');await call('set_parent',{nodeId:t.id,parentId:par.id,index:idx});await call('delete_node',{nodeId:b.id});}
  }
  state.completed.push('context');save();
 }

 if(phase==='polish'&&!state.completed.includes('polish')){
  state.mergeNameDialog=(await root('5:912','병합 스냅샷 · 이름과 설명')).id;await replace(state.mergeNameDialog,{'스냅샷 남기기':'병합 스냅샷 남기기'});
  const m=await info(state.mergeNameDialog),ok=findLabel(m,'확인');if(ok)route(ok.id,state.mergeSnapshot,'OVERLAY');
  for(const [base,states] of Object.entries(state.folds))for(const [bits,id] of Object.entries(states))if(bits!=='00'){
   const d=await info(id),center=walk(d).find(x=>x.name==='작성·비교'),width=center.absoluteBoundingBox.width;
   for(const child of center.children||[])if(child.type==='FRAME'||child.type==='RECTANGLE')await size(child.id,width,child.absoluteBoundingBox.height);
   const essay=walk(center).find(x=>x.name==='자소서');if(essay){await size(essay.id,width-80,essay.absoluteBoundingBox.height);for(const t of essay.children.filter(x=>x.type==='TEXT'&&typeof x.characters==='string'&&x.characters.length))await size(t.id,width-80,Math.ceil(t.characters.length*14/(width-80))*30);}
   for(const [name,collapsed,source] of [['버전 패널 헤더',bits[0]==='1','5:618'],['채팅 패널 헤더',bits[1]==='1','5:553']])if(collapsed){const head=walk(d).find(x=>x.name===name);if(head){const b=outer(head).find(x=>x.name.includes('toggle'));if(b){await call('delete_node',{nodeId:b.id});const n=await clone(source,head.id);await size(n.id,16,32);}}}
  }
  const full=await info('15:342');
  for(const b of outer(full).filter(x=>label(x)==='여기서 분기'))await call('delete_node',{nodeId:b.id});
  const zoom=walk(full).find(x=>x.type==='TEXT'&&x.characters==='100%');if(zoom){const p=walk(full).find(x=>x.children?.some(y=>y.id===zoom.id));if(p)await call('delete_node',{nodeId:p.id});}
  const right=walk(full).find(x=>x.name==='수정본'&&x.type==='FRAME');if(right)for(const hit of outer(right)){const t=walk(hit).find(x=>x.type==='TEXT');if(t?.characters==='문서 버전 관리'){await set(t.id,'데이터 저장');await color(hit.id,'#F0F1F4');}}
  state.completed.push('polish');save();
 }

 if(phase==='finalfix'&&!state.completed.includes('finalfix')){
  route('42:2275',state.snapshotDone,'OVERLAY');
  for(const [v,id] of Object.entries(state.branchDialogs)){const d=await info(id),b=findLabel(d,'분기 만들기');if(b)route(b.id,state.branchResults[v]);}
  {const d=await info(state.q2Branch),b=findLabel(d,'분기 만들기');if(b)route(b.id,'42:2327');}
  state.q2Snapshot=(await root('5:912','Q2 · 스냅샷 이름과 설명')).id;
  await replace(state.q2Snapshot,{'지원한 이유와 입사 후 목표를 작성해 주세요.':'개발 과정에서 어려웠던 문제와 해결 과정을 설명해 주세요.','Q1':'Q2','Q1 · 기본':'Q2 · 기본','306 / 700자':'256 / 1,000자'});
  const doc=await call('get_document_info');for(const top of doc.children.filter(x=>x.type==='FRAME'&&(x.name.includes('Q2')||x.name.includes('42:2327')))){
   const d=await info(top.id),tool=walk(d).find(x=>x.name==='문항·작성 도구');
   for(const b of outer(tool||{children:[]}).filter(x=>label(x)==='스냅샷')){if(top.name.includes('기록 본문'))await call('delete_node',{nodeId:b.id});else route(b.id,state.q2Snapshot);}
   const ok=findLabel(d,'확인');if(top.id===state.q2Snapshot&&ok)route(ok.id,'42:2327');
  }
  state.completed.push('finalfix');save();
 }

 if(phase==='wire'){
  if(state.productCorrections?.checks?.length)throw Error('Legacy global wiring would overwrite reviewed per-context routes. Continue with refine-product-flow.mjs instead.');
  const doc=await call('get_document_info'),roots=doc.children.filter(x=>x.type==='FRAME'&&!x.name.startsWith('JaNovel'));
  const all=[];for(const r of roots)all.push(await info(r.id));
  const known=new Map(state.routes.map(r=>[r.id,r]));const add=(id,to,mode='NAVIGATE',extra={})=>known.set(id,{id,to,mode,...extra});
  let missing=[];state.expectedButtons=[];
  const foldById=new Map();for(const [base,states] of Object.entries(state.folds))for(const [key,id] of Object.entries(states))foldById.set(id,{base,key,states});
  for(const r of all){
   const nodes=walk(r),parent=new Map();for(const n of nodes)for(const ch of n.children||[])parent.set(ch.id,n);
   const isModal=!!r.children?.some(x=>x.name==='Modal backdrop');
   const nodesToWire=outer(r).filter(n=>n.name!=='JaNovel/Field');
   for(const n of nodesToWire){
    const s=label(n),p=parent.get(n.id),isGraph=['v3','v3-A','v4','draft','v1','v2','v2-A','v2-B','v3-B'].includes(n.name)||p?.name==='현재 주변 기록';
    const isQ2=r.name.includes('Q2')||r.id==='42:2327'||r.name.includes('42:2327');
    let target,mode='NAVIGATE',extra={};
    if(isGraph){const shown=walk(n).find(x=>x.type==='TEXT')?.characters?.split(' · ')[0]||n.name;target=n.name==='draft'?(isQ2?'42:2327':'5:530'):(isQ2?(state.q2Menus[shown]||state.q2Menu.id):(state.historicalMenus[n.name]||state.screens['노드 메뉴 · '+(n.name==='v3-A'?'v3A':n.name==='v4'?'v4':'v3')]));mode=n.name==='draft'?'NAVIGATE':'OVERLAY';}
    else if(n.name.includes('Panel toggle')){
     const f=foldById.get(r.id);if(f){const left=p?.name==='버전 패널 헤더',bits=f.key.split(''),ix=left?0:1;bits[ix]=bits[ix]==='0'?'1':'0';target=f.states[bits.join('')];}else target=r.id==='5:790'?'5:530':r.id==='37:441'?'5:530':'5:790';
    }
    else if(/^Q[123]$/.test(s))target=s==='Q2'?'42:2327':s==='Q3'?state.q3:'5:530';
    else if(s==='← 지원 현황'||s==='JaNovel')target='41:345';
    else if(s==='지원하러 가기 ↗'){target='https://example.com/';mode='URL';}
    else if(s==='+ 공고 등록')target='42:1257';
    else if(s==='제출 버전'||s==='제출 버전 보기'||s==='제출본 보기')target='42:1411';
    else if(s==='스냅샷')target='5:912';
    else if(s==='전체 보기')target='15:342';
    else if(s==='← 작성'||s==='작성으로 돌아가기')target=isQ2?'42:2327':'5:530';
    else if(s==='이 기록으로 복원')target='42:613';
    else if(s==='수정안 비교 →'||s==='작성본과 다시 비교')target='42:458';
    else if(s==='스냅샷으로 채택')target='42:2194';
    else if(s==='이유 확인')target='5:530';
    else if(s==='후보로 남기기')target='5:530';
    else if(s==='피드백 요청'||s==='요청 다시 시도'||s==='경험 정리하기')target=isQ2?state.q2Reply:state.chatReply;
    else if(s==='다시 연결'||s==='다시 시도')target='5:530';
    else if(s==='비교')target=isQ2?state.q2Compare:'5:647';
    else if(s==='병합')target=isQ2?state.q2Merge:'37:441';
    else if(s==='병합 스냅샷')target=state.mergeNameDialog;
    else if(s==='병합 중')continue;
    else if(s==='여기서 분기하기')target=isQ2?state.q2Branch:'37:312';
    else if(s==='오늘')target=r.id==='42:1209'?state.todayAlias:'42:1209';
    else if(s==='‹')target=state.screens['캘린더 · 2026년 10월'];
    else if(s==='›')target=state.screens['캘린더 · 2026년 12월'];
    else if(s==='주변 보기')target='5:647';
    else if(s==='분기 만들기')target=state.branchResults?.v3||'5:530';
    else if(s==='복원하기'){target=state.restoreDone;mode='OVERLAY';}
    else if(s==='수정 제안 1')target='42:458';
    else if(s==='이미지 선택')target=state.uploaded;
    else if(s==='여기서 분기')target='37:312';
    else if(s==='닫기'){target=r.id==='15:342'?'5:647':'CLOSE';mode=target==='CLOSE'?'CLOSE':'NAVIGATE';}
    else if(s==='×'){
     const row=parent.get(n.id);target=state.removedProcedure?.[row?.name];if(!target){target='CLOSE';mode='CLOSE';}
    }
    else if(s==='취소'){
     if(r.name.includes('상대 선택')||r.name.includes('문항 추가')||r.name.includes('일정 삭제')){target='CLOSE';mode='CLOSE';}
     else target=r.name.includes('공고 등록')?'41:345':r.name.includes('채용 절차')?'42:1128':r.name.includes('일정')?'42:1209':r.name.includes('AI 수정안')?'42:458':'5:530';
    }
    else if(s==='확인'){
     if(r.name.includes('분기'))target=Object.entries(state.branchDialogs||{}).find(([,id])=>id===r.id)?.[0]?state.branchResults[Object.entries(state.branchDialogs).find(([,id])=>id===r.id)[0]]:'5:530';
     else if(r.name.includes('복원')){target=state.restoreDone;mode='OVERLAY';}
     else if(r.name.includes('일정'))target='42:1209';
     else if(r.name.includes('스냅샷')){target=state.snapshotDone;mode='OVERLAY';}
     else target='5:530';
    }
    else if(s==='링크')target='42:1257';
    else if(s==='이미지')target='42:1314';
    else if(s==='텍스트')target='42:1476';
    else if(s==='직접 입력하기'||s==='정보 가져오기 →'||s==='공고 정보 추출 →'||s==='다시 가져오기')target='42:1525';
    else if(s==='파일 선택'||s==='다른 파일 선택')target=state.uploaded;
    else if(s==='입력으로 돌아가기')target='42:1257';
    else if(s==='등록하기')target='42:1128';
    else if(s==='등록하고 작성 →')target='42:745';
    else if(s==='자소서 작성 →')target='5:530';
    else if(s==='절차 수정')target='42:1748';
    else if(s==='+ 문항 추가'){target=state.questionAdd.id;mode='OVERLAY';}
    else if(s==='+ 단계 추가')target=state.addedProcedure;
    else if(s==='변경 적용'){target=state.saved;mode='OVERLAY';}
    else if(s==='+ 일정 추가'||s==='일정 추가')target=s==='일정 추가'?'42:1209':'42:1600';
    else if(s==='일정 삭제'){target=state.deleteConfirm.id;mode='OVERLAY';}
    else if(s==='제출 완료로 표시')target=state.submitted;
    else if(s==='선택한 버전 고정')target='42:1411';
    else if(s==='+ 제출 버전')target='42:1365';
    else if(s==='내용 복사'){target=state.copyDone;mode='OVERLAY';}
    else if(s.startsWith('전체 4건')||(['전체','서류 전형','기술 면접','과제 전형'].some(x=>s===x+'  ⌄')&&r.name.includes('지원 현황'))){target=state.filter.id;mode='OVERLAY';}
    else if(s.endsWith('⌄')&&(s.startsWith('서류')||s.startsWith('관심')||s.startsWith('최종')||s.startsWith('코딩')||s.startsWith('기술'))){target=state.statusMenu.id;mode='OVERLAY';}
    else if(s.endsWith('⌄')&&s.startsWith('v')){target=r.id==='42:1365'?(s.startsWith('v2')?state.submittedQ2Picker.id:state.submittedPicker.id):state.screens['비교 상대 선택 · v3'];mode='OVERLAY';}
    else if(s==='v4 · 병합')target=state.screens['기록 본문 · v4'];
    else if(s==='v2 · 해결 과정 구체화')target='42:2327';
    else if(['모노랩','솔빛테크','브릭스','루트페이'].includes(s)||s.endsWith('›')){const company=['모노랩','솔빛테크','브릭스','루트페이'].find(x=>label(p).includes(x));target=state.companyDetails[company]||'42:1128';}
    // Explicit per-context routes (created together with the UI) always win.
    if((!known.has(n.id)||s==='병합 스냅샷'||isGraph||['모노랩','솔빛테크','브릭스','루트페이'].includes(s)||s.endsWith('›'))&&target)add(n.id,target,mode,extra);
    const decorative=n.name==='JaNovel/Graph label'&&!known.has(n.id); // Static diff chips are not controls.
    if(!decorative){state.expectedButtons.push({id:n.id,label:s,root:r.id});if(!known.has(n.id))missing.push({id:n.id,label:s,root:r.id,name:n.name});}
   }
   for(const n of nodes){
    if(n.type==='ELLIPSE'&&/node$/.test(n.name)){const key=n.name.split(' ')[0],q2=r.name.includes('Q2')||r.name.includes('42:2327');add(n.id,key==='draft'?(q2?'42:2327':'5:530'):(q2?(state.q2Menus[key==='v3'?'v1':key==='v3-A'?'v1-A':key==='v4'?'v2':key]||state.q2Menu.id):(state.historicalMenus[key]||state.screens['노드 메뉴 · '+(key==='v3-A'?'v3A':key==='v4'?'v4':'v3')])),key==='draft'?'NAVIGATE':'OVERLAY');}
    if(n.type==='TEXT'&&!n.id.startsWith('I')){
     if(n.characters==='캘린더')add(n.id,'42:1209');
     if(n.characters==='지원 현황')add(n.id,'41:345');
     if(n.characters==='모노랩'&&parent.get(n.id)?.name==='회사와 직무')add(n.id,'42:1128');
     if(n.characters?.startsWith('숨긴 기록'))add(n.id,'15:342');
    }
    if(n.type==='FRAME'&&n.name.startsWith('일정 / ')){const company=n.name.split(' / ')[1];if(state.eventDetails[company])add(n.id,state.eventDetails[company],'OVERLAY');}
   }
  }
  // Correctly scoped calendar, branch and snapshot outcomes.
  for(const [v,id] of Object.entries(state.branchDialogs)){
   const d=all.find(x=>x.id===id),ok=findLabel(d,'분기 만들기')||findLabel(d,'확인');if(ok)add(ok.id,state.branchResults[v]);
  }
  for(const sel of state.selectors.filter(s=>all.flatMap(walk).some(n=>n.id===s.id))){const other=sel.side==='a'?sel.b:sel.a;add(sel.id,state.screens['비교 상대 선택 · '+other],'OVERLAY');}
  if(state.nodeNavigation?.direct)for(const r of known.values()){const read=state.nodeNavigation.readByMenu[r.to];if(read){r.to=read;r.mode='NAVIGATE';}}
  const cleared=[];
  const ownRoot=new Map(all.flatMap(r=>walk(r).map(n=>[n.id,r.id])));
  // The selected tab is already active; Figma rejects navigation to its own ancestor.
  for(const [id,r] of known){if(r.mode==='NAVIGATE'&&ownRoot.get(id)===r.to){const node=all.flatMap(walk).find(n=>n.id===id);if(label(node)==='오늘')known.set(id,{id,to:state.todayAlias,mode:'NAVIGATE'});else {cleared.push(id);known.delete(id);state.expectedButtons=state.expectedButtons.filter(x=>x.id!==id);}}}
  // Replace context popovers instead of stacking nested overlays.
  for(const r of known.values()){const root=all.find(n=>n.id===ownRoot.get(r.id));if(r.mode==='OVERLAY'&&root?.absoluteBoundingBox.width<500)r.mode='SWAP';}
  // Actual native Figma prototype reactions; ON_HOVER alone does not count as wired.
  const links=[...known.values()].map(r=>({nodeId:r.id,reactions:[{trigger:{type:'ON_CLICK'},actions:[r.mode==='CLOSE'?{type:'CLOSE'}:r.mode==='URL'?{type:'URL',url:r.to,openInNewTab:true}:{type:'NODE',destinationId:r.to,navigation:r.mode,transition:null,resetScrollPosition:false}]}]}));
  // Remove stale routes for controls deleted during the design revision.
  const ids=new Set(all.flatMap(walk).map(n=>n.id));const valid=[...links.filter(x=>ids.has(x.nodeId)),...cleared.map(nodeId=>({nodeId,reactions:[]}))];
  missing=missing.filter(x=>!known.has(x.id));fs.writeFileSync(dir+'/pending-links.json',JSON.stringify(valid));fs.writeFileSync(dir+'/unmatched.json',JSON.stringify(missing,null,2));for(let i=0;i<valid.length;i+=80){console.log('Writing batch',i);await call('janovel_set_reactions',{links:valid.slice(i,i+80)});}
  state.routes=[...known.values()].filter(r=>ids.has(r.id));save();
  fs.writeFileSync(dir+'/unmatched.json',JSON.stringify(missing,null,2));
  const read=[];for(let i=0;i<roots.length;i+=15)read.push(...await call('janovel_inspect_reactions',{nodeIds:roots.slice(i,i+15).map(x=>x.id)}));
  fs.writeFileSync(dir+'/reactions.json',JSON.stringify(read));fs.writeFileSync(dir+'/trees-final.json',JSON.stringify(all));
  const clicks=new Map(read.flatMap(r=>r.controls).map(n=>[n.id,n.reactions.filter(x=>x.trigger?.type==='ON_CLICK')]));
  const failed=state.routes.filter(r=>!clicks.get(r.id)?.some(re=>re.actions?.some(a=>r.mode==='CLOSE'?a.type==='CLOSE':r.mode==='URL'?a.type==='URL'&&a.url===r.to:a.type==='NODE'&&a.destinationId===r.to&&a.navigation===r.mode)));
  const out={checkedAt:new Date().toISOString(),roots:roots.length,written:valid.length,readBack:state.routes.length,missingButtons:missing,failed,prototypeUrl:'https://www.figma.com/proto/ArLSPAcNklUKhcpk8V4zyf/JaNovel?node-id=41-345'};
  fs.writeFileSync(dir+'/audit.json',JSON.stringify(out,null,2));
  console.log(JSON.stringify({roots:roots.length,written:valid.length,failed:failed.length,missing}));
 }

 console.log(JSON.stringify({phase,completed:state.completed,screens:Object.keys(state.screens).length,routes:state.routes.length}));
}finally{save();c.close();}
