import React, {useState} from 'react';
import {ArrowLeft, PenLine, Search} from 'lucide-react';
import {CareerHeader} from '../components/CareerLayout.jsx';
import {Field, Modal} from '../components/UI.jsx';
import {uid} from '../model.js';
import {addDays, todayKey} from '../schedule.js';
import {usePreviewState} from '../community-preview.js';
import '../community.css';

const categories = [
  ['general', '자유'], ['question', '질문'], ['studies', '스터디 모집'], ['reviews', '합격 후기'],
];
const categoryName = category => categories.find(([id]) => category === id)?.[1];
const examples = {
  general: [
    {id: 'g1', title: '이번 주 지원 목표 같이 정해요', author: '정하린',
      body: '저는 금요일까지 공고 세 곳을 읽고 지원할 곳을 두 곳으로 좁혀보려고 해요. 다들 이번 주에 어떤 계획 세웠나요?'},
  ],
  question: [
    {id: 'q1', title: '프로젝트 소개를 1분 안에 어떻게 정리하시나요?', author: '한 걸음',
      body: '지원 직무와 관련된 프로젝트가 두 개인데, 한 가지만 깊게 말할지 둘 다 짧게 소개할지 고민입니다. 면접에서 어떻게 이야기하셨나요?'},
  ],
  studies: [
    {id: 's1', title: '백엔드 시스템 설계 면접 스터디', author: '이지안', meta: '온라인 · 주 1회 · 4명 모집',
      body: '매주 한 가지 설계 문제를 골라 30분씩 발표하고 피드백해요. 첫 주 주제는 채용 공고를 모아 보는 서비스예요. 개발 경험이 적어도 참여할 수 있어요.'},
    {id: 's2', title: '평일 저녁 코딩테스트 풀이 모임', author: '정하린', meta: '온라인 · 평일 저녁 · 6명 모집',
      body: '각자 문제를 풀고 접근 방식과 놓친 테스트 케이스를 공유해요. 매주 월요일에 문제 세 개를 정합니다.'},
    {id: 's3', title: '지원동기와 경험 문항 같이 다듬기', author: '박민준', meta: '온라인 · 격주 토요일 · 3명 모집',
      body: '지원동기와 경험 문항을 하나씩 가져와 서로 읽고, 설명이 부족한 부분을 질문으로 남기는 모임이에요.'},
  ],
  reviews: [
    {id: 'r1', title: '백엔드 신입 면접에서 받았던 저장·복구 질문', author: '개발하는 토끼', meta: '기술 면접 · 최종 합격',
      body: '면접에서는 먼저 저장 흐름을 그림으로 설명했어요. 두 요청이 같은 문서를 수정하면 데이터가 어떻게 되는지, 중간에 DB 연결이 끊기면 어떤 화면을 보여주는지까지 질문을 받았어요. 테스트에서 재현한 상황을 기준으로 답하니 설명하기 수월했어요.'},
    {id: 'r2', title: '서비스 운영 경험을 포트폴리오에 정리한 방법', author: '한 걸음', meta: '서류 · 기술 면접 · 최종 합격',
      body: '사용 기술 목록을 줄이고 어떤 문제를 발견했는지, 어떻게 확인했고 무엇을 바꿨는지를 한 페이지에 담았어요. 수치가 있는 개선은 측정 조건도 같이 기록했습니다.'},
    {id: 'r3', title: '채용연계형 인턴 면접과 전환 과정', author: '라운드', meta: '인턴 전형 · 최종 합격',
      body: '과제에서 우선 구현할 범위를 정한 이유와, 시간이 더 있었다면 어떤 테스트를 추가할지를 구체적으로 설명했어요. 인턴 기간에는 리뷰에서 받은 피드백을 다음 작업에 적용한 사례를 기록해 두었습니다.'},
  ],
};

const initialBoard = {posts: [], joinedRequests: []};
const postOrder = ['s1', 'q1', 'r1', 'g1', 's2', 'r2', 's3', 'r3'];

function Category({value}) {
  return <span className={'board-category board-category-' + value}>{categoryName(value)}</span>;
}

function boardPath(category, post) {
  const query = new URLSearchParams();
  if (category) query.set('category', category);
  if (post) query.set('post', post);
  return '/community' + (query.size ? '?' + query : '');
}

function PostDialog({category, onCreate, onClose}) {
  return <Modal title="글쓰기" className="community-modal" onClose={onClose}>
    <form onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const title = values.get('title').trim();
      const body = values.get('body').trim();
      if (!title || !body) return;
      onCreate({id: uid('post'), category: values.get('category'), title, body, author: '나', date: todayKey()});
    }}>
      <Field label="말머리"><select name="category" defaultValue={category || 'general'}>
        {categories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></Field>
      <Field label="제목"><input name="title" placeholder="제목을 입력하세요" maxLength={80} required/></Field>
      <Field label="내용"><textarea name="body" placeholder="내용을 입력하세요" rows={7} maxLength={2400} required/></Field>
      <div className="form-actions"><button className="button" type="button" onClick={onClose}>취소</button>
        <button className="button primary">등록</button></div>
    </form>
  </Modal>;
}

