import React, {lazy, Suspense, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import Auth from './pages/Auth.jsx';
import Schedule from './pages/Schedule.jsx';
import {interviewFor} from './interview.js';
import {Applications, Posting, Detail} from './pages/Applications.jsx';
import Editor from './pages/Editor.jsx';
import Merge from './pages/Merge.jsx';
import Submissions from './pages/Submissions.jsx';
import {CareerLayout} from './components/CareerLayout.jsx';
import {Modal, Field, Notice, Empty, useHashRoute} from './components/UI.jsx';
import {loadStore, saveStore, downloadBackup, STORE_KEY} from './storage.js';
import {validateStore, errorMessage, updateQuestion} from './model.js';
import './styles.css';
import './career.css';
import './workspace.css';

const Interviews = lazy(() => import('./pages/Interviews.jsx').then(module => ({default: module.Interviews})));
const InterviewDetail = lazy(() => import('./pages/Interviews.jsx').then(module => ({default: module.InterviewDetail})));
const InterviewPractice = lazy(() => import('./pages/InterviewPractice.jsx').then(module => ({default: module.InterviewPractice})));

const pageTitles = {
  applications: '지원 현황', schedule: '일정', interviews: '면접 준비',
  posting: '공고 등록', write: '작성', merge: '병합', submissions: '제출본',
  login: '로그인', signup: '회원가입', 'signup-details': '계정 정보',
  reset: '비밀번호 재설정', application: '지원 상세',
};
const authPages = ['login', 'signup', 'signup-details', 'reset'];

class ErrorBoundary extends React.Component {
  state = {error: false};
  static getDerivedStateFromError() { return {error: true}; }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="page">
      <h1>화면을 표시하지 못했어요.</h1>
      <p>작성한 기록은 브라우저에 보관돼 있어요.</p>
      <a className="button" href="#/applications" onClick={() => location.reload()}>지원 현황으로 이동</a>
    </div>;
  }
}

