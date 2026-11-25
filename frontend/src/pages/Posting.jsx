import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ExternalLink, FileText, Image, Link, Plus, Trash2, Upload} from 'lucide-react';
import {BackLink, Field, IconButton, Modal, Notice} from '../components/UI.jsx';
import {createPostingQuestion, postingSections, safeUrl, uid, writingPath} from '../model.js';
import {appendEssayTemplate, essayTemplateItems, requestEssayTemplate} from '../essay-template.js';
import {fitsSharedQuestionLimits, questionPayload, questionPublication} from '../posting-questions.js';
import {createApplication} from '../seed.js';
import {getAttachment, putAttachment} from '../storage.js';
import {StageFields} from './Applications.jsx';

const sources = [
  ['link', '링크', Link],
  ['image', '이미지', Image],
];
const defaultStages = ['서류 전형', '기술 면접', '최종 면접'];
const pasteKey = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform || '') ? '⌘' : 'Ctrl';
const imageTypes = ['image/png', 'image/jpeg', 'image/webp'];
const suggestedSections = ['주요 업무', '지원 요건', '우대 사항'];
const importFailure = '공고 내용을 가져오지 못했어요. 직접 입력할 수 있어요.';
const sharedQuestionsPath = '/api/postings/shared-questions';
const sharedQuestionLimitHint = '공통 문항은 최대 30개, 문항당 2,000자까지 저장할 수 있어요. 글자 수 제한은 1~100,000자 범위로 입력해 주세요.';
const importMessages = {
  link:'공고 원문을 읽고 내용을 정리하고 있어요.',
  upload:'공고 이미지를 보내고 있어요.',
  queued:'이미지를 읽을 차례를 기다리고 있어요.',
  image:'이미지에서 공고 내용을 읽고 있어요.',
};

function waitBeforePolling(response, signal) {
  const retryAfter = response.headers.get('Retry-After');
  const delay = /^\d+$/.test(retryAfter ?? '')
    ? Number(retryAfter) * 1_000 : Date.parse(retryAfter) - Date.now();
  const wait = Number.isNaN(delay) ? 1_000 : Math.min(2_000, Math.max(0, delay));
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve();
    }, wait);
    function stop() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener('abort', stop, {once:true});
  });
}

function useImagePreview(file, attachmentId) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    let active = true;
    let url = '';
    setPreview('');
    function show(value) {
      if (value && active) {
        url = URL.createObjectURL(value);
        setPreview(url);
      }
    }
    if (file) show(file);
    else if (attachmentId) getAttachment(attachmentId).then(show).catch(() => {});
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, attachmentId]);
  return preview;
}

function PostingSource({type, onTypeChange, url, onUrlChange, file, onFileChange, preview, error, importing, onPrepare}) {
  return <main className="page posting-page posting-source-page">
    <BackLink className="page-back" to="/applications">지원 현황</BackLink>
    <div className="posting-intro">
      <h1>공고 등록</h1>
      <p>채용공고 링크나 이미지를 추가하거나 필요한 정보만 직접 입력하세요.</p>
    </div>
    <form className="posting-source-card" onSubmit={onPrepare} aria-busy={importing}>
      <div className="posting-source-options" role="group" aria-label="공고 입력 방법">
        {sources.map(([key, label, Icon]) => <button key={key} type="button" aria-pressed={type === key} disabled={importing}
          onClick={() => onTypeChange(key)}><Icon size={16} aria-hidden="true"/>{label}</button>)}
      </div>
      <div className="posting-source-fields">
        {type === 'link' && <Field label="채용공고 링크">
          <input type="url" inputMode="url" value={url} onChange={onUrlChange} placeholder="https://" disabled={importing}/>
        </Field>}
        {type === 'image' && <>
          <label className="posting-upload">
            <input type="file" accept={imageTypes.join(',')} onChange={onFileChange} disabled={importing}/>
            <Upload size={20} aria-hidden="true"/>
            <span>{file ? '이미지 바꾸기' : '공고 이미지 선택'}</span>
            <small>{file ? file.name : <>클릭하거나 <kbd>{pasteKey}</kbd><kbd>V</kbd>로 붙여넣기</>}</small>
            {!file && <small>JPG, PNG, WEBP · 최대 10MB</small>}
          </label>
          {preview && <img className="posting-source-thumbnail" src={preview} alt="선택한 공고 이미지"/>}
        </>}
        {error && <Notice type="error">{error}</Notice>}
      </div>
      <div className="posting-source-footer">
        <small>가져온 내용은 다음 화면에서 확인하고 수정할 수 있어요.</small>
        <button className="button primary" disabled={importing}>
          {importing ? '가져오는 중…' : (type === 'link' ? url.trim() : file) ? '공고 가져오기' : '직접 입력'}
          <ArrowRight size={16} aria-hidden="true"/>
        </button>
      </div>
    </form>
  </main>;
}

