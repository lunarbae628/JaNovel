import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {Field, IconButton, Modal, Notice} from './UI.jsx';
import {designatedSubmissionAnswers} from '../model.js';
import {essayLayout} from '../essay-pdf.js';

function EssayPage({page, title, className = ''}) {
  return <article className={'essay-document ' + className}>
    {page.first && <h3>{title.map((line, i) => <span key={i}>{line}</span>)}</h3>}
    {page.sections.map(section => <section key={section.number}>
      {section.heading.length > 0 && <h4>{section.heading.map((line, i) => <span key={i}>{line}</span>)}</h4>}
      <p>{section.lines.map((line, i) => <span key={i}>{line || '\u00a0'}</span>)}</p>
    </section>)}
  </article>;
}

export default function EssayPdf({application, currentQuestionId, onClose}) {
  const title = application.company + ' · ' + application.role;
  const [scope, setScope] = useState('all');
  const [name, setName] = useState(application.company + ' 자소서');
  const [preview, setPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [printError, setPrintError] = useState(false);
  const titleBeforePrint = useRef('');
  const answers = designatedSubmissionAnswers(application);
  const current = answers.find(answer => answer.questionId === currentQuestionId);
  const sections = scope === 'single' && current ? [current] : answers;
  const sectionData = JSON.stringify(sections);
  const layout = useMemo(() => {
    try {return essayLayout(title, JSON.parse(sectionData));} catch {return null;}
  }, [sectionData, title]);

  useEffect(() => {
    const restoreTitle = () => {
      if (titleBeforePrint.current) {
        document.title = titleBeforePrint.current;
        titleBeforePrint.current = '';
      }
    };
    window.addEventListener('afterprint', restoreTitle);
    document.body.classList.add('essay-printing');
    return () => {
      document.body.classList.remove('essay-printing');
      window.removeEventListener('afterprint', restoreTitle);
      restoreTitle();
    };
  }, []);

  function printPdf() {
    setPrintError(false);
    if (!layout || typeof window.print !== 'function') {
      setPrintError(true);
      return;
    }
    titleBeforePrint.current ||= document.title;
    document.title = (name.trim() || application.company + ' 자소서').replace(/\.pdf$/i, '');
    try {window.print();}
    catch {
      document.title = titleBeforePrint.current;
      titleBeforePrint.current = '';
      setPrintError(true);
    }
  }

  return <>
    <Modal title={preview ? 'PDF 미리보기' : 'PDF 내보내기'} showClose={false}
      className={'essay-pdf-modal ' + (preview ? 'is-preview' : '')} onClose={onClose}>
      {printError && <Notice type="error">PDF를 준비하지 못했어요. 다시 시도해 주세요.</Notice>}
      {preview && layout ? <>
        <div className="essay-preview"><EssayPage page={layout.pages[previewIndex]} title={layout.titleLines}/></div>
        <div className="essay-page-count">
          {layout.pages.length > 1 && <IconButton label="이전 쪽" disabled={previewIndex === 0}
            onClick={() => setPreviewIndex(index => index - 1)}><ChevronLeft size={16}/></IconButton>}
          <span>{previewIndex + 1} / {layout.pages.length}</span>
          {layout.pages.length > 1 && <IconButton label="다음 쪽" disabled={previewIndex === layout.pages.length - 1}
            onClick={() => setPreviewIndex(index => index + 1)}><ChevronRight size={16}/></IconButton>}
        </div>
      </> : <>
        <Field label="파일 이름"><input value={name} maxLength={120} onChange={event => setName(event.target.value)}/></Field>
        <div className="essay-scope" aria-label="PDF 문항 범위">
          <button type="button" className={'button ' + (scope === 'all' ? 'primary' : '')} aria-pressed={scope === 'all'}
            onClick={() => setScope('all')}>전체 제출본</button>
          <button type="button" className={'button ' + (scope === 'single' ? 'primary' : '')} aria-pressed={scope === 'single'}
            disabled={!current} onClick={() => setScope('single')}>현재 문항{current && ' Q' + current.number}</button>
        </div>
        <p className="muted">제출본을 지정한 문항 {sections.length}개를 내보내요.</p>
      </>}
      <div className="form-actions">
        <button className="button essay-return" onClick={preview ? () => setPreview(false) : onClose}>{preview ? '돌아가기' : '제출본으로'}</button>
        {!preview && <button className="button" onClick={() => {
          if (!layout) setPrintError(true);
          else {setPreviewIndex(0); setPreview(true);}
        }}>미리보기</button>}
        <button className="button primary" onClick={printPdf}>PDF 내보내기</button>
      </div>
    </Modal>
    {layout && createPortal(<div className="essay-print">
      {layout.pages.map((page, index) => <EssayPage key={index} page={page} title={layout.titleLines}/>)}
    </div>, document.body)}
  </>;
}
