import DiffMatchPatch from 'diff-match-patch';
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
function moveRanges(ranges,edits){return ranges.map(range=>{
 const empty=range.start===range.end;
 const start=moveOffset(range.start,edits,'right');
 const end=moveOffset(range.end,edits,empty?'right':'end');
 return {...range,start,end:Math.max(start,end)};
});}
export function createMergeState(left,right){
 const diffs=matcher.diff_main(left,right);matcher.diff_cleanupSemantic(diffs);
 const segments=[];let id=0;
 for(let i=0;i<diffs.length;i++){
  if(diffs[i][0]===0){segments.push({type:'equal',text:diffs[i][1]});continue;}
  const change={type:'change',id:id++,left:'',right:''};
  while(i<diffs.length&&diffs[i][0]!==0){const[op,text]=diffs[i++];change[op===-1?'left':'right']+=text;}i--;segments.push(change);
 }
 let text='';const ranges=[];
 for(const segment of segments)if(segment.type==='equal')text+=segment.text;else ranges.push({id:segment.id,start:text.length,end:text.length});
 return {segments,ranges,choices:{},text,manual:false};
}
export function chooseMergeRegion(state,id,side){
 const segment=state.segments.find(p=>p.type==='change'&&p.id===id),range=state.ranges.find(r=>r.id===id);
 if(!segment||!range)return state;
 const choice=state.choices[id]===side?null:side,replacement=choice?segment[choice]:'';
 const edit={start:range.start,end:range.end,text:replacement};
 const ranges=moveRanges(state.ranges,[edit]).map(r=>r.id===id?{...r,start:range.start,end:range.start+replacement.length}:r);
 return {...state,choices:{...state.choices,[id]:choice},ranges,text:state.text.slice(0,range.start)+replacement+state.text.slice(range.end)};
}
export function editMergeText(state,text){
 if(text===state.text)return state;
 const edits=editGroups(matcher.diff_main(state.text,text));
 return {...state,text,manual:true,ranges:moveRanges(state.ranges,edits)};
}
