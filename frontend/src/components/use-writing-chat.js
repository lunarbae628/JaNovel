import {useRef, useState} from 'react';
import {essayTemplateAccessKey} from '../essay-template.js';
import {postingSections, uid} from '../model.js';
import {previewAnswer} from '../writing-chat-preview.js';

// 실제 AI는 VITE_WRITING_AI=live로 켠다. 기본은 서버에 요청하지 않고 예시 응답으로 흐름만 보여 준다.
const LIVE = import.meta.env.VITE_WRITING_AI === 'live';

async function liveAnswer(payload, profile) {
  const response = await fetch('/api/me/writing-chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + essayTemplateAccessKey(profile)},
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(65_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result.reply !== 'string' || typeof result.candidate !== 'string') {
    throw new Error(result?.message || 'AI에 연결하지 못했어요. 다시 시도해 주세요.');
  }
  return result;
}

async function previewResult(request) {
  await new Promise(resolve => setTimeout(resolve, 900));
  return previewAnswer({kind: request.payload.kind, text: request.baseText, experiences: request.experiences});
}

function writingContext(application, question) {
  const posting = postingSections(application).filter(section => section.body.trim())
    .map(section => section.title + ': ' + section.body);
  const limit = question.limit == null ? '글자 수 제한 없음' : question.limit + '자 이내';
  return [
    '회사: ' + application.company,
    '직무: ' + application.role,
    ...posting,
    '문항: ' + question.prompt + ' (' + limit + ')',
  ].join('\n');
}

// 문항별 AI 채팅 요청. 본문 자리의 초안 만들기와 오른쪽 채팅이 같은 요청 상태를 함께 쓴다.
// 성공하면 요청과 응답을 문항 대화에 남기고 응답 메시지를 돌려준다. 실패하면 null을 돌려주고 failure에 남긴다.
export default function useWritingChat({question, application, record, profile, onSave}) {
  const [pending, setPending] = useState(null);
  const [failure, setFailure] = useState(null);
  const inFlight = useRef(false);

  async function send(request) {
    if (inFlight.current) return null;
    inFlight.current = true;
    setFailure(null);
    setPending(request);
    try {
      const result = LIVE ? await liveAnswer(request.payload, profile) : await previewResult(request);
      const assistant = {
        id: uid('message'), role: 'assistant', kind: request.payload.kind,
        text: result.reply, candidate: result.candidate, baseText: request.baseText,
        createdAt: new Date().toISOString(), ...(LIVE ? {} : {preview: true}),
      };
      onSave(current => ({...current, messages: [...current.messages, request.message, assistant]}));
      return assistant;
    } catch (error) {
      const message = error.name === 'TimeoutError' ? 'AI 응답이 지연됐어요. 다시 시도해 주세요.'
        : error instanceof TypeError ? 'AI에 연결하지 못했어요. 다시 시도해 주세요.' : error.message;
      setFailure({request, message});
      return null;
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  function requestAI(kind, text, request, context, experiences) {
    const history = question.messages.slice(-8).map(message => ({
      role: message.role,
      text: [message.text, message.candidate].filter(Boolean).join('\n\n').slice(0, 12_000),
    })).filter(message => message.text.trim());
    return send({
      payload: {kind, request, context, history},
      message: {
        id: uid('message'), role: 'user', kind, text,
        source: record.kind + ':' + record.id, createdAt: new Date().toISOString(),
      },
      baseText: record.text, experiences,
    });
  }

  function requestDraft(experiences) {
    const experienceText = experiences.map(item => item.title + '\n' + item.text).join('\n\n');
    return requestAI('draft', '초안 요청 · ' + experiences.map(item => item.title).join(', '),
      '선택한 경험으로 문항에 맞는 초안을 작성해 주세요.',
      writingContext(application, question) + '\n\n선택한 경험:\n' + experienceText, experiences);
  }

  function requestChat(input) {
    return requestAI('chat', input.trim(), input, writingContext(application, question) + '\n\n현재 본문:\n' + record.text);
  }

  return {pending, failure, retry: () => failure && send(failure.request), requestDraft, requestChat};
}