function PostingImportWaiting({phase, onClose, onManualEntry}) {
  const [elapsed, setElapsed] = useState(0);
  const [processingTime, setProcessingTime] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const timer = setInterval(() => setElapsed(Math.floor((performance.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (phase === 'queued' || phase === 'upload') return;
    const start = performance.now();
    const timer = setInterval(() => setProcessingTime((performance.now() - start) / 1000), 300);
    return () => clearInterval(timer);
  }, [phase]);

  const percent = Math.min(94, Math.round(100 * (1 - Math.exp(-processingTime / 6))));

  return <Modal title="채용공고를 가져오고 있어요" className="posting-import-modal" onClose={onClose}>
    <div className="posting-import-progress" data-phase={phase}>
      <div className="posting-import-visual" aria-hidden="true">
        <span className="posting-import-document"><FileText size={39} strokeWidth={1.35}/></span>
      </div>
      <div className="posting-import-meter">
        <p role="status">{importMessages[phase]}</p>
        <div className="posting-import-metrics" aria-hidden="true">
          <span>예상 진행률 <strong>{percent}%</strong></span>
          <span>경과 {elapsed}초</span>
        </div>
        <div className="posting-import-track" role="progressbar" aria-label="공고 가져오기 예상 진행률"
          aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <span style={{transform:`scaleX(${percent / 100})`}}/>
        </div>
      </div>
    </div>
    <div className="posting-import-actions">
      <button type="button" className="button" onClick={onManualEntry}>
        직접 입력하기 <ArrowRight size={16} aria-hidden="true"/>
      </button>
    </div>
  </Modal>;
}

function PostingSectionFields({sections, onChange}) {
  const list = useRef(null);
  const added = useRef('');
  useLayoutEffect(() => {
    if (added.current) {
      list.current?.querySelector('[data-section-id="' + added.current + '"]')?.querySelector('input:placeholder-shown, textarea')?.focus();
      added.current = '';
    }
  }, [sections]);

  function add(title) {
    const id = uid('section');
    added.current = id;
    onChange([...sections, {id, title, body:''}]);
  }

  function update(id, field, value) {
    onChange(sections.map(section => section.id === id ? {...section, [field]: value} : section));
  }

  function move(index, offset) {
    const next = [...sections];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  }

  const missing = suggestedSections.filter(title => !sections.some(section => section.title.trim() === title));
  return <section className="posting-review-group" aria-labelledby="posting-sections-title">
    <div className="posting-group-heading">
      <h3 id="posting-sections-title">공고 내용</h3>
      <button type="button" className="text-button" onClick={() => add('')}><Plus size={16}/>항목 추가</button>
    </div>
    {missing.length > 0 && <div className="posting-section-suggestions" aria-label="추천 공고 항목">
      {missing.map(title => <button type="button" className="button small" key={title} onClick={() => add(title)}>
        <Plus size={13} aria-hidden="true"/>{title}
      </button>)}
    </div>}
    <div className="posting-section-list" ref={list}>
      {sections.map((section, index) => <div className="posting-section" key={section.id} data-section-id={section.id}>
        <div className="posting-section-heading">
          <input aria-label={'항목 ' + (index + 1) + ' 제목'} placeholder="항목 이름" required maxLength={100}
            value={section.title} onChange={event => update(section.id, 'title', event.target.value)}/>
          <div className="posting-section-actions">
            <IconButton label={'항목 ' + (index + 1) + ' 위로'} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15}/></IconButton>
            <IconButton label={'항목 ' + (index + 1) + ' 아래로'} disabled={index === sections.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15}/></IconButton>
            <IconButton label={'항목 ' + (index + 1) + ' 삭제'} onClick={() => onChange(sections.filter(item => item.id !== section.id))}><Trash2 size={15}/></IconButton>
          </div>
        </div>
        <textarea aria-label={'항목 ' + (index + 1) + ' 내용'} placeholder="공고 내용을 입력하세요." rows={Math.min(8, Math.max(2, section.body.split('\n').length))}
          value={section.body} onChange={event => update(section.id, 'body', event.target.value)}/>
      </div>)}
    </div>
  </section>;
}

function postingDraft(existing) {
  return {
    company: existing?.company || '',
    role: existing?.role || '',
    deadline: existing?.deadline || '',
    deadlineTime: existing?.deadlineTime || '',
    stages: existing?.stages || defaultStages,
    questions: existing?.questions.length ? existing.questions.map(({id, prompt, limit}) => ({id, prompt, limit}))
      : [{prompt:'', limit:null}],
    sections: existing ? postingSections(existing) : [],
  };
}

function positionFields(posting, position) {
  const questions = [...posting.questions, ...(position?.questions ?? [])].filter(question => question.prompt?.trim());
  return {
    role: position?.role ?? posting.role,
    deadline: position?.deadline || posting.deadline,
    deadlineTime: position?.deadline ? position.deadlineTime : posting.deadlineTime,
    sections: [...posting.sections, ...(position?.sections ?? [])].map(section => ({...section, id:uid('section')})),
    stages: position?.stages.length ? position.stages : posting.stages,
    questions: questions.length ? questions : [{prompt:'', limit:null}],
  };
}

function sendSharedQuestions(path, body, signal = AbortSignal.timeout(2_000)) {
  return fetch(sharedQuestionsPath + path, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body),
    signal,
  });
}

