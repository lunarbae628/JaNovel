import React, {useDeferredValue, useEffect, useMemo, useRef, useState} from 'react';
import {Columns2, Send, Sparkles} from 'lucide-react';
import {changeSummary, draftRequestBranch} from '../ai-review.js';

// 요약을 계산하는 최근 수정안 수. 본문을 고칠 때마다 다시 비교하므로 오래된 수정안은 버튼만 둔다.
const SUMMARY_LIMIT = 3;

function CandidateCard({message, draftText, summarize, reviewing, onReview}) {
  const summary = useMemo(() => summarize ? changeSummary(message.candidate, draftText) : null,
    [summarize, message.candidate, draftText]);
  const same = summary?.count === 0;
  // 요청한 뒤 본문이 바뀌었으면, 이 수정안으로 검토할 때 그 사이 바뀐 내용도 되돌리는 변경으로 보인다.
  const stale = !reviewing && !same && message.baseText != null && message.baseText !== draftText;
  return <div className={'chat-candidate' + (stale ? ' stale' : '')}>
    <div className="chat-candidate-heading">
      <Sparkles size={14} aria-hidden="true"/><strong>{message.kind === 'draft' ? 'AI 초안' : 'AI 수정안'}</strong>
      {message.preview && <small className="chat-candidate-preview">예시</small>}
      {stale && <small className="chat-candidate-preview" title="요청한 뒤 본문이 바뀌었어요. 검토하면 그 사이 바뀐 내용도 되돌리는 변경으로 보여요.">이전 본문 기준</small>}
      {summary && <span>{same ? '지금 본문과 같아요' : '변경 ' + summary.count + '곳'
        + (summary.delta ? ' · ' + (summary.delta > 0 ? '+' : '') + summary.delta.toLocaleString() + '자' : '')}</span>}
    </div>
    {reviewing
      ? <span className="chat-candidate-reviewing">본문에서 검토 중</span>
      : <button type="button" className="button small chat-candidate-button" aria-controls="writing-panel"
        disabled={same} onClick={() => onReview(message)}>
        <Columns2 size={14} aria-hidden="true"/>본문에서 검토
      </button>}
  </div>;
}

export default function AIChat({question, chat, draftId, draftText, reviewingId, onReview, draftAction, draftInChat = false}) {
  const [input, setInput] = useState('');
  const scrollTarget = useRef(null);
  const messageCount = useRef(question.messages.length);
  const deferredDraft = useDeferredValue(draftText);
  const {pending, failure} = chat;
  const summarized = new Set(question.messages.filter(message => message.candidate).slice(-SUMMARY_LIMIT).map(message => message.id));

  useEffect(() => {
    if (pending || failure || messageCount.current !== question.messages.length) {
      scrollTarget.current?.scrollIntoView({block: 'nearest'});
    }
    messageCount.current = question.messages.length;
  }, [pending, failure, question.messages.length]);

  // 보낸 글을 그대로 두고 있을 때만 입력 칸을 비운다. 기다리는 동안 새로 쓴 글은 남긴다.
  const clearSent = sent => answer => {
    if (answer) setInput(current => current === sent ? '' : current);
  };

  function requestChat(event) {
    event.preventDefault();
    if (!input.trim()) return;
    chat.requestChat(input).then(clearSent(input));
  }

  function retry() {
    chat.retry().then(clearSent(failure.request.payload.request));
  }
  // 빈 문항의 초안 받기는 본문 자리에서 보내므로 실패도 그곳에서 알리고, 채팅에서 보낸 초안 요청만 여기서 알린다.
  const chatFailure = failure?.request.payload.kind === 'chat' || (draftInChat && failure?.request.payload.kind === 'draft')
    ? failure : null;

  return <>
    <div className="chat-messages">
      <div role="log" aria-label="이 문항의 대화" aria-live="polite">
        {question.messages.length ? question.messages.map(message => {
          const origin = draftRequestBranch(question.messages, message);
          const originDraft = origin && origin !== draftId ? question.branches.find(branch => branch.id === origin)?.draft : null;
          return <div className={'chat-message ' + message.role} key={message.id}>
            {message.text && <p>{message.text}</p>}
            {message.candidate && <CandidateCard message={message} draftText={originDraft?.text ?? deferredDraft}
              summarize={summarized.has(message.id)} reviewing={reviewingId === message.id} onReview={onReview}/>}
          </div>;
        }) : !pending && !chatFailure && <p className="muted chat-empty">이 문항에 대해 질문하거나 수정을 요청해 보세요.</p>}
      </div>
      {pending && <div className="chat-message user"><p>{pending.message.text}</p></div>}
      {pending && <p role="status" className="chat-pending"><Sparkles size={15} aria-hidden="true"/>
        {pending.payload.kind === 'draft' ? '초안을 작성하고 있어요.' : '답변을 작성하고 있어요.'}</p>}
      {chatFailure && <div role="alert" className="chat-failure">
        <p>{chatFailure.message}</p><button type="button" className="text-button" onClick={retry}>다시 시도</button>
      </div>}
      <div ref={scrollTarget}/>
    </div>
    <form className="chat-compose" onSubmit={requestChat}>
      <textarea aria-label="AI에게 보낼 메시지" rows={3} value={input}
        maxLength={4_000} onChange={event => setInput(event.target.value)} placeholder="본문에 대해 질문하거나 수정을 요청하세요."
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form.requestSubmit();
          }
        }}/>
      <div className="chat-submit">{draftAction}<button type="submit" className="button primary" disabled={!!pending || !input.trim()}>
        <Send size={14} aria-hidden="true"/>보내기
      </button></div>
    </form>
  </>;
}
