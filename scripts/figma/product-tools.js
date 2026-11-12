// Project-only additions to the existing local plugin. No arbitrary script execution.
async function janovelProductNodes(ids) {
  await janovelCheckFile();
  const nodes = [];
  for (const id of ids) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE') throw Error('Invalid JaNovel scene node: '+id);
    nodes.push(node);
  }
  return nodes;
}
async function janovelProductFonts(node) {
  const texts = [node,...('findAll' in node ? node.findAll(n=>n.type==='TEXT') : [])].filter(n=>n.type==='TEXT');
  const fonts = new Map();
  for (const text of texts) for (const segment of text.getStyledTextSegments(['fontName'])) fonts.set(JSON.stringify(segment.fontName),segment.fontName);
  await Promise.all([...fonts.values()].map(font=>figma.loadFontAsync(font)));
}
async function janovelPatchNodes(params) {
  const patches = params.patches || [];
  const nodes = await janovelProductNodes(patches.map(p=>p.id));
  const allowed = ['visible','clipsContent','layoutMode','layoutSizingHorizontal','layoutSizingVertical','primaryAxisSizingMode','counterAxisSizingMode','primaryAxisAlignItems','counterAxisAlignItems','itemSpacing','paddingLeft','paddingRight','paddingTop','paddingBottom','cornerRadius','textAutoResize','fontSize','lineHeight','opacity','name'];
  for (const patch of patches) for (const key of Object.keys(patch.props||{})) if (!allowed.includes(key)) throw Error('Unsupported property: '+key);
  const result=[];
  for (let i=0;i<nodes.length;i++) {
    const node=nodes[i],p=patches[i];
    await janovelProductFonts(node);
    if (p.width!==undefined || p.height!==undefined) node.resize(p.width??node.width,p.height??node.height);
    for (const [key,value] of Object.entries(p.props||{})) node[key]=value;
    if (p.text!==undefined && node.type==='TEXT') node.characters=p.text;
    if (p.ranges && node.type==='TEXT') {
      node.fills=[{type:'SOLID',color:{r:48/255,g:43/255,b:39/255}}];
      for(const range of p.ranges)if(range.end>range.start)node.setRangeFills(range.start,range.end,[{type:'SOLID',color:{r:39/255,g:70/255,b:144/255}}]);
    }
    if(p.textStyleId && node.type==='TEXT') await node.setTextStyleIdAsync(p.textStyleId);
    result.push({id:node.id,width:node.width,height:node.height,visible:node.visible,...('clipsContent' in node?{clipsContent:node.clipsContent}:{})});
  }
  return {mutatedNodeIds:nodes.map(n=>n.id),nodes:result};
}
async function janovelRecordGraph(params) {
 const [root]=await janovelProductNodes([params.rootId]);await janovelProductFonts(root);
 const graph=root.findOne(n=>n.name==='버전 그래프');if(!graph)throw Error('Graph missing');
 const template=graph.children.find(n=>n.type==='INSTANCE');if(!template)throw Error('Graph label template missing');
 const keep=template.clone();figma.currentPage.appendChild(keep);
 for(const node of [...graph.children])node.remove();
 graph.layoutMode='NONE';graph.resize(176,390);
 const q2=params.q==='Q2',titles=q2?{'v1':'문제 정리','v1-A':'다른 사례','v2':'해결 과정 구체화'}:{'v3':'직무 연결','v3-A':'문장 정리','v4':'두 초안 병합'};
 const keys=[...params.parents,params.key,'작성 중'];
 const points=keys.map((key,i)=>({key,x:params.parents.length>1&&i===1?32:12,y:32+i*64}));
 const parents=q2?{'v2':['v1','v1-A']}:{'v4':['v3','v3-A']};parents[params.key]=params.parents;parents['작성 중']=[params.key];
 const paths=[];for(const target of points)for(const key of parents[target.key]||[]){const source=points.find(n=>n.key===key);if(source){const skip=target.y-source.y>70,side=skip?50:source.x;paths.push(`<path d="M ${source.x} ${source.y} C ${side} ${source.y+24}, ${skip?50:target.x} ${target.y-24}, ${target.x} ${target.y}"/>`);}}
 const svg=figma.createNodeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="58" height="360" viewBox="0 0 58 360"><g fill="none" stroke="#576CA8" stroke-width="1.5">${paths.join('')}</g></svg>`);
 graph.appendChild(svg);svg.name='스냅샷 부모 관계';svg.x=0;svg.y=0;
 const controls=[];
 for(const [i,point]of points.entries()){
  const dot=figma.createEllipse();graph.appendChild(dot);dot.name=point.key+' node';dot.resize(10,10);dot.x=point.x-5;dot.y=point.y-5;dot.fills=[{type:'SOLID',color:point.key===params.key?{r:39/255,g:70/255,b:144/255}:{r:1,g:1,b:1}}];dot.strokes=[{type:'SOLID',color:{r:87/255,g:108/255,b:168/255}}];
  const row=keep.clone();graph.appendChild(row);row.x=52;row.y=point.y-24;row.resize(124,52);row.fills=point.key===params.key?[{type:'SOLID',color:{r:237/255,g:241/255,b:250/255}}]:[];
  const texts=row.findAll(n=>n.type==='TEXT');texts[0].characters=point.key;texts[1].characters=point.key===params.key?params.title:point.key==='작성 중'?params.key+'에서 작성':titles[point.key]||point.key;texts[0].fills=[{type:'SOLID',color:point.key===params.key?{r:39/255,g:70/255,b:144/255}:{r:48/255,g:43/255,b:39/255}}];
  const to=point.key===params.key?params.recordTo:point.key==='작성 중'?params.workspaceTo:params.targets?.[point.key];
  for(const n of [dot,row]){if(to&&to!==root.id)await n.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',navigation:'NAVIGATE',destinationId:to,transition:null}]}]);else await n.setReactionsAsync([]);}
  controls.push({key:point.key,dot:dot.id,label:row.id,to,parents:parents[point.key]||[]});
 }
 keep.remove();return {rootId:root.id,graphId:graph.id,createdNodeIds:[graph,...graph.findAll(()=>true)].map(n=>n.id),controls};
}
async function janovelCloneScene(params) {
  const [source]=await janovelProductNodes([params.nodeId]);
  await janovelProductFonts(source);
  const copy=source.clone(),map={};
  function pair(a,b){map[a.id]=b.id;if('children' in a)for(let i=0;i<a.children.length;i++)pair(a.children[i],b.children[i]);}
  pair(source,copy);
  copy.name=params.name||source.name;
  if(params.x!==undefined)copy.x=params.x;
  if(params.y!==undefined)copy.y=params.y;
  const all=[copy,...('findAll' in copy?copy.findAll(()=>true):[])];
  for(const node of all)if('reactions' in node && node.reactions.length){
    const reactions=JSON.parse(JSON.stringify(node.reactions));
    for(const r of reactions)for(const a of r.actions||[])if(a.destinationId&&map[a.destinationId])a.destinationId=map[a.destinationId];
    await node.setReactionsAsync(reactions);
  }
  return {id:copy.id,idMap:map,createdNodeIds:all.map(n=>n.id)};
}
async function janovelInteractivePanel(params) {
  const [root]=await janovelProductNodes([params.rootId]);
  const work=root.findOne(n=>n.name==='작업 공간');
  const name=params.side==='left'?'문항별 버전 기록':'AI 대화';
  const panel=work.children.find(n=>n.name===name);
  if(!panel)throw Error('Panel missing: '+name);
  if(panel.type==='INSTANCE')return {instanceId:panel.id,already:true};
  await janovelProductFonts(root);
  const originalIndex=work.children.indexOf(panel),width=panel.width,height=panel.height;
  if(params.expandedId){
    const [expanded]=await janovelProductNodes([params.expandedId]);
    if(expanded.type!=='COMPONENT'||expanded.parent.type!=='COMPONENT_SET')throw Error('Expected panel component variant');
    const set=expanded.parent,folded=set.children.find(n=>n.name==='State=Collapsed');
    const instance=expanded.createInstance();instance.name=name;work.insertChild(originalIndex,instance);instance.layoutSizingHorizontal='HUG';instance.layoutSizingVertical='FILL';
    const oldIds=[panel,...panel.findAll(()=>true)].map(n=>n.id);panel.remove();
    const center=work.children.find(n=>n.name==='작성·비교');center.layoutSizingHorizontal='FILL';
    return {createdNodeIds:[instance.id],removedNodeIds:oldIds,instanceId:instance.id,setId:set.id,expandedId:expanded.id,foldedId:folded.id,expandedToggle:expanded.children[0].findOne(n=>n.type==='INSTANCE'&&n.name.includes('toggle')).id,foldedToggle:folded.children[0].findOne(n=>n.type==='INSTANCE'&&n.name.includes('toggle')).id,width,foldedWidth:40,centerId:center.id};
  }
  const expanded=figma.createComponentFromNode(panel.clone());
  figma.currentPage.appendChild(expanded);expanded.name='State=Expanded';
  const folded=expanded.clone();folded.name='State=Collapsed';
  for(const n of [...folded.children])if(n!==folded.children[0])n.remove();
  const header=folded.children[0];
  const toggle=header.findOne(n=>n.type==='INSTANCE'&&n.name.includes('toggle'));
  if(!toggle)throw Error('Panel toggle missing');
  for(const n of [...header.children])if(n!==toggle)n.remove();
  folded.paddingLeft=folded.paddingRight=0;
  header.paddingLeft=header.paddingRight=0;header.primaryAxisAlignItems='CENTER';
  header.resize(40,56);header.layoutSizingHorizontal='FILL';
  const icon=await figma.getNodeByIdAsync(params.side==='left'?'4:210':'4:207');
  toggle.swapComponent(icon);toggle.resize(32,32);
  folded.resize(40,height);folded.clipsContent=true;
  const set=figma.combineAsVariants([expanded,folded],figma.currentPage);
  set.name='JaNovel/Panel/'+params.side+'/'+root.id;
  set.description='Independent panel collapse. Changes only this sibling; selected document and comparison target remain intact.';
  set.x=params.x;set.y=params.y;expanded.x=16;expanded.y=16;folded.x=width+40;folded.y=16;
  set.resize(width+96,height+32);
  async function change(control,target){await control.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',navigation:'CHANGE_TO',destinationId:target.id,transition:null}]}]);}
  const expHeader=expanded.children[0],expToggle=expHeader.findOne(n=>n.type==='INSTANCE'&&n.name.includes('toggle'));
  expToggle.resize(32,32);
  await change(expToggle,folded);await change(toggle,expanded);
  const instance=expanded.createInstance();instance.name=name;
  work.insertChild(originalIndex,instance);instance.layoutSizingHorizontal='HUG';instance.layoutSizingVertical='FILL';
  const oldIds=[panel,...panel.findAll(()=>true)].map(n=>n.id);panel.remove();
  const center=work.children.find(n=>n.name==='작성·비교');center.layoutSizingHorizontal='FILL';
  const ids=[set.id,expanded.id,folded.id,instance.id];
  return {createdNodeIds:ids,removedNodeIds:oldIds,instanceId:instance.id,setId:set.id,expandedId:expanded.id,foldedId:folded.id,expandedToggle:expToggle.id,foldedToggle:toggle.id,width,foldedWidth:40,centerId:center.id};
}
async function janovelWidePanel(params) {
 const [expanded]=await janovelProductNodes([params.expandedId]);await janovelProductFonts(expanded);
 const set=expanded.parent;if(expanded.type!=='COMPONENT'||set.type!=='COMPONENT_SET')throw Error('Panel component required');
 const existing=set.children.find(n=>n.name==='State=Wide');if(existing&&!params.recoverId)return {wideId:existing.id,already:true};
 const graph=expanded.findOne(n=>n.name==='버전 그래프'),template=graph?.children.find(n=>n.type==='INSTANCE');
 const fullText=expanded.findOne(n=>n.type==='TEXT'&&n.characters==='전체 보기');if(!template||!fullText)return {skipped:true};
 let full=fullText;while(full.type!=='INSTANCE')full=full.parent;
 const wide=params.recoverId?(await janovelProductNodes([params.recoverId]))[0]:expanded.clone();set.appendChild(wide);wide.name='State=Wide';wide.resize(400,expanded.height);wide.x=expanded.width+128;wide.y=16;
 const wideGraph=wide.findOne(n=>n.name==='버전 그래프'),keep=template.clone();figma.currentPage.appendChild(keep);
 for(const node of [...wideGraph.children])node.remove();wideGraph.layoutMode='NONE';wideGraph.resize(368,600);
 for(const child of wide.children)if(child.type==='FRAME')child.layoutSizingHorizontal='FILL';
 const row=wide.findOne(n=>n.name==='현재 갈래와 전체 보기');if(row)row.layoutSizingHorizontal='FILL';
 const history=params.history,points=new Map();
 const occupied=new Set();
 for(const node of history){let depth=node.parents.length?Math.max(...node.parents.map(k=>points.get(k)?.depth??-1))+1:0;while(occupied.has(node.lane+'|'+depth))depth++;occupied.add(node.lane+'|'+depth);points.set(node.key,{...node,depth,x:12+node.lane*112,y:24+depth*76});}
 const paths=[];for(const node of points.values())for(const key of node.parents){const parent=points.get(key);if(parent){const detour=node.depth-parent.depth>1&&node.x===parent.x?-10:0;paths.push(detour?`<path d="M ${parent.x} ${parent.y} C ${parent.x+detour} ${parent.y+36}, ${node.x+detour} ${node.y-36}, ${node.x} ${node.y}"/>`:`<path d="M ${parent.x} ${parent.y} L ${parent.x} ${parent.y+20} C ${parent.x} ${parent.y+40}, ${node.x} ${node.y-40}, ${node.x} ${node.y-20} L ${node.x} ${node.y}"/>`);}}
 const svg=figma.createNodeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="368" height="600" viewBox="0 0 368 600"><g fill="none" stroke="#576CA8" stroke-width="1.5">${paths.join('')}</g></svg>`);wideGraph.appendChild(svg);svg.name='전체 스냅샷 부모 관계';svg.x=svg.y=0;
 const controls=[];
 for(const node of points.values()){
  const selected=node.key===params.selected,dot=figma.createEllipse();wideGraph.appendChild(dot);dot.name=node.key+' node';dot.resize(10,10);dot.x=node.x-5;dot.y=node.y-5;dot.fills=[{type:'SOLID',color:selected?{r:39/255,g:70/255,b:144/255}:{r:1,g:1,b:1}}];dot.strokes=[{type:'SOLID',color:{r:87/255,g:108/255,b:168/255}}];
  const label=keep.clone();wideGraph.appendChild(label);label.x=node.x+12;label.y=node.y-24;label.resize(100,52);label.fills=selected?[{type:'SOLID',color:{r:237/255,g:241/255,b:250/255}}]:[];
  const texts=label.findAll(n=>n.type==='TEXT');texts[0].characters=node.key;texts[1].characters=node.title;texts[0].fills=[{type:'SOLID',color:selected?{r:39/255,g:70/255,b:144/255}:{r:48/255,g:43/255,b:39/255}}];
  const to=params.targets[node.key];for(const control of [dot,label])await control.setReactionsAsync(to?[{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',navigation:'NAVIGATE',destinationId:to,transition:null}]}]:[]);controls.push({key:node.key,to,dot:dot.id,label:label.id});
 }
 keep.remove();
 async function change(control,target){await control.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',navigation:'CHANGE_TO',destinationId:target.id,transition:null}]}]);}
 await change(full,wide);for(const t of expanded.findAll(n=>n.type==='TEXT'&&n.characters.startsWith('숨긴 기록')))await change(t,wide);
 const compact=wide.findOne(n=>n.type==='TEXT'&&(n.characters==='전체 보기'||n.characters==='주변 보기'));if(!compact)throw Error('Compact graph control missing');compact.characters='주변 보기';let back=compact;while(back.type!=='INSTANCE')back=back.parent;await change(back,expanded);
 const folded=set.children.find(n=>n.name==='State=Collapsed'),toggle=wide.children[0].findOne(n=>n.type==='INSTANCE'&&n.name.includes('toggle'));await change(toggle,folded);
 set.resize(expanded.width+560,expanded.height+32);
 return {wideId:wide.id,expandedId:expanded.id,expandControl:full.id,compactControl:back.id,controls,createdNodeIds:[wide,...wide.findAll(()=>true)].map(n=>n.id)};
}
async function janovelProductFlows() {
 await janovelCheckFile();
 const flows=[{nodeId:'41:345',name:'지원 현황'},{nodeId:'5:530',name:'자소서 작성'},{nodeId:'67:2743',name:'버전 비교'},{nodeId:'42:1209',name:'캘린더'}];
 await janovelProductNodes(flows.map(x=>x.nodeId));
 const login=await figma.getNodeByIdAsync('144:194717');if(login)flows.unshift({nodeId:login.id,name:'로그인·회원가입'});
 const previous=figma.currentPage.flowStartingPoints.length;figma.currentPage.flowStartingPoints=flows;
 return {previous,flows:figma.currentPage.flowStartingPoints};
}
