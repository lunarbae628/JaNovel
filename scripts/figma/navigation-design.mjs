import fs from 'node:fs';
import {connect} from './talk-channel.mjs';

const dir='_workspace/2026-11-13-navigation';
fs.mkdirSync(dir,{recursive:true});
const ledger=dir+'/state.json';
const state=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger)):{screens:{},links:[]};
const save=()=>fs.writeFileSync(ledger,JSON.stringify(state,null,2));
const c=await connect(process.argv[2]||'o771e1fk');
const call=(name,args={})=>c.call(name,args);
const rgb=h=>({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255});
const C={paper:'#FFFFFF',panel:'#F7F7F8',ink:'#302B27',muted:'#666B73',blue:'#274690',soft:'#EDF1F9',line:'#E4E4E7'};
const walk=n=>[n,...(n.children||[]).flatMap(walk)];
const pending=[];
const link=(id,to)=>state.links.push({id,to});
const info=id=>call('get_node_info',{nodeId:id});
async function frame(parent,name,x,y,w,h,fill='paper',border=false){
 return call('create_frame',{parentId:parent,name,x,y,width:w,height:h,layoutMode:'NONE',fillColor:rgb(C[fill]||fill),...(border?{strokeColor:rgb(C.line),strokeWeight:1}:{})});
}
async function text(parent,value,x,y,w,size=14,tone='ink',weight='regular'){
 const source=weight==='bold'?'5:610':weight==='medium'?'5:539':tone==='muted'?'5:540':'5:612';
 const n=await call('clone_node',{nodeId:source});
 await call('set_parent',{nodeId:n.id,parentId:parent,x,y});
 pending.push({id:n.id,width:w,text:value,props:{name:value.slice(0,44),fontSize:size,lineHeight:{unit:'PIXELS',value:Math.round(size*1.65)},textAutoResize:'HEIGHT'}});
 await call('set_fill_color',{nodeId:n.id,...rgb(C[tone]||tone)});
 return n;
}
async function box(parent,label,x,y,w=120,primary=false,to){
 const n=await call('clone_node',{nodeId:primary?'4:173':'4:187'});
 await call('set_parent',{nodeId:n.id,parentId:parent,x,y});
 const d=await info(n.id);
 const t=d.children.find(n=>n.type==='TEXT');
 pending.push({id:n.id,width:w,height:38,props:{name:label,cornerRadius:6,paddingLeft:12,paddingRight:12,itemSpacing:6,primaryAxisAlignItems:'CENTER',counterAxisAlignItems:'CENTER'}},{id:t.id,text:label,props:{fontSize:13,lineHeight:{unit:'PIXELS',value:20}}});
 for(const a of d.children.filter(n=>n.type==='INSTANCE'))pending.push({id:a.id,props:{visible:false}});
 if(!primary)await call('set_stroke_color',{nodeId:n.id,color:{...rgb(C.line),a:1},weight:1});
 if(to)link(n.id,to);return n;
}
async function rule(p,x,y,w){return frame(p,'구분선',x,y,w,1,'line');}
async function icon(p,key,x,y){return call('create_component_instance',{componentId:state.icons[key],parentId:p,x,y});}
async function tag(p,label,x,y,w=74,tone='soft'){
 const f=await frame(p,label,x,y,w,26,tone);await call('set_corner_radius',{nodeId:f.id,radius:4});await text(f.id,label,8,3,w-12,12,tone==='soft'?'blue':'muted');return f;
}
async function shell(key,title,index,active=key,sub=''){
 const n=await frame(state.section,key,48+(index%3)*1520,160+Math.floor(index/3)*1000,1440,900);
 state.screens[key]=n.id;save();
 const side=await frame(n.id,'전역 내비게이션',0,0,216,900,'panel');
 await text(side.id,'JaNovel.',24,28,154,23,'#1B264F','bold');
 await rule(side.id,16,82,184);
 for(const [i,[name,glyph]]of [['지원 현황','briefcase-business'],['일정','calendar-days'],['면접 준비','messages-square']].entries()){
  const y=110+i*48;const r=await frame(side.id,'메뉴 / '+name,12,y,192,42,name===active?'soft':'panel');
  await call('set_corner_radius',{nodeId:r.id,radius:6});
  await icon(r.id,glyph,14,12);await text(r.id,name,44,10,128,14,name===active?'blue':'ink',name===active?'medium':'regular');
  if(name===active)await frame(r.id,'현재 위치',0,12,2,18,'blue');
  link(r.id,name);
 }
 await text(side.id,'최근 작성',24,338,150,12,'muted');
 for(const [i,[company,role]]of [['모노랩','Java / Spring 백엔드'],['솔빛테크','서버 개발자']].entries()){
  const r=await frame(side.id,'최근 작성 / '+company,12,367+i*64,192,58,'panel');
  await text(r.id,company,12,7,162,13,'ink','medium');await text(r.id,role,12,30,162,12,'muted');link(r.id,'writer');
 }
 await rule(side.id,16,760,184);
 await icon(side.id,'settings-2',26,786);await text(side.id,'설정',56,783,124,13);
 await text(side.id,'배문성',24,842,154,13,'ink','medium');
 await rule(n.id,216,0,1);await frame(n.id,'세로 경계',215,0,1,900,'line');
 await text(n.id,title,252,28,860,22,'ink','bold');if(sub)await text(n.id,sub,252,70,1000,12,'muted');
 await rule(n.id,216,104,1224);return n;
}
async function sectionTitle(p,label,x,y,w=500){await text(p,label,x,y,w,16,'ink','medium');}
async function sourceLine(p,label,detail,x,y,w=430,to){
 const r=await frame(p,label,x,y,w,54,'paper',true);await call('set_corner_radius',{nodeId:r.id,radius:6});
 await icon(r.id,'file-text',12,17);await text(r.id,label,42,7,w-60,13,'ink','medium');await text(r.id,detail,42,29,w-60,11,'muted');if(to)link(r.id,to);return r;
}

