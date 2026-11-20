import React, {useEffect, useRef, useState} from 'react';
import {ArrowLeft, Mic, MicOff, Pause, Play, Volume2} from 'lucide-react';
import {Modal, Notice} from '../components/UI.jsx';
import {interviewFor, startPracticeRecord, timecode} from '../interview.js';
import {uid} from '../model.js';
import {interviewTitle} from './Interviews.jsx';

const microphoneLabels = {
  requesting: '마이크 연결 중', disconnected: '마이크 연결 필요', paused: '일시정지',
  speaking: '질문을 읽고 있어요', muted: '마이크 꺼짐', listening: '답변 대기 중',
};

export function InterviewPractice({application, navigate, onChange}) {
  const [questions] = useState(() => interviewFor(application).questions);
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState('requesting');
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');
  const stream = useRef(null);
  const mounted = useRef(false);
  const root = '/interviews/' + application.id;
  const micState = phase !== 'ready' ? phase : speaking ? 'speaking' : muted ? 'muted' : 'listening';

  async function connect() {
    setPhase('requesting');
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Error('unavailable');
      const input = await navigator.mediaDevices.getUserMedia({audio: true});
      if (!mounted.current) {
        input.getTracks().forEach(track => track.stop());
        return;
      }
      stream.current?.getTracks().forEach(track => track.stop());
      stream.current = input;
      input.getAudioTracks().forEach(track => {
        track.onended = () => {
          if (!mounted.current) return;
          setPhase('disconnected');
          setError('마이크 연결이 끊겼어요. 다시 연결해 주세요.');
        };
      });
      setMuted(false);
      setPhase('ready');
    } catch {
      if (mounted.current) {
        setPhase('disconnected');
        setError('마이크를 사용할 수 없어요. 장치와 브라우저 권한을 확인해 주세요.');
      }
    }
  }

  useEffect(() => {
    mounted.current = true;
    if (questions.length) void connect();
    return () => {
      mounted.current = false;
      stream.current?.getTracks().forEach(track => track.stop());
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'ready') return;
    const timer = setInterval(() => setElapsed(value => value + 1), 1000);
    if (!window.AudioContext || muted || !stream.current) return () => clearInterval(timer);
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream.current);
    const analyser = context.createAnalyser();
    const values = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    const meter = setInterval(() => {
      analyser.getByteTimeDomainData(values);
      const amplitude = Math.sqrt(values.reduce((sum, v) => sum + (v - 128) ** 2, 0) / values.length);
      setLevel(Math.min(1, amplitude / 16));
    }, 120);
    return () => {
      clearInterval(timer); clearInterval(meter);
      source.disconnect();
      void context.close();
    };
  }, [phase, muted]);

  function speak(question) {
    const synth = window.speechSynthesis;
    const voice = synth?.getVoices().find(item => item.localService && item.lang.toLowerCase().startsWith('ko'));
    if (!voice) {
      setError('이 브라우저에서 사용할 수 있는 한국어 음성 읽기를 찾지 못했어요.');
      return;
    }
    setError('');
    synth.cancel();
    const message = new SpeechSynthesisUtterance(question.prompt);
    message.voice = voice;
    message.lang = 'ko-KR';
    message.onstart = () => setSpeaking(true);
    message.onend = message.onerror = () => setSpeaking(false);
    synth.speak(message);
  }

  function togglePause() {
    const pause = phase === 'ready';
    setPhase(pause ? 'paused' : 'ready');
    stream.current?.getAudioTracks().forEach(track => {track.enabled = !pause && !muted;});
    if (pause) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
    }
  }

  function finish() {
    if (!questions.length || !['ready', 'paused'].includes(phase) && !elapsed) {
      navigate(root);
      return;
    }
    const id = uid('practice');
    const record = startPracticeRecord(id, questions.slice(0, index + 1), elapsed, new Date().toISOString());
    onChange(previous => ({...previous, records: [record, ...previous.records]}));
    navigate(root + '/' + id);
  }

  return <main className="practice-page">
    <header className="practice-header">
      <a href="#/applications" className="career-wordmark">JaNovel.</a>
      <button className="practice-back" onClick={() => setEnding(true)}><ArrowLeft size={15}/>면접 준비</button>
      <div className="practice-heading"><h1>AI 모의면접</h1><span>{interviewTitle(application)}</span></div>
      <button className="career-button" onClick={() => setEnding(true)}>종료</button>
    </header>
    {questions.length ? <div className="practice-layout">
      <section className="practice-question">
        <div className="practice-progress"><span>질문 {index + 1} / {questions.length}</span>
          <span>진행 시간 {timecode(elapsed)}</span></div>
        <h2>{questions[index].prompt}</h2>
        <div className="practice-microphone">
          <div className="practice-orb" data-state={micState} aria-hidden="true"
            style={micState === 'listening' ? {'--orb-scale': 1 + level * .12, '--orb-light': 1 + level * .24} : undefined}/>
          <strong role="status">{microphoneLabels[micState]}</strong>
          {error && <Notice type="error">{error}</Notice>}
          {phase === 'disconnected' && <button className="career-button" onClick={connect}>마이크 다시 연결</button>}
        </div>
        <div className="practice-controls">
          <button className="career-button" aria-pressed={!muted} disabled={phase !== 'ready'} onClick={() => {
            stream.current?.getAudioTracks().forEach(track => {track.enabled = muted;});
            setMuted(!muted);
          }}>{muted ? <MicOff size={15}/> : <Mic size={15}/>}마이크</button>
          <button className="career-button" disabled={phase !== 'ready' && phase !== 'paused'} onClick={togglePause}>
            {phase === 'paused' ? <Play size={15}/> : <Pause size={15}/>} {phase === 'paused' ? '재개' : '일시정지'}
          </button>
          <button className="career-button" disabled={phase !== 'ready'} onClick={() => speak(questions[index])}>
            <Volume2 size={15}/>질문 듣기</button>
          <button className="career-button primary" disabled={phase !== 'ready'} onClick={() => {
            window.speechSynthesis?.cancel();
            setSpeaking(false);
            if (index === questions.length - 1) setEnding(true); else setIndex(index + 1);
          }}>{index === questions.length - 1 ? '연습 마치기' : '다음 질문'}</button>
        </div>
      </section>
      <aside className="practice-transcript">
        <h2>대화 기록</h2>
        {questions.slice(0, index + 1).map(question => <div key={question.id}>
          <small>면접관</small><p>{question.prompt}</p>
        </div>)}
        <p>음성 전사와 AI 피드백은 연결 전이에요.</p>
      </aside>
    </div> : <p className="career-content">연습할 질문을 예상 질문에서 먼저 추가해 주세요.</p>}
    {ending && <Modal title="AI 모의면접을 종료할까요?" className="interview-modal" onClose={() => setEnding(false)}>
      <p>연습한 질문과 시간을 기록에 남길 수 있어요.</p>
      <div className="form-actions"><button className="button" onClick={() => setEnding(false)}>계속 연습</button>
        <button className="button primary" onClick={finish}>종료</button></div>
    </Modal>}
  </main>;
}
