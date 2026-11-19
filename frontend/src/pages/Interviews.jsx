import React, {useState} from 'react';
import {Mic, Plus, Trash2} from 'lucide-react';
import {CareerHeader, writingPath} from '../components/CareerLayout.jsx';
import {Field, Modal, Notice} from '../components/UI.jsx';
import AnswerRecording from '../components/AnswerRecording.jsx';
import {deleteAttachment} from '../storage.js';
import {interviewFor, patchInterviewQuestion, timecode} from '../interview.js';
import {uid} from '../model.js';
import {todayKey} from '../schedule.js';

const timeLabel = (day, time) => new Intl.DateTimeFormat('ko-KR', {
  month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC',
}).format(new Date(day)) + (time ? ' · ' + time : '');
const recordDate = value => new Date(value).toLocaleDateString('ko-KR', {month: '2-digit', day: '2-digit'});
export const recordingKey = (application, question) => 'interview-audio/' + application.id + '/' + question.id;

function nextInterview(application) {
  const events = application.events.filter(event => event.type === '면접' && event.date)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return events.find(event => event.date >= todayKey()) || (application.example ? events.at(-1) : undefined);
}

export function interviewTitle(application) {
  return application.company + ' · ' + (nextInterview(application)?.title || '면접 준비');
}

function InterviewRecords({records, onOpen}) {
  return records.length > 0 ? <div className="interview-records">
    {records.map(({record, application}) => <article key={record.id}>
      <div><strong>{interviewTitle(application)}</strong>
        <p>{recordDate(record.createdAt)} · 음성 모의면접 · {timecode(record.duration)}</p></div>
      <button className="career-button" onClick={() => onOpen(application.id, record.id)}>기록 보기</button>
    </article>)}
  </div> : <p className="career-empty-copy">아직 연습 기록이 없어요.</p>;
}

