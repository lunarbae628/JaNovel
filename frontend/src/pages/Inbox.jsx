import React, {useRef, useState} from 'react';
import {ArrowUpRight, CheckCheck, MessageCircle, MessageSquareText, UserPlus} from 'lucide-react';
import {Modal} from '../components/UI.jsx';
import '../community.css';
import {addPreviewFriend, directory, markInboxRead} from '../social-preview.js';

const kinds = {
  request: {label: '친구 요청', Icon: UserPlus},
  message: {label: '채팅', Icon: MessageCircle},
  comment: {label: '일정 댓글', Icon: MessageSquareText},
};

function InboxItem({item, friendIds, onRead, onRespond}) {
  const {label, Icon} = kinds[item.kind];
  const person = directory.find(person => person.id === item.personId);
  const response = item.response || (friendIds.includes(item.personId) && 'accepted');
  const request = item.kind === 'request';
  const href = item.kind === 'message' ? '#/friends?conversation=' + item.target :
    '#/friends?friend=' + item.target + '&event=' + item.eventId;
  const summary = <div className="inbox-summary">
    <span className={'inbox-icon ' + item.kind}><Icon size={17} aria-hidden="true"/></span>
    <div className="inbox-copy">
      <div className="inbox-item-title"><strong>{person.name}</strong><span>{label}</span>
        {!item.read && <span className="inbox-unread">읽지 않음</span>}</div>
      {item.subject && <p className="inbox-subject">{item.subject}</p>}
      <p>{item.text}</p>
    </div>
  </div>;

  return <li className={!item.read ? 'unread' : undefined}>
    {request ? <div className="inbox-request">
      {summary}
      {response ? <span className="inbox-response">{response === 'accepted' ? '수락함' : '거절함'}</span> :
        <div className="inbox-request-actions">
          <button className="career-button" onClick={() => onRespond(item, 'declined')}>거절</button>
          <button className="career-button primary" onClick={() => onRespond(item, 'accepted')}>수락</button>
        </div>}
    </div> : <a className="inbox-jump" href={href} onClick={() => onRead(item.id)}>
      {summary}<ArrowUpRight size={16} aria-hidden="true"/>
    </a>}
  </li>;
}

export default function Inbox({preview, setPreview, onClose}) {
  const [onlyUnread, setOnlyUnread] = useState(false);
  const filterButton = useRef(null);
  const unread = preview.inbox.filter(item => !item.read);
  const visible = onlyUnread ? unread : preview.inbox;

  function respond(item, response) {
    filterButton.current.focus();
    setPreview(current => response === 'accepted' ? addPreviewFriend(current, item.personId) :
      {...current, inbox: current.inbox.map(entry => entry.id === item.id && !entry.response
        ? {...entry, response, read: true} : entry)});
  }

  return <Modal title="수신함" className="inbox-modal" onClose={onClose}>
    <div className="inbox-toolbar">
      <div className="career-tabs inbox-filters" aria-label="수신함 보기">
        <button ref={filterButton} type="button" aria-pressed={!onlyUnread} onClick={() => setOnlyUnread(false)}>전체</button>
        <button type="button" aria-pressed={onlyUnread} onClick={() => setOnlyUnread(true)}>
          읽지 않음 <span>{unread.length}</span>
        </button>
      </div>
      <button className="career-button" disabled={!unread.length}
        onClick={() => {
          filterButton.current.focus();
          setPreview(current => markInboxRead(current, () => true));
        }}>
        <CheckCheck size={16} aria-hidden="true"/>모두 읽음
      </button>
    </div>
    {visible.length ? <ul className="inbox-items">
      {visible.map(item => <InboxItem key={item.id} item={item} friendIds={preview.friendIds}
        onRead={id => {
          setPreview(current => markInboxRead(current, entry => entry.id === id));
          onClose();
        }} onRespond={respond}/>)}
    </ul> : <p className="community-empty inbox-empty">{onlyUnread ? '읽지 않은 알림이 없어요.' : '아직 받은 알림이 없어요.'}</p>}
  </Modal>;
}
