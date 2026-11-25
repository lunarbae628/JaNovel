import React,{useLayoutEffect,useRef,useState} from 'react';
import {QuestionSubmissions} from './Editor.jsx';
import {Plus,ChevronRight,Search,ArrowUp,ArrowDown,Trash2,CalendarDays,FileText,Pencil} from 'lucide-react';
import {BackLink,IconButton,Modal,Field,Notice,Empty,ApplyLink,dateLabel} from '../components/UI.jsx';
import Dropdown from '../components/Dropdown.jsx';
import {recentApplications} from '../components/CareerLayout.jsx';
import {postingSections,safeUrl,uid,writingPath} from '../model.js';
import {getAttachment} from '../storage.js';
import {applicationEventTypes, saveApplicationEvent, todayKey, validateScheduleItem} from '../schedule.js';
export const stageOptions=a=>[...new Set(['관심', '작성 중', ...a.stages, a.status, '최종 합격','불합격','지원 취소'])];
export function allEvents(application) {
  const {id, company, deadline, deadlineTime, deadlineDetails, events} = application;
  const due = {id: 'deadline-' + id, title: '지원 마감', note: '', ...deadlineDetails,
    type: '마감', date: deadline, time: deadlineTime || '', deadline: true};
  return (deadline ? [due, ...events] : events).map(event => ({...event, applicationId: id, company}));
}
const outcomeStages = ['최종 합격', '불합격', '지원 취소'];
const weekdayLabel = new Intl.DateTimeFormat('ko-KR', {weekday: 'short', timeZone: 'UTC'});
const stageGroup = status => status === '관심' || status === '작성 중' || outcomeStages.includes(status)
  ? status : '전형 진행';

function upcomingEvents(applications) {
  return applications.flatMap(allEvents).filter(event => event.date >= todayKey())
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

function EditableField({label, value, maxLength, onSave}) {
  const [editing, setEditing] = useState(false);
  const button = useRef(null);
  const restoreFocus = useRef(false);

  useLayoutEffect(() => {
    if (!editing && restoreFocus.current) {
      restoreFocus.current = false;
      button.current?.focus();
    }
  }, [editing]);

  function finish(input, save, fromKeyboard = false) {
    const next = input.value.trim();
    restoreFocus.current = fromKeyboard;
    setEditing(false);
    if (save && next && next !== value) onSave(next);
  }

  return editing ? <input autoFocus aria-label={label} defaultValue={value} maxLength={maxLength}
    onFocus={event => event.target.select()}
    onBlur={event => finish(event.currentTarget, true)}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing || !['Enter', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      finish(event.currentTarget, event.key === 'Enter', true);
    }}/> : <button className="dashboard-field" title={value} ref={button} aria-label={label + ': ' + value}
    onClick={() => setEditing(true)}>{value}<Pencil size={12} aria-hidden="true"/></button>;
}

function ApplicationSchedule({application, onSave, onClose}) {
  const events = allEvents(application);
  const [event, setEvent] = useState(() => events.length ? null : {});
  const title = event ? event.deadline ? '지원 마감 수정' : event.id ? '일정 수정' : '일정 추가' : application.company + ' 일정';
  return <Modal key={title} title={title}
    onClose={onClose}>
    {event ? <EventForm event={event} allowUndated onSubmit={next => {onSave(next); onClose();}} onClose={onClose}/> : <>
      <div className="dashboard-schedule-list">
        {events.map(item => <button key={item.id} type="button" onClick={() => setEvent(item)}>
          <span><strong>{item.title}</strong><small>{dateLabel(item.date, item.time)}</small></span><Pencil size={14}/>
        </button>)}
      </div>
      <div className="form-actions"><button className="button primary" onClick={() => setEvent({})}><Plus size={15}/>일정 추가</button></div>
    </>}
  </Modal>;
}

