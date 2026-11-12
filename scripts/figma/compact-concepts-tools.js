// Narrow, project-only revision of existing JaNovel workbenches and three review concepts.
function janovelInk(hex){return [{type:'SOLID',color:{r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255}}];}
async function janovelCompactAssets(params){
 await janovelCheckFile();const ids={};
 for(const [name,source]of Object.entries(params.svgs)){
  let c=figma.currentPage.findOne(n=>n.type==='COMPONENT'&&n.name==='JaNovel/Icon/'+name);
  if(!c){c=figma.createComponent();c.name='JaNovel/Icon/'+name;c.resize(18,18);c.fills=[];c.x=33000+Object.keys(ids).length*64;c.y=100;
   const svg=figma.createNodeFromSvg(source.replace(/currentColor/g,'#646B78'));c.appendChild(svg);svg.resize(18,18);svg.x=svg.y=0;svg.name=name;c.description='Lucide icon: '+name+'; official lucide-icons/lucide SVG, ISC license.';}
  ids[name]=c.id;
 }return {icons:ids};
}
async function janovelCompactIcon(button,icon,mode){
 const children=button.children||[],text=children.find(n=>n.type==='TEXT'),slots=children.filter(n=>n.type==='INSTANCE');
 if(!slots.length)throw Error('Icon slot missing '+button.id);
 const slot=mode==='select'?slots[slots.length-1]:slots[0];slot.swapComponent(icon);slot.visible=true;slot.resize(18,18);
 for(const n of slots)if(n!==slot)n.visible=false;
 button.layoutSizingHorizontal='FIXED';button.layoutSizingVertical='FIXED';button.primaryAxisSizingMode='FIXED';button.counterAxisSizingMode='FIXED';button.counterAxisAlignItems='CENTER';button.paddingTop=button.paddingBottom=0;button.cornerRadius=6;
 if(mode==='select'){
  if(text){text.characters=text.characters.replace(/[⌄∨▾]/g,'').trim();text.visible=true;text.fontSize=13;text.lineHeight={unit:'PIXELS',value:20};text.textAlignHorizontal='LEFT';text.layoutSizingHorizontal='FILL';}
  button.paddingLeft=10;button.paddingRight=8;button.itemSpacing=8;button.primaryAxisAlignItems='MIN';button.fills=janovelInk('#F1F3F6');button.strokes=[];
  button.resize(Math.min(232,Math.max(120,(text?.characters.length||5)*8+48)),32);
 }else{
  if(text)text.visible=false;button.paddingLeft=button.paddingRight=0;button.itemSpacing=0;button.primaryAxisAlignItems='CENTER';button.resize(32,32);button.fills=[];button.strokes=[];
 }
}
async function janovelCompactPanels(params){
 const nodes=await janovelProductNodes(params.ids),icons={};for(const [k,id]of Object.entries(params.icons))icons[k]=(await janovelProductNodes([id]))[0];
 const done=[];
 for(const panel of nodes){await janovelProductFonts(panel);const header=panel.children[0];if(!header||header.type!=='FRAME')continue;
  const left=header.name==='버전 패널 헤더',folded=panel.name==='State=Collapsed',wide=panel.name==='State=Wide';
  const toggle=header.children.find(n=>n.type==='INSTANCE'&&n.name.includes('toggle'));
  if(left&&!folded){
   const oldTitle=header.children.find(n=>n.type==='TEXT'&&n.characters==='버전 기록');if(oldTitle)oldTitle.remove();
   const row=panel.findOne(n=>n.name==='현재 갈래와 전체 보기');
   if(row){const caption=row.children.find(n=>n.type==='TEXT');if(caption){caption.characters=caption.characters.split(' · ')[0];header.insertChild(0,caption);}
    const full=row.children.find(n=>n.type==='INSTANCE');if(full){header.insertChild(Math.max(0,header.children.indexOf(toggle)),full);full.name=wide?'주변 그래프 보기':'전체 그래프 보기';await janovelCompactIcon(full,icons[wide?'minimize-2':'maximize-2']);}row.remove();}
  }
  if(toggle){await janovelCompactIcon(toggle,icons[(left?'panel-left-':'panel-right-')+(folded?'open':'close')]);}
  header.primaryAxisSizingMode='FIXED';header.counterAxisSizingMode='FIXED';header.paddingTop=header.paddingBottom=0;header.counterAxisAlignItems='CENTER';header.itemSpacing=left?4:8;header.resize(header.width,48);header.layoutSizingHorizontal='FILL';header.layoutSizingVertical='FIXED';
  if(left&&!folded){header.paddingLeft=16;header.paddingRight=8;}
  done.push({id:panel.id,header:header.id,height:header.height});
 }return {panels:done};
}
function janovelCompactFrame(name){const n=figma.createFrame();n.name=name;n.layoutMode='HORIZONTAL';n.fills=[];n.primaryAxisSizingMode='FIXED';n.counterAxisSizingMode='AUTO';n.counterAxisAlignItems='CENTER';n.itemSpacing=8;return n;}
function janovelCompactText(source,name,text){const n=source.clone();n.name=name;n.characters=text;n.fontSize=12;n.lineHeight={unit:'PIXELS',value:20};n.textAutoResize='WIDTH_AND_HEIGHT';n.fills=janovelInk('#727272');return n;}
async function janovelCompactScenes(params){
 const nodes=await janovelProductNodes(params.ids),icons={};for(const [k,id]of Object.entries(params.icons))icons[k]=(await janovelProductNodes([id]))[0];const out=[];
 for(const root of nodes){await janovelProductFonts(root);const center=root.findOne(n=>n.type==='FRAME'&&n.name==='작성·비교');if(!center)continue;
  const toolbar=center.children.find(n=>n.name==='문항·작성 도구');if(toolbar){toolbar.paddingTop=toolbar.paddingBottom=0;toolbar.counterAxisSizingMode='FIXED';toolbar.counterAxisAlignItems='CENTER';toolbar.resize(toolbar.width,48);toolbar.layoutSizingVertical='FIXED';
   for(const button of toolbar.children.filter(n=>n.type==='INSTANCE')){const label=button.findOne(n=>n.type==='TEXT');const action={'← 작성':'pencil-line','병합':'git-merge','분기':'git-branch','스냅샷':'camera'}[label?.characters];if(action){await janovelCompactIcon(button,icons[action]);button.name='작업 / '+({'pencil-line':'작성','git-merge':'병합','git-branch':'분기',camera:'스냅샷'}[action]);}else if(button.name.includes('Question tab')){button.layoutSizingVertical='FIXED';button.resize(button.width,48);}}
  }
  for(const title of center.findAll(n=>n.type==='TEXT'&&n.parent.name==='문항과 글자 수'))if(!/[→/]/.test(title.characters)){title.fontSize=18;title.lineHeight={unit:'PIXELS',value:28};}
  const article=center.findOne(n=>n.name==='자소서');if(article)for(const text of article.findAll(n=>n.type==='TEXT'))if(text.characters.length>55&&text.parent.name!=='문항과 글자 수'){text.fontSize=14;text.lineHeight={unit:'PIXELS',value:24};}
  const columns=center.findOne(n=>n.name==='비교 본문');const heads=center.findOne(n=>n.name==='기록과 비교 대상');
  if(columns&&heads){const panes=columns.children.filter(n=>n.type==='FRAME'&&n.name.startsWith('본문 /'));const texts=panes.map(n=>n.findAll(x=>x.type==='TEXT'));for(const list of texts)for(const text of list){text.fontSize=14;text.lineHeight={unit:'PIXELS',value:24};}
   const heading=center.findOne(n=>n.name==='문항과 글자 수');if(heading)for(const t of heading.children)if(t.type==='TEXT'&&/→/.test(t.characters))t.visible=false;
   if(!heads.children.some(n=>n.name==='비교 헤더 / left')){
    const original=[...heads.children],leftLabel=original[0],rightLabel=original[1];if(leftLabel&&rightLabel&&texts.length===2){
     const source=texts[0][0]||leftLabel;heads.itemSpacing=12;heads.resize(heads.width,32);heads.counterAxisSizingMode='FIXED';heads.layoutSizingVertical='FIXED';
     for(const [i,label]of [leftLabel,rightLabel].entries()){
      const group=janovelCompactFrame('비교 헤더 / '+(i?'right':'left'));heads.appendChild(group);group.resize(300,32);group.layoutSizingHorizontal='FILL';group.layoutSizingVertical='FIXED';group.appendChild(label);
      label.layoutSizingHorizontal='FIXED';if(label.type==='TEXT'){label.characters=label.characters.split('\n')[0];label.fontSize=13;label.lineHeight={unit:'PIXELS',value:20};label.textAutoResize='WIDTH_AND_HEIGHT';}else if(label.type==='INSTANCE')await janovelCompactIcon(label,icons['chevron-down'],'select');
      const space=figma.createFrame();group.appendChild(space);space.name='Space';space.fills=[];space.resize(1,1);space.layoutSizingHorizontal='FILL';
      const count=janovelCompactText(source,'글자 수 / '+(i?'right':'left'),texts[i].map(t=>t.characters).join('\n\n').length+'자');group.appendChild(count);count.layoutSizingHorizontal='HUG';
     }
     const divider=figma.createFrame();heads.insertChild(1,divider);divider.name='헤더 열 간격';divider.resize(1,1);divider.fills=[];
    }
   }
  }
  root.setPluginData('janovelCompactRevision','2026-11-09');out.push({id:root.id,comparison:!!columns});
 }return {scenes:out};
}
async function janovelCompactList(){await janovelCheckFile();return {ids:figma.currentPage.children.filter(n=>n.type==='FRAME'&&n.children.some(x=>x.name==='작업 공간')).map(n=>n.id)};}
async function janovelCompactConcepts(params){
 const [source]=await janovelProductNodes(['67:2743']);await janovelProductFonts(source);let section=figma.currentPage.children.find(n=>n.type==='SECTION'&&n.name==='19 · 비교 화면 디자인 선택');if(!section){section=figma.createSection();section.name='19 · 비교 화면 디자인 선택';section.x=33000;section.y=1400;section.resizeWithoutConstraints(4520,1010);section.fills=janovelInk('#E5E6E9');}
 const results=[];
 for(const [i,title]of ['A · 차분한 문서형','B · 구획이 선명한 작업형','C · 밀도 높은 에디터형'].entries()){
  let root=section.children.find(n=>n.name===title);if(root){results.push({id:root.id,name:title});continue;}
  root=source.clone();section.appendChild(root);root.name=title;root.x=40+i*1490;root.y=64;
  // Figma shows the frame name above the frame; a second caption would overlap it.
  const center=root.findOne(n=>n.name==='작성·비교'),body=center.findOne(n=>n.name==='두 스냅샷 비교'),columns=center.findOne(n=>n.name==='비교 본문'),heads=center.findOne(n=>n.name==='기록과 비교 대상');
  if(i===1){body.fills=janovelInk('#F2F3F5');heads.fills=janovelInk('#F2F3F5');body.paddingTop=24;body.paddingBottom=24;columns.itemSpacing=16;heads.itemSpacing=16;
   const divider=columns.children.find(n=>n.name==='열 구분선');if(divider)divider.visible=false;const hdivider=heads.children.find(n=>n.name==='헤더 열 간격');if(hdivider)hdivider.visible=false;
   for(const pane of columns.children.filter(n=>n.name.startsWith('본문 /'))){pane.fills=janovelInk('#FFFFFF');pane.strokes=janovelInk('#E1E3E8');pane.strokeWeight=1;pane.cornerRadius=8;pane.paddingLeft=pane.paddingRight=20;pane.paddingTop=pane.paddingBottom=20;pane.layoutSizingVertical='FILL';}
  }
  if(i===2){const header=root.children.find(n=>n.name==='회사 헤더');header.fills=janovelInk('#302B27');for(const t of header.findAll(n=>n.type==='TEXT'))t.fills=janovelInk(t.fontName.style==='Regular'?'#C7C6C5':'#F5F3F5');
   const apply=header.children.find(n=>n.type==='INSTANCE'&&n.findOne(x=>x.type==='TEXT'&&x.characters.includes('지원하러')));if(apply){apply.fills=janovelInk('#274690');apply.strokes=[];}
   body.paddingLeft=body.paddingRight=24;body.paddingTop=20;body.itemSpacing=12;heads.fills=janovelInk('#F3F4F6');heads.cornerRadius=4;
   for(const group of heads.children.filter(n=>n.name.startsWith('비교 헤더 /'))){group.paddingLeft=8;group.paddingRight=8;}
   columns.itemSpacing=16;columns.children.filter(n=>n.name.startsWith('본문 /')).forEach(n=>{n.paddingLeft=n.paddingRight=8;});
  }
  root.setPluginData('janovelConcept',String.fromCharCode(65+i));results.push({id:root.id,name:title});
 }figma.viewport.scrollAndZoomIntoView([section]);return {sectionId:section.id,concepts:results};
}
async function janovelCompactVerify(params){const roots=await janovelProductNodes(params.ids),checks=[];
 for(const root of roots){const center=root.findOne(n=>n.name==='작성·비교');if(!center)continue;const work=center.parent,right=work.children.find(n=>n.name==='AI 대화'),left=work.children.find(n=>n.name==='문항별 버전 기록'),divider=center.children.find(n=>n.name==='Divider'),rdiv=right?.children.find(n=>n.name==='Divider');
  const cy=divider?.absoluteBoundingBox?.y,ry=rdiv?.absoluteBoundingBox?.y;
  checks.push({id:root.id,name:root.name,dividerDelta:cy!==undefined&&ry!==undefined?cy-ry:null,leftTitle:left?.findAll(n=>n.type==='TEXT'&&n.visible&&(n.characters==='버전 기록'||n.characters.includes(' · 기본'))).map(n=>n.characters),counts:center.findAll(n=>n.type==='TEXT'&&n.name.startsWith('글자 수 /')).map(n=>({id:n.id,text:n.characters})),bodyFonts:center.findAll(n=>n.type==='TEXT'&&n.parent.name.startsWith('본문 /')).map(n=>({size:n.fontSize,line:n.lineHeight.value,len:n.characters.length})),toolbar:center.children.find(n=>n.name==='문항·작성 도구')?.children.filter(n=>n.name.startsWith('작업 /')).map(n=>({id:n.id,name:n.name,reactions:n.reactions.length,visibleText:n.findAll(t=>t.type==='TEXT'&&t.visible).map(t=>t.characters)}))});
 }return {checks};}
