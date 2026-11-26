import DiffMatchPatch from 'diff-match-patch';

const matcher=new DiffMatchPatch();
matcher.Diff_Timeout=0.3;

// 줄바꿈으로 나눈 문단. sep은 문단 앞의 공백이며 첫 문단에서는 본문 앞 공백이다.
export function paragraphs(text){
 const blocks=[],pattern=/[^\n]*\S[^\n]*/g;let match,last=0;
 while((match=pattern.exec(text))){blocks.push({text:match[0],sep:text.slice(last,match.index),start:match.index,end:match.index+match[0].length});last=pattern.lastIndex;}
 return blocks;
}

const compact=text=>text.replace(/\s+/g,'');
export function similarity(a,b){a=compact(a);b=compact(b);if(!a&&!b)return 1;const diffs=matcher.diff_main(a,b);return 1-matcher.diff_levenshtein(diffs)/Math.max(a.length,b.length,1);}
// 짧은 쪽이 긴 쪽 안에 거의 그대로 들어 있으면(문장을 덧붙이거나 줄인 문단) 같은 문단을 고친 것으로 본다.
function containment(a,b){
 a=compact(a);b=compact(b);const shorter=Math.min(a.length,b.length);if(shorter<12)return 0;
 const diffs=matcher.diff_main(a,b);matcher.diff_cleanupSemantic(diffs);
 return diffs.filter(([op])=>op===0).reduce((sum,[,text])=>sum+text.length,0)/shorter;
}

const SIMILAR=0.45,GAP=-0.8;
function pairScore(a,b){
 if(a.text.trim()===b.text.trim())return 4;
 const score=Math.max(similarity(a.text,b.text),containment(a.text,b.text));
 return score>=SIMILAR?1.5+score:-Infinity;
}

// 문단 순서를 지키며 비슷한 문단끼리 짝짓는다. 짝이 없는 문단은 한쪽에만 있는 문단이 된다.
// 문단 쌍이 많으면 순서상 가까운 쌍만 비교해 계산량을 문단 수에 비례하게 묶는다.
const PAIR_LIMIT=2500,BAND=8;
function alignMiddle(left,right){
 const n=left.length,m=right.length,banded=n*m>PAIR_LIMIT;
 const score=left.map((a,i)=>right.map((b,j)=>banded&&Math.abs(i*m/n-j)>BAND?-Infinity:pairScore(a,b)));
 const best=Array.from({length:n+1},()=>Array(m+1).fill(0));
 for(let i=n-1;i>=0;i--)best[i][m]=best[i+1][m]+GAP;
 for(let j=m-1;j>=0;j--)best[n][j]=best[n][j+1]+GAP;
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)best[i][j]=Math.max(score[i][j]+best[i+1][j+1],GAP+best[i+1][j],GAP+best[i][j+1]);
 const pairs=[];let i=0,j=0;
 while(i<n||j<m){
  const match=i<n&&j<m?score[i][j]+best[i+1][j+1]:-Infinity,drop=i<n?GAP+best[i+1][j]:-Infinity,add=j<m?GAP+best[i][j+1]:-Infinity;
  if(Number.isFinite(match)&&match>=drop&&match>=add)pairs.push([i++,j++]);
  else if(i<n&&drop>=add)pairs.push([i++,null]);
  else pairs.push([null,j++]);
 }
 return pairs;
}
// 앞뒤로 같은 문단은 바로 짝짓고 가운데만 정렬한다. 한 문단을 고치는 동안에는 그 문단만 비교한다.
function alignParagraphs(left,right){
 const same=(i,j)=>left[i].text.trim()===right[j].text.trim();
 let head=0;while(head<left.length&&head<right.length&&same(head,head))head++;
 let tail=0;while(tail<left.length-head&&tail<right.length-head&&same(left.length-1-tail,right.length-1-tail))tail++;
 const pairs=[];for(let k=0;k<head;k++)pairs.push([k,k]);
 for(const[i,j]of alignMiddle(left.slice(head,left.length-tail),right.slice(head,right.length-tail)))pairs.push([i==null?null:i+head,j==null?null:j+head]);
 for(let k=tail;k>0;k--)pairs.push([left.length-k,right.length-k]);
 return pairs;
}

