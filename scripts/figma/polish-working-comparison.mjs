import fs from 'node:fs';import{connect}from'./talk-channel.mjs';
const p=new URL('../../_workspace/2026-11-08-interactions/state.json',import.meta.url),s=JSON.parse(fs.readFileSync(p)),st=s.workingCompare,c=await connect(process.argv[2]||'tuh6hpb7');
const walk=n=>[n,...(n.children||[]).flatMap(walk)],label=n=>walk(n).filter(x=>x.type==='TEXT').map(x=>x.characters||'').filter(Boolean).join(' ');
try{
 const generic=st.items.find(x=>x.id===s.q2Read);if(generic){generic.key='v2';generic.title='v2 · 해결 과정 구체화';}
 const obsolete=[];for(const [key,id]of Object.entries(st.views)){const[left,right]=key.split('|');if(right===s.q2Read||(left===s.q2Read&&st.items.find(x=>x.id===right)?.key==='v2')){obsolete.push(id);delete st.views[key];delete st.targets[id];st.built=st.built.filter(x=>x!==key);}}
 if(obsolete.length){await c.call('delete_multiple_nodes',{nodeIds:obsolete});for(const[name,id]of Object.entries(s.screens))if(obsolete.includes(id))delete s.screens[name];}
 for(const left of st.items){
  const picker=await c.call('get_node_info',{nodeId:st.pickers[left.id]});
  for(const b of picker.children.filter(n=>n.type==='INSTANCE'))if(label(b).startsWith('Q2 ·')||(left.id===s.q2Read&&label(b)==='v2 · 해결 과정 구체화')){await c.call('delete_node',{nodeId:b.id});s.routes=s.routes.filter(r=>r.id!==b.id);}
  const options=new Set(st.items.filter(x=>x.q===left.q&&x.key!==left.key&&x.id!==s.q2Read).map(x=>x.key)).size+1;
  await c.call('resize_node',{nodeId:picker.id,width:340,height:94+options*40});
 }
 for(const[root,meta]of Object.entries(st.targets))if(meta.left===s.q2Read){
  const d=await c.call('get_node_info',{nodeId:root}),head=walk(d).find(n=>n.name==='왼쪽 / 선택한 기록');if(head){const t=walk(head).find(n=>n.type==='TEXT');if(t)await c.call('set_text_content',{nodeId:t.id,text:generic.title});}
 }
 for(const[root,meta]of Object.entries(st.targets)){
  const left=st.items.find(x=>x.id===meta.left),d=await c.call('get_node_info',{nodeId:root}),g=walk(d).find(n=>n.name==='버전 그래프');if(!g)continue;
  const graph=await c.call('get_node_info',{nodeId:g.id});
  for(const b of walk(graph).filter(n=>n.type==='INSTANCE'&&!n.id.startsWith('I'))){const t=walk(b).find(n=>n.type==='TEXT'),shown=t?.characters?.split(' · ')[0],selected=shown===left.key;
   const rgb=h=>({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255});
   await c.call('set_fill_color',{nodeId:b.id,...rgb(selected?'#EDF1FA':'#F7F7F8')});if(t)await c.call('set_fill_color',{nodeId:t.id,...rgb(selected?'#274690':shown==='작성 중'?'#727272':'#302B27')});
  }
 }
 st.normalized=true;fs.writeFileSync(p,JSON.stringify(s,null,2));console.log(JSON.stringify({obsoleteExamplesRemoved:obsolete.length,views:Object.keys(st.views).length,pickers:Object.keys(st.pickers).length}));
}finally{c.close()}
