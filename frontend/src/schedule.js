const DAY = 86_400_000;
const dateValue = key => Date.parse(key + 'T00:00:00Z');
const dateKey = value => new Date(value).toISOString().slice(0, 10);
export const addDays = (key, days) => dateKey(dateValue(key) + days * DAY);
export const todayKey = () => new Date().toLocaleDateString('sv-SE');
export const scheduleColors = ['default', 'blue', 'purple', 'green', 'ochre', 'pink'];
const maxDate = (a, b) => a > b ? a : b;
const minDate = (a, b) => a < b ? a : b;
export const isDateKey = key => typeof key === 'string' && /^\d{4}-\d\d-\d\d$/.test(key) &&
  Number.isFinite(dateValue(key)) && dateKey(dateValue(key)) === key;
const isTime = time => typeof time === 'string' && (!time || /^([01]\d|2[0-3]):[0-5]\d$/.test(time));

export const applicationEventTypes = ['면접', '과제', '코딩테스트', '마감', '기타'];

export function saveApplicationEvent(application, event) {
  if (event.deadline) {
    const next = {...application, deadline: event.date, deadlineTime: event.date ? event.time : ''};
    if (event.date) {
      const current = application.deadlineDetails || {};
      next.deadlineDetails = {
        title: event.title ?? current.title ?? '지원 마감',
        note: event.note ?? current.note ?? '',
        color: event.color ?? current.color ?? 'default',
      };
    } else {
      delete next.deadlineDetails;
    }
    return next;
  }
  const exists = application.events.some(item => item.id === event.id);
  return {...application, events: exists
    ? application.events.map(item => item.id === event.id ? event : item)
    : [...application.events, event]};
}

export function removeApplicationEvent(application, event) {
  if (event.deadline) return saveApplicationEvent(application, {deadline: true, date: ''});
  return {...application, events: application.events.filter(item => item.id !== event.id)};
}

export function calendarWeeks(month) {
  const start = month.slice(0, 7) + '-01';
  const first = addDays(start, -new Date(dateValue(start)).getUTCDay());
  const anchor = new Date(dateValue(start));
  const nextMonth = dateKey(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  const weeks = Math.ceil((dateValue(nextMonth) - dateValue(first)) / (7 * DAY));
  return Array.from({length: weeks}, (_, w) =>
    Array.from({length: 7}, (_, d) => addDays(first, w * 7 + d)));
}

export function validateScheduleItem(item) {
  if (typeof item.title !== 'string' || !item.title.trim()) return '일정 제목을 입력해 주세요.';
  if (!isDateKey(item.start) || !isDateKey(item.end) || item.end < item.start) return '시작일과 종료일을 확인해 주세요.';
  if (!isTime(item.time) || !isTime(item.endTime ?? '') ||
      (item.endTime && (!item.time || (item.start === item.end && item.endTime < item.time)))) {
    return '시작 시간과 종료 시간을 확인해 주세요.';
  }
  if (item.repeat && item.start !== item.end) return '일일 반복은 하루 일정에만 설정할 수 있어요.';
  if (item.repeat && item.repeatUntil && (!isDateKey(item.repeatUntil) || item.repeatUntil < item.start)) {
    return '반복 종료일은 시작일 이후로 설정해 주세요.';
  }
  return '';
}

export function isScheduleItem(item) {
  return Boolean(item && typeof item.id === 'string' && item.id && ['event', 'task'].includes(item.kind) &&
    scheduleColors.includes(item.color) && typeof item.note === 'string' && typeof item.repeat === 'boolean' &&
    typeof item.repeatUntil === 'string' && Array.isArray(item.completed) && item.completed.every(isDateKey) &&
    Array.isArray(item.skipped) && item.skipped.every(isDateKey) && !validateScheduleItem(item));
}

export function projectSchedule(items, first, last) {
  return items.flatMap(item => {
    if (!item.repeat) return item.end < first || item.start > last ? [] :
      [{...item, date: item.start, done: item.completed.includes(item.start)}];
    const result = [];
    const until = minDate(last, item.repeatUntil || last);
    for (let day = maxDate(first, item.start); day <= until; day = addDays(day, 1)) {
      if (!item.skipped.includes(day)) result.push({
        ...item, start: day, end: day, date: day, done: item.completed.includes(day),
      });
    }
    return result;
  });
}

export function completeOccurrence(item, date, done) {
  const completed = item.completed.filter(key => key !== date);
  return {...item, completed: done ? [...completed, date] : completed};
}

export function replaceOccurrence(item, date, replacement) {
  const updated = {...item, skipped: [...new Set([...item.skipped, date])]};
  if (!replacement) return [updated];
  return [updated, {...replacement, repeat: false, repeatUntil: '', skipped: [],
    completed: item.completed.includes(date) ? [replacement.start] : []}];
}

export function packWeek(events, days) {
  const first = days[0];
  const last = days.at(-1);
  const segments = events.filter(event => event.start <= last && event.end >= first)
    .map(event => ({
      event,
      startColumn: days.indexOf(maxDate(event.start, first)) + 1,
      endColumn: days.indexOf(minDate(event.end, last)) + 2,
    }))
    .sort((a, b) => Number(Boolean(b.event.applicationId)) - Number(Boolean(a.event.applicationId)) ||
      a.startColumn - b.startColumn || b.endColumn - a.endColumn || a.event.time.localeCompare(b.event.time));
  const lanes = [];
  return segments.map(segment => {
    let lane = lanes.findIndex(items => items.every(other =>
      other.endColumn <= segment.startColumn || other.startColumn >= segment.endColumn));
    if (lane === -1) lane = lanes.push([]) - 1;
    lanes[lane].push(segment);
    return {...segment, lane};
  });
}
