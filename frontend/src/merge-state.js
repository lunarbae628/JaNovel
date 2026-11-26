import DiffMatchPatch from 'diff-match-patch';
import {compareRows,paragraphs} from './comparison.js';

const matcher=new DiffMatchPatch();
function editGroups(diffs){
 const edits=[];let offset=0;
 for(let i=0;i<diffs.length;i++){
  const[op,value]=diffs[i];if(op===0){offset+=value.length;continue;}
  const start=offset;let text='';
  while(i<diffs.length&&diffs[i][0]!==0){const[type,part]=diffs[i++];if(type===-1)offset+=part.length;else text+=part;}i--;
  edits.push({start,end:offset,text});
 }
 return edits;
}
function moveOffset(point,edits,bias){
 let delta=0;
 for(const edit of edits){
  if(point<edit.start)return point+delta;
  if(edit.start===edit.end){if(point>edit.start||bias==='right')delta+=edit.text.length;continue;}
  if(point===edit.start)return point+delta;
  if(point<edit.end)return edit.start+delta+(bias==='end'?edit.text.length:0);
  delta+=edit.text.length-(edit.end-edit.start);
 }
 return point+delta;
}
// 앞 본문 기준 구간을 바뀐 본문 위치로 옮긴다.
export function followRanges(ranges,from,to){return from===to?ranges:moveRanges(ranges,editGroups(matcher.diff_main(from,to)));}
function moveRanges(ranges,edits){return ranges.map(range=>{
 const empty=range.start===range.end;
 const start=moveOffset(range.start,edits,'right');
 const end=moveOffset(range.end,edits,empty?'right':'end');
 return {...range,start,end:Math.max(start,end)};
});}

// 본문에서 가장 많이 쓴 문단 구분. 한쪽에만 있는 문단을 넣을 때 쓴다.
function paragraphSep(rows){
 const counts=new Map();
 for(const row of rows)for(const block of [row.right,row.left])if(block?.start>0)counts.set(block.sep,(counts.get(block.sep)||0)+1);
 return [...counts].sort((a,b)=>b[1]-a[1])[0]?.[0]||'\n';
}

// 두 본문을 문단 행으로 맞추고 바뀐 구절마다 결과 본문 안의 범위를 둔다.
// keep이 'right'이면 오른쪽 본문을 그대로 두고 시작하고(비교), 없으면 공통 부분만 두고 시작한다(병합).
export function createMergeState(left,right,keep=null){
 const changes=[],add=change=>{const next={...change,id:changes.length};changes.push(next);return next;};
 const base=compareRows(left,right),sep=paragraphSep(base);
 const rows=base.map(row=>{
  if(row.status==='modified')return {...row,pieces:row.pieces.map(piece=>piece.type==='equal'?piece:add({...piece,whole:false}))};
  if(row.status==='same')return row;
  const block=row.left||row.right;
  return {...row,change:add({left:row.left?.text||'',right:row.right?.text||'',whole:true,sep:block.start>0?block.sep:sep})};
 });
 // 오른쪽 본문을 두고 시작할 때는 첫 문단 앞과 끝 문단 뒤의 줄만 그대로 붙인다. 줄 안의 공백은 이미 문단에 들어 있다.
 const blocks=keep==='right'?paragraphs(right):[];
 const lead=keep!=='right'?'':blocks.length?right.slice(0,blocks[0].start):right,trail=blocks.length?right.slice(blocks.at(-1).end):'';
 let text=lead,emitted=false;const ranges=[];
 const range=(id,value)=>{ranges.push({id,start:text.length,end:text.length+value.length});text+=value;};
 for(const row of rows){
  if(row.change){
   const value=keep?row.change[keep]:'';
   if(value&&emitted)text+=row.change.sep;
   range(row.change.id,value);emitted||=!!value;continue;
  }
  if(emitted)text+=row.right.start>0?row.right.sep:sep;
  emitted=true;
  if(row.status==='same'){text+=row.right.text;continue;}
  for(const piece of row.pieces)if(piece.type==='equal')text+=piece.text;else range(piece.id,keep?piece[keep]:'');
 }
 return {rows,changes,ranges,choices:{},keep,text:text+trail,manual:false,last:null,seq:0};
}

