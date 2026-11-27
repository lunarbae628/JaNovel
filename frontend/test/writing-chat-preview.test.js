import test from 'node:test';
import assert from 'node:assert/strict';
import {previewAnswer} from '../src/writing-chat-preview.js';

test('예시 초안은 고른 경험의 상황·한 일·결과로 문단을 만든다',()=>{
 const answer=previewAnswer({kind:'draft',text:'',experiences:[
  {title:'재고 중복 배정 해결',text:'원문',facts:[{label:'상황',content:'같은 물품이 중복 배정됐어요.'},{label:'내가 한 일',content:'DB 조건부 UPDATE로 처리했어요.'},{label:'결과',content:'중복 배정 7건 → 0건'}]},
  {title:'사용해 본 기술',text:'Java, Spring Boot.'},
 ]});
 assert.match(answer.candidate,/같은 물품이 중복 배정됐어요\./);
 assert.match(answer.candidate,/중복 배정 7건 → 0건/);
 assert.match(answer.candidate,/Java, Spring Boot\./);
 assert.ok(answer.reply.trim());
});

test('예시 수정안은 지금 본문을 조금 고치고, 고칠 표현이 없으면 마지막에 문장을 더한다',()=>{
 const text='그래서 지원했습니다. 입사 후에는 장애 대응에 기여하고 싶습니다.';
 const answer=previewAnswer({kind:'chat',text});
 assert.notEqual(answer.candidate,text);
 assert.match(answer.candidate,/기여하겠습니다\./);
 assert.doesNotMatch(answer.candidate,/그래서/);
 const plain='짧은 본문입니다.';
 assert.ok(previewAnswer({kind:'chat',text:plain}).candidate.startsWith(plain));
 assert.equal(previewAnswer({kind:'chat',text:''}).candidate,'');
});
