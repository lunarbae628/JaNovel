import React from 'react';
import {Plus,Pencil} from 'lucide-react';
import {branchColor} from '../model.js';
import {IconButton} from './UI.jsx';

export default function OptionHistory({question:q,activeId,selected,onChoose,onSelect,onAdd,onRename}){
 const active=q.branches.find(b=>b.id===activeId)||q.branches[0];
 const rows=q.snapshots.filter(s=>s.branchId===active.id).sort((a,b)=>a.order-b.order).map(s=>({...s,key:'snapshot:'+s.id}));
 if(active.draft.dirty&&!active.draft.closed)rows.push({key:'draft:'+active.id,label:'작성 중',title:'',draft:true});
 return <>
  <div className="option-list" aria-label="버전 목록">{q.branches.map(b=><div className={'option-row '+(b.id===active.id?'active':'')} key={b.id}>
   <button className="option-choice" aria-current={b.id===active.id?'true':undefined} onClick={()=>onChoose(b.id)}><i style={{background:branchColor(b)}}/><span><strong>{b.name}</strong><small>스냅샷 {b.snapshotIds.length}개{b.draft.dirty&&!b.draft.closed?' · 작성 중':''}</small></span></button>
   <IconButton label={b.name+' 버전 수정'} onClick={()=>onRename(b.id)}><Pencil size={13}/></IconButton>
  </div>)}<button className="option-add" onClick={onAdd}><Plus size={14}/>새 버전</button></div>
  <div className="option-history" aria-label={active.name+' 수정 기록'}><div className="option-history-heading"><strong>{active.name}</strong><small>수정 기록</small></div>
   <div className="option-timeline" style={{'--branch-color':branchColor(active)}}>{rows.map((r,i)=><button key={r.key} className={'option-record '+(selected===r.key?'selected':'')+(i===rows.length-1?' last':'')} aria-label={r.label+(r.title?' · '+r.title:'')} aria-current={selected===r.key?'true':undefined} title={r.description||r.title||r.label} onClick={()=>onSelect(r.key)}><i className={r.draft?'draft':''}/><span>{r.label}</span><strong>{r.title}</strong></button>)}</div>
   {!rows.length&&<div className="option-history-empty"><p>스냅샷 없음</p><button className="text-button" onClick={()=>onChoose(active.id)}>현재 본문 열기</button></div>}
  </div>
 </>;
}
