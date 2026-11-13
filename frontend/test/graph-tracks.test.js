import test from 'node:test';
import assert from 'node:assert/strict';
import * as tracks from '../src/graph-tracks.js';

test('병합 선이 겹치기 시작하는 지점부터 결과 색을 사용한다',()=>{
 const parents=[{x:16,y:16,color:'#274690'},{x:58,y:144,color:'#8869A4'}],target={x:72,y:240,color:'#63758C'};
 const before=structuredClone(parents),result=tracks.historyTracks(parents,target);
 assert.deepEqual(result.incoming.map(p=>p.color),parents.map(p=>p.color));
 assert.ok(result.incoming.every(p=>p.d.endsWith('V 160')));
 assert.deepEqual(result.shared,{d:'M 72 160 V 240',color:'#63758C'});
 assert.deepEqual(parents,before);
});
test('일반 분기 경로와 색은 그대로 유지한다',()=>{
 const result=tracks.historyTracks([{x:16,y:16,color:'#274690'}],{x:30,y:80,color:'#39816F'});
 assert.deepEqual(result,{incoming:[{d:'M 16 16 L 30 32 V 80',color:'#39816F'}],shared:null});
});
test('지도형에서도 두 선이 만난 뒤 공통 선만 결과 색으로 이어진다',()=>{
 const result=tracks.historyTracks([{x:28,y:18,color:'#274690'},{x:88,y:94,color:'#39816F'}],{x:148,y:246,color:'#A4753E'},true);
 assert.ok(result.incoming.every(p=>p.d.endsWith('V 134')));
 assert.deepEqual(result.shared,{d:'M 148 134 V 246',color:'#A4753E'});
});
