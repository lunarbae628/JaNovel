import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const dir = path.dirname(fileURLToPath(import.meta.url));
const docs = [
  {file:'01-product-plan.md', id:'plan', label:'제품 기획', kicker:'01 / PRODUCT PLAN'},
  {file:'02-critical-review.md', id:'review', label:'경쟁력과 의문점', kicker:'02 / CRITICAL REVIEW'},
  {file:'03-sources.md', id:'sources', label:'근거와 조사 한계', kicker:'03 / REFERENCES'},
];
const escape = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let toc = '';
const sections = docs.map(doc => {
  const source = fs.readFileSync(path.join(dir,doc.file),'utf8');
  let html = marked.parse(source);
  let i = 0;
  const sub = [];
  html = html.replace(/<h2>(.*?)<\/h2>/g, (_,heading) => {
    const id = `${doc.id}-${++i}`;
    sub.push(`<a href="#${id}">${heading}</a>`);
    return `<h2 id="${id}">${heading}</h2>`;
  });
  for (const target of docs) html = html.replaceAll(`href="${target.file}"`, `href="#${target.id}"`);
  html = html.replace(/<table>/g,'<div class="table-scroll" role="region" aria-label="비교 표" tabindex="0"><table>').replace(/<\/table>/g,'</table></div>');
  toc += `<div class="toc-group"><a class="chapter-link" href="#${doc.id}">${doc.label}</a><div class="sub-links">${sub.join('')}</div></div>`;
  return `<article id="${doc.id}"><div class="chapter-kicker">${doc.kicker}<a href="${doc.file}" download>Markdown 원문 ↗</a></div>${html}</article>`;
});

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Docsa 기반 신규 서비스 · 기획과 검토</title>
<style>
:root{--ink:#243a32;--text:#35413d;--muted:#67736d;--green:#276550;--paper:#faf9f5;--line:#dce2da;--amber:#935324}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:32px}body{margin:0;background:var(--paper);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;font-size:16px;line-height:1.85;word-break:keep-all;overflow-wrap:anywhere}a{color:var(--green);text-underline-offset:4px}a:hover{color:#143f30}a:focus-visible,button:focus-visible,[tabindex]:focus-visible{outline:3px solid #c38a43;outline-offset:4px}header{border-bottom:1px solid var(--line);padding:21px max(32px,calc((100vw - 1300px)/2));display:flex;justify-content:space-between;align-items:center;gap:16px;font-size:13px;background:#fff}.brand{color:var(--ink);font-weight:750;letter-spacing:.05em}.meta{color:var(--muted)}.layout{max-width:1300px;margin:auto;display:grid;grid-template-columns:244px minmax(0,1fr);gap:64px;padding:45px 32px 96px}aside{align-self:start;position:sticky;top:24px;max-height:calc(100vh - 48px);overflow:auto;font-size:13px}.nav-label{font-size:11px;letter-spacing:.16em;color:var(--muted);margin:0 0 18px}.toc-group{margin-bottom:23px}.chapter-link{display:block;color:var(--ink);font-size:15px;font-weight:700;text-decoration:none;padding:5px 0}.sub-links{display:grid;border-left:1px solid var(--line);padding-left:13px;margin-top:7px;gap:6px}.sub-links a{text-decoration:none;color:var(--muted);line-height:1.55;padding:2px 0}.sub-links a.active{color:var(--green);font-weight:700}.note{margin-top:28px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}main{min-width:0}.hero{padding:6px 0 32px;border-bottom:2px solid var(--ink);margin-bottom:44px}.eyebrow{font-size:12px;letter-spacing:.12em;color:var(--green);font-weight:700}.hero h1{font-size:clamp(30px,3.2vw,44px);line-height:1.35;letter-spacing:-.04em;margin:17px 0 17px;color:var(--ink)}.hero p{font-size:17px;max-width:650px;color:var(--muted);margin:0}.status{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.status span{border-radius:3px;font-size:12px;padding:5px 10px;background:#e9efe8;color:#355644}.status .pending{background:#f2eade;color:#805727}article{margin:0 0 72px;scroll-margin-top:30px}article+article{border-top:2px solid var(--ink);padding-top:36px}.chapter-kicker{display:flex;justify-content:space-between;align-items:center;gap:15px;font-size:11px;letter-spacing:.08em;color:var(--green);font-weight:700}.chapter-kicker a{font-size:12px;font-weight:400;letter-spacing:0}article h1{font-size:29px;line-height:1.45;letter-spacing:-.035em;color:var(--ink);margin:12px 0 8px}article h1+p{font-size:12px;color:var(--muted);margin:0 0 30px}h2{font-size:23px;line-height:1.5;color:var(--ink);letter-spacing:-.025em;margin:45px 0 19px;border-bottom:1px solid var(--line);padding-bottom:12px;scroll-margin-top:28px}h3{font-size:18px;line-height:1.6;color:var(--ink);margin:30px 0 12px}p{margin:12px 0 17px}strong{color:var(--ink);font-weight:750}ul,ol{padding-left:25px}li{padding-left:3px;margin:10px 0}.table-scroll{overflow-x:auto;max-width:100%;margin:20px 0 25px;background:#fff;border:1px solid var(--line);border-radius:5px}table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.75;min-width:590px}th,td{text-align:left;padding:15px 17px;vertical-align:top;border-bottom:1px solid var(--line)}th{background:#edf1eb;font-size:12px;letter-spacing:.01em;color:var(--ink);font-weight:700}tr:last-child td{border-bottom:0}td:first-child{color:var(--ink);min-width:110px;width:21%;font-weight:600}td p{margin:0}#review .chapter-kicker{color:var(--amber)}#review h3{border-left:3px solid #c9945b;padding-left:13px}#sources table{font-size:13px}footer{padding:24px 0;border-top:1px solid var(--line);color:var(--muted);font-size:12px}.top{font-size:12px}.reading-line{position:fixed;top:0;left:0;height:3px;background:var(--green);width:0;z-index:5}
@media(max-width:1000px){.layout{gap:32px;grid-template-columns:205px minmax(0,1fr);padding-left:24px;padding-right:24px}table{min-width:530px}}
@media(max-width:760px){header{padding:15px 20px}.layout{display:block;padding:24px 20px 60px}aside{position:static;max-height:none;border-bottom:1px solid var(--line);margin-bottom:26px;padding-bottom:15px;display:flex;flex-wrap:wrap;gap:8px 17px}.nav-label,.sub-links,.note{display:none}.toc-group{margin:0}.chapter-link{font-size:13px}.hero{padding-top:0}.hero h1{font-size:32px}.hero p{font-size:15px}article h1{font-size:25px}h2{font-size:21px}body{font-size:15px}.chapter-kicker{font-size:10px}.chapter-kicker a{font-size:11px}.status{gap:7px}.status span{font-size:11px}th,td{padding:12px}}
@media print{body{font-size:10pt;background:white;line-height:1.6}header,aside,.reading-line,.chapter-kicker a,.top{display:none}.layout{display:block;padding:0;max-width:none}.hero h1{font-size:28pt}article{margin-bottom:25px}article+article{break-before:page}.table-scroll{overflow:visible;border:0}table{min-width:0;font-size:9pt}th,td{padding:8px}h2,h3{break-after:avoid}tr{break-inside:avoid}a{color:inherit;text-decoration:none}.hero{margin-bottom:25px}footer{display:none}}
</style>
</head>
<body id="top">
<div class="reading-line" aria-hidden="true"></div>
<header><span class="brand">DOCSA → NEW PROJECT</span><span class="meta">주제별 작성안 · 2026.11.13 · v1.9</span></header>
<div class="layout"><aside aria-label="문서 목차"><div class="nav-label">CONTENTS</div>${toc}<div class="note">첫 버전 범위와 완료 기준을 정리했습니다.<br>수치와 실험 기준은 검증 전 가설입니다.</div></aside>
<main><section class="hero"><div class="eyebrow">자소서 버전관리를 중심으로</div><h1>어떻게 고쳤고,<br>무엇을 제출했는지.</h1><p>공고에서 자소서, 제출본과 면접 준비까지.<br>Docsa 코드를 바탕으로 시작하는 별도 프로젝트의 기획과 검토.</p><div class="status"><span>첫 버전 기획 v1.9</span><span class="pending">경쟁력·유료 수요 미검증</span></div></section>
${sections.join('\n')}
<footer>Markdown 원문과 동일한 내용을 담은 검토본입니다. 확정된 첫 버전 범위와 검증 전 가정을 구분했으며 제품 구현과 사용자 실험은 아직 진행하지 않았습니다. <a class="top" href="#top">맨 위로 ↑</a></footer></main></div>
<script>
const bar=document.querySelector('.reading-line');
window.addEventListener('scroll',()=>{const h=document.documentElement;bar.style.width=(h.scrollTop/Math.max(1,h.scrollHeight-h.clientHeight)*100)+'%'},{passive:true});
const links=[...document.querySelectorAll('.sub-links a')];
const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){for(const a of links)a.classList.toggle('active',a.hash==='#'+e.target.id)}}},{rootMargin:'-5% 0px -70% 0px'});
document.querySelectorAll('h2[id]').forEach(h=>observer.observe(h));
</script>
</body></html>`;
fs.writeFileSync(path.join(dir,'index.html'),html);
console.log(JSON.stringify({output:path.join(dir,'index.html'),documents:docs.length,bytes:Buffer.byteLength(html)}));