export const choiceOf=(state,id)=>id in state.choices?state.choices[id]:state.keep;
// 구절 자리에 지금 고른 쪽 글이 그대로 있는지. 직접 고쳐 달라졌으면 카드로 바꾸지 않는다.
export function isIntact(state,id){
 const range=state.ranges.find(r=>r.id===id),choice=choiceOf(state,id);
 return !!range&&state.text.slice(range.start,range.end).trim()===(choice?state.changes[id][choice]:'').trim();
}

// 구절 하나를 바꿔 넣는다. 한쪽에만 있는 문단은 앞뒤 문단 구분을 함께 넣고 뺀다.
function replaceRegion(state,id,choice){
 const change=state.changes[id],range=state.ranges.find(r=>r.id===id),text=state.text;
 const value=choice?change[choice]:'';
 let edit,start,inserted=value;
 if(change.whole&&!value&&range.start<range.end){
  let from=range.start,to=range.end;
  const before=text.slice(0,from).match(/\s*$/)[0].length,after=text.slice(to).match(/^\s*/)[0].length;
  if(from-before===0)to+=after;else from-=before;
  edit={start:from,end:to,text:''};start=from;
 }else if(value&&range.start===range.end){
  const at=range.start,joint=change.whole?change.sep:' ';
  // 문단은 앞뒤 문단과 줄을 나누고, 문장은 앞뒤 문장과 띄어 쓴다.
  const needBefore=change.whole?at>0&&text[at-1]!=='\n':at>0&&!/\s/.test(text[at-1])&&!/^\s/.test(value)&&/[.!?。…]/.test(text[at-1]),
   needAfter=change.whole?at<text.length&&text[at]!=='\n':at<text.length&&!/\s/.test(text[at])&&!/\s$/.test(value)&&/[.!?。…]$/.test(value);
  edit={start:at,end:at,text:(needBefore?joint:'')+value+(needAfter?joint:'')};
  // 문장 사이에 넣은 띄어쓰기는 구절 범위에 포함해 취소할 때 함께 지운다. 문단 구분은 뺄 때 따로 정리한다.
  start=change.whole?at+(needBefore?joint.length:0):at;inserted=change.whole?value:edit.text;
 }else{edit={start:range.start,end:range.end,text:value};start=range.start;}
 const ranges=moveRanges(state.ranges,[edit]).map((r,index)=>{
  if(r.id===id)return {...r,start,end:start+inserted.length};
  // 같은 자리에 비어 있던 앞쪽 구절은 새로 넣은 내용 앞에 남겨 원래 순서를 지킨다.
  const old=state.ranges[index];
  if(edit.start===edit.end&&old.start===old.end&&old.start===edit.start&&r.id<id)return {...r,start:edit.start,end:edit.start};
  return r;
 });
 return {...state,ranges,choices:{...state.choices,[id]:choice},text:text.slice(0,edit.start)+edit.text+text.slice(edit.end),seq:state.seq+1,last:value?{id,start,end:start+inserted.length,side:choice,at:state.seq+1}:null};
}

// 같은 쪽을 다시 누르면 처음 상태(비교는 오른쪽 본문, 병합은 비움)로 돌린다.
export function chooseMergeRegion(state,id,side){
 if(!state.changes[id])return state;
 const current=choiceOf(state,id),choice=current===side?(side===state.keep?null:state.keep):side;
 return replaceRegion(state,id,choice);
}

// 모든 구절을 한쪽으로 고른다. 직접 고친 다른 내용은 그대로 둔다. intact이면 직접 고친 구절은 건너뛴다.
export function chooseAllRegions(state,side,{intact=false}={}){
 let next=state;
 for(const change of state.changes)if(choiceOf(next,change.id)!==side&&(!intact||isIntact(next,change.id)))next=replaceRegion(next,change.id,side);
 return {...next,last:null};
}

