import React,{useState} from 'react';
import {BackLink,Field,Notice,Modal} from '../components/UI.jsx';
import {RecordSelect} from './Editor.jsx';
import {createMergeState,chooseMergeRegion,editMergeText,appendMergeSource} from '../merge-state.js';
import {resolveRecord,errorMessage} from '../model.js';
import {combineWritingOptions} from '../writing-options.js';

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
 const[name,setName]=useState('합친 작성안'),[description,setDescription]=useState('');
 const[error,setError]=useState(''),[confirm,setConfirm]=useState(false),[pending,setPending]=useState(null);
 function changeSource(side,key){
  if((side==='left'?left:right)===key)return;
  if(session.manual||Object.values(session.choices).some(Boolean)){setPending({side,key});return;}
  resetSource(side,key);
 }
 function resetSource(side,key){
  const nextLeft=side==='left'?key:left,nextRight=side==='right'?key:right;
  setLeft(nextLeft);setRight(nextRight);setSession(createMergeState(resolveRecord(q,nextLeft).text,resolveRecord(q,nextRight).text));setPending(null);setError('');
 }
 function finish(){
  try{
   const result=combineWritingOptions(q,{leftId:left,rightId:right,text:session.text,name,description});
   onSave(result.question);navigate(`/write/${a.id}/${q.id}?record=${encodeURIComponent('snapshot:'+result.snapshotId)}`);
  }catch(e){setError(errorMessage(e));setConfirm(false);}
 }
 const choose=(id,side)=>setSession(current=>chooseMergeRegion(current,id,side));
 return <>
  <main className="merge-page">
   <BackLink className="page-back" to={`/write/${a.id}/${q.id}?record=${encodeURIComponent(left)}`}>작성 화면</BackLink>
   <div className="merge-title-row">
    <div><p className="merge-context">{a.company} · 작성안 합치기</p><div className="question-heading"><h1>{q.prompt}</h1></div></div>
    <div className="merge-title-actions">
     <small>바뀐 구절을 눌러 반영</small>
     <button className="button primary" onClick={()=>setConfirm(true)} disabled={!session.text.trim()}>합쳐서 새 작성안 만들기</button>
    </div>
   </div>
   {error&&<Notice type="error">{error}</Notice>}
   <div className="merge-columns">
    <section aria-label="왼쪽 본문"><div className="record-heading"><RecordSelect question={q} value={left} onChange={key=>changeSource('left',key)} label="기준 버전"/><small>{l.text.length.toLocaleString()}자</small></div><div className="merge-pane-body"><button className="text-button merge-add-source" aria-label="왼쪽 전체 본문 추가" disabled={!l.text.trim()} onClick={()=>setSession(current=>appendMergeSource(current,l.text))}>전체 본문 추가</button><SourceText segments={session.segments} choices={session.choices} side="left" onChoose={choose}/></div></section>
    <section className="merge-result" aria-label="새 작성안 본문"><div className="record-heading"><strong>결과</strong><small className={session.text.length>q.limit?'over-limit':''}>{session.text.length.toLocaleString()} / {q.limit.toLocaleString()}자</small></div><textarea className="body-editor" aria-label="결과 본문" value={session.text} onChange={e=>setSession(current=>editMergeText(current,e.target.value))} placeholder="좌우에서 남길 구절을 선택하세요." spellCheck={false}/></section>
    <section aria-label="오른쪽 본문"><div className="record-heading"><RecordSelect question={q} value={right} onChange={key=>changeSource('right',key)} label="함께 참고할 기록"/><small>{r.text.length.toLocaleString()}자</small></div><div className="merge-pane-body"><button className="text-button merge-add-source" aria-label="오른쪽 전체 본문 추가" disabled={!r.text.trim()} onClick={()=>setSession(current=>appendMergeSource(current,r.text))}>전체 본문 추가</button><SourceText segments={session.segments} choices={session.choices} side="right" onChoose={choose}/></div></section>
   </div>
  </main>
  {confirm&&<Modal title="합쳐서 새 작성안 만들기" onClose={()=>setConfirm(false)}><form onSubmit={e=>{e.preventDefault();finish()}}><Field label="작성안 이름"><input aria-label="새 작성안 이름" value={name} onChange={e=>setName(e.target.value)} maxLength={100}/></Field><Field label="설명 · 선택"><textarea aria-label="작성안 설명" value={description} onChange={e=>setDescription(e.target.value)} maxLength={2000} rows={3}/></Field><Notice>원본 두 본문은 그대로 두고 새 작성안과 첫 스냅샷을 만듭니다.</Notice><div className="form-actions"><button className="button" type="button" onClick={()=>setConfirm(false)}>취소</button><button className="button primary" type="submit">새 작성안 만들기</button></div></form></Modal>}
  {pending&&<Modal title="비교할 버전 변경" onClose={()=>setPending(null)}><p>선택한 구절과 직접 수정한 결과를 초기화하고 새 버전을 비교합니다.</p><div className="form-actions"><button className="button" onClick={()=>setPending(null)}>계속 편집</button><button className="button primary" onClick={()=>resetSource(pending.side,pending.key)}>버전 변경</button></div></Modal>}
 </>;
}
