import React,{lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {Merge as MergeIcon,Camera,Columns2,Copy,Plus,ArrowLeft,Trash2,History,MessagesSquare,FileText,Download,Mic,Info,Star,Sparkles,Undo2,Redo2,ChevronRight,Loader2} from 'lucide-react';
import {BackLink,ApplyLink,IconButton,PanelGlyph,Modal,RecordForm,Field,Notice,copyText} from '../components/UI.jsx';
import Dropdown from '../components/Dropdown.jsx';
import PanelResizer from '../components/PanelResizer.jsx';
import OptionHistory from '../components/OptionHistory.jsx';
import VersionGraph from '../components/VersionGraph.jsx';
import {optionView,comparisonSearch} from '../option-route.js';
import {createWritingOption,renameWritingOption,editOptionSnapshot,optionSources,sourceName} from '../writing-options.js';
import AIChat from '../components/AIChat.jsx';
import AIReview from '../components/AIReview.jsx';
import useWritingChat from '../components/use-writing-chat.js';
import {draftRequestBranch} from '../ai-review.js';
import {VersionText,MergeDraft,ChangeCards} from '../components/Diff.jsx';
import {createMergeState,chooseAllRegions,choiceOf,editMergeText,followRanges,isIntact,toggleCard,draftHighlights} from '../merge-state.js';
import {differingRanges} from '../comparison.js';
import {createHistory,recordText,undoText,redoText} from '../text-history.js';
import {resolveRecord,updateDraft,snapshot,activateBranch,errorMessage,safeUrl,parseKey,defaultRecordKey,designateQuestionSubmission,reviseQuestionSubmission,recordKey} from '../model.js';
import {canDeleteSnapshot,deleteSnapshot,deleteBranch} from '../history-actions.js';

const EssayPdf = lazy(() => import('../components/EssayPdf.jsx'));
// 추천 경험은 개발용 샘플이라 개발 서버에서만 빈 문항의 본문 자리에 보여 준다.
const DraftStarter = import.meta.env.DEV ? lazy(() => import('../components/ExperienceSelectionPreview.jsx')) : null;
const ExperienceDraftDialog = import.meta.env.DEV
 ? lazy(() => import('../components/ExperienceSelectionPreview.jsx').then(module => ({default: module.ExperienceDraftDialog}))) : null;
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
    value: 'snapshot:' + item.id, label: branch.name + ' · ' + item.title,
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

export default function Editor({application:a,question:q,navigate,onSave,onOpenEssayTemplate,onPreferences,preferences,query,profile,
 essayTemplate,onEditTemplateQuestions,templateReturnPath}){
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
 // 버전 만들기·수정 창 안에 보이는 오류. 창을 닫으면 지운다.
 const[formError,setFormError]=useState('');
 const closeForm=()=>{setFormError('');setModal('');};
 const[deletingBranch,setDeletingBranch]=useState(null),[renamingId,setRenamingId]=useState(null),[sourcePreview,setSourcePreview]=useState(null);
 const activeId=q.branches.some(b=>b.id===workingId)?workingId:q.branches[0].id;
 const work=resolveRecord(q,'draft:'+activeId),activeBranch=q.branches.find(b=>b.id===activeId),sources=optionSources(q,activeId),renaming=q.branches.find(b=>b.id===renamingId);
 const record=resolveRecord(q,valid(selected)?selected:'draft:'+activeId);
 const source=valid(referenceKey)?resolveRecord(q,referenceKey):record;
 const right=resolveRecord(q,valid(target)?target:'draft:'+activeId),comparing=mode==='compare';
 const chat=useWritingChat({question:q,application:a,record:mode==='read'?record:work,profile,onSave});
 // 비교 상태: 왼쪽에서 고른 구절과 오른쪽 본문 안 위치. 비교 대상이 바뀌거나 본문이 밖에서 바뀌면 새로 시작한다.
 const compareScope=referenceKey+'|'+right.kind+':'+right.id;
 const[compareSession,setCompareSession]=useState(null),[compareTab,setCompareTab]=useState('part');
 const comparison=useMemo(()=>{
  if(!comparing)return null;
  const kept=compareSession?.scope===compareScope&&compareSession.reference===source.text&&compareSession.state.text===right.text;
  return kept?compareSession.state:createMergeState(source.text,right.text,'right');
 },[comparing,compareSession,compareScope,source.text,right.text]);
 const qi=a.questions.findIndex(n=>n.id===q.id),lw=preferences.leftWidth||240,rw=preferences.rightWidth||320;
 const limit=essayTemplate ? q.templateLimit : q.limit;
 const backPath=essayTemplate && templateReturnPath ? templateReturnPath : '/applications';
 const backLabel=backPath==='/applications' ? '지원 현황' : '이전 자소서';
 const count=text=>text.length.toLocaleString()+(limit==null?'':' / '+limit.toLocaleString())+'자';
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
  const other=q.branches.find(b=>b.id!==activeId),preferred=record.kind==='snapshot'?selected:valid(referenceKey)&&referenceKey!=='draft:'+activeId?referenceKey:null;
  // 지금 본문과 같은 기록은 비교해도 보이는 차이가 없으므로 다른 버전이나 이전 기록을 먼저 고른다.
  const differs=key=>key&&valid(key)&&resolveRecord(q,key).text!==work.text;
  const key=[preferred,other&&defaultRecordKey(q,other.id),...q.snapshots.map(s=>'snapshot:'+s.id).reverse()].find(differs)||preferred||(other?defaultRecordKey(q,other.id):'draft:'+activeId);
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
 function updateComparison(next){setCompareSession({scope:compareScope,reference:source.text,state:next});if(next.text!==right.text)writeDraft(next.text);}
 const liveChanges=comparison?comparison.changes.filter(change=>isIntact(comparison,change.id)):[];
 const allApplied=!!liveChanges.length&&liveChanges.every(change=>choiceOf(comparison,change.id)==='left');
 const toggleSentence=ids=>updateComparison(toggleCard(comparison,ids));
 // 오른쪽 내 본문에서 참고본과 다른 곳과 방금 반영한 곳.
 // 오른쪽 내 본문에서 참고본과 다른 곳. 긴 본문도 입력이 밀리지 않게 입력을 멈췄을 때 다시 계산하고, 그 사이에는 이전 결과를 편집 위치에 맞춰 옮겨 보여 준다.
 // 반영한 구절이 없으면 같은 때 카드도 지금 본문 기준으로 다시 만든다.
 const[diffMarks,setDiffMarks]=useState({reference:null,text:null,ranges:[]});
 const editingDraft=comparing&&right.kind==='draft';
 useEffect(()=>{
  if(!editingDraft)return;
  const ready=diffMarks.reference===source.text&&diffMarks.text!=null;
  const timer=setTimeout(()=>{
   setDiffMarks({reference:source.text,text:right.text,ranges:differingRanges(source.text,right.text)});
   if(comparison?.manual&&!Object.values(comparison.choices).includes('left'))setCompareSession({scope:compareScope,reference:source.text,state:createMergeState(source.text,right.text,'right')});
  },ready?250:0);
  return()=>clearTimeout(timer);
 },[editingDraft,source.text,right.text]);
 const draftMarks=useMemo(()=>!editingDraft||diffMarks.reference!==source.text||diffMarks.text==null?[]:followRanges(diffMarks.ranges,diffMarks.text,right.text),[editingDraft,diffMarks,source.text,right.text]);
 const applied=comparison?.last?.side==='left'?comparison.last:null;
 const applyAll=()=>updateComparison(chooseAllRegions(comparison,allApplied?'right':'left',{intact:true}));
 const typeComparison=text=>updateComparison(editMergeText(comparison,text));
 function editRecord(text,asNew=false){
  try{
   if(asNew){let next=createWritingOption(q,activeBranch.name+' 다른 안','',{auto:true});const id=next.activeBranchId;next=updateDraft(next,id,text);acceptEdit(next,id);}
   else{const next=editOptionSnapshot(q,record.id,text);if(next!==q)acceptEdit(next,record.branchId,record.id);}
  }catch(e){if(e.message==='DRAFT_CONFLICT'){setPending(text);setModal('conflict');}else setError(errorMessage(e));}
 }
 function addOption(name,description){
  let next;try{next=createWritingOption(q,name,description);}catch(e){setFormError(errorMessage(e));return;}
  setFormError('');const id=next.activeBranchId;rememberWorkUrl(id,true);onSave(next);setWorkingId(id);setSelected('draft:'+id);setTarget('draft:'+id);setReferenceKey('draft:'+id);setMode('write');setAiReference(null);setModal('');setError('');
 }
 function advancedMerge(){
  if(aiReference)return;
  const from=comparing?referenceKey:mode==='read'?selected:'draft:'+activeId;
  const other=q.branches.find(b=>b.id!==resolveRecord(q,from).branchId);
  const to=comparing?target:other?defaultRecordKey(q,other.id):'draft:'+activeId;
  navigate(`/merge/${a.id}/${q.id}?left=${encodeURIComponent(from)}&right=${encodeURIComponent(to)}`);
 }
 // AI 수정안은 작성 중 본문 위에서 검토한다. 비교나 스냅샷 보기 중이면 작성 중 본문으로 돌아온다.
 function reviewCandidate(message){
  const id=draftRequestBranch(q.messages,message)??activeId;
  if(!q.branches.some(branch=>branch.id===id)){setError('이 초안을 요청한 버전을 찾을 수 없어요.');return;}
  if(id!==activeId){setWorkingId(id);onSave(current=>activateBranch(current,id));}
  if(comparing||mode==='read'||id!==activeId){const key='draft:'+id;setSelected(key);setReferenceKey(key);setTarget(key);setMode('write');rememberWorkUrl(id,true);}
  setAiReference(message);setError('');
 }
 const snapshotTaken=activeBranch.snapshotIds.length&&!activeBranch.draft.dirty&&activeBranch.draft.baseIds.length===1;
 const canSnapshotDraft=!!work.text.trim()&&!snapshotTaken;
 // 적용하기 전 본문을 스냅샷으로 남길지는 검토 화면에서 묻는다. 이미 스냅샷과 같은 본문이면 묻지 않고 바로 적용한다.
 function applyReview({text,snapshot:keep}){
  try{
   let next=q;
   if(keep)next=snapshot(next,activeId,aiReference.kind==='draft'?'AI 초안 적용 전':'AI 수정안 적용 전');
   historyKind.current='apply';
   acceptEdit(updateDraft(next,activeId,text),activeId);
  }catch(e){setError(errorMessage(e));}
  setAiReference(null);
 }
 // 검토에서 하나라도 골랐으면 다른 수정안·문항·버전으로 옮기기 전에 버릴지 묻는다.
 const[reviewDirty,setReviewDirty]=useState(false),[pendingLeave,setPendingLeave]=useState(null);
 function guard(action){if(aiReference&&reviewDirty){setPendingLeave({run:action});return;}action();}
 // 빈 문항에서 경험으로 받은 초안은 비교 없이 본문에 넣고, 넣기 전으로 되돌릴 수 있게 한다.
 const[manualWriting,setManualWriting]=useState(false),[insertedDraft,setInsertedDraft]=useState(null),[usedOpen,setUsedOpen]=useState(false);
 const latestWork=useRef(work);latestWork.current=work;
 const reviewing=useRef(aiReference);reviewing.current=aiReference;
 // 본문이 있으면 받은 초안을 바로 넣지 않고 수정안처럼 본문 위에서 검토한다.
 async function makeDraft(experiences){
  const answer=await chat.requestDraft(experiences);
  if(!answer||latestWork.current.id!==activeId)return;
  if(latestWork.current.text.trim()){if(!reviewing.current)reviewCandidate(answer);return;}
  const text=answer.candidate,id=activeId;
  historyKind.current='apply';
  onSave(current=>{const b=current.branches.find(item=>item.id===id);return !b||b.draft.text.trim()?current:activateBranch(updateDraft(current,id,text),id);});
  setInsertedDraft({id,text,titles:experiences.map(item=>item.title)});setUsedOpen(false);
 }
 function undoDraft(){historyKind.current='apply';writeDraft('');setInsertedDraft(null);}
 // 작성 중 본문의 되돌리기·다시 실행. 타이핑, AI 수정안 적용, 초안 넣기를 모두 기록하고 버전을 바꾸면 새로 시작한다.
 const[textHistory,setTextHistory]=useState(()=>({id:activeId,history:createHistory(work.text)}));
 const historyKind=useRef('typing');
 useEffect(()=>{
  setTextHistory(current=>current.id!==activeId?{id:activeId,history:createHistory(work.text)}
   :{id:activeId,history:recordText(current.history,work.text,{at:Date.now(),kind:historyKind.current})});
  historyKind.current='typing';
 },[work.text,activeId]);
 const historyReady=mode==='write'&&!comparing&&!aiReference&&textHistory.id===activeId;
 const canUndo=historyReady&&textHistory.history.past.length>0,canRedo=historyReady&&textHistory.history.future.length>0;
 function stepHistory(step){
  if(!(step<0?canUndo:canRedo))return;
  const next=(step<0?undoText:redoText)(textHistory.history);
  setTextHistory({id:activeId,history:next});writeDraft(next.present);
 }
 const historyKeys=useRef(null);
 historyKeys.current=event=>{
  if(!(event.metaKey||event.ctrlKey)||event.altKey)return false;
  const key=event.key.toLowerCase(),redo=(key==='z'&&event.shiftKey)||(key==='y'&&event.ctrlKey&&!event.metaKey);
  if(key!=='z'&&!redo)return false;
  event.preventDefault();stepHistory(redo?1:-1);return true;
 };
 // 본문 칸 밖(버튼 등)에 초점이 있을 때도 ⌘Z가 본문을 되돌리게 한다. 다른 입력 칸과 창 안에서는 그 칸의 기본 동작을 둔다.
 useEffect(()=>{
  const listen=event=>{if(!event.target.closest?.('input,textarea,select,[contenteditable="true"],[role="dialog"]'))historyKeys.current(event);};
  document.addEventListener('keydown',listen);return()=>document.removeEventListener('keydown',listen);
 },[]);
 const mod=typeof navigator!=='undefined'&&/Mac|iPhone|iPad/.test(navigator.platform)?'⌘':'Ctrl+';
 const starterAvailable=!!DraftStarter&&!essayTemplate;
 const[draftDialog,setDraftDialog]=useState(false);
 const drafting=chat.pending?.payload.kind==='draft';
 const showStarter=starterAvailable&&!manualWriting&&!work.text.trim();
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
 // 본문을 쓰기 시작한 뒤의 경험으로 초안 받기는 AI 채팅 입력 칸 옆에 둔다. 빈 문항은 본문 자리의 경험 고르기를 쓴다.
 const draftAction=starterAvailable&&mode==='write'&&!showStarter&&<button type="button" className="text-button chat-draft-action" disabled={drafting}
  onClick={()=>{if(work.text.trim())setDraftDialog(true);else{setManualWriting(false);setCompactView('writing');}}}>
  {drafting?<><Loader2 size={13} className="draft-starter-spin" aria-hidden="true"/>초안을 쓰고 있어요</>:<><Sparkles size={13} aria-hidden="true"/>경험으로 초안 받기</>}</button>;
 const chatPanel=<AIChat key={q.id} question={q} chat={chat} draftId={activeId} draftText={work.text} reviewingId={aiReference?.id}
  draftAction={draftAction} draftInChat={!showStarter}
  onReview={message=>guard(()=>{reviewCandidate(message);setCompactView('writing')})}/>;
 return <div className="editor-page">
  <nav className="editor-view-switch" aria-label="작성 화면 보기">
   <a className="editor-mobile-back" href={'#'+backPath} aria-label={backLabel}><ArrowLeft size={16} aria-hidden="true"/></a>
   {compactViews.map(([view,label,Icon,panel])=><button type="button" key={view} aria-pressed={compactView===view} aria-controls={panel} onClick={()=>{
    setCompactView(view);
    if(view==='history')setLeftOpen(true);
    if(view==='chat')setRightOpen(true);
   }}><Icon size={16} strokeWidth={1.7}/>{label}</button>)}
  </nav>
  <div className={'editor-layout '+(overviewOpen?'overview-open ':'')+(!leftOpen?'left-closed ':'')+(!rightOpen?'right-closed':'')} data-compact-view={compactView} style={{'--left-width':(overviewOpen?overviewWidth:lw)+'px','--overview-width':overviewWidth+'px','--right-width':rw+'px'}}>
   <aside className="history-panel" id="history-panel">
    <div className="panel-toolbar option-panel-toolbar">
     <BackLink className="editor-applications-link" to={backPath}><span className={leftOpen?undefined:'visually-hidden'}>{backLabel}</span></BackLink>
     <div><IconButton label={overviewOpen?'버전별 기록 보기':'전체 버전 그래프'} aria-pressed={overviewOpen} onClick={()=>{setOverviewOpen(!overviewOpen);setLeftOpen(true)}}><PanelGlyph kind={overviewOpen?'shrink':'expand'}/></IconButton><IconButton label={leftOpen?'왼쪽 패널 접기':'왼쪽 패널 펼치기'} onClick={()=>setLeftOpen(!leftOpen)}><PanelGlyph kind={leftOpen?'left':'right'}/></IconButton></div>
    </div>
    {leftOpen&&(overviewOpen?<VersionGraph question={q} selected={selected} onSelect={key=>guard(()=>{selectOverview(key);setCompactView('writing')})} onPreview={setSourcePreview} expanded/>:<OptionHistory question={q} activeId={activeId} selected={selected} onChoose={id=>guard(()=>{chooseBranch(id);setCompactView('writing')})} onSelect={key=>guard(()=>{select(key);setCompactView('writing')})} onAdd={()=>setModal('option')} onRename={id=>{setRenamingId(id);setModal('rename-option')}}/>)}
   </aside>
   {leftOpen&&<PanelResizer side="left" value={overviewOpen?overviewWidth:lw} min={200} max={620} controls="history-panel" onChange={v=>overviewOpen?setOverviewWidth(v):onPreferences({...preferences,leftWidth:v})}/>}

   <main className="writing-panel" id="writing-panel"><div className="editor-toolbar"><nav className="question-tabs" aria-label="자소서 문항">{a.questions.map((n,i)=><button key={n.id} className={n.id===q.id?'active':''} aria-current={n.id===q.id?'page':undefined} onClick={()=>guard(()=>navigate('/write/'+a.id+'/'+n.id))}>Q{i+1}</button>)}<IconButton label="문항 추가·수정" onClick={essayTemplate?onEditTemplateQuestions:()=>navigate('/posting/'+a.id)}><Plus size={16}/></IconButton></nav>
    <div className="editor-actions">{!essayTemplate&&<button type="button" className="text-button" onClick={()=>guard(onOpenEssayTemplate)}><FileText size={15} aria-hidden="true"/>내 공통 자소서</button>}
     {(comparing||(mode==='read'&&selected!==defaultRecordKey(q,activeId)))&&<button className="text-button return-writing" onClick={returnToWrite}><ArrowLeft size={14}/>작성으로</button>}{!comparing&&!aiReference&&<button className="text-button compare-action" onClick={openCompare}><Columns2 size={16}/>비교하기</button>}
     <IconButton label="새 버전" onClick={()=>{setError('');setModal('option')}}><Plus size={18}/></IconButton><IconButton label="합쳐서 새 버전 만들기" disabled={!!aiReference} onClick={advancedMerge}><MergeIcon size={18} className="downward-icon flow-action-icon"/></IconButton>
     <button className="button small primary snapshot-action" disabled={!!aiReference||mode==='read'||(comparing&&right.kind!=='draft')||!activeBranch.draft.dirty||!work.text.trim()} onClick={()=>{setError('');setModal('snapshot')}}><Camera size={15}/>스냅샷</button>
    </div></div>
    <div className={'writing-content'+(comparing||aiReference?' is-comparing':'')}>
     <div className="essay-context">
      <div className="essay-company"><strong>{a.company}</strong>
       <span>{essayTemplate?'다른 공고에서는 문항별 현재 작성 버전을 불러와요.':a.role}</span>
      </div>
      {!essayTemplate&&<div className="essay-context-actions">
       <button type="button" className="button essay-submission-button" onClick={()=>setModal('submission')}>
        <FileText size={15} aria-hidden="true"/>제출본
       </button>
       <a className="button essay-interview-button" href={'#/interviews/'+a.id+'?tab=practice'}><Mic size={16} aria-hidden="true"/>면접 연습</a>
       <a className="text-button" href={'#/application/'+a.id}>공고 정보</a>
       <ApplyLink url={safeUrl(a.url)} onMissing={()=>navigate('/posting/'+a.id)}/>
      </div>}
     </div>
     <div className="question-heading">
     <div className="essay-question-title"><h1>{q.prompt}</h1>{!comparing&&!aiReference&&<span className={limit!=null&&shown.text.length>limit?'over-limit':''}>{count(shown.text)}</span>}</div>
     {/* 본문 도구는 문항 제목 줄 오른쪽에 둬서 본문 위에 따로 한 줄을 쓰지 않는다. */}
     {!comparing&&!aiReference&&<div className="record-tools">
      {!essayTemplate&&<button type="button" className="text-button submission-star" disabled={!shown.text.trim()}
       aria-disabled={isCurrentSubmission||undefined} data-designated={isCurrentSubmission} onClick={()=>designateShown()}>
       <Star size={15} fill={isCurrentSubmission?'currentColor':'none'} aria-hidden="true"/>
       {isCurrentSubmission?'현재 제출본':'제출본 지정'}
      </button>}
      {mode==='read'&&<button type="button" className="text-button snapshot-details-button" aria-label="스냅샷 정보" onClick={()=>setModal('snapshot-details')}>
       <Info size={14} aria-hidden="true"/>정보
      </button>}
      {mode==='write'&&<>
       <IconButton label={'되돌리기 ('+mod+'Z)'} disabled={!canUndo} onClick={()=>stepHistory(-1)}><Undo2 size={14}/></IconButton>
       <IconButton label={'다시 실행 ('+(mod==='⌘'?'⇧⌘Z':'Ctrl+Y')+')'} disabled={!canRedo} onClick={()=>stepHistory(1)}><Redo2 size={14}/></IconButton></>}
      <IconButton label="본문 복사" onClick={copyBody}><Copy size={14}/></IconButton>
      {shown.kind==='snapshot'&&<IconButton label={deletable?'스냅샷 삭제':'스냅샷 삭제 · 뒤에 이어진 기록이나 분기를 먼저 삭제하세요'} disabled={!deletable} onClick={()=>setModal('delete-snapshot')}><Trash2 size={15}/></IconButton>}
     </div>}
    </div>{error&&<Notice type="error">{error}</Notice>}
     {aiReference?<AIReview key={aiReference.id} message={aiReference} draftText={work.text} limit={limit} canSnapshot={canSnapshotDraft}
      onApply={applyReview} onCancel={()=>setAiReference(null)} onDirtyChange={setReviewDirty}/>:<>
     {comparing&&<p className="comparison-hint">{right.kind==='draft'?'달라진 문장을 누르면 오른쪽 내 본문에 반영되고, 다시 누르면 취소돼요.':'스냅샷끼리 비교 중'}</p>}
     {!comparing&&sources.length>0&&<div className="option-sources"><span>참고한 버전</span>{sources.map((item,i)=><button key={i} onClick={()=>setSourcePreview(item)}>{item.optionName} · {sourceName(item)}</button>)}</div>}
     <div className={'body-columns '+(comparing?'comparing':'')}>
      <section className="body-column">{comparing&&<div className="record-heading">
       <div><RecordSelect question={q} value={referenceKey} onChange={changeReference} label="참고할 기록"/></div>
       <small>{source.text.length.toLocaleString()}자</small><IconButton label="본문 복사" onClick={copyBody}><Copy size={14}/></IconButton></div>}
       {copied&&<small className="copy-notice" role="status">복사했어요</small>}
       {comparing?(right.kind==='draft'?<>
        <div className="compare-tabs"><div role="tablist" aria-label="참고본 보기">{[['all','전체'],['part','부분']].map(([key,name])=><button key={key} type="button" role="tab" aria-selected={compareTab===key} onClick={()=>setCompareTab(key)}>{name}</button>)}</div><button type="button" className="text-button" disabled={!liveChanges.length} onClick={applyAll}>{allApplied?'일괄 취소':'일괄 반영'}</button></div>
        {compareTab==='all'?<div className="document-body version-text left">{source.text}</div>:<ChangeCards state={comparison} onToggle={toggleSentence}/>}
       </>:<div className="document-body version-text left">{source.text}</div>):mode==='write'&&showStarter?<Suspense fallback={null}><DraftStarter application={a} question={q} busy={!!chat.pending}
        error={chat.failure?.request.payload.kind==='draft'?chat.failure.message:''} onDraft={makeDraft} onWrite={()=>setManualWriting(true)}/></Suspense>:<>
        {mode==='write'&&insertedDraft?.id===activeId&&<div className="inserted-draft">
         {work.text===insertedDraft.text&&<p className="inserted-draft-note"><Sparkles size={14} aria-hidden="true"/>AI 초안을 넣었어요
          <button type="button" className="text-button" onClick={undoDraft}><Undo2 size={14} aria-hidden="true"/>되돌리기</button></p>}
         <button type="button" className="inserted-draft-used" aria-expanded={usedOpen} onClick={()=>setUsedOpen(!usedOpen)}>
          사용한 경험 <strong>{insertedDraft.titles[0]}</strong>{insertedDraft.titles.length>1?' 외 '+(insertedDraft.titles.length-1):''}<ChevronRight size={13} aria-hidden="true"/></button>
         {usedOpen&&<ul className="inserted-draft-list">{insertedDraft.titles.map(title=><li key={title}>{title}</li>)}</ul>}
        </div>}
        {/* 스냅샷을 고치면 작성 중 본문으로 넘어간다. 같은 입력 칸을 그대로 써야 초점과 커서가 유지된다. */}
        <textarea className="body-editor" aria-label="자소서 본문" value={mode==='write'?work.text:record.text} spellCheck={false}
         onChange={e=>mode==='write'?writeDraft(e.target.value):editRecord(e.target.value)} onKeyDown={mode==='write'?e=>historyKeys.current(e):undefined}
         placeholder={mode==='write'?'본문을 작성하세요.':undefined}/></>}
      </section>
      {comparing&&<section className="body-column current-draft-column"><div className="record-heading"><RecordSelect question={q} value={target} onChange={changeTarget} label="비교 대상"/><small>{count(right.text)}</small></div>{right.kind==='draft'?<MergeDraft className="compare-draft" text={right.text} onChange={typeComparison} highlights={draftHighlights(draftMarks,applied)} flash={applied}/>:<><button className="text-button snapshot-edit-action" onClick={()=>changeTarget('draft:'+right.branchId)}>이 버전 편집</button><VersionText state={comparison} side="right"/></>}</section>}

     </div></>}
    </div>
   </main>
   {rightOpen&&<PanelResizer side="right" value={rw} min={260} max={500} controls="chat-panel" onChange={v=>onPreferences({...preferences,rightWidth:v})}/>}
   <aside className="chat-panel" id="chat-panel">
    <div className="panel-toolbar"><IconButton label={rightOpen?'AI 채팅 접기':'AI 채팅 펼치기'}
     onClick={()=>setRightOpen(!rightOpen)}><PanelGlyph kind={rightOpen?'right':'left'}/></IconButton>
     {rightOpen&&<><strong>AI 채팅</strong><small>Q{qi+1}</small></>}
    </div>
    <div className="editor-chat-content" hidden={!rightOpen}>{chatPanel}</div>
   </aside>
  </div>
  {modal==='submission'&&<QuestionSubmissions application={a} currentQuestion={q}
   initialKey={mode==='write'?'draft:'+activeId:comparing?target:recordKey(record)}
   onSave={onSave} onClose={()=>setModal('')}/>}
  {draftDialog&&<Suspense fallback={null}><ExperienceDraftDialog application={a} question={q}
   onDraft={experiences=>{setDraftDialog(false);makeDraft(experiences);}} onClose={()=>setDraftDialog(false)}/></Suspense>}
  {pendingLeave&&<Modal title="검토 중인 내용을 버릴까요?" onClose={()=>setPendingLeave(null)}>
   <p>반영하거나 그대로 두기로 고른 내용은 적용하지 않으면 사라져요.</p>
   <div className="form-actions">
    <button type="button" className="button" onClick={()=>setPendingLeave(null)}>계속 검토</button>
    <button type="button" className="button primary" onClick={()=>{const {run}=pendingLeave;setPendingLeave(null);setReviewDirty(false);setAiReference(null);run();}}>버리고 이동</button>
   </div>
  </Modal>}
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
  {modal==='option'&&<Modal title="새 버전" onClose={closeForm}><RecordForm title="예: 데이터 정합성 경험" error={formError} onCancel={closeForm} onSubmit={addOption}/></Modal>}
  {modal==='rename-option'&&renaming&&<Modal title="버전 수정" onClose={closeForm}><RecordForm title="버전 이름" defaultName={renaming.name} defaultDescription={renaming.description} submitLabel="수정" error={formError} onCancel={closeForm} onSubmit={(name,description)=>{try{onSave(renameWritingOption(q,renaming.id,name,description));closeForm();}catch(e){setFormError(errorMessage(e));}}}/><button className="text-button option-delete" disabled={q.branches.length===1} onClick={()=>{setDeletingBranch(renaming.id);setModal('delete-branch')}}>버전 삭제</button></Modal>}

  {sourcePreview&&<Modal title={sourcePreview.optionName+' · '+sourceName(sourcePreview)} onClose={()=>setSourcePreview(null)}><small className="muted">조합할 때 참고한 본문</small><p className="document-body source-preview">{sourcePreview.text}</p></Modal>}

  {modal==='conflict'&&<Modal title="작성 중인 초안이 있어요" onClose={()=>setModal('')}><p>기존 초안을 이어 쓰거나, 방금 수정한 내용을 새 버전으로 남길 수 있어요.</p><div className="form-actions"><button className="button" onClick={()=>{setModal('');chooseBranch(record.branchId)}}>기존 초안 열기</button><button className="button primary" onClick={()=>{editRecord(pending,true);setModal('')}}>새 버전으로 이어 쓰기</button></div></Modal>}
  {modal==='delete-snapshot'&&<Modal title="스냅샷 삭제" onClose={()=>setModal('')}><p>{shown.title}</p><Notice>이 스냅샷을 삭제합니다. 현재 초안 본문은 남으며 삭제한 스냅샷은 복구할 수 없습니다.</Notice><div className="form-actions"><button className="button" onClick={()=>setModal('')}>취소</button><button className="button danger" onClick={removeSnapshot}>스냅샷 삭제</button></div></Modal>}
  {modal==='delete-branch'&&branchToDelete&&<Modal title="버전 삭제" onClose={()=>setModal('rename-option')}><p><strong>{branchToDelete.name}</strong> 버전의 스냅샷 {branchToDelete.snapshotIds.length}개와 {branchToDelete.draft.closed?'보관된 마지막 본문':'작성 중인 초안'}을 삭제합니다.</p><Notice>복구할 수 없습니다. 다른 버전의 본문과 제출본은 유지됩니다. 합칠 때 보관한 참고 본문도 남습니다.</Notice><div className="form-actions"><button className="button" onClick={()=>setModal('rename-option')}>취소</button><button className="button danger" onClick={removeBranch}>버전 삭제</button></div></Modal>}
 </div>;
}
