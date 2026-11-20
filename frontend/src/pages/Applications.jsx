import React,{useRef,useState} from 'react';
import {Plus,ChevronRight,Search,ChevronDown,ArrowUp,ArrowDown,Trash2,CalendarDays,FileText,Pencil} from 'lucide-react';
import {Header,IconButton,Modal,Field,Notice,Empty,ApplyLink,dateLabel} from '../components/UI.jsx';
import {createApplication} from '../seed.js';
import {CareerHeader,recentApplications,writingPath} from '../components/CareerLayout.jsx';
import {createQuestion,uid,importPostingText,safeUrl} from '../model.js';
import {putAttachment,getAttachment} from '../storage.js';
import {applicationEventTypes, saveApplicationEvent, todayKey, validateScheduleItem} from '../schedule.js';
export const stageOptions=a=>[...new Set(['관심', '작성 중', ...a.stages, a.status, '최종 합격','불합격','지원 취소'])];
export function allEvents(a){return[...(a.deadline?[{id:'deadline-'+a.id,title:'지원 마감',type:'마감',date:a.deadline,time:a.deadlineTime||'',deadline:true}]:[]),...a.events].map(e=>({...e,applicationId:a.id,company:a.company}));}
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

  function finish(input, save, restoreFocus = false) {
    const next = input.value.trim();
    setEditing(false);
    if (save && next && next !== value) onSave(next);
    if (restoreFocus) requestAnimationFrame(() => button.current?.focus());
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
    <CareerHeader title="지원 현황">
      <button className="career-button primary" onClick={() => navigate('/posting')}><Plus size={16}/>공고 등록</button>
    </CareerHeader>
    <div className="career-content dashboard">
      <section className="dashboard-list career-sheet" aria-labelledby="dashboard-list-title">
        <div className="dashboard-heading">
          <h2 id="dashboard-list-title">지원 목록</h2>
          <div className="dashboard-filters">
            <label className="dashboard-search"><Search size={17} strokeWidth={1.7}/>
              <input aria-label="회사·직무 검색" placeholder="회사·직무 검색" value={search}
                onChange={event => setSearch(event.target.value)}/>
            </label>
            <label className="dashboard-select"><select aria-label="지원 단계 필터" value={filter}
              onChange={event => {setFilter(event.target.value); setGroup('');}}>
              <option value="">전체 단계</option>
              {stages.map(stage => <option key={stage}>{stage}</option>)}
            </select><ChevronDown size={14} strokeWidth={1.7}/></label>
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
                    <span>{event.title}</span>
                    {interview && interview.id !== event.id && <span className="dashboard-interview">
                      {interview.title} · {interview.date ? interview.date.slice(5).replace('-', '.') : '날짜 미정'}
                    </span>}
                  </> : '일정 없음'}
                </button>
                <div className="dashboard-stage-field">
                  <select className={'dashboard-stage' + (stageGroup(application.status) === '전형 진행' ? ' accented' : '')}
                    aria-label={application.company + ' 지원 단계 수정'} value={application.status}
                    onChange={event => setField('status', event.target.value)}>
                    {stageOptions(application).map(stage => <option key={stage}>{stage}</option>)}
                  </select>
                  <ChevronDown size={13} aria-hidden="true"/>
                </div>
                <a className="dashboard-write" href={'#' + writingPath(application)} aria-label={application.company + ' 자소서 열기'}
                  title="자소서 열기"><span>자소서 열기</span><ChevronRight size={14}/></a>
              </li>;
            })}
          </ul>
        </> : <Empty title={hasFilters ? '조건에 맞는 지원이 없어요' : '등록한 지원이 없어요'}
          action={hasFilters ? <button className="career-button" onClick={() => {setGroup(''); setFilter(''); setSearch('');}}>필터 초기화</button> :
            <button className="career-button primary" onClick={() => navigate('/posting')}>공고 등록</button>}/>}
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

