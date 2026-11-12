function janovelLogRecords(variant='current'){
 const all=[['v1','첫 초안',0,[]],['v2','경험 구체화',0,['v1']],['v2-A','다른 도입',1,['v1']],['v2-B','사례 중심',2,['v1']],['v3','직무 연결',0,['v2']],['v3-A','문장 정리',1,['v2-A']],['v3-B','성과 보강',2,['v2-B']]];
 if(variant==='current')return [...all,['v4','두 초안 병합',0,['v3','v3-A']],['작성 중-A','다른 도입',1,['v3-A']],['작성 중-B','사례 중심',2,['v3-B']],['작성 중','기본 흐름',0,['v4']]];
 return [...all,...(variant==='docsa-snapshot'?[['v4','병합안 첫 스냅샷',3,['v3','v3-A']]]:[]),['작성 중','기본 흐름',0,['v3']],['작성 중-A','다른 도입',1,['v3-A']],['작성 중-B','사례 중심',2,['v3-B']],['작성 중-병합','병합안',3,variant==='docsa-snapshot'?['v4']:['v3','v3-A']]];
}
// A separate editable review concept. Existing map masters and scenes are untouched.
async function janovelCompactLogConcept(params){
 await janovelCheckFile();
 const [source]=await janovelProductNodes(['94:113338']);await janovelProductFonts(source);
 const copy=params.rootId?(await janovelProductNodes([params.rootId]))[0]:source.clone();if(!params.rootId)figma.currentPage.appendChild(copy);copy.name=params.variant?(params.variant==='docsa-draft'?'Docsa안 · 병합 직후 새 브랜치 작업장':'Docsa안 · 새 브랜치 첫 스냅샷 이후'):(params.wide?'기록형 · 넓혀 보기':'기록형 · 촘촘한 Git 로그');if(!params.rootId){copy.x=source.absoluteBoundingBox.x+(params.wide?1540:0);copy.y=source.absoluteBoundingBox.y+1180;}
 const work=copy.findOne(n=>n.name==='작업 공간');let panel=work.children.find(n=>n.name==='문항별 버전 기록'||n.name==='문항별 기록 · 로그형');if(panel.type==='INSTANCE')panel=panel.detachInstance();panel.name='문항별 기록 · 로그형';panel.resize(params.wide?400:208,panel.height);panel.layoutSizingHorizontal='FIXED';panel.layoutSizingVertical='FILL';
 const head=panel.children[0];const full=head.findOne(n=>n.name.includes('전체')||n.name.includes('maximize'))||head.findOne(n=>n.type==='INSTANCE');
 for(const child of [...panel.children].slice(1))child.remove();
 const viewport=figma.createFrame();panel.appendChild(viewport);viewport.name='기록 목록 · 세로 스크롤';viewport.resize(panel.width,panel.height-48);viewport.layoutSizingHorizontal='FILL';viewport.layoutSizingVertical='FILL';viewport.layoutMode='NONE';viewport.fills=[];viewport.clipsContent=true;viewport.overflowDirection='VERTICAL';
 const content=figma.createFrame();viewport.appendChild(content);content.name='기록 행 · 32px';content.resize(panel.width,352);content.x=0;content.y=16;content.fills=[];content.clipsContent=false;
 const variant=params.variant||'current',models=janovelLogRecords(variant),graphWidth=28+Math.max(...models.map(n=>n[2]))*14;
 content.resize(panel.width,models.length*32);const points=new Map(models.map(([key,title,lane,parents],i)=>[key,{x:16+lane*14,y:16+i*32}]));
 const paths=[];for(const [key,title,lane,parents]of models)for(const parent of parents){const p=points.get(parent),t=points.get(key);const d=p.x===t.x?`M ${p.x} ${p.y} V ${t.y}`:p.x<t.x?`M ${p.x} ${p.y} L ${t.x} ${p.y+16} V ${t.y}`:`M ${p.x} ${p.y} V ${t.y-16} L ${t.x} ${t.y}`;paths.push(`<path d="${d}" ${key.startsWith('작성 중')?'stroke-dasharray="3 3"':''}/>`);}
 const edges=figma.createNodeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${graphWidth}" height="${models.length*32}"><g fill="none" stroke="#CDD2DC" stroke-width="1.3" stroke-linejoin="round">${paths.join('')}</g></svg>`);content.appendChild(edges);edges.name='분기·병합 경로 · 중립선';edges.x=edges.y=0;
 const [template]=await janovelProductNodes(['5:540']);const controls=[];
 const rgb=h=>({r:parseInt(h.slice(0,2),16)/255,g:parseInt(h.slice(2,4),16)/255,b:parseInt(h.slice(4,6),16)/255});
 for(const [i,[key,title,lane]]of models.entries()){
  const active=key==='v3',p=points.get(key),row=figma.createFrame();content.appendChild(row);row.name=key+' · '+title;row.resize(panel.width,32);row.x=0;row.y=i*32;row.fills=[];row.clipsContent=true;
  // Paths remain above the selected row background, below its node and text.
  if(active){const bg=figma.createRectangle();content.insertChild(0,bg);bg.name='선택 행 배경';bg.resize(panel.width,32);bg.x=0;bg.y=i*32;bg.fills=[{type:'SOLID',color:rgb('E8EDF7')}];}
  if(active){const halo=figma.createEllipse();row.appendChild(halo);halo.name='선택 노드 링';halo.resize(13,13);halo.x=p.x-6.5;halo.y=9.5;halo.fills=[{type:'SOLID',color:rgb('D9E2F5')}];}
  const dot=figma.createEllipse();row.appendChild(dot);dot.name=key+' node';dot.resize(7,7);dot.x=p.x-3.5;dot.y=12.5;dot.fills=[{type:'SOLID',color:rgb(active?'274690':'F7F7F8')}];dot.strokes=[{type:'SOLID',color:rgb(active?'274690':'9BA4B7')}];dot.strokeWeight=1.3;if(key.startsWith('작성 중'))dot.dashPattern=[2,2];
  const version=template.clone();row.appendChild(version);version.characters=key.startsWith('작성 중')?'작성 중':key;version.fontSize=11;version.lineHeight={unit:'PIXELS',value:20};version.textAutoResize='NONE';version.resize(key.startsWith('작성 중')?40:32,20);version.x=graphWidth;version.y=6;version.fills=[{type:'SOLID',color:rgb(active?'274690':'727272')}];
  {const name=template.clone();row.appendChild(name);name.characters=title;name.fontSize=12;name.lineHeight={unit:'PIXELS',value:20};name.textAutoResize='NONE';name.resize(panel.width-graphWidth-52,20);name.x=graphWidth+40;name.y=6;name.textTruncation='ENDING';name.maxLines=1;name.fills=[{type:'SOLID',color:rgb(active?'274690':'302B27')}];}
  controls.push({key,row:row.id,dot:dot.id});
 }
 copy.setPluginData('janovelCompactLog','2026-11-10');copy.setPluginData('janovelMergeVariant',variant);await janovelCompactLogColors({rootIds:[copy.id]});
 return{rootId:copy.id,panelId:panel.id,fullControl:full?.id,controls,createdNodeIds:[copy,...copy.findAll(()=>true)].map(n=>n.id),metrics:{laneGap:14,rowHeight:32,dot:7,panelWidth:panel.width}};
}