function SharedQuestionReport({version, questions}) {
  const [status, setStatus] = useState('');
  const [includeCorrections, setIncludeCorrections] = useState(false);
  const corrections = questionPayload(questions.filter(question => !question.personalTemplate));
  const changed = corrections.length > 0 && JSON.stringify(corrections) !== JSON.stringify(version.questions);
  const canSendCorrections = changed && fitsSharedQuestionLimits(corrections);

  async function report() {
    setStatus('sending');
    try {
      const response = await sendSharedQuestions('/' + encodeURIComponent(version.id) + '/reports',
        includeCorrections && canSendCorrections ? {questions:corrections} : {});
      setStatus(response.ok ? 'sent' : 'failed');
    } catch {
      setStatus('failed');
    }
  }

  return <div className="posting-shared-questions">
    <div className="posting-shared-heading">
      <div><strong>공고 문항 확인</strong><p>등록하기 전에 공고 원문과 대조해 주세요.</p></div>
      {!status && <button type="button" className="text-button" onClick={() => setStatus('open')}>실제 문항과 달라요</button>}
    </div>
    {status === 'sent' && <Notice>제보를 보냈어요.</Notice>}
    {status && status !== 'sent' && <div className="posting-report-fields">
      <p id="posting-report-help">아래에서 문항이나 글자 수를 수정하면 정정 내용도 함께 보낼 수 있어요.</p>
      <label>
        <input type="checkbox" checked={canSendCorrections && includeCorrections} disabled={!canSendCorrections || status === 'sending'}
          onChange={event => setIncludeCorrections(event.target.checked)} aria-describedby="posting-report-help"/>
        수정한 문항도 보내기
      </label>
      {changed && !canSendCorrections && <p>{sharedQuestionLimitHint}</p>}
      {status === 'failed' && <Notice type="error">제보를 보내지 못했어요. 다시 시도해 주세요.</Notice>}
      <div className="posting-report-actions">
        <button type="button" className="button small" disabled={status === 'sending'} onClick={() => {
          setStatus('');
          setIncludeCorrections(false);
        }}>취소</button>
        <button type="button" className="button small primary" disabled={status === 'sending'} onClick={report}>
          {status === 'sending' ? '보내는 중…' : '제보 보내기'}
        </button>
      </div>
    </div>}
  </div>;
}

