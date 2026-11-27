import test from 'node:test';
import assert from 'node:assert/strict';
import {relatedExperiences} from '../src/experience-recommend.js';

const application={role:'결제 플랫폼 백엔드',sections:[{id:'s1',title:'주요 업무',body:'대규모 결제 트랜잭션의 정합성과 장애 대응'}]};
const question={prompt:'결제 서비스의 안정성을 높이기 위해 해결한 문제를 작성해 주세요.'};
const experiences=[
 {id:'a',title:'재고 중복 배정 해결',text:'동시 요청에서 재고 정합성 문제를 DB 조건부 UPDATE로 해결.'},
 {id:'b',title:'메일 발송 장애 격리',text:'외부 메일 API 장애를 비동기 큐와 재시도로 격리.'},
 {id:'c',title:'도서관 이용 안내 작성',text:'행사 안내문을 작성하고 질문을 받음.'},
];

test('추천 경험은 공고·문항과 관련 있는 경험만 점수순으로 고르고 추천한 이유를 함께 준다',()=>{
 const result=relatedExperiences(experiences,application,question);
 assert.deepEqual(result.map(item=>item.experience.id).sort(),['a','b']);
 const reasons=id=>result.find(item=>item.experience.id===id).reasons;
 assert.deepEqual(reasons('a'),['정합성']);
 assert.ok(reasons('b').includes('장애'));
 assert.ok(result.every(item=>item.reasons.length>=1&&item.reasons.length<=3));
});

test('추천 이유는 경험에 적힌 표기대로 보여 준다',()=>{
 const result=relatedExperiences([{id:'x',title:'명세 공유 개선',text:'OpenAPI 문서 자동 생성을 제안.'}],{role:'백엔드',sections:[]},{prompt:'openapi 명세로 협업한 경험'});
 assert.ok(result[0].reasons.includes('OpenAPI'));
});

test('추천 이유에는 어느 경험에나 나오는 기술명·직무명과 조사가 붙은 말을 쓰지 않는다',()=>{
 const result=relatedExperiences([
  {id:'tech',title:'사용해 본 기술',text:'Java, Spring Boot, API 개발.'},
  {id:'fix',title:'조회 개선',text:'느린 쿼리 문제를 인덱스로 해결.'},
 ],{role:'Spring 백엔드',sections:[{id:'s',title:'업무',body:'API 서버 개발과 쿼리 문제를 해결'}]},{prompt:'어려웠던 문제를 설명해 주세요.'});
 const reasons=id=>result.find(item=>item.experience.id===id)?.reasons;
 assert.deepEqual(reasons('tech'),[]);
 assert.deepEqual(reasons('fix'),['쿼리']);
});
