import React, {useState} from 'react';
import {Check, Loader2, Search, Sparkles, X} from 'lucide-react';
import {relatedExperiences} from '../experience-recommend.js';
import {Modal, Notice} from './UI.jsx';
import data from './experience-selection-preview-data.json';
import './experience-selection-preview.css';

const {experiences} = data;
const experiencesById = new Map(experiences.map(item => [item.id, item]));

function toggleExperience(ids, id) {
  return ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id];
}
// 카드에 보이는 한 줄 요약. 정리된 결과가 있으면 결과를, 없으면 원문을 쓴다.
const summaryOf = item => item.facts?.find(fact => fact.label === '결과')?.content ?? item.text;
const draftLabel = count => count ? '경험 ' + count + '개로 초안 만들기' : '초안 만들기';

function Reasons({reasons}) {
  return reasons?.length ? <span className="experience-reasons" title="공고·문항과 겹치는 말">
    일치 {reasons.map(reason => <i key={reason}>{reason}</i>)}
  </span> : null;
}

function ExperiencePicker({application, question, recommended, selectedIds, onDraft, onClose}) {
  const [query, setQuery] = useState('');
  const [reviewedId, setReviewedId] = useState(selectedIds[0] ?? recommended[0]?.experience.id);
  const [pendingIds, setPendingIds] = useState(selectedIds);
  const search = query.trim().toLowerCase();
  const matches = item => (item.title + ' ' + item.text).toLowerCase().includes(search);
  const reasonsById = new Map(recommended.map(({experience, reasons}) => [experience.id, reasons]));
  const sections = [
    ['이 문항과 맞는 경험', recommended.map(({experience}) => experience).filter(matches)],
    ['다른 경험', experiences.filter(item => !reasonsById.has(item.id) && matches(item))],
  ].filter(([, items]) => items.length);
  const reviewed = experiencesById.get(reviewedId);

  return <Modal title="경험 고르기" className="experience-picker-modal" wide onClose={onClose}>
    <div className="experience-picker-context">
      <div className="experience-picker-job">
        <strong className="experience-picker-company">{application.company}</strong>
        {application.role && <span>{application.role}</span>}
      </div>
      <p className="experience-picker-prompt">{question.prompt}</p>
    </div>
    <div className="experience-picker-layout">
      <section className="experience-picker-library" aria-label="경험 목록">
        <div className="experience-picker-search"><Search size={16} aria-hidden="true"/>
          <input type="search" aria-label="경험 검색" placeholder="경험 제목, 키워드 검색"
            value={query} onChange={event => setQuery(event.target.value)}/>
        </div>
        <div className="experience-picker-list">
          {sections.length ? sections.map(([label, items]) => <div key={label} className="experience-picker-section">
            <p className="experience-picker-list-label">{label}</p>
            {items.map(item => {
              const selected = pendingIds.includes(item.id);
              return <button key={item.id} type="button" data-experience={item.id} aria-pressed={selected}
                className={'experience-picker-row' + (reviewed?.id === item.id ? ' reviewed' : '')}
                onFocus={() => setReviewedId(item.id)}
                onClick={() => {setReviewedId(item.id); setPendingIds(current => toggleExperience(current, item.id));}}>
                <span className="experience-check" aria-hidden="true">{selected && <Check size={12}/>}</span>
                <strong>{item.title}</strong>
                <small>{summaryOf(item)}</small>
                <Reasons reasons={reasonsById.get(item.id)}/>
              </button>;
            })}
          </div>) : <p className="experience-picker-empty">검색 조건에 맞는 경험이 없어요.</p>}
        </div>
      </section>
      <section className="experience-picker-detail" aria-label="경험 상세" aria-live="polite">
        {reviewed ? <>
          <h3>{reviewed.title}</h3>
          {reviewed.facts ? <>
            <dl className="experience-facts">
              {reviewed.facts.map(({label, content}) => <div key={label}><dt>{label}</dt><dd>{content}</dd></div>)}
            </dl>
            <details className="experience-original"><summary>경험 원문 보기</summary><p>{reviewed.text}</p></details>
          </> : <p className="experience-unstructured">{reviewed.text}</p>}
        </> : <p className="experience-picker-empty">경험을 누르면 내용을 볼 수 있어요.</p>}
      </section>
    </div>
    <footer className="experience-picker-footer">
      <span aria-live="polite">선택 <strong>{pendingIds.length}</strong>개</span>
      <div>
        <button type="button" className="button" onClick={onClose}>취소</button>
        <button type="button" className="button primary" disabled={!pendingIds.length}
          onClick={() => onDraft(pendingIds)}><Sparkles size={14} aria-hidden="true"/>{draftLabel(pendingIds.length)}</button>
      </div>
    </footer>
  </Modal>;
}

