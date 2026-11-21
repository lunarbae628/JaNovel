import React, {useEffect, useRef, useState} from 'react';
import {MessageCircle, PenLine, Search} from 'lucide-react';
import {BackLink, Field} from '../components/UI.jsx';
import Dropdown from '../components/Dropdown.jsx';
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

const initialBoard = {posts: [], joinedRequests: [], comments: {}};
const postOrder = ['s1', 'q1', 'r1', 'g1', 's2', 'r2', 's3', 'r3'];

function Category({value}) {
  return <span className={'board-category board-category-' + value}>{categoryName(value)}</span>;
}

function boardPath(category, {post, writing = false} = {}) {
  const query = new URLSearchParams();
  if (category) query.set('category', category);
  if (post) query.set('post', post);
  return (writing ? '/community/write' : '/community') + (query.size ? '?' + query : '');
}

function PostEditor({category, onCreate}) {
  const [kind, setKind] = useState(category || 'general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const heading = useRef(null);
  useEffect(() => heading.current.focus(), []);

  return <section className="board-editor" aria-labelledby="board-editor-title">
    <form onSubmit={event => {
      event.preventDefault();
      if (!title.trim() || !body.trim()) return;
      onCreate({id: uid('post'), category: kind, title: title.trim(), body: body.trim(), author: '나', date: todayKey()});
    }}>
      <header>
        <h1 id="board-editor-title" ref={heading} tabIndex={-1}>글쓰기</h1>
        <Dropdown label="말머리" field className="board-picker" options={categories.map(([value, label]) => ({value, label}))}
          value={kind} onChange={setKind}/>
      </header>
      <div className="board-editor-title-field">
        <input name="title" aria-label="제목" placeholder="제목을 입력하세요" maxLength={80} required
          value={title} onChange={event => setTitle(event.target.value)}/>
        <small>{title.length} / 80자</small>
      </div>
      <textarea name="body" aria-label="내용" placeholder="본문을 입력하세요" rows={8} maxLength={2400} required
        value={body} onChange={event => setBody(event.target.value)}/>
      <footer><small>{body.length} / 2,400자</small>
        <button className="career-button primary" disabled={!title.trim() || !body.trim()}>게시글 등록</button></footer>
    </form>
  </section>;
}

function PostDate({value}) {
  return <time dateTime={value}>{value.slice(2).replaceAll('-', '.')}</time>;
}

function BoardList({posts, comments, category, keyword, setKeyword}) {
  const term = keyword.trim().toLowerCase();
  const visiblePosts = posts.filter(post => (!category || category === post.category) &&
    [post.title, post.body, post.author].some(value => value.toLowerCase().includes(term)));

  return <section className="community-board" aria-label="게시글 목록">
    <h1 className="visually-hidden">커뮤니티</h1>
    <div className="board-toolbar">
      <nav className="career-tabs" aria-label="게시판 말머리">
        {[['', '전체'], ...categories].map(([id, label]) => <a key={id} href={'#' + boardPath(id)}
          aria-current={category === id ? 'page' : undefined}>{label}</a>)}
      </nav>
      <a className="career-button primary near-action board-write" href={'#' + boardPath(category, {writing: true})}>
        <PenLine size={15} aria-hidden="true"/>글쓰기
      </a>
      <label className="board-search">
        <Search size={17} aria-hidden="true"/>
        <input type="search" aria-label="게시글 검색" placeholder="게시글 검색"
          value={keyword} onChange={event => setKeyword(event.target.value)}/>
      </label>
      <p className="visually-hidden" role="status">게시글 {visiblePosts.length}개</p>
    </div>
    {visiblePosts.length > 0 && <ul className="board-posts" aria-label="게시글">
      {visiblePosts.map(post => <li key={post.id}>
        <a className="board-title-link" href={'#' + boardPath(category, {post: post.id})}>
          <strong className="board-post-title">{post.title}</strong>
          <span className="board-excerpt" aria-hidden="true">{post.body}</span>
          <span className="board-post-footer">
            <span className="board-post-labels">
              <Category value={post.category}/>
              <span className="board-comment-count">
                <MessageCircle size={16} aria-hidden="true"/>댓글{comments[post.id]?.length > 0 && ' ' + comments[post.id].length}
              </span>
            </span>
            <span className="board-post-byline">
              <span>{post.author}</span><span aria-hidden="true">·</span><PostDate value={post.date}/>
            </span>
          </span>
        </a>
      </li>)}
    </ul>}
    {!visiblePosts.length && <p className="board-empty">{term ? '검색 결과가 없어요.' : '아직 등록된 글이 없어요.'}</p>}
  </section>;
}

function PostComments({comments, onAdd}) {
  const [text, setText] = useState('');
  const input = useRef(null);
  return <section className="board-comments" aria-labelledby="board-comments-title">
    <h2 id="board-comments-title">댓글 <span aria-live="polite">{comments.length}개</span></h2>
    {comments.length ? <ul className="board-comments-list">
      {comments.map(comment => <li key={comment.id}>
        <div className="board-post-meta"><strong>{comment.author}</strong><PostDate value={comment.date}/></div>
        <p>{comment.text}</p>
      </li>)}
    </ul> : <p className="board-comments-empty">아직 댓글이 없어요.</p>}
    <form onSubmit={event => {
      event.preventDefault();
      if (!text.trim()) return;
      onAdd(text.trim());
      setText('');
      input.current.focus();
    }}>
      <Field label="댓글 작성"><textarea ref={input} rows={3} maxLength={600} value={text}
        onChange={event => setText(event.target.value)}/></Field>
      <div className="board-comment-actions"><small>{text.length} / 600자</small>
        <button className="career-button primary" disabled={!text.trim()}>댓글 등록</button>
      </div>
    </form>
  </section>;
}

function PostDetail({post, joined, onJoin}) {
  const heading = useRef(null);
  useEffect(() => heading.current.focus(), []);
  return <article className="board-detail">
    <header>
      <Category value={post.category}/>
      <h1 ref={heading} tabIndex={-1}>{post.title}</h1>
      <div className="board-post-meta"><strong>{post.author}</strong><PostDate value={post.date}/></div>
    </header>
    {post.meta && <p className="board-post-info">{post.meta}</p>}
    <p className="community-post-body">{post.body}</p>
    {post.category === 'studies' && post.author !== '나' && <footer>
      <button className="career-button primary" onClick={onJoin}>
        {joined ? '신청 취소' : '참여 신청'}
      </button>
    </footer>}
  </article>;
}

export default function Community({query, writing, navigate}) {
  const filteredCategory = query.get('category') || query.get('tab');
  const category = categoryName(filteredCategory) ? filteredCategory : '';
  const [today] = useState(todayKey);
  const [keyword, setKeyword] = useState('');
  const [{posts, joinedRequests, comments}, setPreview] = usePreviewState('board', initialBoard);
  const examplePosts = Object.entries(examples).flatMap(([categoryId, items]) => items.map(post => ({
    ...post, category: categoryId, date: addDays(today, -postOrder.indexOf(post.id)),
  }))).sort((a, b) => b.date.localeCompare(a.date));
  const allPosts = [...posts, ...examplePosts];
  const selected = allPosts.find(post => post.id === query.get('post'));

  return <>
    <div className="career-content community-content">
      {(writing || selected) && <BackLink className="page-back board-list-back" to={boardPath(category)}>
        목록으로
      </BackLink>}
      {writing ? <PostEditor key={category} category={category} onCreate={post => {
        setPreview(current => ({...current, posts: [post, ...current.posts]}));
        setKeyword('');
        navigate(boardPath(post.category, {post: post.id}));
      }}/> : selected ? <div className="board-reader" key={selected.id}>
        <PostDetail post={selected} joined={joinedRequests.includes(selected.id)}
          onJoin={() => setPreview(current => ({...current, joinedRequests: current.joinedRequests.includes(selected.id)
            ? current.joinedRequests.filter(id => id !== selected.id) : [...current.joinedRequests, selected.id]}))}/>
        <PostComments comments={comments[selected.id] || []} onAdd={text => {
          const comment = {id: uid('comment'), author: '나', text, date: todayKey()};
          setPreview(current => ({...current, comments: {...current.comments,
            [selected.id]: [...(current.comments[selected.id] || []), comment]}}));
        }}/>
      </div> : <BoardList posts={allPosts} comments={comments} category={category} keyword={keyword} setKeyword={setKeyword}/>}
      <p className="community-preview-note">미리보기 · 입력한 내용은 이 브라우저에만 저장돼요.</p>
    </div>
  </>;
}
