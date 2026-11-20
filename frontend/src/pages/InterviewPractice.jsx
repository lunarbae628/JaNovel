import React, {useEffect, useRef, useState} from 'react';
import {Pause, Play, Volume2} from 'lucide-react';
import InterviewOrb from '../components/InterviewOrb.jsx';
import {Modal, Notice} from '../components/UI.jsx';
import {interviewFor, practiceModeLabels, startPracticeRecord, timecode} from '../interview.js';
import {uid} from '../model.js';

export function InterviewPractice({application, session, navigate, onChange}) {
  const [questions] = useState(() => session?.questions || interviewFor(application).questions);
  const mode = session?.mode || 'expected';
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speech, setSpeech] = useState('idle');
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');
  const playback = useRef({sequence: 0, timer: 0, started: false});
  const root = '/interviews/' + application.id;
  const question = questions[index];

  function cancelPlayback() {
    playback.current.sequence++;
    clearTimeout(playback.current.timer);
    window.speechSynthesis?.cancel();
  }

  useEffect(() => cancelPlayback, []);
  useEffect(() => {
    if (!question || paused || ending) return;
    const timer = setInterval(() => setElapsed(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [Boolean(question), paused, ending]);

  function speak(item) {
    cancelPlayback();
    const synth = window.speechSynthesis;
    const voice = synth?.getVoices().find(item => item.localService && item.lang.toLowerCase().startsWith('ko'));
    const unavailable = '한국어 음성 읽기를 사용할 수 없어요. 화면의 질문을 보며 계속 연습할 수 있어요.';
    if (!voice) {
      setError(unavailable);
      setSpeech('idle');
      return;
    }
    const sequence = playback.current.sequence;
    const message = new SpeechSynthesisUtterance(item.prompt);
    message.voice = voice;
    message.lang = 'ko-KR';
    setError('');
    setSpeech('loading');
    message.onstart = () => {
      if (sequence !== playback.current.sequence) return;
      clearTimeout(playback.current.timer);
      playback.current.started = true;
      setSpeech('reading');
    };
    message.onend = () => {
      if (sequence !== playback.current.sequence) return;
      clearTimeout(playback.current.timer);
      setSpeech('answer');
    };
    message.onerror = () => {
      if (sequence !== playback.current.sequence) return;
      clearTimeout(playback.current.timer);
      setSpeech('idle');
      setError(unavailable);
    };
    playback.current.timer = setTimeout(() => {
      cancelPlayback();
      setSpeech('idle');
      setError(unavailable);
    }, 4000);
    synth.speak(message);
  }

  function requestEnd() {
    cancelPlayback();
    setSpeech('idle');
    setEnding(true);
  }

  function finish() {
    if (!question) {
      navigate(root + '?tab=practice');
      return;
    }
    const id = uid('practice');
    const record = startPracticeRecord(id, questions.slice(0, index + 1), elapsed, new Date().toISOString(), mode);
    onChange(previous => ({...previous, records: [record, ...previous.records]}));
    navigate(root + '/' + id);
  }

  function nextQuestion() {
    if (index === questions.length - 1) {
      requestEnd();
      return;
    }
    setIndex(index + 1);
    if (playback.current.started) speak(questions[index + 1]);
    else {
      cancelPlayback();
      setSpeech('idle');
      setError('');
    }
  }

  const status = paused ? '일시정지' : {
    idle: '질문을 듣거나 화면에서 확인하세요',
    loading: '음성 준비 중',
    reading: '면접관이 질문을 읽고 있어요',
    answer: '답변할 차례예요',
  }[speech];

  return <main className="practice-page">
    <header className="practice-header">
      <span className="career-wordmark">JaNovel.</span>
      <div className="practice-heading"><h1>AI 모의면접</h1><span>{application.company} · {practiceModeLabels[mode]}</span></div>
      <button className="career-button" onClick={requestEnd}>종료</button>
    </header>
    {question ? <div className="practice-layout">
      <section className="practice-question" aria-label="현재 질문">
        <div className="practice-progress"><span>질문 {index + 1} / {questions.length}</span>
          <span>진행 시간 {timecode(elapsed)}</span></div>
        <div className="practice-visual">
          <InterviewOrb speaking={speech === 'reading'}/>
          <p role="status">{status}</p>
        </div>
        <div className="practice-prompt" aria-live="polite"><h2>{question.prompt}</h2></div>
        {error && <Notice type="error">{error}</Notice>}
        <div className="practice-controls">
          <button className="career-button" disabled={paused || ['loading', 'reading'].includes(speech)} onClick={() => speak(question)}>
            <Volume2 size={16}/>{speech === 'answer' ? '다시 듣기' : '질문 듣기'}
          </button>
          <button className="career-button" onClick={() => {
            cancelPlayback();
            setSpeech('idle');
            setPaused(!paused);
          }}>{paused ? <Play size={16}/> : <Pause size={16}/>} {paused ? '재개' : '일시정지'}</button>
          <button className="career-button primary" disabled={paused} onClick={nextQuestion}>
            {index === questions.length - 1 ? '연습 마치기' : '다음 질문'}
          </button>
        </div>
      </section>
      <section className="practice-transcript" aria-labelledby="practice-history-title">
        <h2 id="practice-history-title">질문 기록</h2>
        <ol>
          {questions.slice(0, index + 1).map((item, position) => <li key={item.id} aria-current={position === index ? 'step' : undefined}>
            <span>질문 {position + 1}</span><p>{item.prompt}</p>
          </li>)}
        </ol>
      </section>
    </div> : <div className="career-content">
      <p>연습할 질문을 먼저 추가해 주세요.</p>
      <a className="career-button" href={'#' + root + '?tab=practice'}>모의면접 설정</a>
    </div>}
    {ending && <Modal title="모의면접을 종료할까요?" className="interview-modal" onClose={() => setEnding(false)}>
      <p>{question ? '연습한 질문과 진행 시간을 기록해요.' : '모의면접 설정으로 돌아가요.'}</p>
      <div className="form-actions">
        <button className="button" onClick={() => setEnding(false)}>계속 연습</button>
        <button className="button primary" onClick={finish}>{question ? '기록하고 종료' : '종료'}</button>
      </div>
    </Modal>}
  </main>;
}
