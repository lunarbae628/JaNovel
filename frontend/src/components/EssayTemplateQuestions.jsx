import React, {useState} from 'react';
import {Plus, Trash2} from 'lucide-react';
import {Field, IconButton, Notice} from './UI.jsx';
import {createEssayTemplateQuestion} from '../essay-template.js';
import {uid} from '../model.js';

const blank = () => ({key:uid('template-prompt'), prompt:'', limit:''});

export default function EssayTemplateQuestions({questions, onSave, onClose}) {
  const [fields, setFields] = useState(() => questions.length ? questions.map(question => ({
    key:question.id, prompt:question.prompt, limit:question.templateLimit ?? '',
  })) : [blank()]);
  const [error, setError] = useState('');

  function change(key, values) {
    setFields(current => current.map(field => field.key === key ? {...field, ...values} : field));
    setError('');
  }

  function submit(event) {
    event.preventDefault();
    const existing = new Map(questions.map(question => [question.id, question]));
    const values = fields.map(field => ({...field, prompt:field.prompt.trim(), limit:field.limit === '' ? null : Number(field.limit)}));
    if (values.some(field => existing.has(field.key) && !field.prompt)) {
      setError('기존 작성 기록을 보관하려면 문항을 입력해 주세요.');
      return;
    }
    const next = values.filter(field => field.prompt).map(({key, prompt, limit}) => {
      const previous = existing.get(key);
      return previous ? {...previous, prompt, limit:limit ?? 1000, templateLimit:limit}
        : createEssayTemplateQuestion({prompt, limit});
    });
    if (!next.length) {
      setError('문항을 하나 이상 입력해 주세요.');
      return;
    }
    onSave(next);
  }

  return <form onSubmit={submit}>
    {fields.map((field, index) => <div className="essay-template-fields" key={field.key}>
      <Field label={'문항 ' + (index + 1)}><textarea rows={2} value={field.prompt} maxLength={2000}
        onChange={event => change(field.key, {prompt:event.target.value})}/></Field>
      <Field label="글자 수 제한 (선택)"><input type="number" min={1} max={100000} value={field.limit}
        onChange={event => change(field.key, {limit:event.target.value})}/></Field>
      {!questions.some(question => question.id === field.key) &&
        <IconButton label={'문항 ' + (index + 1) + ' 삭제'}
          onClick={() => setFields(current => current.filter(item => item.key !== field.key))}><Trash2 size={16}/></IconButton>}
    </div>)}
    <button type="button" className="text-button" disabled={fields.length >= 30}
      onClick={() => setFields(current => [...current, blank()])}><Plus size={16}/>문항 추가</button>
    {error && <Notice type="error">{error}</Notice>}
    <div className="form-actions">
      <button type="button" className="button" onClick={onClose}>취소</button>
      <button type="submit" className="button primary">{questions.length ? '문항 저장' : '작성 시작'}</button>
    </div>
  </form>;
}
