const page=await figma.getNodeByIdAsync('0:1');await figma.setCurrentPageAsync(page);
if(page.children.some(n=>n.name==='작성 · Desktop'))throw new Error('작성 화면이 이미 있습니다. 기존 화면을 수정하세요.');
const created=[],mutated=[],links=[],screens={};
const allVars=await figma.variables.getLocalVariablesAsync();
const theme=allVars.filter(v=>v.variableCollectionId==='VariableCollectionId:4:130');
const tokens=Object.fromEntries(theme.map(v=>[v.name,v]));
const textStyles=Object.fromEntries((await figma.getLocalTextStylesAsync()).filter(s=>s.name.startsWith('JaNovel/')).map(s=>[s.name.slice(8),s]));
const [primary,graphite,ghost,tabDefault,tabActive,fieldSingle,fieldMulti,foldLeft,foldRight]=await Promise.all(['4:173','4:181','4:187','4:193','4:195','4:198','4:200','4:207','4:210'].map(id=>figma.getNodeByIdAsync(id)));
const sourceFonts=new Map();for(const parent of [primary,graphite,ghost])for(const t of parent.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))sourceFonts.set(JSON.stringify(s.fontName),s.fontName);
const fonts=(await figma.listAvailableFontsAsync()).filter(f=>f.fontName.family==='Noto Sans KR'&&['Regular','Medium','Bold'].includes(f.fontName.style)).map(f=>f.fontName);
await Promise.all([...fonts,...sourceFonts.values()].map(f=>figma.loadFontAsync(f)));
const paint=k=>figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0}},'color',tokens['color/'+k]);
function track(n,deep=false){created.push(n.id);if(deep&&'findAll' in n)created.push(...n.findAll(()=>true).map(x=>x.id));return n;}
function bind(n,prop,value){n.setBoundVariable(prop,tokens[value]);}
function frame(parent,name,dir,w,h,bg){const n=track(figma.createAutoLayout(dir));n.name=name;n.resize(w,h);n.primaryAxisSizingMode='FIXED';n.counterAxisSizingMode='FIXED';n.fills=bg?[paint(bg)]:[];n.clipsContent=false;parent.appendChild(n);return n;}
function pad(n,size){for(const k of ['paddingTop','paddingRight','paddingBottom','paddingLeft']){n[k]=size;if(tokens['space/'+size])bind(n,k,'space/'+size);}}
function gap(n,size){n.itemSpacing=size;if(tokens['space/'+size])bind(n,'itemSpacing','space/'+size);}
function fill(n){n.layoutSizingHorizontal='FILL';return n;}
function hug(n){n.layoutSizingVertical='HUG';return n;}
function txt(parent,text,style='Label',color='ink',width){const n=track(figma.createText());n.name=text.slice(0,30);n.fontName=fonts.find(f=>f.style==='Regular');n.characters=text;n.textStyleId=textStyles[style].id;n.fills=[paint(color)];parent.appendChild(n);if(width){n.textAutoResize='HEIGHT';n.resize(width,n.height);}return n;}
function divider(parent,vertical=false){const n=track(figma.createRectangle());n.name='Divider';n.resize(vertical?1:parent.width,vertical?parent.height:1);n.fills=[paint('line')];parent.appendChild(n);return n;}
function button(parent,label,kind='Ghost',width){const n=track((kind==='Primary'?primary:kind==='Graphite'?graphite:ghost).clone(),true);parent.appendChild(n);n.name=label;n.setProperties({'Label#2:0':label});n.resize(width||Math.max(52,label.length*14+28),36);n.layoutSizingHorizontal='FIXED';n.layoutSizingVertical='FIXED';return n;}
function tab(parent,label,active=false){const n=track((active?tabActive:tabDefault).createInstance(),true);parent.appendChild(n);const key=Object.keys(n.componentProperties).find(k=>k.startsWith('Label#'));n.setProperties({[key]:label});n.resize(48,48);n.layoutSizingHorizontal='FIXED';n.layoutSizingVertical='FIXED';return n;}
function fold(parent,right=false){const n=track((right?foldRight:foldLeft).createInstance(),true);parent.appendChild(n);return n;}
function field(parent,label,multi=false,width=360){const n=track((multi?fieldMulti:fieldSingle).createInstance(),true);parent.appendChild(n);const key=Object.keys(n.componentProperties).find(k=>k.startsWith('Placeholder#'));n.setProperties({[key]:label});n.resize(width,multi?112:44);return n;}
function spacer(parent){const n=frame(parent,'Space','VERTICAL',1,1);n.layoutSizingHorizontal='FILL';return n;}
function link(n,target){links.push({from:n.id,to:target});}
const paras=[
 '수정한 기록이 쌓여도 필요한 내용을 정확히 찾을 수 있는 서비스를 만들고 싶습니다. 문서 저장과 변경 이력을 다루는 모노랩의 백엔드 개발 직무에 지원한 이유입니다.',
 '문서 관리 프로젝트에서 정상 저장뿐 아니라 실패한 요청이 남기는 데이터까지 확인했습니다. 생성 대상을 먼저 기록하고 복구 경로를 마련하면서, 사용자가 맡긴 기록을 끝까지 관리하는 일에 흥미를 느꼈습니다.',
 '이 경험을 바탕으로 문서 저장과 변경 이력을 안정적으로 다루고 싶습니다. 먼저 서비스의 데이터 흐름과 저장 기준을 익히고, 변경 전후를 재현할 수 있는 테스트를 작성하겠습니다.'
];
const before=[paras[0],'문서 관리 프로젝트에서 데이터 저장 기능을 개발했습니다. 저장 이후에도 기록이 정확하게 남는지 확인하는 일이 중요하다고 느꼈습니다.',paras[2]];
const prompt='지원한 이유와 입사 후 목표를 작성해 주세요.';
const count=paras.join('\n\n').length;
function root(name,w,h,x,y){const n=frame(page,name,'VERTICAL',w,h,'paper');n.x=x;n.y=y;n.clipsContent=true;n.strokes=[paint('line')];screens[name]=n.id;return n;}
function header(parent,mobile=false){const h=frame(parent,'회사 헤더','HORIZONTAL',parent.width,mobile?112:64,'paper');pad(h,mobile?16:24);h.counterAxisAlignItems='CENTER';gap(h,24);
 const back=button(h,'← 지원 현황','Ghost',112);back.name='지원 현황으로 돌아가기';
 if(mobile){h.layoutMode='VERTICAL';gap(h,8);h.counterAxisAlignItems='MIN';back.resize(112,24);const row=frame(h,'회사와 지원 링크','HORIZONTAL',parent.width-32,36);row.counterAxisAlignItems='CENTER';txt(row,'모노랩','Label');spacer(row);button(row,'지원하러 가기 ↗','Graphite',140);}else{const info=frame(h,'회사와 직무','HORIZONTAL',620,36);info.counterAxisAlignItems='CENTER';gap(info,16);txt(info,'모노랩','Label');txt(info,'Java / Spring 백엔드','Caption','muted');fill(info);button(h,'지원하러 가기 ↗','Graphite',144);}
}
function qTitle(parent,width,compact=false){const row=frame(parent,'문항과 글자 수','HORIZONTAL',width,64);hug(row);gap(row,12);row.layoutWrap='WRAP';row.counterAxisAlignItems='BASELINE';txt(row,compact?'지원한 이유와 입사 후 목표를\n작성해 주세요.':prompt,'Question','ink',compact?width:undefined);txt(row,count+' / 700자','Caption','muted');return row;}
function toolbar(parent,mode='write',mobile=false){const row=frame(parent,'문항·작성 도구','HORIZONTAL',parent.width,mobile?56:56,'paper');row.paddingLeft=mobile?16:24;row.paddingRight=mobile?16:24;row.counterAxisAlignItems='CENTER';gap(row,4);tab(row,'Q1',true);tab(row,'Q2');spacer(row);
 if(mode==='compare'){const w=button(row,'← 작성','Ghost',82);link(w,'write');button(row,'병합','Ghost',56);}else{const c=button(row,'비교','Ghost',mobile?44:56);link(c,'compare');button(row,'병합','Ghost',mobile?44:56);const snap=button(row,'스냅샷','Primary',mobile?76:84);link(snap,'snapshot');}return row;}