function PostDate({value}) {
  return <time dateTime={value}>{value.slice(2).replaceAll('-', '.')}</time>;
}

function BoardList({posts, category, keyword, setKeyword}) {
  const term = keyword.trim().toLowerCase();
  const visiblePosts = posts.filter(post => (!category || category === post.category) &&
    [post.title, post.body, post.author].some(value => value.toLowerCase().includes(term)));

  return <>
    <nav className="career-tabs community-tabs" aria-label="게시판 말머리">
      {[['', '전체'], ...categories].map(([id, label]) => <a key={id} href={'#' + boardPath(id)}
        aria-current={category === id ? 'page' : undefined}>{label}</a>)}
    </nav>
    <section className="career-sheet community-board" aria-label="게시글 목록">
      <div className="board-toolbar">
        <p role="status">게시글 <strong>{visiblePosts.length}</strong>개</p>
        <label className="board-search">
          <Search size={16} aria-hidden="true"/>
          <input type="search" aria-label="게시글 검색" placeholder="제목, 내용, 작성자 검색"
            value={keyword} onChange={event => setKeyword(event.target.value)}/>
        </label>
      </div>
      <table aria-label="게시글" className="board-table">
        <thead><tr><th scope="col" className="board-number">번호</th><th scope="col" className="board-type">말머리</th>
          <th scope="col">제목</th><th scope="col" className="board-author">작성자</th><th scope="col" className="board-date">작성일</th></tr></thead>
        <tbody>{visiblePosts.map(post => <tr key={post.id}>
          <td className="board-number">{post.number}</td>
          <td className="board-type"><Category value={post.category}/></td>
          <td><a className="board-title-link" href={'#' + boardPath(category, post.id)}>
            <strong>{post.title}</strong>
            <span className="board-mobile-meta">{post.author} <span aria-hidden="true">·</span> <PostDate value={post.date}/></span>
          </a></td>
          <td className="board-author">{post.author}</td>
          <td className="board-date"><PostDate value={post.date}/></td>
        </tr>)}</tbody>
      </table>
      {!visiblePosts.length && <p className="board-empty">{term ? '검색 결과가 없어요.' : '아직 등록된 글이 없어요.'}</p>}
    </section>
  </>;
}

function PostDetail({post, category, joined, onJoin}) {
  return <article className="career-sheet board-detail">
    <header>
      <Category value={post.category}/>
      <h2>{post.title}</h2>
      <div className="board-post-meta"><strong>{post.author}</strong><PostDate value={post.date}/></div>
    </header>
    {post.meta && <p className="board-post-info">{post.meta}</p>}
    <p className="community-post-body">{post.body}</p>
    <footer>
      <a className="career-button" href={'#' + boardPath(category)}><ArrowLeft size={15} aria-hidden="true"/>목록으로</a>
      {post.category === 'studies' && post.author !== '나' && <button className="career-button primary" onClick={onJoin}>
        {joined ? '신청 취소' : '참여 신청'}
      </button>}
    </footer>
  </article>;
}

export default function Community({query, navigate}) {
  const filteredCategory = query.get('category') || query.get('tab');
  const category = categoryName(filteredCategory) ? filteredCategory : '';
  const [today] = useState(todayKey);
  const [writing, setWriting] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [{posts, joinedRequests}, setPreview] = usePreviewState('board', initialBoard);
  const examplePosts = Object.entries(examples).flatMap(([categoryId, items]) => items.map(post => ({
    ...post, category: categoryId, date: addDays(today, -postOrder.indexOf(post.id)),
  }))).sort((a, b) => b.date.localeCompare(a.date));
  const allPosts = [...posts, ...examplePosts].map((post, index, list) => ({...post, number: list.length - index}));
  const selected = allPosts.find(post => post.id === query.get('post'));

  return <>
    <CareerHeader title="커뮤니티">
      {!selected && <button className="career-button primary" onClick={() => setWriting(true)}>
        <PenLine size={16} aria-hidden="true"/>글쓰기
      </button>}
    </CareerHeader>
    <div className="career-content community-content">
      {selected ? <PostDetail key={selected.id} post={selected} category={category} joined={joinedRequests.includes(selected.id)}
        onJoin={() => setPreview(current => ({...current, joinedRequests: current.joinedRequests.includes(selected.id)
          ? current.joinedRequests.filter(id => id !== selected.id) : [...current.joinedRequests, selected.id]}))}/> :
        <BoardList posts={allPosts} category={category} keyword={keyword} setKeyword={setKeyword}/>}
      <p className="community-preview-note">미리보기 · 입력한 내용은 이 브라우저에만 저장돼요.</p>
    </div>
    {writing && <PostDialog category={category} onClose={() => setWriting(false)} onCreate={post => {
      setPreview(current => ({...current, posts: [post, ...current.posts]}));
      setKeyword('');
      setWriting(false);
      navigate(boardPath(post.category, post.id));
    }}/>}
  </>;
}
