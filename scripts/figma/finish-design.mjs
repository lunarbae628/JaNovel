import fs from 'node:fs';
import {connect} from './talk-channel.mjs';
const output='/Users/moon/Desktop/Works/job-application-service/_workspace/2026-11-08-design/receipt.json';
const client=await connect(process.argv[2]||'5yawos1h',output);
const {call,receipt,save}=client;
const walk=n=>[n,...(n.children||[]).flatMap(walk)];
const rgb=hex=>({r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255});
const ink=rgb('#302B27'),white=rgb('#FFFFFF'),line=rgb('#E6E6E6');
const info=id=>call('get_node_info',{nodeId:id});
async function frame(parent,name,w,h,layout='VERTICAL',extra={}) {
  return call('create_frame',{...(parent?{parentId:parent}:{}),name,x:0,y:0,width:w,height:h,layoutMode:layout,paddingTop:0,paddingRight:0,paddingBottom:0,paddingLeft:0,fillColor:white,...extra});
}
async function clone(id,parent,x=0,y=0) {
  const n=await call('clone_node',{nodeId:id});
  if(parent)await call('set_parent',{nodeId:n.id,parentId:parent,x,y});
  return n;
}
async function set(id,text) {return call('set_text_content',{nodeId:id,text});}
async function replace(id,values) {
  const n=await info(id);
  const text=walk(n).filter(t=>t.type==='TEXT'&&values[t.characters]!==undefined).map(t=>({nodeId:t.id,text:values[t.characters]}));
  for(const change of text)await set(change.nodeId,change.text);
  return n;
}
async function size(id,w,h){await call('resize_node',{nodeId:id,width:w,height:h});}
async function text(parent,value,style='label',w) {
  const sources={title:'5:610',body:'5:612',compact:'5:629',label:'5:539',caption:'5:540'};
  const n=await clone(sources[style],parent);
  await set(n.id,value);
  if(w)await size(n.id,w,n.height||32);
  return n;
}
async function button(parent,label,kind='ghost',w=130) {
  const n=await clone({ghost:'4:187',primary:'4:173',graphite:'4:181'}[kind],parent);
  await replace(n.id,{'비교':label,'스냅샷':label,'지원하러 가기 ↗':label});
  await size(n.id,w,36);
  return n;
}
async function field(parent,value,w=880,multi=false) {
  const n=await clone(multi?'5:1024':'5:1020',parent);
  const data=await info(n.id);
  const t=walk(data).find(x=>x.type==='TEXT');
  await set(t.id,value);
  await size(n.id,w,multi?96:44);
  return n;
}
async function labeled(parent,label,value,w=880,multi=false) {
  const r=await frame(parent,label,w,multi?128:72,'VERTICAL',{itemSpacing:8});
  await text(r.id,label,'caption');
  await field(r.id,value,w,multi);
  return r;
}
async function separator(parent,w) {return frame(parent,'구분선',w,1,'NONE',{fillColor:line});}
async function root(name,x,y,company=false) {
  const n=await frame(null,name,1440,900);
  await call('move_node',{nodeId:n.id,x,y});
  receipt.screens[name]=n.id;save();
  const h=await clone('5:531',n.id);
  if(!company)await replace(h.id,{'← 지원 현황':'JaNovel','모노랩':'지원 현황','Java / Spring 백엔드':'캘린더','지원하러 가기 ↗':'+ 공고 등록'});
  await separator(n.id,1440);
  return n;
}
async function cloneScreen(src,name,x,y) {
  const n=await clone(src);
  await call('rename_node',{nodeId:n.id,name});
  await call('move_node',{nodeId:n.id,x,y});
  receipt.screens[name]=n.id;save();
  return n;
}
async function step(name,fn) {
  if(receipt.completed?.includes(name)){console.log('Retained: '+name);return;}
  const doc=await call('get_document_info');
  if(doc.children.some(n=>n.name===name))throw Error('Partial or existing screen needs inspection: '+name);
  await fn();
  (receipt.completed??=[]).push(name);save();
  console.log('Created: '+name);
}
const parts=process.argv[3]||'states';
try {
 if(parts==='repair-image-tab') {
   const id=receipt.screens['공고 등록 · 이미지'];
   const data=await info(id),tabs=walk(data).find(x=>x.name==='입력 방식');
   if(!walk(data).some(x=>x.name==='공고 이미지 업로드'))throw Error('Image upload section missing');
   for(const child of tabs.children||[]){
     const t=walk(child).find(x=>x.type==='TEXT');
     if(!t)continue;
     await call('set_fill_color',{nodeId:child.id,...(t.characters==='이미지'?rgb('#EDF1FA'):white)});
     await call('set_fill_color',{nodeId:t.id,...(t.characters==='이미지'?rgb('#274690'):ink)});
   }
   (receipt.completed??=[]).push('공고 등록 · 이미지');save();
   console.log('Repaired image input active tab: '+id);
 }
 if(parts==='states') {
  await step('과거 기록 복원 · 확인',async()=>{
    const n=await cloneScreen('5:912','과거 기록 복원 · 확인',3180,5300);
    const d=(await info(n.id)).children.find(x=>x.name==='스냅샷 이름·설명');
    await call('delete_multiple_nodes',{nodeIds:d.children.filter(x=>['이름','설명'].includes(x.name)).map(x=>x.id)});
    await replace(d.id,{'스냅샷 남기기':'v3로 복원할까요?','확인':'복원하기'});
    const message=await text(d.id,'현재 작성 중인 내용은 먼저 보관돼요.\nv3 내용을 새 초안으로 불러옵니다.\n기존 스냅샷과 분기는 그대로 남아요.','compact',372);
    await call('set_parent',{nodeId:message.id,parentId:d.id,index:1});
    await size(d.id,420,248);
    await call('move_node',{nodeId:d.id,x:510,y:326});
  });
  await step('처음 작성 · 빈 문항',async()=>{
    const n=await cloneScreen('5:530','처음 작성 · 빈 문항',100,6400);
    const data=await info(n.id), nodes=walk(data);
    const graph=nodes.find(x=>x.name==='버전 그래프');
    await call('delete_node',{nodeId:graph.id});
    const changes=nodes.filter(t=>t.type==='TEXT'&&t.characters?.startsWith('수정한 기록이 쌓여도')).map(t=>({nodeId:t.id,text:'여기에 답변을 작성하세요.'}));
    for(const start of ['문서 관리 프로젝트에서 정상','이 경험을 바탕으로 문서']){
      const node=nodes.find(t=>t.type==='TEXT'&&t.characters?.startsWith(start));
      if(node)changes.push({nodeId:node.id,text:''});
    }
    await call('set_multiple_text_contents',{nodeId:n.id,text:changes});
    await replace(n.id,{'306 / 700자':'0 / 700자','숨긴 기록 · 5개':'아직 스냅샷이 없어요.','지원동기가 직무와 잘 연결되는지 봐줘.':'','경험을 소개한 부분에서 실제로 어떤 일을 했는지 드러나면 지원 이유가 더 분명해져요.':'어떤 경험으로 시작할지 함께 정리해 볼까요?','두 번째 문단을 구체화한 수정안을 확인해 보세요.':'','수정안 비교 →':'경험 정리하기'});
  });
  await step('작성 유지 · 보관 실패와 AI 연결 끊김',async()=>{
    const n=await cloneScreen('5:530','작성 유지 · 보관 실패와 AI 연결 끊김',1640,6400);
    await replace(n.id,{'Q1':'Q1 · 연결 끊김','지원동기가 직무와 잘 연결되는지 봐줘.':'두 번째 문장을 더 구체적으로 다듬어줘.','경험을 소개한 부분에서 실제로 어떤 일을 했는지 드러나면 지원 이유가 더 분명해져요.':'AI 연결이 끊겼어요. PC의 연결 상태를 확인해 주세요.','두 번째 문단을 구체화한 수정안을 확인해 보세요.':'작성한 내용은 그대로 남아 있어요.','수정안 비교 →':'다시 연결','피드백 요청':'요청 다시 시도'});
    const main=walk(await info(n.id)).find(x=>x.name==='작성 본문');
    const message=await frame(main.id,'초안 보관 실패',790,40,'HORIZONTAL',{itemSpacing:16,counterAxisAlignItems:'CENTER'});
    await text(message.id,'초안을 보관하지 못했어요.','caption');
    await button(message.id,'다시 시도','ghost',88);
  });
  await step('AI 수정안 · 요청 뒤 원문 변경',async()=>{
    const n=await cloneScreen('42:458','AI 수정안 · 요청 뒤 원문 변경',3180,6400);
    await replace(n.id,{'스냅샷으로 채택':'후보로 남기기','원문은 유지돼요. 변경 구절을 확인하고 채택해 주세요.':'요청한 뒤 작성본이 바뀌었어요. 이 수정안은 요청 당시 원문과 비교하고 있어요.','이유 확인':'현재 작성본 보기'});
  });
 }
 if(parts==='calendar') {
  await step('지원 현황 · 캘린더',async()=>{
    const n=await root('지원 현황 · 캘린더',1640,7500);
    const c=await frame(n.id,'월별 일정',1440,835,'VERTICAL',{paddingLeft:120,paddingRight:120,paddingTop:32,itemSpacing:20});
    const head=await frame(c.id,'월과 일정 도구',1200,40,'HORIZONTAL',{counterAxisAlignItems:'CENTER',primaryAxisAlignItems:'SPACE_BETWEEN'});
    await text(head.id,'2026년 11월','title');
    await button(head.id,'‹     오늘     ›','ghost',152);
    await button(head.id,'+ 일정 추가','primary',128);
    const grid=await frame(c.id,'월요일부터 일요일',1200,676,'HORIZONTAL');
    const days=['월','화','수','목','금','토','일'];
    const events={12:'솔빛 기술면접',16:'브릭스 과제',18:'루트페이 마감',20:'모노랩 마감'};
    for(let col=0;col<7;col++){
      const cell=await frame(grid.id,days[col],1200/7,676,'VERTICAL',{paddingLeft:12,paddingRight:12,paddingTop:8,strokeColor:line,strokeWeight:1});
      let value=days[col]+'\n\n';
      for(let week=0;week<6;week++){
        const day=new Date(Date.UTC(2026,9,26+col+week*7));
        const num=day.getUTCDate(),nov=day.getUTCMonth()===10;
        value+=(nov&&num===8?'8 · 오늘':String(num))+'\n'+(nov?events[num]||'':'')+'\n\n\n';
      }
      await text(cell.id,value.trimEnd(),'compact',147);
    }
  });
 }
 if(parts==='details') {
  await step('지원 상세 · 공고와 채용 절차',async()=>{
    const n=await root('지원 상세 · 공고와 채용 절차',100,7500,true);
    const body=await frame(n.id,'지원 정보',1440,835,'HORIZONTAL',{paddingLeft:80,paddingRight:80,paddingTop:32,itemSpacing:40});
    const left=await frame(body.id,'공고와 문항',920,760,'VERTICAL',{itemSpacing:20});
    await text(left.id,'백엔드 개발자','title');
    await text(left.id,'마감 11.20 (금) · 시간 미정','caption');
    const proc=await frame(left.id,'채용 절차',920,76,'VERTICAL',{itemSpacing:8});
    const pr=await frame(proc.id,'절차 도구',920,36,'HORIZONTAL',{primaryAxisAlignItems:'SPACE_BETWEEN',counterAxisAlignItems:'CENTER'});
    await text(pr.id,'채용 절차','label');await button(pr.id,'절차 수정','ghost',96);
    await text(proc.id,'서류 전형  →  코딩테스트  →  기술 면접  →  최종 면접','compact',920);
    await labeled(left.id,'주요 업무','문서 저장과 변경 이력 API 개발\n서비스 장애 분석과 데이터 정합성 개선',920,true);
    await labeled(left.id,'자격 요건','Java, Spring Boot 기반 개발 경험\nRDBMS와 트랜잭션에 대한 이해',920,true);
    const qh=await frame(left.id,'문항 제목',920,36,'HORIZONTAL',{primaryAxisAlignItems:'SPACE_BETWEEN',counterAxisAlignItems:'CENTER'});
    await text(qh.id,'자소서 문항','label');await button(qh.id,'+ 문항 추가','ghost',112);
    await field(left.id,'Q1  지원한 이유와 입사 후 목표를 작성해 주세요.  ·  700자',920);
    await field(left.id,'Q2  개발 과정에서 어려웠던 문제와 해결 과정을 설명해 주세요.  ·  1,000자',920);
    const right=await frame(body.id,'현재 상태와 다음 일정',320,624,'VERTICAL',{fillColor:rgb('#F7F7F8'),paddingTop:24,paddingLeft:24,paddingRight:24,itemSpacing:20});
    await text(right.id,'현재 단계','caption');await button(right.id,'서류 전형  ⌄','ghost',272);
    await separator(right.id,272);await text(right.id,'다음 일정','label');
    await text(right.id,'11.20 (금)\n서류 접수 마감 · 시간 미정','compact',272);
    await button(right.id,'+ 일정 추가','ghost',272);
    await separator(right.id,272);await button(right.id,'자소서 작성 →','primary',272);
    await button(right.id,'제출본 보기','ghost',272);await text(right.id,'제출본 1개','caption');
  });
 }
 if(parts==='registration') {
  await step('공고 등록 · 링크',async()=>{
    const n=await root('공고 등록 · 링크',100,8600);
    await replace(n.id,{'JaNovel':'← 지원 현황','지원 현황':'공고 등록','캘린더':'','+ 공고 등록':'취소'});
    const main=await frame(n.id,'공고 입력',1440,835,'VERTICAL',{paddingLeft:240,paddingRight:240,paddingTop:56,itemSpacing:28});
    await text(main.id,'어떤 공고에 지원하나요?','title');
    const tabs=await frame(main.id,'입력 방식',960,40,'HORIZONTAL',{itemSpacing:12});
    await button(tabs.id,'링크','primary',100);await button(tabs.id,'이미지','ghost',100);await button(tabs.id,'텍스트','ghost',100);
    await labeled(main.id,'공고 링크','https://careers.example.com/jobs/backend',960);
    const actions=await frame(main.id,'정보 가져오기',960,40,'HORIZONTAL',{primaryAxisAlignItems:'SPACE_BETWEEN',counterAxisAlignItems:'CENTER'});
    await button(actions.id,'직접 입력하기','ghost',132);await button(actions.id,'정보 가져오기 →','primary',164);
    await text(main.id,'로그인이 필요한 공고는 이미지나 텍스트로 등록할 수 있어요.','caption');
  });
  await step('공고 등록 · 이미지',async()=>{
    const n=await cloneScreen(receipt.screens['공고 등록 · 링크'],'공고 등록 · 이미지',1640,8600);
    const data=await info(n.id),main=walk(data).find(x=>x.name==='공고 입력');
    const input=walk(data).find(x=>x.name==='공고 링크');
    await call('delete_node',{nodeId:input.id});
    const upload=await frame(main.id,'공고 이미지 업로드',960,152,'VERTICAL',{fillColor:rgb('#F7F7F8'),paddingLeft:24,paddingTop:24,itemSpacing:16,strokeColor:line,strokeWeight:1});
    await call('set_parent',{nodeId:upload.id,parentId:main.id,index:2});
    await text(upload.id,'공고 이미지를 끌어놓거나 선택하세요.','compact',900);
    await button(upload.id,'이미지 선택','ghost',128);
    const tabs=walk(await info(n.id)).find(x=>x.name==='입력 방식');
    // Reuse native instances and preserve their fonts; active state is set explicitly.
    for(const child of tabs.children||[]){
      const label=walk(child).find(x=>x.type==='TEXT')?.characters;
      if(label==='링크')await call('set_fill_color',{nodeId:child.id,...white});
      if(label==='이미지')await call('set_fill_color',{nodeId:child.id,...rgb('#EDF1FA')});
      const t=walk(child).find(x=>x.type==='TEXT');
      if(t)await call('set_fill_color',{nodeId:t.id,...(label==='이미지'?rgb('#274690'):ink)});
    }
  });
  await step('공고 등록 · 텍스트',async()=>{
    const n=await cloneScreen(receipt.screens['공고 등록 · 링크'],'공고 등록 · 텍스트',3180,8600);
    await replace(n.id,{'공고 링크':'공고 내용','https://careers.example.com/jobs/backend':'공고의 업무·자격 요건·문항·접수 일정을 붙여넣으세요.'});
    const data=await info(n.id),input=walk(data).find(x=>x.name==='공고 링크');
    const f=input.children.find(x=>x.type==='INSTANCE');await size(input.id,960,248);await size(f.id,960,216);
    const tabs=walk(data).find(x=>x.name==='입력 방식');
    for(const child of tabs.children||[]){const label=walk(child).find(x=>x.type==='TEXT')?.characters;await call('set_fill_color',{nodeId:child.id,...(label==='텍스트'?rgb('#EDF1FA'):white)});const t=walk(child).find(x=>x.type==='TEXT');if(t)await call('set_fill_color',{nodeId:t.id,...(label==='텍스트'?rgb('#274690'):ink)});}
  });
  await step('공고 정보 확인 · 수정 후 등록',async()=>{
    const n=await cloneScreen(receipt.screens['지원 상세 · 공고와 채용 절차'],'공고 정보 확인 · 수정 후 등록',100,9700);
    await replace(n.id,{'모노랩':'공고 정보 확인','Java / Spring 백엔드':'모노랩 · 백엔드 개발자','지원하러 가기 ↗':'등록하기','현재 단계':'등록할 지원 단계','서류 전형  ⌄':'관심 공고  ⌄','자소서 작성 →':'등록하고 작성 →','제출본 보기':'입력으로 돌아가기','제출본 1개':'업무·요건·절차·문항을 수정할 수 있어요.'});
  });
 }
 if(parts==='submission') {
  await step('제출본 · 문항별 버전 선택',async()=>{
    const n=await root('제출본 · 문항별 버전 선택',1640,9700,true);
    const content=await frame(n.id,'제출본 선택',1440,835,'VERTICAL',{paddingLeft:120,paddingRight:120,paddingTop:40,itemSpacing:24});
    const title=await frame(content.id,'제출본 도구',1200,40,'HORIZONTAL',{counterAxisAlignItems:'CENTER',primaryAxisAlignItems:'SPACE_BETWEEN'});
    await text(title.id,'제출본 지정','title');await button(title.id,'제출본 확정','primary',140);
    await text(content.id,'제출할 버전을 문항별로 선택하세요. 확정한 내용은 이후 수정에도 유지돼요.','caption');
    for(const [i,q,v,body] of [
      [1,'지원한 이유와 입사 후 목표를 작성해 주세요.','v4 · 병합','문서 관리와 변경 이력을 안정적으로 다루는 백엔드 개발자가 되고 싶습니다.\n\n문서 관리 프로젝트에서 실패한 요청의 복구 경로를 확인하고, 생성 대상을 먼저 기록해 복구할 수 있도록 개선했습니다.\n\n이 경험을 바탕으로 서비스의 데이터 흐름과 저장 기준을 익히고 변경 전후를 검증하겠습니다.'],
      [2,'개발 과정에서 어려웠던 문제와 해결 과정을 설명해 주세요.','v2 · 해결 과정 구체화','서로 다른 저장소에 데이터를 남기는 과정에서 일부 저장이 실패하면 복구 대상이 누락되는 문제를 확인했습니다.\n\n작업 시작 시 대상과 상태를 먼저 기록하고, 실패한 작업을 반복 실행해도 중복 처리되지 않도록 복구 흐름을 개선했습니다.']
    ]){
      const section=await frame(content.id,`Q${i} 제출 버전`,1200,272,'VERTICAL',{itemSpacing:12});
      const h=await frame(section.id,'문항과 선택 버전',1200,40,'HORIZONTAL',{counterAxisAlignItems:'CENTER',primaryAxisAlignItems:'SPACE_BETWEEN'});
      await text(h.id,`Q${i}  ${q}`,'label');await button(h.id,v+'  ⌄','ghost',230);
      await text(section.id,body,'compact',1120);await separator(content.id,1200);
    }
  });
  await step('제출본 · 고정된 내용 확인',async()=>{
    const n=await cloneScreen(receipt.screens['제출본 · 문항별 버전 선택'],'제출본 · 고정된 내용 확인',3180,9700);
    await replace(n.id,{'제출본 지정':'제출본 · 11.18 16:20','제출본 확정':'+ 새 제출본','제출할 버전을 문항별로 선택하세요. 확정한 내용은 이후 수정에도 유지돼요.':'문항 2개 고정 · Q1 v4 / Q2 v2 · 작성본의 변경은 반영되지 않아요.','v4 · 병합  ⌄':'v4 · 병합','v2 · 해결 과정 구체화  ⌄':'v2 · 해결 과정 구체화'});
    const body=walk(await info(n.id)).find(x=>x.name==='제출본 선택');
    const actions=await frame(body.id,'제출 확인',1200,40,'HORIZONTAL',{itemSpacing:16,counterAxisAlignItems:'CENTER'});
    await button(actions.id,'내용 복사','ghost',112);await button(actions.id,'제출 완료로 표시','ghost',168);
  });
 }
 if(parts==='dialogs') {
  await step('일정 추가·수정 · Desktop',async()=>{
    const n=await cloneScreen('5:912','일정 추가·수정 · Desktop',100,10800);
    const d=(await info(n.id)).children.find(x=>x.name==='스냅샷 이름·설명');
    await call('delete_multiple_nodes',{nodeIds:d.children.filter(x=>['이름','설명'].includes(x.name)).map(x=>x.id)});
    await replace(d.id,{'스냅샷 남기기':'일정 추가','확인':'일정 추가'});
    const fields=await frame(d.id,'일정 내용',372,392,'VERTICAL',{itemSpacing:12});
    await call('set_parent',{nodeId:fields.id,parentId:d.id,index:1});
    await labeled(fields.id,'지원 건','솔빛테크 · 서버 개발자  ⌄',372);
    await labeled(fields.id,'일정 종류','면접  ⌄',372);
    await labeled(fields.id,'일정 이름','기술 면접',372);
    await labeled(fields.id,'날짜·시간','2026.11.12  14:00  ·  종일 □',372);
    await size(d.id,420,560);await call('move_node',{nodeId:d.id,x:510,y:170});
  });
  await step('채용 절차 수정 · Desktop',async()=>{
    const n=await cloneScreen('5:912','채용 절차 수정 · Desktop',1640,10800);
    const d=(await info(n.id)).children.find(x=>x.name==='스냅샷 이름·설명');
    await call('delete_multiple_nodes',{nodeIds:d.children.filter(x=>['이름','설명'].includes(x.name)).map(x=>x.id)});
    await replace(d.id,{'스냅샷 남기기':'채용 절차 수정','확인':'변경 적용'});
    const fields=await frame(d.id,'회사별 채용 단계',372,300,'VERTICAL',{itemSpacing:12});
    await call('set_parent',{nodeId:fields.id,parentId:d.id,index:1});
    for(const value of ['≡  서류 전형                         ×','≡  코딩테스트                        ×','≡  기술 면접                         ×','≡  최종 면접                         ×'])await field(fields.id,value,372);
    await button(fields.id,'+ 단계 추가','ghost',130);
    await text(fields.id,'순서를 바꾸거나 단계를 추가·삭제할 수 있어요.','caption');
    await size(d.id,420,472);await call('move_node',{nodeId:d.id,x:510,y:214});
  });
 }
 if(parts==='polish'&&!receipt.polished) {
   // Fix labels missed by the earlier MCP text batch, using the inspected node IDs.
   await set('I41:347;4185:3781','JaNovel');await set('I41:351;4185:3781','+ 공고 등록');await set('I41:366;4185:3781','전체 4건  ⌄');
   await call('set_fill_color',{nodeId:'41:351',...rgb('#274690')});
   const home=await info('41:345');
   const table=walk(home).find(x=>x.name==='회사별 지원 목록');
   for(const [i,row] of table.children.filter(x=>x.name==='회사 헤더').entries()){
     const status=row.children.at(-1);const label=walk(status).find(x=>x.type==='TEXT');
     await call('set_fill_color',{nodeId:status.id,...white});
     await call('set_fill_color',{nodeId:label.id,...(i?rgb('#274690'):rgb('#727272'))});
     if(i)await set(label.id,['','서류 전형  ›','기술 면접  ›','과제 전형  ›','관심  ›'][i]);
   }
   for(const name of ['AI 수정안 · 비교와 채택','AI 수정안 · 요청 뒤 원문 변경']){
     const id=name==='AI 수정안 · 비교와 채택'?'42:458':receipt.screens[name];
     const data=await info(id),nodes=walk(data),toolbar=nodes.find(x=>x.name==='문항·작성 도구');
     const action=toolbar.children.at(-1),label=walk(action).find(x=>x.type==='TEXT');
     const isStale=name.includes('원문 변경');
     await set(label.id,isStale?'후보로 남기기':'스냅샷으로 채택');await size(action.id,164,36);
     await call('set_fill_color',{nodeId:action.id,...rgb('#274690')});await call('set_fill_color',{nodeId:label.id,...white});
     const source=nodes.find(x=>x.name==='원문 선택');
     const oldAction=source.children.find(x=>x.type==='INSTANCE'&&walk(x).some(t=>t.type==='TEXT'&&['스냅샷으로 채택','후보로 남기기'].includes(t.characters)));
     if(oldAction)await call('delete_node',{nodeId:oldAction.id});
     const target=nodes.find(x=>x.name==='수정본 선택');
     const version=walk(target).find(x=>x.type==='TEXT'&&x.characters?.startsWith('v4'));
     if(version)await set(version.id,'수정 제안 1');
     if(isStale)await replace(id,{'현재 작성본 보기':'작성본과 다시 비교'});
   }
   const empty=await info(receipt.screens['처음 작성 · 빈 문항']);
   const conversation=walk(empty).find(x=>x.name==='문항별 대화');
   const bubble=conversation.children.find(x=>x.name==='사용자 메시지');
   if(bubble)await call('delete_node',{nodeId:bubble.id});
   const graph=walk(empty).find(x=>x.name==='Q1 기록');
   await text(graph.id,'첫 스냅샷을 남기면\n기록이 여기에 보여요.','caption',176);
   const failed=await info(receipt.screens['작성 유지 · 보관 실패와 AI 연결 끊김']);
   for(const n of walk(failed).filter(x=>x.name==='JaNovel/Question tab')){const t=walk(n).find(x=>x.type==='TEXT'&&x.characters==='Q1 · 연결 끊김');if(t)await set(t.id,'Q1');}
   const calendar=await info(receipt.screens['지원 현황 · 캘린더']);
   const grid=walk(calendar).find(x=>x.name==='월요일부터 일요일');
   await call('set_layout_mode',{nodeId:grid.id,layoutMode:'NONE'});
   for(let i=0;i<6;i++)await frame(grid.id,'주 구분선',1200,1,'NONE',{x:0,y:44+i*104,fillColor:line});
   async function replaceBackground(targetId,sourceId){
     const target=await info(targetId),source=await info(sourceId);
     await call('delete_multiple_nodes',{nodeIds:target.children.filter(x=>!['Modal backdrop','스냅샷 이름·설명'].includes(x.name)).map(x=>x.id)});
     for(const [index,child] of source.children.entries()){
       const n=await clone(child.id,targetId);await call('set_parent',{nodeId:n.id,parentId:targetId,index});
     }
   }
   await replaceBackground(receipt.screens['일정 추가·수정 · Desktop'],receipt.screens['지원 현황 · 캘린더']);
   await replaceBackground(receipt.screens['채용 절차 수정 · Desktop'],receipt.screens['지원 상세 · 공고와 채용 절차']);
   const schedule=await info(receipt.screens['일정 추가·수정 · Desktop']);
   const dialog=schedule.children.find(x=>x.name==='스냅샷 이름·설명');
   const fields=walk(dialog).find(x=>x.name==='일정 내용');
   await size(fields.id,372,324);await size(dialog.id,420,492);await call('move_node',{nodeId:dialog.id,x:510,y:204});
   const procedure=await info(receipt.screens['채용 절차 수정 · Desktop']);
   const steps=walk(procedure).find(x=>x.name==='회사별 채용 단계');
   const old=steps.children.filter(x=>x.type==='INSTANCE'&&x.name==='JaNovel/Field');
   await call('delete_multiple_nodes',{nodeIds:old.map(x=>x.id)});
   for(const [i,label] of ['서류 전형','코딩테스트','기술 면접','최종 면접'].entries()){
     const row=await frame(steps.id,label,372,44,'HORIZONTAL',{itemSpacing:8,counterAxisAlignItems:'CENTER'});
     await call('set_parent',{nodeId:row.id,parentId:steps.id,index:i});
     await text(row.id,'≡','caption');await field(row.id,label,304);await button(row.id,'×','ghost',36);
   }
   receipt.polished=true;save();console.log('Polished inspected layout and labels.');
 }
 if(parts==='last-states') {
   await step('일정 수정 · 삭제 가능',async()=>{
     const n=await cloneScreen(receipt.screens['일정 추가·수정 · Desktop'],'일정 수정 · 삭제 가능',3180,10800);
     const dialog=(await info(n.id)).children.find(x=>x.name==='스냅샷 이름·설명');
     await replace(dialog.id,{'일정 추가':'일정 수정'});
     const actions=dialog.children.find(x=>x.name==='확인과 취소');
     const primary=actions.children.at(-1),label=walk(primary).find(x=>x.type==='TEXT');await set(label.id,'변경 적용');
     const del=await button(actions.id,'일정 삭제','ghost',100);await call('set_parent',{nodeId:del.id,parentId:actions.id,index:0});
   });
   await step('공고 등록 · 가져오기 실패',async()=>{
     const n=await cloneScreen(receipt.screens['공고 등록 · 링크'],'공고 등록 · 가져오기 실패',100,11900);
     await replace(n.id,{'로그인이 필요한 공고는 이미지나 텍스트로 등록할 수 있어요.':'공고를 가져오지 못했어요. 이미지·텍스트로 등록하거나 직접 입력해 주세요.','정보 가져오기 →':'다시 가져오기'});
   });
   await step('AI 수정안 · 스냅샷 이름과 설명',async()=>{
     const n=await cloneScreen('5:912','AI 수정안 · 스냅샷 이름과 설명',1640,11900);
     const dialog=(await info(n.id)).children.find(x=>x.name==='스냅샷 이름·설명');
     await replace(dialog.id,{'스냅샷 남기기':'수정안을 스냅샷으로 남기기','예: 경험 구체화':'피드백 반영','변경한 내용이나 이유':'직무 연결과 문장 표현을 검토해 반영','확인':'스냅샷'});
   });
 }
 if(parts==='final-layout'&&!receipt.finalLayout) {
   const editing=await info(receipt.screens['일정 수정 · 삭제 가능']);
   const dialog=editing.children.find(x=>x.name==='스냅샷 이름·설명');
   const title=dialog.children.find(x=>x.type==='TEXT');await set(title.id,'일정 수정');
   const all=await call('get_document_info');
   for(const root of all.children.filter(x=>x.type==='FRAME'&&!x.name.startsWith('JaNovel'))){
     const data=await info(root.id);
     for(const node of walk(data))if(node.name==='区切り / 구분선')await call('rename_node',{nodeId:node.id,name:'구분선'});
   }
   receipt.finalLayout=true;save();
 }
 if(parts==='question-two') {
   await step('Q2 작성 · 문항별 기록',async()=>{
     const n=await cloneScreen('5:530','Q2 작성 · 문항별 기록',3180,11900);
     const before=await info(n.id),nodes=walk(before);
     const body=['서로 다른 저장소에 데이터를 저장하는 과정에서 일부 요청이 실패하면 복구 대상이 누락되는 문제를 확인했습니다.','작업을 시작할 때 대상과 진행 상태를 먼저 기록하고, 복구를 반복 실행해도 중복 처리되지 않도록 흐름을 개선했습니다.'];
     const doc=nodes.find(x=>x.name==='자소서');
     const paragraphs=doc.children.filter(x=>x.type==='TEXT');
     for(const [i,p] of paragraphs.entries())await set(p.id,body[i]||'');
     const count=walk(doc).find(x=>x.type==='TEXT'&&x.characters?.includes('/ 700자'));
     await set(count.id,body.join('\n\n').length+' / 1,000자');
     await replace(n.id,{'지원한 이유와 입사 후 목표를 작성해 주세요.':'개발 과정에서 어려웠던 문제와 해결 과정을 설명해 주세요.','Q1 · 기본':'Q2 · 기본','v3':'v1','v3-A':'v1-A','v4 · 병합':'v2 · 병합','v4에서 작성':'v2에서 작성','직무 연결':'문제 정리','문장 정리':'다른 사례','두 초안 병합':'해결 과정 구체화','Q1':'Q2','지원동기가 직무와 잘 연결되는지 봐줘.':'해결 과정에서 내가 한 일이 잘 드러나는지 봐줘.','경험을 소개한 부분에서 실제로 어떤 일을 했는지 드러나면 지원 이유가 더 분명해져요.':'문제의 원인과 변경한 흐름을 나누어 설명하면 역할이 더 분명해져요.','두 번째 문단을 구체화한 수정안을 확인해 보세요.':'검증 방법과 확인한 결과를 덧붙여 보세요.'});
     const toolbar=nodes.find(x=>x.name==='문항·작성 도구'),old=toolbar.children.filter(x=>x.name==='JaNovel/Question tab');
     await call('delete_multiple_nodes',{nodeIds:old.map(x=>x.id)});
     for(const [i,componentId] of ['4:193','4:195'].entries()){
       const tab=await call('create_component_instance',{componentId,parentId:toolbar.id,x:0,y:0});
       await call('set_parent',{nodeId:tab.id,parentId:toolbar.id,index:i});
       const label=walk(await info(tab.id)).find(x=>x.type==='TEXT');await set(label.id,'Q'+(i+1));
       await size(tab.id,48,48);
     }
   });
 }
 if(parts==='submission-entry'&&!receipt.submissionEntry) {
   const ids=['5:530','5:647','5:790','15:342','37:441','42:458',receipt.screens['처음 작성 · 빈 문항'],receipt.screens['작성 유지 · 보관 실패와 AI 연결 끊김'],receipt.screens['AI 수정안 · 요청 뒤 원문 변경'],receipt.screens['Q2 작성 · 문항별 기록']].filter(Boolean);
   for(const id of ids){
     const data=await info(id),header=data.children.find(x=>x.name==='회사 헤더');
     const entry=await button(header.id,'제출본','ghost',80);await call('set_parent',{nodeId:entry.id,parentId:header.id,index:2});
   }
   receipt.visualDirty=[...new Set([...(receipt.visualDirty||[]),...ids,receipt.screens['일정 수정 · 삭제 가능']])];
   receipt.submissionEntry=true;save();
 }
 if(parts==='clean-button-copies'&&!receipt.cleanButtonCopies) {
   const initial=JSON.parse(fs.readFileSync('/Users/moon/Desktop/Works/job-application-service/_workspace/2026-11-08-design/initial-receipt.json','utf8'));
   const sourceMap={'5:588':'4:187','5:600':'4:173','5:541':'4:181'};
   const copied=new Map();
   for(const op of receipt.operations)if(op.command==='clone_node'&&sourceMap[op.params.nodeId])copied.set(op.result.id,sourceMap[op.params.nodeId]);
   for(const op of initial.ops)if(op.name==='clone_node'&&sourceMap[op.args.nodeId])copied.set(op.id,sourceMap[op.args.nodeId]);
   const all=await call('get_document_info');let count=0;
   for(const root of all.children.filter(x=>x.type==='FRAME'&&!x.name.startsWith('JaNovel'))){
     const data=await info(root.id);
     const parents=new Map();for(const parent of walk(data))for(const [index,child] of (parent.children||[]).entries())parents.set(child.id,{parent,index});
     for(const old of walk(data).filter(x=>copied.has(x.id))){
       const {parent,index}=parents.get(old.id),label=walk(old).find(x=>x.type==='TEXT');
       const n=await clone(copied.get(old.id),parent.id);await call('set_parent',{nodeId:n.id,parentId:parent.id,index});
       await size(n.id,old.absoluteBoundingBox.width,old.absoluteBoundingBox.height);
       const targetText=walk(await info(n.id)).find(x=>x.type==='TEXT');await set(targetText.id,label.characters);
       if(old.fills?.[0]?.color)await call('set_fill_color',{nodeId:n.id,...rgb(old.fills[0].color)});
       if(label.fills?.[0]?.color)await call('set_fill_color',{nodeId:targetText.id,...rgb(label.fills[0].color)});
       await call('delete_node',{nodeId:old.id});count++;
     }
   }
   receipt.cleanButtonCopies=true;receipt.buttonCopiesReplaced=count;save();console.log('Reused foundation buttons: '+count);
 }
 if(parts==='question-tab-size'&&!receipt.questionTabSize) {
   const id=receipt.screens['Q2 작성 · 문항별 기록'];
   const node=await info(id);
   for(const tab of walk(node).filter(x=>x.name==='JaNovel/Question tab'||(x.type==='INSTANCE'&&x.name.startsWith('State='))))await size(tab.id,48,48);
   receipt.questionTabSize=true;receipt.visualDirty=[id];save();
 }
 console.log(JSON.stringify({screens:receipt.screens,operations:receipt.operations.length}));
} finally {client.close();}
