import Dropdown from './Dropdown.jsx';
import React, {useMemo, useState} from 'react';
import {ArrowRight, ClipboardList, FileText, Plus, Upload, Volume2, X} from 'lucide-react';
import {Field, IconButton, Notice} from './UI.jsx';
import {materialExcerpts, materialKinds, materialQuestions, practiceModeLabels} from '../interview.js';
import {readMaterialFile} from '../interview-material-file.js';
import {uid, answerLabel} from '../model.js';

export default function InterviewSetup({application, source, designated, questions, questionsPath, initialMode, expired, onStart}) {
  const [mode, setMode] = useState(initialMode);
  const [includeDesignated, setIncludeDesignated] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [kind, setKind] = useState(materialKinds[0]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [reading, setReading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const tailored = useMemo(() => {
    const answers = includeDesignated ? designated.map(answer => ({kind: '자기소개서', text: answer.text})) : [];
    return materialQuestions([...answers, ...documents]);
  }, [designated, documents, includeDesignated]);
  const activeQuestions = mode === 'materials' ? tailored : questions;
  const savedText = source ? source.answers.map(answer => answer.text).join('\n') : application.questions.map(question => {
    const branch = question.branches.find(item => item.id === question.activeBranchId) || question.branches[0];
    return branch.draft.text;
  }).join('\n');
  const savedName = source?.name || '현재 작성본';

  function addDocument(name, text, materialKind) {
    if (!materialExcerpts(text).length) {
      setFeedback('질문에 쓸 본문을 찾지 못했어요. 복사할 수 있는 글이 있는 파일을 선택하거나 경험·성과를 붙여 넣어 주세요.');
      return false;
    }
    setFeedback('');
    setDocuments(current => [...current, {id: uid('material'), kind: materialKind, name, text}]);
    return true;
  }

  async function upload(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setFeedback('');
    setReading(true);
    try {
      addDocument(file.name, await readMaterialFile(file), kind);
    } catch (error) {
      setFeedback(error.message || '파일을 열지 못했어요.');
    } finally {
      setReading(false);
    }
  }

  return <section className="interview-setup career-sheet" aria-labelledby="interview-setup-title">
    <header><div><h2 id="interview-setup-title">AI 모의면접</h2><p>{application.company} · {application.role}</p></div></header>
    {expired && <Notice>자료를 다시 추가하면 새 연습을 시작할 수 있어요.</Notice>}
    <fieldset className="practice-modes">
      <legend>연습 방식</legend>
      {Object.entries(practiceModeLabels).map(([value, label]) => {
        const Icon = value === 'expected' ? ClipboardList : FileText;
        return <label className="practice-mode" key={value}>
          <Icon size={19} aria-hidden="true"/>
          <span><strong>{label}</strong><small>{value === 'expected' ? '등록해 둔 예상 질문만 연습' : '이력서·포트폴리오·자소서에서 질문 만들기'}</small></span>
          <input type="radio" name="practice-mode" value={value} checked={mode === value} onChange={() => setMode(value)}/>
        </label>;
      })}
    </fieldset>
    {mode === 'materials' && <div className="practice-material-input">
      <h3>연습 자료</h3>
      {designated.length > 0 && <div className="practice-designated">
        <label><input type="checkbox" checked={includeDesignated} onChange={event => setIncludeDesignated(event.target.checked)}/>
          지정한 문항 제출본 사용 <span>{designated.length}개</span></label>
        <ul>{designated.map(answer => <li key={answer.questionId}>문항 {answer.number} · {answerLabel(answer.label)}</li>)}</ul>
      </div>}
      <div className="practice-upload">
        <Dropdown field label="자료 종류" value={kind} disabled={reading} options={materialKinds} onChange={setKind}/>
        <label className="career-button practice-file">
          <Upload size={15} aria-hidden="true"/>{reading ? '파일 읽는 중…' : '파일 추가'}
          <input aria-label="자료 파일 추가" type="file" disabled={reading}
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={upload}/>
        </label>
      </div>
      <p className="practice-file-hint">PDF·TXT·MD, 파일당 10MB까지 · 텍스트를 선택할 수 있는 PDF</p>
      <div className="practice-material-actions">
        <button className="career-button" aria-expanded={pasteOpen} onClick={() => setPasteOpen(!pasteOpen)}>본문 붙여넣기</button>
        {savedText.trim() && <button className="career-button" disabled={documents.some(doc => doc.text === savedText)}
          onClick={() => addDocument(savedName, savedText, '자기소개서')}><Plus size={14}/>{source ? '선택한 제출본 추가' : '현재 작성본 추가'}</button>}
      </div>
      {pasteOpen && <div className="practice-paste">
        <Field label={kind + ' 본문'}>
          <textarea autoFocus rows={4} value={draft} maxLength={40000} onChange={event => setDraft(event.target.value)}/>
        </Field>
        <button className="career-button" disabled={!draft.trim()} onClick={() => {
          if (addDocument(kind + ' 본문', draft, kind)) {setDraft(''); setPasteOpen(false);}
        }}>본문 추가</button>
      </div>}
      {documents.length > 0 && <ul className="practice-materials">
        {documents.map(doc => <li key={doc.id}>
          <FileText size={17} aria-hidden="true"/><span><strong>{doc.name}</strong><small>{doc.kind}</small></span>
          <IconButton label={doc.name + ' 제거'} onClick={() => setDocuments(current => current.filter(item => item.id !== doc.id))}>
            <X size={16}/>
          </IconButton>
        </li>)}
      </ul>}
      {feedback && <Notice type="error">{feedback}</Notice>}
      <p className="practice-file-hint">자료는 이번 연습에만 사용해요. 질문에 인용된 부분은 연습 기록에 남아요.</p>
    </div>}
    <footer>
      <p className="practice-setup-status" role="status">
        <Volume2 size={16} aria-hidden="true"/>
        {activeQuestions.length ? activeQuestions.length + '개 질문 · 브라우저 음성 읽기' :
          mode === 'expected' ? '등록한 예상 질문이 없어요.' : '자료를 추가하면 인용 질문이 준비돼요.'}
      </p>
      {mode === 'expected' && !questions.length ?
        <a className="career-button primary" href={'#' + questionsPath}>예상 질문 추가<ArrowRight size={15}/></a> :
        <button className="career-button primary" disabled={!activeQuestions.length || reading}
          onClick={() => onStart({mode, questions: activeQuestions})}>면접 시작<ArrowRight size={15}/></button>}
    </footer>
  </section>;
}
