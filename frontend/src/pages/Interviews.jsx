import React, {useState} from 'react';
import {ArrowLeft, ArrowRight, CalendarDays, Mic, Plus, Trash2} from 'lucide-react';
import {CareerHeader, writingPath} from '../components/CareerLayout.jsx';
import {Field, Modal, Notice} from '../components/UI.jsx';
import AnswerRecording from '../components/AnswerRecording.jsx';
import InterviewSetup from '../components/InterviewSetup.jsx';
import {deleteAttachment} from '../storage.js';
import {interviewFor, patchInterviewQuestion, practiceModeLabels, timecode} from '../interview.js';
import {designatedSubmissionAnswers, uid} from '../model.js';
import {saveApplicationEvent, todayKey} from '../schedule.js';
import {EventForm} from './Applications.jsx';

const timeLabel = (day, time) => new Intl.DateTimeFormat('ko-KR', {
  month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC',
}).format(new Date(day)) + (time ? ' · ' + time : '');
const recordDate = value => new Date(value).toLocaleDateString('ko-KR', {month: '2-digit', day: '2-digit'});
export const recordingKey = (application, question) => 'interview-audio/' + application.id + '/' + question.id;

function plannedInterviews(application) {
  const today = todayKey();
  const events = application.events.filter(event => event.type === '면접');
  const dated = events.filter(event => event.date).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const active = [...dated.filter(event => (event.endDate || event.date) >= today), ...events.filter(event => !event.date)];
  return active.length ? active : dated.slice(-1);
}

export function interviewTitle(application) {
  return application.company + ' · ' + (plannedInterviews(application)[0]?.title || '면접 준비');
}

function InterviewRecords({records, onOpen}) {
  return records.length > 0 ? <div className="interview-records">
    {records.map(({record, application}) => <article className="career-sheet" key={application.id + '/' + record.id}>
      <div><strong>{interviewTitle(application)}</strong>
        <p>{recordDate(record.createdAt)} · {practiceModeLabels[record.mode || 'expected']} · {timecode(record.duration)}</p></div>
      <button className="career-button" onClick={() => onOpen(application.id, record.id)}>기록 보기</button>
    </article>)}
  </div> : <p className="career-empty-copy">아직 연습 기록이 없어요.</p>;
}

function AddInterview({applications, onSave, onClose}) {
  const [id, setId] = useState(() => applications.length === 1 ? applications[0].id : '');
  return <Modal title="면접 추가" onClose={onClose} className="interview-modal">
    <EventForm fixedType="면접" allowUndated onClose={onClose} onSubmit={event => onSave(id, event)}>
      <Field label="지원 건"><select value={id} onChange={event => setId(event.target.value)} required>
        <option value="" disabled>지원 건 선택</option>
        {applications.map(item => <option key={item.id} value={item.id}>{item.company} · {item.role}</option>)}
      </select></Field>
    </EventForm>
  </Modal>;
}

