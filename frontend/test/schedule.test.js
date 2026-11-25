import assert from 'node:assert/strict';
import test from 'node:test';
import {calendarSelection, calendarWeeks, completeOccurrence, isScheduleItem, projectSchedule, replaceOccurrence, removeApplicationEvent, saveApplicationEvent, scheduleFormDates, scheduleFormRepeat, scheduleItemDates, validateScheduleItem, packWeek, weekDays, weekAgenda, shiftDates} from '../src/schedule.js';

const plan = {
  id: 'p1', title: '포트폴리오 정리', kind: 'task', start: '2026-11-28', end: '2026-12-02',
  time: '', note: '', color: 'purple', repeat: false, repeatUntil: '', completed: [], skipped: [],
};
const daily = {...plan, title: '알고리즘 2문제', start: '2026-11-28', end: '2026-11-28', repeat: true, repeatUntil: '2026-12-02'};
const weekly = {...daily, start: '2026-11-25', end: '2026-11-25', repeat: 'weekly', repeatUntil: '2026-12-17'};

test('세로 드래그의 마지막 날을 종료일 하나로 표시하고 수정하면 그날까지 반복한다', () => {
  const form = scheduleFormDates({...plan, ...calendarSelection('2026-11-11', '2026-11-25')});
  assert.equal(form.end, '2026-11-25');

  const item = scheduleItemDates({...form, end:'2026-11-18'});
  assert.equal(item.start, item.end);
  assert.equal(item.repeatUntil, '2026-11-18');
  assert.deepEqual(projectSchedule([item], '2026-11-11', '2026-11-28').map(event => event.date),
    ['2026-11-11', '2026-11-18']);
});

test('일반 일정과 반복 일정 전환 시 정한 종료일을 유지한다', () => {
  const recurring = scheduleFormRepeat(scheduleFormDates(plan), 'weekly');
  assert.equal(recurring.end, plan.end);
  assert.equal(scheduleItemDates(recurring).repeatUntil, plan.end);
  assert.equal(scheduleItemDates(scheduleFormRepeat(recurring, false)).end, plan.end);
  assert.equal(scheduleItemDates(scheduleFormDates(daily)).repeatUntil, daily.repeatUntil);
});

test('종료일을 비운 반복 일정은 계속 반복하고 일반 일정으로 바꾸면 시작일에 끝난다', () => {
  const ongoing = scheduleFormDates({...weekly, repeatUntil:''});
  assert.equal(ongoing.end, '');
  assert.equal(scheduleItemDates(ongoing).repeatUntil, '');
  assert.equal(scheduleFormRepeat(ongoing, false).end, weekly.start);
});

test('an undated interview can be scheduled by ID without replacing other events or the deadline', () => {
  const event = {id: 'interview', title: '기술 면접', type: '면접', date: '', time: '', note: ''};
  const assignment = {...event, id: 'assignment', type: '과제', date: '2026-11-21'};
  const application = {id: 'company', deadline: '2026-11-20', events: [assignment]};
  const registered = saveApplicationEvent(application, event);
  assert.deepEqual(registered.events, [assignment, event]);
  const scheduled = saveApplicationEvent(registered, {...event, date: '2026-11-22', endDate: '2026-11-24'});
  assert.deepEqual(scheduled.events, [assignment, {...event, date: '2026-11-22', endDate: '2026-11-24'}]);
  const edited = saveApplicationEvent(scheduled, {deadline: true, date: '2026-11-23', time: '14:00'});
  assert.equal(edited.deadline, '2026-11-23');
  assert.equal(edited.deadlineTime, '14:00');
  assert.deepEqual(edited.events, scheduled.events);
});

test('마감의 표시 정보 수정과 삭제는 지원 건과 나머지 일정을 보존한다', () => {
  const event = {id: 'interview', title: '기술 면접', type: '면접'};
  const application = {id: 'company', company: '회사', deadline: '2026-11-21', deadlineTime: '', events: [event]};
  const details = {title: '서류 접수 마감', note: '지원 링크 확인', color: 'pink'};
  const updated = saveApplicationEvent(application, {deadline: true, date: '2026-11-22', time: '14:00', ...details});
  assert.deepEqual(updated.deadlineDetails, details);
  const moved = saveApplicationEvent(updated, {deadline: true, date: '2026-11-23', time: '18:00'});
  assert.deepEqual(moved.deadlineDetails, details);
  assert.deepEqual(removeApplicationEvent(moved, {deadline: true}), {...application, deadline: '', deadlineTime: ''});
  assert.deepEqual(removeApplicationEvent(moved, event), {...moved, events: []});
});

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

