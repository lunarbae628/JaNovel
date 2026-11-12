import fs from 'node:fs';
import {connect} from './talk-channel.mjs';
const dir='/Users/moon/Desktop/Works/job-application-service/_workspace/2026-11-08-design';
const receipt=JSON.parse(fs.readFileSync(dir+'/receipt.json','utf8'));
const client=await connect(process.argv[2]||'5yawos1h');
const walk=n=>[n,...(n.children||[]).flatMap(walk)];
try {
 const screens={'작성 · Desktop':'5:530','버전 비교 · Desktop':'5:647','집중 작성 · Desktop':'5:790','전체 그래프 · 사이드바 확장':'15:342','키워드 병합 · Desktop':'37:441','지원 현황 · 목록':'41:345','AI 수정안 · 비교와 채택':'42:458',...receipt.screens};
 const result=[];
 const captures=process.argv[3]==='capture';
 for(const [name,id] of Object.entries(screens)){
   const node=await client.call('get_node_info',{nodeId:id});
   fs.writeFileSync(dir+'/'+id.replace(':','-')+'.json',JSON.stringify(node,null,2));
   const list=walk(node),texts=list.filter(n=>n.type==='TEXT');
   const bounds=node.absoluteBoundingBox;
   const outside=texts.filter(t=>{const b=t.absoluteBoundingBox;return b&&(b.x<bounds.x-1||b.y<bounds.y-1||b.x+b.width>bounds.x+bounds.width+1||b.y+b.height>bounds.y+bounds.height+1);}).map(t=>({id:t.id,text:t.characters,bounds:t.absoluteBoundingBox}));
   const row={id,name,texts:texts.length,instances:list.filter(n=>n.type==='INSTANCE').length,fonts:[...new Set(texts.map(t=>t.style?.fontFamily))],imageFills:list.flatMap(n=>n.fills||[]).filter(f=>f.type==='IMAGE').length,outside};
   row.capture=dir+'/'+id.replace(':','-')+'.png';
   if(captures&&(!fs.existsSync(row.capture)||receipt.visualDirty?.includes(id))){const image=await client.call('export_node_as_image',{nodeId:id,scale:.8});fs.writeFileSync(row.capture,Buffer.from(image.imageData,'base64'));}
   result.push(row);
 }
 fs.writeFileSync(dir+'/review.json',JSON.stringify({checkedAt:'2026-11-08',screens:result},null,2));
 if(captures){receipt.visualDirty=[];fs.writeFileSync(dir+'/receipt.json',JSON.stringify(receipt,null,2));}
 console.log(JSON.stringify(result.map(r=>({id:r.id,name:r.name,texts:r.texts,fonts:r.fonts,imageFills:r.imageFills,outside:r.outside.length,capture:r.capture}))));
} finally {client.close();}