function graph(parent,collapsed=false){const panel=frame(parent,'문항별 버전 기록','VERTICAL',collapsed?40:208,parent.height,'graph');
 if(collapsed){const r=frame(panel,'펼치기','HORIZONTAL',40,56);r.counterAxisAlignItems='CENTER';r.primaryAxisAlignItems='CENTER';link(fold(r,true),'write');return panel;}
 const head=frame(panel,'버전 패널 헤더','HORIZONTAL',208,56);pad(head,16);head.counterAxisAlignItems='CENTER';txt(head,'버전 기록','Caption','muted');spacer(head);link(fold(head),'focus');
 const content=frame(panel,'Q1 기록','VERTICAL',208,parent.height-56);pad(content,16);gap(content,16);txt(content,'Q1 · 지원동기','Caption','muted');
 const canvas=track(figma.createFrame());canvas.name='버전 그래프';canvas.resize(176,364);canvas.fills=[];content.appendChild(canvas);
 const path=track(figma.createVector());path.name='스냅샷 연결 관계';path.vectorPaths=[{windingRule:'NONZERO',data:'M 15 28 L 15 100 M 15 28 C 15 82 43 94 43 172 M 15 100 L 15 244'}];path.strokes=[paint('node')];path.strokeWeight=1.5;path.fills=[];canvas.appendChild(path);
 const names=[['v1','첫 초안',0],['v2','경험 구체화',0],['v2-A','다른 도입',28],['작성 중','현재 초안',0]];
 names.forEach(([name,note,indent],i)=>{const row=frame(canvas,name,'HORIZONTAL',176-indent,56,i===3?'selected':null);row.x=indent;row.y=i*72;row.cornerRadius=4;row.counterAxisAlignItems='CENTER';row.paddingLeft=8;gap(row,12);
 const dot=track(figma.createEllipse());dot.name='Snapshot node';dot.resize(12,12);dot.fills=[paint(i===3?'blue':'paper')];dot.strokes=[paint(i===3?'blue':'node')];dot.strokeWeight=1.5;row.appendChild(dot);
 const info=frame(row,'스냅샷 이름','VERTICAL',120-indent,44);hug(info);gap(info,2);txt(info,name,'Label',i===3?'blue':'ink');txt(info,note,'Caption','muted');link(row,i===3?'write':'compare');});
 return panel;
}
function chat(parent,collapsed=false){const panel=frame(parent,'AI 대화','VERTICAL',collapsed?40:360,parent.height,'chat');
 if(collapsed){const r=frame(panel,'펼치기','HORIZONTAL',40,56);r.primaryAxisAlignItems='CENTER';r.counterAxisAlignItems='CENTER';link(fold(r),'write');return panel;}
 const head=frame(panel,'대화 패널 헤더','HORIZONTAL',360,56,'chat');pad(head,16);head.counterAxisAlignItems='CENTER';gap(head,12);link(fold(head,true),'focus');txt(head,'AI 채팅','Label');spacer(head);txt(head,'Q1','Caption','muted');
 divider(panel);
 const conversation=frame(panel,'문항별 대화','VERTICAL',360,parent.height-56-217,'chat');pad(conversation,24);gap(conversation,24);
 const user=frame(conversation,'사용자 메시지','VERTICAL',280,84,'graph');user.layoutAlign='MAX';pad(user,12);hug(user);user.cornerRadius=8;txt(user,'지원동기가 직무와 잘 연결되는지 봐줘.','Body compact','ink',256);
 const response=frame(conversation,'피드백 응답','VERTICAL',312,290);hug(response);gap(response,16);txt(response,'경험을 소개한 부분에서 실제로 어떤 일을 했는지 드러나면 지원 이유가 더 분명해져요.','Body compact','ink',312);txt(response,'두 번째 문단을 구체화한 수정안을 확인해 보세요.','Body compact','ink',312);divider(response);const review=button(response,'수정안 비교 →','Ghost',124);for(const t of review.findAllWithCriteria({types:['TEXT']}))t.fills=[paint('blue')];link(review,'compare');
 const inputArea=frame(panel,'피드백 요청과 입력','VERTICAL',360,216,'chat');pad(inputArea,24);gap(inputArea,8);const request=button(inputArea,'피드백 요청','Ghost',110);for(const t of request.findAllWithCriteria({types:['TEXT']}))t.fills=[paint('blue')];field(inputArea,'메시지 입력 · Enter로 전송',true,312);return panel;
}
function writeContent(parent,focus=false,mobile=false){const content=frame(parent,'작성 본문','VERTICAL',parent.width,parent.height-57,'paper');pad(content,mobile?20:40);gap(content,32);if(focus)content.counterAxisAlignItems='CENTER';
 const doc=frame(content,'자소서','VERTICAL',mobile?parent.width-40:focus?760:parent.width-80,600);hug(doc);gap(doc,32);qTitle(doc,doc.width,mobile);for(const p of paras)txt(doc,p,mobile?'Body':'Body','ink',doc.width);return content;}
