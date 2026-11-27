import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Check, ChevronDown, ChevronUp, Undo2, X} from 'lucide-react';
import {IconButton} from './UI.jsx';
import {VersionText} from './Diff.jsx';
import {createReview, changeStatus, decideChange, acceptAllChanges, revertAllChanges, toggleSentence, reviewCounts,
  stepChange, nextPendingChange, reviewSegments, reviewCards} from '../ai-review.js';
import './ai-review.css';

const views = [['inline', '본문에서'], ['split', '나란히'], ['cards', '부분 수정']];
const statusLabel = {pending: '검토 전', accepted: '반영함', rejected: '그대로 둠'};
const typing = target => target.closest?.('input,textarea,select,[contenteditable="true"],[role="dialog"]');

// 변경 하나. 검토 전이면 지금 글(취소선)과 제안 글을 함께, 처리했으면 본문에 남은 글만 보여 준다.
function Change({part, active, onSelect, inline}) {
  const {status} = part;
  // 빈 자리는 따로 표시하지 않는다. 본문에서 보기에서 반영해 지운 글만 빠질 글(회색 취소선)로 남긴다.
  let body = part.text;
  if (inline && status === 'pending') {
    body = <>{part.current && <del>{part.current}</del>}{part.proposed && <ins className={part.whole ? 'whole' : undefined}>{part.proposed}</ins>}</>;
  } else if (inline && status === 'accepted' && !part.text) body = <del>{part.current}</del>;
  const className = 'review-change ' + (inline ? status : 'result-' + status) + (active ? ' active' : '');
  const select = event => {
    if (event.type === 'click' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(part.id);
    }
  };
  return <span className={className} data-change={part.id} role="button" tabIndex={0}
    aria-label={(part.current || '(없음)') + ' → ' + (part.proposed || '(삭제)') + ', ' + statusLabel[status]}
    onClick={select} onKeyDown={select}>{body}</span>;
}

function ReviewText({review, active, onSelect, inline}) {
  return <div className="review-doc">
    {reviewSegments(review).map((part, index) => part.id == null ? <React.Fragment key={'t' + index}>{part.text}</React.Fragment>
      : <Change key={part.id} part={part} active={part.id === active} onSelect={onSelect} inline={inline}/>)}
  </div>;
}

// 고른 변경의 반영·그대로 버튼. 본문을 가리지 않게 검토 막대 안에 둔다.
function ChangeTools({status, onDecide}) {
  return <div className="review-tools" role="group" aria-label="이 변경">
    {status === 'pending' ? <>
      <button type="button" className="review-accept" onClick={() => onDecide('accept')}><Check size={13} aria-hidden="true"/>반영<kbd>A</kbd></button>
      <button type="button" onClick={() => onDecide('reject')}><X size={13} aria-hidden="true"/>그대로<kbd>X</kbd></button>
    </> : <button type="button" onClick={() => onDecide('undo')}><Undo2 size={13} aria-hidden="true"/>되돌리기</button>}
  </div>;
}

const plain = parts => parts.map(part => part.text).join('');
function SentenceCards({review, active, onToggle}) {
  const cards = reviewCards(review);
  if (!cards.length) return <p className="review-empty">달라진 문장이 없어요.</p>;
  return <div className="review-cards">{cards.map(card => {
    const accepted = card.ids.filter(id => changeStatus(review, id) === 'accepted').length;
    const mark = (parts, kind) => parts.map((part, index) => part.changed
      ? <mark key={index} className={kind}>{part.text}</mark> : <React.Fragment key={index}>{part.text}</React.Fragment>);
    return <button key={card.key} type="button" aria-pressed={card.applied}
      className={'review-card' + (card.applied ? ' applied' : '') + (card.ids.includes(active) ? ' active' : '')}
      title={card.applied ? '다시 누르면 되돌리기' : '누르면 반영'} onClick={() => onToggle(card.ids)}>
      <span className="review-card-current">{card.current.length ? mark(card.current, 'old') : <em>새로 넣는 문장</em>}</span>
      <span className="review-card-proposed">{plain(card.reference) ? mark(card.reference, 'new') : <em>이 문장 빼기</em>}</span>
      {card.applied ? <span className="review-card-state"><Check size={12} aria-hidden="true"/>반영함</span>
        : accepted > 0 && <span className="review-card-state partial">일부 반영</span>}
    </button>;
  })}</div>;
}

