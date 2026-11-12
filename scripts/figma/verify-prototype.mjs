// Verify the saved native Figma reaction readback, not a proposed routing table.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../../_workspace/2026-11-08-interactions/',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,dir),'utf8'));
const state=read('state.json'),audit=read('audit.json'),trees=read('trees-final.json'),actual=read('reactions.json');
const walk=n=>[n,...(n.children||[]).flatMap(walk)];
const byId=new Map(trees.flatMap(walk).map(n=>[n.id,n]));
const reactions=new Map(actual.flatMap(r=>r.controls).map(n=>[n.id,n.reactions]));
const label=n=>walk(n).filter(x=>x.type==='TEXT').map(x=>x.characters||'').filter(Boolean).join(' ');
const control=(root,text)=>walk(byId.get(root)).findLast(n=>n.type==='INSTANCE'&&!n.id.startsWith('I')&&label(n)===text);
function target(id){const re=reactions.get(id)?.find(x=>x.trigger?.type==='ON_CLICK');assert(re,`Missing click: ${id}`);return re.actions[0]?.destinationId;}
function path(root,labels){const visited=[root];for(const l of labels){const n=control(root,l);assert(n,`Missing control ${l} in ${root}`);root=target(n.id);assert(byId.has(root),`Missing destination ${root}`);visited.push(root);}return visited;}
assert.equal(audit.failed.length,0);assert.equal(audit.missingButtons.length,0);
for(const route of state.routes){assert(byId.has(route.id));const matching=reactions.get(route.id)?.some(r=>r.trigger?.type==='ON_CLICK'&&r.actions?.some(a=>route.mode==='CLOSE'?a.type==='CLOSE':route.mode==='URL'?a.type==='URL'&&a.url===route.to:a.type==='NODE'&&a.destinationId===route.to&&a.navigation===route.mode));assert(matching,`Readback mismatch ${route.id}`);}
const graphRead=target('15:241');assert.equal(graphRead,state.screens['기록 본문 · v3']);assert.equal(target('15:238'),graphRead);
assert(!state.routes.some(r=>state.nodeNavigation.readByMenu[r.to]),'Obsolete node popup remains connected');
const flows={
 graphCompare:state.workingCompare?.enabled?(()=>{const picker=target(state.workingCompare.targets[graphRead].button);return[graphRead,...path(picker,['v3-A · 문장 정리'])];})():[...path(graphRead,['비교','v3-A · 문장 정리'])],
 graphMerge:[...path(graphRead,['병합','v3-A · 문장 정리','병합 스냅샷','확인'])],
 branch:path(graphRead,['분기','분기 만들기']),
 posting:path('42:1257',['정보 가져오기 →','등록하고 작성 →']),
 aiCandidate:path('5:530',['수정안 비교 →','스냅샷으로 채택','스냅샷']),
 submitted:path('5:530',['제출 버전','+ 제출 버전','선택한 버전 고정'])
};
for(const [name,expected] of Object.entries({graphCompare:'5:647',graphMerge:state.mergeSnapshot,branch:state.branchResults.v3,posting:'42:745',aiCandidate:state.snapshotDone,submitted:'42:1411'}))assert.equal(flows[name].at(-1),expected,`Wrong flow end: ${name}`);
for(const states of Object.values(state.folds))for(const [bits,id] of Object.entries(states)){assert(byId.has(id));assert.equal(byId.get(id).absoluteBoundingBox.width,1440);}
const fonts=[...new Set(trees.flatMap(walk).filter(n=>n.type==='TEXT'&&n.characters).map(n=>n.style?.fontFamily))];assert.deepEqual(fonts,['Noto Sans KR']);
const result={checkedAt:new Date().toISOString(),nativeReactions:state.routes.length,readbackFailures:0,unwiredButtons:0,fonts,flows,uiObserved:['desktop prototype opened','previous node menu interaction verified before this revision; direct-read UI pending pointer check'],limitations:['finite design states, not live text input or persistence','full pointer-driven round trip not verified','Figma reported local changes awaiting sync']};
fs.writeFileSync(new URL('verification.json',dir),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