function compareContent(parent){const main=frame(parent,'두 스냅샷 비교','VERTICAL',parent.width,parent.height-57,'paper');pad(main,32);gap(main,24);txt(main,prompt,'Question','ink',main.width-64);
 const selectors=frame(main,'비교 대상','HORIZONTAL',main.width-64,40);gap(selectors,24);const colWidth=(main.width-64-25)/2;const a=frame(selectors,'원문 선택','HORIZONTAL',colWidth,40);a.counterAxisAlignItems='CENTER';gap(a,12);txt(a,'이전','Caption','muted');button(a,'v1 · 첫 초안 ⌄','Ghost',156);const b=frame(selectors,'수정본 선택','HORIZONTAL',colWidth,40);b.counterAxisAlignItems='CENTER';gap(b,12);txt(b,'이후','Caption','muted');button(b,'v2 · 경험 구체화 ⌄','Ghost',196);
 const columns=frame(main,'비교 본문','HORIZONTAL',main.width-64,500);gap(columns,12);hug(columns);const left=frame(columns,'원문','VERTICAL',colWidth,480);hug(left);gap(left,24);for(const p of before)txt(left,p,'Body compact','ink',colWidth);const line=divider(columns,true);line.resize(1,540);const right=frame(columns,'수정본','VERTICAL',colWidth,480);hug(right);gap(right,24);for(let i=0;i<paras.length;i++){if(i===1){const change=frame(right,'변경된 문단','VERTICAL',colWidth,160,'highlight');pad(change,8);hug(change);txt(change,paras[i],'Body compact','blue',colWidth-16);}else txt(right,paras[i],'Body compact','ink',colWidth);}
 line.resize(1,Math.max(left.height,right.height));divider(main);const foot=frame(main,'비교 작업','HORIZONTAL',main.width-64,36);foot.counterAxisAlignItems='CENTER';txt(foot,before.join('\n\n').length+' → '+count+'자','Caption','muted');spacer(foot);const branch=button(foot,'여기서 분기하기','Ghost',144);for(const t of branch.findAllWithCriteria({types:['TEXT']}))t.fills=[paint('blue')];return main;
}
function desktop(name,x,y,mode='write',collapsed=false){const app=root(name,1440,900,x,y);header(app);divider(app);const body=frame(app,'작업 공간','HORIZONTAL',1440,835,'paper');graph(body,collapsed);divider(body,true);const cw=1440-(collapsed?82:570);const center=frame(body,'작성·비교','VERTICAL',cw,835,'paper');toolbar(center,mode);divider(center);if(mode==='compare')compareContent(center);else writeContent(center,collapsed);divider(body,true);chat(body,collapsed);return app;}
const write=desktop('작성 · Desktop',100,100);
const compare=desktop('버전 비교 · Desktop',1640,100,'compare');
const focus=desktop('집중 작성 · Desktop',100,1100,'write',true);
const mobile=root('작성 · Mobile',390,844,3180,100);header(mobile,true);divider(mobile);const mobileNav=frame(mobile,'작업 영역','HORIZONTAL',390,48,'graph');mobileNav.counterAxisAlignItems='CENTER';mobileNav.paddingLeft=16;mobileNav.paddingRight=16;gap(mobileNav,12);txt(mobileNav,'버전','Caption','muted');txt(mobileNav,'작성','Label','blue');txt(mobileNav,'채팅','Caption','muted');spacer(mobileNav);tab(mobileNav,'Q1',true);tab(mobileNav,'Q2');
const mobileCenter=frame(mobile,'문항 작성','VERTICAL',390,682,'paper');const mobileTools=frame(mobileCenter,'작성 도구','HORIZONTAL',390,52);mobileTools.paddingLeft=16;mobileTools.paddingRight=16;mobileTools.counterAxisAlignItems='CENTER';gap(mobileTools,8);button(mobileTools,'비교','Ghost',52);button(mobileTools,'병합','Ghost',52);spacer(mobileTools);const mobileSnap=button(mobileTools,'스냅샷','Primary',84);link(mobileSnap,'snapshot');divider(mobileCenter);const mobileDoc=writeContent(mobileCenter,false,true);mobileDoc.resize(390,600);gap(mobileDoc,24);
const snapshot=track(write.clone(),true);snapshot.name='스냅샷 · Desktop';snapshot.x=1640;snapshot.y=1100;page.appendChild(snapshot);screens[snapshot.name]=snapshot.id;
const shade=track(figma.createRectangle());shade.name='Modal backdrop';shade.resize(1440,900);shade.fills=[{type:'SOLID',color:{r:48/255,g:43/255,b:39/255},opacity:.24}];snapshot.appendChild(shade);shade.layoutPositioning='ABSOLUTE';shade.x=0;shade.y=0;
const dialog=frame(snapshot,'스냅샷 이름·설명','VERTICAL',420,384,'paper');dialog.layoutPositioning='ABSOLUTE';dialog.x=510;dialog.y=258;pad(dialog,24);gap(dialog,20);dialog.cornerRadius=8;bind(dialog,'cornerRadius','radius/8');dialog.strokes=[paint('line')];txt(dialog,'스냅샷 남기기','Dialog title');const nameField=frame(dialog,'이름','VERTICAL',372,72);gap(nameField,8);txt(nameField,'이름 (선택)','Caption','muted');field(nameField,'예: 경험 구체화',false,372);const descField=frame(dialog,'설명','VERTICAL',372,140);gap(descField,8);txt(descField,'설명 (선택)','Caption','muted');field(descField,'변경한 내용이나 이유',true,372);const actions=frame(dialog,'확인과 취소','HORIZONTAL',372,36);spacer(actions);gap(actions,8);link(button(actions,'취소','Ghost',64),'write');link(button(actions,'확인','Primary',72),'write');
const targets={write:write.id,compare:compare.id,focus:focus.id,snapshot:snapshot.id};
for(const item of links){const n=await figma.getNodeByIdAsync(item.from);let top=n;while(top.parent&&top.parent.id!==page.id)top=top.parent;if(top.id===targets[item.to])continue;await n.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:targets[item.to],navigation:'NAVIGATE',transition:null}]}]);mutated.push(n.id);}
figma.viewport.scrollAndZoomIntoView([write]);
const inspect=n=>({id:n.id,name:n.name,width:n.width,height:n.height,textNodes:n.findAllWithCriteria({types:['TEXT']}).length,instances:n.findAllWithCriteria({types:['INSTANCE']}).length});
return {createdNodeIds:created,mutatedNodeIds:mutated,screens:Object.fromEntries(Object.entries(screens).map(([k,id])=>[k,id])),dialogId:dialog.id,summary:[write,compare,focus,mobile,snapshot].map(inspect),prototypeLinks:mutated.length,font:'Noto Sans KR',charCount:count};
