import {essayTemplateAccessKey} from './essay-template.js';

// 서버 API를 부르는 함수를 만든다. 사용자는 공통 자소서와 같은 미리보기 접근 키로 구분한다.
// version이 있으면 If-Match로 보내고, 응답 ETag의 새 버전을 돌려준다. 실패하면 status·code를 담아 던진다.
export function serverRequest(profile) {
  return async (method, path, body, version) => {
    const headers = {Authorization: 'Bearer ' + essayTemplateAccessKey(profile)};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (version != null && method !== 'GET') headers['If-Match'] = '"' + version + '"';
    const response = await fetch(path, {method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store', signal: AbortSignal.timeout(10_000)});
    const tag = response.headers.get('ETag');
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) {
      const error = new Error(data?.message || 'SERVER_ERROR');
      error.status = response.status;
      error.code = data?.error;
      throw error;
    }
    return {body: data, version: tag ? Number(tag.replace(/\D/g, '')) : null};
  };
}
