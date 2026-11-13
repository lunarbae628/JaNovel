import React,{useMemo,useState} from 'react';
import {Merge as MergeIcon,Camera,Columns2,Copy,Plus,ArrowLeft,Trash2} from 'lucide-react';
import {Header,ApplyLink,IconButton,PanelGlyph,Modal,RecordForm,Notice,copyText} from '../components/UI.jsx';
import PanelResizer from '../components/PanelResizer.jsx';
import OptionHistory from '../components/OptionHistory.jsx';
import VersionGraph from '../components/VersionGraph.jsx';
import {optionView,comparisonSearch} from '../option-route.js';
import {createWritingOption,renameWritingOption,editOptionSnapshot,optionSources} from '../writing-options.js';
import AIChat from '../components/AIChat.jsx';
import {ComparisonSource,ComparisonDraft} from '../components/Diff.jsx';
import {comparisonSegments,takeReferenceChange} from '../comparison.js';
import {resolveRecord,updateDraft,snapshot,activateBranch,errorMessage,safeUrl,parseKey,defaultRecordKey} from '../model.js';
import {canDeleteSnapshot,deleteSnapshot,deleteBranch} from '../history-actions.js';

export function RecordSelect({question:q,value,onChange,label='비교할 버전'}){return <select className="record-select" aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>{q.branches.map(b=><optgroup key={b.id} label={b.name}><option value={'draft:'+b.id}>{b.draft.closed||!b.draft.dirty?'마지막 본문':'작성 중'} · {b.name}</option>{q.snapshots.filter(s=>s.branchId===b.id).map(s=><option key={s.id} value={'snapshot:'+s.id}>{b.name} · {s.label} · {s.title}</option>)}</optgroup>)}</select>}
export default function Editor({application:a,question:q,navigate,onSave,onPreferences,preferences,query}){
 const valid=key=>{try{resolveRecord(q,key);return true}catch{return false}};
 const view=optionView(q,query),initialBranch=view.branchId,initialKey=view.key,initialRecord=resolveRecord(q,initialKey);
 const[workingId,setWorkingId]=useState(initialBranch);
 const[selected,setSelected]=useState(initialKey);
 const[referenceKey,setReferenceKey]=useState(initialKey);
 const[mode,setMode]=useState(view.comparing?'compare':initialRecord.kind==='snapshot'?'read':'write');
 const[target,setTarget]=useState(view.target),[aiReference,setAiReference]=useState(null);
 const[leftOpen,setLeftOpen]=useState(true),[rightOpen,setRightOpen]=useState(true),[overviewOpen,setOverviewOpen]=useState(false),[overviewWidth,setOverviewWidth]=useState(()=>Math.max(preferences.leftWidth||240,480));
 const[modal,setModal]=useState(''),[error,setError]=useState(''),[pending,setPending]=useState(''),[copied,setCopied]=useState(false);
 const[deletingBranch,setDeletingBranch]=useState(null),[renamingId,setRenamingId]=useState(null),[sourcePreview,setSourcePreview]=useState(null);
 const activeId=q.branches.some(b=>b.id===workingId)?workingId:q.branches[0].id;
 const work=resolveRecord(q,'draft:'+activeId),activeBranch=q.branches.find(b=>b.id===activeId),sources=optionSources(q,activeId),renaming=q.branches.find(b=>b.id===renamingId);
 const record=resolveRecord(q,valid(selected)?selected:'draft:'+activeId);
 const source=aiReference?{kind:'suggestion',label:'AI 수정안',title:'AI 수정안',text:aiReference.candidate,id:aiReference.id}:valid(referenceKey)?resolveRecord(q,referenceKey):record;
 const right=resolveRecord(q,valid(target)?target:'draft:'+activeId),comparing=mode==='compare';
 const parts=useMemo(()=>comparisonSegments(source.text,right.text),[source.text,right.text]);
 const qi=a.questions.findIndex(n=>n.id===q.id),lw=preferences.leftWidth||240,rw=preferences.rightWidth||320;
 function rememberWorkUrl(id,force=false){
  const [path,search='']=location.hash.slice(1).split('?'),params=new URLSearchParams(search),current=params.get('record');
  if(!force&&current&&parseKey(current).kind!=='draft')return;
  params.set('record','draft:'+id);if(force){params.delete('compare');params.delete('target');}
  history.replaceState(null,'',location.pathname+location.search+'#'+path+'?'+params.toString());
 }
 function rememberRecordUrl(key){const [path,search='']=location.hash.slice(1).split('?'),params=new URLSearchParams(search);params.set('record',key);params.delete('compare');params.delete('target');history.replaceState(null,'',location.pathname+location.search+'#'+path+'?'+params.toString());}
 function rememberComparison(reference,target){const [path,search='']=location.hash.slice(1).split('?');history.replaceState(null,'',location.pathname+location.search+'#'+path+'?'+comparisonSearch(search,reference,target));}
 function chooseBranch(id){
  const key=defaultRecordKey(q,id);setWorkingId(id);setTarget('draft:'+id);onSave(current=>activateBranch(current,id));setError('');
  rememberRecordUrl(key);setSelected(key);setReferenceKey(key);setMode(key.startsWith('snapshot:')?'read':'write');setAiReference(null);
 }
 function select(key){
  const next=resolveRecord(q,key);setError('');setAiReference(null);
  if(next.kind==='draft'){chooseBranch(next.id);return;}
  setSelected(key);setReferenceKey(key);setMode(comparing?'compare':'read');if(comparing)rememberComparison(key,target);else rememberRecordUrl(key);
 }
 function selectOverview(key){const next=resolveRecord(q,key);setWorkingId(next.branchId);setTarget('draft:'+next.branchId);onSave(current=>activateBranch(current,next.branchId));setSelected(key);setReferenceKey(key);setMode(next.kind==='draft'?'write':'read');setAiReference(null);setError('');rememberRecordUrl(key);}
 function returnToWrite(){chooseBranch(activeId);}
 function openCompare(){
  if(comparing){returnToWrite();return;}
  const other=q.branches.find(b=>b.id!==activeId),key=record.kind==='snapshot'?selected:valid(referenceKey)&&referenceKey!=='draft:'+activeId?referenceKey:other?defaultRecordKey(q,other.id):q.snapshots.length?'snapshot:'+q.snapshots.at(-1).id:'draft:'+activeId;
  if(!key){setError('비교할 기록이 없어요. 스냅샷을 남기거나 AI 수정안을 추가해 주세요.');return;}
  setReferenceKey(key);setSelected(key);setTarget('draft:'+activeId);setMode('compare');setAiReference(null);setError('');rememberComparison(key,'draft:'+activeId);
 }
 function changeTarget(key){setTarget(key);rememberComparison(referenceKey,key);const id=resolveRecord(q,key).branchId;setWorkingId(id);onSave(current=>activateBranch(current,id));}
 function changeReference(key){rememberComparison(key,target);setReferenceKey(key);setSelected(key);setAiReference(null);setError('');}
 function acceptEdit(next,id,originId){
  const existing=next.branches.find(b=>b.id===id);
  if(!existing){const origin=next.snapshots.find(s=>s.id===originId);const key='snapshot:'+origin.id;onSave(activateBranch(next,origin.branchId));setWorkingId(origin.branchId);setSelected(key);setReferenceKey(key);setTarget('draft:'+origin.branchId);setMode('read');setAiReference(null);rememberRecordUrl(key);}
  else{const key=defaultRecordKey(next,id);onSave(activateBranch(next,id));setWorkingId(id);setTarget('draft:'+id);if(!comparing){setSelected(key);setMode(key.startsWith('snapshot:')?'read':'write');if(key.startsWith('snapshot:'))setReferenceKey(key);rememberRecordUrl(key);}}
  setError('');
 }
 function writeDraft(text){const id=comparing?right.id:activeId,b=q.branches.find(b=>b.id===id);acceptEdit(updateDraft(q,id,text),id,b.autoFromId);}
 function take(id){writeDraft(takeReferenceChange(source.text,right.text,id));}
 function editRecord(text,asNew=false){
  try{
   if(asNew){let next=createWritingOption(q,activeBranch.name+' 다른 안');const id=next.activeBranchId;next=updateDraft(next,id,text);acceptEdit(next,id);}
   else{const next=editOptionSnapshot(q,record.id,text);if(next!==q)acceptEdit(next,record.branchId,record.id);}
  }catch(e){if(e.message==='DRAFT_CONFLICT'){setPending(text);setModal('conflict');}else setError(errorMessage(e));}
 }
 function addOption(name,description){
  const next=createWritingOption(q,name,description),id=next.activeBranchId;rememberWorkUrl(id,true);onSave(next);setWorkingId(id);setSelected('draft:'+id);setTarget('draft:'+id);setReferenceKey('draft:'+id);setMode('write');setAiReference(null);setModal('');setError('');
 }
 function advancedMerge(){
  if(aiReference)return;
  const from=comparing?referenceKey:mode==='read'?selected:'draft:'+activeId;
  const other=q.branches.find(b=>b.id!==resolveRecord(q,from).branchId);
  const to=comparing?target:other?defaultRecordKey(q,other.id):'draft:'+activeId;
  navigate(`/merge/${a.id}/${q.id}?left=${encodeURIComponent(from)}&right=${encodeURIComponent(to)}`);
 }
 function compareCandidate(message){setAiReference(message);setTarget('draft:'+activeId);setMode('compare');setError('');}
 async function copyBody(){try{await copyText(mode==='write'?work.text:comparing?source.text:record.text);setCopied(true);setTimeout(()=>setCopied(false),1500)}catch{setError('복사하지 못했어요. 브라우저 권한을 확인해 주세요.')}}
 const shown=mode==='write'?work:comparing?source:record;
 const deletable=shown.kind==='snapshot'&&canDeleteSnapshot(q,shown.id);
 const branchToDelete=q.branches.find(b=>b.id===deletingBranch);
 function applyCleanup(next){
  const bid=next.branches.some(b=>b.id===activeId)?activeId:next.branches[0].id;
  const key=defaultRecordKey(next,bid);
  const [path,search='']=location.hash.slice(1).split('?'),params=new URLSearchParams(search);params.set('record',key);params.delete('compare');
  history.replaceState(null,'',location.pathname+location.search+'#'+path+'?'+params.toString());
  onSave(activateBranch(next,bid));setWorkingId(bid);setSelected(key);setReferenceKey(key);setTarget('draft:'+bid);setMode(key.startsWith('snapshot:')?'read':'write');setAiReference(null);setError('');setModal('');
 }
 function removeSnapshot(){try{applyCleanup(deleteSnapshot(q,shown.id));}catch(e){setError(errorMessage(e));setModal('');}}
 function removeBranch(){try{applyCleanup(deleteBranch(q,deletingBranch));}catch(e){setError(errorMessage(e));setModal('');}}
 return <div className="editor-page">
  <Header title={a.company} subtitle={a.role} back="지원 현황" onBack={()=>navigate('/applications')}><button className="text-button" onClick={()=>navigate('/application/'+a.id)}>공고 정보</button><ApplyLink url={safeUrl(a.url)} onMissing={()=>navigate('/posting/'+a.id)}/></Header>
  <div className={'editor-layout '+(overviewOpen?'overview-open ':'')+(!leftOpen?'left-closed ':'')+(!rightOpen?'right-closed':'')} style={{'--left-width':(overviewOpen?overviewWidth:lw)+'px','--overview-width':overviewWidth+'px','--right-width':rw+'px'}}>
   <aside className="history-panel" id="history-panel"><div className="panel-toolbar option-panel-toolbar"><div><IconButton label={overviewOpen?'작성안별 기록 보기':'전체 버전 그래프'} aria-pressed={overviewOpen} onClick={()=>{setOverviewOpen(!overviewOpen);setLeftOpen(true)}}><PanelGlyph kind={overviewOpen?'shrink':'expand'}/></IconButton><IconButton label={leftOpen?'왼쪽 패널 접기':'왼쪽 패널 펼치기'} onClick={()=>setLeftOpen(!leftOpen)}><PanelGlyph kind={leftOpen?'left':'right'}/></IconButton></div></div>{leftOpen&&(overviewOpen?<VersionGraph question={q} selected={selected} onSelect={selectOverview} onPreview={setSourcePreview} expanded/>:<OptionHistory question={q} activeId={activeId} selected={selected} onChoose={chooseBranch} onSelect={select} onAdd={()=>setModal('option')} onRename={id=>{setRenamingId(id);setModal('rename-option')}}/>)}</aside>
   {leftOpen&&<PanelResizer side="left" value={overviewOpen?overviewWidth:lw} min={200} max={620} controls="history-panel" onChange={v=>overviewOpen?setOverviewWidth(v):onPreferences({...preferences,leftWidth:v})}/>}

   <main className="writing-panel"><div className="editor-toolbar"><nav className="question-tabs">{a.questions.map((n,i)=><button key={n.id} className={n.id===q.id?'active':''} onClick={()=>navigate('/write/'+a.id+'/'+n.id)}>Q{i+1}</button>)}<IconButton label="문항 추가·수정" onClick={()=>navigate('/posting/'+a.id)}><Plus size={16}/></IconButton></nav>
    <div className="editor-actions">{(comparing||(mode==='read'&&selected!==defaultRecordKey(q,activeId)))&&<button className="text-button return-writing" onClick={returnToWrite}><ArrowLeft size={14}/>작성으로</button>}{!comparing&&<button className="text-button compare-action" onClick={openCompare}><Columns2 size={16}/>{mode==='read'?'작성 중과 비교':'다른 안과 비교'}</button>}
     <IconButton label="새 작성안" onClick={()=>{setError('');setModal('option')}}><Plus size={18}/></IconButton><IconButton label="합쳐서 새 작성안 만들기" disabled={!!aiReference} onClick={advancedMerge}><MergeIcon size={18} className="downward-icon flow-action-icon"/></IconButton>
     <button className="button small primary snapshot-action" disabled={mode==='read'||(comparing&&right.kind!=='draft')||!activeBranch.draft.dirty||!work.text.trim()} onClick={()=>{setError('');setModal('snapshot')}}><Camera size={15}/>스냅샷</button>
    </div></div>
    <div className="writing-content"><div className="question-heading"><h1>{q.prompt}</h1>{!comparing&&<span className={shown.text.length>q.limit?'over-limit':''}>{shown.text.length.toLocaleString()} / {q.limit.toLocaleString()}자</span>}</div>{error&&<Notice type="error">{error}</Notice>}{comparing&&<p className="comparison-hint">{right.kind==='draft'?'바뀐 구절을 누르면 오른쪽 작성안에 반영됩니다.':'스냅샷끼리 비교 중'}</p>}
     {!comparing&&sources.length>0&&<div className="option-sources"><span>참고한 작성안</span>{sources.map((item,i)=><button key={i} onClick={()=>setSourcePreview(item)}>{item.optionName} · {item.label}</button>)}</div>}
     <div className={'body-columns '+(comparing?'comparing':'')}>
      <section className="body-column"><div className="record-heading"><div>
       {comparing?(aiReference?<strong>AI 수정안</strong>:<RecordSelect question={q} value={referenceKey} onChange={changeReference} label="참고할 기록"/>):<strong>{mode==='write'?(activeBranch.snapshotIds.length?work.label:'본문'):record.label+' · '+record.title}</strong>}
       {mode==='write'?<div className="record-context"><select aria-label="작성할 작성안" value={activeId} onChange={e=>chooseBranch(e.target.value)}>{q.branches.map(b=><option key={b.id} value={b.id}>{b.name} · {b.draft.closed||!b.draft.dirty?'스냅샷':'작성 중'}</option>)}</select></div>:!comparing&&<small title={record.description}>{q.branches.find(b=>b.id===record.branchId)?.name}{record.description?' · '+record.description:''}</small>}
      </div>{comparing&&<small>{source.text.length.toLocaleString()}자</small>}<IconButton label="본문 복사" onClick={copyBody}><Copy size={14}/></IconButton>{shown.kind==='snapshot'&&<IconButton label={deletable?'스냅샷 삭제':'스냅샷 삭제 · 뒤에 이어진 기록이나 분기를 먼저 삭제하세요'} disabled={!deletable} onClick={()=>setModal('delete-snapshot')}><Trash2 size={15}/></IconButton>}</div>
       {copied&&<small className="copy-notice" role="status">복사했어요</small>}
       {comparing?<><ComparisonSource segments={parts} onTake={right.kind==='draft'?take:undefined}/></>:mode==='write'?<textarea className="body-editor" aria-label="자소서 본문" value={work.text} onChange={e=>writeDraft(e.target.value)} placeholder="본문을 작성하세요." spellCheck={false}/>:<textarea className="body-editor" aria-label="자소서 본문" value={record.text} onChange={e=>editRecord(e.target.value)} spellCheck={false}/>}
      </section>
      {comparing&&<section className="body-column current-draft-column"><div className="record-heading"><RecordSelect question={q} value={target} onChange={changeTarget} label="비교 대상"/><small>{right.text.length.toLocaleString()} / {q.limit.toLocaleString()}자</small></div>{right.kind==='draft'?<ComparisonDraft text={right.text} onChange={writeDraft}/>:<><button className="text-button snapshot-edit-action" onClick={()=>changeTarget('draft:'+right.branchId)}>이 작성안 편집</button><textarea className="body-editor" aria-label="비교 대상 본문" value={right.text} readOnly/></>}</section>}

     </div>
    </div>
   </main>
   {rightOpen&&<PanelResizer side="right" value={rw} min={260} max={500} controls="chat-panel" onChange={v=>onPreferences({...preferences,rightWidth:v})}/>}
   <aside className="chat-panel" id="chat-panel"><div className="panel-toolbar"><IconButton label={rightOpen?'AI 채팅 접기':'AI 채팅 펼치기'} onClick={()=>setRightOpen(!rightOpen)}><PanelGlyph kind={rightOpen?'right':'left'}/></IconButton>{rightOpen&&<><strong>AI 채팅</strong><small>Q{qi+1}</small></>}</div>{rightOpen&&<AIChat key={q.id} question={q} application={a} record={mode==='read'?record:work} onSave={onSave} onCandidate={compareCandidate}/>}</aside>
  </div>
  {modal==='snapshot'&&<Modal title="스냅샷" onClose={()=>setModal('')}><p className="snapshot-context">{activeBranch.name} · 현재 초안 {work.text.length.toLocaleString()}자</p><RecordForm title="스냅샷 이름" submitLabel="스냅샷 만들기" onCancel={()=>setModal('')} onSubmit={(name,desc)=>{try{applyCleanup(snapshot(q,activeId,name,desc));}catch(e){setError(errorMessage(e));setModal('')}}}/></Modal>}
  {modal==='option'&&<Modal title="새 작성안" onClose={()=>setModal('')}><RecordForm title="예: 데이터 정합성 경험" onCancel={()=>setModal('')} onSubmit={addOption}/></Modal>}
  {modal==='rename-option'&&renaming&&<Modal title="작성안 수정" onClose={()=>setModal('')}><RecordForm title="작성안 이름" defaultName={renaming.name} defaultDescription={renaming.description} submitLabel="수정" onCancel={()=>setModal('')} onSubmit={(name,description)=>{onSave(renameWritingOption(q,renaming.id,name,description));setModal('')}}/><button className="text-button option-delete" disabled={q.branches.length===1} onClick={()=>{setDeletingBranch(renaming.id);setModal('delete-branch')}}>작성안 삭제</button></Modal>}

  {sourcePreview&&<Modal title={sourcePreview.optionName+' · '+sourcePreview.label} onClose={()=>setSourcePreview(null)}><small className="muted">조합할 때 참고한 본문</small><p className="document-body source-preview">{sourcePreview.text}</p></Modal>}

  {modal==='conflict'&&<Modal title="작성 중인 초안이 있어요" onClose={()=>setModal('')}><p>기존 초안을 이어 쓰거나, 방금 수정한 내용을 새 안으로 남길 수 있어요.</p><div className="form-actions"><button className="button" onClick={()=>{setModal('');chooseBranch(record.branchId)}}>기존 초안 열기</button><button className="button primary" onClick={()=>{editRecord(pending,true);setModal('')}}>새 안으로 이어 쓰기</button></div></Modal>}
  {modal==='delete-snapshot'&&<Modal title="스냅샷 삭제" onClose={()=>setModal('')}><p>{shown.label} · {shown.title}</p><Notice>이 스냅샷을 삭제합니다. 현재 초안 본문은 남으며 삭제한 스냅샷은 복구할 수 없습니다.</Notice><div className="form-actions"><button className="button" onClick={()=>setModal('')}>취소</button><button className="button danger" onClick={removeSnapshot}>스냅샷 삭제</button></div></Modal>}
  {modal==='delete-branch'&&branchToDelete&&<Modal title="작성안 삭제" onClose={()=>setModal('rename-option')}><p><strong>{branchToDelete.name}</strong> 작성안의 스냅샷 {branchToDelete.snapshotIds.length}개와 {branchToDelete.draft.closed?'보관된 마지막 본문':'작성 중인 초안'}을 삭제합니다.</p><Notice>복구할 수 없습니다. 다른 작성안의 본문과 제출본은 유지됩니다. 합칠 때 보관한 참고 본문도 남습니다.</Notice><div className="form-actions"><button className="button" onClick={()=>setModal('rename-option')}>취소</button><button className="button danger" onClick={removeBranch}>작성안 삭제</button></div></Modal>}
 </div>;
}