// Update the two supplemental log concepts only; branch color never encodes selection.
async function janovelCompactLogColors(params){
 await janovelCheckFile();const out=[],colors=['274690','39816F','A4753E','8869A4'];

 const rgb=h=>({r:parseInt(h.slice(0,2),16)/255,g:parseInt(h.slice(2,4),16)/255,b:parseInt(h.slice(4,6),16)/255});
 for(const id of params.rootIds){
  const [root]=await janovelProductNodes([id]);if(root.getPluginData('janovelCompactLog')!=='2026-11-10')throw Error('Expected supplemental log concept');
  const models=janovelLogRecords(root.getPluginData('janovelMergeVariant')||'current').map(([key,title,lane,parents])=>[key,lane,parents]),graphWidth=28+Math.max(...models.map(n=>n[1]))*14;const content=root.findOne(n=>n.name==='기록 행 · 32px');const points=new Map(models.map(([key,lane],i)=>[key,{x:16+lane*14,y:16+i*32,lane}]));
  const old=content.children.find(n=>n.name.startsWith('분기·병합 경로'));if(old)old.remove();
  const paths=[];for(const [key,lane,parents]of models)for(const parent of parents){const p=points.get(parent),t=points.get(key),color=colors[parents.length>1?p.lane:p.x>t.x?p.lane:lane];const d=p.x===t.x?`M ${p.x} ${p.y} V ${t.y}`:p.x<t.x?`M ${p.x} ${p.y} L ${t.x} ${p.y+16} V ${t.y}`:`M ${p.x} ${p.y} V ${t.y-16} L ${t.x} ${t.y}`;paths.push(`<path d="${d}" stroke="#${color}" ${key.startsWith('작성 중')?'stroke-dasharray="3 3"':''}/>`);}
  const edge=figma.createNodeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${graphWidth}" height="${models.length*32}"><g fill="none" stroke-width="1.4" stroke-linejoin="round">${paths.join('')}</g></svg>`);const bg=content.children.find(n=>n.name==='선택 행 배경');content.insertChild(bg?1:0,edge);edge.name='분기·병합 경로 · 브랜치 고유색';edge.x=edge.y=0;if(bg)bg.fills=[{type:'SOLID',color:rgb('E8EBF0')}];
  const dots=[];for(const [key,lane]of models){const dot=content.findOne(n=>n.type==='ELLIPSE'&&n.name===key+' node');dot.fills=[{type:'SOLID',color:rgb(key.startsWith('작성 중')?'F7F7F8':colors[lane])}];dot.strokes=[{type:'SOLID',color:rgb(colors[lane])}];const ring=dot.parent.children.find(n=>n.name==='선택 노드 링');if(ring){ring.fills=[];ring.strokes=[{type:'SOLID',color:rgb(colors[lane])}];ring.strokeWeight=1;}
   const texts=dot.parent.children.filter(n=>n.type==='TEXT');for(const [i,t]of texts.entries())t.fills=[{type:'SOLID',color:rgb(i===0?'727272':'302B27')}];dots.push({key,id:dot.id,color:'#'+colors[lane],selected:!!ring});
  }
  out.push({id,edgeId:edge.id,dots,mutatedNodeIds:[root.id,edge.id,...dots.map(n=>n.id)]});
 }
 return out;
}
