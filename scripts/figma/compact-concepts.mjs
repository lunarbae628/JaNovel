import fs from 'node:fs';
import {connect} from './talk-channel.mjs';
const dir='_workspace/2026-11-09-concepts',path=dir+'/state.json';fs.mkdirSync(dir,{recursive:true});
const state=fs.existsSync(path)?JSON.parse(fs.readFileSync(path)):{};
const save=()=>fs.writeFileSync(path,JSON.stringify(state,null,2));
const client=await connect(process.argv[2]);
try{
 const mode=process.argv[3]||'prepare';
 if(mode==='prepare'){
  state.assets=await client.call('janovel_compact_assets',{svgs:JSON.parse(fs.readFileSync('scripts/figma/assets/lucide-icons.json'))});save();
  state.roots=(await client.call('janovel_compact_list')).ids;save();
  const original=JSON.parse(fs.readFileSync('_workspace/2026-11-08-interactions/state.json')),p=original.productCorrections;
  state.panelIds=[...new Set([...Object.values(p.panels).flatMap(pair=>Object.values(pair).flatMap(x=>[x.expandedId,x.foldedId])),...Object.values(p.widePanels).map(x=>x.wideId)])];save();
  console.log(JSON.stringify({assets:state.assets,roots:state.roots.length,panels:state.panelIds.length}));
 }
 if(mode==='panels'){
  state.panelsDone||=[];
  const ids=state.panelIds.filter(id=>!state.panelsDone.includes(id));
  for(let i=0;i<ids.length;i+=8){const r=await client.call('janovel_compact_panels',{ids:ids.slice(i,i+8),icons:state.assets.icons});state.panelsDone.push(...r.panels.map(x=>x.id));save();console.log('panels',state.panelsDone.length+'/'+state.panelIds.length);}
 }
 if(mode==='sample'||mode==='scenes'){
  state.scenesDone||=[];
  const ids=mode==='sample'?['67:2743','5:530']:state.roots.filter(id=>!state.scenesDone.includes(id));
  for(let i=0;i<ids.length;i+=2){const r=await client.call('janovel_compact_scenes',{ids:ids.slice(i,i+2),icons:state.assets.icons});state.scenesDone=[...new Set([...state.scenesDone,...r.scenes.map(x=>x.id)])];save();console.log('scenes',state.scenesDone.length+'/'+state.roots.length);}
 }
 if(mode==='concepts'){state.concepts=await client.call('janovel_compact_concepts');save();await client.call('janovel_product_flows');console.log(JSON.stringify(state.concepts));}
 if(mode==='verify'){
  const ids=[...state.roots,...(state.concepts?.concepts||[]).map(x=>x.id)];const checks=[];
  for(let i=0;i<ids.length;i+=12){checks.push(...(await client.call('janovel_compact_verify',{ids:ids.slice(i,i+12)})).checks);}
  fs.writeFileSync(dir+'/verification.json',JSON.stringify(checks,null,2));
  const failures=checks.filter(x=>x.dividerDelta!==null&&x.dividerDelta!==0||x.leftTitle?.length||x.bodyFonts.some(f=>f.size!==14||f.line!==24)||x.toolbar?.some(t=>t.visibleText.length));console.log(JSON.stringify({checked:checks.length,failures}));
 }
 if(mode==='export'){
  for(const [i,view]of state.concepts.concepts.entries()){
   const r=await client.call('export_node_as_image',{nodeId:view.id,format:'PNG',scale:1});
   const base64=r.imageData||r.data||r.base64;if(!base64){console.log(Object.keys(r));fs.writeFileSync(dir+'/export-result.json',JSON.stringify(r));throw Error('Missing image data');}
   fs.writeFileSync(dir+'/concept-'+String.fromCharCode(65+i)+'.png',Buffer.from(base64.replace(/^data:[^,]*,/,''),'base64'));console.log(view.name);
  }
 }
}finally{client.close()}
