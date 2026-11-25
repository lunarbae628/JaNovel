import {createPostingQuestion} from './model.js';

export const ESSAY_TEMPLATE_ID = 'essay-template';

export function essayTemplateOwner(profile) {
  return typeof profile?.email === 'string' ? profile.email.trim().toLowerCase() : '';
}

export function getEssayTemplateQuestions(store, profile = store.profile) {
  const owner = essayTemplateOwner(profile);
  return store.essayTemplates && Object.hasOwn(store.essayTemplates, owner) ? store.essayTemplates[owner] : undefined;
}

export function createEssayTemplateQuestion(item) {
  return {...createPostingQuestion(item), templateLimit:item.limit ?? null};
}

export function essayTemplateItems(questions) {
  return questions.map(question => {
    const active = question.branches.find(branch => branch.id === question.activeBranchId) ?? question.branches[0];
    return {prompt:question.prompt, limit:question.templateLimit ?? null, draftBody:active.draft.text};
  });
}

export function appendEssayTemplate(questions, items) {
  const prompts = new Set(questions.map(question => question.prompt.trim()));
  const additions = [];
  for (const item of items) {
    const prompt = item.prompt.trim();
    if (!prompt || prompts.has(prompt)) continue;
    additions.push({...item, prompt, personalTemplate:true});
    prompts.add(prompt);
  }
  return additions.length ? [...questions.filter(question => question.id || question.prompt.trim()), ...additions] : questions;
}

export function essayTemplateAccessKey(profile, storage = localStorage) {
  const name = 'janovel.essay-template.access.' + essayTemplateOwner(profile);
  const saved = storage.getItem(name);
  if (saved) return saved;

  const key = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  storage.setItem(name, key);
  return key;
}

export async function requestEssayTemplate(profile, {items, signal} = {}) {
  const timeout = AbortSignal.timeout(5_000);
  const response = await fetch('/api/me/essay-template', {
    method:items === undefined ? 'GET' : 'PUT',
    headers:{Authorization:'Bearer ' + essayTemplateAccessKey(profile), 'Content-Type':'application/json'},
    body:items === undefined ? undefined : JSON.stringify({items}),
    cache:'no-store',
    signal:signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error('ESSAY_TEMPLATE_UNAVAILABLE');
  return items === undefined ? (await response.json()).items : undefined;
}
