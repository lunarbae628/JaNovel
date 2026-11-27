import {createQuestion, postingSections, uid} from './model.js';
import {createApplication} from './seed.js';

// 지원 건과 자소서 문항을 서버에 맞춘다. 화면은 지금처럼 브라우저에 둔 지원 건으로 바로 그리고,
// 서버가 저장하는 부분만 바뀌면 이 모듈이 요청을 정해 보낸다. 일정·제출본·면접 기록과 작성 이력은 아직 브라우저에만 있다.
//
// 지원 건의 server에는 서버와 마지막으로 맞춘 상태를 둔다.
//   {id, version, stageIds, questions:{로컬 문항 id: 서버 문항 id}, synced:serverFields 결과}
// synced와 지금 serverFields가 다르면 그 차이만 보낸다.

export const OUTCOME_STATUSES = ['최종 합격', '불합격', '지원 취소'];

// 서버가 저장하는 지원 건 내용. 문항은 로컬 id로 짝을 짓는다.
export function serverFields(application) {
  return {
    company: application.company.trim(),
    role: application.role.trim(),
    deadline: application.deadline ? {kind: 'fixed', date: application.deadline, time: application.deadlineTime || null} : null,
    sourceUrl: application.url || null,
    sourceText: application.sourceText || null,
    sections: postingSections(application).map(({title, body}) => ({title, body})),
    stages: [...application.stages],
    status: application.status,
    questions: application.questions.map(question => ({id: question.id, prompt: question.prompt, limit: question.limit ?? null})),
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const basicOf = fields => ({company: fields.company, role: fields.role, deadline: fields.deadline,
  sourceUrl: fields.sourceUrl, sourceText: fields.sourceText});

export function needsPush(application) {
  return !application.server || !same(application.server.synced, serverFields(application));
}

// 로컬 지원 단계를 서버 상태와 현재 전형으로 바꾼다. 결과(합격·불합격·취소)는 서버에서 모두 closed다.
export function progressOf(status, stages, stageIds) {
  if (status === '관심') return {status: 'interested', currentStageId: null};
  if (status === '작성 중') return {status: 'writing', currentStageId: null};
  if (OUTCOME_STATUSES.includes(status)) return {status: 'closed', currentStageId: null};
  const index = stages.indexOf(status);
  return index < 0 ? {status: 'interested', currentStageId: null} : {status: 'in_progress', currentStageId: stageIds[index]};
}

function localStatus(detail, local) {
  if (detail.status === 'interested') return '관심';
  if (detail.status === 'writing') return '작성 중';
  // 서버는 결과 이름을 따로 두지 않으므로 브라우저에 남은 결과 이름을 쓴다.
  if (detail.status === 'closed') return OUTCOME_STATUSES.includes(local?.status) ? local.status : '지원 취소';
  return detail.stages.find(stage => stage.id === detail.currentStageId)?.name || '작성 중';
}

// 서버 지원 건 상세를 브라우저 지원 건에 덮는다. 서버가 저장하지 않는 일정·작성 이력·면접 기록은 그대로 둔다.
export function applyServerDetail(detail, local) {
  const base = local || createApplication({company: detail.company, role: detail.role});
  const map = local?.server?.questions || {};
  const localIdOf = new Map(Object.entries(map).map(([localId, serverId]) => [serverId, localId]));
  const questionIds = {};
  const questions = detail.questions.map(item => {
    const existing = base.questions.find(question => question.id === localIdOf.get(item.id));
    const question = existing ? {...existing, prompt: item.prompt, limit: item.limit ?? existing.limit}
      : createQuestion(item.prompt, item.limit ?? 1000);
    questionIds[question.id] = item.id;
    return question;
  });
  const sections = detail.sections.map((section, index) => ({id: postingSections(base)[index]?.id || uid('section'),
    title: section.title, body: section.body}));
  const fixed = detail.deadline?.kind === 'fixed';
  const application = {
    ...base,
    company: detail.company,
    role: detail.role,
    url: detail.sourceUrl || '',
    sourceText: detail.sourceText || '',
    deadline: fixed ? detail.deadline.date : '',
    deadlineTime: fixed ? detail.deadline.time?.slice(0, 5) || '' : '',
    sections,
    stages: detail.stages.map(stage => stage.name),
    status: localStatus(detail, local),
    questions,
  };
  if (!fixed) delete application.deadlineDetails;
  return {...application, server: {id: detail.id, version: detail.version, stageIds: detail.stages.map(stage => stage.id),
    questions: questionIds, synced: serverFields(application)}};
}

export class SyncError extends Error {
  constructor(status, code, message, server) {
    super(message || code || 'SYNC_FAILED');
    this.status = status;
    this.code = code;
    this.server = server;
  }
}

// 바뀐 부분을 순서대로 보낸다. send(method, path, body, version)는 {body, version}을 돌려준다.
// 중간에 실패하면 그때까지 서버에 반영한 상태를 error.server에 담아 다음 시도가 이어서 보내게 한다.
export async function pushApplication(application, send) {
  const fields = serverFields(application);
  let server = application.server && structuredClone(application.server);
  const call = async (method, path, body) => {
    try {
      const result = await send(method, path, body, server?.version);
      if (server && result.version != null) server.version = result.version;
      return result.body;
    } catch (error) {
      throw new SyncError(error.status, error.code, error.message, server);
    }
  };

  if (!server) {
    const body = await call('POST', '/api/applications', {...basicOf(fields), sections: fields.sections, stages: fields.stages,
      questions: fields.questions.map(({prompt, limit}) => ({prompt, limit}))});
    const questions = Object.fromEntries(fields.questions.map((question, index) => [question.id, body.questions[index].id]));
    server = {id: body.id, version: body.version, stageIds: body.stages.map(stage => stage.id), questions,
      synced: {...fields, status: '관심'}};
  }
  const base = `/api/applications/${server.id}`;
  const synced = server.synced;

  if (!same(basicOf(synced), basicOf(fields))) {
    await call('PUT', base, basicOf(fields));
    Object.assign(synced, basicOf(fields));
  }
  if (!same(synced.sections, fields.sections)) {
    await call('PUT', base + '/sections', {sections: fields.sections});
    synced.sections = fields.sections;
  }
  const stagesChanged = !same(synced.stages, fields.stages);
  if (stagesChanged) {
    // 이름이 같은 전형은 번호를 이어 써서 서버의 현재 전형 선택과 기록을 지킨다.
    const unused = synced.stages.map((name, index) => ({name, id: server.stageIds[index]}));
    const stages = fields.stages.map(name => {
      const match = unused.findIndex(stage => stage.name === name);
      return {id: match < 0 ? null : unused.splice(match, 1)[0].id, name};
    });
    const body = await call('PUT', base + '/stages', {stages});
    server.stageIds = body.map(stage => stage.id);
    synced.stages = fields.stages;
  }

  const current = new Set(fields.questions.map(question => question.id));
  for (const question of synced.questions.filter(item => !current.has(item.id))) {
    const serverId = server.questions[question.id];
    if (serverId != null) await call('DELETE', `${base}/questions/${serverId}`);
    delete server.questions[question.id];
    synced.questions = synced.questions.filter(item => item.id !== question.id);
  }
  for (const question of fields.questions) {
    const previous = synced.questions.find(item => item.id === question.id);
    const input = {prompt: question.prompt, limit: question.limit};
    if (!previous || server.questions[question.id] == null) {
      const body = await call('POST', base + '/questions', input);
      server.questions[question.id] = body.id;
      synced.questions = [...synced.questions.filter(item => item.id !== question.id), question];
    } else if (!same({prompt: previous.prompt, limit: previous.limit}, input)) {
      await call('PUT', `${base}/questions/${server.questions[question.id]}`, input);
      synced.questions = synced.questions.map(item => item.id === question.id ? question : item);
    }
  }
  if (!same(synced.questions.map(item => item.id), fields.questions.map(item => item.id))) {
    await call('PUT', base + '/questions/order', {ids: fields.questions.map(question => server.questions[question.id])});
    synced.questions = fields.questions;
  }

  if (stagesChanged || synced.status !== fields.status) {
    await call('PUT', base + '/progress', progressOf(fields.status, fields.stages, server.stageIds));
    synced.status = fields.status;
  }
  server.synced = fields;
  return server;
}

// 서버 목록과 브라우저 지원 건을 맞춘다. 서버에서 받은 상세(details)로 덮을 지원 건과 새로 받을 지원 건을 정한다.
// 브라우저에서 고쳤는데 그 사이 서버 버전도 바뀐 지원 건은 conflicts로 돌려 사용자가 고르게 한다.
export function mergeServerList(applications, summaries, details) {
  const byServerId = new Map(summaries.map(summary => [summary.id, summary]));
  const conflicts = [];
  const known = new Set();
  const next = [];
  for (const application of applications) {
    const serverId = application.server?.id;
    if (serverId == null) { next.push(application); continue; }
    known.add(serverId);
    const summary = byServerId.get(serverId);
    if (!summary) {
      // 다른 곳에서 지웠다. 브라우저에서 고친 내용이 있으면 새 지원 건으로 다시 올리고, 없으면 따라 지운다.
      if (needsPush(application)) next.push({...application, server: undefined});
      continue;
    }
    if (summary.version === application.server.version) { next.push(application); continue; }
    if (needsPush(application)) { conflicts.push(application.id); next.push(application); continue; }
    next.push(details.has(serverId) ? applyServerDetail(details.get(serverId), application) : application);
  }
  for (const summary of summaries) {
    if (!known.has(summary.id) && details.has(summary.id)) next.push(applyServerDetail(details.get(summary.id)));
  }
  return {applications: next, conflicts};
}

// 서버 상세를 새로 받아야 하는 지원 건 번호. 버전이 바뀌었고 브라우저에서 고치지 않은 것과 처음 보는 것이다.
export function detailsToFetch(applications, summaries) {
  const local = new Map(applications.filter(item => item.server).map(item => [item.server.id, item]));
  return summaries.filter(summary => {
    const application = local.get(summary.id);
    return !application || (application.server.version !== summary.version && !needsPush(application));
  }).map(summary => summary.id);
}
