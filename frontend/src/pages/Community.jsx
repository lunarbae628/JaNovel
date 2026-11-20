import React, {useEffect, useRef, useState} from 'react';
import {CalendarDays, Check, ChevronLeft, ChevronRight, LockKeyhole, MessageCircle, Plus, Send, UserPlus, UsersRound} from 'lucide-react';
import {CareerHeader} from '../components/CareerLayout.jsx';
import {Field, Modal, dateLabel} from '../components/UI.jsx';
import {uid} from '../model.js';
import {addDays, calendarWeeks, projectSchedule, todayKey} from '../schedule.js';
import {allEvents} from './Applications.jsx';
import '../community.css';

const tabs = [['calendar', '공유 캘린더'], ['chat', '채팅'], ['studies', '스터디 모집'], ['reviews', '합격 후기']];
const friends = [
  {id: 'jian', name: '이지안', mark: '지', color: 'blue'},
  {id: 'minjun', name: '박민준', mark: '민', color: 'green'},
];
const channels = [...friends, {id: 'interview', name: '백엔드 면접 스터디', mark: '면', color: 'violet', group: true}];
const people = [...friends, {id: 'me', name: '나', mark: '나', color: 'violet'}];
const weekday = ['일', '월', '화', '수', '목', '금', '토'];
const demoChat = {
  jian: [{id: 'j1', from: '이지안', text: '이번 주에 자소서 서로 한 번씩 봐줄까?'}],
  minjun: [{id: 'm1', from: '박민준', text: '모의면접 일정 잡히면 캘린더에 공유할게!'}],
  interview: [
    {id: 'i1', from: '이지안', text: '이번 주에는 DB 트랜잭션이랑 동시성 질문을 연습하면 어때요?'},
    {id: 'i2', from: '박민준', text: '좋아요. 저는 면접관 역할 준비해 갈게요.'},
  ],
};
const demoBoards = {
  studies: [
    {id: 's1', title: '백엔드 시스템 설계 면접 스터디', tag: '기술 면접', author: '이지안', meta: '온라인 · 주 1회 · 4명 모집',
      body: '매주 한 가지 설계 문제를 골라 30분씩 발표하고 피드백해요. 첫 주 주제는 채용 공고를 모아 보는 서비스예요. 개발 경험이 적어도 참여할 수 있어요.'},
    {id: 's2', title: '평일 저녁 코딩테스트 풀이 모임', tag: '코딩테스트', author: '정하린', meta: '온라인 · 평일 저녁 · 6명 모집',
      body: '각자 문제를 풀고 접근 방식과 놓친 테스트 케이스를 공유해요. 매주 월요일에 문제 세 개를 정합니다.'},
    {id: 's3', title: '지원동기와 경험 문항 같이 다듬기', tag: '자기소개서', author: '박민준', meta: '온라인 · 격주 토요일 · 3명 모집',
      body: '지원동기와 경험 문항을 하나씩 가져와 서로 읽고, 설명이 부족한 부분을 질문으로 남기는 모임이에요.'},
  ],
  reviews: [
    {id: 'r1', title: '백엔드 신입 면접에서 받았던 저장·복구 질문', tag: '백엔드', author: '개발하는 토끼', meta: '기술 면접 · 최종 합격',
      body: '면접에서는 먼저 저장 흐름을 그림으로 설명했어요. 두 요청이 같은 문서를 수정하면 데이터가 어떻게 되는지, 중간에 DB 연결이 끊기면 어떤 화면을 보여주는지까지 질문을 받았어요. 테스트에서 재현한 상황을 기준으로 답하니 설명하기 수월했어요.'},
    {id: 'r2', title: '서비스 운영 경험을 포트폴리오에 정리한 방법', tag: '플랫폼', author: '한 걸음', meta: '서류 · 기술 면접 · 최종 합격',
      body: '사용 기술 목록을 줄이고 어떤 문제를 발견했는지, 어떻게 확인했고 무엇을 바꿨는지를 한 페이지에 담았어요. 수치가 있는 개선은 측정 조건도 같이 기록했습니다.'},
    {id: 'r3', title: '채용연계형 인턴 면접과 전환 과정', tag: '인턴', author: '라운드', meta: '인턴 전형 · 최종 합격',
      body: '과제에서 우선 구현할 범위를 정한 이유와, 시간이 더 있었다면 어떤 테스트를 추가할지를 구체적으로 설명했어요. 인턴 기간에는 리뷰에서 받은 피드백을 다음 작업에 적용한 사례를 기록해 두었습니다.'},
  ],
};

