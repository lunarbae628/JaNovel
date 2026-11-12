import fs from 'node:fs';
import {connect} from './talk-channel.mjs';
const dir='/Users/moon/Desktop/Works/job-application-service/_workspace/2026-11-08-interactions';
fs.mkdirSync(dir,{recursive:true});
const statePath=dir+'/state.json';
const state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):{screens:{},routes:[],completed:[]};
const c=await connect(process.argv[2]||'r0hguhks');
const raw=c.call;
const save=()=>fs.writeFileSync(statePath,JSON.stringify(state,null,2));
async function call(cmd,p={}){const r=await raw(cmd,p);if(r?.replacementsFailed)throw Error('Some text replacements failed');return r;}
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

const phase=process.argv[3]||'design';
try{
 if(phase==='design'&&!state.completed.includes('design')){
  const doc=await call('get_document_info');
  for(const r of doc.children.filter(x=>x.type==='FRAME'&&!x.name.startsWith('JaNovel'))){
   const data=await info(r.id);
   for(const t of walk(data).filter(x=>x.type==='TEXT'))if(t.characters==='제출본'){await set(t.id,'제출 버전');const owner=walk(data).find(x=>x.children?.some(c=>c.id===t.id));if(owner?.type==='INSTANCE')await size(owner.id,104,36);}
   const tool=walk(data).find(x=>x.name==='문항·작성 도구');
   if(tool){const remove=tool.children.filter(x=>x.type==='INSTANCE'&&walk(x).some(t=>t.type==='TEXT'&&['비교','병합','여기서 분기하기'].includes(t.characters)));if(remove.length)await call('delete_multiple_nodes',{nodeIds:remove.map(x=>x.id)});}
  }
  await replace('42:1365',{'제출본 지정':'제출할 버전 선택','제출본 확정':'선택한 버전 고정'});
  await replace('42:1411',{'제출본 · 11.18 16:20':'제출 버전 · 11.18 16:20','+ 새 제출본':'+ 제출 버전'});
  for(const [id,label] of [['42:1128','제출본 보기'],['42:1525','제출본 보기']])await replace(id,{[label]:'제출 버전 보기'});
  for(const v of versions){
   const read=await root('5:530','기록 본문 · '+v);
   const n=await info(read.id),editor=walk(n).find(x=>x.name==='자소서');
   const body=editor.children.filter(x=>x.type==='TEXT');for(const [i,t] of body.entries())await set(t.id,paras(fixture[v])[i]||'');
   const count=walk(editor).find(x=>x.type==='TEXT'&&x.characters?.includes('/ 700자'));if(count)await set(count.id,paras(fixture[v]).join('\n\n').length+' / 700자');
   const toolbar=walk(n).find(x=>x.name==='문항·작성 도구');
   for(const b of toolbar.children.filter(x=>x.type==='INSTANCE'&&walk(x).some(t=>t.type==='TEXT'&&t.characters==='스냅샷')))await call('delete_node',{nodeId:b.id});
   await text(toolbar.id,versionNames[v]+' · 읽기 전용','caption');await button(toolbar.id,'작성으로 돌아가기',144,'ghost','5:530');
   const menu=await popup('노드 메뉴 · '+v,256,268);
   const heading=await frame(menu.id,'선택한 기록',224,30,'HORIZONTAL',{primaryAxisAlignItems:'SPACE_BETWEEN',counterAxisAlignItems:'CENTER'});
   await text(heading.id,versionNames[v],'label');await button(heading.id,'×',28,'ghost','CLOSE','CLOSE');await divider(menu.id,224);
   await button(menu.id,'본문 보기',224,'ghost',read.id);await button(menu.id,'비교하기',224);await button(menu.id,'병합하기',224);await button(menu.id,'여기서 분기하기',224,'ghost','37:312');
  }
  for(const a of versions)for(const b of versions)if(a!==b)await buildCompare(a,b);
  for(const a of versions){
   for(const kind of ['비교','병합']){
    const p=await popup(kind+' 상대 선택 · '+a,340,236);await text(p.id,kind+'할 기록 선택','title',308);await text(p.id,'선택한 기록: '+versionNames[a],'caption');
    for(const b of versions.filter(x=>x!==a))await button(p.id,versionNames[b],308,'ghost',kind==='비교'?state.pairs[a+'|'+b]:'37:441');
    await button(p.id,'취소',308,'ghost','CLOSE','CLOSE');
   }
   const menu=await info(state.screens['노드 메뉴 · '+a]);
   for(const child of menu.children){const label=walk(child).find(x=>x.type==='TEXT')?.characters;if(label==='비교하기')route(child.id,state.screens['비교 상대 선택 · '+a],'OVERLAY');if(label==='병합하기')route(child.id,state.screens['병합 상대 선택 · '+a],'OVERLAY');}
  }
  await buildCalendar('42:1209');
  for(const [month,title] of [[9,'캘린더 · 2026년 10월'],[11,'캘린더 · 2026년 12월']]){const r=await root('42:1209',title);await buildCalendar(r.id,2026,month);}
  for(const name of ['일정 추가·수정 · Desktop','일정 수정 · 삭제 가능']){
    const source=name==='일정 추가·수정 · Desktop'?'42:1600':'42:2063';
    const d=await info(source),calendar=await info('42:1209');
    const body=d.children.find(x=>x.name==='월별 일정');if(body)await call('delete_node',{nodeId:body.id});
    const cal=calendar.children.find(x=>x.name==='월별 일정');if(cal){const bg=await clone(cal.id,source,0,0,2);}
  }
  state.completed.push('design');save();console.log('Graph menus, comparison targets and calendar updated.');
 }
 console.log(JSON.stringify({screens:state.screens,pairs:state.pairs,routes:state.routes.length}));
}finally{c.close();}
