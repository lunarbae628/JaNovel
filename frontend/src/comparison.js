import {createMergeState} from './merge-state.js';
export function comparisonSegments(reference,current){
 let offset=0,referenceOffset=0;
 return createMergeState(reference,current).segments.map(segment=>{
  if(segment.type==='equal'){offset+=segment.text.length;referenceOffset+=segment.text.length;return segment;}
  const start=offset,id=referenceOffset+':'+start+':'+JSON.stringify([segment.left,segment.right]);offset+=segment.right.length;referenceOffset+=segment.left.length;
  return {type:'change',id,reference:segment.left,current:segment.right,start,end:offset};
 });
}
export function takeReferenceChange(reference,current,id){
 const change=comparisonSegments(reference,current).find(s=>s.type==='change'&&s.id===id);
 return change?current.slice(0,change.start)+change.reference+current.slice(change.end):current;
}
