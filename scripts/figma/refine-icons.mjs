import fs from 'node:fs';
import {connect} from './talk-channel.mjs';
const dir='_workspace/2026-11-10-icons',ledger=dir+'/state.json';fs.mkdirSync(dir,{recursive:true});
const state=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger)):{},base=JSON.parse(fs.readFileSync('_workspace/2026-11-09-concepts/state.json'));
const original=JSON.parse(fs.readFileSync('scripts/figma/assets/lucide-icons.json')),extra=JSON.parse(fs.readFileSync('scripts/figma/assets/refined-icons.json'));
const sourceMap={'git-merge':'merge','git-branch':'split','pencil-line':'pencil','panel-left-close':'chevron-left','panel-left-open':'chevron-right','panel-right-close':'chevron-right','panel-right-open':'chevron-left'};
const roles={'git-merge':'병합','git-branch':'분기','pencil-line':'작성',camera:'스냅샷','panel-left-close':'왼쪽 접기','panel-left-open':'왼쪽 펼치기','panel-right-close':'오른쪽 접기','panel-right-open':'오른쪽 펼치기','maximize-2':'전체 그래프','minimize-2':'주변 그래프','chevron-down':'비교 대상 선택'};
const icons=Object.entries(base.assets.icons).map(([key,id])=>{
 const source=sourceMap[key]||key;let svg=extra[source]?.content||original[source];
 // Match the version graph's top-to-bottom reading direction; retain official SVG paths.
 if(source==='merge'||source==='split')svg=svg.replace(/(<svg[\s\S]*?>)([\s\S]*)(<\/svg>)/,'$1<g transform="rotate(180 12 12)">$2</g>$3');
 return {id,key,source,role:roles[key],svg};
});
const save=()=>fs.writeFileSync(ledger,JSON.stringify(state,null,2));
const c=await connect(process.argv[2]);
try{
 const mode=process.argv[3]||'inspect';
 if(mode==='inspect'){
  state.before=await c.call('janovel_refine_icons',{icons});save();
  state.reactionsBefore=await c.call('janovel_inspect_reactions',{nodeIds:['5:530','67:2743','94:113338']});save();console.log(JSON.stringify(state.before));
 }
 if(mode==='downward'){
  state.downward=await c.call('janovel_refine_icons',{icons:icons.filter(x=>x.source==='merge'||x.source==='split'),apply:true});save();console.log(JSON.stringify(state.downward));
 }
 if(mode==='apply'){
  state.applied=await c.call('janovel_refine_icons',{icons,apply:true});save();console.log(JSON.stringify(state.applied));
 }
 if(mode==='direction'){
  const ids=[...base.roots,'94:113338'];state.directionDone||=[];const remaining=ids.filter(id=>!state.directionDone.includes(id));
  for(let i=0;i<remaining.length;i+=4){const r=await c.call('janovel_adopt_document_direction',{ids:remaining.slice(i,i+4)});state.directionDone.push(...r.scenes.map(x=>x.id));save();}
  console.log('Updated direction on '+state.directionDone.length+' workbenches.');
 }
 if(mode==='verify'){
  const report=await c.call('janovel_refine_icons',{icons});state.reactionsAfter=await c.call('janovel_inspect_reactions',{nodeIds:['5:530','67:2743','94:113338']});
  if(JSON.stringify(state.reactionsBefore)!==JSON.stringify(state.reactionsAfter))throw Error('Existing click reactions changed');
  for(const icon of report.icons){if(!icon.after.length||icon.after.some(x=>x.weight!==1.25))throw Error('Unexpected icon stroke '+icon.id);}
  state.verification={iconCount:report.icons.length,reactionsPreserved:true,report};save();console.log(JSON.stringify({iconCount:report.icons.length,reactionsPreserved:true,finalStroke:1.25}));
 }
 if(mode==='export'){
  const root=await c.call('get_node_info',{nodeId:'94:113338'});fs.writeFileSync(dir+'/selected-tree.json',JSON.stringify(root));
  const find=(node,name)=>node.name===name?node:node.children?.map(n=>find(n,name)).find(Boolean);const toolbar=find(root,'문항·작성 도구');
  for(const [name,id,scale]of [['selected-comparison',root.id,1],['toolbar',toolbar.id,2]]){const r=await c.call('export_node_as_image',{nodeId:id,format:'PNG',scale});fs.writeFileSync(dir+'/'+name+'.png',Buffer.from(r.imageData,'base64'));}
  await c.call('set_focus',{nodeId:root.id});console.log(JSON.stringify({selected:root.id,toolbar:toolbar.id}));
 }
}finally{c.close()}
