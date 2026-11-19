import {isInterview} from './interview.js';
import {isScheduleItem} from './schedule.js';
const previousColors=['#2563EB','#D97706','#7C3AED','#0D9488','#DB2777','#6A7F16','#0891B2','#9A3412'];
export const colors=['#274690','#39816F','#A4753E','#8869A4','#63758C','#657D55','#4B7E97','#9B5E77'];
export function branchColor(b){if(!previousColors.includes(b.color)&&!colors.includes(b.color))return b.color;return colors[b.order]||`hsl(${Math.round(b.order*137.508)%360} 30% 44%)`;}

export const uid=(prefix='id')=>prefix+'-'+crypto.randomUUID();
const now=()=>new Date().toISOString();
const clone=value=>structuredClone(value);
const fail=message=>{throw new Error(message)};
const branch=(q,id)=>q.branches.find(b=>b.id===id)||fail('BRANCH_NOT_FOUND');
const commit=(q,id)=>q.snapshots.find(s=>s.id===id)||fail('SNAPSHOT_NOT_FOUND');
export const recordKey=r=>r.kind+':'+r.id;
export function parseKey(key){if(typeof key==='object')return key;const cut=key.indexOf(':');return cut<0?{kind:'snapshot',id:key}:{kind:key.slice(0,cut),id:key.slice(cut+1)};}
export function resolveRecord(q,key){const r=parseKey(key);if(r.kind==='draft'){const b=branch(q,r.id);return {...b.draft,id:b.id,kind:'draft',branchId:b.id,label:b.draft.closed||!b.draft.dirty?'마지막 본문':'작성 중',title:b.name,parentIds:b.draft.baseIds};}const s=commit(q,r.id);return {...s,kind:'snapshot'};}
export function createQuestion(prompt='새 문항',limit=1000){const id=uid('branch');return{id:uid('question'),prompt,limit:Number(limit)||1000,snapshots:[],branches:[{id,name:'기본',color:colors[0],order:0,createdAt:now(),snapshotIds:[],fromIds:[],draft:{text:'',baseIds:[],dirty:false,closed:true,updatedAt:now()}}],messages:[]};}
export function updateDraft(question,branchId,text){
 const q=clone(question),b=branch(q,branchId),base=b.draft.baseIds.length===1?q.snapshots.find(s=>s.id===b.draft.baseIds[0]):null;
 const dirty=text!==(base?.text||'')||(b.snapshotIds.length>0&&b.snapshotIds.at(-1)!==base?.id);
 b.draft={...b.draft,text,closed:!dirty,dirty,updatedAt:now()};
 if(!dirty&&b.autoFromId&&!b.snapshotIds.length){const origin=commit(q,b.autoFromId);q.branches=q.branches.filter(n=>n.id!==b.id);if(q.activeBranchId===b.id)q.activeBranchId=origin.branchId;}
 return q;
}
export function snapshot(question,branchId,title='',description=''){const q=clone(question),b=branch(q,branchId);if(!b.draft.text.trim())fail('EMPTY_TEXT');if(b.snapshotIds.length&&!b.draft.dirty&&b.draft.baseIds.length===1)fail('NO_CHANGES');const order=Math.max(-1,...q.snapshots.map(s=>s.order))+1;const s={id:uid('snapshot'),branchId,label:'v'+(order+1),title:title.trim()||'스냅샷 '+(order+1),description:description.trim(),text:b.draft.text,parentIds:[...new Set(b.draft.baseIds)],createdAt:now(),order};q.snapshots.push(s);b.snapshotIds.push(s.id);b.draft={text:s.text,baseIds:[s.id],dirty:false,closed:true,updatedAt:now()};delete b.autoFromId;return q;}
export function uniqueBranchName(q,name){const base=(name.trim()||'새 분기').slice(0,90);let title=base,n=2;while(q.branches.some(b=>b.name===title))title=base+' '+n++;return title;}
export function branchFrom(question,snapshotId,name='',description=''){const q=clone(question),s=commit(q,snapshotId),order=Math.max(-1,...q.branches.map(b=>b.order))+1;q.branches.push({id:uid('branch'),name:uniqueBranchName(q,name||s.label+'에서 시작'),description,color:colors[order%colors.length],order,createdAt:now(),snapshotIds:[],fromIds:[s.id],draft:{text:s.text,baseIds:[s.id],dirty:false,closed:true,updatedAt:now()}});return q;}
export function editSnapshot(question,snapshotId,text,{forceBranch=false}={}){const source=commit(question,snapshotId);if(source.text===text)return{question,branchId:source.branchId,changed:false};const b=branch(question,source.branchId),latest=b.snapshotIds.at(-1)===snapshotId;if(latest&&!forceBranch){if(b.draft.dirty&&b.draft.text!==text)fail('DRAFT_CONFLICT');return{question:updateDraft(question,b.id,text),branchId:b.id,changed:true};}let q=branchFrom(question,snapshotId);const created=q.branches.at(-1);created.autoFromId=source.id;q=updateDraft(q,created.id,text);return{question:q,branchId:created.id,changed:true};}
function capture(question,key){const r=parseKey(key);if(r.kind==='snapshot')return{question,id:commit(question,r.id).id};const b=branch(question,r.id);if(!b.draft.dirty&&b.draft.baseIds.length===1&&b.snapshotIds.at(-1)===b.draft.baseIds[0])return{question,id:b.draft.baseIds[0]};const q=snapshot(question,b.id,'병합 전 초안');return{question:q,id:q.snapshots.at(-1).id};}
export function mergeDraft(question,{leftId,rightId,text,name='병합안',description='',mode='new',branchId,overwrite=false}){if(!text.trim())fail('EMPTY_TEXT');let q=clone(question);if(mode==='existing'){const b=branch(q,branchId);if(b.draft.dirty&&!overwrite)fail('DRAFT_CONFLICT');}const a=capture(q,leftId);q=a.question;const b=capture(q,rightId);q=b.question;const fromId=resolveRecord(q,rightId).branchId;if(mode!=='existing'||fromId!==branchId){const from=branch(q,fromId);if(from.draft.dirty&&from.draft.text.trim())q=snapshot(q,fromId,'병합 후 원본 초안');branch(q,fromId).draft.closed=true;}const parents=[...new Set([a.id,b.id])];let target;if(mode==='existing')target=branch(q,branchId);else{const order=Math.max(-1,...q.branches.map(b=>b.order))+1;target={id:uid('branch'),name:uniqueBranchName(q,name),description,order,color:colors[order%colors.length],createdAt:now(),snapshotIds:[],fromIds:parents,draft:{}};q.branches.push(target);}target.draft={text,baseIds:parents,dirty:true,updatedAt:now()};q.activeBranchId=target.id;q=snapshot(q,target.id,name,description);return{question:q,branchId:target.id,snapshotId:q.snapshots.at(-1).id};}
export function freezeSubmission(application,selections,name='제출본'){return{id:uid('submission'),name:name.trim()||'제출본',createdAt:now(),submitted:false,answers:application.questions.map(q=>{if(!selections[q.id])fail('SELECTION_REQUIRED');const r=resolveRecord(q,selections[q.id]);if(!r.text.trim())fail('EMPTY_TEXT');return{questionId:q.id,prompt:q.prompt,limit:q.limit,source:parseKey(selections[q.id]),label:r.label+' · '+r.title,text:r.text};})};}
export function graphRecords(q){const rows=q.snapshots.map(s=>({...s,kind:'snapshot',key:'snapshot:'+s.id}));for(const b of q.branches)rows.push({...b.draft,id:b.id,key:'draft:'+b.id,kind:'draft',branchId:b.id,label:b.draft.closed||!b.draft.dirty?'마지막 본문':'작성 중',title:b.name,parentIds:b.draft.baseIds,createdAt:b.draft.updatedAt,order:1e6+b.order});const byId=new Map(rows.filter(n=>n.kind==='snapshot').map(n=>[n.id,n]));for(const r of rows)for(const p of r.parentIds)if(!byId.has(p))fail('INVALID_GRAPH');const done=new Set(),out=[];while(out.length<rows.length){const ready=rows.filter(n=>!done.has(n.key)&&n.parentIds.every(id=>done.has('snapshot:'+id))).sort((a,b)=>a.order-b.order);if(!ready.length)fail('INVALID_GRAPH');for(const r of ready){out.push(r);done.add(r.key);}}return out;}
export function validateStore(data){
 const check=value=>{if(!value)fail('INVALID_BACKUP')};
 const str=value=>typeof value==='string';
 const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
 const list=value=>Array.isArray(value);
 const limit=value=>Number.isInteger(value)&&value>0&&value<=100000;
 const date=value=>str(value)&&(!value||(/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value));
 const time=value=>str(value)&&(!value||/^([01]\d|2[0-3]):[0-5]\d$/.test(value));
 const unique=items=>new Set(items).size===items.length;
 const refs=(value,ids)=>list(value)&&unique(value)&&value.every(id=>str(id)&&ids.has(id));
 check(object(data)&&data.version===1&&list(data.applications));
 check(unique(data.applications.map(a=>a?.id)));
 if(data.preferences){check(object(data.preferences));for(const k of ['leftWidth','rightWidth'])if(data.preferences[k]!==undefined)check(Number.isFinite(data.preferences[k])&&data.preferences[k]>=100&&data.preferences[k]<=1000);}
 if(data.profile)check(object(data.profile)&&str(data.profile.name)&&(!data.profile.email||str(data.profile.email)));
 if(data.scheduleItems!==undefined)check(list(data.scheduleItems)&&data.scheduleItems.every(isScheduleItem)&&unique(data.scheduleItems.map(item=>item.id)));
 for(const a of data.applications){
  check(object(a)&&str(a.id)&&a.id&&str(a.company)&&str(a.role)&&str(a.url)&&str(a.duties)&&str(a.requirements)&&str(a.status)&&date(a.deadline)&&time(a.deadlineTime)&&list(a.questions)&&a.questions.length>0&&list(a.events)&&list(a.stages)&&a.stages.every(str)&&list(a.submissions));
  if(a.interview!==undefined)check(isInterview(a.interview));
  check(unique(a.questions.map(q=>q?.id))&&unique(a.events.map(e=>e?.id))&&unique(a.submissions.map(s=>s?.id)));
  for(const e of a.events)check(object(e)&&str(e.id)&&str(e.title)&&str(e.type)&&date(e.date)&&time(e.time)&&str(e.note));
  for(const submission of a.submissions){
   check(object(submission)&&str(submission.id)&&str(submission.name)&&str(submission.createdAt)&&!Number.isNaN(Date.parse(submission.createdAt))&&typeof submission.submitted==='boolean'&&list(submission.answers)&&submission.answers.length>0);
   check(unique(submission.answers.map(n=>n?.questionId)));
   for(const answer of submission.answers)check(object(answer)&&str(answer.questionId)&&str(answer.prompt)&&limit(answer.limit)&&str(answer.label)&&str(answer.text)&&object(answer.source)&&['draft','snapshot'].includes(answer.source.kind)&&str(answer.source.id));
  }
  for(const q of a.questions){
   check(object(q)&&str(q.id)&&q.id&&str(q.prompt)&&limit(q.limit)&&list(q.branches)&&q.branches.length>0&&list(q.snapshots)&&list(q.messages));
   check(unique(q.snapshots.map(s=>s?.id))&&unique(q.branches.map(b=>b?.id))&&unique(q.messages.map(m=>m?.id)));
   const snapshots=new Set(q.snapshots.map(s=>s.id)),branches=new Set(q.branches.map(b=>b.id));
   if(q.activeBranchId!==undefined)check(str(q.activeBranchId)&&branches.has(q.activeBranchId));
   for(const s of q.snapshots)check(object(s)&&str(s.id)&&s.id&&str(s.text)&&str(s.title)&&str(s.description)&&str(s.label)&&Number.isFinite(s.order)&&branches.has(s.branchId)&&refs(s.parentIds,snapshots));
   const owned=[];
   for(const b of q.branches){
    check(object(b)&&str(b.id)&&b.id&&str(b.name)&&/^#[0-9a-f]{6}$/i.test(b.color)&&Number.isFinite(b.order)&&object(b.draft)&&str(b.draft.text)&&typeof b.draft.dirty==='boolean'&&refs(b.snapshotIds,snapshots)&&refs(b.fromIds,snapshots)&&refs(b.draft.baseIds,snapshots));
    if(b.draft.closed!==undefined)check(typeof b.draft.closed==='boolean');
    if(b.autoFromId!==undefined)check(str(b.autoFromId)&&snapshots.has(b.autoFromId)&&b.snapshotIds.length===0);
    if(b.sources!==undefined)check(list(b.sources)&&b.sources.every(s=>object(s)&&['optionId','optionName','recordKey','label','title','text'].every(k=>str(s[k]))));
    check(b.snapshotIds.every(id=>q.snapshots.find(s=>s.id===id).branchId===b.id));owned.push(...b.snapshotIds);
   }
   check(owned.length===q.snapshots.length&&unique(owned));
   for(const m of q.messages)check(object(m)&&str(m.id)&&['user','assistant'].includes(m.role)&&str(m.text)&&(m.candidate===undefined||str(m.candidate)));
   try{graphRecords(q)}catch{fail('INVALID_BACKUP')}
  }
 }
 return data;
}
export function importPostingText(text){const result={company:'',role:'',duties:'',requirements:'',deadline:'',stages:[],questions:[]};let section='',question=null;for(const raw of text.split('\n')){const line=raw.trim();if(!line)continue;const header=line.replace(/[\s:：]/g,'');if(/^(주요업무|담당업무|업무내용)$/.test(header)){section='duties';continue;}if(/^(자격요건|지원자격|필수요건)$/.test(header)){section='requirements';continue;}if(/^(자기소개서|자소서문항|자기소개서문항)$/.test(header)){section='questions';continue;}if(/^(채용절차|전형절차)$/.test(header)){section='stages';continue;}if(/^(우대사항|복리후생|지원방법|접수기간)/.test(header)){section='';}if(section==='questions'&&/^(?:Q?\d+[.)\s]|문항\s*\d)/i.test(line)){const limit=line.match(/([\d,]+)\s*자/);question={prompt:line.replace(/^Q?\d+[.)\s]+/i,'').replace(/\s*\([^)]*\d[\d,]*\s*자[^)]*\)/,'').trim(),limit:limit?Number(limit[1].replaceAll(',','')):1000};result.questions.push(question);}else if(section==='questions'&&question){question.prompt+=' '+line;}else if(section==='duties'||section==='requirements'){result[section]+=(result[section]?'\n':'')+line;}else if(section==='stages'){result.stages.push(...line.split(/\s*(?:→|>|›)\s*/).filter(Boolean));}const company=line.match(/^(?:회사명|기업명)\s*[:：]\s*(.+)/);if(company)result.company=company[1];const role=line.match(/^(?:직무|모집직무)\s*[:：]\s*(.+)/);if(role)result.role=role[1];const date=line.match(/(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/);if(date)result.deadline=[date[1],date[2].padStart(2,'0'),date[3].padStart(2,'0')].join('-');}return result;}
export function safeUrl(value){try{const u=new URL(value);return['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}}
export function errorMessage(error){return({SNAPSHOT_IN_USE:'이 기록 뒤에 이어진 기록이나 분기가 있어요. 끝 기록부터 삭제해 주세요.',LAST_BRANCH:'마지막 분기는 삭제할 수 없어요.',DRAFT_CONFLICT:'이미 작성 중인 초안이 있어요.',EMPTY_TEXT:'본문을 입력해 주세요.',NO_CHANGES:'이전 스냅샷과 달라진 내용이 없어요.',SELECTION_REQUIRED:'문항별 버전을 선택해 주세요.',INVALID_BACKUP:'지원하는 백업 형식이 아니거나 기록 연결이 손상됐어요.',INVALID_GRAPH:'기록 연결을 확인할 수 없어요.',BRANCH_NOT_FOUND:'분기를 찾을 수 없어요.',SNAPSHOT_NOT_FOUND:'기록을 찾을 수 없어요.'})[error.message]||'처리하지 못했어요. 입력한 내용을 확인해 주세요.';}
export function updateQuestion(store,applicationId,questionId,update){return{...store,applications:store.applications.map(a=>a.id===applicationId?{...a,questions:a.questions.map(q=>q.id===questionId?(typeof update==='function'?update(q):update):q)}:a)};}
export function activateBranch(question,branchId){branch(question,branchId);return {...question,activeBranchId:branchId};}
export function visibleGraphRecords(question){return graphRecords(question).filter(r=>r.kind!=='draft'||(r.dirty&&!r.closed));}
export function defaultRecordKey(question,branchId){const b=branch(question,branchId);if((b.draft.dirty&&!b.draft.closed)||!b.snapshotIds.length)return 'draft:'+b.id;const id=b.snapshotIds.at(-1)||b.draft.baseIds[0];return id?'snapshot:'+id:'draft:'+b.id;}
