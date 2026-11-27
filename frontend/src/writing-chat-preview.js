// 실제 AI를 연결하기 전까지 작성 화면의 흐름을 보여 주는 예시 응답. 서버에 요청하지 않는다.
const fact=(experience,label)=>experience.facts?.find(item=>item.label===label)?.content;

function experienceParagraph(experience){
 const parts=[fact(experience,'상황'),fact(experience,'내가 한 일'),fact(experience,'결과')].filter(Boolean);
 return parts.length?experience.title+' 경험입니다. '+parts.join(' '):experience.text;
}

// 흔한 표현을 다짐형·간결한 표현으로 바꾼다. 바꿀 표현이 없으면 마지막에 문장을 하나 더한다.
const SWAPS=[[/그래서 /g,''],[/하고 싶습니다\./g,'하겠습니다.'],[/되었습니다/g,'됐습니다'],[/하였습니다/g,'했습니다'],[/분석해 보니/g,'확인해 보니']];
function revise(text){
 if(!text.trim())return '';
 const next=SWAPS.reduce((current,[pattern,value])=>current.replace(pattern,value),text);
 return next!==text?next:text.trimEnd()+' 이 경험을 입사 후에도 이어 가겠습니다.';
}

export function previewAnswer({kind,text,experiences=[]}){
 if(kind==='draft')return {
  reply:'예시 응답이에요. 고른 경험의 상황, 한 일, 결과 순서로 초안을 만들었어요.',
  candidate:experiences.map(experienceParagraph).join('\n'),
 };
 const candidate=revise(text);
 return {
  reply:candidate?'예시 응답이에요. 문장 끝을 다짐으로 바꾸고 군더더기를 덜어 냈어요.':'예시 응답이에요. 본문을 쓰면 수정안을 보여 드릴게요.',
  candidate,
 };
}
