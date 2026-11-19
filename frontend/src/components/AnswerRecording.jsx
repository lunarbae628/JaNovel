import React, {useEffect, useRef, useState} from 'react';
import {Pause, Play} from 'lucide-react';
import {Modal, Notice} from './UI.jsx';
import {timecode} from '../interview.js';
import {deleteAttachment, getAttachment, putAttachment} from '../storage.js';

function stopTracks(stream) {
  stream?.getTracks().forEach(track => track.stop());
}

export default function AnswerRecording({storageKey, onClose}) {
  const [saved, setSaved] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [url, setUrl] = useState('');
  const recorder = useRef(null);
  const stream = useRef(null);
  const audio = useRef(null);
  const startTime = useRef(0);
  const active = useRef(false);
  const pending = useRef(null);

  useEffect(() => {
    active.current = true;
    getAttachment(storageKey).then(value => {
      if (!active.current) return;
      setSaved(value || null);
      setPhase('idle');
    }).catch(() => {
      if (!active.current) return;
      setError('저장된 녹음을 불러오지 못했어요.');
      setPhase('unavailable');
    });
    return () => {
      active.current = false;
      if (recorder.current?.state === 'recording') {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stopTracks(stream.current);
    };
  }, [storageKey]);

  useEffect(() => {
    if (!saved) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(saved.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [saved]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 200);
    return () => clearInterval(timer);
  }, [phase]);

  async function persist(value) {
    pending.current = value;
    setPhase('saving');
    setError('');
    try {
      await putAttachment(storageKey, value);
      if (!active.current) return;
      pending.current = null;
      setSaved(value);
      setPosition(0);
      setPhase('idle');
    } catch {
      if (!active.current) return;
      setPhase('failed');
      setError('녹음은 유지하고 있어요. 다시 시도해 주세요.');
    }
  }

  async function begin() {
    audio.current?.pause();
    setError('');
    setConfirmation('');
    setPhase('requesting');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw Error('unavailable');
      const input = await navigator.mediaDevices.getUserMedia({audio: true});
      if (!active.current) {
        stopTracks(input);
        return;
      }

      stream.current = input;
      const media = new MediaRecorder(input);
      recorder.current = media;
      const chunks = [];
      media.ondataavailable = event => {if (event.data.size) chunks.push(event.data);};
      media.onstop = () => {
        stopTracks(input);
        if (!active.current) return;
        const blob = new Blob(chunks, {type: media.mimeType});
        if (blob.size) {
          void persist({blob, duration: Math.max(1, Math.round((Date.now() - startTime.current) / 1000))});
        } else {
          setPhase('idle');
          setError('마이크에서 소리를 받지 못했어요.');
        }
      };
      media.onerror = () => {
        media.onstop = null;
        stopTracks(input);
        setPhase('idle');
        setError('녹음이 중단됐어요. 마이크를 확인해 주세요.');
      };
      startTime.current = Date.now();
      setElapsed(0);
      media.start();
      setPhase('recording');
    } catch (problem) {
      stopTracks(stream.current);
      if (!active.current) return;
      setPhase('idle');
      setError(problem.name === 'NotAllowedError' ? '브라우저에서 마이크 권한을 허용해 주세요.' :
        problem.name === 'NotFoundError' ? '연결된 마이크를 찾을 수 없어요.' : '마이크를 사용할 수 없어요.');
    }
  }

  function cancelCapture() {
    if (recorder.current?.state === 'recording') {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    stopTracks(stream.current);
    pending.current = null;
    onClose();
  }
  function close() {
    if (confirmation) setConfirmation('');
    else if (phase === 'recording' || phase === 'failed') setConfirmation('cancel');
    else if (phase !== 'saving') onClose();
  }
  async function remove() {
    setPhase('saving');
    setConfirmation('');
    try {
      await deleteAttachment(storageKey);
      setSaved(null);
      setPosition(0);
    } catch {
      setError('녹음을 삭제하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setPhase('idle');
    }
  }
  const confirmTitles = {replace: '다시 녹음할까요?', delete: '녹음을 삭제할까요?', cancel: '녹음을 취소할까요?'};

  return <Modal title={confirmTitles[confirmation] || (phase === 'failed' ? '녹음을 저장하지 못했어요' : '답변 녹음')}
    className="recording-modal" showClose={false} onClose={close}>
    {confirmation ? <>
      <p className="recording-copy">{{
        replace: '새 녹음이 저장되면 기존 녹음을 교체합니다.',
        delete: '저장된 답변 녹음을 삭제합니다.',
        cancel: '지금 녹음은 저장하지 않아요.',
      }[confirmation]}</p>
      <div className="form-actions">
        <button className="button" onClick={() => setConfirmation('')}>돌아가기</button>
        <button className="button primary" onClick={confirmation === 'replace' ? begin : confirmation === 'delete' ? remove : cancelCapture}>
          {{replace: '녹음 시작', delete: '삭제', cancel: '녹음 취소'}[confirmation]}
        </button>
      </div>
    </> : <>
      {url && <audio ref={audio} src={url} preload="metadata" onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={event => setPosition(Math.floor(event.currentTarget.currentTime))}/>}
      {error && <Notice type="error">{error}</Notice>}
      {phase === 'recording' ? <div className="recording-readout live"><i/>{timecode(elapsed)}</div> :
        saved && phase === 'idle' ? <div className="recording-player">
          <span className="recording-saved">저장됨</span>
          <button className="button" onClick={async () => {
            try {
              if (audio.current.paused) await audio.current.play(); else audio.current.pause();
            } catch { setError('녹음을 재생하지 못했어요.'); }
          }}>{playing ? <Pause size={15}/> : <Play size={15}/>} {playing ? '일시정지' : '재생'}</button>
          <span>{timecode(position)} / {timecode(saved.duration)}</span>
        </div> :
        <div className="recording-readout">{phase === 'idle' ? '00:00' : {
          loading: '불러오는 중', requesting: '마이크 연결 중', saving: '저장 중',
        }[phase]}</div>}
      <div className="form-actions">
        {phase === 'recording' ? <>
          <button className="button" onClick={close}>취소</button>
          <button className="button primary" onClick={() => {if (recorder.current?.state === 'recording') {setPhase('saving'); recorder.current.stop();}}}>녹음 끝내기</button>
        </> : phase === 'failed' ? <>
          <button className="button" onClick={close}>닫기</button>
          <button className="button primary" onClick={() => persist(pending.current)}>다시 시도</button>
        </> : <>
          {phase === 'idle' && saved && <>
            <button className="button" onClick={() => {audio.current?.pause(); setConfirmation('replace');}}>다시 녹음</button>
            <button className="button" onClick={() => {audio.current?.pause(); setConfirmation('delete');}}>삭제</button>
          </>}
          <button className="button" disabled={phase === 'saving'} onClick={close}>닫기</button>
          {phase === 'idle' && !saved && <button className="button primary" onClick={begin}>녹음 시작</button>}
        </>}
      </div>
    </>}
  </Modal>;
}
