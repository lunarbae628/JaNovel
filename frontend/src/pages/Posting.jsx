import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ExternalLink, FileText, Image, Link, Plus, ScanText, Trash2, Upload} from 'lucide-react';
import {BackLink, Field, IconButton, Modal, Notice} from '../components/UI.jsx';
import {createQuestion, importPostingText, postingSections, safeUrl, uid} from '../model.js';
import {createApplication} from '../seed.js';
import {getAttachment, putAttachment} from '../storage.js';
import {StageFields} from './Applications.jsx';

const sources = [
  ['link', '링크', Link],
  ['image', '이미지', Image],
];
const defaultStages = ['서류 전형', '기술 면접', '최종 면접'];
const imageTypes = ['image/png', 'image/jpeg', 'image/webp'];
const suggestedSections = ['주요 업무', '지원 요건', '우대 사항'];
const importFailure = '공고 내용을 가져오지 못했어요. 직접 입력할 수 있어요.';

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
            <small>{file ? file.name : 'JPG, PNG, WEBP · 최대 10MB'}</small>
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

function PostingImportWaiting({progress, onClose, onManualEntry}) {
  return <Modal title="공고 가져오는 중" className="posting-import-modal" onClose={onClose}>
    <div className="posting-import-progress">
      <div className="posting-import-icon"><FileText size={28} strokeWidth={1.6} aria-hidden="true"/></div>
      <div className="posting-import-status">
        <p role="status">{progress}</p>
        <div className="posting-import-track" aria-hidden="true"/>
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
    questions: existing?.questions.map(({id, prompt, limit}) => ({id, prompt, limit})) || [{prompt:'', limit:1000}],
    sections: existing ? postingSections(existing) : [],
  };
}

