import React, {useEffect, useRef, useState} from 'react';
import {CalendarDays, Check, ChevronLeft, ChevronRight, MessageCircle, Search, Send, UserPlus, UsersRound} from 'lucide-react';
import {CareerHeader} from '../components/CareerLayout.jsx';
import {Field, Modal, dateLabel} from '../components/UI.jsx';
import {uid} from '../model.js';
import {addDays, calendarWeeks, scheduleTone, todayKey} from '../schedule.js';
import {usePreviewState} from '../community-preview.js';
import '../community.css';

const directory = [
  {id: 'jian', name: '이지안', mark: '지', color: 'blue'},
  {id: 'minjun', name: '박민준', mark: '민', color: 'green'},
  {id: 'harin', name: '정하린', mark: '하', color: 'violet'},
  {id: 'doyun', name: '김도윤', mark: '윤', color: 'blue'},
];
const studyRoom = {id: 'interview', name: '백엔드 면접 스터디', color: 'violet', group: true};
const weekday = ['일', '월', '화', '수', '목', '금', '토'];
const demoChat = {
  jian: [{id: 'j1', from: '이지안', text: '이번 주에 자소서 서로 한 번씩 봐줄까?'}],
  minjun: [{id: 'm1', from: '박민준', text: '모의면접 일정 잡히면 캘린더에 공유할게!'}],
  interview: [
    {id: 'i1', from: '이지안', text: '이번 주에는 DB 트랜잭션이랑 동시성 질문을 연습하면 어때요?'},
    {id: 'i2', from: '박민준', text: '좋아요. 저는 면접관 역할 준비해 갈게요.'},
  ],
};
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
      <button className="board-back" type="button" onClick={onInvite}>이메일로 초대</button>
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
    <button className="button primary" disabled={!text.trim()}><Send size={14} aria-hidden="true"/>{action}</button>
  </form>;
}

function FriendCalendar({person, today, comments, onOpen}) {
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7) + '-01');
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

  return <div className="community-calendar">
    <section className="career-sheet community-month" aria-label={person.name + '의 캘린더'}>
      <div className="community-section-head">
        <div><h2>{person.name}의 캘린더</h2>
          <p>{month.slice(0, 4)}년 {Number(month.slice(5, 7))}월</p></div>
        <div className="community-month-nav">
          <button className="career-button" aria-label="이전 달" onClick={() => move(-1)}><ChevronLeft size={17}/></button>
          <button className="career-button" onClick={() => jump(today)}>오늘</button>
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
              <CalendarDays size={12} aria-hidden="true"/><span>{entries.length === 1 ? entries[0].title : '일정 ' + entries.length + '건'}</span>
            </span>}
          </button>;
        })}
      </div>
    </section>
    <section className="career-sheet community-agenda">
      <div className="community-section-head"><h2>{dateLabel(selected)} 일정</h2><span>{picked.length}건</span></div>
      {picked.length ? <ul className="community-agenda-list">
        {picked.map(item => {
          const key = item.owner + '/' + item.id;
          return <li key={key}><button onClick={() => onOpen(item, key, selected)}>
            <Avatar person={person}/><span><strong>{item.title}</strong><small>{item.type}{item.time && ' · ' + item.time}</small></span>
            {item.type === '체크리스트' && <span className={'community-task-status' + (item.done ? ' done' : '')}>
              {item.done && <Check size={13}/>} {item.done ? '완료' : '진행 중'}
            </span>}
            <span className="community-comment-count"><MessageCircle size={15} aria-hidden="true"/>댓글 {(comments[key] || []).length}</span>
          </button></li>;
        })}
      </ul> : <p className="community-empty">이 날짜에 볼 수 있는 일정이 없어요.</p>}
    </section>
  </div>;
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

function Chat({selected, channels, messages, onSend}) {
  const thread = useRef(null);
  useEffect(() => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [messages]);

  return <section className="career-sheet community-chat" aria-label="채팅">
    <nav className="community-channels" aria-label="대화 목록">
      <h2>대화</h2>
      {channels.map(channel => <a key={channel.id} href={'#/chat?conversation=' + channel.id}
        aria-current={channel.id === selected.id ? 'page' : undefined}>
        <Avatar person={channel}/><span>{channel.name}</span>
      </a>)}
    </nav>
    <div className="community-thread">
      <header><Avatar person={selected}/><div><h2>{selected.name}</h2><p>{selected.group ? '스터디 채팅' : '친구와의 대화'}</p></div></header>
      {messages.length ? <ol ref={thread} className="community-messages" aria-label="메시지" aria-live="polite">
        {messages.map(item => <li key={item.id} className={item.from === '나' ? 'mine' : undefined}>
          <small>{item.from}</small><p>{item.text}</p>
        </li>)}
      </ol> : <p className="community-thread-empty">아직 메시지가 없어요.</p>}
      <Composer key={selected.id} label="메시지 입력" action="보내기" onSend={onSend}/>
    </div>
  </section>;
}

