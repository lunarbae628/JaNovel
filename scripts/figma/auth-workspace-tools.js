// Scoped JaNovel authentication design frames and workspace resize handles.
async function janovelAuthScreens(params){
 await janovelCheckFile();const [regular,medium,bold,inputMaster]=await janovelProductNodes(['5:540','5:539','5:610','4:198']);await Promise.all([regular,medium,bold,inputMaster].map(janovelProductFonts));
 const made=[],controls={};const paint=h=>janovelInk(h),text=(parent,value,size=14,color='#302B27',weight='regular',width=400)=>{const t=(weight==='bold'?bold:weight==='medium'?medium:regular).clone();parent.appendChild(t);t.name=value;t.characters=value;t.fontSize=size;t.lineHeight={unit:'PIXELS',value:Math.round(size*1.6)};t.textAutoResize='HEIGHT';t.resize(width,t.height);t.fills=paint(color);return t;};
 const frame=(parent,name,width,mode='VERTICAL')=>{const f=figma.createFrame();parent.appendChild(f);f.name=name;f.layoutMode=mode;f.resize(width,100);f.primaryAxisSizingMode='AUTO';f.counterAxisSizingMode='FIXED';f.fills=[];f.clipsContent=false;return f;};
 const gap=(parent,h)=>{const f=figma.createFrame();parent.appendChild(f);f.name='Space';f.resize(1,h);f.fills=[];return f;};
 const button=(parent,label,secondary=false)=>{const f=frame(parent,label,400,'HORIZONTAL');f.resize(400,46);f.primaryAxisSizingMode='FIXED';f.counterAxisAlignItems='CENTER';f.primaryAxisAlignItems='CENTER';f.cornerRadius=6;f.fills=paint(secondary?'#FFFFFF':'#274690');if(secondary){f.strokes=paint('#D8DBE2');f.strokeWeight=1;}const t=text(f,label,14,secondary?'#274690':'#FFFFFF','medium');t.textAutoResize='WIDTH_AND_HEIGHT';return f;};
 const field=(parent,label,placeholder)=>{const f=frame(parent,label+' 입력',400);f.itemSpacing=8;text(f,label,13);const n=inputMaster.createInstance();f.appendChild(n);n.resize(400,46);n.layoutSizingHorizontal='FILL';const t=n.findOne(n=>n.type==='TEXT');t.characters=placeholder;t.fontSize=14;t.lineHeight={unit:'PIXELS',value:22};return n;};
 for(const [i,page]of ['login','signup','signup-code','signup-details','reset'].entries()){
  const root=figma.createFrame();figma.currentPage.appendChild(root);root.name=({login:'로그인',signup:'회원가입 · 이메일 입력','signup-code':'회원가입 · 인증번호 확인','signup-details':'회원가입 · 계정 만들기',reset:'비밀번호 재설정'})[page]+' · Desktop';root.layoutMode='HORIZONTAL';root.resize(1440,900);root.primaryAxisSizingMode='FIXED';root.counterAxisSizingMode='FIXED';root.x=33040+(i%2)*1540;root.y=3880+Math.floor(i/2)*1020;root.fills=paint('#FFFFFF');root.clipsContent=true;
  const brand=frame(root,'JaNovel 브랜드',604);brand.resize(604,900);brand.primaryAxisSizingMode='FIXED';brand.layoutSizingVertical='FILL';brand.paddingLeft=brand.paddingRight=64;brand.paddingTop=brand.paddingBottom=48;brand.fills=paint('#F5F3F5');text(brand,'JaNovel.',28,'#1B264F','bold',460);gap(brand,134);text(brand,'나의 지원 기록',12,'#576CA8','regular',440);gap(brand,12);text(brand,'고쳐 쓴 과정까지,\n나의 이야기로.',34,'#302B27','bold',440);gap(brand,10);text(brand,'자소서의 다음 버전을 이어가세요.',14,'#727272','regular',440);gap(brand,38);
  const history=frame(brand,'지원 기록 예시',400);history.itemSpacing=22;for(const [version,caption]of [['첫 초안','나의 경험을 정리하고'],['다른 도입','새로운 방향을 시도하고'],['작성 중','더 나은 문장으로 이어가기']]){const row=frame(history,version,400,'HORIZONTAL');row.itemSpacing=20;row.counterAxisAlignItems='CENTER';const dot=figma.createEllipse();row.appendChild(dot);dot.resize(7,7);dot.fills=paint(version==='작성 중'?'#274690':'#F5F3F5');dot.strokes=paint('#274690');dot.strokeWeight=1.2;const words=frame(row,'기록 설명',360);words.itemSpacing=4;text(words,version,12,'#576CA8','regular',360);text(words,caption,14,'#302B27','regular',360);}
  const fill=gap(brand,1);fill.layoutGrow=1;text(brand,'자소서부터 면접까지, JaNovel',12,'#727272','regular',440);
  const side=frame(root,'인증 폼 영역',836);side.resize(836,900);side.primaryAxisSizingMode='FIXED';side.layoutSizingHorizontal='FILL';side.layoutSizingVertical='FILL';side.primaryAxisAlignItems='CENTER';side.counterAxisAlignItems='CENTER';const form=frame(side,'인증 폼',400);form.itemSpacing=0;
  const back=text(form,'← 작성 화면',12,'#727272');gap(form,38);
  if(page==='signup'||page==='signup-code'||page==='signup-details'){text(form,page!=='signup-details'?'1 이메일 확인     —     2 계정 만들기':'1 이메일 확인 완료     —     2 계정 만들기',12,'#576CA8');gap(form,22);}
  const titles={login:'다시 만나 반가워요',signup:'이메일을 확인할게요','signup-code':'인증번호를 입력해 주세요','signup-details':'계정을 만들어 주세요',reset:'비밀번호 재설정'};text(form,titles[page],26,'#302B27','bold');gap(form,8);text(form,page==='login'?'이메일로 로그인하고 작성을 이어가세요.':page==='signup'?'사용할 이메일로 인증번호를 받아 주세요.':page==='signup-code'?'이메일로 받은 6자리 번호를 입력해 주세요.':page==='signup-details'?'이름과 안전한 비밀번호만 있으면 준비 끝.':'계정에 등록한 이메일을 입력해 주세요.',13,'#727272');gap(form,32);
  if(page==='signup-details'){field(form,'이름','이름');gap(form,20);field(form,'비밀번호','비밀번호 만들기');gap(form,8);text(form,'8자 이상 · 영문 대·소문자, 숫자 포함',12,'#727272');gap(form,20);field(form,'비밀번호 확인','비밀번호 다시 입력');}
  else{field(form,'이메일','name@example.com');if(page==='login'){gap(form,20);field(form,'비밀번호','비밀번호');gap(form,16);}if(page==='signup-code'){gap(form,20);field(form,'인증번호','6자리 숫자');gap(form,8);text(form,'이메일로 받은 인증번호를 입력해 주세요.',12,'#727272');}}
  let forgot;if(page==='login'){forgot=text(form,'비밀번호를 잊으셨나요?',12,'#727272');forgot.textAlignHorizontal='RIGHT';}
  gap(form,24);const primary=button(form,({login:'로그인',signup:'인증번호 받기','signup-code':'확인하고 계속하기','signup-details':'가입하고 시작하기',reset:'재설정 안내 받기'})[page]);gap(form,26);
  const alternate=text(form,page==='login'?'아직 계정이 없나요?  회원가입':'이미 계정이 있나요?  로그인',13,'#727272');alternate.textAlignHorizontal='CENTER';
  let send;if(page==='signup-code'){gap(form,16);send=text(form,'인증번호 다시 받기',12,'#274690');send.textAlignHorizontal='CENTER';}
  controls[page]={rootId:root.id,back:back.id,primary:primary.id,alternate:alternate.id,forgot:forgot?.id,send:send?.id};made.push({id:root.id,name:root.name,textCount:root.findAll(n=>n.type==='TEXT').length,createdNodeIds:[root,...root.findAll(()=>true)].map(n=>n.id)});
 }
 return {screens:made,controls};
}
async function janovelWorkspaceHandles(params){
 await janovelCheckFile();const out=[];
 for(const id of params.rootIds){const [root]=await janovelProductNodes([id]);const work=root.findOne(n=>n.name==='작업 공간');if(!work)continue;const left=work.children.find(n=>n.name==='문항별 기록 · 로그형'||n.name==='문항별 버전 기록'),right=work.children.find(n=>n.name==='AI 대화');if(!left||!right)continue;
  const controls=[];for(const [side,index]of [['left',work.children.indexOf(left)+1],['right',work.children.indexOf(right)-1]]){const old=work.children[index];if(old.name==='너비 조절 · '+side){controls.push({id:old.id,side});continue;}if(old.name!=='Divider')throw Error('Expected workspace divider');
   const handle=figma.createFrame();work.insertChild(index,handle);handle.name='너비 조절 · '+side;handle.layoutMode='HORIZONTAL';handle.resize(6,work.height);handle.primaryAxisAlignItems='CENTER';handle.counterAxisAlignItems='CENTER';handle.layoutSizingVertical='FILL';handle.fills=janovelInk('#FFFFFF');handle.strokes=janovelInk('#E3E5E9');handle.strokeWeight=.5;const grip=figma.createRectangle();handle.appendChild(grip);grip.resize(2,24);grip.cornerRadius=1;grip.fills=janovelInk('#C5CAD4');old.remove();controls.push({id:handle.id,side});
  }out.push({id,controls});
 }
 return out;
}
async function janovelAuthRefine(params){
 await janovelCheckFile();const out=[];
 for(const id of params.rootIds){const [root]=await janovelProductNodes([id]);await janovelProductFonts(root);const changed=[];for(const n of [root,...root.findAll(()=>true)])if('reactions'in n&&n.reactions.length){await n.setReactionsAsync([]);changed.push(n.id);}
  const history=root.findOne(n=>n.name==='지원 기록 예시');for(const row of history.children.filter(n=>n.type==='FRAME')){row.primaryAxisSizingMode='FIXED';row.counterAxisSizingMode='AUTO';}
  const old=history.children.find(n=>n.name==='기록 연결선');if(old)old.remove();const line=figma.createRectangle();history.insertChild(0,line);line.name='기록 연결선';line.layoutPositioning='ABSOLUTE';line.resize(1,history.height-46);line.x=3;line.y=23;line.fills=janovelInk('#8B9BC3');
  const form=root.findOne(n=>n.name==='인증 폼');for(const t of form.children.filter(n=>n.type==='TEXT'&&/계정이.*로그인|아직 계정이/.test(n.characters))){const start=t.characters.lastIndexOf(' ')+1;t.setRangeFills(start,t.characters.length,janovelInk('#274690'));}
  const resend=form.findOne(n=>n.type==='TEXT'&&n.characters==='인증번호 다시 받기');if(resend)resend.characters='이메일 수정하기';
  out.push({id,changed,historyHeight:history.height});
 }return out;
}
async function janovelDesignInventory(){
 await janovelCheckFile();const page=await figma.getNodeByIdAsync('0:1');const roots=[],sections=[],masters=[];
 function visit(n){if(n.type==='SECTION'){sections.push({id:n.id,name:n.name});for(const x of n.children)visit(x);}else if(n.type==='COMPONENT'||n.type==='COMPONENT_SET')masters.push({id:n.id,name:n.name,type:n.type});else if('width'in n)roots.push({id:n.id,name:n.name,type:n.type,width:n.width,height:n.height,x:n.absoluteBoundingBox?.x,y:n.absoluteBoundingBox?.y});}
 for(const n of page.children)visit(n);
 const rootIds=new Set(roots.map(n=>n.id)),incoming={};for(const n of page.findAll(n=>'reactions'in n&&n.reactions.length))for(const r of n.reactions)for(const a of r.actions||[])if(a.destinationId&&rootIds.has(a.destinationId))incoming[a.destinationId]=(incoming[a.destinationId]||0)+1;
 return {pages:figma.root.children.map(n=>({id:n.id,name:n.name})),roots,sections,masters,incoming};
}
async function janovelAuthOAuth(params){
 await janovelCheckFile();const out=[],[template]=await janovelProductNodes(['5:539']);await janovelProductFonts(template);const hash=figma.createImage(new Uint8Array(params.googleBytes)).hash;
 for(const id of params.rootIds){const [root]=await janovelProductNodes([id]);const form=root.findOne(n=>n.name==='인증 폼');if(!form)throw Error('Authentication form missing');const old=form.children.find(n=>n.name==='OAuth 로그인');if(old)old.remove();const index=form.children.findIndex(n=>n.name==='이메일 입력');const group=figma.createFrame();form.insertChild(index,group);group.name='OAuth 로그인';group.layoutMode='VERTICAL';group.resize(400,100);group.primaryAxisSizingMode='AUTO';group.counterAxisSizingMode='FIXED';group.itemSpacing=10;group.fills=[];const buttons=[];
  for(const provider of ['Google','카카오']){const button=figma.createFrame();group.appendChild(button);button.name=provider+' OAuth 로그인';button.layoutMode='HORIZONTAL';button.resize(400,46);button.primaryAxisSizingMode='FIXED';button.counterAxisSizingMode='FIXED';button.primaryAxisAlignItems='CENTER';button.counterAxisAlignItems='CENTER';button.cornerRadius=6;button.fills=janovelInk(provider==='Google'?'#FFFFFF':'#FEE500');if(provider==='Google'){button.strokes=janovelInk('#747775');button.strokeWeight=1;}
   const t=template.clone();button.appendChild(t);await t.setReactionsAsync([]);t.characters=provider==='Google'?'Google로 계속하기':'카카오 로그인';t.fontSize=14;t.lineHeight={unit:'PIXELS',value:22};t.textAutoResize='WIDTH_AND_HEIGHT';t.fills=janovelInk('#191919');
   const icon=figma.createFrame();button.appendChild(icon);icon.name=provider+' 공식 심볼';icon.resize(20,20);icon.layoutPositioning='ABSOLUTE';icon.x=16;icon.y=13;icon.fills=[];icon.clipsContent=true;
   if(provider==='Google'){const image=figma.createRectangle();icon.appendChild(image);image.resize(40,40);image.x=image.y=-10;image.fills=[{type:'IMAGE',imageHash:hash,scaleMode:'FILL'}];}else{const vector=figma.createNodeFromSvg(params.kakaoSvg);icon.appendChild(vector);vector.resize(18,18);vector.x=vector.y=1;}
   await button.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',navigation:'NAVIGATE',destinationId:'41:345',transition:null}]}]);buttons.push({provider,id:button.id});
  }
  const separator=figma.createFrame();group.appendChild(separator);separator.name='이메일 로그인 구분';separator.layoutMode='HORIZONTAL';separator.resize(400,44);separator.primaryAxisSizingMode='FIXED';separator.counterAxisAlignItems='CENTER';separator.primaryAxisAlignItems='CENTER';separator.itemSpacing=12;separator.fills=[];
  for(let i=0;i<3;i++)if(i===1){const t=template.clone();separator.appendChild(t);await t.setReactionsAsync([]);t.characters='또는 이메일로 계속하기';t.fontSize=11;t.lineHeight={unit:'PIXELS',value:18};t.textAutoResize='WIDTH_AND_HEIGHT';t.fills=janovelInk('#727272');}else{const line=figma.createRectangle();separator.appendChild(line);line.resize(100,1);line.layoutSizingHorizontal='FILL';line.fills=janovelInk('#E3E5E9');}
  out.push({id,buttons,createdNodeIds:[group,...group.findAll(()=>true)].map(n=>n.id)});
 }return out;
}

