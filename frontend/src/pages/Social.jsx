import React, {useEffect, useRef, useState} from 'react';
import {CalendarDays, Check, ChevronLeft, ChevronRight, MessageCircle, Search, Send, UserPlus, UsersRound} from 'lucide-react';
import {Field, Modal, dateLabel} from '../components/UI.jsx';
import {uid} from '../model.js';
import {addDays, calendarWeeks, scheduleTone, todayKey} from '../schedule.js';
import {addPreviewFriend, demoComments, directory, markInboxRead, studyRoom} from '../social-preview.js';
import '../community.css';

const weekday = ['일', '월', '화', '수', '목', '금', '토'];
function exampleEvents(day) {
  return [
    ['e1', 'jian', '면접 답변 초안 정리', 0, '체크리스트', true],
    ['e2', 'minjun', '기술 면접', 0, '면접', false, '16:00'],
    ['e3', 'jian', '서류 제출', 2, '마감'],
    ['e4', 'minjun', '알고리즘 문제 풀이', 3, '체크리스트'],
    ['e5', 'jian', '백엔드 모의면접', 5, '면접', false, '19:30'],
    ['e6', 'harin', '코딩테스트 복습', 0, '체크리스트', false],
    ['e7', 'doyun', '포트폴리오 피드백', 1, '일정', false, '18:30'],
  ].map(([id, owner, title, offset, type, done, time]) => ({
    id, owner, title, type, done, time, start: addDays(day, offset), end: addDays(day, offset),
  }));
}

function FriendSearchDialog({friends, onAdd, onInvite, onClose}) {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const input = useRef(null);
  const term = keyword.trim().toLowerCase();
  const matches = directory.filter(person => person.name.includes(term) || ('@' + person.id).includes(term));

  return <Modal title="친구 추가" className="community-modal" onClose={onClose}>
    <Field label="친구 검색">
      <input ref={input} type="search" value={keyword} placeholder="이름 또는 @아이디" maxLength={80}
        onChange={event => {setKeyword(event.target.value); setStatus('');}}/>
    </Field>
    <div className="friend-search-results">
      <p role="status">{term ? '검색 결과 ' + matches.length + '명' : '미리보기 계정'}</p>
      {matches.length ? <ul>{matches.map(person => {
        const added = friends.some(friend => friend.id === person.id);
        return <li key={person.id}>
          <Avatar person={person}/>
          <span className="friend-search-identity"><strong>{person.name}</strong><small>@{person.id}</small></span>
          {added ? <span className="friend-search-added"><Check size={14} aria-hidden="true"/>친구</span> :
            <button className="career-button" type="button" aria-label={person.name + ' 친구 추가'}
              onClick={() => {
                onAdd(person.id);
                setStatus(person.name + ' 님을 친구 목록에 추가했어요.');
                input.current.focus();
              }}><UserPlus size={15} aria-hidden="true"/>추가</button>}
        </li>;
      })}</ul> : <p className="community-empty">일치하는 이름이나 아이디가 없어요.</p>}
    </div>
    <div className="friend-search-footer"><p role="status">{status}</p>
      <button className="text-button" type="button" onClick={onInvite}>이메일로 초대</button>
    </div>
  </Modal>;
}

function Avatar({person}) {
  return <span className={'community-avatar ' + person.color} aria-hidden="true">
    {person.group ? <UsersRound size={17}/> : person.mark}
  </span>;
}

function Composer({label, action, onSend}) {
  const [text, setText] = useState('');
  return <form className="community-composer" onSubmit={event => {
    event.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  }}>
    <input aria-label={label} placeholder={label} value={text} maxLength={600} onChange={event => setText(event.target.value)}/>
    <button className="career-button primary" disabled={!text.trim()}><Send size={14} aria-hidden="true"/>{action}</button>
  </form>;
}