test('같은 요일 열을 위로 드래그해도 먼저 오는 날짜부터 주간 반복을 설정한다', () => {
  assert.deepEqual(calendarSelection('2026-12-09', '2026-11-25'), {
    start: '2026-11-25', end: '2026-11-25', repeat: 'weekly', repeatUntil: '2026-12-09',
  });
});

test('서로 다른 요일 열의 드래그는 연속 일정으로 선택한다', () => {
  assert.deepEqual(calendarSelection('2026-11-25', '2026-11-27'), {
    start: '2026-11-25', end: '2026-11-27', repeat: false, repeatUntil: '',
  });
});

test('저장된 매일 반복과 새 주간 반복을 함께 읽고 여러 날 주간 반복은 거부한다', () => {
  assert.equal(isScheduleItem(daily), true);
  assert.equal(isScheduleItem(weekly), true);
  assert.equal(isScheduleItem({...weekly, end: '2026-11-26'}), false);
  assert.equal(isScheduleItem({...weekly, repeatUntil: '2026-11-24'}), false);
  assert.equal(isScheduleItem({...weekly, repeat: 'monthly'}), false);
});

test('주간 반복은 보이는 기간이 다른 요일에 시작해도 원래 요일과 반복 종료일을 따른다', () => {
  const dates = projectSchedule([weekly], '2026-11-27', '2026-12-31');
  assert.deepEqual(dates.map(e => [e.start, e.end]), [
    ['2026-12-02', '2026-12-02'], ['2026-12-09', '2026-12-09'], ['2026-12-16', '2026-12-16'],
  ]);
});

test('주간 반복의 완료와 건너뛰기는 회차에만 적용되고 수정한 일정은 한 번만 나타난다', () => {
  const checked = completeOccurrence(weekly, '2026-12-02', true);
  const [skipped] = replaceOccurrence(checked, '2026-12-09');
  const result = replaceOccurrence(skipped, '2026-11-25', {...weekly, id: 'p2', start: '2026-11-26', end: '2026-11-26'});
  const dates = projectSchedule(result, '2026-11-25', '2026-12-31');
  assert.deepEqual(dates.map(e => [e.id, e.date, e.done]), [
    ['p1', '2026-12-02', true], ['p1', '2026-12-16', false], ['p2', '2026-11-26', false],
  ]);
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

test('주간 목록은 날짜를 포함한 일~토 7일을 돌려준다', () => {
  assert.deepEqual(weekDays('2026-11-26'),
    ['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28']);
  assert.equal(weekDays('2026-11-22')[0], '2026-11-22');
  assert.equal(weekDays('2026-11-28')[0], '2026-11-22');
});

test('주간 내역은 기간 일정을 걸친 모든 날에 넣고 종일 일정 뒤에 시간 순으로 정렬한다', () => {
  const days = weekDays('2026-11-26');
  const events = projectSchedule([plan, {...plan, id: 'p2', title: '스터디', start: '2026-11-29', end: '2026-11-29'},
    {...plan, id: 'p3', title: '아침', start: '2026-11-28', end: '2026-11-28', time: '08:00'}], days[0], days.at(-1));
  const agenda = weekAgenda(events, days);
  assert.equal(agenda.length, 7);
  assert.deepEqual(agenda.at(-1).events.map(event => event.id), ['p1', 'p3']);
  assert.deepEqual(agenda[0].events, []);
});

test('일정을 끌어 놓으면 시작일과 종료일이 같은 일수만큼 이동한다', () => {
  assert.deepEqual(shiftDates({start: '2026-11-28', end: '2026-12-02'}, '2026-11-28', '2026-12-01'),
    {start: '2026-12-01', end: '2026-12-05'});
  assert.deepEqual(shiftDates({start: '2026-11-28', end: '2026-11-28'}, '2026-11-28', '2026-11-25'),
    {start: '2026-11-25', end: '2026-11-25'});
});