function exampleEvents(day) {
  return [
    ['e1', 'jian', '면접 답변 초안 정리', 0, '체크리스트', true],
    ['e2', 'minjun', '기술 면접', 0, '면접', false, '16:00'],
    ['e3', 'jian', '서류 제출', 2, '마감'],
    ['e4', 'minjun', '알고리즘 문제 풀이', 3, '체크리스트'],
    ['e5', 'jian', '백엔드 모의면접', 5, '면접', false, '19:30'],
  ].map(([id, owner, title, offset, type, done, time]) => ({
    id, owner, title, type, done, time, start: addDays(day, offset), end: addDays(day, offset),
  }));
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

function SharedCalendar({today, support, personal, shares, comments, onShare, onOpen}) {
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7) + '-01');
  const [owner, setOwner] = useState('');
  const weeks = calendarWeeks(month);
  const visibleIds = new Set(Object.values(shares).flat());
  const myEvents = [
    ...support.filter(item => item.date && visibleIds.has(item.id)).map(item => ({
      id: item.id, title: item.title, type: item.type, start: item.date, end: item.endDate || item.date, time: item.time,
    })),
    ...projectSchedule(personal.filter(item => visibleIds.has(item.id)), weeks[0][0], weeks.at(-1).at(-1))
      .map(item => ({...item, type: item.kind === 'task' ? '체크리스트' : '일정'})),
  ].map(item => ({...item, owner: 'me'}));
  const events = [...exampleEvents(today), ...myEvents].filter(item => !owner || item.owner === owner);
  const onDay = day => events.filter(item => item.start <= day && item.end >= day);
  const picked = onDay(selected);
  const eventKey = item => item.owner + '/' + item.id + '/' + selected;

  function jump(day) {
    setSelected(day);
    setMonth(day.slice(0, 7) + '-01');
  }
  function move(offset) {
    const date = new Date(month + 'T00:00:00Z');
    date.setUTCMonth(date.getUTCMonth() + offset);
    jump(date.toISOString().slice(0, 10));
  }

  return <section className="community-calendar" aria-label="공유 캘린더">
    <div className="community-picker">
      <div className="community-chips" aria-label="공유 일정 필터">
        <button className="career-button" aria-pressed={!owner} onClick={() => setOwner('')}>전체</button>
        {people.map(person => <button className="career-button" key={person.id} aria-pressed={owner === person.id}
          onClick={() => setOwner(person.id)}>{person.id === 'me' ? '내 공유 일정' : person.name}</button>)}
      </div>
      <button className="career-button" onClick={onShare}><LockKeyhole size={15}/>공유 설정</button>
    </div>
    <section className="career-sheet community-month" aria-label="공유 일정 월간 보기">
      <div className="community-section-head">
        <h2>{Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월</h2>
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
            {entries.length > 0 && <span className="community-day-mark">
              <CalendarDays size={12} aria-hidden="true"/><span>{entries.length === 1 ? entries[0].title : '일정 ' + entries.length + '건'}</span>
            </span>}
          </button>;
        })}
      </div>
    </section>
    <section className="career-sheet community-agenda">
      <div className="community-section-head"><h2>{dateLabel(selected)} 공유 일정</h2><span>{picked.length}건</span></div>
      {picked.length ? <ul className="community-agenda-list">
        {picked.map(item => {
          const person = people.find(value => value.id === item.owner);
          const key = eventKey(item);
          return <li key={key}><button onClick={() => onOpen(item, key, selected)}>
            <Avatar person={person}/><span><strong>{item.title}</strong><small>{person.name} · {item.time || item.type}</small></span>
            {item.type === '체크리스트' && <span className={'community-task-status' + (item.done ? ' done' : '')}>
              {item.done && <Check size={13}/>} {item.done ? '완료' : '진행 중'}
            </span>}
            <span className="community-comment-count" aria-label="댓글"><MessageCircle size={15}/>{(comments[key] || []).length}</span>
          </button></li>;
        })}
      </ul> : <p className="community-empty">이 날짜에 공유된 일정이 없어요.</p>}
    </section>
  </section>;
}