function FriendSchedule({person, today, startDate, comments, onOpen, hidden}) {
  const [selected, setSelected] = useState(startDate);
  const [month, setMonth] = useState(startDate.slice(0, 7) + '-01');
  const weeks = calendarWeeks(month);
  const events = exampleEvents(today).filter(item => item.owner === person.id);
  const onDay = day => events.filter(item => item.start <= day && item.end >= day);
  const picked = onDay(selected);

  function jump(day) {
    setSelected(day);
    setMonth(day.slice(0, 7) + '-01');
  }
  function move(offset) {
    const date = new Date(month + 'T00:00:00Z');
    date.setUTCMonth(date.getUTCMonth() + offset);
    jump(date.toISOString().slice(0, 10));
  }

  return <aside id="friend-schedule" className="friend-schedule" hidden={hidden} aria-label={person.name + '의 일정'}>
    <section className="community-month" aria-label={person.name + '의 캘린더'}>
      <div className="schedule-month-heading">
        <h3>{month.slice(0, 4)}년 {Number(month.slice(5, 7))}월</h3>
        <div className="community-month-nav">
          <button className="career-button" onClick={() => jump(today)}>오늘</button>
          <button className="career-button" aria-label="이전 달" onClick={() => move(-1)}><ChevronLeft size={17}/></button>
          <button className="career-button" aria-label="다음 달" onClick={() => move(1)}><ChevronRight size={17}/></button>
        </div>
      </div>
      <div className="community-month-grid">
        {weekday.map(value => <span className="community-weekday" key={value} aria-hidden="true">{value}</span>)}
        {weeks.flat().map(day => {
          const entries = onDay(day);
          return <button key={day} className={'community-day' + (day.startsWith(month.slice(0, 7)) ? '' : ' outside')}
            aria-label={dateLabel(day) + ' 일정 ' + entries.length + '건'} aria-pressed={day === selected}
            aria-current={day === today ? 'date' : undefined} onClick={() => jump(day)}>
            <strong>{Number(day.slice(8))}</strong>
            {entries.length > 0 && <span className={'community-day-mark schedule-tone ' + (entries.length === 1 ? scheduleTone(entries[0]) : 'default')}>
              <span>{entries.length === 1 ? entries[0].title : '일정 ' + entries.length + '건'}</span>
            </span>}
          </button>;
        })}
      </div>
    </section>
    <section className="community-agenda">
      <div className="community-section-head"><h2>{dateLabel(selected)} 일정</h2><span>{picked.length}건</span></div>
      {picked.length ? <ul className="community-agenda-list">
        {picked.map(item => {
          const key = item.owner + '/' + item.id;
          return <li key={key}><button onClick={() => onOpen(item, key, selected)}>
            <span className="community-agenda-copy">
              <strong>{item.title}</strong>
              <small className={'schedule-tone ' + scheduleTone(item)}>{item.type}{item.time && ' · ' + item.time}
                {item.type === '체크리스트' && (item.done ? ' · 완료' : ' · 진행 중')}
              </small>
            </span>
            <span className="community-comment-count" aria-label={'댓글 ' + (comments[key] || []).length + '개'}>
              <MessageCircle size={15} aria-hidden="true"/>{(comments[key] || []).length}
            </span>
          </button></li>;
        })}
      </ul> : <p className="community-empty">이 날짜에 볼 수 있는 일정이 없어요.</p>}
    </section>
  </aside>;
}

function InviteDialog({invites, onInvite, onClose}) {
  return <Modal title="친구 초대" className="community-modal" onClose={onClose}>
    <div className="community-invites">
      <form onSubmit={event => {
        event.preventDefault();
        const input = event.currentTarget.elements.email;
        onInvite(input.value.trim().toLowerCase());
        input.value = '';
      }}>
        <Field label="친구 이메일" hint="입력한 이메일은 화면에 초대 대기로 표시돼요.">
          <input name="email" type="email" placeholder="friend@example.com" maxLength={254} required/>
        </Field>
        <div className="form-actions"><button className="button primary">초대 추가</button></div>
      </form>
      {invites.length > 0 && <ul aria-label="초대 대기" className="community-invite-list">
        {invites.map(email => <li key={email}><span>{email}</span><small>초대 대기</small></li>)}
      </ul>}
    </div>
  </Modal>;
}

function Chat({selected, messages, panel, onSend}) {
  const thread = useRef(null);
  useEffect(() => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [messages, selected.id, panel]);

  return <section id="friend-chat" className="community-chat" hidden={panel !== 'chat'} aria-label={selected.name + ' 채팅'}>
    {messages.length ? <ol ref={thread} className="community-messages" aria-label="메시지" aria-live="polite">
      {messages.map(item => <li key={item.id} className={item.from === '나' ? 'mine' : undefined}>
        <small>{item.from}</small><p>{item.text}</p>
      </li>)}
    </ol> : <p className="community-thread-empty">아직 메시지가 없어요.</p>}
    <Composer key={selected.id} label="메시지 입력" action="보내기" onSend={onSend}/>
  </section>;
}

function FriendList({friends, selected, chat, panel, pending, onAdd}) {
  function contactLink(person) {
    const last = chat[person.id]?.at(-1);
    const href = person.group ? '#/friends?conversation=' + person.id :
      '#/friends?friend=' + person.id + (panel === 'schedule' ? '&tab=calendar' : '');
    return <li key={person.id}><a className="friend-contact-link" href={href}
      aria-current={person.id === selected.id ? 'page' : undefined}>
      <Avatar person={person}/>
      <span className="friend-contact-copy"><strong>{person.name}</strong>
        {last && <small>{last.from === '나' && '나: '}{last.text}</small>}
      </span>
    </a></li>;
  }

  return <nav className="friend-list" aria-label="친구 및 대화 목록">
    <div className="community-section-head">
      <h1>친구 목록 <small>{friends.length}명</small></h1>
      <button className="career-button primary near-action" onClick={onAdd}>
        <UserPlus size={15} aria-hidden="true"/>친구 추가
      </button>
    </div>
    <ul>{friends.map(contactLink)}</ul>
    {pending > 0 && <p className="community-empty">초대 대기 {pending}명</p>}
    <div className="friend-study"><h2>스터디</h2><ul>{contactLink(studyRoom)}</ul></div>
    <p className="community-preview-note">미리보기 · 입력한 내용은 이 브라우저에만 저장돼요.</p>
  </nav>;
}

