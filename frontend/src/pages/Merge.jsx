import React,{useState} from 'react';
import {BackLink,Field,Notice,Modal} from '../components/UI.jsx';
import {RecordSelect} from './Editor.jsx';
import {createMergeState,chooseMergeRegion,chooseAllRegions,editMergeText,mergeHighlights} from '../merge-state.js';
import {VersionText,MergeDraft} from '../components/Diff.jsx';
import {resolveRecord,errorMessage} from '../model.js';
import {combineWritingOptions} from '../writing-options.js';

export default function Merge({application:a,question:q,query,navigate,onSave,essayTemplate}){
 const limit=essayTemplate ? q.templateLimit : q.limit;
 const first='draft:'+q.branches[0].id;
 const valid=key=>{try{resolveRecord(q,key);return key}catch{return first}};
 const[left,setLeft]=useState(valid(query.get('left')||first));
 const[right,setRight]=useState(valid(query.get('right')||('draft:'+(q.branches[1]?.id||q.branches[0].id))));
 const l=resolveRecord(q,left),r=resolveRecord(q,right);
 const[session,setSession]=useState(()=>createMergeState(l.text,r.text));
 const[name,setName]=useState('합친 버전'),[description,setDescription]=useState('');
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
 const choose=side=>id=>setSession(current=>chooseMergeRegion(current,id,side));
 const chooseAll=side=>setSession(current=>chooseAllRegions(current,side));
 return <>
  <main className="merge-page">
   <BackLink className="page-back" to={`/write/${a.id}/${q.id}?record=${encodeURIComponent(left)}`}>작성 화면</BackLink>
   <div className="merge-title-row">
    <div><p className="merge-context">{a.company} · 버전 합치기</p><div className="question-heading"><h1>{q.prompt}</h1></div></div>
    <div className="merge-title-actions">
     <small>달라진 부분을 누르면 결과에 반영, 다시 누르면 취소</small>
     <div className="merge-all"><button className="text-button" onClick={()=>chooseAll('left')}>왼쪽 전체</button><button className="text-button" onClick={()=>chooseAll('right')}>오른쪽 전체</button></div>
     <button className="button primary" onClick={()=>setConfirm(true)} disabled={!session.text.trim()}>합쳐서 새 버전 만들기</button>
    </div>
   </div>
   {error&&<Notice type="error">{error}</Notice>}
   <div className="merge-columns">
    <section aria-label="왼쪽 본문"><div className="record-heading"><RecordSelect question={q} value={left} onChange={key=>changeSource('left',key)} label="기준 버전"/><small>{l.text.length.toLocaleString()}자</small></div><div className="merge-pane-body"><VersionText state={session} side="left" onChoose={choose('left')}/></div></section>
    <section className="merge-result" aria-label="새 버전 본문"><div className="record-heading"><strong>결과</strong><small className={limit!=null&&session.text.length>limit?'over-limit':''}>{session.text.length.toLocaleString()}{limit==null?'':' / '+limit.toLocaleString()}자</small></div><MergeDraft label="결과 본문" text={session.text} onChange={text=>setSession(current=>editMergeText(current,text))} highlights={mergeHighlights(session)} flash={session.last} placeholder="좌우에서 남길 부분을 누르세요."/></section>
    <section aria-label="오른쪽 본문"><div className="record-heading"><RecordSelect question={q} value={right} onChange={key=>changeSource('right',key)} label="함께 참고할 기록"/><small>{r.text.length.toLocaleString()}자</small></div><div className="merge-pane-body"><VersionText state={session} side="right" onChoose={choose('right')}/></div></section>
   </div>
  </main>
  {confirm&&<Modal title="합쳐서 새 버전 만들기" onClose={()=>setConfirm(false)}><form onSubmit={e=>{e.preventDefault();finish()}}><Field label="버전 이름"><input aria-label="새 버전 이름" value={name} onChange={e=>setName(e.target.value)} maxLength={100}/></Field><Field label="설명 · 선택"><textarea aria-label="버전 설명" value={description} onChange={e=>setDescription(e.target.value)} maxLength={2000} rows={3}/></Field><Notice>원본 두 본문은 그대로 두고 새 버전과 첫 스냅샷을 만듭니다.</Notice><div className="form-actions"><button className="button" type="button" onClick={()=>setConfirm(false)}>취소</button><button className="button primary" type="submit">새 버전 만들기</button></div></form></Modal>}
  {pending&&<Modal title="비교할 버전 변경" onClose={()=>setPending(null)}><p>선택한 구절과 직접 수정한 결과를 초기화하고 새 버전을 비교합니다.</p><div className="form-actions"><button className="button" onClick={()=>setPending(null)}>계속 편집</button><button className="button primary" onClick={()=>resetSource(pending.side,pending.key)}>버전 변경</button></div></Modal>}
 </>;
}