function App() {
  const [initial] = useState(loadStore);
  const [store, setStore] = useState(initial.data);
  const [saveBlocked, setSaveBlocked] = useState(Boolean(initial.error));
  const [storageError, setStorageError] = useState(initial.error);
  const [settings, setSettings] = useState(false);
  const [imported, setImported] = useState(null);
  const [importError, setImportError] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [practiceSession, setPracticeSession] = useState(null);
  const [route, navigate] = useHashRoute();
  const [path, search] = route.split('?');
  const [, kind, aid, qid] = path.split('/');
  const query = new URLSearchParams(search);
  const application = store.applications.find(item => item.id === aid);
  const question = application?.questions.find(item => item.id === qid) || application?.questions[0];
  const isAuth = authPages.includes(kind);

  useEffect(() => {
    if (saveBlocked) return;
    try {
      saveStore(store);
      setStorageError('');
    } catch {
      setStorageError('브라우저에 저장하지 못했어요. 화면의 입력은 유지하고 있어요. 백업을 내려받아 주세요.');
    }
  }, [store, saveBlocked]);

  useEffect(() => {
    document.title = 'JaNovel · ' + (pageTitles[kind] || '지원 기록');
  }, [kind]);

  useEffect(() => {
    if (kind !== 'interviews' || qid !== 'practice') setPracticeSession(null);
  }, [kind, aid, qid]);

  useEffect(() => {
    if (kind !== 'write' || !application) return;
    setStore(previous => {
      const recent = previous.preferences?.recentApplications ?? [];
      if (recent[0] === aid) return previous;
      return {
        ...previous,
        preferences: {...previous.preferences, recentApplications: [aid, ...recent.filter(id => id !== aid)].slice(0, 2)},
      };
    });
  }, [kind, aid, Boolean(application)]);

  const openSettings = () => setSettings(true);
  const changeApplication = (id, update) => setStore(previous => ({
    ...previous,
    applications: previous.applications.map(item => {
      if (item.id !== id) return item;
      const next = update(item);
      return item.example && !item.interview && next.company !== item.company
        ? {...next, interview: interviewFor(item)} : next;
    }),
  }));
  const saveApplication = next => changeApplication(next.id, () => next);
  const saveQuestion = next => setStore(previous => updateQuestion(previous, aid, question.id, next));

  const updateInterview = (id, action) => changeApplication(id, item => ({...item, interview: action(interviewFor(item))}));
  const interviewRecord = application && kind === 'interviews' && qid && interviewFor(application).records.find(item => item.id === qid);
  const practice = kind === 'interviews' && qid === 'practice' && application;
  const materialMode = query.get('mode') === 'materials';
  const matchingSession = practiceSession && practiceSession.applicationId === aid &&
    practiceSession.mode === (materialMode ? 'materials' : 'expected')
    ? practiceSession : null;
  const expiredPractice = practice && materialMode && !matchingSession;
  let content;
  if (isAuth) {
    content = <Auth key={kind} page={kind} navigate={navigate} verifiedEmail={verifiedEmail} onVerify={setVerifiedEmail} onEnter={profile => {
      setStore(previous => ({...previous, profile}));
      setVerifiedEmail('');
      navigate('/applications');
    }}/>;
  } else if (practice && !expiredPractice) {
    content = <InterviewPractice key={aid + '/' + (materialMode ? 'materials' : 'expected')} application={application}
      session={matchingSession} navigate={navigate} onChange={action => updateInterview(aid, action)}/>;
  } else if (!kind || ['applications', 'schedule', 'interviews'].includes(kind)) {
    const section = '/' + (kind || 'applications');
    content = <CareerLayout section={section} store={store} onSettings={openSettings}>
      {section === '/applications' ? <Applications store={store} navigate={navigate} onApplicationChange={changeApplication}/> : section === '/schedule' ?
        <Schedule key={search} store={store} initialDate={query.get('date')} navigate={navigate}
          onItemsChange={update => setStore(previous => ({...previous, scheduleItems: update(previous.scheduleItems || [])}))}
          onApplicationChange={changeApplication}/> :
        application ? <InterviewDetail key={aid} application={application} navigate={navigate}
          query={expiredPractice ? new URLSearchParams('tab=practice&mode=materials&expired') : query}
          record={interviewRecord} onChange={action => updateInterview(aid, action)} storageError={storageError}
          onPracticeStart={session => {
            setPracticeSession({...session, applicationId: aid});
            navigate('/interviews/' + aid + '/practice' + (session.mode === 'materials' ? '?mode=materials' : ''));
          }}/> :
        <Interviews store={store} navigate={navigate} query={query}
          onApplicationChange={changeApplication} onInterviewChange={updateInterview}/>}
    </CareerLayout>;
  } else if (kind === 'posting' && (!aid || application)) {
    content = <Posting key={aid || 'new'} existing={application} navigate={navigate} onSave={saveApplication}
      onAdd={item => setStore(previous => ({...previous, applications: [item, ...previous.applications]}))}/>;
  } else if (application) {
    if (kind === 'application') {
      content = <Detail key={aid} application={application} navigate={navigate} onSave={saveApplication}
        onDelete={id => setStore(previous => ({...previous, applications: previous.applications.filter(item => item.id !== id)}))}
        onSubmission={() => navigate('/submissions/' + aid)}/>;
    } else if (kind === 'submissions') {
      content = <Submissions key={aid} application={application} navigate={navigate} onSave={saveApplication}/>;
    } else if (question && kind === 'write') {
      content = <Editor key={aid + question.id + search} application={application} question={question} query={query}
        navigate={navigate} onSave={saveQuestion} preferences={store.preferences || {}}
        onPreferences={preferences => setStore(previous => ({...previous, preferences: {...previous.preferences, ...preferences}}))}/>;
    } else if (question && kind === 'merge') {
      content = <Merge key={aid + question.id + search} application={application} question={question} query={query}
        navigate={navigate} onSave={saveQuestion}/>;
    }
  }

  const careerPage = !kind || ['applications', 'schedule', 'interviews'].includes(kind);
  return <>
    {!careerPage && !isAuth && <div className="local-indicator">
      <span>로컬 미리보기 · 이 브라우저에 저장</span>
      <button type="button" onClick={openSettings}>백업</button>
      <a href="#/login">로그인 화면</a>
    </div>}
    {storageError && <div className="storage-banner" role="alert">
      {storageError}
      <button onClick={() => downloadBackup(store)}>백업 받기</button>
      {saveBlocked && <button onClick={openSettings}>저장 설정</button>}
    </div>}
    <Suspense fallback={<div className="page" role="status">불러오는 중</div>}>{content || <Empty title="페이지를 찾을 수 없어요"
      action={<button className="button" onClick={() => navigate('/applications')}>지원 현황</button>}/>}</Suspense>
    {settings && <Modal title="설정 및 백업" onClose={() => {setSettings(false); setImported(null);}}>
      <Notice>자소서와 지원 정보는 이 브라우저에 저장합니다. 기기 간 동기화와 실제 인증은 연결 전입니다.</Notice>
      <button className="button full" onClick={() => downloadBackup(store)}>JSON 백업 내려받기</button>
      <Field label="백업 불러오기" hint="첨부 이미지와 답변 녹음은 현재 브라우저에 보관되며 JSON에 포함되지 않습니다.">
        <input type="file" accept="application/json,.json" onChange={async event => {
          const input = event.currentTarget;
          const file = input.files?.[0];
          if (!file) return;
          try {
            if (file.size > 20 * 1024 * 1024) throw Error('INVALID_BACKUP');
            setImported(validateStore(JSON.parse(await file.text())));
            setImportError('');
          } catch (error) {
            setImported(null);
            setImportError(errorMessage(error));
          }
          input.value = '';
        }}/>
      </Field>
      {importError && <Notice type="error">{importError}</Notice>}
      {imported && <>
        <Notice>{imported.applications.length}건의 지원 기록으로 현재 작업공간을 교체합니다. 현재 기록을 먼저 백업하세요.</Notice>
        <button className="button primary full" onClick={() => {
          setStore(imported); setSaveBlocked(false); setImported(null); navigate('/applications');
        }}>이 백업으로 교체</button>
      </>}
      {saveBlocked && <>
        <Notice type="error">기존 저장 데이터가 손상되어 자동 저장을 중단했어요. 교체하기 전에 원본을 내려받을 수 있어요.</Notice>
        <button className="button" onClick={() => {
          const raw = localStorage.getItem(STORE_KEY) || '';
          const url = URL.createObjectURL(new Blob([raw], {type: 'application/json'}));
          const link = document.createElement('a');
          link.href = url;
          link.download = 'janovel-original-data.txt';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>원본 저장 데이터 내려받기</button>
        <button className="button primary" onClick={() => {
          if (window.confirm('기존 저장 데이터를 현재 작업공간으로 교체할까요?')) setSaveBlocked(false);
        }}>현재 작업공간 저장 시작</button>
      </>}
    </Modal>}
  </>;
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
