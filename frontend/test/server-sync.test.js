import test from 'node:test';
import assert from 'node:assert/strict';
import {createApplication} from '../src/seed.js';
import {validateStore} from '../src/model.js';
import {applyServerDetail, detailsToFetch, mergeServerList, needsPush, progressOf, pushApplication} from '../src/server-sync.js';

// 서버 API를 흉내 낸다. 버전을 확인하고 올리며 받은 요청을 기록한다.
function fakeServer() {
  let nextId = 100;
  const apps = new Map();
  const calls = [];
  const detail = app => structuredClone(app);
  const send = async (method, path, body, version) => {
    calls.push({method, path, body, version});
    const [, , , id, kind, sub] = path.split('/');
    if (method === 'POST' && path === '/api/applications') {
      const app = {id: nextId++, version: 0, company: body.company, role: body.role, status: 'interested', currentStageId: null,
        deadline: body.deadline, sourceUrl: body.sourceUrl, sourceText: body.sourceText,
        sections: body.sections.map(section => ({id: nextId++, ...section})),
        stages: body.stages.map(name => ({id: nextId++, name})),
        questions: body.questions.map(question => ({id: nextId++, ...question})), lastQuestionId: null};
      apps.set(app.id, app);
      return {body: detail(app), version: 0};
    }
    const app = apps.get(Number(id));
    if (!app) throw Object.assign(new Error('없음'), {status: 404});
    if (method === 'GET') return {body: detail(app), version: app.version};
    if (version != null && version !== app.version) throw Object.assign(new Error('충돌'), {status: 409, code: 'APPLICATION_CONFLICT'});
    app.version++;
    let result = null;
    if (!kind) Object.assign(app, body);
    else if (kind === 'sections') app.sections = result = body.sections.map(section => ({id: nextId++, ...section}));
    else if (kind === 'stages') app.stages = result = body.stages.map(stage => ({id: stage.id ?? nextId++, name: stage.name}));
    else if (kind === 'progress') Object.assign(app, body);
    else if (kind === 'questions' && sub === 'order') app.questions = result = body.ids.map(qid => app.questions.find(q => q.id === qid));
    else if (kind === 'questions' && method === 'POST') { result = {id: nextId++, ...body}; app.questions.push(result); }
    else if (kind === 'questions' && method === 'PUT') { result = app.questions.find(q => q.id === Number(sub)); Object.assign(result, body); }
    else if (kind === 'questions' && method === 'DELETE') app.questions = app.questions.filter(q => q.id !== Number(sub));
    return {body: structuredClone(result ?? app), version: app.version};
  };
  return {apps, calls, send};
}

const application = () => createApplication({company: '예시 회사', role: '백엔드', deadline: '2026-12-16', deadlineTime: '23:59',
  stages: ['서류 전형', '면접'], status: '관심', questions: [{prompt: '지원 동기', limit: 500}, {prompt: '협업 경험', limit: 700}]});

test('처음 올리는 지원 건은 한 번에 등록하고 문항 번호를 짝지어 둔다', async () => {
  const server = fakeServer();
  const local = application();
  const meta = await pushApplication(local, server.send);
  assert.equal(server.calls.length, 1);
  assert.equal(server.calls[0].body.deadline.kind, 'fixed');
  assert.deepEqual(Object.keys(meta.questions), local.questions.map(question => question.id));
  assert.equal(needsPush({...local, server: meta}), false);
});

test('지원 단계가 전형이면 전형 등록 뒤 그 전형 번호로 진행 상태를 보낸다', async () => {
  const server = fakeServer();
  const meta = await pushApplication({...application(), status: '면접'}, server.send);
  const app = server.apps.get(meta.id);
  assert.equal(app.status, 'in_progress');
  assert.equal(app.currentStageId, app.stages[1].id);
});

test('바꾼 부분만 버전을 붙여 보내고 응답 버전을 이어 쓴다', async () => {
  const server = fakeServer();
  let local = application();
  local = {...local, server: await pushApplication(local, server.send)};
  server.calls.length = 0;
  local = {...local, company: '바꾼 회사', questions: [{...local.questions[1], prompt: '협업 경험을 쓰세요'}, local.questions[0]]};
  const meta = await pushApplication(local, server.send);
  assert.deepEqual(server.calls.map(call => call.method + ' ' + call.path.split('/').slice(4).join('/')),
    ['PUT ', 'PUT questions/' + local.server.questions[local.questions[0].id], 'PUT questions/order']);
  assert.deepEqual(server.calls.map(call => call.version), [0, 1, 2]);
  assert.equal(meta.version, 3);
  const app = server.apps.get(meta.id);
  assert.equal(app.company, '바꾼 회사');
  assert.deepEqual(app.questions.map(question => question.prompt), ['협업 경험을 쓰세요', '지원 동기']);
});

