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
   const typedAnswers=name==='연습 화면'?all.filter(n=>/답변 작성|답변을 작성|답변 확인|메시지 입력|텍스트 연습/.test(n.name+' '+(n.characters||''))):[];
   reports.push({name,id,nodes:all.length,fonts,out:out.map(n=>({id:n.id,name:n.name,bounds:n.absoluteBoundingBox})),images:images.length,excludedExperienceNodes:forbidden.length,...(name==='연습 화면'?{typedAnswerControls:typedAnswers.length}:{})});
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
 if(mode==='voice-tasks'){
  if(state.voiceTasks)throw Error('Voice/task revision exists; inspect before retrying');
  const removed=new Set();
  async function drop(n){walk(n).forEach(n=>removed.add(n.id));await call('delete_node',{nodeId:n.id});}
  async function clearBody(id,all=false){const d=await info(id);for(const n of d.children)if(all||n.absoluteBoundingBox?.y-d.absoluteBoundingBox.y>=105)await drop(n);return d;}
  const {renderToStaticMarkup}=await import('../../frontend/node_modules/react-dom/server.node.js');
  const React=(await import('../../frontend/node_modules/react/index.js')).default;
  const lucide=await import('../../frontend/node_modules/lucide-react/dist/cjs/lucide-react.js');
  const glyphs={'square':'Square','square-check':'SquareCheck','pause':'Pause','play':'Play','mic-off':'MicOff','volume-2':'Volume2','phone-off':'PhoneOff'};
  Object.assign(state.icons,(await call('janovel_compact_assets',{svgs:Object.fromEntries(Object.entries(glyphs).map(([key,name])=>[key,renderToStaticMarkup(React.createElement(lucide[name],{size:18,strokeWidth:1.5}))]))})).icons);save();
  async function tabs(parent,active){
   for(const[i,[label,to]]of [['예상 질문','면접 상세'],['모의면접','모의면접 설정'],['연습 기록','연습 기록']].entries()){
    const t=await text(parent,label,252+i*120,124,110,14,label===active?'blue':'muted',label===active?'medium':'regular');if(label!==active)link(t.id,to);else await frame(parent,'현재 면접 영역',252+i*120,157,68,2,'blue');
   }
   await rule(parent,252,174,1152);
  }
  const prep=await clearBody(state.screens['면접 상세']);await call('rename_node',{nodeId:prep.id,name:'예상 질문 · 솔빛테크'});
  await tabs(prep.id,'예상 질문');
  const sources=await frame(prep.id,'면접 기준 자료',252,204,320,622,'panel');await call('set_corner_radius',{nodeId:sources.id,radius:8});
  await sectionTitle(sources.id,'기준 자료',20,18,280);await sourceLine(sources.id,'제출본 · 11.10','Q1–Q3 · 제출 당시 내용',20,68,280,'submission');await sourceLine(sources.id,'채용 공고','서버 개발자 · Java / Spring',20,136,280,'detail');await box(sources.id,'기준 변경',20,210,280,false,'자료 선택');
  await text(sources.id,'다음 면접',20,306,280,12,'muted');await text(sources.id,'11.19 (목) 14:00\n온라인 · 기술 면접',20,338,280,14);await text(sources.id,'질문 근거',20,442,280,12,'muted');await text(sources.id,'제출한 주장과 채용 요건을 바탕으로\n준비할 질문을 정리합니다.',20,474,280,13);
  await sectionTitle(prep.id,'예상 질문 6',604,204,600);await box(prep.id,'질문 추가',1264,196,140,false,'질문 추가');
  const questions=[['설계','실패한 요청의 복구 경로를 어떻게 설계했나요?','제출본 Q2 · 실패 복구'],['검증','정합성이 개선됐다는 것을 어떻게 확인했나요?','제출본 Q2 · 검증 방법'],['협업','리뷰에서 의견이 달랐을 때 어떻게 조율했나요?','제출본 Q3 · 협업'],['설계','작업 기록 자체가 실패하면 어떻게 처리하나요?','Q2 꼬리 질문 · 실패 경로'],['직무','이 경험을 서버 운영에 어떻게 활용할 수 있나요?','채용 공고 · 안정적인 운영'],['지원','이 회사와 직무를 선택한 이유는 무엇인가요?','제출본 Q1 · 지원동기']];
  for(const[i,[type,q,source]]of questions.entries()){
   const r=await frame(prep.id,'예상 질문 / '+(i+1),604,256+i*78,800,66,'paper');await tag(r.id,type,0,5,54,'panel');await text(r.id,q,72,2,650,14,'ink','medium');await text(r.id,source,72,31,650,12,'muted');await icon(r.id,'chevron-right',774,14);link(r.id,'질문 추가');await rule(prep.id,604,330+i*78,800);
  }
  await box(prep.id,'모의면접 시작',604,776,180,true,'모의면접 설정');await text(prep.id,'정리한 질문으로 음성 면접을 연습합니다.',808,784,596,13,'muted');

  const practice=await clearBody(state.screens['연습 화면'],true);await call('rename_node',{nodeId:practice.id,name:'모의면접 · 음성 대화'});
  await text(practice.id,'JaNovel.',28,22,150,21,'#1B264F','bold');const back=await text(practice.id,'← 면접 준비',210,29,200,13,'muted');link(back.id,'면접 상세');await text(practice.id,'솔빛테크 · 기술 면접',588,25,500,16,'ink','medium');await box(practice.id,'종료',1312,18,100,false,'면접 종료');await rule(practice.id,0,76,1440);
  await text(practice.id,'질문 2 / 6',64,126,700,13,'blue','medium');await text(practice.id,'진행 시간 04:28',824,126,220,13,'muted');
  await text(practice.id,'정합성이 개선됐다는 것을\n어떻게 확인했나요?',108,216,880,28,'ink','bold');
  const voice=await frame(practice.id,'음성 입력 상태',464,408,168,168,'soft');await call('set_corner_radius',{nodeId:voice.id,radius:84});const mic=await icon(voice.id,'mic',75,75);await call('resize_node',{nodeId:mic.id,width:24,height:24});await call('move_node',{nodeId:mic.id,x:72,y:72});
  const heights=[12,23,38,54,38,26,42,62,46,28,17,34,50,32,18];for(const[i,h]of heights.entries())await frame(practice.id,'음성 파형 '+i,445+i*14,628-h/2,5,h,'blue');
  await text(practice.id,'듣고 있어요',476,682,260,16,'ink','medium');await text(practice.id,'답변이 끝나면 다음 질문으로 이어집니다.',312,720,640,13,'muted');
  await box(practice.id,'마이크',298,804,120,false,'마이크 설정');await box(practice.id,'일시정지',434,804,132,false,'면접 일시정지');await box(practice.id,'다음 질문',582,804,132,false,'다음 질문');
  await frame(practice.id,'대화 기록 경계',1080,76,1,824,'line');await frame(practice.id,'읽기 전용 대화 기록',1081,77,359,823,'panel');await text(practice.id,'대화 기록',1105,111,311,16,'ink','medium');await text(practice.id,'음성 대화가 텍스트로 표시됩니다.',1105,149,311,12,'muted');await rule(practice.id,1105,188,311);
  await text(practice.id,'면접관',1105,222,311,12,'blue','medium');await text(practice.id,'정합성이 개선됐다는 것을 어떻게 확인했나요?',1105,254,311,14);await text(practice.id,'나',1105,352,311,12,'muted','medium');await text(practice.id,'복구 동작이 실제로 수행되는지 통합 테스트로 확인했습니다. 반복해서 실행했을 때에도…',1105,384,311,14);await text(practice.id,'음성 인식 중',1105,505,311,12,'blue');

  const record=await info(state.screens['연습 기록']);for(const n of walk(record))if(n.type==='TEXT'){
   if(n.characters==='11.12 · 텍스트 연습')pending.push({id:n.id,text:'11.12 · 음성 모의면접 · 08:42'});
   if(n.characters==='내 답변')pending.push({id:n.id,text:'내 답변 · 음성 전사'});
   if(n.characters==='복기 메모')pending.push({id:n.id,text:'다음 연습에서 확인할 것'});
  }
  const list=await info(state.screens['면접 준비']);for(const n of walk(list))if(n.type==='TEXT'&&n.characters==='11.12 · 질문 4개 · 답변 메모 3개')pending.push({id:n.id,text:'11.12 · 음성 모의면접 · 08:42'});
  const oldVoice=state.dialogs['음성 안내'];if(oldVoice){await drop(await info(oldVoice));delete state.dialogs['음성 안내'];}
  async function modal(key,title,x,h=390){const r=await frame(state.section,key,x,2770,560,h,'paper',true);await call('set_corner_radius',{nodeId:r.id,radius:10});state.dialogs[key]=r.id;save();await text(r.id,title,24,22,512,20,'ink','bold');return r;}
  const setup=await modal('모의면접 설정','음성 모의면접',48,420);await text(setup.id,'솔빛테크 · 기술 면접',24,78,512,15,'ink','medium');await text(setup.id,'기준 · 제출본 11.10 / 채용 공고\n질문 · 예상 질문 6개와 꼬리 질문',24,122,512,14);await text(setup.id,'마이크',24,216,512,12,'muted');await text(setup.id,'시작할 때 마이크 사용을 허용해 주세요.',24,247,512,14);await box(setup.id,'취소',304,358,100,false,'CLOSE');await box(setup.id,'시작',420,358,116,true,'연습 화면');
  const pause=await modal('면접 일시정지','모의면접 일시정지',668,280);await text(pause.id,'음성 입력과 면접 진행이 멈춘 상태입니다.',24,88,512,14);await box(pause.id,'종료',288,218,108,false,'면접 종료');await box(pause.id,'계속하기',412,218,124,true,'CLOSE');
  const end=await modal('면접 종료','모의면접을 마칠까요?',1288,300);await text(end.id,'진행한 음성 대화와 질문을 기록으로 남기고\n복기 화면으로 이동합니다.',24,88,512,14);await box(end.id,'계속하기',284,238,116,false,'CLOSE');await box(end.id,'종료하고 보기',416,238,120,true,'연습 기록');
  const micSettings=await modal('마이크 설정','마이크',1908,300);await text(micSettings.id,'입력 장치',24,84,512,12,'muted');await box(micSettings.id,'기본 마이크',24,116,512,false);await text(micSettings.id,'권한이 없으면 브라우저에서 마이크 사용을 허용해 주세요.',24,174,512,13,'muted');await box(micSettings.id,'닫기',424,238,112,true,'CLOSE');
  const next=await modal('다음 질문','다음 질문으로 넘어갈까요?',2528,300);await text(next.id,'지금까지 말한 답변은 기록에 남습니다.',24,88,512,14);await box(next.id,'취소',304,238,100,false,'CLOSE');await box(next.id,'다음 질문',420,238,116,true,'CLOSE');

  const cal=await info(state.screens['일정']);for(const n of walk(cal)){
   if(n.type==='TEXT'&&n.characters==='● 과제')await call('move_node',{nodeId:n.id,x:408,y:177});
   if(n.name==='+ 일정 추가'&&n.type==='INSTANCE'){const l=state.links.find(l=>l.id===n.id);if(l)l.to='일정 종류';const t=n.children.find(n=>n.type==='TEXT');pending.push({id:t.id,text:'+ 추가'});}
  }
  await text(cal.id,'□ 개인 할 일',486,177,170,12,'muted');
  for(const[day,title,complete]of [[13,'운동 30분',true],[16,'포트폴리오 수정',false],[19,'알고리즘 2문제',false]]){
   const cell=walk(cal).find(n=>n.name==='날짜 / '+day),event=cell.children.find(n=>n.name.startsWith('일정 / '));
   if(event){await call('resize_node',{nodeId:event.id,width:114,height:44});await call('move_node',{nodeId:event.id,x:6,y:32});const detail=event.children.filter(n=>n.type==='TEXT')[1];await call('move_node',{nodeId:detail.id,x:8,y:23});}
   const r=await frame(cell.id,'개인 할 일 / '+title,6,event?80:48,114,23,'paper');await icon(r.id,complete?'square-check':'square',2,2);await text(r.id,title,24,2,88,10,complete?'muted':'ink');link(r.id,complete?'개인 할 일 완료':'개인 할 일');
  }
  await rule(cal.id,1184,460,210);await text(cal.id,'개인 할 일 1',1184,484,210,14,'ink','medium');const task=await frame(cal.id,'개인 할 일 상세',1184,526,210,86,'paper');const check=await icon(task.id,'square',0,0);link(check.id,'개인 할 일 완료');await text(task.id,'알고리즘 2문제 풀기',28,0,182,13,'ink','medium');await text(task.id,'19:00 · 개인',28,30,182,12,'muted');await box(cal.id,'할 일 수정',1184,626,210,false,'개인 할 일');
  const kind=await modal('일정 종류','무엇을 추가할까요?',3148,292);await box(kind.id,'지원 일정',24,90,512,false,'일정 추가');await box(kind.id,'개인 할 일',24,144,512,false,'개인 할 일');await box(kind.id,'닫기',424,230,112,false,'CLOSE');
  const todo=await modal('개인 할 일','개인 할 일',48,550);await text(todo.id,'할 일',24,80,512,12,'muted');const tf=await frame(todo.id,'할 일 제목 입력',24,110,512,42,'paper',true);await call('set_corner_radius',{nodeId:tf.id,radius:5});await text(tf.id,'알고리즘 2문제 풀기',12,9,488,14);await text(todo.id,'날짜',24,176,512,12,'muted');await box(todo.id,'2026.11.19',24,206,512,false);await text(todo.id,'시간 · 선택',24,270,512,12,'muted');await box(todo.id,'19:00',24,300,248,false);await box(todo.id,'종일',288,300,248,false);await text(todo.id,'회사나 지원 건을 지정하지 않아도 됩니다.',24,370,512,13,'muted');await box(todo.id,'취소',304,488,100,false,'CLOSE');await box(todo.id,'확인',420,488,116,true,'CLOSE');
  await call('move_node',{nodeId:todo.id,x:48,y:3240});
  const done=await modal('개인 할 일 완료','할 일 완료',668,292);await icon(done.id,'square-check',24,90);await text(done.id,'알고리즘 2문제 풀기',58,86,478,16,'ink','medium');await text(done.id,'지원 단계와는 별도로 완료를 관리합니다.',24,148,512,13,'muted');await box(done.id,'완료 취소',288,230,116,false,'개인 할 일');await box(done.id,'닫기',420,230,116,true,'CLOSE');await call('move_node',{nodeId:done.id,x:668,y:3240});
  state.links=state.links.filter(l=>!removed.has(l.id));
  await call('resize_node',{nodeId:state.section,width:4600,height:3880});
  for(let i=0;i<pending.length;i+=60)await call('janovel_patch_nodes',{patches:pending.slice(i,i+60)});
  state.voiceTasks={removed:removed.size,voiceOnly:true,personalTasks:true};save();console.log(JSON.stringify(state.voiceTasks));
 }
 if(mode==='voice-finalize'){
  const p=await info(state.screens['연습 화면']),orb=p.children.find(n=>n.name==='음성 입력 상태');if(orb)await call('delete_node',{nodeId:orb.id});
  for(const n of p.children){const y=n.absoluteBoundingBox?.y-p.absoluteBoundingBox.y;if(n.name.startsWith('음성 파형 '))await call('move_node',{nodeId:n.id,x:n.absoluteBoundingBox.x-p.absoluteBoundingBox.x,y:y-100});else if(n.name==='듣고 있어요'||n.name==='답변이 끝나면 다음 질문으로 이어집니다.')await call('move_node',{nodeId:n.id,x:n.absoluteBoundingBox.x-p.absoluteBoundingBox.x,y:y-110});}
  const prep=await info(state.screens['면접 상세']);
  const rows=prep.children.filter(n=>n.name.startsWith('예상 질문 / '));
  for(const r of rows){state.links=state.links.filter(l=>l.id!==r.id);for(const n of r.children.filter(n=>n.type==='INSTANCE'))await call('delete_node',{nodeId:n.id});}
  const manage=prep.children.find(n=>n.type==='INSTANCE'&&n.name==='질문 추가');if(manage){const t=manage.children.find(n=>n.type==='TEXT');await call('set_text_content',{nodeId:t.id,text:'질문 정리'});const l=state.links.find(l=>l.id===manage.id);if(l)l.to='질문 정리';}
  if(!state.dialogs['질문 정리']){
   const d=await frame(state.section,'질문 정리',1288,3240,560,676,'paper',true);await call('set_corner_radius',{nodeId:d.id,radius:10});state.dialogs['질문 정리']=d.id;save();await text(d.id,'예상 질문 정리',24,22,512,20,'ink','bold');
   for(const[i,r]of rows.entries()){
    const q=r.children.find(n=>n.type==='TEXT'&&n.style?.fontWeight===500)?.characters||r.children.filter(n=>n.type==='TEXT')[0]?.characters;
    await text(d.id,'Q'+(i+1),24,85+i*76,38,12,'muted');const f=await frame(d.id,'질문 내용 '+(i+1),68,80+i*76,468,60,'paper',true);await call('set_corner_radius',{nodeId:f.id,radius:5});await text(f.id,q,12,8,444,13);
   }
   await box(d.id,'질문 추가',24,612,120,false,'질문 추가');await box(d.id,'닫기',304,612,100,false,'CLOSE');await box(d.id,'확인',420,612,116,true,'CLOSE');
  }
  for(let i=0;i<pending.length;i+=60)await call('janovel_patch_nodes',{patches:pending.slice(i,i+60)});await call('resize_node',{nodeId:state.section,width:4600,height:4000});save();console.log('Refined voice focus and question organizer');
 }
 if(mode==='export'||mode==='export-voice'||mode==='export-focused'){
  const names=mode==='export-focused'?['면접 상세','연습 화면']:mode==='export-voice'?['일정','면접 상세','연습 화면','연습 기록']:['지원 현황','일정','면접 상세','연습 기록'];
  for(const name of names){
   const r=await call('export_node_as_image',{nodeId:state.screens[name],format:'PNG',scale:1});fs.writeFileSync(dir+'/'+name+'.png',Buffer.from(r.imageData,'base64'));
  }
  await call('set_focus',{nodeId:state.screens[mode==='export'?'지원 현황':'연습 화면']});console.log('Exported '+names.length+' representative screens');
 }
}finally{save();c.close();}
