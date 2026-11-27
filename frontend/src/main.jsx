import React, {lazy, Suspense, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import Auth from './pages/Auth.jsx';
import Schedule from './pages/Schedule.jsx';
import {interviewFor} from './interview.js';
import {Applications, Detail} from './pages/Applications.jsx';
import Posting from './pages/Posting.jsx';
import Editor from './pages/Editor.jsx';
import Merge from './pages/Merge.jsx';
import Submissions from './pages/Submissions.jsx';
import {CareerLayout} from './components/CareerLayout.jsx';
import EssayTemplateQuestions from './components/EssayTemplateQuestions.jsx';
import {
  createEssayTemplateQuestion, ESSAY_TEMPLATE_ID, essayTemplateItems, essayTemplateOwner,
  getEssayTemplateQuestions, requestEssayTemplate,
} from './essay-template.js';
import {BackLink, Modal, Field, Notice, Empty, useHashRoute} from './components/UI.jsx';
import {loadStore, saveStore, downloadBackup, STORE_KEY} from './storage.js';
import {useServerSync} from './use-server-sync.js';
import {addComparisonSample} from './comparison-sample.js';
import {validateStore, errorMessage, updateQuestion} from './model.js';
import {usePreviewState} from './community-preview.js';
import {initialSocial} from './social-preview.js';
import './styles.css';
import './career.css';
import './workspace.css';

const Interviews = lazy(() => import('./pages/Interviews.jsx').then(module => ({default: module.Interviews})));
const InterviewDetail = lazy(() => import('./pages/Interviews.jsx').then(module => ({default: module.InterviewDetail})));
const InterviewPractice = lazy(() => import('./pages/InterviewPractice.jsx').then(module => ({default: module.InterviewPractice})));
const Community = lazy(() => import('./pages/Community.jsx'));
const Inbox = lazy(() => import('./pages/Inbox.jsx'));
const Social = lazy(() => import('./pages/Social.jsx'));

const pageTitles = {
  applications: '지원 현황', schedule: '일정', interviews: '면접 준비', community: '커뮤니티', friends: '친구',
  posting: '공고 등록', write: '작성', merge: '병합', submissions: '제출본', 'essay-template': '내 공통 자소서',
  login: '로그인', signup: '회원가입', 'signup-details': '계정 정보',
  reset: '비밀번호 재설정', application: '공고 정보',
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
  // 개발 서버에서 ?sample=comparison으로 열면 비교 연습용 지원 건을 추가하고 그 문항을 연다.
  const [sample] = useState(() => import.meta.env.DEV && !initial.error
    && new URLSearchParams(location.search).get('sample') === 'comparison' ? addComparisonSample(initial.data) : null);
  const [socialPreview, setSocialPreview] = usePreviewState('social', initialSocial);
  const [store, setStore] = useState(sample ? sample.store : initial.data);

  const [saveBlocked, setSaveBlocked] = useState(Boolean(initial.error));
  const [storageError, setStorageError] = useState(initial.error);
  const serverSync = useServerSync({store, setStore, enabled: !saveBlocked});
  const [settings, setSettings] = useState(false);
  const [templateQuestionsOpen, setTemplateQuestionsOpen] = useState(false);
  const [templateLoadFailed, setTemplateLoadFailed] = useState(false);
  const [templateRetry, setTemplateRetry] = useState(0);
  const [templateReturnPath, setTemplateReturnPath] = useState('');
  const templateSync = useRef(new Map());
  const [inboxOpen, setInboxOpen] = useState(false);
  const [imported, setImported] = useState(null);
  const [importError, setImportError] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [practiceSession, setPracticeSession] = useState(null);
  const [route, navigate] = useHashRoute();
  useEffect(() => {
    if (!sample) return;
    history.replaceState(null, '', location.pathname + location.hash);
    navigate('/write/' + sample.applicationId + '/' + sample.questionId);
  }, [sample]);
  const [originalPath, originalSearch] = route.split('?');
  const legacySocialRoute = originalPath === '/chat' || originalPath === '/inbox';
  const pageRoute = legacySocialRoute ? '/friends' +
    (originalPath === '/chat' && originalSearch ? '?' + originalSearch : '') : route;
  const [path, search] = pageRoute.split('?');
  const [, kind, aid, qid] = path.split('/');
  const query = new URLSearchParams(search);
  const templateRoute = kind === 'essay-template' || (aid === ESSAY_TEMPLATE_ID && ['write', 'merge'].includes(kind));
  const templateOwner = essayTemplateOwner(store.profile);
  const templateQuestions = getEssayTemplateQuestions(store);
  const templatePayload = templateQuestions && JSON.stringify(essayTemplateItems(templateQuestions));
  const application = templateRoute ? (templateQuestions && {
    id:ESSAY_TEMPLATE_ID, company:'내 공통 자소서', role:'', questions:templateQuestions, submissions:[],
  }) : store.applications.find(item => item.id === aid);
  const question = application?.questions.find(item => item.id === qid) || application?.questions[0];
  const isAuth = authPages.includes(kind);
  const careerPage = !kind || ['applications', 'schedule', 'interviews', 'community', 'friends'].includes(kind);

  useEffect(() => {
    if (!templateRoute || templateQuestions !== undefined) return;
    const request = new AbortController();
    setTemplateLoadFailed(false);
    requestEssayTemplate({email:templateOwner}, {signal:request.signal}).then(items => {
      if (request.signal.aborted) return;
      const questions = items.map(createEssayTemplateQuestion);
      const sync = templateSync.current.get(templateOwner) ?? {};
      sync.saved = JSON.stringify(essayTemplateItems(questions));
      templateSync.current.set(templateOwner, sync);
      setStore(previous => getEssayTemplateQuestions(previous, {email:templateOwner}) !== undefined ? previous : ({
        ...previous, essayTemplates:{...previous.essayTemplates, [templateOwner]:questions},
      }));
    }).catch(() => {
      if (!request.signal.aborted) setTemplateLoadFailed(true);
    });
    return () => request.abort();
  }, [templateRoute, templateOwner, templateQuestions, templateRetry]);

  useEffect(() => {
    if (templatePayload === undefined || saveBlocked) return;
    const sync = templateSync.current.get(templateOwner) ?? {};
    templateSync.current.set(templateOwner, sync);
    let cancelled = false;
    const timer = setTimeout(() => {
      sync.pending = (sync.pending ?? Promise.resolve()).then(async () => {
        if (cancelled || sync.saved === templatePayload) return;
        try {
          await requestEssayTemplate({email:templateOwner}, {items:JSON.parse(templatePayload)});
          sync.saved = templatePayload;
        } catch {
          // The browser retains the writing workspace and can use it for imports.
        }
      });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [templateOwner, templatePayload, saveBlocked]);

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
    document.title = 'JaNovel · ' + (templateRoute ? '내 공통 자소서'
      : kind === 'community' && aid === 'write' ? '글쓰기' : pageTitles[kind] || '지원 기록');
  }, [kind, aid, templateRoute]);

  useEffect(() => {
    if (kind !== 'interviews' || qid !== 'practice') setPracticeSession(null);
  }, [kind, aid, qid]);

  // 작성 화면을 열면 최근 작성한 지원 건과 그 지원 건에서 마지막으로 연 문항을 기억한다.
  useEffect(() => {
    if (kind !== 'write' || !application || templateRoute) return;
    setStore(previous => {
      const recent = previous.preferences?.recentApplications ?? [];
      const current = previous.applications.find(item => item.id === aid);
      const remembers = !qid || !current?.questions.some(question => question.id === qid) || current.lastQuestionId === qid;
      if (recent[0] === aid && remembers) return previous;
      return {
        ...previous,
        applications: remembers ? previous.applications
          : previous.applications.map(item => item.id === aid ? {...item, lastQuestionId: qid} : item),
        preferences: {...previous.preferences, recentApplications: [aid, ...recent.filter(id => id !== aid)].slice(0, 2)},
      };
    });
  }, [kind, aid, qid, Boolean(application), templateRoute]);

  useEffect(() => {
    if (!legacySocialRoute) return;
    if (originalPath === '/inbox') setInboxOpen(true);
    history.replaceState(history.state, '', '#' + pageRoute);
    navigate(pageRoute);
  }, [legacySocialRoute, originalPath, pageRoute, navigate]);

  const openSettings = () => setSettings(true);
  const openEssayTemplate = () => {
    setTemplateReturnPath(location.hash.slice(1));
    navigate('/essay-template');
  };
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
  const changeTemplateQuestions = update => setStore(previous => ({
    ...previous, essayTemplates:{...previous.essayTemplates,
      [templateOwner]:update(getEssayTemplateQuestions(previous, {email:templateOwner}) ?? [])},
  }));
  const saveQuestion = (next, questionId = question.id) => {
    if (templateRoute) {
      changeTemplateQuestions(questions => questions.map(item => item.id === questionId
        ? (typeof next === 'function' ? next(item) : next) : item));
    } else {
      setStore(previous => updateQuestion(previous, aid, questionId, next));
    }
  };

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
  } else if (careerPage) {
    const section = '/' + (kind || 'applications');
    content = <CareerLayout section={section} store={store} onSettings={openSettings}
      inboxOpen={inboxOpen} onOpenInbox={() => setInboxOpen(true)}
      unreadCount={socialPreview.inbox.filter(item => !item.read).length}>
      {section === '/applications' ? <Applications store={store} navigate={navigate} onApplicationChange={changeApplication}/> : section === '/schedule' ?
        <Schedule key={search} store={store} initialDate={query.get('date')} navigate={navigate}
          onItemsChange={update => setStore(previous => ({...previous, scheduleItems: update(previous.scheduleItems || [])}))}
          onApplicationChange={changeApplication}/> : section === '/community' ?
        <Community query={query} writing={aid === 'write'} navigate={navigate}/> :
        kind === 'friends' ?
        <Social key={pageRoute} query={query} preview={socialPreview} setPreview={setSocialPreview}/> :
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
  } else if (templateRoute && !question) {
    content = <main className="page essay-template-page">
      <BackLink className="page-back" to={templateReturnPath || '/applications'}>
        {templateReturnPath ? '이전 자소서' : '지원 현황'}
      </BackLink>
      <h1>내 공통 자소서</h1>
      {templateQuestions !== undefined
        ? <button type="button" className="button primary" onClick={() => setTemplateQuestionsOpen(true)}>문항 추가</button>
        : templateLoadFailed ? <>
          <Notice type="error">공통 자소서를 불러오지 못했어요.</Notice>
          <button type="button" className="button" onClick={() => setTemplateRetry(value => value + 1)}>다시 불러오기</button>
        </> : <Notice>공통 자소서를 불러오는 중이에요.</Notice>}
    </main>;
  } else if (kind === 'posting' && (!aid || application)) {
    content = <Posting key={aid || 'new'} existing={application} profile={store.profile} navigate={navigate}
      templateQuestions={templateQuestions} onSave={saveApplication}
      onAdd={item => setStore(previous => ({...previous, applications: [item, ...previous.applications]}))}/>;
  } else if (application) {
    if (kind === 'application' || (!question && (kind === 'write' || kind === 'merge'))) {
      content = <Detail key={aid} application={application} navigate={navigate} onSave={saveApplication}
        onDelete={id => setStore(previous => {
          const removed = previous.applications.find(item => item.id === id);
          return {...previous, applications: previous.applications.filter(item => item.id !== id),
            ...(removed?.server ? {serverDeletes: [...(previous.serverDeletes || []), removed.server.id]} : {})};
        })}
        onSaveQuestion={saveQuestion}/>;
    } else if (kind === 'submissions') {
      content = <Submissions key={aid} application={application} onSave={saveApplication}/>;
    } else if (question && (kind === 'write' || kind === 'essay-template')) {
      content = <Editor key={application.id + question.id + search} application={application} question={question} query={query}
        navigate={navigate} onSave={saveQuestion} onOpenEssayTemplate={openEssayTemplate} preferences={store.preferences || {}}
        essayTemplate={templateRoute} onEditTemplateQuestions={() => setTemplateQuestionsOpen(true)} templateReturnPath={templateReturnPath}
        onPreferences={preferences => setStore(previous => ({...previous, preferences: {...previous.preferences, ...preferences}}))}/>;
    } else if (question && kind === 'merge') {
      content = <Merge key={aid + question.id + search} application={application} question={question} query={query}
        essayTemplate={templateRoute} navigate={navigate} onSave={saveQuestion}/>;
    }
  }

  return <>
    {storageError && <div className="storage-banner" role="alert">
      {storageError}
      <button onClick={() => downloadBackup(store)}>백업 받기</button>
      {saveBlocked && <button onClick={openSettings}>저장 설정</button>}
    </div>}
    {serverSync.conflicts.length > 0 && <div className="storage-banner" role="alert">
      {store.applications.filter(item => serverSync.conflicts.includes(item.id)).map(item => item.company).join(', ')}
      {' '}지원 건이 다른 곳에서 먼저 바뀌어 서버 저장을 멈췄어요.
      <button onClick={serverSync.reloadConflicts}>최신 내용 불러오기</button>
    </div>}
    {serverSync.phase === 'offline' && <div className="storage-banner" role="status">
      서버에 연결하지 못해 이 브라우저에만 저장하고 있어요.
      <button onClick={serverSync.retry}>다시 시도</button>
    </div>}
    {serverSync.error && <div className="storage-banner" role="alert">서버에 저장하지 못했어요. {serverSync.error}</div>}
    <Suspense fallback={<div className="page" role="status">불러오는 중</div>}>{content || <Empty title="페이지를 찾을 수 없어요"
      action={<button className="button" onClick={() => navigate('/applications')}>지원 현황</button>}/>}</Suspense>
    {inboxOpen && <Suspense fallback={null}>
      <Inbox preview={socialPreview} setPreview={setSocialPreview} onClose={() => setInboxOpen(false)}/>
    </Suspense>}
    {templateRoute && templateQuestionsOpen && <Modal title="공통 자소서 문항" wide onClose={() => setTemplateQuestionsOpen(false)}>
      <EssayTemplateQuestions key={templateOwner} questions={templateQuestions ?? []} onClose={() => setTemplateQuestionsOpen(false)}
        onSave={questions => { changeTemplateQuestions(() => questions); setTemplateQuestionsOpen(false); }}/>
    </Modal>}
    {settings && <Modal title="설정 및 백업" onClose={() => {setSettings(false); setImported(null);}}>
      <Notice>지원 건과 자소서 문항은 서버에도 저장합니다. 자소서 본문·일정·제출본은 아직 이 브라우저에만 저장하고, 실제 인증은 연결 전입니다.</Notice>
      {!store.profile?.name && <a className="button full" href="#/login" onClick={() => {setSettings(false); setImported(null);}}>로그인 화면</a>}
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
