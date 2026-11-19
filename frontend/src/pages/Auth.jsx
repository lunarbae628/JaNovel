import React, {useState} from 'react';
import {ArrowLeft, Eye, EyeOff} from 'lucide-react';
import googleLogo from '../assets/google-g.png';
import {Field, Modal, Notice} from '../components/UI.jsx';
import './auth.css';

const timeline = [
  ['첫 초안', '나의 경험을 정리하고'],
  ['다른 도입', '새로운 방향을 시도하고'],
  ['작성 중', '더 나은 문장으로 이어가기'],
];

export default function Auth({page, navigate, onEnter, onVerify, verifiedEmail}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [shown, setShown] = useState(false);
  const [google, setGoogle] = useState(false);
  const [reset, setReset] = useState(false);
  const signup = page === 'signup';
  const details = page === 'signup-details';
  const isReset = page === 'reset';
  const login = page === 'login';
  const heading = login ? '로그인' : isReset ? '비밀번호 재설정' : details ? '계정 정보' :
    sent ? '인증번호를 입력해 주세요' : '회원가입';

  function submit(event) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    if (signup) {
      if (!sent) {
        setSent(true);
      } else if (code !== '123456') {
        setError('미리보기 인증번호 123456을 입력해 주세요.');
      } else {
        onVerify(email);
        navigate('/signup-details');
      }
      return;
    }
    if (details) {
      const password = String(data.get('password'));
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
        setError('8자 이상, 영문 대·소문자와 숫자를 포함해 주세요.');
        return;
      }
      if (password !== data.get('confirm')) {
        setError('비밀번호가 일치하지 않아요.');
        return;
      }
      if (!verifiedEmail) {
        navigate('/signup');
        return;
      }
      onEnter({name: String(data.get('name')).trim(), email: verifiedEmail});
      return;
    }
    if (isReset) {
      setReset(true);
      return;
    }
    onEnter({name: '', email});
  }

  return <div className="auth-page">
    <aside className="auth-brand">
      <a className="auth-wordmark" href="#/login">JaNovel.</a>
      <div className="auth-story">
        <p>나의 지원 기록</p>
        <h1>고쳐 쓴 과정까지,<br/>나의 이야기로.</h1>
        <p className="auth-description">자소서의 다음 버전을 이어가세요.</p>
        <ol className="auth-history">
          {timeline.map(([stage, label]) => <li key={stage}><small>{stage}</small><span>{label}</span></li>)}
        </ol>
      </div>
      <small>자소서부터 면접까지, JaNovel</small>
    </aside>
    <main className="auth-side">
      <div className="auth-form">
        <a className="auth-back" href="#/applications"><ArrowLeft size={12}/>둘러보기</a>
        {(signup || details) && <p className="auth-steps">
          <span aria-current={signup ? 'step' : undefined}>1 이메일 확인{details ? ' 완료' : ''}</span>
          <span aria-hidden="true">—</span><span aria-current={details ? 'step' : undefined}>2 계정 만들기</span>
        </p>}
        <h2>{heading}</h2>
        {isReset && <p className="auth-instructions">계정에 등록한 이메일을 입력해 주세요.</p>}
        {signup && sent && <p className="auth-instructions">미리보기 인증번호는 123456이에요.</p>}
        {(login || signup && !sent) && <>
          <button type="button" className="oauth-google" onClick={() => setGoogle(true)}>
            <img src={googleLogo} alt="" width="20" height="20"/>Google로 계속하기
          </button>
          <div className="auth-or">또는 이메일로 계속하기</div>
        </>}
        <form onSubmit={submit}>
          {details ? <Field label="이름"><input name="name" autoComplete="name" minLength={2} maxLength={50} placeholder="이름" required/></Field> :
            <Field label="이메일"><input type="email" autoComplete="email" value={email}
              readOnly={signup && sent} onChange={event => setEmail(event.target.value)} required placeholder="name@example.com"/></Field>}
          {signup && sent && <Field label="인증번호">
            <input inputMode="numeric" autoComplete="one-time-code" value={code} placeholder="6자리 숫자"
              onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} pattern="[0-9]{6}" required/>
          </Field>}
          {(login || details) && <>
            <Field label="비밀번호" hint={details ? '8자 이상 · 영문 대·소문자, 숫자 포함' : undefined}>
              <div className="password-field">
                <input aria-label="비밀번호" name="password" autoComplete={details ? 'new-password' : 'current-password'}
                  placeholder={details ? '비밀번호 만들기' : '비밀번호'} type={shown ? 'text' : 'password'} required/>
                <button type="button" className="icon-button" aria-label={shown ? '비밀번호 숨기기' : '비밀번호 보기'}
                  onClick={() => setShown(!shown)}>{shown ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
              </div>
            </Field>
            {details && <Field label="비밀번호 확인">
              <input name="confirm" placeholder="비밀번호 다시 입력" type={shown ? 'text' : 'password'} autoComplete="new-password" required/>
            </Field>}
          </>}
          {login && <a className="forgot" href="#/reset">비밀번호를 잊으셨나요?</a>}
          {error && <Notice type="error">{error}</Notice>}
          {reset && <Notice>재설정 화면을 미리 보고 있어요. 실제 메일 발송은 연결 전이에요.</Notice>}
          <button type="submit" className="button primary auth-submit">{login ? '로그인' : isReset ? '재설정 안내 받기' :
            details ? '가입하고 시작하기' : sent ? '확인하고 계속하기' : '인증번호 받기'}</button>
        </form>
        <p className="auth-switch">{login ? <>아직 계정이 없나요? <a href="#/signup">회원가입</a></> :
          <>이미 계정이 있나요? <a href="#/login">로그인</a></>}</p>
        {signup && sent && <button className="text-button auth-edit-email" onClick={() => {
          setSent(false); setCode(''); setError('');
        }}>이메일 수정하기</button>}
      </div>
      <p className="auth-local">로컬 미리보기 · 실제 계정 연결 전</p>
    </main>
    {google && <Modal title="Google 로그인" onClose={() => setGoogle(false)}>
      <Notice>Google 계정 연결은 준비 중이에요.</Notice>
      <div className="form-actions"><button className="button" onClick={() => setGoogle(false)}>닫기</button>
        <button className="button primary" onClick={() => onEnter({name: '', email: ''})}>로컬 작업공간 열기</button></div>
    </Modal>}
  </div>;
}