export function Posting({onAdd,navigate,existing,onSave}){const[tab,setTab]=useState(existing?.source||'link'),[step,setStep]=useState(existing?2:1),[text,setText]=useState(existing?.sourceText||''),[url,setUrl]=useState(existing?.url||''),[image,setImage]=useState(null),[preview,setPreview]=useState(''),[error,setError]=useState(''),[data,setData]=useState(existing?{...existing,questions:existing.questions.map(q=>({id:q.id,prompt:q.prompt,limit:q.limit})),stages:[...existing.stages]}:{company:'',role:'',duties:'',requirements:'',deadline:'',deadlineTime:'',stages:['서류 전형','기술 면접','최종 면접'],questions:[{prompt:'',limit:1000}]});
 const change=(key,value)=>setData(d=>({...d,[key]:value}));
 function prepare(){setError('');if(tab==='link'&&url&&!safeUrl(url)){setError('http 또는 https 공고 주소를 입력해 주세요.');return;}const parsed=text.trim()?importPostingText(text):null;if(parsed)setData(d=>({...d,...Object.fromEntries(Object.entries(parsed).filter(([k,v])=>Array.isArray(v)?v.length:!!v))}));setStep(2);}
 async function submit(e){e.preventDefault();const form=new FormData(e.currentTarget);setError('');if(!data.company.trim()||!data.role.trim()){setError('회사와 직무를 입력해 주세요.');return;}const questions=data.questions.filter(q=>q.prompt.trim());if(!questions.length){setError('자소서 문항을 하나 이상 입력해 주세요.');return;}try{let attachmentId=existing?.attachmentId||'';if(image){attachmentId=uid('attachment');await putAttachment(attachmentId,image);}const values={...data,deadline:String(form.get('deadline')||''),deadlineTime:String(form.get('deadlineTime')||''),questions,stages:data.stages.map(s=>s.trim()).filter(Boolean),url:safeUrl(url),source:tab,sourceText:text,attachmentId};if(existing){onSave({...existing,...values,questions:questions.map(q=>{const old=existing.questions.find(n=>n.id===q.id);return old?{...old,prompt:q.prompt,limit:Number(q.limit)||1000}:createQuestion(q.prompt,q.limit)})});navigate('/application/'+existing.id);}else{const app=createApplication(values);onAdd(app);navigate('/write/'+app.id+'/'+app.questions[0].id);}}catch{setError('이미지를 보관하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');}}
 return <><Header title={existing?'공고 수정':'공고 등록'} back="지원 현황" onBack={()=>navigate(existing?'/application/'+existing.id:'/applications')}/><div className="page posting-page"><h1>{existing?'공고 수정':step===1?'공고 등록':'공고 정보 확인'}</h1>{step===1?<><div className="tabs posting-tabs">{[['link','링크'],['image','이미지'],['text','텍스트']].map(([k,label])=><button className={tab===k?'active':''} key={k} onClick={()=>setTab(k)}>{label}</button>)}</div>{tab==='link'&&<><Field label="공고 링크"><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://" type="url"/></Field><Notice>링크 자동 수집은 연결 전입니다. 공고 내용을 붙여넣거나 다음 화면에서 직접 입력해 주세요.</Notice></>}{tab==='image'&&<><Field label="공고 이미지"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files[0];if(!file)return;if(file.size>10*1024*1024){setError('10MB 이하 이미지를 선택해 주세요.');return;}setImage(file);const r=new FileReader();r.onload=()=>setPreview(r.result);r.readAsDataURL(file)}}/></Field>{preview&&<img className="posting-image" src={preview} alt="등록할 공고"/>}<Notice>이미지 텍스트 인식은 연결 전입니다. 이미지는 보관하고 정보는 직접 입력할 수 있어요.</Notice></>}{(tab==='text'||tab==='link')&&<Field label={tab==='text'?'공고 본문':'공고 본문 붙여넣기'}><textarea rows={12} value={text} onChange={e=>setText(e.target.value)} placeholder={'회사명: 회사\n직무: 백엔드 개발자\n주요 업무\n...\n자격 요건\n...\n자기소개서\n1. 지원동기 (700자)'}/></Field>}{error&&<Notice type="error">{error}</Notice>}<div className="form-actions"><button className="button primary" onClick={prepare}>정보 확인 · 직접 입력</button></div></>:<form onSubmit={submit}><div className="form-grid"><Field label="회사"><input value={data.company} onChange={e=>change('company',e.target.value)} maxLength={100} required/></Field><Field label="직무"><input value={data.role} onChange={e=>change('role',e.target.value)} maxLength={150} required/></Field></div><Field label="지원 링크"><input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://"/></Field><div className="form-grid"><Field label="지원 마감일"><input type="date" name="deadline" value={data.deadline} onChange={e=>change('deadline',e.target.value)}/></Field><Field label="마감 시간" hint="알 수 없으면 비워 두세요."><input type="time" name="deadlineTime" value={data.deadlineTime} onChange={e=>change('deadlineTime',e.target.value)}/></Field></div><Field label="주요 업무"><textarea rows={4} value={data.duties} onChange={e=>change('duties',e.target.value)}/></Field><Field label="자격 요건"><textarea rows={4} value={data.requirements} onChange={e=>change('requirements',e.target.value)}/></Field><h2>채용 절차</h2><StageFields stages={data.stages} onChange={s=>change('stages',s)}/><div className="section-heading"><h2>자소서 문항</h2><button type="button" className="text-button" onClick={()=>change('questions',[...data.questions,{prompt:'',limit:1000}])}><Plus size={15}/>문항 추가</button></div>{data.questions.map((q,i)=><div className="question-field" key={q.id||i}><Field label={'Q'+(i+1)}><textarea rows={2} value={q.prompt} onChange={e=>change('questions',data.questions.map((n,j)=>i===j?{...n,prompt:e.target.value}:n))} required/></Field><Field label="글자 수"><input type="number" min={1} max={100000} value={q.limit} onChange={e=>change('questions',data.questions.map((n,j)=>i===j?{...n,limit:Number(e.target.value)}:n))}/></Field>{(!existing||!q.id)&&<IconButton label={'Q'+(i+1)+' 삭제'} onClick={()=>change('questions',data.questions.filter((_,j)=>j!==i))}><Trash2 size={16}/></IconButton>}</div>)}{error&&<Notice type="error">{error}</Notice>}<div className="form-actions">{!existing&&<button type="button" className="button" onClick={()=>setStep(1)}>이전</button>}<button type="submit" className="button primary">{existing?'변경 반영':'등록하고 작성'}</button></div></form>}</div></>}
export function StageFields({stages,onChange}){return <div className="stage-fields">{stages.map((s,i)=><div key={i}><input aria-label={'채용 단계 '+(i+1)} value={s} onChange={e=>onChange(stages.map((v,j)=>i===j?e.target.value:v))} maxLength={50}/><IconButton label={'단계 '+(i+1)+' 위로'} disabled={i===0} onClick={()=>{const next=[...stages];[next[i-1],next[i]]=[next[i],next[i-1]];onChange(next)}}><ArrowUp size={15}/></IconButton><IconButton label={'단계 '+(i+1)+' 아래로'} disabled={i===stages.length-1} onClick={()=>{const next=[...stages];[next[i],next[i+1]]=[next[i+1],next[i]];onChange(next)}}><ArrowDown size={15}/></IconButton><IconButton label={'단계 '+(i+1)+' 삭제'} onClick={()=>onChange(stages.filter((_,j)=>i!==j))}><Trash2 size={15}/></IconButton></div>)}<button type="button" className="text-button" onClick={()=>onChange([...stages,''])}><Plus size={15}/>단계 추가</button></div>}
export function EventForm({event, allowUndated = false, fixedType, children, onSubmit, onClose}) {
  const [data, setData] = useState(() => ({
    title: fixedType || '', type: fixedType || '면접', date: '', time: '', note: '', ...event,
  }));
  const [error, setError] = useState('');
  const change = (field, value) => setData(current => ({...current, [field]: value}));
  const hasEnd = !event?.deadline && Boolean(event?.endTime || (event?.endDate && event.endDate !== event.date));
  const dateOptional = allowUndated || !event?.date && Boolean(event?.id);

  function submit(formEvent) {
    formEvent.preventDefault();
    const title = data.title.trim();
    if (!title) {setError('일정 제목을 입력해 주세요.'); return;}
    const {date, time, endTime = '', note, type} = data;
    const endDate = hasEnd && data.endDate ? data.endDate : date;
    if (date) {
      const problem = validateScheduleItem({title, start: date, end: endDate, time, endTime});
      if (problem) {setError(problem); return;}
    }
    if (data.deadline) onSubmit({deadline: true, date, time: date ? time : ''});
    else onSubmit({id: data.id || uid('event'), date, time: date ? time : '', title, type, note,
      ...(date && endDate !== date && {endDate}), ...(date && endTime && {endTime})});
  }

  return <form onSubmit={submit}>
    {children}
    {!data.deadline && <Field label="일정 제목"><input value={data.title} onChange={e => change('title', e.target.value)}
      maxLength={100} required/></Field>}
    {!fixedType && !data.deadline && <Field label="종류"><select value={data.type} onChange={e => change('type', e.target.value)}>
      {[...new Set([...applicationEventTypes, data.type])].map(type => <option key={type}>{type}</option>)}
    </select></Field>}
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
    {!data.deadline && <Field label="메모"><textarea value={data.note} onChange={e => change('note', e.target.value)} rows={3}/></Field>}
    {error && <Notice type="error">{error}</Notice>}
    <div className="form-actions">
      <button type="button" className="button" onClick={onClose}>취소</button>
      <button className="button primary" type="submit">일정 저장</button>
    </div>
  </form>;
}
export function Detail({application:a,navigate,onSave,onDelete,onSubmission}){const[event,setEvent]=useState(null),[procedure,setProcedure]=useState(false),[stages,setStages]=useState([...a.stages]),[remove,setRemove]=useState(false),[image,setImage]=useState('');React.useEffect(()=>{let url='',active=true;if(a.attachmentId)getAttachment(a.attachmentId).then(file=>{if(file&&active){url=URL.createObjectURL(file);setImage(url)}}).catch(()=>{});return()=>{active=false;if(url)URL.revokeObjectURL(url)}},[a.attachmentId]);return <><Header title={a.company} subtitle={a.role} back="지원 현황" onBack={()=>navigate('/applications')}><button className="button" onClick={()=>navigate('/posting/'+a.id)}>공고 수정</button><ApplyLink url={safeUrl(a.url)} onMissing={()=>navigate('/posting/'+a.id)}/></Header><div className="page detail-page"><div className="detail-main"><div className="section-heading"><h1>{a.role}</h1>{a.example&&<span className="example-badge">예시 지원</span>}</div><p className="muted">마감 {dateLabel(a.deadline,a.deadlineTime)}{a.deadline&&!a.deadlineTime?' · 시간 미정':''}</p><div className="section-heading"><h2>채용 절차</h2><button className="text-button" onClick={()=>{setStages([...a.stages]);setProcedure(true)}}>절차 수정</button></div><p className="procedure-line">{a.stages.length?a.stages.join(' → '):'등록한 채용 절차 없음'}</p><Field label="주요 업무"><textarea rows={4} value={a.duties} onChange={e=>onSave({...a,duties:e.target.value})}/></Field><Field label="자격 요건"><textarea rows={4} value={a.requirements} onChange={e=>onSave({...a,requirements:e.target.value})}/></Field><div className="section-heading"><h2>자소서 문항</h2><button className="text-button" onClick={()=>navigate('/posting/'+a.id)}><Plus size={15}/>문항 추가·수정</button></div>{a.questions.map((q,i)=><button className="question-link" key={q.id} onClick={()=>navigate('/write/'+a.id+'/'+q.id)}><span>Q{i+1}</span><strong>{q.prompt}</strong><small>{q.limit}자</small><ChevronRight size={16}/></button>)}{image&&<details className="image-details"><summary>등록한 공고 이미지</summary><img className="posting-image" src={image} alt="보관한 공고"/></details>}<button className="text-button danger" onClick={()=>setRemove(true)}>지원 기록 삭제</button></div><aside className="application-side"><Field label="현재 단계"><select value={a.status} onChange={e=>onSave({...a,status:e.target.value})}>{stageOptions(a).map(s=><option key={s}>{s}</option>)}</select></Field><div className="section-heading"><h2>일정</h2><button className="text-button" onClick={()=>setEvent({})}><Plus size={15}/>추가</button></div>{allEvents(a).sort((x,y)=>x.date.localeCompare(y.date)).map(e=><div className="detail-event" key={e.id}><button onClick={()=>e.deadline?navigate('/posting/'+a.id):setEvent(e)}><small>{dateLabel(e.date,e.time)}</small><strong>{e.title}</strong></button>{!e.deadline&&<IconButton label={e.title+' 삭제'} onClick={()=>onSave({...a,events:a.events.filter(n=>n.id!==e.id)})}><Trash2 size={14}/></IconButton>}</div>)}<button className="button primary full" onClick={()=>navigate('/write/'+a.id+'/'+a.questions[0].id)}>자소서 작성</button><button className="button full" onClick={()=>onSubmission(a)}>제출본 관리 <small>{a.submissions.length}</small></button></aside></div>{event&&<Modal title={event.id?'일정 수정':'일정 추가'} onClose={()=>setEvent(null)}><EventForm event={event.id?event:undefined} onClose={()=>setEvent(null)} onSubmit={next=>{onSave(saveApplicationEvent(a,next));setEvent(null)}}/></Modal>}{procedure&&<Modal title="채용 절차 수정" onClose={()=>setProcedure(false)}><StageFields stages={stages} onChange={setStages}/><div className="form-actions"><button className="button" onClick={()=>setProcedure(false)}>취소</button><button className="button primary" onClick={()=>{const next=stages.map(s=>s.trim()).filter(Boolean);onSave({...a,stages:next,status:next.includes(a.status)||['관심','작성 중','최종 합격','불합격','지원 취소'].includes(a.status)?a.status:'관심'});setProcedure(false)}}>변경 반영</button></div></Modal>}{remove&&<Modal title="지원 기록 삭제" onClose={()=>setRemove(false)}><p>{a.company}의 문항·기록·일정을 함께 삭제합니다.</p><div className="form-actions"><button className="button" onClick={()=>setRemove(false)}>취소</button><button className="button danger-button" onClick={()=>{onDelete(a.id);navigate('/applications')}}>삭제</button></div></Modal>}</>}