function FriendList({friends, selected, pending, onAdd}) {
  return <nav className="career-sheet friend-list" aria-label="친구 목록">
    <div className="community-section-head">
      <h2>친구 목록 <small>{friends.length}명</small></h2>
      <button className="career-button primary near-action" onClick={onAdd}>
        <UserPlus size={15} aria-hidden="true"/>친구 추가
      </button>
    </div>
    <ul>
      {friends.map(person => <li key={person.id}>
        <a className="friend-calendar-link" href={'#/friends?friend=' + person.id}
          aria-label={person.name + ' 캘린더'} aria-current={person.id === selected.id ? 'page' : undefined}>
          <Avatar person={person}/><span>{person.name}</span>
        </a>
        <a className="friend-chat-link" href={'#/chat?conversation=' + person.id}
          aria-label={person.name + '와 채팅'} title="채팅 열기"><MessageCircle size={17} aria-hidden="true"/></a>
      </li>)}
    </ul>
    {pending > 0 && <p className="community-empty">초대 대기 {pending}명</p>}
  </nav>;
}

const initialSocial = {friendIds: ['jian', 'minjun'], invites: [], comments: {}, chat: demoChat};
function appendMessage(messages, key, text) {
  return {...messages, [key]: [...(messages[key] || []), {id: uid('message'), from: '나', text}]};
}

export default function Social({section, query}) {
  const [today] = useState(todayKey);
  const [dialog, setDialog] = useState(null);
  const [{friendIds, invites, comments, chat}, setPreview] = usePreviewState('social', initialSocial);
  const friends = directory.filter(friend => friendIds.includes(friend.id));
  const channels = [...friends, studyRoom];
  const person = friends.find(friend => friend.id === query.get('friend')) || friends[0];
  const channel = channels.find(item => item.id === query.get('conversation')) || channels[0];
  const close = () => setDialog(null);
  const event = dialog?.event;
  const inChat = section === 'chat';

  return <>
    <CareerHeader title={inChat ? '채팅' : '친구'}/>
    <div className="career-content community-content">
      {inChat ? <Chat selected={channel} channels={channels} messages={chat[channel.id] || []}
        onSend={text => setPreview(current => ({...current, chat: appendMessage(current.chat, channel.id, text)}))}/> :
        <div className="friends-layout">
          <FriendList friends={friends} selected={person} pending={invites.length} onAdd={() => setDialog({type: 'search'})}/>
          <FriendCalendar key={person.id} person={person} today={today} comments={comments}
            onOpen={(item, key, day) => setDialog({event: item, key, day})}/>
        </div>}
      <p className="community-preview-note">미리보기 · 입력한 내용은 이 브라우저에만 저장돼요.</p>
    </div>
    {!inChat && dialog?.type === 'search' && <FriendSearchDialog friends={friends} onClose={close}
      onInvite={() => setDialog({type: 'invite'})} onAdd={id => {
        setPreview(current => current.friendIds.includes(id) ? current : {...current, friendIds: [...current.friendIds, id]});
      }}/>}
    {!inChat && dialog?.type === 'invite' && <InviteDialog invites={invites} onClose={close}
      onInvite={email => setPreview(current => current.invites.includes(email) ? current :
        {...current, invites: [...current.invites, email]})}/>}
    {!inChat && event && <Modal title={event.title} className="community-modal" onClose={close}>
      <div className="community-event-comments">
        <p className="community-modal-note">{person.name} · {dateLabel(dialog.day, event.time)}</p>
        <h3>댓글</h3>
        {(comments[dialog.key] || []).length > 0 ? <ul className="community-comment-list" aria-live="polite">
          {comments[dialog.key].map(item => <li key={item.id}><strong>{item.from}</strong><p>{item.text}</p></li>)}
        </ul> : <p className="community-modal-note">아직 댓글이 없어요.</p>}
        <Composer label="댓글 입력" action="댓글 등록" onSend={text =>
          setPreview(current => ({...current, comments: appendMessage(current.comments, dialog.key, text)}))}/>
      </div>
    </Modal>}
  </>;
}
