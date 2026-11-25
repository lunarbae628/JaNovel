export function questionPayload(questions) {
  return questions.map(({prompt, limit}) => ({
    prompt:prompt.trim(),
    limit:limit == null || limit === '' ? null : Number(limit),
  })).filter(question => question.prompt);
}

export function fitsSharedQuestionLimits(questions) {
  return questions.length <= 30 && questions.every(({prompt, limit}) => prompt.length <= 2000
    && (limit === null || (Number.isInteger(limit) && limit >= 1 && limit <= 100000)));
}

export function questionPublication(scope, enteredScope, lookup, questions) {
  if (!scope || questions.some(question => question.personalTemplate)) return '';
  if (enteredScope && enteredScope !== scope) return 'different-posting';
  if (lookup?.version || lookup?.available === false) return '';
  return fitsSharedQuestionLimits(questionPayload(questions)) ? 'shareable' : 'out-of-range';
}