// 본문을 쓰기 시작한 뒤 경험으로 다시 초안을 받을 때 여는 창.
export function ExperienceDraftDialog({application, question, onDraft, onClose}) {
  const recommended = relatedExperiences(experiences, application, question);
  return <ExperiencePicker application={application} question={question} recommended={recommended} selectedIds={[]}
    onDraft={ids => onDraft(ids.map(id => experiencesById.get(id)))} onClose={onClose}/>;
}

// 본문이 빈 문항에서 본문 자리에 보여 준다. 공고·문항에 맞는 경험을 고르면 바로 초안을 요청한다.
export default function DraftStarter({application, question, busy, error, onDraft, onWrite}) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const recommended = relatedExperiences(experiences, application, question);
  const recommendedIds = new Set(recommended.map(({experience}) => experience.id));
  const others = selectedIds.filter(id => !recommendedIds.has(id)).map(id => experiencesById.get(id));
  const draft = ids => onDraft(ids.map(id => experiencesById.get(id)));
  const toggle = id => setSelectedIds(current => toggleExperience(current, id));

  return <section className="draft-starter" aria-labelledby="draft-starter-title">
    <div className="draft-starter-heading">
      <h2 id="draft-starter-title">어떤 경험으로 쓸까요?</h2><small>샘플 경험</small>
    </div>
    {recommended.length ? <div className="draft-starter-grid">{recommended.map(({experience: item, reasons}) => {
      const selected = selectedIds.includes(item.id);
      return <button key={item.id} type="button" className="draft-starter-card" data-experience={item.id}
        aria-pressed={selected} disabled={busy} onClick={() => toggle(item.id)}>
        <span className="experience-check" aria-hidden="true">{selected && <Check size={12}/>}</span>
        <strong>{item.title}</strong>
        <span className="draft-starter-summary">{summaryOf(item)}</span>
        <Reasons reasons={reasons}/>
      </button>;
    })}</div> : <p className="draft-starter-empty">현재 공고와 문항에서 추천할 경험을 찾지 못했어요.</p>}
    {!!others.length && <div className="draft-starter-others">그 밖에 고른 경험
      {others.map(item => <button key={item.id} type="button" disabled={busy} aria-label={item.title + ' 빼기'} onClick={() => toggle(item.id)}>
        {item.title}<X size={12} aria-hidden="true"/></button>)}
    </div>}
    {error && <Notice type="error">{error}</Notice>}
    <div className="draft-starter-actions">
      <button type="button" className="text-button" disabled={busy} onClick={() => setOpen(true)}>
        <Search size={14} aria-hidden="true"/>전체 경험에서 고르기</button>
      <span/>
      <button type="button" className="text-button draft-starter-write" disabled={busy} onClick={onWrite}>직접 쓰기</button>
      <button type="button" className="button primary" disabled={busy || !selectedIds.length} onClick={() => draft(selectedIds)}>
        {busy ? <><Loader2 size={14} className="draft-starter-spin" aria-hidden="true"/>초안을 쓰고 있어요</>
          : <><Sparkles size={14} aria-hidden="true"/>{draftLabel(selectedIds.length)}</>}
      </button>
    </div>
    {open && <ExperiencePicker application={application} question={question} recommended={recommended} selectedIds={selectedIds}
      onDraft={ids => {setSelectedIds(ids); setOpen(false); draft(ids);}} onClose={() => setOpen(false)}/>}
  </section>;
}