export function editMergeText(state,text){
 if(text===state.text)return state;
 const edits=editGroups(matcher.diff_main(state.text,text));
 return {...state,text,manual:true,last:null,ranges:moveRanges(state.ranges,edits)};
}

// 결과 본문에서 고른 구절의 위치와 출처. 결과 칸 뒤에 같은 색으로 표시한다.
export function mergeHighlights(state){
 return state.ranges.map(range=>({...range,side:choiceOf(state,range.id)})).filter(range=>range.side&&range.end>range.start&&state.text.slice(range.start,range.end).trim()===state.changes[range.id][range.side].trim());
}


// 문장이 끝나는 자리. 문장 부호 뒤 공백까지 한 문장으로 본다.
const SENTENCE_END=/[.!?。…]["'”’)\]]*\s+/g,ENDS_SENTENCE=/[.!?。…]["'”’)\]]*\s*$/;
function trimParts(parts){
 const list=parts.filter(part=>part.text);
 if(list.length){list[0]={...list[0],text:list[0].text.trimStart()};const last=list.length-1;list[last]={...list[last],text:list[last].text.trimEnd()};}
 return list.filter(part=>part.text);
}
// 달라진 부분을 문장 단위 카드로 묶는다. current는 오른쪽(작성 중) 문장, reference는 왼쪽(참고본) 문장이다.
export function changeCards(state){
 const cards=[];
 const add=(key,segments)=>{
  const ids=segments.filter(item=>item.id!=null).map(item=>item.id);if(!ids.length||!ids.every(id=>isIntact(state,id)))return;
  const side=name=>trimParts(segments.map(item=>({text:item.id==null?item.text:item[name],changed:item.id!=null})));
  const current=side('right'),reference=side('left'),plain=parts=>parts.map(part=>part.text).join('');
  if(plain(current)===plain(reference))return;
  cards.push({key,ids,current,reference,applied:ids.every(id=>choiceOf(state,id)==='left')});
 };
 for(const row of state.rows){
  if(row.change){add(row.key,[row.change]);continue;}
  if(row.status!=='modified')continue;
  let sentence=[],n=0;
  const close=()=>{add(row.key+':'+n++,sentence);sentence=[];};
  for(const piece of row.pieces){
   if(piece.type!=='equal'){sentence.push(piece);if([piece.left,piece.right].every(text=>!text.trim()||ENDS_SENTENCE.test(text)))close();continue;}
   let last=0;
   for(const match of piece.text.matchAll(SENTENCE_END)){const end=match.index+match[0].length;sentence.push({text:piece.text.slice(last,end)});last=end;close();}
   if(last<piece.text.length)sentence.push({text:piece.text.slice(last)});
  }
  if(sentence.length)close();
 }
 return cards;
}

// 카드 하나의 구절을 모두 참고본으로 바꾸고, 이미 바꿨으면 모두 되돌린다. 직접 고친 구절이 있으면 바꾸지 않는다.
export function toggleCard(state,ids){
 if(!ids.every(id=>isIntact(state,id)))return state;
 const applied=ids.every(id=>choiceOf(state,id)==='left');let next=state;
 for(const id of ids)if(applied||choiceOf(next,id)!=='left')next=chooseMergeRegion(next,id,'left');
 return next;
}

// 편집 칸에 그릴 표시. 참고본과 다른 곳은 입력을 멈춘 뒤에야 다시 계산되므로, 방금 반영한 곳과 겹치는 이전 표시는 빼서
// 반영한 곳 강조와 그 자리로의 스크롤이 바로 동작하게 한다.
export function draftHighlights(marks,applied){
 const visible=marks.filter(range=>range.end>range.start).map(range=>({...range,side:'right'}));
 if(!applied)return visible;
 return [...visible.filter(range=>range.end<=applied.start||range.start>=applied.end),{start:applied.start,end:applied.end,side:'applied'}];
}