try{
 const mode=process.argv[3]||'build';
 if(mode==='inspect'){
  const d=await call('janovel_design_inventory');fs.writeFileSync(dir+'/before.json',JSON.stringify(d));
  console.log(JSON.stringify({roots:d.roots.length,bottom:Math.max(...d.roots.map(n=>n.y+n.height)),sections:d.sections}));
 }
 if(mode==='build'){
  if(state.section)throw Error('Existing section: inspect before modifying');
  const before=await call('janovel_design_inventory');fs.writeFileSync(dir+'/before.json',JSON.stringify(before));
  const bottom=Math.max(...before.roots.filter(n=>n.x<12000).map(n=>n.y+n.height));
  const section=await call('create_section',{name:'07 · 취업 준비 / 전역 메뉴와 면접',x:0,y:bottom+240,width:4600,height:2220});state.section=section.id;save();
  const {renderToStaticMarkup}=await import('../../frontend/node_modules/react-dom/server.node.js');
  const React=(await import('../../frontend/node_modules/react/index.js')).default;
  const lucide=await import('../../frontend/node_modules/lucide-react/dist/cjs/lucide-react.js');
  const names={'briefcase-business':'BriefcaseBusiness','calendar-days':'CalendarDays','messages-square':'MessagesSquare','settings-2':'Settings2','file-text':'FileText','mic':'Mic','chevron-right':'ChevronRight','search':'Search','plus':'Plus','arrow-left':'ArrowLeft'};
  const svgs=Object.fromEntries(Object.entries(names).map(([k,n])=>[k,renderToStaticMarkup(React.createElement(lucide[n],{size:18,strokeWidth:1.5}))]));
  state.icons=(await call('janovel_compact_assets',{svgs})).icons;save();
  await text(section.id,'지원 → 작성 → 제출본 확인 → 면접 준비',48,32,3000,24,'ink','bold');
  await text(section.id,'관리 화면에는 공통 메뉴 · 작성 화면은 집중 모드 유지 · 모든 회사·일정·질문은 디자인용 예시',48,80,3000,14,'muted');

  const apps=await shell('지원 현황','지원 현황',0,'지원 현황');
  await box(apps.id,'+ 공고 등록',1272,25,132,true,'posting');
  await sectionTitle(apps.id,'다가오는 일정',252,134);
  const next=await frame(apps.id,'다가오는 일정',252,174,1152,82,'panel');await call('set_corner_radius',{nodeId:next.id,radius:8});
  await tag(next.id,'11.19 목',16,26,78);await text(next.id,'솔빛테크 · 기술 면접',114,14,420,15,'ink','medium');await text(next.id,'14:00 · 온라인',114,44,420,12,'muted');await box(next.id,'면접 준비',1002,22,132,false,'면접 상세');
  await text(apps.id,'전체 4    관심 1    작성 중 1    전형 진행 2',252,286,760,13,'ink','medium');
  await box(apps.id,'회사·직무 검색',1074,279,194,false);await box(apps.id,'전체 단계',1278,279,126,false);
  const rows=[['모노랩','Java / Spring 백엔드','11.20 · 서류 마감','작성 중'],['솔빛테크','서버 개발자','11.19 14:00 · 기술 면접','기술 면접'],['브릭스','백엔드 개발자','11.16 · 과제 제출','과제 전형'],['루트페이','결제 플랫폼 개발','11.18 · 지원 마감','관심']];
  await rule(apps.id,252,332,1152);
  for(const[i,[company,role,date,stage]]of rows.entries()){
   const y=333+i*88,r=await frame(apps.id,'지원 항목 / '+company,252,y,1152,88,'paper');
   await text(r.id,company,8,20,220,15,'ink','medium');await text(r.id,role,248,20,350,14);await text(r.id,date,654,21,280,13,'muted');await tag(r.id,stage,988,19,112,stage==='기술 면접'?'soft':'panel');await icon(r.id,'chevron-right',1120,25);link(r.id,'writer');await rule(apps.id,252,y+87,1152);
  }

  const cal=await shell('일정','일정',1,'일정');
  await box(cal.id,'+ 일정 추가',1272,25,132,true,'일정 추가');
  await sectionTitle(cal.id,'2026년 11월',252,134);await box(cal.id,'오늘',972,126,70,false);await box(cal.id,'‹',1050,126,38,false);await box(cal.id,'›',1096,126,38,false);
  await text(cal.id,'● 마감     ● 면접     ● 과제',252,177,750,12,'muted');
  const gx=252,gy=222,cw=126,ch=108;
  for(const[i,d]of '일월화수목금토'.split('').entries())await text(cal.id,d,gx+i*cw+12,gy-26,100,12,'muted');
  const ev={12:['솔빛테크','기술 면접 14:00','soft'],16:['브릭스','과제 제출','panel'],18:['루트페이','지원 마감','panel'],19:['솔빛테크','기술 면접 14:00','soft'],20:['모노랩','서류 마감','panel']};
  for(let i=0;i<35;i++){
   const day=i+1,valid=day<=30,r=await frame(cal.id,'날짜 / '+day,gx+(i%7)*cw,gy+Math.floor(i/7)*ch,cw,ch,'paper',true);
   if(valid){await text(r.id,String(day),10,8,40,12,day===13?'blue':'muted');if(day===13)await frame(r.id,'오늘 표시',10,31,15,2,'blue');}
   if(ev[day]){const[company,name,tone]=ev[day],e=await frame(r.id,'일정 / '+company,6,42,cw-12,54,tone);await call('set_corner_radius',{nodeId:e.id,radius:4});await text(e.id,company,8,5,cw-28,12,tone==='soft'?'blue':'ink','medium');await text(e.id,name,8,28,cw-28,10,'muted');link(e.id,'일정 추가');}
  }
  await frame(cal.id,'날짜 상세 경계',1160,126,1,678,'line');await sectionTitle(cal.id,'11월 19일 목요일',1184,134,220);await tag(cal.id,'면접',1184,184,54);await text(cal.id,'솔빛테크',1184,230,210,17,'ink','medium');await text(cal.id,'기술 면접\n14:00 · 온라인',1184,267,210,13);await box(cal.id,'면접 준비',1184,346,210,true,'면접 상세');await box(cal.id,'일정 수정',1184,394,210,false,'일정 추가');

  const interviews=await shell('면접 준비','면접 준비',2,'면접 준비');
  await text(interviews.id,'예정 2',252,134,120,14,'blue','medium');await text(interviews.id,'연습 기록',364,134,180,14,'muted');await rule(interviews.id,252,170,1152);
  for(const[i,[company,role,date,stage]]of [['솔빛테크','서버 개발자','11월 19일 목요일 · 14:00','기술 면접'],['모노랩','Java / Spring 백엔드','일정 미정','서류 전형']].entries()){
   const y=202+i*190,r=await frame(interviews.id,'면접 준비 / '+company,252,y,1152,162,'paper',true);await call('set_corner_radius',{nodeId:r.id,radius:8});
   await tag(r.id,stage,24,20,88);await text(r.id,company,24,61,400,19,'ink','medium');await text(r.id,role,24,101,400,13,'muted');await text(r.id,date,506,25,400,14);
   await text(r.id,i?'제출본 없음 · 현재 작성본으로 연습 가능':'제출본 11.10 · 예상 질문 6개',506,67,440,13,'muted');await box(r.id,'준비하기',990,98,138,true,'면접 상세');
  }
  await sectionTitle(interviews.id,'최근 연습',252,632);await text(interviews.id,'솔빛테크 · 기술 면접',252,682,620,14,'ink','medium');await text(interviews.id,'11.12 · 질문 4개 · 답변 메모 3개',252,716,700,13,'muted');await box(interviews.id,'기록 보기',1244,682,160,false,'연습 기록');

  const prep=await shell('면접 상세','솔빛테크 · 기술 면접',3,'면접 준비','면접 준비 / 솔빛테크');
  await box(prep.id,'목록',1272,25,132,false,'면접 준비');
  const ctx=await frame(prep.id,'참고할 자료',252,134,336,692,'panel');await call('set_corner_radius',{nodeId:ctx.id,radius:8});
  await sectionTitle(ctx.id,'참고할 자료',20,20,296);await text(ctx.id,'실제 제출한 내용을 기준으로 연습',20,55,296,12,'muted');
  await sourceLine(ctx.id,'제출본 · 11.10','Q1–Q3 · 제출 당시 내용',20,94,296,'submission');await sourceLine(ctx.id,'채용 공고','서버 개발자 · Java / Spring',20,164,296,'detail');
  await box(ctx.id,'자료 변경',20,316,296,false,'자료 선택');await text(ctx.id,'면접 일정',20,414,296,12,'muted');await text(ctx.id,'11.19 (목) 14:00\n온라인 · 기술 면접',20,446,296,14);
  await sectionTitle(prep.id,'예상 질문',620,138);await box(prep.id,'질문 추가',1264,128,140,false,'질문 추가');
  const qs=[['01','실패한 요청의 복구 경로를 어떻게 설계했나요?','제출본 Q2 · 문서 정합성 개선'],['02','정합성이 개선됐다는 것을 어떻게 확인했나요?','제출본 Q2 · 검증 방법'],['03','코드 리뷰에서 의견이 달랐을 때 어떻게 조율했나요?','제출본 Q3 · 협업 경험']];
  for(const[i,[number,q,source]]of qs.entries()){
   const y=194+i*118,r=await frame(prep.id,'예상 질문 '+number,620,y,784,102,i?'paper':'soft',true);await call('set_corner_radius',{nodeId:r.id,radius:7});await text(r.id,number,16,18,30,12,'muted');await text(r.id,q,58,16,700,15,'ink','medium');await text(r.id,source,58,57,650,12,'muted');link(r.id,'연습 화면');
  }
  await text(prep.id,'답변 메모',620,582,600,13,'ink','medium');const memo=await frame(prep.id,'답변 메모 입력',620,614,784,96,'paper',true);await call('set_corner_radius',{nodeId:memo.id,radius:6});await text(memo.id,'핵심 근거와 설명 순서를 적어두세요.',14,12,750,13,'muted');
  await box(prep.id,'텍스트로 연습',620,758,180,true,'연습 화면');await box(prep.id,'음성으로 연습',816,758,180,false,'음성 안내');await text(prep.id,'연습은 제출본을 수정하지 않습니다.',1020,767,384,12,'muted');

  const practice=await shell('연습 화면','솔빛테크 · 면접 연습',5,'면접 준비','질문 1 / 3 · 텍스트 연습');
  await box(practice.id,'준비 화면',1252,25,152,false,'면접 상세');
  await text(practice.id,'실패한 요청의 복구 경로를 어떻게 설계했나요?',292,156,1000,22,'ink','bold');await text(practice.id,'출처 · 제출본 Q2 / 문서 정합성 개선',292,204,1000,12,'muted');
  const answer=await frame(practice.id,'답변 작성',292,274,1072,244,'paper',true);await call('set_corner_radius',{nodeId:answer.id,radius:8});await text(answer.id,'답변을 작성하세요.',20,18,1032,14,'muted');await box(practice.id,'답변 확인',1192,538,172,true,'연습 기록');
  await rule(practice.id,292,612,1072);await text(practice.id,'답변할 때 확인할 내용',292,640,1000,14,'ink','medium');await text(practice.id,'어떤 실패를 발견했는지 → 왜 이 방식을 선택했는지 → 어떻게 검증했는지',292,680,1000,14,'muted');

  for(let i=0;i<pending.length;i+=60)await call('janovel_patch_nodes',{patches:pending.slice(i,i+60)});
  state.pendingCount=pending.length;save();
  console.log(JSON.stringify({section:state.section,screens:state.screens,pending:pending.length}));
 }
 if(mode==='refine'){
  const removed=new Set();
  for(const id of Object.values(state.screens)){
   const d=await info(id);
   const remove=walk(d).filter(n=>n.name==='메뉴 / 경험·자료'||n.name==='문서 정합성 개선'&&n.type==='FRAME');
   if(d.id===state.screens['경험·자료'])remove.splice(0,remove.length,d);
   for(const n of remove){walk(n).forEach(n=>removed.add(n.id));await call('delete_node',{nodeId:n.id});}
  }
  delete state.screens['경험·자료'];state.links=state.links.filter(l=>!removed.has(l.id)&&l.to!=='경험·자료');save();
  for(const label of ['지원 현황','일정']){
   const d=await info(state.screens[label]);
   if(label==='지원 현황'){
    const hint=walk(d).find(n=>n.type==='TEXT'&&n.characters==='항목을 선택하면 자소서 작성으로 이동합니다.');if(hint)await call('delete_node',{nodeId:hint.id});
    const old=walk(d).find(n=>n.type==='INSTANCE'&&n.name==='회사·직무 검색');if(old)await call('delete_node',{nodeId:old.id});
    const search=await frame(d.id,'회사·직무 검색',1074,279,194,38,'paper',true);await call('set_corner_radius',{nodeId:search.id,radius:6});await icon(search.id,'search',12,10);await text(search.id,'회사·직무 검색',40,8,144,12,'muted');
   }else{
    const selected=walk(d).find(n=>n.name==='날짜 / 19');await call('set_fill_color',{nodeId:selected.id,...rgb(C.soft)});await call('set_stroke_color',{nodeId:selected.id,color:{...rgb(C.blue),a:1},weight:1.5});
    const legend=walk(d).find(n=>n.type==='TEXT'&&n.characters==='● 마감     ● 면접     ● 과제');if(legend)await call('delete_node',{nodeId:legend.id});
    for(const[i,[name,tone]]of [['마감','#302B27'],['면접','#274690'],['과제','#576CA8']].entries())await text(d.id,'● '+name,252+i*78,177,76,12,tone);
   }
  }
  if(!state.screens['연습 기록']){
   const r=await shell('연습 기록','솔빛테크 · 연습 기록',4,'면접 준비','11.12 · 텍스트 연습');
   await box(r.id,'준비 화면',1252,25,152,false,'면접 상세');await tag(r.id,'질문 1 / 3',252,134,96);
   await text(r.id,'실패한 요청의 복구 경로를 어떻게 설계했나요?',252,194,1120,21,'ink','bold');
   await text(r.id,'내 답변',252,260,1120,13,'muted');await text(r.id,'본문 저장 뒤 메타데이터 반영이 실패하는 경로를 확인했습니다. 작업을 시작하기 전에 대상 정보와 상태를 남기고, 실패 시 이 기록을 근거로 복구하도록 구성했습니다.',252,298,1120,16);
   await rule(r.id,252,394,1152);await sectionTitle(r.id,'다음에 보완할 내용',252,424);
   await text(r.id,'설계 선택',252,476,170,13,'blue','medium');await text(r.id,'왜 작업 전에 기록했는지, 기존 방식과 비교해 설명해 보세요.',450,476,920,14);
   await text(r.id,'검증 근거',252,534,170,13,'blue','medium');await text(r.id,'복구 작업의 반복 실행과 중복 처리 여부를 어떻게 확인했는지 덧붙여 보세요.',450,534,920,14);
   await text(r.id,'추가 질문',252,592,170,13,'blue','medium');await text(r.id,'작업 기록 자체가 실패한다면 어떻게 처리하나요?',450,592,920,14);
   await text(r.id,'복기 메모',252,678,1120,13,'ink','medium');const m=await frame(r.id,'복기 메모',252,712,1152,82,'paper',true);await call('set_corner_radius',{nodeId:m.id,radius:6});await text(m.id,'검증 방법을 먼저 말하고 실패 상황별 복구 경로를 설명하기',16,16,1120,14);
   await box(r.id,'다시 연습',252,826,140,true,'연습 화면');await box(r.id,'자소서 확인',408,826,140,false,'writer');
  }
  await call('resize_node',{nodeId:state.section,width:4600,height:3000});
  for(let i=0;i<pending.length;i+=60)await call('janovel_patch_nodes',{patches:pending.slice(i,i+60)});save();console.log(JSON.stringify({removed:removed.size,screens:state.screens}));
 }
 if(mode==='dialogs'){
  if(state.dialogs)throw Error('Dialogs already exist; inspect before retrying');state.dialogs={};save();
  async function dialog(key,title,index,h=390){
   const r=await frame(state.section,key,48+index*620,2220,560,h,'paper',true);await call('set_corner_radius',{nodeId:r.id,radius:10});state.dialogs[key]=r.id;save();await text(r.id,title,24,22,512,20,'ink','bold');return r;
  }
  const date=await dialog('일정 추가','일정',0,468);await text(date.id,'솔빛테크 · 기술 면접',24,72,512,15,'ink','medium');
  for(const[i,[label,value]]of [['제목','기술 면접'],['날짜·시간','2026.11.19 · 14:00'],['장소','온라인']].entries()){
   await text(date.id,label,24,121+i*82,512,12,'muted');const f=await frame(date.id,label+' 입력',24,148+i*82,512,38,'paper',true);await call('set_corner_radius',{nodeId:f.id,radius:5});await text(f.id,value,12,8,488,13);
  }
  await box(date.id,'취소',314,406,94,false,'CLOSE');await box(date.id,'확인',424,406,112,true,'CLOSE');
  const materials=await dialog('자료 선택','연습 기준',1,454);await text(materials.id,'제출한 내용 또는 현재 작성본을 선택하세요.',24,72,512,13,'muted');
  await sourceLine(materials.id,'제출본 · 11.10','Q1–Q3 · 제출 당시 내용',24,124,512,'CLOSE');await sourceLine(materials.id,'현재 작성본','저장된 제출본과 다를 수 있어요.',24,194,512,'CLOSE');await text(materials.id,'공고 정보는 함께 참고합니다.',24,282,512,13,'muted');await box(materials.id,'취소',314,392,94,false,'CLOSE');await box(materials.id,'선택',424,392,112,true,'CLOSE');
  const q=await dialog('질문 추가','질문 추가',2,350);await text(q.id,'질문',24,80,512,12,'muted');const input=await frame(q.id,'질문 입력',24,112,512,120,'paper',true);await call('set_corner_radius',{nodeId:input.id,radius:5});await text(input.id,'연습할 질문을 입력하세요.',12,12,488,13,'muted');await box(q.id,'취소',314,288,94,false,'CLOSE');await box(q.id,'추가',424,288,112,true,'CLOSE');
  const voice=await dialog('음성 안내','음성 면접',3,270);await text(voice.id,'아직 사용할 수 없는 기능입니다.\n지금은 텍스트로 답변을 연습할 수 있어요.',24,88,512,14);await box(voice.id,'닫기',424,208,112,true,'CLOSE');
  for(let i=0;i<pending.length;i+=60)await call('janovel_patch_nodes',{patches:pending.slice(i,i+60)});save();console.log(JSON.stringify(state.dialogs));
 }
 if(mode==='links'){
  const targets={...state.screens,writer:'5:530',posting:'42:1257',submission:state.dialogs['제출본 확인']||'42:1411',detail:'42:1128',솔빛테크:'89:50209',브릭스:'89:50425',루트페이:'89:50641'};
  const owners=new Map();for(const id of Object.values(state.screens)){const d=await info(id);for(const n of walk(d))owners.set(n.id,id);}
  const entries=state.links.filter(l=>l.to==='CLOSE'||owners.get(l.id)!==targets[l.to]);
  const links=entries.map(l=>({nodeId:l.id,reactions:l.to==='CLOSE'?[{trigger:{type:'ON_CLICK'},actions:[{type:'CLOSE'}]}]:[{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:state.dialogs?.[l.to]||targets[l.to],navigation:state.dialogs?.[l.to]?'OVERLAY':'NAVIGATE',transition:null}]}]}));
  const missing=state.links.filter(l=>l.to!=='CLOSE'&&!state.dialogs?.[l.to]&&!targets[l.to]);if(missing.length)throw Error('Missing targets '+JSON.stringify(missing));
  const before=await call('janovel_inspect_reactions',{nodeIds:Object.values(state.screens)});fs.writeFileSync(dir+'/reactions-before.json',JSON.stringify(before));
  const allBefore=await call('janovel_inspect_reactions',{nodeIds:[...Object.values(state.screens),...Object.values(state.dialogs)]});
  const clear=allBefore.flatMap(r=>r.controls.map(n=>({nodeId:n.id,reactions:[]})));
  for(let i=0;i<clear.length;i+=50)await call('janovel_set_reactions',{links:clear.slice(i,i+50)});
  for(let i=0;i<links.length;i++){
   try{await call('janovel_set_reactions',{links:[links[i]]});}
   catch(e){console.log(JSON.stringify({failed:i,link:entries[i],error:e.message}));throw e;}
  }
  const backLinks=[];
  for(const id of ['5:530','89:50209','89:50425','89:50641','42:1128']){
   const root=await info(id),back=walk(root).find(n=>n.name==='지원 현황으로 돌아가기');
   if(back)backLinks.push({nodeId:back.id,reactions:[{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:state.screens['지원 현황'],navigation:'NAVIGATE',transition:null}]}]});
  }
  if(backLinks.length)await call('janovel_set_reactions',{links:backLinks});state.returnLinks=backLinks.map(l=>l.nodeId);
  state.linkCount=links.length;save();console.log(JSON.stringify({linked:links.length}));
 }
 if(mode==='context'){
  const d=await info(state.screens['지원 현황']),rows=walk(d).filter(n=>n.name.startsWith('지원 항목 / '));
  const remove=rows.find(n=>n.name==='지원 항목 / 나루시스템');if(remove){const ids=new Set(walk(remove).map(n=>n.id));await call('delete_node',{nodeId:remove.id});state.links=state.links.filter(l=>!ids.has(l.id));}
  const summary=walk(d).find(n=>n.type==='TEXT'&&n.characters.startsWith('전체 5'));if(summary)await call('set_text_content',{nodeId:summary.id,text:'전체 4    관심 1    작성 중 1    전형 진행 2'});
  for(const[name,id]of Object.entries(state.screens)){
   const root=await info(id);for(const n of walk(root)){
    const company=n.name.startsWith('지원 항목 / ')?n.name.slice(8):n.name.startsWith('최근 작성 / ')?n.name.slice(8):null;
    if(company&&['솔빛테크','브릭스','루트페이'].includes(company)){const l=state.links.find(l=>l.id===n.id);if(l)l.to=company;}
   }
  }
  const prep=await info(state.screens['면접 상세']),ctx=walk(prep).find(n=>n.name==='참고할 자료'&&n.type==='FRAME');
  const oldButton=walk(ctx).find(n=>n.type==='INSTANCE'&&n.name==='자료 변경');if(oldButton)await call('move_node',{nodeId:oldButton.id,x:20,y:246});
  await text(ctx.id,'제출본 Q2',20,320,296,12,'muted');await text(ctx.id,'문서 정합성 개선 경험을 바탕으로\n설계 선택과 검증 방법을 설명합니다.',20,350,296,13);
  if(!state.dialogs['제출본 확인']){
   const s=await frame(state.section,'제출본 확인',2528,2220,560,646,'paper',true);await call('set_corner_radius',{nodeId:s.id,radius:10});state.dialogs['제출본 확인']=s.id;save();
   await text(s.id,'솔빛테크 · 제출본',24,22,512,20,'ink','bold');await text(s.id,'11.10 · 제출 당시 문항과 답변',24,65,512,12,'muted');
   const qs=[['Q1 · 지원동기','Java와 Spring으로 안정적인 서버를 만드는 일을 하고 싶습니다. 실패 상황에서도 사용자가 작업 결과를 확인할 수 있도록 만드는 데 관심이 있습니다.'],['Q2 · 문제 해결','문서 저장 뒤 메타데이터 반영이 실패하는 경로를 확인했습니다. 작업 시작 전에 대상 정보와 진행 상태를 기록하고 복구 동작을 검증했습니다.'],['Q3 · 협업','코드 리뷰에서 구현 의도와 처리 흐름을 설명하고 서로의 질문을 통해 이해를 맞췄습니다.']];
   for(const[i,[label,body]]of qs.entries()){await text(s.id,label,24,114+i*138,512,13,'ink','medium');await text(s.id,body,24,148+i*138,512,14);}
   await text(s.id,'작성본을 수정해도 이 제출본은 바뀌지 않습니다.',24,548,512,12,'muted');await box(s.id,'닫기',424,584,112,true,'CLOSE');
  }
  const interviewList=await info(state.screens['면접 준비']);const tab=walk(interviewList).find(n=>n.type==='TEXT'&&n.characters==='연습 기록');if(tab&&!state.links.some(l=>l.id===tab.id))link(tab.id,'연습 기록');
  for(let i=0;i<pending.length;i+=60)await call('janovel_patch_nodes',{patches:pending.slice(i,i+60)});save();console.log('Aligned company routes and submitted-source preview');
 }
 if(mode==='verify'){
  const reports=[];
  for(const[name,id]of Object.entries({...state.screens,...state.dialogs})){
   const root=await info(id),all=walk(root),bounds=root.absoluteBoundingBox;
   const fonts=[...new Set(all.filter(n=>n.type==='TEXT').map(n=>n.style?.fontFamily))];
   const out=all.filter(n=>n.visible!==false&&n.absoluteBoundingBox).filter(n=>{const b=n.absoluteBoundingBox;return b.x<bounds.x-1||b.y<bounds.y-1||b.x+b.width>bounds.x+bounds.width+1||b.y+b.height>bounds.y+bounds.height+1});
   const images=all.filter(n=>n.fills?.some(f=>f.type==='IMAGE'));
   const forbidden=all.filter(n=>/경험.?자료/.test(n.name)||/경험.?자료/.test(n.characters||''));
   reports.push({name,id,nodes:all.length,fonts,out:out.map(n=>({id:n.id,name:n.name,bounds:n.absoluteBoundingBox})),images:images.length,excludedExperienceNodes:forbidden.length});
  }
  fs.writeFileSync(dir+'/verification.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
  const reactions=await call('janovel_inspect_reactions',{nodeIds:[...Object.values(state.screens),...Object.values(state.dialogs)]});
  fs.writeFileSync(dir+'/reactions.json',JSON.stringify(reactions));
  console.log(JSON.stringify({prototypeControls:reactions.reduce((sum,r)=>sum+r.controls.length,0),writerReturnLinks:state.returnLinks?.length||0}));
 }
 if(mode==='polish'){
  let changed=0;
  for(const id of [...Object.values(state.screens),...Object.values(state.dialogs)]){
   const d=await info(id);for(const n of walk(d))if(n.type==='TEXT'&&n.fills?.some(f=>typeof f.color==='string'&&f.color.toUpperCase()==='#74777F')){await call('set_fill_color',{nodeId:n.id,...rgb(C.muted)});changed++;}
  }
  const unused=state.icons['folder-open'];if(unused?.startsWith('229:')){await call('delete_node',{nodeId:unused});delete state.icons['folder-open'];}
  const app=await info(state.screens['지원 현황']);for(const n of app.children.filter(n=>n.name==='구분선'&&n.absoluteBoundingBox?.width===1152&&n.absoluteBoundingBox.y-app.absoluteBoundingBox.y>700))await call('delete_node',{nodeId:n.id});
  fs.rmSync(dir+'/경험·자료.png',{force:true});save();console.log(JSON.stringify({mutedTextImproved:changed}));
 }
 if(mode==='export'){
  for(const name of ['지원 현황','일정','면접 상세','연습 기록']){
   const r=await call('export_node_as_image',{nodeId:state.screens[name],format:'PNG',scale:1});fs.writeFileSync(dir+'/'+name+'.png',Buffer.from(r.imageData,'base64'));
  }
  await call('set_focus',{nodeId:state.screens['지원 현황']});console.log('Exported four representative screens');
 }
}finally{save();c.close();}
