import React,{useLayoutEffect,useRef} from 'react';
import {choiceOf,changeCards} from '../merge-state.js';

// 한쪽 본문을 문단 순서대로 그리고 다른 쪽과 달라진 구절을 그 쪽 색으로 표시한다.
// onChoose가 있으면 달라진 구절이나 한쪽에만 있는 문단을 눌러 고르고, 다시 눌러 취소한다.
export function VersionText({state,side,onChoose}){
 const out=[];let first=true;
 const region=(change,text,key)=>{
  const selected=choiceOf(state,change.id)===side;
  const className='version-change '+side+(change.whole?' whole':'')+(selected?' selected':'');
  if(!onChoose)return <span key={key} className={className}>{text}</span>;
  const press=e=>{if(e.type==='click'||e.key==='Enter'||e.key===' '){e.preventDefault();onChoose(change.id);}};
  return <span key={key} className={className} role="button" tabIndex={0} aria-pressed={selected} title={selected?'다시 누르면 취소':'결과에 반영'} onClick={press} onKeyDown={press}>{text}</span>;
 };
 for(const row of state.rows){
  const block=row[side];if(!block)continue;
  if(!first)out.push(block.start>0?block.sep:'\n');first=false;
  if(row.status==='same')out.push(block.text);
  else if(row.change)out.push(region(row.change,block.text,row.key));
  else out.push(...row.pieces.map((piece,i)=>piece.type==='equal'?piece.text:piece[side]?region(piece,piece[side],row.key+':'+i):null));
 }
 return <div className={'document-body version-text '+side}>{out.map((item,i)=>typeof item==='string'?<React.Fragment key={i}>{item}</React.Fragment>:item)}</div>;
}

// 결과 본문을 편집하는 칸. 고른 구절은 뒤 층에 출처 색으로 표시하고, 방금 반영한 곳은 잠깐 강조해 보이게 한다.
export function MergeDraft({text,onChange,highlights=[],flash,label='작성 중 본문',placeholder,className=''}){
 const input=useRef(null),backdrop=useRef(null);
 useLayoutEffect(()=>{
  const area=input.current,layer=backdrop.current;if(!area||!layer)return;
  const sync=()=>{const style=getComputedStyle(area);for(const name of ['font','letterSpacing','lineHeight','padding','whiteSpace','wordBreak','overflowWrap','tabSize'])layer.style[name]=style[name];layer.style.width=area.clientWidth+'px';layer.scrollTop=area.scrollTop;};
  sync();const observer=new ResizeObserver(sync);observer.observe(area);return()=>observer.disconnect();
 });
 // 반영한 곳이 칸 밖에 있으면 그 자리로 스크롤한다.
 useLayoutEffect(()=>{
  const area=input.current,mark=backdrop.current?.querySelector('.flash');if(!area||!mark)return;
  const top=mark.offsetTop,bottom=top+mark.offsetHeight;
  if(top<area.scrollTop||bottom>area.scrollTop+area.clientHeight)area.scrollTop=Math.max(0,top-area.clientHeight/3);
  backdrop.current.scrollTop=area.scrollTop;
 },[flash]);
 const ranges=[...highlights].sort((a,b)=>a.start-b.start),pieces=[];let at=0;
 for(const range of ranges){
  if(range.start<at)continue;
  const flashing=flash&&flash.start===range.start&&flash.end===range.end;
  pieces.push(text.slice(at,range.start),<mark key={range.start+':'+(flashing?flash.at:'')} className={'merge-mark '+range.side+(flashing?' flash':'')}>{text.slice(range.start,range.end)}</mark>);at=range.end;
 }
 pieces.push(text.slice(at)+'\n');
 return <div className={'merge-draft '+className}>
  <div className="merge-backdrop" ref={backdrop} aria-hidden="true">{pieces}</div>
  <textarea ref={input} className="body-editor merge-input" aria-label={label} value={text} placeholder={placeholder} onChange={e=>onChange(e.target.value)} onScroll={e=>{if(backdrop.current)backdrop.current.scrollTop=e.target.scrollTop}} spellCheck={false}/>
 </div>;
}

const sentence=parts=>parts.map(part=>part.text).join('');
// 달라진 문장을 지금 문장과 참고본 문장 한 쌍씩 보여 준다. 누르면 반영하고 다시 누르면 취소한다.
export function ChangeCards({state,onToggle}){
 const cards=changeCards(state);
 if(!cards.length)return <p className="change-empty">달라진 문장이 없어요.</p>;
 return <div className="change-cards">{cards.map(card=><button key={card.key} type="button" className={'change-card'+(card.applied?' applied':'')} aria-pressed={card.applied} title={card.applied?'다시 누르면 취소':'내 본문에 반영'} onClick={()=>onToggle(card.ids)}>
  <span className="change-current">{card.current.length?sentence(card.current):<em>새로 넣는 문장</em>}</span>
  <span className="change-reference">{card.reference.length?sentence(card.reference):<em>이 문장 빼기</em>}</span>
 </button>)}</div>;
}
