// Alternative design fixtures. The accepted current model stays separate from Docsa semantics.
export const currentRecords=[['v1','첫 초안',0,0,[]],['v2','경험 구체화',0,1,['v1']],['v2-A','다른 도입',1,1,['v1']],['v2-B','사례 중심',2,1,['v1']],['v3','직무 연결',0,2,['v2']],['v3-A','문장 정리',1,2,['v2-A']],['v3-B','성과 보강',2,2,['v2-B']],['v4','두 초안 병합',0,3,['v3','v3-A']],['draft-a','다른 도입',1,3,['v3-A']],['draft-b','사례 중심',2,3,['v3-B']],['draft','기본 흐름',0,4,['v4']]];
export const branchNames=['기본 흐름','다른 도입','사례 중심','병합안','다시 병합','새 분기'];
export function mergeRecords(mode='current',phase='snapshot',example='normal'){
 if(mode==='current')return currentRecords;
 const snapshots=currentRecords.filter(n=>!n[0].startsWith('draft')&&n[0]!=='v4');
 const parents=example==='same'?['v1','v3']:['v3','v3-A'];
 const result=phase==='snapshot'?[['v4','병합안 첫 스냅샷',3,3,parents]]:[];
 const drafts=[['draft','기본 흐름',0,3,['v3']],['draft-a','다른 도입',1,3,['v3-A']],['draft-b','사례 중심',2,3,['v3-B']],['draft-merge','병합안',3,phase==='snapshot'?4:3,phase==='snapshot'?['v4']:parents]];
 if(example==='repeated'&&phase==='snapshot')result.push(['v5','두 번째 병합 스냅샷',4,4,['v4','v3-B']]);
 if(example==='repeated'&&phase==='snapshot')drafts.push(['draft-again','다시 병합',4,5,['v5']]);
 if(example==='empty')drafts.push(['draft-new','새 분기',5,1,['v1']]);
 return [...snapshots,...result,...drafts];
}
