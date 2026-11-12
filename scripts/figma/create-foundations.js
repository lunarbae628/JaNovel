const page=await figma.getNodeByIdAsync('0:1');
await figma.setCurrentPageAsync(page);
page.name='01 · 작성과 비교';
if(page.children.some(n=>n.name==='JaNovel / Controls'))throw new Error('이미 생성된 디자인입니다. 기존 상태를 확인하세요.');
const available=await figma.listAvailableFontsAsync();
const fontNames=['Regular','Medium','Bold'].map(style=>available.find(f=>f.fontName.family==='Noto Sans KR'&&f.fontName.style===style).fontName);
const buttonSet=await figma.importComponentSetByKeyAsync('cc8b558dc7d9684011b6b99ce8e6509399bc836b');
const source=buttonSet.defaultVariant;
const sourceFonts=new Map();
for(const t of source.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))sourceFonts.set(JSON.stringify(s.fontName),s.fontName);
await Promise.all([...fontNames,...sourceFonts.values()].map(f=>figma.loadFontAsync(f)));
const created=[],mutated=[page.id],collections={},vars={},styles={};
const primitives=figma.variables.createVariableCollection('JaNovel / Primitives');
const semantic=figma.variables.createVariableCollection('JaNovel / Theme');
collections.primitives=primitives.id;collections.theme=semantic.id;
const colors={white:'#FFFFFF',graph:'#F7F7F8',chat:'#FAFAFA',ink:'#302B27',muted:'#727272',line:'#E6E6E6',blue:'#274690',selected:'#EDF1FA',highlight:'#DCE4F6',node:'#A5A8B0'};
const {variables:raw}=await createSemanticTokens(primitives,{Value:primitives.defaultModeId},Object.entries(colors).map(([name,value])=>({name:'color/'+name,type:'COLOR',values:{Value:value},scopes:[],codeSyntax:{WEB:'var(--primitive-'+name+')'}})));
const roles={paper:['white',['FRAME_FILL','SHAPE_FILL'],'--p-bg'],graph:['graph',['FRAME_FILL','SHAPE_FILL'],'--surface-graph'],chat:['chat',['FRAME_FILL','SHAPE_FILL'],'--surface-chat'],ink:['ink',['TEXT_FILL'],'--p-ink'],muted:['muted',['TEXT_FILL'],'--p-dim'],line:['line',['STROKE_COLOR'],'--p-line'],blue:['blue',['FRAME_FILL','SHAPE_FILL','TEXT_FILL','STROKE_COLOR'],'--p-blue'],selected:['selected',['FRAME_FILL','SHAPE_FILL'],'--surface-selected'],highlight:['highlight',['FRAME_FILL','SHAPE_FILL'],'--p-highlight'],onDark:['white',['TEXT_FILL'],'--text-on-dark'],charcoal:['ink',['FRAME_FILL','SHAPE_FILL'],'--button-external'],node:['node',['STROKE_COLOR'],'--graph-node']};
const defs=Object.entries(roles).map(([name,[p,scopes,css]])=>({name:'color/'+name,type:'COLOR',values:{Light:{type:'VARIABLE_ALIAS',id:raw['color/'+p].id}},scopes,codeSyntax:{WEB:'var('+css+')'}}));
for(const n of [4,8,12,16,20,24,32,40,48])defs.push({name:'space/'+n,type:'FLOAT',values:{Light:n},scopes:['GAP'],codeSyntax:{WEB:'var(--space-'+n+')'}});
for(const n of [4,6,8])defs.push({name:'radius/'+n,type:'FLOAT',values:{Light:n},scopes:['CORNER_RADIUS'],codeSyntax:{WEB:'var(--radius-'+n+')'}});
const {variables:tokens}=await createSemanticTokens(semantic,{Light:semantic.defaultModeId},defs);
for(const [k,v] of Object.entries(tokens))vars[k]=v.id;
const paint=name=>figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0}},'color',tokens['color/'+name]);
for(const [name,size,line,weight] of [['Caption',12,20,'Regular'],['Label',14,22,'Medium'],['Body',16,30,'Regular'],['Body compact',14,26,'Regular'],['Question',20,32,'Bold'],['Dialog title',20,30,'Medium']]){
 const s=figma.createTextStyle();s.name='JaNovel/'+name;s.fontName=fontNames.find(f=>f.style===weight);s.fontSize=size;s.lineHeight={unit:'PIXELS',value:line};styles[name]=s.id;
}
function label(parent,text,style='Label',color='ink'){
 const t=figma.createText();created.push(t.id);t.name='Label';t.fontName=fontNames[0];t.characters=text;t.textStyleId=styles[style];t.fills=[paint(color)];parent.appendChild(t);return t;
}
function component(name,w,h){const c=figma.createComponent();created.push(c.id);c.name=name;c.resize(w,h);c.layoutMode='HORIZONTAL';c.primaryAxisAlignItems='CENTER';c.counterAxisAlignItems='CENTER';c.fills=[];page.appendChild(c);return c;}
function groupVariants(name,variants,x,y){const set=figma.combineAsVariants(variants,page);created.push(set.id);set.name=name;set.x=x;set.y=y;set.resize(680,100);variants.forEach((n,i)=>{n.x=16+i*140;n.y=16;});return set;}
const showcase=figma.createAutoLayout('VERTICAL');created.push(showcase.id);showcase.name='JaNovel / Controls';showcase.resize(1440,500);showcase.x=100;showcase.y=2340;showcase.paddingTop=24;showcase.paddingLeft=24;showcase.paddingBottom=24;showcase.paddingRight=24;showcase.itemSpacing=24;showcase.fills=[paint('paper')];label(showcase,'JaNovel / 기본 컨트롤','Question');
const buttons=[];
for(const [kind,bg,ink] of [['Primary','blue','onDark'],['Graphite','charcoal','onDark'],['Ghost',null,'muted']]){
 const b=source.createInstance();created.push(b.id);b.name='JaNovel/Button/'+kind;b.setProperties({'Label#2:0':kind==='Primary'?'스냅샷':kind==='Graphite'?'지원하러 가기 ↗':'비교','Has Icon Start#4:128':false,'Has Icon End#4:64':false});b.fills=bg?[paint(bg)]:[];b.strokes=[];b.cornerRadius=4;b.setBoundVariable('cornerRadius',tokens['radius/4']);
 for(const t of b.findAllWithCriteria({types:['TEXT']})){t.fontName=fontNames[1];t.textStyleId=styles.Label;t.fills=[paint(ink)];}
 showcase.appendChild(b);buttons.push({id:b.id,kind});
}
const tabs=[];
for(const active of [false,true]){const c=component('State='+(active?'Active':'Default'),48,48);const t=label(c,'Q1','Label',active?'blue':'muted');const prop=c.addComponentProperty('Label','TEXT','Q1');t.componentPropertyReferences={characters:prop};if(active){c.strokes=[paint('blue')];c.strokeTopWeight=0;c.strokeLeftWeight=0;c.strokeRightWeight=0;c.strokeBottomWeight=2;}tabs.push(c);}
const tabSet=groupVariants('JaNovel/Question tab',tabs,100,3000);
const fields=[];
for(const multi of [false,true]){const c=component('Lines='+(multi?'Multiple':'Single'),360,multi?112:44);c.primaryAxisAlignItems='MIN';c.counterAxisAlignItems='MIN';c.paddingTop=12;c.paddingBottom=12;c.paddingLeft=12;c.paddingRight=12;c.fills=[paint('paper')];c.strokes=[paint('line')];c.cornerRadius=6;c.setBoundVariable('cornerRadius',tokens['radius/6']);const t=label(c,multi?'변경한 내용이나 이유':'예: 경험 구체화','Body compact','muted');const prop=c.addComponentProperty('Placeholder','TEXT',t.characters);t.componentPropertyReferences={characters:prop};fields.push(c);}
const fieldSet=groupVariants('JaNovel/Field',fields,100,3180);fields[1].x=416;fieldSet.resize(820,150);
const icons=await Promise.all([figma.importComponentByKeyAsync('24b1aa94d3d0ca7e75dea4ad6ddfa57bd037d537'),figma.importComponentByKeyAsync('7e8f1562019459ee0f259b325d0ee8341e6478e3')]);
const folds=[];
for(let i=0;i<2;i++){const c=component('Direction='+(i?'Right':'Left'),32,32);c.name='Direction='+(i?'Right':'Left');const icon=icons[i].createInstance();created.push(icon.id);icon.resize(16,16);c.appendChild(icon);folds.push(c);}
const foldSet=groupVariants('JaNovel/Panel toggle',folds,100,3400);
return {createdNodeIds:created,mutatedNodeIds:mutated,pageId:page.id,collections,variables:vars,textStyles:styles,buttons,tabVariants:tabs.map(n=>n.id),fieldVariants:fields.map(n=>n.id),foldVariants:folds.map(n=>n.id),componentSets:[tabSet.id,fieldSet.id,foldSet.id],font:'Noto Sans KR',source:'Simple Design System',counts:{colorPrimitives:Object.keys(colors).length,semanticTokens:defs.length,textStyles:Object.keys(styles).length},reviewAssets:showcase.id};
