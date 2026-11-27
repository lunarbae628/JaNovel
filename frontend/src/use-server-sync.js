import {useCallback, useEffect, useRef, useState} from 'react';
import {serverRequest} from './server-api.js';
import {applyServerDetail, detailsToFetch, mergeServerList, needsPush, pushApplication, serverFields} from './server-sync.js';

const PUSH_DELAY = 700;

// 지원 건과 문항을 서버와 맞춘다. 처음에 서버 목록을 받아 합치고, 그 뒤에는 바뀐 지원 건을 입력이 멈춘 뒤 보낸다.
// 예시 지원 건은 올리지 않는다. 서버에 못 붙으면 브라우저 저장은 그대로 하고 다시 시도할 수 있게 한다.
export function useServerSync({store, setStore, enabled}) {
  const [sync, setSync] = useState({phase: 'loading', conflicts: [], error: ''});
  const storeRef = useRef(store);
  storeRef.current = store;
  const conflictsRef = useRef(new Set());
  const failed = useRef(new Map());
  const running = useRef(false);
  const again = useRef(false);

  // 화면 상태와 진행 중인 동기화가 같은 값을 보도록 storeRef에도 바로 반영한다.
  const update = useCallback(change => {
    storeRef.current = change(storeRef.current);
    setStore(change);
  }, [setStore]);
  const setServer = useCallback((id, server) => update(previous => ({...previous,
    applications: previous.applications.map(item => item.id === id ? {...item, server} : item)})), [update]);
  const setConflicts = ids => {
    conflictsRef.current = new Set(ids);
    setSync(current => ({...current, conflicts: [...conflictsRef.current]}));
  };

  const push = useCallback(async send => {
    for (const id of storeRef.current.serverDeletes || []) {
      try { await send('DELETE', '/api/applications/' + id); } catch (error) { if (error.status !== 404) throw error; }
      update(previous => ({...previous, serverDeletes: (previous.serverDeletes || []).filter(item => item !== id)}));
    }
    let error = '';
    for (const application of storeRef.current.applications) {
      if (application.example || conflictsRef.current.has(application.id) || !needsPush(application)) continue;
      const key = JSON.stringify(serverFields(application));
      if (failed.current.get(application.id) === key) { error ||= failed.current.get(application.id + ':message'); continue; }
      try {
        setServer(application.id, await pushApplication(application, send));
        failed.current.delete(application.id);
      } catch (cause) {
        if (cause.server !== undefined) setServer(application.id, cause.server);
        if (cause.status === 409) setConflicts([...conflictsRef.current, application.id]);
        else if (cause.status === 404) { setServer(application.id, undefined); again.current = true; }
        else if (!cause.status || cause.status >= 500) throw cause;
        else {
          failed.current.set(application.id, key);
          failed.current.set(application.id + ':message', application.company + ': ' + cause.message);
          error ||= application.company + ': ' + cause.message;
        }
      }
    }
    setSync(current => ({...current, phase: 'ready', error}));
  }, [update, setServer]);

  const pull = useCallback(async send => {
    const {body: summaries} = await send('GET', '/api/applications');
    const ids = detailsToFetch(storeRef.current.applications, summaries);
    const details = new Map(await Promise.all(ids.map(async id => [id, (await send('GET', '/api/applications/' + id)).body])));
    const {conflicts} = mergeServerList(storeRef.current.applications, summaries, details);
    update(previous => ({...previous, applications: mergeServerList(previous.applications, summaries, details).applications}));
    setConflicts(conflicts);
  }, [update]);

  // 충돌 다시 받기·목록 받기·보내기 요청을 모아 한 번에 하나씩 처리한다. 처리 중에 들어온 요청은 끝난 뒤 이어서 한다.
  const reload = useCallback(async send => {
    for (const id of [...conflictsRef.current]) {
      const application = storeRef.current.applications.find(item => item.id === id);
      if (application?.server) {
        try {
          const {body} = await send('GET', '/api/applications/' + application.server.id);
          update(previous => ({...previous, applications: previous.applications.map(item => item.id === id
            ? applyServerDetail(body, item) : item)}));
        } catch (error) {
          if (error.status !== 404) throw error;
          setServer(id, undefined);
        }
      }
      setConflicts([...conflictsRef.current].filter(item => item !== id));
    }
  }, [update, setServer]);

  const wanted = useRef({reload: false, pull: false});
  const run = useCallback(async ({reload: reloading = false, pull: pulling = false} = {}) => {
    wanted.current = {reload: wanted.current.reload || reloading, pull: wanted.current.pull || pulling};
    again.current = true;
    if (running.current) return;
    running.current = true;
    try {
      while (again.current) {
        const work = wanted.current;
        wanted.current = {reload: false, pull: false};
        again.current = false;
        const send = serverRequest(storeRef.current.profile);
        try {
          if (work.reload) await reload(send);
          if (work.pull) await pull(send);
          await push(send);
        } catch {
          setSync(current => ({...current, phase: 'offline'}));
          break;
        }
      }
    } finally {
      running.current = false;
    }
  }, [pull, push, reload]);

  const ready = sync.phase === 'ready';
  useEffect(() => { if (enabled) run({pull: true}); }, [enabled, run]);
  useEffect(() => {
    if (!enabled || !ready) return;
    const timer = setTimeout(() => run(), PUSH_DELAY);
    return () => clearTimeout(timer);
  }, [enabled, ready, store.applications, store.serverDeletes, run]);

  const retry = useCallback(() => run({pull: true}), [run]);
  // 충돌한 지원 건은 서버의 최신 내용으로 바꾼다. 브라우저에서 고친 공고 정보와 문항 변경은 버린다.
  const reloadConflicts = useCallback(() => run({reload: true}), [run]);

  return {...sync, retry, reloadConflicts};
}