export function Applications({store, navigate, onApplicationChange}) {
  const [group, setGroup] = useState('');
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const {applications} = store;
  const events = upcomingEvents(applications);
  const stages = [...new Set(applications.flatMap(stageOptions))];
  const groups = ['', '관심', '작성 중', '전형 진행'];
  const filtered = applications.filter(application =>
    (!group || stageGroup(application.status) === group) &&
    (!filter || application.status === filter) &&
    (application.company + ' ' + application.role).toLowerCase().includes(search.trim().toLowerCase()));
  const hasFilters = group || filter || search.trim();
  const recent = recentApplications(store);
  const scheduleApplication = applications.find(application => application.id === scheduleId);

  return <>
    <div className="career-content dashboard">
      <section className="dashboard-list career-sheet" aria-labelledby="dashboard-list-title">
        <div className="dashboard-heading">
          <div className="dashboard-list-label">
            <h1 id="dashboard-list-title">지원 목록</h1>
            <a className="career-button" href="#/essay-template"><FileText size={15} aria-hidden="true"/>내 공통 자소서</a>
            <button className="career-button primary near-action" onClick={() => navigate('/posting')}>
              <Plus size={15} aria-hidden="true"/>공고 등록
            </button>
          </div>
          <div className="dashboard-filters">
            <label className="dashboard-search"><Search size={17} strokeWidth={1.7}/>
              <input aria-label="회사·직무 검색" placeholder="회사·직무 검색" value={search}
                onChange={event => setSearch(event.target.value)}/>
            </label>
            <Dropdown className="dashboard-select" label="지원 단계 필터" value={filter}
              options={[{value: '', label: '전체 단계'}, ...stages]}
              onChange={value => {setFilter(value); setGroup('');}}/>
          </div>
        </div>
        <div className="dashboard-counts" aria-label="지원 상태별 보기">
          {groups.map(name => <button key={name} type="button" aria-pressed={!filter && group === name} onClick={() => {
            setGroup(name); setFilter('');
          }}>{name || '전체'} <span>{name ? applications.filter(item => stageGroup(item.status) === name).length : applications.length}</span></button>)}
        </div>
        {filtered.length ? <>
          <div className="dashboard-columns dashboard-grid" aria-hidden="true">
            <span>회사·직무</span><span>일정</span><span>단계</span>
          </div>
          <ul className="dashboard-rows">
            {filtered.map(application => {
              const schedules = allEvents(application).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
              const event = events.find(item => item.applicationId === application.id) ||
                schedules.find(item => !item.date) || schedules[0];
              const interview = events.find(item => item.applicationId === application.id && item.type === '면접') ||
                schedules.find(item => item.type === '면접' && !item.date);
              const separateInterview = interview && interview.id !== event?.id;
              const remaining = schedules.length - (separateInterview ? 2 : 1);
              const writingLabel = application.questions.length ? '자소서 열기' : '문항 추가';
              const setField = (field, value) => onApplicationChange(application.id, current => ({...current, [field]: value}));
              return <li key={application.id} className="dashboard-grid dashboard-row">
                <div className="dashboard-company">
                  <EditableField label="회사명 수정" value={application.company} maxLength={100} onSave={value => setField('company', value)}/>
                  <EditableField label="직무 수정" value={application.role} maxLength={150} onSave={value => setField('role', value)}/>
                </div>
                <button className="dashboard-event dashboard-field" type="button" aria-label={application.company + ' 일정 수정'}
                  onClick={() => setScheduleId(application.id)}>
                  {event ? <>
                    <strong>{event.date ? event.date.slice(5).replace('-', '.') + (event.time ? ' ' + event.time : '') : '날짜 미정'}</strong>
                    <span>{event.title}{!separateInterview && remaining > 0 && ' 외 ' + remaining + '건'}</span>
                    {separateInterview && <span className="dashboard-interview">
                      {interview.title} · {interview.date ? interview.date.slice(5).replace('-', '.') : '날짜 미정'}
                      {remaining > 0 && ' 외 ' + remaining + '건'}
                    </span>}
                  </> : '일정 없음'}
                </button>
                <Dropdown className="dashboard-stage-field"
                  triggerClassName={'dashboard-stage' + (stageGroup(application.status) === '전형 진행' ? ' accented' : '')}
                  label={application.company + ' 지원 단계 수정'} value={application.status}
                  options={stageOptions(application)} onChange={value => setField('status', value)}/>
                <a className="dashboard-write" href={'#' + writingPath(application)} aria-label={application.company + ' ' + writingLabel}
                  title={writingLabel}><span>{writingLabel}</span><ChevronRight size={14}/></a>
              </li>;
            })}
          </ul>
        </> : <Empty title={hasFilters ? '조건에 맞는 지원이 없어요' : '등록한 지원이 없어요'}
          action={hasFilters && <button className="career-button" onClick={() => {setGroup(''); setFilter(''); setSearch('');}}>필터 초기화</button>}/>}
      </section>
      <aside className="dashboard-agenda career-sheet" aria-labelledby="upcoming-title">
        <div className="dashboard-agenda-header">
          <h2 id="upcoming-title"><CalendarDays size={17} strokeWidth={1.7}/>다가오는 일정</h2>
          <a className="dashboard-agenda-link" href="#/schedule" aria-label="전체 일정 보기">전체 보기<ChevronRight size={14}/></a>
        </div>
        {events.length ? <ul>
          {events.slice(0, 5).map(event => <li key={event.applicationId + '/' + event.id}>
            <a href={event.type === '면접' ? '#/interviews/' + event.applicationId : '#/schedule?date=' + event.date}>
              <time dateTime={event.date}><strong>{event.date.slice(5).replace('-', '.')}</strong>
                <span>{weekdayLabel.format(new Date(event.date))}</span></time>
              <div><strong>{event.company}</strong><span>{event.title}{event.time ? ' · ' + event.time : ''}</span></div>
              <ChevronRight size={15} strokeWidth={1.6}/>
            </a>
          </li>)}
        </ul> : <p className="dashboard-agenda-empty">다가오는 지원 일정이 없어요.</p>}
      </aside>
      {recent.length > 0 && <section className="dashboard-recent career-sheet" aria-labelledby="dashboard-recent-title">
        <div className="dashboard-heading"><h2 id="dashboard-recent-title">최근 작성</h2></div>
        <ul>
          {recent.map(application => {
            const question = application.questions[0];
            const option = question.branches.find(branch => branch.id === question.activeBranchId) || question.branches[0];
            const count = question.snapshots.length;
            return <li key={application.id}><a href={'#' + writingPath(application)}>
              <span className="recent-icon"><FileText size={17} strokeWidth={1.7}/></span>
              <span><strong>{application.company}</strong><small>{option.name}</small></span>
              <span className="recent-count">스냅샷 {count}개</span><ChevronRight size={15} strokeWidth={1.6}/>
            </a></li>;
          })}
        </ul>
      </section>}
    </div>
    {scheduleApplication && <ApplicationSchedule application={scheduleApplication} onClose={() => setScheduleId('')}
      onSave={event => onApplicationChange(scheduleId, current => saveApplicationEvent(current, event))}/>}
  </>;
}