export default function Posting({onAdd, navigate, existing, profile, onSave, templateQuestions}) {
  const [type, setType] = useState(existing?.source || 'link');
  const [review, setReview] = useState(Boolean(existing));
  const [url, setUrl] = useState(existing?.url || '');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const importing = Boolean(importProgress);
  const [importNotice, setImportNotice] = useState('');
  const [sourceText, setSourceText] = useState(existing?.sourceText || '');
  const [data, setData] = useState(() => postingDraft(existing));
  const [importedPosting, setImportedPosting] = useState(null);
  const [positionSelection, setPositionSelection] = useState('');
  const [questionLookup, setQuestionLookup] = useState(null);
  const [manualQuestionKey, setManualQuestionKey] = useState(null);
  const [sharedEdits, setSharedEdits] = useState(null);
  const [templateStatus, setTemplateStatus] = useState('');
  const templateRequest = useRef(null);
  const positions = importedPosting?.positions ?? [];
  const needsPosition = positions.length > 1 && !positionSelection;
  const selectedPosition = positions.length === 1 ? positions[0] : positions[Number(positionSelection)];
  const hasImportedQuestions = [...(importedPosting?.questions ?? []), ...(selectedPosition?.questions ?? [])]
    .some(question => question.prompt?.trim());
  const referenceLink = safeUrl(url.trim());
  const role = data.role.trim();
  const questionKey = !existing?.questions.length && review && !needsPosition && !hasImportedQuestions && referenceLink && role
    ? JSON.stringify({url:referenceLink, role}) : '';
  const lookup = questionKey && questionLookup?.key === questionKey ? questionLookup : null;
  const sharedVersion = manualQuestionKey === null ? lookup?.version : null;
  const displayedQuestions = !sharedVersion ? data.questions
    : sharedEdits?.id === sharedVersion.id ? sharedEdits.questions : sharedVersion.questions;
  const sharedQuestions = questionPayload(displayedQuestions);
  const publication = questionPublication(questionKey, manualQuestionKey, lookup, displayedQuestions);
  const canLoadTemplate = !displayedQuestions.some(question => question.personalTemplate) && (!questionKey || lookup);
  const preparedSource = useRef(null);
  const importedSource = useRef(null);
  const importRequest = useRef(null);
  useEffect(() => () => {
    const request = importRequest.current;
    importRequest.current = null;
    request?.abort();
  }, []);
  useEffect(() => {
    if (!questionKey) return;
    setManualQuestionKey(key => key === '' ? questionKey : key);
    const request = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(2_000)]);
        const response = await sendSharedQuestions('/lookup', JSON.parse(questionKey), signal);
        const version = response.status === 200 ? await response.json() : null;
        if (!request.signal.aborted) setQuestionLookup({key:questionKey, available:response.ok, version});
      } catch {
        if (!request.signal.aborted) setQuestionLookup({key:questionKey, available:false});
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [questionKey]);
  useEffect(() => {
    setTemplateStatus('');
    return () => {
      templateRequest.current?.abort();
      templateRequest.current = null;
    };
  }, [review, questionKey, profile, sharedVersion?.id]);
  const preview = useImagePreview(file, existing?.attachmentId);
  const change = (key, value) => setData(current => ({...current, [key]:value}));

  async function loadEssayTemplate() {
    if (!canLoadTemplate || templateRequest.current) return;
    const request = new AbortController();
    templateRequest.current = request;
    setTemplateStatus('loading');
    try {
      const items = templateQuestions === undefined ? await requestEssayTemplate(profile, {signal:request.signal})
        : essayTemplateItems(templateQuestions);
      if (request.signal.aborted) return;
      if (!items.length) {
        setTemplateStatus('empty');
        return;
      }
      const next = appendEssayTemplate(displayedQuestions, items);
      if (next === displayedQuestions) {
        setTemplateStatus('already-added');
        return;
      }
      if (sharedVersion) {
        setSharedEdits({id:sharedVersion.id, questions:next});
      } else {
        setManualQuestionKey(questionKey);
        change('questions', next);
      }
      setTemplateStatus('loaded');
    } catch {
      if (!request.signal.aborted) setTemplateStatus('failed');
    } finally {
      if (templateRequest.current === request) templateRequest.current = null;
    }
  }

  function changeQuestions(questions) {
    if (templateRequest.current) {
      templateRequest.current.abort();
      templateRequest.current = null;
      setTemplateStatus('');
    }
    if (sharedVersion) {
      setSharedEdits({id:sharedVersion.id, questions});
    } else {
      setManualQuestionKey(current => data.questions.some(question => question.prompt.trim())
        ? current ?? questionKey : questionKey);
      change('questions', questions);
    }
  }

  function choosePosition(event) {
    const value = event.target.value;
    const position = positions[Number(value)];
    setPositionSelection(value);
    setError('');
    setManualQuestionKey(null);
    setSharedEdits(null);
    setData(current => ({...current, ...positionFields(importedPosting, position), role:position?.role ?? ''}));
  }

  function cancelImport() {
    const request = importRequest.current;
    if (!request) return;
    importRequest.current = null;
    request.abort();
    setImportProgress('');
  }

  function updateUrl(value) {
    cancelImport();
    setUrl(value);
    setError('');
    setImportNotice('');
  }

  function acceptImage(selected) {
    if (!imageTypes.includes(selected.type) || selected.size > 10 * 1024 * 1024) {
      setError('10MB 이하의 JPG, PNG, WEBP 이미지를 선택해 주세요.');
      return;
    }
    setError('');
    setFile(selected);
  }

  function selectImage(event) {
    const selected = event.currentTarget.files[0];
    event.currentTarget.value = '';
    if (selected) acceptImage(selected);
  }

  useEffect(() => {
    if (existing || review || importing) return undefined;
    const paste = event => {
      const image = Array.from(event.clipboardData?.files || []).find(item => item.type.startsWith('image/'));
      if (!image) return;
      event.preventDefault();
      setType('image');
      acceptImage(image);
    };
    document.addEventListener('paste', paste);
    return () => document.removeEventListener('paste', paste);
  }, [existing, review, importing]);

  function prepare(event) {
    event.preventDefault();
    if (importRequest.current) return;
    const link = type === 'link' ? safeUrl(url.trim()) : '';
    if (type === 'link' && url.trim() && !link) {
      setError('http 또는 https 공고 주소를 입력해 주세요.');
      return;
    }
    setError('');
    const input = type === 'image' ? file : link;
    const source = input || type;
    if (preparedSource.current !== source) {
      preparedSource.current = source;
      importedSource.current = null;
      setData(postingDraft());
      setImportedPosting(null);
      setPositionSelection('');
      setManualQuestionKey(null);
      setSharedEdits(null);
      setSourceText('');
      setImportNotice('');
    }
    if (!input || importedSource.current === source) {
      setReview(true);
      return;
    }
    loadPosting(type === 'image' ? 'import-image' : 'import', input);
  }

  async function loadPosting(path, input) {
    if (importRequest.current || saving) return;
    const isUpload = path === 'import-image';
    const body = isUpload ? new FormData() : JSON.stringify({url:input});
    if (isUpload) body.set('image', input);

    const request = new AbortController();
    importRequest.current = request;
    const timeout = setTimeout(() => request.abort(), isUpload ? 25_000 : 30_000);
    setImportProgress(isUpload ? 'upload' : 'link');
    setImportNotice('');
    try {
      let response = await fetch('/api/postings/' + path, {
        method: 'POST',
        headers: isUpload ? undefined : {'Content-Type': 'application/json'},
        body,
        signal: request.signal,
      });
      let payload = await response.json();
      if (isUpload && response.status === 202) {
        if (payload?.status !== 'QUEUED' || typeof payload.jobId !== 'string' || !payload.jobId) {
          throw new Error('Invalid posting job');
        }
        const jobUrl = '/api/postings/import-jobs/' + encodeURIComponent(payload.jobId);
        while (response.ok && (payload?.status === 'QUEUED' || payload?.status === 'PROCESSING')) {
          if (importRequest.current !== request) return;
          setImportProgress(payload.status === 'QUEUED' ? 'queued' : 'image');
          await waitBeforePolling(response, request.signal);
          response = await fetch(jobUrl, {signal:request.signal, cache:'no-store'});
          payload = await response.json();
        }
      }
      if (importRequest.current !== request) return;
      if (response.ok && (!isUpload || payload?.status === 'COMPLETED')) {
        const imported = isUpload ? payload.result : payload;
        const options = imported.positions ?? [];
        const fields = positionFields(imported, options.length === 1 ? options[0] : undefined);
        setData(current => ({...current, ...fields, company:imported.company, role:options.length > 1 ? '' : fields.role}));
        setImportedPosting(imported);
        importedSource.current = input;
        if (imported.sourceText) setSourceText(imported.sourceText);
      } else {
        const problem = response.ok && isUpload ? payload?.error : payload;
        const message = typeof problem?.message === 'string' && problem.message ? problem.message : importFailure;
        setImportNotice(message);
      }
      setReview(true);
    } catch {
      if (importRequest.current !== request) return;
      setImportNotice(request.signal.aborted ? '공고를 가져오는 시간이 초과됐어요.' : importFailure);
      setReview(true);
    } finally {
      clearTimeout(timeout);
      if (importRequest.current === request) {
        importRequest.current = null;
        setImportProgress('');
      }
    }
  }

  function closeReview() {
    if (saving) return;
    cancelImport();
    if (existing) navigate('/application/' + existing.id);
    else {
      setError('');
      setReview(false);
    }
  }

  function enterManually() {
    cancelImport();
    setImportNotice('');
    setError('');
    setReview(true);
  }

  async function submit(event) {
    event.preventDefault();
    if (saving || importRequest.current || needsPosition) return;

    const questions = displayedQuestions.map(question => ({...question, prompt:question.prompt.trim(), limit:Number(question.limit) || 1000}))
      .filter(question => question.prompt);
    const company = data.company.trim();
    const link = safeUrl(url.trim());
    if (!company || !role) {setError('회사와 직무를 입력해 주세요.');return;}
    if (displayedQuestions.some(question => question.id && !question.prompt.trim())) {
      setError('작성 기록을 보관하려면 기존 문항의 내용을 입력해 주세요.');
      return;
    }
    if (url.trim() && !link) {setError('http 또는 https 공고 주소를 입력해 주세요.');return;}
    if (data.sections.some(section => !section.title.trim())) {setError('공고 항목의 이름을 입력해 주세요.');return;}

    setError('');
    setSaving(true);
    try {
      let attachmentId = existing?.attachmentId || '';
      if (file && type === 'image') {
        attachmentId = uid('attachment');
        await putAttachment(attachmentId, file);
      }
      const values = {
        ...data, company, role, questions, url:link, source:type,
        sourceText,
        attachmentId, deadlineTime:data.deadline ? data.deadlineTime : '',
        sections:data.sections.map(section => ({...section, title:section.title.trim(), body:section.body.trim()})),
        stages:data.stages.map(stage => stage.trim()).filter(Boolean),
      };
      let nextPath;
      if (existing) {
        onSave({...existing, ...values, deadlineDetails:values.deadline ? existing.deadlineDetails : undefined,
          questions:questions.map(question => {
            const previous = existing.questions.find(item => item.id === question.id);
            return previous ? {...previous, ...question} : createPostingQuestion(question);
          })});
        nextPath = '/application/' + existing.id;
      } else {
        const application = createApplication(values);
        onAdd(application);
        nextPath = questions.length ? writingPath(application) : '/application/' + application.id;
      }
      if (publication === 'shareable' && sharedQuestions.length) {
        await sendSharedQuestions('', {...JSON.parse(questionKey), questions:sharedQuestions})
          .catch(() => {});
      }
      navigate(nextPath);
    } catch {
      setError('등록 내용을 보관하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  const referenceImage = (type === 'image' || existing) && preview;
  const referenceText = sourceText.trim();

  return <>
    {!existing && <PostingSource type={type} onTypeChange={value => {setType(value);setError('');}}
      url={url} onUrlChange={event => updateUrl(event.target.value)}
      file={file} onFileChange={selectImage} preview={preview} error={review ? '' : error} importing={importing} onPrepare={prepare}/>}
    {importing ? <PostingImportWaiting phase={importProgress} onClose={closeReview} onManualEntry={enterManually}/>
      : review && <Modal title={existing ? '공고 정보 수정' : '공고 내용 확인'} className="posting-review-modal" onClose={closeReview}>
      <form className="posting-review-form" onSubmit={submit}>
        <div className="posting-review-scroll">
          {!existing && <p className="posting-review-intro">{importedSource.current
            ? '가져온 내용을 확인하고 필요한 부분을 수정하세요.'
            : '회사와 직무를 입력하세요. 자소서 문항은 나중에 추가할 수 있어요.'}</p>}
          {importNotice && <Notice>{importNotice}</Notice>}
          {(referenceImage || referenceText || referenceLink) && <div className="posting-review-source">
            {referenceLink && <div className="posting-source-actions">
              <a className="button small" href={referenceLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={15} aria-hidden="true"/>공고 원문 열기
              </a>
            </div>}
            {(referenceImage || referenceText) && <details className="posting-original">
              <summary>{referenceImage && referenceText ? '첨부 이미지와 원문 보기'
                : referenceImage ? '첨부 이미지 보기' : '가져온 원문 보기'}</summary>
              {referenceImage && <img className="posting-image" src={referenceImage} alt="첨부한 공고 이미지"/>}
              {referenceText && <p>{referenceText}</p>}
            </details>}
          </div>}
          {positions.length > 1 && <div className="posting-position-picker">
            <Field label="지원할 직무" hint="선택한 직무의 공고 내용이 채워져요.">
              <select value={positionSelection} onChange={choosePosition} disabled={saving} required>
                <option value="" disabled>지원할 직무를 선택하세요</option>
                {positions.map((position, index) => <option key={position.role} value={String(index)}>{position.role}</option>)}
                <option value="manual">직무 직접 입력</option>
              </select>
            </Field>
          </div>}
          {!needsPosition && <fieldset className="posting-review-fields" disabled={saving}>
            <section className="posting-review-group" aria-labelledby="posting-basics-title">
              <div className="posting-group-heading"><h3 id="posting-basics-title">기본 정보</h3></div>
              <div className="posting-basics-grid">
                <Field label={<>회사 <span className="posting-required" aria-hidden="true">*</span></>}>
                  <input value={data.company} onChange={event => change('company', event.target.value)} maxLength={100} required/>
                </Field>
                <Field label={<>직무 <span className="posting-required" aria-hidden="true">*</span></>}>
                  <input value={data.role} onChange={event => change('role', event.target.value)} maxLength={150} required/>
                </Field>
              </div>
              <div className="posting-deadline-grid">
                <Field label="지원 마감일"><input type="date" value={data.deadline} onChange={event => change('deadline', event.target.value)}/></Field>
                <Field label="마감 시간"><input type="time" value={data.deadlineTime} onChange={event => change('deadlineTime', event.target.value)}/></Field>
              </div>
              <Field label="지원 링크"><input type="url" value={url} onChange={event => updateUrl(event.target.value)} placeholder="https://"/></Field>
            </section>
            <PostingSectionFields sections={data.sections} onChange={value => change('sections', value)}/>
            <section className="posting-review-group" aria-labelledby="posting-stages-title">
              <div className="posting-group-heading"><h3 id="posting-stages-title">채용 절차</h3></div>
              <StageFields stages={data.stages} onChange={value => change('stages', value)}/>
            </section>
            <section className="posting-review-group" aria-labelledby="posting-questions-title">
              <div className="posting-group-heading">
                <h3 id="posting-questions-title">자소서 문항</h3>
                <button type="button" className="text-button" onClick={() => changeQuestions([...displayedQuestions, {prompt:'', limit:null}])}>
                  <Plus size={16}/>문항 추가
                </button>
              </div>
              {!sharedQuestions.length && <p className="posting-question-hint" role="status">
                {lookup?.available === false ? '이전 문항을 불러오지 못했어요. 문항 없이 공고를 등록할 수 있어요.'
                  : lookup?.available ? '이 공고와 직무에 등록된 공통 문항이 없어요. 문항은 나중에 추가할 수 있어요.'
                  : '문항을 모르면 비워 두세요. 공고를 등록한 뒤 추가할 수 있어요.'}
              </p>}
              {publication === 'shareable' && <p className="posting-question-hint">
                입력한 문항은 공고 정보에 활용될 수 있어요. 공고에 나온 질문만 입력해 주세요.
              </p>}
              {publication === 'different-posting' && <p className="posting-question-hint">
                공고 주소나 직무가 바뀌어 현재 문항은 내 지원 건에만 저장돼요.
              </p>}
              {publication === 'out-of-range' && <p className="posting-question-hint">
                {sharedQuestionLimitHint} 현재 문항은 내 지원 건에만 저장돼요.
              </p>}
              {canLoadTemplate && <button type="button" className="button small essay-template-load"
                disabled={templateStatus === 'loading'} onClick={loadEssayTemplate}>
                {templateStatus === 'loading' ? '불러오는 중…' : '내 공통 자소서 불러오기'}
              </button>}
              {canLoadTemplate && templateStatus === 'empty' && <Notice>지원 목록의 내 공통 자소서에서 먼저 작성해 주세요.</Notice>}
              {canLoadTemplate && templateStatus === 'already-added' && <Notice>가져올 문항이 이미 이 지원 건에 있어요.</Notice>}
              {canLoadTemplate && templateStatus === 'failed' && <Notice type="error">공통 자소서를 불러오지 못했어요. 다시 시도해 주세요.</Notice>}
              {displayedQuestions.some(question => question.personalTemplate) && <p className="posting-question-hint">
                내 공통 자소서를 가져왔어요. 답변 초안은 작성 화면에서 수정할 수 있어요.
              </p>}
              {sharedVersion && <SharedQuestionReport key={sharedVersion.id} version={sharedVersion} questions={displayedQuestions}/>}
              {displayedQuestions.map((question, index) => <div className="question-field" key={question.id || index}>
                <Field label={'Q' + (index + 1)}>
                  <textarea rows={2} value={question.prompt}
                    onChange={event => changeQuestions(displayedQuestions.map((item, i) => i === index ? {...item, prompt:event.target.value} : item))}/>
                </Field>
                <Field label="글자 수"><input type="number" min={1} max={100000} value={question.limit ?? ''} placeholder="미확인"
                  onChange={event => changeQuestions(displayedQuestions.map((item, i) => i === index ? {...item, limit:event.target.value} : item))}/></Field>
                {displayedQuestions.length > 1 && !question.id && <IconButton label={'Q' + (index + 1) + ' 삭제'}
                  onClick={() => changeQuestions(displayedQuestions.filter((_, i) => i !== index))}><Trash2 size={16}/></IconButton>}
              </div>)}
            </section>
          </fieldset>}
        </div>
        <div className="posting-review-footer">
          {error && <Notice type="error">{error}</Notice>}
          <div className="posting-review-buttons">
            <button type="button" className="button" disabled={saving} onClick={closeReview}>
              {!existing && <ArrowLeft size={15} aria-hidden="true"/>}{existing ? '취소' : '이전'}
            </button>
            <button type="submit" className="button primary" disabled={saving || needsPosition}>
              {saving ? '저장 중…' : existing ? '변경 저장' : sharedQuestions.length ? '등록하고 작성' : '공고 등록'}
            </button>
          </div>
        </div>
      </form>
    </Modal>}
  </>;
}
