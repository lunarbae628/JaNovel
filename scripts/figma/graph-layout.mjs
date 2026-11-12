// Figma 예시용 DAG 배치. 제품의 그래프 엔진이나 Docsa 원본을 변경하지 않는다.
export function layoutSnapshotGraph(input, options={}) {
 const {nodeWidth=200,nodeHeight=72,laneGap=100,rowGap=38,offsetX=72,offsetY=36}=options;
 const byId=new Map(input.map(n=>[n.id,n]));
 if(byId.size!==input.length)throw Error('중복 스냅샷 ID');
 const lanes=new Map();
 for(const n of input){if(!lanes.has(n.branch))lanes.set(n.branch,lanes.size);for(const p of n.parents)if(!byId.has(p))throw Error('없는 부모: '+p);}
 const placed=new Map(),occupied=new Set(),pending=new Map(byId);
 while(pending.size){let progress=false;for(const [id,node] of pending){if(!node.parents.every(p=>placed.has(p)))continue;
  const lane=lanes.get(node.branch);let depth=node.parents.length?Math.max(...node.parents.map(p=>placed.get(p).depth))+1:0;
  while(occupied.has(lane+':'+depth))depth++;
  const n={...node,lane,depth,x:offsetX+lane*(nodeWidth+laneGap),y:offsetY+depth*(nodeHeight+rowGap),width:nodeWidth,height:nodeHeight};
  placed.set(id,n);occupied.add(lane+':'+depth);pending.delete(id);progress=true;
 }if(!progress)throw Error('순환하는 부모 관계');}
 const nodes=input.map(n=>placed.get(n.id));
 const edges=nodes.flatMap(n=>n.parents.map(p=>{const s=placed.get(p),sx=s.x+nodeWidth/2,sy=s.y+nodeHeight,tx=n.x+nodeWidth/2,ty=n.y,mid=(sy+ty)/2;return {from:p,to:n.id,path:`M ${sx} ${sy} C ${sx} ${mid} ${tx} ${mid} ${tx} ${ty}`,merge:n.parents.length>1};}));
 return {nodes,edges,width:Math.max(...nodes.map(n=>n.x+nodeWidth))+offsetX,height:Math.max(...nodes.map(n=>n.y+nodeHeight))+offsetY};
}

export const mergeExample=[
 {id:'v1',label:'v1',name:'첫 초안',branch:'기본',parents:[]},
 {id:'v2',label:'v2',name:'경험 구체화',branch:'기본',parents:['v1']},
 {id:'v2-A',label:'v2-A',name:'다른 도입',branch:'직무 강조',parents:['v1']},
 {id:'v2-B',label:'v2-B',name:'사례 중심 도입',branch:'경험 강조',parents:['v1']},
 {id:'v3',label:'v3',name:'직무 연결',branch:'기본',parents:['v2']},
 {id:'v3-A',label:'v3-A',name:'문장 정리',branch:'직무 강조',parents:['v2-A']},
 {id:'v3-B',label:'v3-B',name:'성과 설명 보강',branch:'경험 강조',parents:['v2-B']},
 {id:'v4',label:'v4 · 병합',name:'두 초안 병합',branch:'기본',parents:['v3','v3-A']},
 {id:'draft',label:'작성 중',name:'현재 초안',branch:'기본',parents:['v4']}
];
