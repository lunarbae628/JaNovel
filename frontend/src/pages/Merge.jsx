import React,{useState} from 'react';
import {Header,Field,Notice,Modal} from '../components/UI.jsx';
import {RecordSelect} from './Editor.jsx';
import {createMergeState,chooseMergeRegion,editMergeText} from '../merge-state.js';
import {mergeDraft,resolveRecord,errorMessage} from '../model.js';

function SourceText({segments,choices,side,onChoose}){
 return <div className={'document-body merge-source '+side}>{segments.map((segment,index)=>{
  if(segment.type==='equal')return <span key={'equal-'+index}>{segment.text}</span>;
  const value=segment[side],selected=choices[segment.id]===side;
  const emptyLabel=value?(value.includes('\n')?'줄바꿈':'공백'):'내용 없음';
  return <span key={'change-'+segment.id} role="button" tabIndex={0} aria-pressed={selected} aria-label={`${side==='left'?'왼쪽':'오른쪽'} 구절: ${value.trim()||emptyLabel}`} title={selected?'다시 누르면 선택 해제':'결과에 반영'} data-change-id={segment.id} className={'merge-region '+(selected?'selected':'')} onClick={()=>onChoose(segment.id,side)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onChoose(segment.id,side)}}}>{value.trim()?value:<><span className="merge-empty-region">{emptyLabel}</span>{value}</>}</span>;
 })}</div>;
}
export default function Merge({application:a,question:q,query,navigate,onSave}){
 const first='draft:'+q.branches[0].id;
 const valid=key=>{try{resolveRecord(q,key);return key}catch{return first}};
 const[left,setLeft]=useState(valid(query.get('left')||first));
 const[right,setRight]=useState(valid(query.get('right')||('draft:'+(q.branches[1]?.id||q.branches[0].id))));
 const l=resolveRecord(q,left),r=resolveRecord(q,right);
 const[session,setSession]=useState(()=>createMergeState(l.text,r.text));
 const[mode,setMode]=useState('new'),[name,setName]=useState('병합안'),[description,setDescription]=useState(''),[destination,setDestination]=useState(q.branches[0].id);
 const[error,setError]=useState(''),[conflict,setConflict]=useState(false),[confirm,setConfirm]=useState(false),[pending,setPending]=useState(null);
 function changeSource(side,key){
  if((side==='left'?left:right)===key)return;
  if(session.manual||Object.values(session.choices).some(Boolean)){setPending({side,key});return;}
  resetSource(side,key);
 }
 function resetSource(side,key){
  const nextLeft=side==='left'?key:left,nextRight=side==='right'?key:right;
  setLeft(nextLeft);setRight(nextRight);setSession(createMergeState(resolveRecord(q,nextLeft).text,resolveRecord(q,nextRight).text));setPending(null);setError('');
 }
 function finish(overwrite=false){
  try{
   const result=mergeDraft(q,{leftId:left,rightId:right,text:session.text,name,description,mode,branchId:destination,overwrite});
   onSave(result.question);navigate(`/write/${a.id}/${q.id}?record=${encodeURIComponent('snapshot:'+result.snapshotId)}`);
  }catch(e){if(e.message==='DRAFT_CONFLICT')setConflict(true);else setError(errorMessage(e));setConfirm(false);}
 }
 const choose=(id,side)=>setSession(current=>chooseMergeRegion(current,id,side));
 return <>
  <Header title="병합" subtitle={a.company} back="작성 화면" onBack={()=>navigate(`/write/${a.id}/${q.id}?record=${encodeURIComponent(left)}`)}><button className="button primary" onClick={()=>setConfirm(true)} disabled={!session.text.trim()}>병합하기</button></Header>
  <main className="merge-page">
   <div className="merge-title-row"><div className="question-heading"><h1>{q.prompt}</h1></div><small>바뀐 구절을 눌러 반영</small></div>
   {error&&<Notice type="error">{error}</Notice>}
   <div className="merge-columns">
    <section aria-label="왼쪽 본문"><div className="record-heading"><RecordSelect question={q} value={left} onChange={key=>changeSource('left',key)} label="기준 버전"/><small>{l.text.length.toLocaleString()}자</small></div><div className="merge-pane-body"><SourceText segments={session.segments} choices={session.choices} side="left" onChoose={choose}/></div></section>
    <section className="merge-result" aria-label="병합 결과"><div className="record-heading"><strong>결과</strong><small className={session.text.length>q.limit?'over-limit':''}>{session.text.length.toLocaleString()} / {q.limit.toLocaleString()}자</small></div><textarea className="body-editor" aria-label="결과 본문" value={session.text} onChange={e=>setSession(current=>editMergeText(current,e.target.value))} placeholder="좌우에서 남길 구절을 선택하세요." spellCheck={false}/></section>
    <section aria-label="오른쪽 본문"><div className="record-heading"><RecordSelect question={q} value={right} onChange={key=>changeSource('right',key)} label="병합할 버전"/><small>{r.text.length.toLocaleString()}자</small></div><div className="merge-pane-body"><SourceText segments={session.segments} choices={session.choices} side="right" onChoose={choose}/></div></section>
   </div>
  </main>
  {confirm&&<Modal title="병합하기" onClose={()=>setConfirm(false)}><form onSubmit={e=>{e.preventDefault();finish()}}><Field label="결과 위치"><select value={mode} onChange={e=>setMode(e.target.value)}><option value="new">새 분기에 병합</option><option value="existing">기존 분기에 병합</option></select></Field>{mode==='existing'?<Field label="분기"><select aria-label="병합할 분기" value={destination} onChange={e=>setDestination(e.target.value)}>{q.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>:<Field label="분기·스냅샷 이름"><input aria-label="병합 분기 이름" value={name} onChange={e=>setName(e.target.value)} maxLength={100}/></Field>}{mode==='existing'&&<Field label="스냅샷 이름"><input aria-label="병합 스냅샷 이름" value={name} onChange={e=>setName(e.target.value)} maxLength={100}/></Field>}<Field label="설명 · 선택"><textarea aria-label="병합 설명" value={description} onChange={e=>setDescription(e.target.value)} maxLength={2000} rows={3}/></Field><Notice>{mode==='new'||destination!==r.branchId?'오른쪽 원본 분기의 작성 중은 내용을 보존한 뒤 자동으로 닫습니다. ':''}결과는 병합 스냅샷으로 확정됩니다.</Notice><div className="form-actions"><button className="button" type="button" onClick={()=>setConfirm(false)}>취소</button><button className="button primary" type="submit">병합하기</button></div></form></Modal>}
  {conflict&&<Modal title="대상 분기에 초안이 있어요" onClose={()=>setConflict(false)}><p>대상 초안이 변경됩니다. 원문을 보존하려면 새 분기에 병합하세요.</p><div className="form-actions"><button className="button" onClick={()=>{setMode('new');setConflict(false);setConfirm(true)}}>새 분기로 변경</button><button className="button primary" onClick={()=>finish(true)}>초안을 바꾸고 병합</button></div></Modal>}
  {pending&&<Modal title="비교할 버전 변경" onClose={()=>setPending(null)}><p>선택한 구절과 직접 수정한 결과를 초기화하고 새 버전을 비교합니다.</p><div className="form-actions"><button className="button" onClick={()=>setPending(null)}>계속 편집</button><button className="button primary" onClick={()=>resetSource(pending.side,pending.key)}>버전 변경</button></div></Modal>}
 </>;
}