// AI 수정안을 작성 중 본문 위에서 한 곳씩 반영하거나 그대로 둔다. 적용하기 전에는 작성 중 본문을 바꾸지 않는다.
export default function AIReview({message, draftText, limit, canSnapshot, onApply, onCancel, onDirtyChange}) {
  const [review, setReview] = useState(() => createReview(message.candidate, draftText));
  const [active, setActive] = useState(() => nextPendingChange(review, -1));
  const [view, setView] = useState('inline');
  const [confirming, setConfirming] = useState(false);
  const primaryDoc = useRef(null), confirmBox = useRef(null), heading = useRef(null);
  const {total, accepted, pending} = reviewCounts(review);
  const order = review.merge.ranges.map(range => range.id);
  const position = order.indexOf(active);
  const text = review.merge.text, changed = text !== draftText;
  const allAccepted = total > 0 && accepted === total;
  const title = message.kind === 'draft' ? 'AI 초안 검토' : 'AI 수정안 검토';

  useEffect(() => { heading.current?.focus(); }, []);
  // 하나라도 반영하거나 그대로 두기로 골랐으면, 다른 곳으로 옮길 때 버릴지 묻도록 알린다.
  const decided = accepted > 0 || Object.keys(review.rejected).length > 0;
  useEffect(() => { onDirtyChange?.(decided); }, [decided]);
  useEffect(() => () => onDirtyChange?.(false), []);

  function decide(decision, id = active) {
    if (id == null) return;
    const next = decideChange(review, id, decision);
    setReview(next);
    setActive(decision === 'undo' ? id : nextPendingChange(next, id) ?? id);
    setConfirming(false);
  }
  function move(step) { setActive(current => stepChange(review, current, step)); }
  function toggle(ids) { setReview(current => toggleSentence(current, ids)); setActive(ids[0]); setConfirming(false); }
  function toggleOne(id) { decide(changeStatus(review, id) === 'accepted' ? 'undo' : 'accept', id); setActive(id); }
  function apply(snapshot) { onApply({text, snapshot}); }

  // J·K로 변경 사이를 옮기고 A·X로 반영하거나 그대로 둔다. 입력 칸이나 창 안에서는 동작하지 않는다.
  const keys = useRef(null);
  keys.current = event => {
    if (event.key === 'Escape' && confirming) { setConfirming(false); return; }
    if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing || typing(event.target)) return;
    const action = {j: () => move(1), k: () => move(-1), a: () => decide('accept'), x: () => decide('reject'), u: () => decide('undo')}[event.key.toLowerCase()];
    if (action) { event.preventDefault(); action(); }
  };
  useEffect(() => {
    const listen = event => keys.current(event);
    document.addEventListener('keydown', listen);
    return () => document.removeEventListener('keydown', listen);
  }, []);

  // 고른 변경이 화면 밖이면 그 자리로 스크롤한다.
  useLayoutEffect(() => {
    primaryDoc.current?.querySelector('.review-change.active')?.scrollIntoView({block: 'nearest'});
  }, [active, view]);

  useEffect(() => {
    if (!confirming) return;
    confirmBox.current?.querySelector('button')?.focus();
    const close = event => { if (!event.target.closest('.review-apply')) setConfirming(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [confirming]);

  const activeStatus = active == null ? null : changeStatus(review, active);
  const resultColumn = <section ref={primaryDoc} aria-label="지금 본문">
    <h3>지금 본문<small>{text.length.toLocaleString()}{limit == null ? '' : ' / ' + limit.toLocaleString()}자</small></h3>
    <ReviewText review={review} active={active} onSelect={setActive}/>
  </section>;

  return <div className="ai-review">
    <div className="review-bar" role="region" aria-label={title}>
      <div className="review-bar-row">
        <strong ref={heading} tabIndex={-1}>{title}</strong>
        <span className="review-legend"><del>빠질 글</del><ins>넣을 글</ins></span>
        <span className="review-progress"><b>{accepted}</b>곳 반영 · 남은 <b>{pending}</b>곳 ·{' '}
          <span className={limit != null && text.length > limit ? 'over-limit' : undefined}>
            {draftText.length.toLocaleString()} → <b>{text.length.toLocaleString()}</b>자</span></span>
        <span className="review-spacer"/>
        <div className="review-views" role="tablist" aria-label="검토 보기">{views.map(([key, name]) =>
          <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)}>{name}</button>)}</div>
      </div>
      <div className="review-bar-row">
        <div className="review-nav">
          <IconButton label="이전 변경 (K)" disabled={!total} onClick={() => move(-1)}><ChevronUp size={16}/></IconButton>
          <span>{total ? position + 1 : 0} / {total}</span>
          <IconButton label="다음 변경 (J)" disabled={!total} onClick={() => move(1)}><ChevronDown size={16}/></IconButton>
        </div>
        {activeStatus && <ChangeTools status={activeStatus} onDecide={decide}/>}
        <span className="review-spacer"/>
        <button type="button" className="button small" disabled={!total}
          onClick={() => setReview(current => allAccepted ? revertAllChanges(current) : acceptAllChanges(current))}>
          {allAccepted ? '모두 되돌리기' : '모두 반영'}</button>
        <button type="button" className="text-button review-cancel" onClick={onCancel}>취소</button>
        <div className="review-apply">
          <button type="button" className="button small primary" disabled={!changed} aria-expanded={canSnapshot ? confirming : undefined}
            onClick={() => canSnapshot ? setConfirming(!confirming) : apply(false)}>적용하기</button>
          {confirming && <div ref={confirmBox} className="review-confirm" role="dialog" aria-label="적용하기">
            <p>적용하기 전 본문을 스냅샷으로 남길까요?</p>
            {pending > 0 && <small>검토하지 않은 {pending}곳은 지금 본문대로 둬요.</small>}
            <div>
              <button type="button" className="button small" onClick={() => apply(false)}>아니요, 바로 적용</button>
              <button type="button" className="button small primary" onClick={() => apply(true)}>네, 남기고 적용</button>
            </div>
          </div>}
        </div>
      </div>
    </div>
    {view === 'inline' ? <div ref={primaryDoc} className="review-inline">
      <ReviewText review={review} active={active} onSelect={setActive} inline/>
    </div> : <div className="review-columns">
      {resultColumn}
      <section aria-label={view === 'split' ? 'AI 제안 본문' : '바뀌는 문장'}>
        {view === 'split' ? <>
          <h3>{message.kind === 'draft' ? 'AI 초안' : 'AI 수정안'}<small>{message.candidate.length.toLocaleString()}자 · 누르면 반영</small></h3>
          <VersionText state={review.merge} side="left" onChoose={toggleOne}/>
        </> : <>
          <h3>바뀌는 문장<small>누르면 반영, 다시 누르면 되돌리기</small></h3>
          <SentenceCards review={review} active={active} onToggle={toggle}/>
        </>}
      </section>
    </div>}
  </div>;
}
