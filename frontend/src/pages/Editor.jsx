import React,{lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {Merge as MergeIcon,Camera,Columns2,Copy,Plus,ArrowLeft,Trash2,History,MessagesSquare,FileText,Download,Mic,Info,Star} from 'lucide-react';
import {BackLink,ApplyLink,IconButton,PanelGlyph,Modal,RecordForm,Field,Notice,copyText} from '../components/UI.jsx';
import Dropdown from '../components/Dropdown.jsx';
import PanelResizer from '../components/PanelResizer.jsx';
import OptionHistory from '../components/OptionHistory.jsx';
import VersionGraph from '../components/VersionGraph.jsx';
import {optionView,comparisonSearch} from '../option-route.js';
import {createWritingOption,renameWritingOption,editOptionSnapshot,optionSources} from '../writing-options.js';
import AIChat from '../components/AIChat.jsx';
import {ComparisonSource,ComparisonDraft} from '../components/Diff.jsx';
import {comparisonSegments,takeReferenceChange} from '../comparison.js';
import {resolveRecord,updateDraft,snapshot,activateBranch,errorMessage,safeUrl,parseKey,defaultRecordKey,designateQuestionSubmission,reviseQuestionSubmission,recordKey} from '../model.js';
import {canDeleteSnapshot,deleteSnapshot,deleteBranch} from '../history-actions.js';

const EssayPdf = lazy(() => import('../components/EssayPdf.jsx'));
const compactViews = [
 ['writing', '본문', FileText, 'writing-panel'],
 ['history', '버전', History, 'history-panel'],
 ['chat', 'AI 채팅', MessagesSquare, 'chat-panel'],
];

export function RecordSelect({question, value, onChange, label = '비교할 버전', field = false}) {
 const options = question.branches.map(branch => ({
  label: branch.name,
  options: [
   {value: 'draft:' + branch.id, label: branch.name + ' · ' + (branch.draft.closed || !branch.draft.dirty ? '마지막 본문' : '작성 중')},
   ...question.snapshots.filter(item => item.branchId === branch.id).map(item => ({
    value: 'snapshot:' + item.id, label: branch.name + ' · ' + item.label + ' · ' + item.title,
   })),
  ],
 }));
 return <Dropdown className="record-select" label={label} value={value} options={options} onChange={onChange} field={field}/>;
}

export function QuestionSubmissions({application, currentQuestion, initialKey, onSave, onClose}) {
 const [exporting,setExporting]=useState(false);
 if(exporting)return <Suspense fallback={null}><EssayPdf application={application}
  currentQuestionId={currentQuestion.id} onClose={()=>setExporting(false)}/></Suspense>;
 return <QuestionSubmissionDialog application={application} currentQuestion={currentQuestion}
  initialKey={initialKey} onSave={onSave} onClose={onClose} onExport={()=>setExporting(true)}/>;
}

function QuestionSubmissionDialog({application, currentQuestion, initialKey, onSave, onExport, onClose}) {
 const [editing,setEditing]=useState(null);
 const form=useRef(null);
 const closeButton=useRef(null);
 const editingId=editing?.questionId;
 const editingMode=editing?.mode;
 const confirming=editing?.confirming;
 const hasSubmissions=application.questions.some(question=>question.submissionHistory?.length);

 useEffect(()=>{
  if(editingId){
   const selector=confirming?'[data-cancel-replacement]':editingMode==='write'?'textarea':'.dropdown-trigger';
   form.current?.querySelector(selector)?.focus();
  }
 },[editingId,editingMode,confirming]);

 function stopEditing() {
  setEditing(null);
  closeButton.current?.focus();
 }

 function start(question, recent) {
  setEditing({
   questionId:question.id, mode:recent?'write':'choose', error:'', confirming:false,
   key:question.id===currentQuestion.id&&initialKey?initialKey:defaultRecordKey(question,question.activeBranchId||question.branches[0].id),
   text:recent?.text||'',
  });
 }

 function save(event,question,recent,preview) {
  event.preventDefault();
  if(preview&&recent&&!editing.confirming){
   setEditing({...editing,confirming:true});
   return;
  }
  try {
   const next=editing.mode==='write'
    ? reviseQuestionSubmission(question,editing.text)
    : designateQuestionSubmission(question,editing.key);
   if(next!==question){
    const answer=next.submissionHistory.at(-1);
    onSave(current=>({...current,submissionHistory:[...(current.submissionHistory||[]),answer]}),question.id);
   }
   stopEditing();
  } catch(problem){setEditing({...editing,error:errorMessage(problem)});}
 }

 return <Modal title="자소서 제출본" className="essay-submissions-modal" onClose={onClose}>
  <div className="essay-submission-list">
   {application.questions.map((question,index)=>{
    const recent=question.submissionHistory?.at(-1);
    const active=editingId===question.id;
    const writing=active&&editingMode==='write';
    const preview=active&&!writing?resolveRecord(question,editing.key):null;
    const sameVersion=preview&&recent?.source.kind===preview.kind&&recent.source.id===preview.id&&recent.text===preview.text;
    const updateEditing=patch=>setEditing({...editing,confirming:false,error:'',...patch});
    return <section className="essay-submission-section" key={question.id}>
     <div className="essay-submission-heading">
      <h3><small>Q{index+1}</small> {recent?.prompt||question.prompt}</h3>
      {!active&&<button type="button" className="button small" disabled={!!editing} onClick={()=>start(question,recent)}>
       {recent?'제출본 수정':'제출본 지정'}
      </button>}
     </div>
     {active?<form ref={form} onSubmit={event=>save(event,question,recent,preview)}>
      {writing?<Field label={'Q'+(index+1)+' 제출본 본문'}>
       <textarea value={editing.text} rows={7} onChange={event=>updateEditing({text:event.target.value})}/>
      </Field>:<>
       <RecordSelect question={question} label="제출할 버전" value={editing.key} field
        onChange={key=>updateEditing({key})}/>
       <p className="essay-submission-preview">{preview.text||'선택한 버전의 본문이 비어 있어요.'}</p>
      </>}
      {confirming&&<Notice>이 문항의 현재 제출본을 선택한 버전의 본문으로 교체할까요?</Notice>}
      {editing.error&&<Notice type="error">{editing.error}</Notice>}
      <div className="form-actions">
       {recent&&!confirming&&<button type="button" className="text-button" onClick={()=>updateEditing({mode:writing?'choose':'write'})}>
        {writing?'버전 선택':'본문 수정'}
       </button>}
       {confirming
        ? <button type="button" className="button" data-cancel-replacement onClick={()=>updateEditing({})}>교체 취소</button>
        : <button type="button" className="button" onClick={stopEditing}>취소</button>}
       <button key={String(confirming)} className="button primary"
        disabled={writing?(!editing.text.trim()||editing.text===recent.text):(!preview.text.trim()||sameVersion)}>
        {writing?'수정 저장':confirming?'제출본 교체':'제출본으로 지정'}
       </button>
      </div>
     </form>:recent?<>
      <div className="essay-submission-meta">{recent.text.length.toLocaleString()} / {recent.limit.toLocaleString()}자</div>
      <p className="essay-submission-preview essay-submission-current">{recent.text}</p>
     </>:<p className="essay-submission-empty">지정된 제출본이 없어요.</p>}
    </section>;
   })}
  </div>
  <div className="form-actions essay-submission-controls">
   <button type="button" className="button" ref={closeButton} onClick={onClose}>닫기</button>
   <button type="button" className="button primary" disabled={!hasSubmissions||!!editing} onClick={onExport}>
    <Download size={15} aria-hidden="true"/>내보내기
   </button>
  </div>
 </Modal>;
}

export default function Editor({application:a,question:q,navigate,onSave,onPreferences,preferences,query}){
 const valid=key=>{try{resolveRecord(q,key);return true}catch{return false}};
 const view=optionView(q,query),initialBranch=view.branchId,initialKey=view.key,initialRecord=resolveRecord(q,initialKey);
 const[workingId,setWorkingId]=useState(initialBranch);
 const[selected,setSelected]=useState(initialKey);
 const[referenceKey,setReferenceKey]=useState(initialKey);
 const[mode,setMode]=useState(view.comparing?'compare':initialRecord.kind==='snapshot'?'read':'write');
 const[target,setTarget]=useState(view.target),[aiReference,setAiReference]=useState(null);
 const[leftOpen,setLeftOpen]=useState(true),[rightOpen,setRightOpen]=useState(true),[overviewOpen,setOverviewOpen]=useState(false),[overviewWidth,setOverviewWidth]=useState(()=>Math.max(preferences.leftWidth||240,480));
 const[compactView,setCompactView]=useState('writing');
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
 const submission=q.submissionHistory?.at(-1);
 const isCurrentSubmission=submission?.source.kind===shown.kind&&submission.source.id===shown.id&&submission.text===shown.text;

 function designateShown(confirmed=false) {
  if(isCurrentSubmission||!shown.text.trim())return;
  if(submission&&!confirmed){
   setModal('replace-submission');
   return;
  }
  try{
   const answer=designateQuestionSubmission(q,recordKey(shown)).submissionHistory.at(-1);
   onSave(current=>({...current,submissionHistory:[...(current.submissionHistory||[]),answer]}));
   setError('');
   setModal('');
  }catch(problem){setError(errorMessage(problem));setModal('');}
 }
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
  <nav className="editor-view-switch" aria-label="작성 화면 보기">
   <a className="editor-mobile-back" href="#/applications" aria-label="지원 현황"><ArrowLeft size={16} aria-hidden="true"/></a>
   {compactViews.map(([view,label,Icon,panel])=><button type="button" key={view} aria-pressed={compactView===view} aria-controls={panel} onClick={()=>{
    setCompactView(view);
    if(view==='history')setLeftOpen(true);
    if(view==='chat')setRightOpen(true);
   }}><Icon size={16} strokeWidth={1.7}/>{label}</button>)}
  </nav>
  <div className={'editor-layout '+(overviewOpen?'overview-open ':'')+(!leftOpen?'left-closed ':'')+(!rightOpen?'right-closed':'')} data-compact-view={compactView} style={{'--left-width':(overviewOpen?overviewWidth:lw)+'px','--overview-width':overviewWidth+'px','--right-width':rw+'px'}}>
   <aside className="history-panel" id="history-panel">
    <div className="panel-toolbar option-panel-toolbar">
     <BackLink className="editor-applications-link" to="/applications"><span className={leftOpen?undefined:'visually-hidden'}>지원 현황</span></BackLink>
     <div><IconButton label={overviewOpen?'버전별 기록 보기':'전체 버전 그래프'} aria-pressed={overviewOpen} onClick={()=>{setOverviewOpen(!overviewOpen);setLeftOpen(true)}}><PanelGlyph kind={overviewOpen?'shrink':'expand'}/></IconButton><IconButton label={leftOpen?'왼쪽 패널 접기':'왼쪽 패널 펼치기'} onClick={()=>setLeftOpen(!leftOpen)}><PanelGlyph kind={leftOpen?'left':'right'}/></IconButton></div>
    </div>
    {leftOpen&&(overviewOpen?<VersionGraph question={q} selected={selected} onSelect={key=>{selectOverview(key);setCompactView('writing')}} onPreview={setSourcePreview} expanded/>:<OptionHistory question={q} activeId={activeId} selected={selected} onChoose={id=>{chooseBranch(id);setCompactView('writing')}} onSelect={key=>{select(key);setCompactView('writing')}} onAdd={()=>setModal('option')} onRename={id=>{setRenamingId(id);setModal('rename-option')}}/>)}
   </aside>
   {leftOpen&&<PanelResizer side="left" value={overviewOpen?overviewWidth:lw} min={200} max={620} controls="history-panel" onChange={v=>overviewOpen?setOverviewWidth(v):onPreferences({...preferences,leftWidth:v})}/>}

   <main className="writing-panel" id="writing-panel"><div className="editor-toolbar"><nav className="question-tabs" aria-label="자소서 문항">{a.questions.map((n,i)=><button key={n.id} className={n.id===q.id?'active':''} aria-current={n.id===q.id?'page':undefined} onClick={()=>navigate('/write/'+a.id+'/'+n.id)}>Q{i+1}</button>)}<IconButton label="문항 추가·수정" onClick={()=>navigate('/posting/'+a.id)}><Plus size={16}/></IconButton></nav>
    <div className="editor-actions">{(comparing||(mode==='read'&&selected!==defaultRecordKey(q,activeId)))&&<button className="text-button return-writing" onClick={returnToWrite}><ArrowLeft size={14}/>작성으로</button>}{!comparing&&<button className="text-button compare-action" onClick={openCompare}><Columns2 size={16}/>{mode==='read'?'작성 중과 비교':'다른 버전과 비교'}</button>}
     <IconButton label="새 버전" onClick={()=>{setError('');setModal('option')}}><Plus size={18}/></IconButton><IconButton label="합쳐서 새 버전 만들기" disabled={!!aiReference} onClick={advancedMerge}><MergeIcon size={18} className="downward-icon flow-action-icon"/></IconButton>
     <button className="button small primary snapshot-action" disabled={mode==='read'||(comparing&&right.kind!=='draft')||!activeBranch.draft.dirty||!work.text.trim()} onClick={()=>{setError('');setModal('snapshot')}}><Camera size={15}/>스냅샷</button>
    </div></div>
    <div className={'writing-content'+(comparing?' is-comparing':'')}>
     <div className="essay-context">
      <div className="essay-company"><strong>{a.company}</strong><span>{a.role}</span></div>
      <div className="essay-context-actions">
       <button type="button" className="button essay-submission-button" onClick={()=>setModal('submission')}>
        <FileText size={15} aria-hidden="true"/>제출본
       </button>
       <a className="button essay-interview-button" href={'#/interviews/'+a.id+'?tab=practice'}><Mic size={16} aria-hidden="true"/>면접 연습</a>
       <a className="text-button" href={'#/application/'+a.id}>공고 정보</a>
       <ApplyLink url={safeUrl(a.url)} onMissing={()=>navigate('/posting/'+a.id)}/>
      </div>
     </div>
     <div className="question-heading">
     <div className="essay-question-title"><h1>{q.prompt}</h1>{!comparing&&<span className={shown.text.length>q.limit?'over-limit':''}>{shown.text.length.toLocaleString()} / {q.limit.toLocaleString()}자</span>}</div>
    </div>{error&&<Notice type="error">{error}</Notice>}{comparing&&<p className="comparison-hint">{right.kind==='draft'?'바뀐 구절을 누르면 비교 대상에 반영됩니다.':'스냅샷끼리 비교 중'}</p>}
     {!comparing&&sources.length>0&&<div className="option-sources"><span>참고한 버전</span>{sources.map((item,i)=><button key={i} onClick={()=>setSourcePreview(item)}>{item.optionName} · {item.label}</button>)}</div>}
     <div className={'body-columns '+(comparing?'comparing':'')}>
      <section className="body-column"><div className="record-heading">
       {(comparing||mode==='write')&&<div>
        {comparing?(aiReference?<strong>AI 수정안</strong>:<RecordSelect question={q} value={referenceKey}
         onChange={changeReference} label="참고할 기록"/>):<>
         <strong>{activeBranch.snapshotIds.length?work.label:'본문'}</strong>
         <div className="record-context"><Dropdown label="작성할 버전" value={activeId} onChange={chooseBranch}
          options={q.branches.map(b=>({value:b.id,label:b.name+' · 작성 중'}))}/></div>
        </>}
       </div>}
       {!comparing&&<button type="button" className="text-button submission-star" disabled={!shown.text.trim()}
        aria-disabled={isCurrentSubmission||undefined} data-designated={isCurrentSubmission} onClick={()=>designateShown()}>
        <Star size={15} fill={isCurrentSubmission?'currentColor':'none'} aria-hidden="true"/>
        {isCurrentSubmission?'현재 제출본':'제출본 지정'}
       </button>}
       {mode==='read'&&<button type="button" className="text-button snapshot-details-button" aria-label="스냅샷 정보" onClick={()=>setModal('snapshot-details')}>
       <Info size={14} aria-hidden="true"/>정보
      </button>}{comparing&&<small>{source.text.length.toLocaleString()}자</small>}<IconButton label="본문 복사" onClick={copyBody}><Copy size={14}/></IconButton>{shown.kind==='snapshot'&&<IconButton label={deletable?'스냅샷 삭제':'스냅샷 삭제 · 뒤에 이어진 기록이나 분기를 먼저 삭제하세요'} disabled={!deletable} onClick={()=>setModal('delete-snapshot')}><Trash2 size={15}/></IconButton>}</div>
       {copied&&<small className="copy-notice" role="status">복사했어요</small>}
       {comparing?<><ComparisonSource segments={parts} onTake={right.kind==='draft'?take:undefined}/></>:mode==='write'?<textarea className="body-editor" aria-label="자소서 본문" value={work.text} onChange={e=>writeDraft(e.target.value)} placeholder="본문을 작성하세요." spellCheck={false}/>:<textarea className="body-editor" aria-label="자소서 본문" value={record.text} onChange={e=>editRecord(e.target.value)} spellCheck={false}/>}
      </section>
      {comparing&&<section className="body-column current-draft-column"><div className="record-heading"><RecordSelect question={q} value={target} onChange={changeTarget} label="비교 대상"/><small>{right.text.length.toLocaleString()} / {q.limit.toLocaleString()}자</small></div>{right.kind==='draft'?<ComparisonDraft text={right.text} onChange={writeDraft}/>:<><button className="text-button snapshot-edit-action" onClick={()=>changeTarget('draft:'+right.branchId)}>이 버전 편집</button><textarea className="body-editor" aria-label="비교 대상 본문" value={right.text} readOnly/></>}</section>}

     </div>
    </div>
   </main>
   {rightOpen&&<PanelResizer side="right" value={rw} min={260} max={500} controls="chat-panel" onChange={v=>onPreferences({...preferences,rightWidth:v})}/>}
   <aside className="chat-panel" id="chat-panel"><div className="panel-toolbar"><IconButton label={rightOpen?'AI 채팅 접기':'AI 채팅 펼치기'} onClick={()=>setRightOpen(!rightOpen)}><PanelGlyph kind={rightOpen?'right':'left'}/></IconButton>{rightOpen&&<><strong>AI 채팅</strong><small>Q{qi+1}</small></>}</div>{rightOpen&&<AIChat key={q.id} question={q} application={a} record={mode==='read'?record:work} onSave={onSave} onCandidate={candidate=>{compareCandidate(candidate);setCompactView('writing')}}/>}</aside>
  </div>
  {modal==='submission'&&<QuestionSubmissions application={a} currentQuestion={q}
   initialKey={mode==='write'?'draft:'+activeId:comparing?target:recordKey(record)}
   onSave={onSave} onClose={()=>setModal('')}/>}
  {modal==='replace-submission'&&<Modal title="제출본 교체" onClose={()=>setModal('')}>
   <p>이 문항의 현재 제출본을 지금 보고 있는 본문으로 교체할까요?</p>
   <div className="form-actions">
    <button type="button" className="button" onClick={()=>setModal('')}>취소</button>
    <button type="button" className="button primary" onClick={()=>designateShown(true)}>제출본 교체</button>
   </div>
  </Modal>}
  {modal==='snapshot-details'&&<Modal title="스냅샷 정보" onClose={()=>setModal('')}>
   <dl className="snapshot-details">
    <dt>버전</dt><dd>{q.branches.find(b=>b.id===record.branchId)?.name}</dd>
    <dt>이름</dt><dd>{record.title}</dd>
    {record.description&&<><dt>설명</dt><dd>{record.description}</dd></>}
   </dl>
  </Modal>}
  {modal==='snapshot'&&<Modal title="스냅샷" onClose={()=>setModal('')}><p className="snapshot-context">{activeBranch.name} · 현재 초안 {work.text.length.toLocaleString()}자</p><RecordForm title="스냅샷 이름" submitLabel="스냅샷 만들기" onCancel={()=>setModal('')} onSubmit={(name,desc)=>{try{applyCleanup(snapshot(q,activeId,name,desc));}catch(e){setError(errorMessage(e));setModal('')}}}/></Modal>}
  {modal==='option'&&<Modal title="새 버전" onClose={()=>setModal('')}><RecordForm title="예: 데이터 정합성 경험" onCancel={()=>setModal('')} onSubmit={addOption}/></Modal>}
  {modal==='rename-option'&&renaming&&<Modal title="버전 수정" onClose={()=>setModal('')}><RecordForm title="버전 이름" defaultName={renaming.name} defaultDescription={renaming.description} submitLabel="수정" onCancel={()=>setModal('')} onSubmit={(name,description)=>{onSave(renameWritingOption(q,renaming.id,name,description));setModal('')}}/><button className="text-button option-delete" disabled={q.branches.length===1} onClick={()=>{setDeletingBranch(renaming.id);setModal('delete-branch')}}>버전 삭제</button></Modal>}

  {sourcePreview&&<Modal title={sourcePreview.optionName+' · '+sourcePreview.label} onClose={()=>setSourcePreview(null)}><small className="muted">조합할 때 참고한 본문</small><p className="document-body source-preview">{sourcePreview.text}</p></Modal>}

  {modal==='conflict'&&<Modal title="작성 중인 초안이 있어요" onClose={()=>setModal('')}><p>기존 초안을 이어 쓰거나, 방금 수정한 내용을 새 버전으로 남길 수 있어요.</p><div className="form-actions"><button className="button" onClick={()=>{setModal('');chooseBranch(record.branchId)}}>기존 초안 열기</button><button className="button primary" onClick={()=>{editRecord(pending,true);setModal('')}}>새 버전으로 이어 쓰기</button></div></Modal>}
  {modal==='delete-snapshot'&&<Modal title="스냅샷 삭제" onClose={()=>setModal('')}><p>{shown.label} · {shown.title}</p><Notice>이 스냅샷을 삭제합니다. 현재 초안 본문은 남으며 삭제한 스냅샷은 복구할 수 없습니다.</Notice><div className="form-actions"><button className="button" onClick={()=>setModal('')}>취소</button><button className="button danger" onClick={removeSnapshot}>스냅샷 삭제</button></div></Modal>}
  {modal==='delete-branch'&&branchToDelete&&<Modal title="버전 삭제" onClose={()=>setModal('rename-option')}><p><strong>{branchToDelete.name}</strong> 버전의 스냅샷 {branchToDelete.snapshotIds.length}개와 {branchToDelete.draft.closed?'보관된 마지막 본문':'작성 중인 초안'}을 삭제합니다.</p><Notice>복구할 수 없습니다. 다른 버전의 본문과 제출본은 유지됩니다. 합칠 때 보관한 참고 본문도 남습니다.</Notice><div className="form-actions"><button className="button" onClick={()=>setModal('rename-option')}>취소</button><button className="button danger" onClick={removeBranch}>버전 삭제</button></div></Modal>}
 </div>;
}
