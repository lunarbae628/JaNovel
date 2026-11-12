import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import ReactFlow,{Background,BaseEdge,Handle,Position,ReactFlowProvider,useReactFlow} from 'reactflow';
import 'reactflow/dist/style.css';
import {Network,List,LocateFixed,Minus,Plus} from 'lucide-react';
import {visibleGraphRecords,branchColor} from '../model.js';
import {IconButton} from './UI.jsx';

const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const label=r=>r.kind==='draft'?'작성 중 · '+r.title:r.label+' · '+r.title;
function recordTitle(r,branch){return `${label(r)}\n${r.description||''}${r.description?'\n':''}${branch?.name||''}`;}
function graphData(question){
 const branches=[...question.branches].sort((a,b)=>a.order-b.order),lanes=new Map(branches.map((b,i)=>[b.id,i]));
 const rows=visibleGraphRecords(question).map(row=>({...row,lane:lanes.get(row.branchId),branch:branches.find(b=>b.id===row.branchId),color:branchColor(branches.find(b=>b.id===row.branchId))}));
 return {rows,branches,bySnapshot:new Map(rows.filter(r=>r.kind==='snapshot').map(r=>[r.id,r]))};
}
function edgeColor(parent,row){return row.parentIds.length>1?parent.color:row.color;}
function HistoryLog({data,selected,onSelect}){
 const scroll=useRef(null);
 const {rows}=data;
 const points=new Map(rows.map((r,i)=>[r.key,{x:16+r.lane*14,y:16+i*32}]));
 const width=28+Math.max(0,data.branches.length-1)*14;
 useEffect(()=>{scroll.current?.querySelector('[aria-current="true"]')?.scrollIntoView({block:'nearest',behavior:'instant'});},[selected,rows.length]);
 const locate=()=>scroll.current?.querySelector('[aria-current="true"]')?.scrollIntoView({block:'center',behavior:reducedMotion()?'instant':'smooth'});
 return <>
  <div className="graph-scroll" ref={scroll}>
   <div className="log-graph" style={{height:rows.length*32,'--graph-width':width+'px',minWidth:width+100}}>
    <svg className="log-tracks" width={width} height={rows.length*32} aria-hidden="true">
     <g fill="none" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">{rows.flatMap(row=>row.parentIds.map(id=>{
      const parent=data.bySnapshot.get(id),p=points.get(parent.key),t=points.get(row.key);
      const path=p.x===t.x?`M ${p.x} ${p.y} V ${t.y}`:`M ${p.x} ${p.y} L ${t.x} ${p.y+16} V ${t.y}`;
      return <path key={id+'>'+row.key} d={path} stroke={edgeColor(parent,row)} strokeDasharray={row.kind==='draft'?'3 3':undefined}/>;
     }))}</g>
    </svg>
    {rows.map(row=><button key={row.key} className={'graph-record '+(selected===row.key?'selected':'')} style={{'--branch-color':row.color}} aria-label={label(row)} aria-current={selected===row.key?'true':undefined} title={recordTitle(row,row.branch)} onClick={()=>onSelect(row.key)}>
     <span className={'log-dot '+(row.kind==='draft'?'draft':'')} style={{left:points.get(row.key).x}}/>
     <span className="log-version">{row.kind==='draft'?'작성 중':row.label}</span><span className="log-title">{row.title}</span>
    </button>)}
   </div>
  </div>
  <GraphFooter map={false} onLocate={locate}/>
 </>;
}
function MapNode({data}){
 const row=data.row;
 return <button className={'map-record nodrag nopan '+(data.active?'selected':'')} style={{'--node-color':row.color}} title={recordTitle(row,row.branch)} aria-label={label(row)} aria-current={data.active?'true':undefined} onClick={e=>{e.stopPropagation();data.onSelect(row.key)}}>
  <Handle type="target" position={Position.Top}/><Handle type="source" position={Position.Bottom}/>
  <span className={'map-dot '+(row.kind==='draft'?'draft':'')}/><strong>{row.kind==='draft'?'작성 중':row.label}</strong><small>{row.title}</small>
 </button>;
}
function HistoryEdge({id,sourceX:sx,sourceY:sy,targetX:tx,targetY:ty,style}){
 const path=sx===tx?`M ${sx} ${sy} V ${ty}`:`M ${sx} ${sy} C ${sx} ${sy+20}, ${tx} ${sy+20}, ${tx} ${sy+40} V ${ty}`;
 return <BaseEdge id={id} path={path} style={style} interactionWidth={0}/>;
}
const nodeTypes={record:MapNode},edgeTypes={history:HistoryEdge};
function MapGraph({data,selected,onSelect,expanded}){
 const flow=useReactFlow(),holder=useRef(null),previous=useRef({selected:null,expanded:null}),[ready,setReady]=useState(false),[zoom,setZoom]=useState(125);
 const {nodes,edges}=useMemo(()=>{
  const depths=new Map(),laneDepth=new Map();
  const nodes=data.rows.map(row=>{
   const depth=Math.max(0,...row.parentIds.map(id=>(depths.get('snapshot:'+id)??-1)+1),(laneDepth.get(row.lane)??-1)+1);
   depths.set(row.key,depth);laneDepth.set(row.lane,depth);
   return {id:row.key,type:'record',position:{x:row.lane*60,y:depth*76},width:56,height:68,draggable:false,data:{row,active:row.key===selected,onSelect}};
  });
  const edges=data.rows.flatMap(row=>row.parentIds.map(id=>({id:id+'>'+row.key,source:'snapshot:'+id,target:row.key,type:'history',style:{stroke:edgeColor(data.bySnapshot.get(id),row),strokeWidth:1.2,strokeDasharray:row.kind==='draft'?'4 4':undefined}})));
  return {nodes,edges};
 },[data,selected,onSelect]);
 const center=useCallback((duration=320)=>{
  const node=nodes.find(n=>n.id===selected);if(!node)return;
  flow.setCenter(node.position.x+28,node.position.y+18,{zoom:1.25,duration:reducedMotion()?0:duration});
 },[flow,nodes,selected]);
 useEffect(()=>{
  if(!ready)return;
  const last=previous.current,first=last.selected===null,changed=last.selected!==selected,resized=last.expanded!==expanded;
  previous.current={selected,expanded};
  if(first||changed||resized){const frame=requestAnimationFrame(()=>requestAnimationFrame(()=>{
   if(expanded&&(resized||first))flow.fitView({padding:.16,minZoom:.05,maxZoom:1.25,duration:reducedMotion()?0:320});else center(first?0:320);
  }));return()=>cancelAnimationFrame(frame);}
 },[ready,selected,expanded,flow,center]);
 useEffect(()=>{
  if(!ready)return;
  const element=holder.current;let size={w:element.clientWidth,h:element.clientHeight};
  const observer=new ResizeObserver(()=>{const w=element.clientWidth,h=element.clientHeight,v=flow.getViewport();if(w!==size.w||h!==size.h)flow.setViewport({...v,x:v.x+(w-size.w)/2,y:v.y+(h-size.h)/2},{duration:0});size={w,h};});
  observer.observe(element);return()=>observer.disconnect();
 },[ready,flow]);
 return <><div className="map-graph" ref={holder} data-selected={selected}>
  <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} edgesFocusable={false} nodesFocusable={false} onNodeClick={(_,node)=>onSelect(node.id)} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} panOnDrag panOnScroll zoomOnScroll={false} zoomOnPinch zoomOnDoubleClick={false} defaultViewport={{x:0,y:0,zoom:1.25}} minZoom={.05} maxZoom={1.6} onInit={()=>setReady(true)} onMove={(_,v)=>setZoom(Math.round(v.zoom*100))}>
   <Background gap={24} size={.65} color="#D9DDE5"/>
  </ReactFlow>
 </div><GraphFooter map onLocate={()=>center()} zoom={zoom} onZoomIn={()=>flow.zoomIn({duration:reducedMotion()?0:180})} onZoomOut={()=>flow.zoomOut({duration:reducedMotion()?0:180})}/></>;
}
const ViewContext=React.createContext(null);
function GraphFooter({map,onLocate,zoom,onZoomIn,onZoomOut}){
 const setMap=React.useContext(ViewContext);
 return <div className="graph-footer">
  <IconButton label={map?'기록형 보기':'지도형 보기'} onClick={()=>setMap(!map)}>{map?<List size={16}/>:<Network size={16}/>}</IconButton>
  {map&&<><IconButton label="그래프 축소 배율" onClick={onZoomOut}><Minus size={17}/></IconButton><span className="graph-zoom" aria-live="polite">{zoom}%</span><IconButton label="그래프 확대 배율" onClick={onZoomIn}><Plus size={17}/></IconButton></>}
  <IconButton label="선택 기록으로" className="graph-locate" onClick={onLocate}><LocateFixed size={18}/></IconButton>
 </div>;
}
export default function VersionGraph({question,selected,onSelect,expanded}){
 const[map,setMap]=useState(false),data=useMemo(()=>graphData(question),[question]);
 return <ViewContext.Provider value={setMap}>{map?<ReactFlowProvider><MapGraph data={data} selected={selected} onSelect={onSelect} expanded={expanded}/></ReactFlowProvider>:<HistoryLog data={data} selected={selected} onSelect={onSelect}/>}</ViewContext.Provider>;
}
