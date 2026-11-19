import assert from 'node:assert/strict';
import test from 'node:test';
import {calendarWeeks, completeOccurrence, projectSchedule, replaceOccurrence, validateScheduleItem, packWeek} from '../src/schedule.js';

const plan = {
  id: 'p1', title: '포트폴리오 정리', kind: 'task', start: '2026-11-28', end: '2026-12-02',
  time: '', note: '', color: 'purple', repeat: false, repeatUntil: '', completed: [], skipped: [],
};
const daily = {...plan, title: '알고리즘 2문제', start: '2026-11-28', end: '2026-11-28', repeat: true, repeatUntil: '2026-12-02'};

test('a period retains the same event ID across month and week boundaries', () => {
  assert.equal(calendarWeeks('2026-11-01').at(-1).at(-1), '2026-12-05');
  const events = projectSchedule([plan], '2026-12-01', '2026-12-31');
  assert.deepEqual(events.map(e => [e.id, e.start, e.end]), [['p1', '2026-11-28', '2026-12-02']]);
  const [bar] = packWeek(events, calendarWeeks('2026-12-01')[0]);
  assert.deepEqual([bar.startColumn, bar.endColumn], [1, 5]);
});

test('daily repetition is limited to single dates, bounded by the repeat end', () => {
  assert.equal(validateScheduleItem({...plan, repeat: true}), '일일 반복은 하루 일정에만 설정할 수 있어요.');
  assert.equal(validateScheduleItem(daily), '');
  assert.deepEqual(projectSchedule([daily], '2026-12-01', '2026-12-31').map(e => e.date), ['2026-12-01', '2026-12-02']);
});

test('checking one date and editing a different occurrence keeps the rest of the series', () => {
  const checked = completeOccurrence(daily, '2026-12-01', true);
  assert.deepEqual(checked.completed, ['2026-12-01']);
  const result = replaceOccurrence(checked, '2026-12-02', {...daily, id: 'p2', title: '문제 풀이', start: '2026-12-03', end: '2026-12-03'});
  const dates = projectSchedule(result, '2026-12-01', '2026-12-10');
  assert.deepEqual(dates.map(e => [e.date, e.title, e.done]), [
    ['2026-12-01', daily.title, true], ['2026-12-03', '문제 풀이', false],
  ]);
});
