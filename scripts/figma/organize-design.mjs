import fs from'node:fs';import{connect}from'./talk-channel.mjs';const dir='_workspace/2026-11-10-graph-map';
const inventory=JSON.parse(fs.readFileSync(dir+'/design-inventory.json')),auth=JSON.parse(fs.readFileSync(dir+'/auth-state.json')),merge=JSON.parse(fs.readFileSync(dir+'/merge-alternatives.json'));
const groups=[
 {name:'01 · 로그인 / 회원가입',ids:Object.values(auth.controls).map(x=>x.rootId)},
 {name:'02 · 지원 현황 / 캘린더',ids:['41:345','42:1209','42:1128']},
 {name:'03 · 공고 등록 / 확인',ids:['42:1257','42:1314','42:1476','42:1525']},
 {name:'04 · 문항 작성 / AI 피드백',ids:['5:530','42:2327','67:13106']},
 {name:'05 · 기록 비교 / 분기 / 병합',ids:['67:2743','5:912','67:5537','67:5659','37:441','42:458']},
 {name:'06 · 병합안 비교 / 현재안과 Docsa안',ids:['113:193951',...merge.map(x=>x.rootId)]}
];
const core=new Set(groups.flatMap(g=>g.ids));const archiveIds=inventory.roots.filter(n=>!core.has(n.id)&&!inventory.incoming[n.id]&&(/^[ABC] ·|노드 메뉴|기록 메뉴|복원|지원한 이유와 입사 후 목표를 작성해 주세요\./.test(n.name))).map(n=>n.id);
const payload={groups,archiveIds,masterIds:inventory.masters.map(x=>x.id),loginId:auth.controls.login.rootId};fs.writeFileSync(dir+'/organization-plan.json',JSON.stringify(payload,null,2));
if(fs.existsSync(dir+'/organization-state.json'))throw Error('Already organized; inspect saved state before re-running');
const c=await connect(process.argv[2]);try{const result=await c.call('janovel_organize_design',payload);fs.writeFileSync(dir+'/organization-state.json',JSON.stringify(result,null,2));console.log(JSON.stringify({board:result.boardId,pages:result.pages,sections:result.sections.map(s=>({id:s.id,name:s.name,frames:s.frames.length})),details:result.detailCount,components:result.masterCount,archive:result.archiveCount,missingDestinations:result.missingDestinations.length}));const png=await c.call('export_node_as_image',{nodeId:result.boardId,format:'PNG',scale:1});fs.writeFileSync(dir+'/screen-flow-index.png',Buffer.from(png.imageData,'base64'));for(const [name,id]of [['merge-docsa-draft',merge[0].rootId],['merge-docsa-snapshot',merge[1].rootId]]){const img=await c.call('export_node_as_image',{nodeId:id,format:'PNG',scale:1});fs.writeFileSync(dir+'/'+name+'.png',Buffer.from(img.imageData,'base64'));}}finally{c.close()}
