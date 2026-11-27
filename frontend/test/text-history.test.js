import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistory,recordText,undoText,redoText} from '../src/text-history.js';

test('연달아 입력한 글자는 한 번에 되돌리고, 잠시 멈춘 뒤 입력은 따로 되돌린다',()=>{
 let h=createHistory('');
 h=recordText(h,'가',{at:0});h=recordText(h,'가나',{at:300});h=recordText(h,'가나다',{at:600});
 h=recordText(h,'가나다 라',{at:3000});
 h=undoText(h);assert.equal(h.present,'가나다');
 h=undoText(h);assert.equal(h.present,'');
 assert.equal(undoText(h),h);
});

test('AI 적용처럼 한 번에 바뀐 본문은 바로 앞 입력과 묶지 않는다',()=>{
 let h=createHistory('초안');
 h=recordText(h,'초안 수정',{at:0});
 h=recordText(h,'AI가 고친 본문',{at:100,kind:'apply'});
 h=undoText(h);assert.equal(h.present,'초안 수정');
});

test('되돌린 뒤 다시 실행하면 앞으로 돌아가고, 새로 입력하면 다시 실행 기록은 사라진다',()=>{
 let h=createHistory('a');
 h=recordText(h,'b',{at:0,kind:'apply'});h=recordText(h,'c',{at:5000,kind:'apply'});
 h=undoText(undoText(h));assert.equal(h.present,'a');
 h=redoText(h);assert.equal(h.present,'b');
 h=recordText(h,'d',{at:9000});
 assert.equal(redoText(h),h);
 assert.equal(undoText(h).present,'b');
});

test('같은 본문은 기록하지 않는다',()=>{
 const h=createHistory('같음');
 assert.equal(recordText(h,'같음',{at:0}),h);
});