function ShareDialog({items, shares, onSave, onClose}) {
  const [recipient, setRecipient] = useState(friends[0].id);
  const [draft, setDraft] = useState(shares);
  const allowed = draft[recipient] || [];
  return <Modal title="캘린더 공유 설정" className="community-modal" onClose={onClose}>
    <div className="community-share">
      <p className="community-modal-note">내 캘린더는 기본 비공개예요. 친구마다 보여줄 일정과 할 일을 고르세요.</p>
      <Field label="공유할 친구"><select value={recipient} onChange={event => setRecipient(event.target.value)}>
        {friends.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
      </select></Field>
      {items.length ? <div className="community-share-list">
        {items.map(item => <label key={item.id}>
          <input type="checkbox" checked={allowed.includes(item.id)} onChange={event => {
            const picked = event.target.checked;
            setDraft(current => ({...current, [recipient]: picked ? [...allowed, item.id] : allowed.filter(id => id !== item.id)}));
          }}/>
          <span><strong>{item.title}</strong><small>{item.company && item.company + ' · '}{dateLabel(item.date || item.start)}</small></span>
        </label>)}
      </div> : <p className="community-modal-note">공유할 일정이 아직 없어요.</p>}
      <div className="form-actions">
        <button className="button" onClick={onClose}>취소</button>
        <button className="button primary" onClick={() => onSave(draft)}>공유 설정 적용</button>
      </div>
    </div>
  </Modal>;
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

function CommunityChat({active, onSelect, messages, onSend}) {
  const selected = channels.find(channel => channel.id === active);
  const thread = useRef(null);
  useEffect(() => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [messages]);

  return <section className="career-sheet community-chat" aria-label="채팅">
    <nav className="community-channels" aria-label="대화 목록">
      <h2>대화</h2>
      {channels.map(channel => <button key={channel.id} aria-pressed={channel.id === active} onClick={() => onSelect(channel.id)}>
        <Avatar person={channel}/><span>{channel.name}</span>
      </button>)}
    </nav>
    <div className="community-thread">
      <header><Avatar person={selected}/><div><h2>{selected.name}</h2><p>{selected.group ? '스터디 채팅' : '친구와의 대화'}</p></div></header>
      <ol ref={thread} className="community-messages" aria-label="메시지" aria-live="polite">
        {messages.map(item => <li key={item.id} className={item.from === '나' ? 'mine' : undefined}>
          <small>{item.from}</small><p>{item.text}</p>
        </li>)}
      </ol>
      <Composer key={active} label="메시지 입력" action="보내기" onSend={onSend}/>
    </div>
  </section>;
}

function Board({tab, posts, joinedRequests, onNew, onOpen}) {
  const study = tab === 'studies';
  return <section className="career-sheet community-board" aria-label={study ? '스터디 모집' : '합격 후기'}>
    <div className="community-section-head">
      <h2>{study ? '스터디 모집' : '합격 후기'} <small>{posts.length}</small></h2>
      <button className="career-button primary" onClick={onNew}><Plus size={16}/>{study ? '모집글 쓰기' : '후기 쓰기'}</button>
    </div>
    <ul className="community-board-list">
      {posts.map(post => <li key={post.id}><button onClick={() => onOpen(post)}>
        <span className="community-board-entry">
          <span className="dashboard-stage accented">{post.tag}</span><strong>{post.title}</strong>
          <small>{post.author} · {post.meta}</small>
        </span>
        {study && joinedRequests.includes(post.id) && <span className="dashboard-stage">신청 대기</span>}
        <ChevronRight size={17} aria-hidden="true"/>
      </button></li>)}
    </ul>
  </section>;
}

function PostDialog({tab, onCreate, onClose}) {
  const study = tab === 'studies';
  return <Modal title={study ? '스터디 모집글 쓰기' : '합격 후기 쓰기'} className="community-modal" onClose={onClose}>
    <form className="community-post-form" onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const title = String(values.get('title')).trim();
      const body = String(values.get('body')).trim();
      if (title && body) onCreate({id: uid('post'), title, body, tag: study ? '스터디' : '후기', author: '나', meta: '방금 등록'});
    }}>
      <Field label="제목"><input name="title" maxLength={80} required/></Field>
      <Field label={study ? '모집 내용' : '후기 내용'}><textarea name="body" rows={5} maxLength={2400} required/></Field>
      <div className="form-actions"><button className="button" type="button" onClick={onClose}>취소</button>
        <button className="button primary">등록</button></div>
    </form>
  </Modal>;
}