export function Interviews({store, navigate, query, onApplicationChange, onInterviewChange}) {
  const [adding, setAdding] = useState(false);
  const {applications} = store;
  const records = applications.flatMap(application => interviewFor(application).records
    .map(record => ({application, record}))).sort((a, b) => b.record.createdAt.localeCompare(a.record.createdAt));
  const planned = applications.map(application => ({application, events: plannedInterviews(application)}))
    .filter(({application, events}) => events.length || application.submissions.length || designatedSubmissionAnswers(application).length ||
      interviewFor(application).questions.length ||
      ['서류 전형', '작성 중', '최종 면접', '기술 면접'].includes(application.status));
  const tab = query.get('tab') === 'records' ? 'records' : 'planned';
  const recordsPath = '/interviews?tab=records';
  const opened = tab === 'records' && records.find(({application, record}) =>
    application.id === query.get('application') && record.id === query.get('record'));
  const open = (id, record) => navigate(recordsPath + '&' + new URLSearchParams({application: id, record}));

  return <>
    <CareerHeader title="면접 준비">
      <button className="career-button primary" onClick={() => applications.length ? setAdding(true) : navigate('/posting')}>
        <Plus size={16}/>{applications.length ? '면접 추가' : '공고 등록'}
      </button>
    </CareerHeader>
    <div className="career-content interview-list">
      <nav className="career-tabs" aria-label="면접 준비 보기">
        <a href="#/interviews" aria-current={tab === 'planned' ? 'page' : undefined}>준비 목록 <span>{planned.length}</span></a>
        <a href={'#' + recordsPath} aria-current={tab === 'records' ? 'page' : undefined}>연습 기록</a>
      </nav>
      {tab === 'planned' ? <>
        <section className="interview-cards" aria-label="준비할 면접">
          {planned.map(({application, events}) => {
            const count = interviewFor(application).questions.length;
            const submitted = application.submissions.filter(item => item.submitted).at(-1);
            return <article className="interview-card" key={application.id}>
              <div className="interview-card-identity">
                <h2>{application.company}</h2><p>{application.role}</p>
                {(count > 0 || submitted) && <small>{[
                  count > 0 && '예상 질문 ' + count + '개', submitted && '제출본 ' + recordDate(submitted.createdAt),
                ].filter(Boolean).join(' · ')}</small>}
              </div>
              <div className="interview-card-schedule">
                <CalendarDays size={17} strokeWidth={1.65} aria-hidden="true"/>
                <ul>{events.length ? events.map(event => <li key={event.id}>
                  <strong>{event.title}</strong>
                  <span>{event.date ? timeLabel(event.date, event.time) : '날짜 미정'}</span>
                </li>) : <li><strong>{application.status}</strong><span>일정 미정</span></li>}</ul>
              </div>
              <a className="career-button interview-open" href={'#/interviews/' + application.id}
                aria-label={application.company + ' 면접 준비하기'}>준비하기<ArrowRight size={14}/></a>
            </article>;
          })}
          {!planned.length && <p className="career-empty-copy">예정된 면접이 없어요.</p>}
        </section>
        {records.length > 0 && <section className="interview-recent"><h2>최근 연습</h2>
          <InterviewRecords records={records.slice(0, 3)} onOpen={open}/>
        </section>}
      </> : opened ? <InterviewRecord key={opened.application.id + '/' + opened.record.id} {...opened} backPath={recordsPath}
        onChange={action => onInterviewChange(opened.application.id, action)}/> : <InterviewRecords records={records} onOpen={open}/>}
    </div>
    {adding && <AddInterview applications={applications} onClose={() => setAdding(false)} onSave={(id, event) => {
      onApplicationChange(id, application => saveApplicationEvent(application, event));
      setAdding(false);
      if (tab === 'records') navigate('/interviews');
    }}/>}
  </>;
}

function QuestionDialog({question, onSave, onDelete, onClose}) {
  const [prompt, setPrompt] = useState(question?.prompt || '');
  const [basis, setBasis] = useState(question?.basis || '');
  const [danger, setDanger] = useState(false);

  return <Modal title={danger ? '질문 삭제' : question ? '질문 편집' : '질문 추가'} onClose={onClose} className="interview-modal">
    {danger ? <>
      <p>이 질문과 저장된 답변·녹음을 삭제할까요?</p>
      <div className="form-actions"><button className="button" onClick={() => setDanger(false)}>돌아가기</button>
        <button className="button danger" onClick={onDelete}>삭제</button></div>
    </> : <form onSubmit={event => {
      event.preventDefault();
      if (prompt.trim()) onSave({prompt: prompt.trim(), basis: basis.trim()});
    }}>
      <Field label="질문"><textarea required rows={3} maxLength={300} placeholder="연습할 질문을 입력하세요."
        value={prompt} onChange={event => setPrompt(event.target.value)}/></Field>
      <Field label="참고 내용"><input maxLength={160} value={basis} onChange={event => setBasis(event.target.value)}/></Field>
      <div className="form-actions">
        {question && <button className="button schedule-remove" type="button" onClick={() => setDanger(true)}>
          <Trash2 size={14}/>삭제</button>}
        <button className="button" type="button" onClick={onClose}>취소</button>
        <button className="button primary" disabled={!prompt.trim()}>{question ? '확인' : '추가'}</button>
      </div>
    </form>}
  </Modal>;
}

