export const directory = [
  {id: 'jian', name: '이지안', mark: '지', color: 'blue'},
  {id: 'minjun', name: '박민준', mark: '민', color: 'green'},
  {id: 'harin', name: '정하린', mark: '하', color: 'violet'},
  {id: 'doyun', name: '김도윤', mark: '윤', color: 'blue'},
];
export const studyRoom = {id: 'interview', name: '백엔드 면접 스터디', color: 'violet', group: true};
const demoChat = {
  jian: [{id: 'j1', from: '이지안', text: '이번 주에 자소서 서로 한 번씩 봐줄까?'}],
  minjun: [{id: 'm1', from: '박민준', text: '모의면접 일정 잡히면 캘린더에 공유할게!'}],
  interview: [
    {id: 'i1', from: '이지안', text: '이번 주에는 DB 트랜잭션이랑 동시성 질문을 연습하면 어때요?'},
    {id: 'i2', from: '박민준', text: '좋아요. 저는 면접관 역할 준비해 갈게요.'},
  ],
};

const scheduleComment = {id: 'c1', from: '박민준', text: '정리 끝나면 내일 같이 예상 질문도 볼까요?'};
export const demoComments = {'jian/e1': [scheduleComment]};

export const initialSocial = {
  friendIds: ['jian', 'minjun'], invites: [], comments: {}, chat: demoChat,
  inbox: [
    {id: 'request-harin', kind: 'request', personId: 'harin', text: '친구 요청을 보냈어요.'},
    {id: 'message-j1', kind: 'message', personId: 'jian', target: 'jian', text: demoChat.jian[0].text},
    {id: 'comment-c1', kind: 'comment', personId: 'minjun', target: 'jian', eventId: 'e1',
      subject: '면접 답변 초안 정리', text: scheduleComment.text},
  ],
};

export function markInboxRead(state, matches) {
  if (!state.inbox.some(item => !item.read && matches(item))) return state;
  return {...state, inbox: state.inbox.map(item => !item.read && matches(item) ? {...item, read: true} : item)};
}

export function addPreviewFriend(state, id) {
  const friendIds = state.friendIds.includes(id) ? state.friendIds : [...state.friendIds, id];
  return {...state, friendIds, inbox: state.inbox.map(item =>
    item.kind === 'request' && item.personId === id && !item.response
      ? {...item, read: true, response: 'accepted'} : item)};
}