test('문항 추가·삭제와 전형 이름 변경을 서버에 반영하고 남은 전형 번호는 유지한다', async () => {
  const server = fakeServer();
  let local = application();
  local = {...local, server: await pushApplication(local, server.send)};
  const keptStage = local.server.stageIds[0];
  const added = createApplication({company: 'x', role: 'y', questions: [{prompt: '입사 후 포부', limit: 300}]}).questions[0];
  local = {...local, stages: ['서류 전형', '임원 면접'], questions: [local.questions[1], added]};
  const meta = await pushApplication(local, server.send);
  const app = server.apps.get(meta.id);
  assert.equal(app.stages[0].id, keptStage);
  assert.deepEqual(app.stages.map(stage => stage.name), ['서류 전형', '임원 면접']);
  assert.deepEqual(app.questions.map(question => question.prompt), ['협업 경험', '입사 후 포부']);
  assert.equal(meta.questions[added.id], app.questions[1].id);
  assert.equal(needsPush({...local, server: meta}), false);
});

test('다른 곳에서 먼저 바뀌면 409를 던지고 그때까지 반영한 상태를 돌려준다', async () => {
  const server = fakeServer();
  let local = application();
  local = {...local, server: await pushApplication(local, server.send)};
  server.apps.get(local.server.id).version = 7;
  await assert.rejects(pushApplication({...local, role: '서버'}, server.send), error => {
    assert.equal(error.status, 409);
    assert.equal(error.server.version, 0);
    return true;
  });
});

test('중간 요청이 실패해도 앞서 반영한 부분과 버전은 남겨 다음 시도가 충돌하지 않는다', async () => {
  const server = fakeServer();
  let local = application();
  local = {...local, server: await pushApplication(local, server.send)};
  const failing = async (method, path, body, version) => {
    if (path.endsWith('/sections')) throw Object.assign(new Error('끊김'), {status: undefined});
    return server.send(method, path, body, version);
  };
  local = {...local, company: '바꾼 회사', sections: [{id: 's', title: '업무', body: 'API'}]};
  let partial;
  await assert.rejects(pushApplication(local, failing), error => { partial = error.server; return true; });
  assert.equal(partial.version, 1);
  assert.equal(partial.synced.company, '바꾼 회사');
  server.calls.length = 0;
  await pushApplication({...local, server: partial}, server.send);
  assert.deepEqual(server.calls.map(call => call.path.split('/').at(-1)), ['sections']);
});

test('서버 상세를 덮어도 일정과 작성 이력은 남기고 결과 단계 이름은 브라우저 것을 쓴다', async () => {
  const server = fakeServer();
  let local = {...application(), status: '최종 합격'};
  local.events.push({id: 'e', title: '면접', type: '면접', date: '2026-12-20', time: '', note: ''});
  local = {...local, server: await pushApplication(local, server.send)};
  const app = server.apps.get(local.server.id);
  assert.equal(app.status, 'closed');
  app.company = '다른 기기에서 바꾼 회사';
  app.version = 5;
  const merged = applyServerDetail(structuredClone(app), local);
  assert.equal(merged.company, '다른 기기에서 바꾼 회사');
  assert.equal(merged.status, '최종 합격');
  assert.equal(merged.events.length, 1);
  assert.equal(merged.questions[0].branches, local.questions[0].branches);
  assert.equal(merged.server.version, 5);
  assert.equal(needsPush(merged), false);
  assert.doesNotThrow(() => validateStore({version: 1, applications: [merged], serverDeletes: [3]}));
});

test('목록을 합칠 때 브라우저에서 고친 지원 건의 서버 버전이 바뀌었으면 충돌로 남긴다', async () => {
  const server = fakeServer();
  const make = async () => { const local = application(); return {...local, server: await pushApplication(local, server.send)}; };
  const clean = await make(), edited = await make(), removed = await make();
  const unsynced = application();
  for (const id of [clean.server.id, edited.server.id]) server.apps.get(id).version = 4;
  server.apps.delete(removed.server.id);
  const outside = (await server.send('POST', '/api/applications', {company: '새 회사', role: '프론트', sections: [], stages: [],
    questions: [{prompt: '자기소개', limit: null}]})).body;
  const locals = [clean, {...edited, role: '고친 직무'}, removed, unsynced];
  const summaries = [...server.apps.values()].map(app => ({id: app.id, version: app.version}));
  const ids = detailsToFetch(locals, summaries);
  assert.deepEqual(ids.sort(), [clean.server.id, outside.id].sort());
  const details = new Map(ids.map(id => [id, structuredClone(server.apps.get(id))]));
  const {applications, conflicts} = mergeServerList(locals, summaries, details);
  assert.deepEqual(conflicts, [edited.id]);
  assert.equal(applications.find(item => item.id === clean.id).server.version, 4);
  assert.equal(applications.some(item => item.id === removed.id), false);
  assert.ok(applications.some(item => item.id === unsynced.id));
  const received = applications.find(item => item.server?.id === outside.id);
  assert.equal(received.questions[0].prompt, '자기소개');
  assert.equal(received.questions[0].limit, 1000);
});

test('지원 단계를 서버 상태로 바꾼다', () => {
  assert.deepEqual(progressOf('작성 중', [], []), {status: 'writing', currentStageId: null});
  assert.deepEqual(progressOf('불합격', ['서류'], [1]), {status: 'closed', currentStageId: null});
  assert.deepEqual(progressOf('서류', ['서류'], [9]), {status: 'in_progress', currentStageId: 9});
  assert.deepEqual(progressOf('없는 단계', ['서류'], [9]), {status: 'interested', currentStageId: null});
});
