import test from 'node:test';
import assert from 'node:assert/strict';
import {branchColor} from '../src/model.js';

test('자동 분기 색은 기준 화면의 차분한 팔레트이며 사용자 색은 유지한다',()=>{
 assert.equal(branchColor({order:0,color:'#2563EB'}),'#274690');
 assert.equal(branchColor({order:1,color:'#39816F'}),'#39816F');
 assert.equal(branchColor({order:2,color:'#7C3AED'}),'#A4753E');
 assert.equal(branchColor({order:2,color:'#123456'}),'#123456');
});