function Materials({application, designated, source, onChange, onClose, navigate}) {
  const saved = application.submissions.find(record => record.id === source);
  const [choosing, setChoosing] = useState(false);
  const [draft, setDraft] = useState(saved?.id || '');

  return <Modal title={choosing ? '연습 기준' : '자료'} onClose={onClose} className="interview-modal">
    {choosing ? <>
      <p>제출한 내용 또는 현재 작성본을 선택하세요.</p>
      <div className="interview-materials">
        {application.submissions.map(record => <label key={record.id}>
          <input type="radio" name="materials" checked={draft === record.id} onChange={() => setDraft(record.id)}/>
          <span><strong>{record.name}</strong><small>{record.answers.length}개 문항 · 제출본</small></span>
        </label>)}
        <label><input type="radio" name="materials" checked={!draft} onChange={() => setDraft('')}/>
          <span><strong>현재 작성본</strong><small>현재 편집 중인 자소서</small></span></label>
      </div>
      <div className="form-actions"><button className="button" onClick={() => setChoosing(false)}>취소</button>
        <button className="button primary" onClick={() => {onChange(draft); setChoosing(false);}}>선택</button></div>
    </> : <>
      {designated.length > 0 && <div className="interview-designated">
        <h3>문항별 제출본</h3>
        {designated.map(answer => <details key={answer.questionId}>
          <summary>문항 {answer.number} · {answer.label}</summary>
          <p>{answer.text}</p>
        </details>)}
      </div>}
      <div className="interview-materials">
        <button className="button" onClick={() => navigate(saved ? '/submissions/' + application.id : writingPath(application))}>
          {saved?.name || '현재 작성본'}
        </button>
        <button className="button" onClick={() => navigate('/application/' + application.id)}>채용 공고 · {application.company}</button>
      </div>
      <div className="form-actions"><button className="button" onClick={() => setChoosing(true)}>변경</button>
        <button className="button primary" onClick={onClose}>닫기</button></div>
    </>}
  </Modal>;
}

export function InterviewDetail({application, record, query, navigate, onChange, onPracticeStart, storageError}) {
  const interview = interviewFor(application);
  const root = '/interviews/' + application.id;
  const requestedTab = query.get('tab');
  const tab = record ? 'records' : ['practice', 'records'].includes(requestedTab) ? requestedTab : 'questions';
  const question = interview.questions.find(item => item.id === query.get('question')) || interview.questions[0];
  const questionsPath = root + (question ? '?question=' + encodeURIComponent(question.id) : '');
  const practicePath = root + '?tab=practice' + (question ? '&question=' + encodeURIComponent(question.id) : '');
  const recordsPath = root + '?tab=records';
  const [dialog, setDialog] = useState('');
  const [error, setError] = useState('');

  function select(id) { navigate(root + '?question=' + encodeURIComponent(id)); }
  function updateQuestion(patch) {
    onChange(current => patchInterviewQuestion(current, question.id, patch));
  }
  async function removeQuestion() {
    try {
      await deleteAttachment(recordingKey(application, question));
      onChange(current => ({...current, questions: current.questions.filter(item => item.id !== question.id)}));
      navigate(root);
      setDialog('');
    } catch {
      setError('질문을 삭제하지 못했어요. 다시 시도해 주세요.');
      setDialog('');
    }
  }
  const selectedSource = application.submissions.find(record => record.id === interview.source);
  const designated = designatedSubmissionAnswers(application);
  const practiceMode = query.get('mode') || (designated.length ? 'materials' : 'expected');

  return <>
    <CareerHeader title={application.company}
      subtitle={[application.role, plannedInterviews(application)[0]?.title].filter(Boolean).join(' · ')}>
      {tab !== 'practice' && <button className="career-button interview-material-button" onClick={() => setDialog('materials')}>자료</button>}
      {tab !== 'practice' && <a className="career-button primary interview-start-button" href={'#' + practicePath}>AI 모의면접</a>}
    </CareerHeader>
    <div className="career-content interview-content">
      <nav className="career-tabs" aria-label="면접 준비">
        <a href={'#' + questionsPath} aria-current={tab === 'questions' ? 'page' : undefined}>예상 질문</a>
        <a href={'#' + practicePath} aria-current={tab === 'practice' ? 'page' : undefined}>AI 모의면접</a>
        <a href={'#' + recordsPath} aria-current={tab === 'records' ? 'page' : undefined}>기록</a>
      </nav>
      {error && <Notice type="error">{error}</Notice>}
      {record ? <InterviewRecord key={record.id} record={record} application={application} backPath={recordsPath} onChange={onChange}/> :
        tab === 'records' ? <InterviewRecords records={interview.records.map(record => ({record, application}))}
        onOpen={(_, id) => navigate(root + '/' + id)}/> : tab === 'practice' ?
        <InterviewSetup key={practiceMode} application={application} source={selectedSource} designated={designated} questions={interview.questions}
          initialMode={practiceMode === 'materials' ? 'materials' : 'expected'} expired={query.has('expired')}
          questionsPath={questionsPath} onStart={onPracticeStart}/> :
        <div className="interview-workspace">
        <aside className="interview-questions">
          <div className="interview-question-header">
            <h2>질문 <span>{interview.questions.length}</span></h2>
            <div className="interview-question-actions">
              <button className="career-button" onClick={() => setDialog('add')}><Plus size={13}/>질문</button>
              <button className="career-button" disabled={!question} onClick={() => setDialog('edit')}>편집</button>
            </div>
          </div>
          <ol>
            {interview.questions.map((item, index) => <li key={item.id}>
              <button type="button" aria-current={item.id === question?.id ? 'true' : undefined} onClick={() => select(item.id)}>
                <span>{String(index + 1).padStart(2, '0')}</span>{item.prompt}
              </button>
            </li>)}
          </ol>
        </aside>
        {question ? <section className="interview-answer" aria-labelledby="interview-question">
          <h2 id="interview-question">{question.prompt}</h2>
          {question.basis && <button className="interview-basis" onClick={() => setDialog('materials')}>{question.basis}</button>}
          <div className="interview-answer-heading">
            <label htmlFor="interview-answer">답변</label>
            <span role="status">{storageError ? '저장 실패' : question.answer ? '저장됨' : ''}</span>
            <button className="career-button" onClick={() => setDialog('audio')}><Mic size={16} strokeWidth={1.5}/>녹음</button>
          </div>
          <textarea id="interview-answer" value={question.answer} maxLength={12000}
            placeholder="답변을 적어 보세요." onChange={event => updateQuestion({answer: event.target.value})}/>
        </section> : <div className="interview-answer interview-answer-empty">
          <p className="career-empty-copy">예상 질문을 추가하고 답변을 준비해 보세요.</p>
          <button className="career-button primary" onClick={() => setDialog('add')}><Plus size={15}/>질문 추가</button>
        </div>}
      </div>}
    </div>
    {(dialog === 'add' || dialog === 'edit') && <QuestionDialog question={dialog === 'edit' ? question : null}
      onClose={() => setDialog('')} onDelete={removeQuestion}
      onSave={patch => {
        if (dialog === 'edit') updateQuestion(patch);
        else {
          const item = {id: uid('question'), ...patch, answer: ''};
          onChange(current => ({...current, questions: [...current.questions, item]}));
          select(item.id);
        }
        setDialog('');
      }}/>}
    {dialog === 'materials' && <Materials application={application} designated={designated} source={interview.source} navigate={path => {
      setDialog(''); navigate(path);
    }} onChange={source => onChange(current => ({...current, source}))} onClose={() => setDialog('')}/>}
    {dialog === 'audio' && question && <AnswerRecording key={question.id} storageKey={recordingKey(application, question)}
      onClose={() => setDialog('')}/>}
  </>;
}

