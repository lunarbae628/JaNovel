import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../../_workspace/2026-11-08-interactions/',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,dir),'utf8'));
const s=read('state.json'),st=s.workingCompare,roots=read('trees-final.json'),reactions=read('reactions.json');
const walk=n=>[n,...(n.children||[]).flatMap(walk)],nodes=new Map(roots.flatMap(walk).map(n=>[n.id,n]));
const re=new Map(reactions.flatMap(r=>r.controls).map(n=>[n.id,n.reactions]));
const label=n=>walk(n).filter(x=>x.type==='TEXT').map(x=>x.characters||'').filter(Boolean).join(' ');
function dest(id){const x=re.get(id)?.find(x=>x.trigger?.type==='ON_CLICK')?.actions?.[0];assert(x,`Click missing ${id}`);return x.destinationId;}
function select(root,title){const view=st.targets[root],picker=dest(view.button);assert.equal(picker,st.pickers[view.left]);const option=walk(nodes.get(picker)).find(n=>n.type==='INSTANCE'&&!n.id.startsWith('I')&&label(n)===title);assert(option,`Option missing ${title}`);return dest(option.id);}
let checked=0;
for(const left of st.items){
 const root=st.views[left.id+'|workspace'];assert.equal(root,left.id);
 assert(st.targets[root].workspace);assert.equal(st.targets[root].snapshotCreated,false);
 assert.equal(select(root,'작성 중'),root);
 const selector=nodes.get(st.targets[root].button);assert(label(selector).includes('작성 중'));
 for(const right of st.items.filter(x=>x.q===left.q&&x.key!==left.key&&x.id!==s.q2Read)){
  const target=select(root,right.title),m=st.targets[target];assert.equal(m.left,left.id);assert.equal(m.right,right.id);assert.equal(select(target,'작성 중'),root);checked++;
 }
}
const graphRoot=dest('15:241');assert.equal(graphRoot,s.screens['기록 본문 · v3']);assert(st.targets[graphRoot].workspace);
for(const q of ['Q1','Q2']){assert(st.drafts[q].text.length>0);assert.equal(st.drafts[q].id,'workspace');}
const result={checkedAt:new Date().toISOString(),selectedRecordViews:st.items.length,targetRoundTrips:checked,defaultTarget:'workspace',createsSnapshot:false,sourceStayedFixed:true,graphNavigatesDirectly:true};
fs.writeFileSync(new URL('working-comparison-verification.json',dir),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