async function janovelOrganizeDesign(params){
 await janovelCheckFile();const page=await figma.getNodeByIdAsync('0:1');await figma.setCurrentPageAsync(page);const before=page.findAll(()=>true).length;page.name='01 · 화면 흐름';
 const ensurePage=name=>figma.root.children.find(n=>n.name===name)||(()=>{const p=figma.createPage();p.name=name;return p})();const library=ensurePage('99 · 공통 컴포넌트'),archive=ensurePage('90 · 이전 시안');
 const sections=[];const placed=new Set(),moved=[];let y=1000;
 for(const group of params.groups){const section=figma.createSection();page.appendChild(section);section.name=group.name;section.x=0;section.y=y;section.fills=janovelInk('#F0F1F4');let x=64,cy=72,rowH=0;const ids=[];
  for(const id of group.ids){const node=await figma.getNodeByIdAsync(id);if(!node||placed.has(id))continue;if(x>64&&x+node.width>4608){x=64;cy+=rowH+100;rowH=0;}section.appendChild(node);node.x=x;node.y=cy;x+=node.width+80;rowH=Math.max(rowH,node.height);placed.add(id);ids.push(id);moved.push({id,page:page.id});}
  section.resizeWithoutConstraints(4736,cy+rowH+64);sections.push({id:section.id,name:section.name,frames:ids});y+=section.height+180;
 }
 // Keep every connected detailed state on the prototype page. Components can live separately.
 const details=figma.createSection();page.appendChild(details);details.name='80 · 상세 상태 / 클릭 검증용';details.x=5200;details.y=1000;details.fills=janovelInk('#F4F4F6');let dx=64,dy=72,rowH=0,detailCount=0;
 const oldSections=page.children.filter(n=>n.type==='SECTION'&&!sections.some(s=>s.id===n.id)&&n.id!==details.id);
 const candidates=[];for(const n of [...page.children])if(n.type!=='SECTION'&&!placed.has(n.id))candidates.push(n);for(const s of oldSections)for(const n of [...s.children])if(!placed.has(n.id))candidates.push(n);
 const archiveIds=new Set(params.archiveIds),masterIds=new Set(params.masterIds);let ai=0,mi=0,lx=64,ly=64,lh=0;
 for(const n of candidates){if(n.id==='4:171'||masterIds.has(n.id)||n.type==='COMPONENT'||n.type==='COMPONENT_SET'){if(lx>64&&lx+n.width>9000){lx=64;ly+=lh+80;lh=0;}library.appendChild(n);n.x=lx;n.y=ly;lx+=n.width+80;lh=Math.max(lh,n.height);mi++;moved.push({id:n.id,page:library.id});}
  else if(archiveIds.has(n.id)){archive.appendChild(n);n.x=(ai%3)*1540;n.y=Math.floor(ai/3)*1040;ai++;moved.push({id:n.id,page:archive.id});}
  else{if(dx>64&&dx+n.width>15440){dx=64;dy+=rowH+80;rowH=0;}details.appendChild(n);n.x=dx;n.y=dy;dx+=n.width+64;rowH=Math.max(rowH,n.height);detailCount++;moved.push({id:n.id,page:page.id});}}
 details.resizeWithoutConstraints(15568,dy+rowH+64);
 for(const s of oldSections)if(!s.children.length)s.remove();
 const [template]=await janovelProductNodes(['5:610']);await janovelProductFonts(template);const board=figma.createFrame();page.appendChild(board);board.name='00 · 여기서 시작 / 화면 흐름 안내';board.resize(1440,720);board.x=0;board.y=0;board.fills=janovelInk('#FFFFFF');board.cornerRadius=12;
 const txt=(value,x,y,size=18,width=1300,color='#302B27')=>{const n=template.clone();board.appendChild(n);n.characters=value;n.fontSize=size;n.lineHeight={unit:'PIXELS',value:Math.round(size*1.5)};n.textAutoResize='HEIGHT';n.resize(width,n.height);n.x=x;n.y=y;n.fills=janovelInk(color);return n;};txt('JaNovel · 화면 흐름',48,44,30);txt('01 인증 → 02 지원 현황 → 03 공고 등록 → 04 작성 → 05 버전 관리 → 06 병합안 비교',48,104,15,1300,'#576CA8');txt('카드를 누르면 대표 화면으로 이동합니다. 상세 상태는 오른쪽, 이전 시안과 공통 부품은 별도 페이지에 보관했습니다.',48,144,12,1300,'#727272');
 for(const [i,group]of params.groups.entries()){const card=figma.createFrame();board.appendChild(card);card.name=group.name;card.resize(416,138);card.x=48+(i%3)*448;card.y=220+Math.floor(i/3)*168;card.fills=janovelInk('#F7F7F8');card.cornerRadius=8;const t=template.clone();card.appendChild(t);t.characters=group.name;t.fontSize=17;t.lineHeight={unit:'PIXELS',value:26};t.textAutoResize='HEIGHT';t.resize(360,t.height);t.x=24;t.y=26;t.fills=janovelInk('#302B27');await t.setReactionsAsync([]);await card.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',navigation:'NAVIGATE',destinationId:group.ids[0],transition:null}]}]);}
 page.flowStartingPoints=[{nodeId:params.loginId,name:'01 로그인부터'},{nodeId:'41:345',name:'02 지원 현황부터'},{nodeId:'5:530',name:'04 작성부터'},{nodeId:'113:193951',name:'06 병합 방식 비교'}];
 const disconnected=[];for(const n of page.findAll(n=>'reactions'in n&&n.reactions.length))for(const r of n.reactions)for(const a of r.actions||[])if(a.type==='NODE'&&a.destinationId){const dest=await figma.getNodeByIdAsync(a.destinationId);if(!dest)disconnected.push({source:n.id,to:a.destinationId});}
 figma.currentPage.selection=[board];figma.viewport.scrollAndZoomIntoView([board]);return{boardId:board.id,pages:figma.root.children.map(p=>({id:p.id,name:p.name})),sections,detailSection:details.id,detailCount,masterCount:mi,archiveCount:ai,moved,before,missingDestinations:disconnected};
}
async function janovelDesignAudit(params){
 await janovelCheckFile();const page=await figma.getNodeByIdAsync('0:1'),library=figma.root.children.find(n=>n.name==='99 · 공통 컴포넌트'),archive=figma.root.children.find(n=>n.name==='90 · 이전 시안');if(archive)figma.root.insertChild(1,archive);if(library)figma.root.appendChild(library);await figma.setCurrentPageAsync(page);
 for(const section of params.sections){const parent=await figma.getNodeByIdAsync(section.id);for(const id of [...section.frames].reverse()){const n=await figma.getNodeByIdAsync(id);parent.appendChild(n);}}
 for(const id of [params.detailSection,...params.sections.map(n=>n.id).reverse(),params.boardId])page.appendChild(await figma.getNodeByIdAsync(id));
 page.flowStartingPoints=[{nodeId:params.boardId,name:'00 전체 흐름 안내'},...page.flowStartingPoints.filter(n=>n.nodeId!==params.boardId)];
 const overlaps=[];for(const section of params.sections){const root=await figma.getNodeByIdAsync(section.id),nodes=root.children;for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j];if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)overlaps.push([a.id,b.id]);}}
 const actions=page.findAll(n=>'reactions'in n&&n.reactions.length).flatMap(n=>n.reactions.flatMap(r=>(r.actions||[]).filter(a=>a.type==='NODE'&&a.destinationId).map(a=>({source:n.id,to:a.destinationId,type:a.navigation}))));const destinations=new Map();for(const a of actions)if(!destinations.has(a.to)){const n=await figma.getNodeByIdAsync(a.to);let p=n;while(p&&p.type!=='PAGE')p=p.parent;destinations.set(a.to,{exists:!!n,pageId:p?.id});}const missing=actions.filter(a=>!destinations.get(a.to).exists),crossPage=actions.filter(a=>a.type!=='CHANGE_TO'&&destinations.get(a.to).pageId!==page.id);
 const orphanInstances=(await Promise.all(page.findAll(n=>n.type==='INSTANCE').map(async n=>({id:n.id,ok:!!(await n.getMainComponentAsync())})))).filter(n=>!n.ok).map(n=>n.id);const board=await figma.getNodeByIdAsync(params.boardId);page.selection=[board];figma.viewport.scrollAndZoomIntoView([board]);return{pages:figma.root.children.map(n=>({id:n.id,name:n.name})),coreFrames:params.sections.reduce((s,n)=>s+n.frames.length,0),overlaps,missingDestinations:missing,crossPageNavigation:crossPage,orphanInstances,prototypeActions:actions.length};
}
// Align the existing header controls without changing their outer IDs or reactions.
async function janovelPanelHeaderIcons(params){
 await janovelCheckFile();const [maximize,minimize]=await janovelProductNodes(['94:105443','94:105449']);const changed=[],seen=new Set();
 for(const id of params.rootIds){const [root]=await janovelProductNodes([id]);const headers=root.findAll(n=>n.type==='FRAME'&&['버전 패널 헤더','대화 패널 헤더'].includes(n.name));
  for(const head of headers){if(seen.has(head.id))continue;let parent=head.parent,immutable=false;while(parent&&parent.type!=='PAGE'){if(parent.type==='INSTANCE'){immutable=true;break;}parent=parent.parent;}if(immutable)continue;seen.add(head.id);head.itemSpacing=4;
   for(const text of head.children.filter(n=>n.type==='TEXT'&&n.characters==='기록'))text.visible=false;
   const buttons=[];for(const button of head.children.filter(n=>n.type==='INSTANCE')){const icon=button.children.find(n=>n.type==='INSTANCE'&&n.name.startsWith('JaNovel/Icon/'));if(!icon)continue;
    if(/maximize|minimize/.test(icon.name)){const wide=head.parent.width>=360;icon.swapComponent(wide?minimize:maximize);button.setPluginData('janovelTooltip',wide?'기본 너비로':'그래프 넓히기');}
    if(button.layoutMode!=='NONE'){button.primaryAxisSizingMode='FIXED';button.counterAxisSizingMode='FIXED';button.primaryAxisAlignItems='CENTER';button.counterAxisAlignItems='CENTER';button.paddingTop=button.paddingBottom=button.paddingLeft=button.paddingRight=0;}
    button.resize(32,32);button.layoutSizingHorizontal=button.layoutSizingVertical='FIXED';icon.resize(18,18);icon.layoutSizingHorizontal=icon.layoutSizingVertical='FIXED';for(const child of button.children)if(child.id!==icon.id)child.visible=false;
    buttons.push({id:button.id,icon:icon.id,width:button.width,height:button.height,iconWidth:icon.width,iconHeight:icon.height,reactions:button.reactions.length});
   }if(buttons.length)changed.push({id:head.id,buttons});
  }
 }return{headers:changed,mutatedNodeIds:changed.flatMap(n=>[n.id,...n.buttons.map(n=>n.id)])};
}
async function janovelPanelIconInspect(params){const nodes=await janovelProductNodes(params.ids);return nodes.map(n=>({id:n.id,width:n.width,height:n.height,minWidth:n.minWidth,maxWidth:n.maxWidth,minHeight:n.minHeight,maxHeight:n.maxHeight,layoutSizingHorizontal:n.layoutSizingHorizontal,layoutSizingVertical:n.layoutSizingVertical,boundVariables:n.boundVariables}));}