function InterviewRecord({application, record, backPath, onChange}) {
  const [index, setIndex] = useState(0);
  const question = record.questions[index];
  return <section className="practice-record career-sheet" aria-label="면접 연습 기록">
    <div className="practice-record-meta">
      <a className="career-button" href={'#' + backPath}><ArrowLeft size={14}/>기록 목록</a>
      <span>{application.company} · {practiceModeLabels[record.mode || 'expected']} · {recordDate(record.createdAt)} · {timecode(record.duration)}</span>
    </div>
    <div className="practice-record-nav">
      <span className="dashboard-stage accented">질문 {index + 1} / {record.questions.length}</span>
      {record.questions.length > 1 && <div>
        <button className="career-button" disabled={index === 0} onClick={() => setIndex(index - 1)}>이전</button>
        <button className="career-button" disabled={index === record.questions.length - 1} onClick={() => setIndex(index + 1)}>다음</button>
      </div>}
    </div>
    <h2>{question.prompt}</h2>
    <label htmlFor="practice-note">다음 연습에서 확인할 것</label>
    <textarea id="practice-note" maxLength={12000} value={record.note} onChange={event => {
      const note = event.target.value;
      onChange(previous => ({...previous, records: previous.records.map(item => item.id === record.id ? {...item, note} : item)}));
    }}/>
    <div className="practice-controls">
      <a className="career-button primary" href={'#/interviews/' + application.id + '?tab=practice&mode=' + (record.mode || 'expected')}>다시 연습</a>
      <a className="career-button" href={'#' + writingPath(application)}>자소서 확인</a>
    </div>
  </section>;
}