export default function Community({store, query}) {
  const tab = tabs.some(([key]) => key === query.get('tab')) ? query.get('tab') : 'calendar';
  const [today] = useState(todayKey);
  const [dialog, setDialog] = useState(null);
  const [shares, setShares] = useState({});
  const [invites, setInvites] = useState([]);
  const [comments, setComments] = useState({});
  const [chat, setChat] = useState(demoChat);
  const [active, setActive] = useState(channels[0].id);
  const [boards, setBoards] = useState(demoBoards);
  const [joinedRequests, setJoinedRequests] = useState([]);
  const support = store.applications.flatMap(allEvents)
    .map(event => ({...event, id: event.applicationId + '/' + event.id}));
  const personal = store.scheduleItems || [];
  const close = () => setDialog(null);
  const post = dialog?.post;
  const event = dialog?.event;

  function appendMessage(setMessages, key, text) {
    setMessages(current => ({...current, [key]: [...(current[key] || []), {id: uid('message'), from: '나', text}]}));
  }

  return <>
    <CareerHeader title="친구·스터디">
      <button className="career-button primary" onClick={() => setDialog({type: 'invite'})}><UserPlus size={16}/>친구 초대</button>
    </CareerHeader>
    <div className="career-content community-content">
      <nav className="career-tabs community-tabs" aria-label="친구·스터디 메뉴">
        {tabs.map(([key, label]) => <a key={key} href={'#/community' + (key === 'calendar' ? '' : '?tab=' + key)}
          aria-current={key === tab ? 'page' : undefined}>{label}</a>)}
      </nav>
      <p className="community-preview-note">화면 미리보기 · 입력한 내용은 이 화면을 벗어나면 초기화돼요.</p>
      {tab === 'calendar' ? <SharedCalendar today={today} support={support} personal={personal} shares={shares} comments={comments}
        onShare={() => setDialog({type: 'share'})} onOpen={(event, key, day) => setDialog({type: 'event', event, key, day})}/> :
        tab === 'chat' ? <CommunityChat active={active} onSelect={setActive} messages={chat[active]}
          onSend={text => appendMessage(setChat, active, text)}/> :
          <Board tab={tab} posts={boards[tab]} joinedRequests={joinedRequests} onNew={() => setDialog({type: 'new', board: tab})}
            onOpen={post => setDialog({type: 'post', board: tab, post})}/>}
    </div>
    {dialog?.type === 'share' && <ShareDialog items={[...support, ...personal]} shares={shares} onClose={close}
      onSave={value => {setShares(value); close();}}/>}
    {dialog?.type === 'invite' && <InviteDialog invites={invites} onClose={close}
      onInvite={email => setInvites(current => current.includes(email) ? current : [...current, email])}/>}
    {event && <Modal title={event.title} className="community-modal" onClose={close}>
      <div className="community-event-comments">
        <p className="community-modal-note">{people.find(person => person.id === event.owner).name} · {dateLabel(dialog.day, event.time)}</p>
        <h3>댓글</h3>
        {(comments[dialog.key] || []).length > 0 ? <ul className="community-comment-list" aria-live="polite">
          {comments[dialog.key].map(item => <li key={item.id}><strong>{item.from}</strong><p>{item.text}</p></li>)}
        </ul> : <p className="community-modal-note">아직 댓글이 없어요.</p>}
        <Composer label="댓글 입력" action="댓글 등록" onSend={text => appendMessage(setComments, dialog.key, text)}/>
      </div>
    </Modal>}
    {dialog?.type === 'new' && <PostDialog tab={dialog.board} onClose={close} onCreate={item => {
      setBoards(current => ({...current, [dialog.board]: [item, ...current[dialog.board]]}));
      close();
    }}/>}
    {post && <Modal title={post.title} className="community-modal" onClose={close}>
      <p className="community-modal-note">{post.author} · {post.meta}</p>
      <p className="community-post-body">{post.body}</p>
      {dialog.board === 'studies' && post.author !== '나' && <div className="form-actions">
        <button className="button primary" onClick={() => setJoinedRequests(current => current.includes(post.id)
          ? current.filter(id => id !== post.id) : [...current, post.id])}>
          {joinedRequests.includes(post.id) ? '신청 취소' : '참여 신청'}
        </button>
      </div>}
    </Modal>}
  </>;
}