export default function Posting({onAdd, navigate, existing, onSave}) {
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
  const preparedSource = useRef(null);
  const importedSource = useRef(null);
  const importRequest = useRef(null);
  const editedFields = useRef(new Set());
  useEffect(() => () => {
    const request = importRequest.current;
    importRequest.current = null;
    request?.abort();
  }, []);
  const preview = useImagePreview(file, existing?.attachmentId);
  const change = (key, value) => {
    editedFields.current.add(key);
    setData(current => ({...current, [key]:value}));
  };

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

  function selectImage(event) {
    const selected = event.currentTarget.files[0];
    event.currentTarget.value = '';
    if (!selected) return;
    if (!imageTypes.includes(selected.type) || selected.size > 10 * 1024 * 1024) {
      setError('10MB 이하의 JPG, PNG, WEBP 이미지를 선택해 주세요.');
      return;
    }
    setError('');
    setFile(selected);
  }

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
      editedFields.current.clear();
      setData(postingDraft());
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
    const isRetry = path === 'import/ocr';
    const isOcr = isUpload || isRetry;
    const body = isUpload ? new FormData() : JSON.stringify({url:input});
    if (isUpload) body.set('image', input);

    const request = new AbortController();
    importRequest.current = request;
    const timeout = setTimeout(() => request.abort(), isOcr ? 25_000 : 30_000);
    setImportProgress(isOcr ? '이미지를 읽을 준비 중이에요.' : '링크에서 공고 내용을 읽고 있어요.');
    setImportNotice('');
    try {
      let response = await fetch('/api/postings/' + path, {
        method: 'POST',
        headers: isUpload ? undefined : {'Content-Type': 'application/json'},
        body,
        signal: request.signal,
      });
      let payload = await response.json();
      if (isOcr && response.status === 202) {
        if (payload?.status !== 'QUEUED' || typeof payload.jobId !== 'string' || !payload.jobId) {
          throw new Error('Invalid OCR job');
        }
        const jobUrl = '/api/postings/import-jobs/' + encodeURIComponent(payload.jobId);
        while (response.ok && (payload?.status === 'QUEUED' || payload?.status === 'PROCESSING')) {
          if (importRequest.current !== request) return;
          setImportProgress(payload.status === 'QUEUED' ? '이미지 읽기를 기다리는 중이에요.' : '이미지에서 공고 내용을 읽는 중이에요.');
          await waitBeforePolling(response, request.signal);
          response = await fetch(jobUrl, {signal:request.signal, cache:'no-store'});
          payload = await response.json();
        }
      }
      if (importRequest.current !== request) return;
      if (response.ok && (!isOcr || payload?.status === 'COMPLETED')) {
        const imported = isOcr ? payload.result : payload;
        const parsed = importPostingText(imported.sourceText);
        const extracted = {
          company: (imported.company || parsed.company).slice(0, 100),
          role: (imported.role || parsed.role).slice(0, 150),
          deadline: imported.deadline || parsed.deadline,
          sections: parsed.sections.map(section => ({...section, id:uid('section')})),
          stages: parsed.stages,
          questions: parsed.questions,
        };
        const updates = Object.fromEntries(Object.entries(extracted).filter(([key, value]) =>
          value.length && !editedFields.current.has(key)));
        setData(current => ({...current, ...updates}));
        importedSource.current = input;
        setSourceText(imported.sourceText);
        if (isRetry) setImportNotice('이미지에서 읽은 내용을 확인해 주세요.');
      } else {
        const problem = response.ok && isOcr ? payload?.error : payload;
        setImportNotice(typeof problem?.message === 'string' && problem.message ? problem.message : importFailure);
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
    if (saving || importRequest.current) return;

    const questions = data.questions.map(question => ({...question, prompt:question.prompt.trim(), limit:Number(question.limit) || 1000}))
      .filter(question => question.prompt);
    const company = data.company.trim();
    const role = data.role.trim();
    const link = safeUrl(url.trim());
    if (!company || !role) {setError('회사와 직무를 입력해 주세요.');return;}
    if (!questions.length) {setError('자소서 문항을 하나 이상 입력해 주세요.');return;}
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
      if (existing) {
        onSave({...existing, ...values, deadlineDetails:values.deadline ? existing.deadlineDetails : undefined,
          questions:questions.map(question => {
            const previous = existing.questions.find(item => item.id === question.id);
            return previous ? {...previous, ...question} : createQuestion(question.prompt, question.limit);
          })});
        navigate('/application/' + existing.id);
      } else {
        const application = createApplication(values);
        onAdd(application);
        navigate('/write/' + application.id + '/' + application.questions[0].id);
      }
    } catch {
      setError('등록 내용을 보관하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  const referenceImage = (type === 'image' || existing) && preview;
  const referenceText = sourceText.trim();
  const referenceLink = safeUrl(url.trim());
  const canRetryLink = !existing && type === 'link' && Boolean(referenceLink);

  return <>
    {!existing && <PostingSource type={type} onTypeChange={value => {setType(value);setError('');}}
      url={url} onUrlChange={event => updateUrl(event.target.value)}
      file={file} onFileChange={selectImage} preview={preview} error={review ? '' : error} importing={importing} onPrepare={prepare}/>}
    {importing ? <PostingImportWaiting progress={importProgress} onClose={closeReview} onManualEntry={enterManually}/>
      : review && <Modal title={existing ? '공고 정보 수정' : '공고 내용 확인'} className="posting-review-modal" onClose={closeReview}>
      <form className="posting-review-form" onSubmit={submit}>
        <div className="posting-review-scroll">
          {!existing && <p className="posting-review-intro">{referenceText
            ? '가져온 내용을 확인하고 필요한 부분을 수정하세요.'
            : '회사와 직무를 입력하고 작성할 자소서 문항을 추가하세요.'}</p>}
          {importNotice && <Notice>{importNotice}</Notice>}
          {(referenceImage || referenceText || referenceLink) && <div className="posting-review-source">
            {referenceLink && <div className="posting-source-actions">
              <a className="button small" href={referenceLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={15} aria-hidden="true"/>공고 원문 열기
              </a>
              {canRetryLink && <button className="button small posting-retry-button" type="button" disabled={saving}
                onClick={() => {preparedSource.current = referenceLink;loadPosting('import/ocr', referenceLink);}}>
                <ScanText size={16} aria-hidden="true"/>이미지로 다시 가져오기
              </button>}
            </div>}
            {(referenceImage || referenceText) && <details className="posting-original">
              <summary>{referenceImage && referenceText ? '첨부 이미지와 원문 보기'
                : referenceImage ? '첨부 이미지 보기' : '가져온 원문 보기'}</summary>
              {referenceImage && <img className="posting-image" src={referenceImage} alt="첨부한 공고 이미지"/>}
              {referenceText && <p>{referenceText}</p>}
            </details>}
          </div>}
          <fieldset className="posting-review-fields" disabled={saving}>
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
                <button type="button" className="text-button" onClick={() => change('questions', [...data.questions, {prompt:'', limit:1000}])}>
                  <Plus size={16}/>문항 추가
                </button>
              </div>
              {data.questions.map((question, index) => <div className="question-field" key={question.id || index}>
                <Field label={'Q' + (index + 1)}>
                  <textarea rows={2} value={question.prompt} required
                    onChange={event => change('questions', data.questions.map((item, i) => i === index ? {...item, prompt:event.target.value} : item))}/>
                </Field>
                <Field label="글자 수"><input type="number" min={1} max={100000} value={question.limit}
                  onChange={event => change('questions', data.questions.map((item, i) => i === index ? {...item, limit:event.target.value} : item))}/></Field>
                {data.questions.length > 1 && !question.id && <IconButton label={'Q' + (index + 1) + ' 삭제'}
                  onClick={() => change('questions', data.questions.filter((_, i) => i !== index))}><Trash2 size={16}/></IconButton>}
              </div>)}
            </section>
          </fieldset>
        </div>
        <div className="posting-review-footer">
          {error && <Notice type="error">{error}</Notice>}
          <div className="posting-review-buttons">
            <button type="button" className="button" disabled={saving} onClick={closeReview}>
              {!existing && <ArrowLeft size={15} aria-hidden="true"/>}{existing ? '취소' : '이전'}
            </button>
            <button type="submit" className="button primary" disabled={saving}>{saving ? '저장 중…' : existing ? '변경 저장' : '등록하고 작성'}</button>
          </div>
        </div>
      </form>
    </Modal>}
  </>;
}
