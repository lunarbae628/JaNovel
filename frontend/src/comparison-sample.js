// 한 문항을 여러 번 고쳐 쓴 흐름을 흉내 낸 비교 연습용 본문. 개발 서버에서 ?sample=comparison으로 열거나 테스트에서 쓴다.
// 실제 자소서처럼 버전마다 단어·수치·문장 하나씩 조금씩 바뀐다.
import {createQuestion,updateDraft,snapshot,branchFrom,uid} from './model.js';
import {createApplication} from './seed.js';
export const prompt='루트페이에 지원한 동기와 입사 후 목표를 작성해 주세요.';

// v1 첫 초안: 표현이 막연하고 수치가 없다.
export const firstDraft=`저는 결제 서비스의 안정성에 관심이 많아 루트페이에 지원하게 되었습니다. 결제는 한 번의 오류가 사용자의 돈과 신뢰에 바로 영향을 주는 영역이라고 생각합니다.
인턴으로 일하며 주문 API의 응답이 느리다는 문의를 받았습니다. 쿼리를 분석해보니 인덱스가 없는 조건으로 조회하고 있었고, 인덱스를 추가해 응답 시간을 줄였습니다. 이 경험으로 문제의 원인을 데이터로 확인하는 습관을 갖게 되었습니다.
입사 후에는 결제 시스템의 장애를 줄이는 개발자가 되고 싶습니다. 열심히 배우며 성장하겠습니다.`;

// v2 다듬기: 도입 두 문장의 순서를 바꾸고 회사 근거를 넣었다. 경험에 수치를 넣고 결론을 구체화했다.
export const polished=`결제는 한 번의 오류가 사용자의 돈과 신뢰에 바로 영향을 주는 영역입니다. 그래서 하루 수백만 건의 거래를 안정적으로 처리하는 루트페이의 결제 플랫폼에서 일하고 싶어 지원했습니다.
인턴 기간에 주문 API의 응답이 느리다는 문의를 받았습니다. 실행 계획을 분석해 보니 인덱스가 없는 조건으로 전체 테이블을 조회하고 있었고, 복합 인덱스를 추가해 평균 응답 시간을 1.2초에서 0.3초로 줄였습니다. 이 경험으로 문제의 원인을 감이 아닌 데이터로 확인하는 습관을 갖게 되었습니다.
입사 후에는 결제 승인 과정의 장애 대응 시간을 줄이는 데 기여하고 싶습니다. 열심히 배우며 성장하겠습니다.`;

// v3 보강(현재 작성 중): 경험에 한 문장을 더하고 막연한 마지막 문장을 계획으로 바꿨다.
export const revised=`결제는 한 번의 오류가 사용자의 돈과 신뢰에 바로 영향을 주는 영역입니다. 그래서 하루 수백만 건의 거래를 안정적으로 처리하는 루트페이의 결제 플랫폼에서 일하고 싶어 지원했습니다.
인턴 기간에 주문 API의 응답이 느리다는 문의를 받았습니다. 실행 계획을 분석해 보니 인덱스가 없는 조건으로 전체 테이블을 조회하고 있었고, 복합 인덱스를 추가해 평균 응답 시간을 1.2초에서 0.3초로 줄였습니다. 같은 패턴의 쿼리 6개도 찾아 함께 개선했습니다. 이 경험으로 문제의 원인을 감이 아닌 데이터로 확인하는 습관을 갖게 되었습니다.
입사 후에는 결제 승인 과정의 장애 대응 시간을 줄이는 데 기여하고 싶습니다. 먼저 모니터링 지표와 장애 이력을 익히고, 재처리와 멱등성 설계를 깊이 공부하겠습니다.`;

// AI 첨삭안: v3를 바탕으로 몇 문장의 표현만 다듬었다.
export const aiSuggestion=`결제는 한 번의 오류가 사용자의 돈과 신뢰에 바로 영향을 주는 영역입니다. 하루 수백만 건의 거래를 안정적으로 처리하는 루트페이의 결제 플랫폼에서 이 책임을 함께 지고 싶어 지원했습니다.
인턴 기간에 주문 API가 느리다는 문의를 받았습니다. 실행 계획을 확인해 보니 인덱스 없이 전체 테이블을 조회하고 있었고, 복합 인덱스를 추가해 평균 응답 시간을 1.2초에서 0.3초로 75% 줄였습니다. 같은 패턴의 쿼리 6개도 찾아 함께 개선했습니다. 이 경험으로 문제의 원인을 감이 아닌 데이터로 확인하는 습관을 갖게 되었습니다.
입사 후 1년 안에 결제 승인 과정의 장애 대응 시간을 줄이는 데 기여하겠습니다. 먼저 모니터링 지표와 장애 이력을 익히고, 재처리와 멱등성 설계를 깊이 공부하겠습니다.`;

// 500자 제한 공고에 내려고 v3에서 줄인 안: 문장을 빼고 두 문장을 하나로 합쳤다.
export const shortened=`결제는 한 번의 오류가 사용자의 돈과 신뢰에 바로 영향을 주는 영역입니다. 그래서 루트페이의 결제 플랫폼에서 일하고 싶어 지원했습니다.
인턴 기간에 주문 API의 응답이 느리다는 문의를 받고, 실행 계획을 분석해 복합 인덱스를 추가했습니다. 평균 응답 시간을 1.2초에서 0.3초로 줄였습니다.
입사 후에는 결제 승인 과정의 장애 대응 시간을 줄이는 데 기여하고 싶습니다.`;

const SAMPLE='comparison';
// 기존 데이터는 그대로 두고 비교 연습용 지원 건을 하나 추가한다. 이미 있으면 다시 만들지 않는다.
export function addComparisonSample(store){
 const existing=store.applications.find(a=>a.sample===SAMPLE);
 if(existing)return {store,applicationId:existing.id,questionId:existing.questions[0].id};
 let q=createQuestion(prompt,700);const main=q.branches[0].id;q.branches[0].name='직접 고친 안';
 q=updateDraft(q,main,firstDraft);q=snapshot(q,main,'첫 초안','처음 쓴 초안');
 q=updateDraft(q,main,polished);q=snapshot(q,main,'표현 다듬기','도입 순서를 바꾸고 수치를 넣음');
 q=updateDraft(q,main,revised);q=snapshot(q,main,'결론 보강','경험 한 문장 추가, 마지막 문장을 계획으로 바꿈');
 const base=q.snapshots.at(-1).id;
 for(const [name,description,text,title] of [['AI 첨삭 반영','AI가 표현을 다듬은 안',aiSuggestion,'AI 첨삭'],['500자 버전','글자 수 제한에 맞춰 줄인 안',shortened,'500자로 줄임']]){
  q=branchFrom(q,base,name,description);const id=q.branches.at(-1).id;q=updateDraft(q,id,text);q=snapshot(q,id,title);
 }
 q.activeBranchId=main;
 q.messages=[{id:uid('message'),role:'assistant',text:'전체 흐름은 좋습니다. 지원 동기에 본인이 맡고 싶은 역할을 드러내고, 개선 효과를 비율로도 적어 보세요. 마지막 목표에는 기간을 넣으면 더 구체적입니다.',candidate:aiSuggestion,baseText:revised,createdAt:new Date().toISOString()}];
 const application={...createApplication({company:'루트페이',role:'결제 플랫폼 개발 · 비교 연습',status:'관심'}),questions:[q],example:true,sample:SAMPLE};
 return {store:{...store,applications:[...store.applications,application]},applicationId:application.id,questionId:q.id};
}
