// Existing JaNovel panel masters only. Graph node/button IDs and their navigation stay intact.
async function janovelGraphMap(params){
 await janovelCheckFile();const out=[];
 for(const item of params.panels){
  const [panel]=await janovelProductNodes([item.id]);await janovelProductFonts(panel);const graph=panel.findOne(n=>n.name==='버전 그래프');if(!graph)continue;
  const priorFocus=panel.getPluginData('janovelGraphFocus');
  if(params.refresh){const old=graph.findOne(n=>n.name==='버전 지도 · 고정 좌표');if(old){for(const n of [...old.children])if((n.type==='INSTANCE'||n.type==='ELLIPSE')&&n.name!=='선택 위치 링')graph.appendChild(n);old.remove();}}
  if(!params.refresh&&panel.getPluginData('janovelGraphMap')==='2026-11-10'){out.push({id:panel.id,already:true});continue;}
  const hidden=panel.findAll(n=>n.type==='TEXT'&&n.characters.startsWith('숨긴 기록'));for(const n of hidden)n.remove();
  const labels=graph.children.filter(n=>n.type==='INSTANCE'&&n.findAll(x=>x.type==='TEXT').length>=2);
  if(!labels.length){out.push({id:panel.id,empty:true});continue;}
  const q=item.q||(panel.findOne(n=>n.type==='TEXT'&&n.characters==='Q2')?'Q2':'Q1');
  const normalize=k=>(k==='draft'?'작성 중':k).replace(/^Q[123]\s+/,'').split(' · ')[0];
  const keyOf=n=>normalize(n.getPluginData('recordKey')||n.findAll(x=>x.type==='TEXT')[0]?.characters.split(' · ')[0]||n.name);
  if(q==='Q2'){const allowed=new Set(['v1','v1-A','v2','작성 중','작성 중-A',normalize(item.selected||'작성 중'),...Object.keys(item.parents||{})]);for(const n of [...labels])if(!allowed.has(keyOf(n))&&!/^v[12]-/.test(keyOf(n))){labels.splice(labels.indexOf(n),1);n.remove();}for(const n of [...graph.children])if(n.type==='ELLIPSE'&&n.name.endsWith(' node')&&!allowed.has(normalize(n.name.replace(/ node$/,'')))&&!/^v[12]-/.test(normalize(n.name.replace(/ node$/,''))))n.remove();}
  const seen=new Set();for(const n of [...labels]){const key=keyOf(n);if(seen.has(key)){labels.splice(labels.indexOf(n),1);n.remove();}else seen.add(key);}
  const seenDots=new Set();for(const dot of graph.children.filter(n=>n.type==='ELLIPSE')){const key=normalize(dot.name.replace(/ node$/,''));if(seenDots.has(key)||dot.name==='선택 위치 링')dot.remove();else seenDots.add(key);}
  let selected=labels.find(n=>n.fills.some(p=>p.type==='SOLID'&&Math.abs(p.color.r-237/255)<.01&&Math.abs(p.color.b-250/255)<.01));
  selected=normalize(item.selected||priorFocus||(selected?keyOf(selected):'작성 중')).split(' · ')[0];
  const sourceId=item.wideId||params.defaults?.[q];
  const source=sourceId?(await janovelProductNodes([sourceId]))[0].findOne(n=>n.name==='버전 그래프'):null;
  const sourceContent=source?.findOne(n=>n.name==='버전 지도 · 고정 좌표')||source;
  if(source&&source.id!==graph.id){for(const label of sourceContent.children.filter(n=>n.type==='INSTANCE'&&n.findAll(x=>x.type==='TEXT').length>=2)){const key=keyOf(label);if(q==='Q2'&&!['v1','v1-A','v2','작성 중','작성 중-A',normalize(item.selected||'작성 중'),...Object.keys(item.parents||{})].includes(key)&&!/^v[12]-/.test(key))continue;if(!labels.some(n=>keyOf(n)===key)){const copy=label.clone();graph.appendChild(copy);labels.push(copy);const dot=sourceContent.children.find(n=>n.type==='ELLIPSE'&&normalize(n.name.replace(/ node$/,''))===key);if(dot&&!graph.children.some(n=>n.type==='ELLIPSE'&&normalize(n.name.replace(/ node$/,''))===key)){const d=dot.clone();graph.appendChild(d);}}}}
  const history=[...params.histories[q],{key:'작성 중-A',title:'다른 도입'},...(q==='Q1'?[{key:'작성 중-B',title:'사례 중심'}]:[])];
  for(const model of history){
   if(!labels.some(n=>keyOf(n)===model.key)){
    const label=labels[0].clone();graph.appendChild(label);label.name=model.key;label.setPluginData('recordKey',model.key);const texts=label.findAll(n=>n.type==='TEXT');texts[0].characters=model.key;texts[1].characters=model.title;label.fills=[];await label.setReactionsAsync(model.to?[{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',navigation:'NAVIGATE',destinationId:model.to,transition:null}]}]:[]);labels.push(label);
   }
   if(!graph.children.some(n=>n.type==='ELLIPSE'&&normalize(n.name.replace(/ node$/,''))===model.key)){const dot=figma.createEllipse();graph.appendChild(dot);dot.name=model.key+' node';await dot.setReactionsAsync(model.to?[{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',navigation:'NAVIGATE',destinationId:model.to,transition:null}]}]:[]);}
  }
  for(const dot of graph.children.filter(n=>n.type==='ELLIPSE'&&n.name.endsWith(' node'))){const key=normalize(dot.name.replace(/ node$/,''));if(labels.some(n=>keyOf(n)===key))continue;const label=labels[0].clone();graph.appendChild(label);label.name=key;const texts=label.findAll(n=>n.type==='TEXT');texts[0].characters=key;texts[1].characters=item.titles?.[key]||key;label.fills=[];await label.setReactionsAsync(JSON.parse(JSON.stringify(dot.reactions)));labels.push(label);}
  const keys=labels.map(keyOf),base=q==='Q2'?[['v1',0,[]],['v1-A',1,['v1']],['v2',0,['v1','v1-A']]]:[['v1',0,[]],['v2',0,['v1']],['v2-A',1,['v1']],['v2-B',2,['v1']],['v3',0,['v2']],['v3-A',1,['v2-A']],['v3-B',2,['v2-B']],['v4',0,['v3','v3-A']]];
  const models=base.filter(([key])=>keys.includes(key)).map(([key,lane,parents])=>({key,lane,parents:parents.filter(p=>keys.includes(p))}));
  for(const key of keys.filter(k=>!k.startsWith('작성 중')&&!models.some(n=>n.key===k))){const explicit=item.parents?.[key];models.push({key,lane:0,parents:explicit||models.slice(-1).map(n=>n.key)});}
  for(const [key,lane]of [['작성 중-A',1],['작성 중-B',2]])if(keys.includes(key)&&models.some(n=>n.lane===lane))models.push({key,lane,parents:models.filter(n=>n.lane===lane).slice(-1).map(n=>n.key)});
  if(keys.includes('작성 중'))models.push({key:'작성 중',lane:0,parents:models.filter(n=>n.lane===0).slice(-1).map(n=>n.key)});
  const points=new Map();for(const n of models){const depth=n.parents.length?Math.max(...n.parents.map(p=>points.get(p)?.depth??0))+1:0;points.set(n.key,{...n,depth,x:80+n.lane*60,y:100+depth*76});}
  const isWide=panel.name==='State=Wide',width=panel.width,height=panel.height-48;const body=graph.parent;body.paddingLeft=body.paddingRight=body.paddingTop=body.paddingBottom=0;body.layoutSizingHorizontal='FILL';body.layoutSizingVertical='FILL';body.primaryAxisSizingMode='FIXED';
  graph.resize(width,height);graph.layoutSizingHorizontal='FILL';graph.layoutSizingVertical='FILL';graph.layoutMode='NONE';graph.clipsContent=true;graph.overflowDirection='BOTH';
  const all=[...graph.children],world=figma.createFrame();graph.appendChild(world);world.name='버전 지도 · 고정 좌표';world.resize(640,1200);world.fills=[];world.clipsContent=false;
  for(const n of all)world.appendChild(n);
  for(const n of [...world.children])if(!['INSTANCE','ELLIPSE'].includes(n.type))n.remove();
  const target=points.get(selected)||points.get('작성 중')||[...points.values()][0];const scale=1.25;
  world.x=isWide?10:width/2-target.x*scale;world.y=isWide?Math.max(24,(height-((Math.max(...[...points.values()].map(p=>p.y))-100)*scale+64))/2)-100*scale:height*.47-target.y*scale;
  const paths=[];for(const n of points.values())for(const key of n.parents){const p=points.get(key);if(!p)continue;paths.push(`<path d="M ${p.x*scale} ${p.y*scale} C ${p.x*scale} ${(p.y+38)*scale}, ${n.x*scale} ${(n.y-38)*scale}, ${n.x*scale} ${n.y*scale}" stroke="#CDD2DC" ${n.key.startsWith('작성 중')?'stroke-dasharray="4 4"':''}/>`);}
  const edge=figma.createNodeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="1200" viewBox="0 0 640 1200"><g fill="none" stroke-width="1.5">${paths.join('')}</g></svg>`);world.insertChild(0,edge);edge.name='이력 경로';edge.x=edge.y=0;
  const controls=[];
  for(const label of labels){const key=keyOf(label),p=points.get(key);if(!p)continue;const active=key===selected,tx=p.x*scale,ty=p.y*scale;
   let dot=world.children.find(n=>n.type==='ELLIPSE'&&normalize(n.name.replace(/ node$/,''))===key);if(!dot){dot=figma.createEllipse();world.appendChild(dot);dot.name=key+' node';if(label.reactions.length)await dot.setReactionsAsync(JSON.parse(JSON.stringify(label.reactions)));}
   dot.resize((active?12:10)*scale,(active?12:10)*scale);dot.x=tx-dot.width/2;dot.y=ty-dot.height/2;dot.fills=janovelInk(active?'#274690':'#FFFFFF');dot.strokes=janovelInk(active?'#274690':'#9BA4B7');dot.strokeWeight=(active?1.6:1.25)*scale;if(key.startsWith('작성 중'))dot.dashPattern=[3,3];
   if(active){const halo=figma.createEllipse();world.insertChild(world.children.indexOf(dot),halo);halo.name='선택 위치 링';halo.resize(26*scale,26*scale);halo.x=tx-13*scale;halo.y=ty-13*scale;halo.fills=janovelInk('#EDF1FA');halo.strokes=janovelInk('#D7E0F3');halo.strokeWeight=1;}
   label.resize(56*scale,40*scale);label.x=tx-label.width/2;label.y=ty+16*scale;label.fills=[];label.paddingLeft=label.paddingRight=2*scale;label.counterAxisAlignItems='CENTER';
   label.setPluginData('recordKey',key);const texts=label.findAll(n=>n.type==='TEXT');if(key.startsWith('작성 중'))texts[0].characters='작성 중';texts.forEach((t,i)=>{t.fontSize=(i?11:12)*scale;t.lineHeight={unit:'PIXELS',value:(i?16:20)*scale};t.textAlignHorizontal='CENTER';t.textAutoResize='NONE';t.resize(52*scale,(i?16:20)*scale);t.layoutSizingHorizontal='FILL';t.layoutSizingVertical='FIXED';t.textTruncation='ENDING';t.maxLines=1;t.fills=janovelInk(active?'#274690':i?'#727272':'#4E535C');});
   controls.push({key,dot:dot.id,label:label.id,selected:active,x:tx+world.x,y:ty+world.y,reactions:label.reactions.length});
  }
  if(isWide){const minX=Math.min(...labels.map(n=>n.x)),maxX=Math.max(...labels.map(n=>n.x+n.width));world.x=(width-(maxX-minX))/2-minX;}
  panel.setPluginData('janovelGraphMap','2026-11-10');panel.setPluginData('janovelGraphFocus',selected);out.push({id:panel.id,graphId:graph.id,worldId:world.id,selected,wide:isWide,width,height,controls});
 }
 return {panels:out};
}
async function janovelGraphMapInspect(params){const roots=await janovelProductNodes(params.ids);return roots.map(root=>({id:root.id,hidden:root.findAll(n=>n.type==='TEXT'&&n.visible&&n.characters.startsWith('숨긴 기록')).map(n=>n.id),graph:root.findAll(n=>n.name==='버전 지도 · 고정 좌표').map(n=>({id:n.id,x:n.x,y:n.y,width:n.width,height:n.height,parentClip:n.parent.clipsContent})),focus:root.getPluginData('janovelGraphFocus'),labels:root.findAll(n=>n.type==='INSTANCE'&&n.parent.name==='버전 지도 · 고정 좌표').map(n=>({id:n.id,key:n.getPluginData('recordKey')||n.findAll(t=>t.type==='TEXT')[0]?.characters,labelWidth:n.width,title:n.findAll(t=>t.type==='TEXT').slice(1).map(t=>({text:t.characters,width:t.width,truncation:t.textTruncation,maxLines:t.maxLines})),reactions:n.reactions.length})),dots:root.findAll(n=>n.type==='ELLIPSE'&&n.name.endsWith(' node')).map(n=>({id:n.id,name:n.name,x:n.x,y:n.y}))}));}

async function janovelRecordHeaderLabels(params){const roots=await janovelProductNodes(params.ids),result=[];for(const root of roots){await janovelProductFonts(root);const heads=root.findOne(n=>n.name==='기록과 비교 대상');if(!heads)continue;const left=heads.children.find(n=>n.name==='비교 헤더 / left');if(left){const title=left.children.find(n=>n.type==='TEXT'&&!n.name.startsWith('글자 수'));if(title){for(const n of left.children)if(n.name==='Space')n.visible=false;title.textAutoResize='NONE';title.resize(Math.max(48,left.width-92),20);title.layoutSizingHorizontal='FILL';title.textTruncation='ENDING';title.maxLines=1;}}const right=heads.children.find(n=>n.name==='비교 헤더 / right');if(right){const selector=right.children.find(n=>n.type==='INSTANCE');if(selector)for(const text of selector.findAll(n=>n.type==='TEXT')){text.textAutoResize='NONE';text.resize(Math.max(40,selector.width-44),20);text.textTruncation='ENDING';text.maxLines=1;}}result.push(root.id);}return {roots:result};}