// 어절 단위로 비교해 바뀐 구절을 고른다. 공백만 사이에 둔 변경은 한 구절로 묶는다.
const words=text=>text.match(/\s+|\S+/g)||[];
function wordDiff(a,b){
 const codes=new Map(),encode=list=>list.map(word=>{if(!codes.has(word))codes.set(word,String.fromCharCode(codes.size+1));return codes.get(word);}).join('');
 const wa=words(a),wb=words(b),pieces=[];let ia=0,ib=0;
 for(const[op,chars]of matcher.diff_main(encode(wa),encode(wb),false)){
  const n=chars.length;
  if(op===0){pieces.push({type:'equal',text:wa.slice(ia,ia+n).join('')});ia+=n;ib+=n;continue;}
  let last=pieces.at(-1);if(last?.type!=='change'){last={type:'change',left:'',right:''};pieces.push(last);}
  if(op===-1){last.left+=wa.slice(ia,ia+n).join('');ia+=n;}else{last.right+=wb.slice(ib,ib+n).join('');ib+=n;}
 }
 const merged=[];
 for(const piece of pieces){
  const gap=merged.at(-1),before=merged.at(-2);
  if(piece.type==='change'&&gap?.type==='equal'&&before?.type==='change'&&compact(gap.text).length<=1){merged.pop();before.left+=gap.text+piece.left;before.right+=gap.text+piece.right;continue;}
  merged.push(piece);
 }
 return merged;
}

// 내용이 전혀 다른 문장으로 바뀐 구절은 바꾸기 대신 넣기와 빼기로 나눠 양쪽 문장을 모두 남길 수 있게 한다.
const REWRITE=0.35;
function splitRewrites(pieces){
 return pieces.flatMap(piece=>piece.type==='change'&&compact(piece.left).length>=10&&compact(piece.right).length>=10&&similarity(piece.left,piece.right)<REWRITE
  ?[{type:'change',left:piece.left,right:''},{type:'change',left:'',right:piece.right}]:[piece]);
}

export function textPieces(left,right){return splitRewrites(wordDiff(left,right));}

// 두 본문을 문단 행으로 맞춘다. same은 같은 문단, modified는 짝지은 문단과 바뀐 구절, deleted·added는 한쪽에만 있는 문단이다.
export function compareRows(leftText,rightText){
 const left=paragraphs(leftText),right=paragraphs(rightText);
 return alignParagraphs(left,right).map(([i,j])=>{
  if(i===null)return {key:'r'+j,status:'added',right:right[j]};
  if(j===null)return {key:'l'+i,status:'deleted',left:left[i]};
  const a=left[i],b=right[j],key='p'+i+'-'+j;
  return a.text===b.text?{key,status:'same',left:a,right:b}:{key,status:'modified',left:a,right:b,pieces:textPieces(a.text,b.text)};
 });
}

// 오른쪽 본문에서 왼쪽과 다른 구간. 편집 칸 뒤 층에 칠한다. 한쪽에만 있는 문단은 문단 전체를 칠한다.
export function differingRanges(leftText,rightText){
 const ranges=[];
 for(const row of compareRows(leftText,rightText)){
  if(row.status==='added'){ranges.push({start:row.right.start,end:row.right.end});continue;}
  if(row.status!=='modified')continue;
  let at=row.right.start;
  for(const piece of row.pieces){
   const text=piece.type==='equal'?piece.text:piece.right;
   if(piece.type!=='equal'&&text.trim())ranges.push({start:at+text.length-text.trimStart().length,end:at+text.trimEnd().length});
   at+=text.length;
  }
 }
 return ranges;
}
