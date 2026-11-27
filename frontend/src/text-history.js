// 작성 중 본문의 되돌리기·다시 실행 기록. AI 수정안 적용이나 초안 넣기처럼 코드가 본문을 바꾸면
// 브라우저 입력 칸의 기본 되돌리기 기록이 끊기므로, 타이핑과 함께 이 기록으로 관리한다.
const MERGE_MS=800,LIMIT=100;

export const createHistory=text=>({past:[],present:text,future:[],lastAt:0,lastKind:null});

// 새 본문을 기록한다. 멈추지 않고 이어서 입력한 변경은 한 단계로 묶고, 적용(apply)은 늘 새 단계로 둔다.
export function recordText(history,text,{at,kind='typing'}){
 if(text===history.present)return history;
 const merge=kind==='typing'&&history.lastKind==='typing'&&at-history.lastAt<MERGE_MS;
 return {past:merge?history.past:[...history.past,history.present].slice(-LIMIT),present:text,future:[],lastAt:at,lastKind:kind};
}

export function undoText(history){
 if(!history.past.length)return history;
 return {past:history.past.slice(0,-1),present:history.past.at(-1),future:[history.present,...history.future],lastAt:0,lastKind:null};
}

export function redoText(history){
 if(!history.future.length)return history;
 return {past:[...history.past,history.present],present:history.future[0],future:history.future.slice(1),lastAt:0,lastKind:null};
}
