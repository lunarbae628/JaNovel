import React from 'react';
import {BriefcaseBusiness, CalendarDays, MessagesSquare, Settings2, UsersRound} from 'lucide-react';

const links = [
  ['/applications', '지원 현황', BriefcaseBusiness],
  ['/schedule', '일정', CalendarDays],
  ['/interviews', '면접 준비', MessagesSquare],
  ['/community', '커뮤니티', UsersRound],
];

export function writingPath(application) {
  return '/write/' + application.id + '/' + application.questions[0].id;
}

export function recentApplications(store) {
  const recent = (store.preferences?.recentApplications ?? [])
    .map(id => store.applications.find(application => application.id === id))
    .filter(Boolean);
  return recent.length ? recent : store.applications.filter(application => application.example &&
    application.questions.some(question => question.branches.some(branch => branch.draft.text))).slice(0, 2);
}

export function CareerLayout({section, store, onSettings, children}) {
  const recent = recentApplications(store);
  return <div className="career-layout">
    <aside className="career-sidebar">
      <div className="career-brand">
        <a className="career-wordmark" href="#/applications">JaNovel.</a>
      </div>
      <nav aria-label="전역 메뉴">
        {links.map(([path, label, Icon]) => <a key={path} href={'#' + path}
          aria-current={section === path ? 'page' : undefined}>
          <Icon size={18} strokeWidth={1.5}/><span>{label}</span>
        </a>)}
      </nav>
      {section !== '/applications' && recent.length > 0 && <section className="career-recent" aria-label="최근 작성">
        <h2>최근 작성</h2>
        {recent.map(application => <a key={application.id} href={'#' + writingPath(application)}>
          <strong>{application.company}</strong><span>{application.role}</span>
        </a>)}
      </section>}
      <footer className="career-account">
        <button type="button" onClick={onSettings}><Settings2 size={18} strokeWidth={1.5}/>설정</button>
        {store.profile?.name ? <span>{store.profile.name}</span> : <a href="#/login">로그인</a>}
      </footer>
    </aside>
    <main className="career-main">{children}</main>
  </div>;
}

export function CareerHeader({title, subtitle, children}) {
  return <header className="career-header">
    <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    {children && <div className="career-header-actions">{children}</div>}
  </header>;
}