export function StageFields({stages,onChange}){return <div className="stage-fields">{stages.map((s,i)=><div key={i}><input aria-label={'채용 단계 '+(i+1)} value={s} onChange={e=>onChange(stages.map((v,j)=>i===j?e.target.value:v))} maxLength={50}/><IconButton label={'단계 '+(i+1)+' 위로'} disabled={i===0} onClick={()=>{const next=[...stages];[next[i-1],next[i]]=[next[i],next[i-1]];onChange(next)}}><ArrowUp size={15}/></IconButton><IconButton label={'단계 '+(i+1)+' 아래로'} disabled={i===stages.length-1} onClick={()=>{const next=[...stages];[next[i],next[i+1]]=[next[i+1],next[i]];onChange(next)}}><ArrowDown size={15}/></IconButton><IconButton label={'단계 '+(i+1)+' 삭제'} onClick={()=>onChange(stages.filter((_,j)=>i!==j))}><Trash2 size={15}/></IconButton></div>)}<button type="button" className="text-button" onClick={()=>onChange([...stages,''])}><Plus size={15}/>단계 추가</button></div>}
export function EventForm({event, allowUndated = false, fixedType, children, onSubmit, onClose, submitDisabled = false}) {
  const [data, setData] = useState(() => ({
    title: fixedType || '', type: fixedType || '면접', date: '', time: '', note: '', ...event,
  }));
  const [error, setError] = useState('');
  const change = (field, value) => setData(current => ({...current, [field]: value}));
  const hasEnd = !event?.deadline && Boolean(event?.endTime || (event?.endDate && event.endDate !== event.date));
  const dateOptional = allowUndated || Boolean(event?.id && !event.date);

  function submit(formEvent) {
    formEvent.preventDefault();
    if (submitDisabled) return;
    const title = data.title.trim();
    if (!title) {setError('일정 제목을 입력해 주세요.'); return;}
    const {date, time, endTime = '', note, type} = data;
    const endDate = hasEnd && data.endDate ? data.endDate : date;
    if (date) {
      const problem = validateScheduleItem({title, start: date, end: endDate, time, endTime});
      if (problem) {setError(problem); return;}
    }
    if (data.deadline) onSubmit({deadline: true, title, date, time: date ? time : '', note});
    else onSubmit({id: data.id || uid('event'), date, time: date ? time : '', title, type, note,
      ...(date && endDate !== date && {endDate}), ...(date && endTime && {endTime}), ...(data.color && {color: data.color})});
  }

  return <form onSubmit={submit}>
    {children}
    <Field label="일정 제목"><input value={data.title} onChange={e => change('title', e.target.value)}
      maxLength={100} required/></Field>
    {!fixedType && !data.deadline && <Dropdown field label="종류" value={data.type}
      options={[...new Set([...applicationEventTypes, data.type])]} onChange={value => change('type', value)}/>}
    <div className="form-grid">
      <Field label={hasEnd ? '시작일' : dateOptional ? '날짜 (선택)' : '날짜'}>
        <input type="date" value={data.date} onChange={e => {
          const date = e.target.value;
          setData(current => ({...current, date, endDate: current.endDate === current.date ? date : current.endDate}));
        }} required={!dateOptional || hasEnd}/>
      </Field>
      <Field label={hasEnd ? '시작 시간' : '시간'}>
        <input type="time" value={data.time} disabled={!data.date} onChange={e => change('time', e.target.value)}/>
      </Field>
    </div>
    {hasEnd && <div className="form-grid">
      <Field label="종료일"><input type="date" value={data.endDate || data.date} onChange={e => change('endDate', e.target.value)} required/></Field>
      <Field label="종료 시간"><input type="time" value={data.endTime || ''} onChange={e => change('endTime', e.target.value)}/></Field>
    </div>}
    <Field label="메모"><textarea value={data.note} onChange={e => change('note', e.target.value)} rows={3}/></Field>
    {error && <Notice type="error">{error}</Notice>}
    <div className="form-actions">
      <button type="button" className="button" onClick={onClose}>취소</button>
      <button className="button primary" type="submit" disabled={submitDisabled}>일정 저장</button>
    </div>
  </form>;
}
export function Detail({application:a,navigate,onSave,onDelete,onSaveQuestion}){const[submissionOpen,setSubmissionOpen]=useState(false),[event,setEvent]=useState(null),[procedure,setProcedure]=useState(false),[stages,setStages]=useState([...a.stages]),[remove,setRemove]=useState(false),[image,setImage]=useState('');React.useEffect(()=>{let url='',active=true;if(a.attachmentId)getAttachment(a.attachmentId).then(file=>{if(file&&active){url=URL.createObjectURL(file);setImage(url)}}).catch(()=>{});return()=>{active=false;if(url)URL.revokeObjectURL(url)}},[a.attachmentId]);return <><main className="page detail-page"><div className="detail-main"><BackLink className="page-back" to="/applications">지원 현황</BackLink><div className="detail-title section-heading"><div><p>{a.company}</p><h1>{a.role}</h1></div>{a.example&&<span className="example-badge">예시 지원</span>}</div><p className="muted">마감 {dateLabel(a.deadline,a.deadlineTime)}{a.deadline&&!a.deadlineTime?' · 시간 미정':''}</p><div className="detail-actions"><button className="button" onClick={()=>navigate('/posting/'+a.id)}>공고 수정</button><ApplyLink url={safeUrl(a.url)} onMissing={()=>navigate('/posting/'+a.id)}/></div><div className="section-heading"><h2>채용 절차</h2><button className="text-button" onClick={()=>{setStages([...a.stages]);setProcedure(true)}}>절차 수정</button></div><p className="procedure-line">{a.stages.length?a.stages.join(' → '):'등록한 채용 절차 없음'}</p>
 {postingSections(a).length>0&&<div className="posting-detail-sections">
  {postingSections(a).map(section=><Field label={section.title} key={section.id}>
   <textarea rows={Math.min(6,Math.max(2,section.body.split('\n').length))} value={section.body}
    onChange={event=>onSave({...a,sections:postingSections(a).map(item=>item.id===section.id?{...item,body:event.target.value}:item)})}/>
  </Field>)}
 </div>}
 <div className="section-heading"><h2>자소서 문항</h2><button className="text-button" onClick={()=>navigate('/posting/'+a.id)}><Plus size={15}/>{a.questions.length ? '문항 추가·수정' : '문항 추가'}</button></div>{!a.questions.length && <p className="muted">등록한 자소서 문항이 없어요.</p>}{a.questions.map((q,i)=><button className="question-link" key={q.id} onClick={()=>navigate('/write/'+a.id+'/'+q.id)}><span>Q{i+1}</span><strong>{q.prompt}</strong><small>{q.limit}자</small><ChevronRight size={16}/></button>)}{a.sourceText&&<details className="image-details posting-original"><summary>공고 원문 보기</summary><p>{a.sourceText}</p></details>}{image&&<details className="image-details"><summary>등록한 공고 이미지</summary><img className="posting-image" src={image} alt="보관한 공고"/></details>}<button className="text-button danger" onClick={()=>setRemove(true)}>지원 기록 삭제</button></div><aside className="application-side"><Dropdown field label="현재 단계" value={a.status} options={stageOptions(a)}
  onChange={status=>onSave({...a,status})}/><div className="section-heading"><h2>일정</h2><button className="text-button" onClick={()=>setEvent({})}><Plus size={15}/>추가</button></div>{allEvents(a).sort((x,y)=>x.date.localeCompare(y.date)).map(e=><div className="detail-event" key={e.id}><button onClick={()=>setEvent(e)}><small>{dateLabel(e.date,e.time)}</small><strong>{e.title}</strong></button>{!e.deadline&&<IconButton label={e.title+' 삭제'} onClick={()=>onSave({...a,events:a.events.filter(n=>n.id!==e.id)})}><Trash2 size={14}/></IconButton>}</div>)}<button className="button primary full" onClick={()=>navigate(writingPath(a))}>{a.questions.length ? '자소서 작성' : '문항 추가'}</button>{a.questions.length > 0 && <button className="button full" onClick={()=>setSubmissionOpen(true)}>제출본</button>}</aside></main>
 {submissionOpen&&<QuestionSubmissions application={a} currentQuestion={a.questions[0]} onSave={onSaveQuestion} onClose={()=>setSubmissionOpen(false)}/>}
 {event&&<Modal title={event.deadline?'지원 마감 수정':event.id?'일정 수정':'일정 추가'} onClose={()=>setEvent(null)}><EventForm event={event.id?event:undefined} onClose={()=>setEvent(null)} onSubmit={next=>{onSave(saveApplicationEvent(a,next));setEvent(null)}}/></Modal>}{procedure&&<Modal title="채용 절차 수정" onClose={()=>setProcedure(false)}><StageFields stages={stages} onChange={setStages}/><div className="form-actions"><button className="button" onClick={()=>setProcedure(false)}>취소</button><button className="button primary" onClick={()=>{const next=stages.map(s=>s.trim()).filter(Boolean);onSave({...a,stages:next,status:next.includes(a.status)||['관심','작성 중','최종 합격','불합격','지원 취소'].includes(a.status)?a.status:'관심'});setProcedure(false)}}>변경 반영</button></div></Modal>}{remove&&<Modal title="지원 기록 삭제" onClose={()=>setRemove(false)}><p>{a.company}의 문항·기록·일정을 함께 삭제합니다.</p><div className="form-actions"><button className="button" onClick={()=>setRemove(false)}>취소</button><button className="button danger-button" onClick={()=>{onDelete(a.id);navigate('/applications')}}>삭제</button></div></Modal>}</>}
