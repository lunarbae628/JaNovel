// Local Talk to Figma relay workflow for the supplemental Git-log design concept.
import fs from'node:fs';import{connect}from'./talk-channel.mjs';
const dir='_workspace/2026-11-10-graph-map',file=dir+'/log-state.json';fs.mkdirSync(dir,{recursive:true});
const c=await connect(process.argv[2]);try{
 let scenes=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):[];
 if(!scenes.length){for(const wide of[false,true])scenes.push(await c.call('janovel_compact_log_concept',{wide}));fs.writeFileSync(file,JSON.stringify(scenes,null,2));}
 await c.call('janovel_compact_log_colors',{rootIds:scenes.map(s=>s.rootId)});
 await c.call('janovel_set_reactions',{links:scenes.map((s,i)=>({nodeId:s.fullControl,reactions:[{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',navigation:'NAVIGATE',destinationId:scenes[1-i].rootId,transition:null}]}]}))});
 await c.call('janovel_product_flows');
 const checks=[];for(const [i,s]of scenes.entries()){
  const tree=await c.call('get_node_info',{nodeId:s.rootId});fs.writeFileSync(dir+'/log-scene-'+i+'.json',JSON.stringify(tree,null,2));
  const all=[];function walk(n){all.push(n);for(const ch of n.children||[])walk(ch)}walk(tree);
  const rows=all.filter(n=>s.controls.some(x=>x.row===n.id));if(rows.length!==11||rows.some(n=>n.absoluteBoundingBox.height!==32))throw Error('Invalid log rows');
  checks.push({rootId:s.rootId,rows:rows.length,rowHeight:32,texts:all.filter(n=>n.type==='TEXT').length,metrics:s.metrics});
  const png=await c.call('export_node_as_image',{nodeId:s.rootId,format:'PNG',scale:1});fs.writeFileSync(dir+'/'+(i?'compact-log-wide':'compact-log')+'.png',Buffer.from(png.imageData,'base64'));
 }
 fs.writeFileSync(dir+'/log-checks.json',JSON.stringify(checks,null,2));await c.call('set_focus',{nodeId:scenes[0].rootId});console.log(JSON.stringify(checks));
}finally{c.close()}