function appendMessage(messages, key, text) {
  return {...messages, [key]: [...(messages[key] || []), {id: uid('message'), from: '나', text}]};
}

export default function Social({query, preview, setPreview}) {
  const [today] = useState(todayKey);
  const {friendIds, invites, chat} = preview;
  const comments = {...demoComments, ...preview.comments};
  const friends = directory.filter(friend => friendIds.includes(friend.id));
  const channels = [...friends, studyRoom];
  const target = query.get('conversation') || query.get('friend');
  const channel = channels.find(item => item.id === target) || channels[0];
  const linkedEvent = !channel.group && exampleEvents(today).find(item => item.owner === channel.id && item.id === query.get('event'));
  const showCalendar = !channel.group && (linkedEvent || query.get('tab') === 'calendar');
  const [panel, setPanel] = useState(() => showCalendar ? 'schedule' : 'chat');
  const [dialog, setDialog] = useState(() => linkedEvent ? {
    event: linkedEvent, key: linkedEvent.owner + '/' + linkedEvent.id, day: linkedEvent.start,
  } : null);
  const close = () => setDialog(null);
  const event = dialog?.event;
  const openChannel = panel === 'chat' ? channel.id : '';
  const openEvent = event?.id;

  useEffect(() => {
    if (!openChannel && !openEvent) return;
    setPreview(current => markInboxRead(current, item =>
      (item.kind === 'message' && item.target === openChannel) || (item.kind === 'comment' && item.eventId === openEvent)));
  }, [openChannel, openEvent, setPreview]);

  return <>
    <div className="career-content friends-content friends-layout">
      <FriendList friends={friends} selected={channel} chat={chat} panel={panel} pending={invites.length}
        onAdd={() => setDialog({type: 'search'})}/>
      <div className="friend-workspace">
        <header className="friend-workspace-header">
          <div className="friend-name"><Avatar person={channel}/><h2>{channel.name}</h2></div>
          {!channel.group && <div className="career-tabs friends-panel-switch" role="group" aria-label="친구 화면 보기">
            <button type="button" aria-pressed={panel === 'chat'} aria-controls="friend-chat" onClick={() => setPanel('chat')}>
              <MessageCircle size={16} aria-hidden="true"/>채팅
            </button>
            <button type="button" aria-pressed={panel === 'schedule'} aria-controls="friend-schedule" onClick={() => setPanel('schedule')}>
              <CalendarDays size={16} aria-hidden="true"/>캘린더
            </button>
          </div>}
        </header>
        <Chat selected={channel} messages={chat[channel.id] || []} panel={panel}
          onSend={text => setPreview(current => ({...current, chat: appendMessage(current.chat, channel.id, text)}))}/>
        {!channel.group && <FriendSchedule person={channel} today={today} startDate={linkedEvent?.start || today} comments={comments}
          hidden={panel !== 'schedule'} onOpen={(item, key, day) => setDialog({event: item, key, day})}/>}
      </div>
    </div>
    {dialog?.type === 'search' && <FriendSearchDialog friends={friends} onClose={close}
      onInvite={() => setDialog({type: 'invite'})} onAdd={id => {
        setPreview(current => addPreviewFriend(current, id));
      }}/>}
    {dialog?.type === 'invite' && <InviteDialog invites={invites} onClose={close}
      onInvite={email => setPreview(current => current.invites.includes(email) ? current :
        {...current, invites: [...current.invites, email]})}/>}
    {event && <Modal title={event.title} className="community-modal" onClose={close}>
      <div className="community-event-comments">
        <p className="community-modal-note">{channel.name} · {dateLabel(dialog.day, event.time)}</p>
        <h3>댓글</h3>
        {(comments[dialog.key] || []).length > 0 ? <ul className="community-comment-list" aria-live="polite">
          {comments[dialog.key].map(item => <li key={item.id}><strong>{item.from}</strong><p>{item.text}</p></li>)}
        </ul> : <p className="community-modal-note">아직 댓글이 없어요.</p>}
        <Composer label="댓글 입력" action="댓글 등록" onSend={text =>
          setPreview(current => ({...current, comments: appendMessage({...demoComments, ...current.comments}, dialog.key, text)}))}/>
      </div>
    </Modal>}
  </>;
}