export function Interviews({store, navigate, query}) {
  const {applications} = store;
  const records = applications.flatMap(application => interviewFor(application).records
    .map(record => ({application, record}))).sort((a, b) => b.record.createdAt.localeCompare(a.record.createdAt));
  const planned = applications.filter(application => nextInterview(application) ||
    application.submissions.length || interviewFor(application).questions.length ||
    ['서류 전형', '작성 중', '최종 면접', '기술 면접'].includes(application.status));
  const others = applications.filter(application => !planned.includes(application));
  const tab = query.get('tab') === 'records' ? 'records' : 'planned';
  const open = (id, record) => navigate('/interviews/' + id + '/' + record);

  return <>
    <CareerHeader title="면접 준비"/>
    <div className="career-content interview-list">
      <nav className="career-tabs" aria-label="면접 준비 보기">
        <a href="#/interviews" aria-current={tab === 'planned' ? 'page' : undefined}>예정 {planned.length}</a>
        <a href="#/interviews?tab=records" aria-current={tab === 'records' ? 'page' : undefined}>연습 기록</a>
      </nav>
      {tab === 'planned' ? <>
        <section className="interview-cards" aria-label="준비할 면접">
          {planned.map(application => {
            const event = nextInterview(application);
            const count = interviewFor(application).questions.length;
            const submitted = application.submissions.filter(item => item.submitted).at(-1);
            return <article className="interview-card" key={application.id}>
              <div><span className="dashboard-stage accented">{event?.title || application.status}</span>
                <h2>{application.company}</h2><p>{application.role}</p></div>
              <div><p>{event ? timeLabel(event.date, event.time) : '일정 미정'}</p>
                <p>{submitted ? '제출본 ' + recordDate(submitted.createdAt) : '제출본 없음 · 현재 작성본으로 연습 가능'}
                  {count > 0 && ' · 예상 질문 ' + count + '개'}</p></div>
              <button className="career-button primary" onClick={() => navigate('/interviews/' + application.id)}>준비하기</button>
            </article>;
          })}
          {!planned.length && <p className="career-empty-copy">예정된 면접이 없어요.</p>}
          {others.length > 0 && <label className="interview-add-from">
            <span>다른 지원 건</span>
            <select aria-label="면접 준비할 지원 건" value="" onChange={event => {
              if (event.target.value) navigate('/interviews/' + event.target.value);
            }}>
              <option value="">지원 건 선택</option>
              {others.map(item => <option value={item.id} key={item.id}>{item.company} · {item.role}</option>)}
            </select>
          </label>}
        </section>
        <section className="interview-recent"><h2>최근 연습</h2><InterviewRecords records={records.slice(0, 3)} onOpen={open}/></section>
      </> : <InterviewRecords records={records} onOpen={open}/>}
    </div>
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

function Materials({application, source, onChange, onClose, navigate}) {
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

export function InterviewDetail({application, query, navigate, onChange, storageError}) {
  const interview = interviewFor(application);
  const root = '/interviews/' + application.id;
  const tab = query.get('tab') === 'records' ? 'records' : 'questions';
  const question = interview.questions.find(item => item.id === query.get('question')) || interview.questions[0];
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

  return <>
    <CareerHeader title={interviewTitle(application)}>
      <button className="career-button interview-material-button" onClick={() => setDialog('materials')}>자료</button>
      <button className="career-button primary interview-start-button" onClick={() => setDialog('practice')}>모의면접</button>
    </CareerHeader>
    <div className="career-content interview-content">
      <nav className="career-tabs" aria-label="면접 준비">
        <a href={'#' + root} aria-current={tab === 'questions' ? 'page' : undefined}>예상 질문</a>
        <button type="button" onClick={() => setDialog('practice')}>모의면접</button>
        <a href={'#' + root + '?tab=records'} aria-current={tab === 'records' ? 'page' : undefined}>기록</a>
      </nav>
      {error && <Notice type="error">{error}</Notice>}
      {tab === 'records' ? <InterviewRecords records={interview.records.map(record => ({record, application}))}
        onOpen={(_, id) => navigate(root + '/' + id)}/> : <div className="interview-workspace">
        <aside className="interview-questions">
          <ol>
            {interview.questions.map((item, index) => <li key={item.id}>
              <button type="button" aria-current={item.id === question?.id ? 'true' : undefined} onClick={() => select(item.id)}>
                <span>{String(index + 1).padStart(2, '0')}</span>{item.prompt}
              </button>
            </li>)}
          </ol>
          <div className="interview-question-actions">
            <button className="career-button" onClick={() => setDialog('add')}><Plus size={13}/>질문</button>
            <button className="career-button" disabled={!question} onClick={() => setDialog('edit')}>편집</button>
          </div>
        </aside>
        {question ? <section className="interview-answer" aria-labelledby="interview-question">
          <h2 id="interview-question">{question.prompt}</h2>
          {question.basis && <button className="interview-basis" onClick={() => setDialog('materials')}>{question.basis}</button>}
          <div className="interview-answer-heading">
            <label htmlFor="interview-answer">답변</label>
            <button className="career-button" onClick={() => setDialog('audio')}><Mic size={16} strokeWidth={1.5}/>녹음</button>
            <span role="status">{storageError ? '저장 실패' : question.answer ? '저장됨' : ''}</span>
          </div>
          <textarea id="interview-answer" value={question.answer} maxLength={12000}
            placeholder="답변을 적어 보세요." onChange={event => updateQuestion({answer: event.target.value})}/>
        </section> : <p className="career-empty-copy">예상 질문을 추가하고 답변을 준비해 보세요.</p>}
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
    {dialog === 'materials' && <Materials application={application} source={interview.source} navigate={path => {
      setDialog(''); navigate(path);
    }} onChange={source => onChange(current => ({...current, source}))} onClose={() => setDialog('')}/>}
    {dialog === 'audio' && question && <AnswerRecording key={question.id} storageKey={recordingKey(application, question)}
      onClose={() => setDialog('')}/>}
    {dialog === 'practice' && <Modal title="음성 모의면접" className="interview-modal" onClose={() => setDialog('')}>
      <p className="interview-practice-company">{interviewTitle(application)}</p>
      <p>기준 · {selectedSource?.name || '현재 작성본'} / 채용 공고<br/>질문 · 예상 질문 {interview.questions.length}개</p>
      {!interview.questions.length ? <Notice>연습할 질문을 먼저 추가해 주세요.</Notice> :
        <Notice>마이크 권한이 필요해요. 이 미리보기는 질문을 읽어 주고 연습 기록을 남깁니다.</Notice>}
      <div className="form-actions">
        <button className="button" onClick={() => setDialog('')}>취소</button>
        <button className="button primary" disabled={!interview.questions.length} onClick={() => {
          setDialog(''); navigate(root + '/practice');
        }}>시작</button>
      </div>
    </Modal>}
  </>;
}
