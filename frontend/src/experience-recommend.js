import {postingSections} from './model.js';

// 공고·문항 어디에나 나오는 말은 추천 근거로 쓰지 않는다.
const commonWords=new Set(['지원','지원한','직무','기업','회사','개발','개발자','합니다','작성','작성해','주세요','본인','자신','경험','경험을','바탕으로','역량','이유','목표','포부','비교','연습']);
// 표현이 달라도 같은 주제로 보는 말 묶음.
const topics=[
 ['결제','정산','재고','동시성','동시 요청','중복','정합성','트랜잭션'],
 ['플랫폼','서버','백엔드','API','Spring'],
 ['성능','조회','쿼리','인덱스','응답 시간'],
 ['운영','장애','비동기','재시도','알림','메일'],
 ['협업','프론트엔드','리뷰','명세','OpenAPI'],
].map(topic=>topic.map(term=>term.toLowerCase()));

// 공고와 문항에 맞는 경험을 점수순으로 고른다. reasons는 공고·문항과 경험에 함께 나온 말로, 추천한 이유로 보여 준다.
export function relatedExperiences(experiences,application,question,limit=4){
 const context=[application.role,question.prompt,...postingSections(application).map(section=>section.body)].join(' ').toLowerCase();
 const terms=[...new Set(context.match(/[\p{L}\p{N}]{2,}/gu)??[])].filter(word=>!commonWords.has(word));
 const matchingTopics=topics.filter(topic=>topic.some(term=>context.includes(term)));
 return experiences.map(experience=>{
  const content=(experience.title+' '+experience.text).toLowerCase();
  const exact=terms.filter(term=>content.includes(term));
  const shared=matchingTopics.filter(topic=>topic.some(term=>content.includes(term)));
  const topicTerms=shared.flatMap(topic=>topic.filter(term=>context.includes(term)&&content.includes(term)));
  // 같은 주제의 말이 있으면 그것만 보여 준다. 조사가 붙은 말(문제를)보다 읽기 쉽다.
  const topicReasons=topicTerms.filter(readable);
  const reasons=[...new Set(topicReasons.length?topicReasons:exact.filter(readable))].slice(0,3).map(term=>original(experience,term));
  return {experience,reasons,score:exact.length*2+shared.length};
 }).filter(item=>item.score>0).sort((left,right)=>right.score-left.score).slice(0,limit)
  .map(({experience,reasons})=>({experience,reasons}));
}

// 추천 이유로 보여 주지 않는 말. 백엔드 공고와 경험 어디에나 나와서 왜 추천했는지 설명하지 못한다.
const generic=new Set(['api','spring','서버','백엔드','플랫폼','java','개발']);
// 조사가 붙은 말(문제를)은 읽기 어려워 이유에서 뺀다.
const withParticle=/(을|를|은|는|이|가|의|에|에서|으로|로|과|와|도)$/;
const readable=term=>!generic.has(term)&&!withParticle.test(term);

// 소문자로 맞춰 찾은 말을 경험에 적힌 표기대로 돌려준다(api → API).
function original(experience,term){
 const content=experience.title+' '+experience.text,at=content.toLowerCase().indexOf(term);
 return at<0?term:content.slice(at,at+term.length);
}
