import React, {useRef, useState} from 'react';
import {Check, ChevronLeft, ChevronRight, ListChecks, Plus, Repeat2, CalendarDays} from 'lucide-react';
import Dropdown from '../components/Dropdown.jsx';
import {Field, Modal, Notice} from '../components/UI.jsx';
import {allEvents} from './Applications.jsx';
import {uid} from '../model.js';
import {
  addDays, applicationEventTypes, calendarSelection, calendarWeeks, completeOccurrence, isDateKey, packWeek, projectSchedule, replaceOccurrence,
  removeApplicationEvent, saveApplicationEvent, scheduleColors, scheduleFormDates, scheduleFormRepeat, scheduleItemDates,
  scheduleTone, shiftDates, todayKey, validateScheduleItem, weekAgenda, weekDays,
} from '../schedule.js';

const colors = ['기본', '파랑', '보라', '초록', '황토', '분홍'];
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const formatDay = key => new Intl.DateTimeFormat('ko-KR', {
  month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC',
}).format(new Date(key));
const dayNumber = key => Number(key.slice(8));
const shortDay = key => Number(key.slice(5, 7)) + '월 ' + dayNumber(key) + '일';
const weekdayName = key => new Intl.DateTimeFormat('ko-KR', {weekday: 'short', timeZone: 'UTC'}).format(new Date(key));
const rangeLabel = event => event.start === event.end ? formatDay(event.start) : shortDay(event.start) + ' ~ ' + shortDay(event.end);
const eventTitle = event => !event.applicationId ? event.title : event.deadline ? '지원 마감' : event.type || event.title;
const isTask = event => event.kind === 'task' && !event.applicationId;
function Checkbox({event, onToggle}) {
  return <button type="button" role="checkbox" className="schedule-check" aria-checked={Boolean(event.done)}
    aria-label={eventTitle(event) + ' 완료'} onPointerDown={down => down.stopPropagation()}
    onClick={click => { click.stopPropagation(); onToggle(event); }}>
    {event.done && <Check size={12} strokeWidth={3} aria-hidden="true"/>}
  </button>;
}
const personalItem = (start, end = start) => ({
  title: '', kind: 'event', start, end, time: '', endTime: '', note: '', color: 'default',
  repeat: false, repeatUntil: '', completed: [], skipped: [],
});

function dateAtPointer(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const cell = target?.closest('[data-day]') || Array.from(target?.closest('.schedule-week')?.querySelectorAll('[data-day]') || [])
    .find(item => {
      const {left, right} = item.getBoundingClientRect();
      return left <= event.clientX && event.clientX < right;
    });
  return cell?.dataset.day;
}

function ScheduleForm({dialog, applications, onClose, onSave, onRemove, onPrepare}) {
  const [data, setData] = useState(() => scheduleFormDates(dialog.item));
  const [allDay, setAllDay] = useState(!data.time);
  const [error, setError] = useState('');
  const change = (key, value) => setData(previous => ({...previous, [key]: value}));
  const support = Boolean(data.applicationId);
  const deadline = Boolean(data.deadline);

  return <Modal title={deadline ? '지원 마감 수정' : data.id ? '일정 수정' : '일정 추가'} onClose={onClose} className="schedule-modal">
    <form onSubmit={event => {
      event.preventDefault();
      const title = support ? deadline ? data.title || '지원 마감' : data.type || '면접' : data.title.trim();
      const next = {...scheduleItemDates(data), title, time: allDay ? '' : data.time,
        endTime: allDay ? '' : data.endTime ?? ''};
      const problem = validateScheduleItem(next);
      if (problem) setError(problem); else onSave(next);
    }}>
      {!deadline && applications.length > 0 && <Dropdown field label="연결할 지원"
        value={data.applicationId || ''} disabled={Boolean(data.id)}
        options={[{value: '', label: '개인 일정'}, ...applications.map(item => ({value: item.id, label: item.company + ' · ' + item.role}))]}
        onChange={applicationId => setData(previous => applicationId
          ? {...scheduleFormRepeat(previous, false), applicationId, kind:'event'} : {...previous, applicationId})}/>}
      {!support && <Field label="제목"><input value={data.title} maxLength={100} required onChange={event => change('title', event.target.value)}/></Field>}
      {support && !deadline && <Dropdown field label="채용 절차" value={data.type || '면접'}
        options={[...new Set([...applicationEventTypes, data.type || '면접'])]} onChange={value => change('type', value)}/>}
      <div className="form-grid">
        <Field label={deadline ? '마감일' : '시작일'}><input type="date" required value={data.start} onChange={event => {
          const start = event.target.value;
          setData(previous => ({...previous, start, end: !previous.repeat && previous.start === previous.end ? start : previous.end}));
        }}/></Field>
        {!deadline && <Field label="종료일" hint={data.repeat ? '비워 두면 계속 반복해요.' : undefined}>
          <input type="date" min={data.start} required={!data.repeat} value={data.end}
            onChange={event => change('end', event.target.value)}/>
        </Field>}
      </div>
      <label className="schedule-checkbox"><input type="checkbox" checked={allDay} onChange={event => setAllDay(event.target.checked)}/>{deadline ? '시간 미정' : '종일'}</label>
      {!allDay && <div className="form-grid">
        <Field label={deadline ? '마감 시간' : '시작 시간'}><input type="time" value={data.time} onChange={event => change('time', event.target.value)}/></Field>
        {!deadline && <Field label="종료 시간"><input type="time" value={data.endTime || ''} onChange={event => change('endTime', event.target.value)}/></Field>}
      </div>}
      {!support && dialog.scope !== 'date' && <>
        <div className="form-grid">
          <Dropdown field label="반복" value={data.repeat}
            options={[{value: false, label: '반복 안 함'}, {value: true, label: '매일'}, {value: 'weekly', label: '매주'}]}
            onChange={repeat => setData(previous => scheduleFormRepeat(previous, repeat))}/>
          <div className="field"><span id="schedule-kind-label">관리 방식</span>
            <div className="schedule-segment" role="group" aria-labelledby="schedule-kind-label">
              {[['event', '일반 일정', CalendarDays], ['task', '체크리스트', ListChecks]].map(([value, label, Icon]) =>
                <button key={value} type="button" aria-pressed={data.kind === value} onClick={() => change('kind', value)}>
                  <Icon size={14} aria-hidden="true"/>{label}
                </button>)}
            </div>
          </div>
        </div>
      </>}
      <fieldset className="schedule-palette"><legend>색상</legend>
        {scheduleColors.map((color, i) => <button key={color} type="button" className={'schedule-swatch schedule-tone ' + (color === 'default' ? scheduleTone({...data, color}) : color)}
          aria-label={colors[i]} title={colors[i]} aria-pressed={data.color === color} onClick={() => change('color', color)}/>)}
      </fieldset>
      <Field label="메모"><textarea value={data.note} rows={2} maxLength={240}
        onChange={event => change('note', event.target.value)}/></Field>
      {error && <Notice type="error">{error}</Notice>}
      {onPrepare && <div className="schedule-context-actions">
        {onPrepare && <button type="button" className="button" onClick={onPrepare}>면접 준비</button>}
      </div>}
      <div className="form-actions">
        {onRemove && <button type="button" className="button schedule-remove" onClick={onRemove}>일정 삭제</button>}
        <button type="button" className="button" onClick={onClose}>취소</button>
        <button type="submit" className="button primary">확인</button>
      </div>
    </form>
  </Modal>;
}

function ScheduleDetail({event, onClose, onEdit, onRemove, onToggle, onPrepare}) {
  const time = event.time && event.time + (event.endTime ? ' ~ ' + event.endTime : '');
  const repeat = event.repeat && (event.repeat === 'weekly' ? '매주' : '매일') + ' 반복' +
    (event.repeatUntil ? ' · ' + shortDay(event.repeatUntil) + '까지' : '');
  const rows = [
    ['날짜', event.repeat ? formatDay(event.date) : rangeLabel(event)], time && ['시간', time], repeat && ['반복', repeat],
    event.note && ['메모', event.note],
  ].filter(Boolean);
  return <Modal title="일정 상세" onClose={onClose} className="schedule-modal schedule-detail">
    <div className={'schedule-detail-title schedule-tone ' + scheduleTone(event) + (event.done ? ' completed' : '')}>
      {isTask(event) && <Checkbox event={event} onToggle={onToggle}/>}
      <h3>{event.company && <small>{event.company}</small>}{eventTitle(event)}</h3>
    </div>
    <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="form-actions">
      <button type="button" className="button schedule-remove" onClick={onRemove}>일정 삭제</button>
      {onPrepare && <button type="button" className="button" onClick={onPrepare}>면접 준비</button>}
      <button type="button" className="button primary" onClick={onEdit}>수정</button>
    </div>
  </Modal>;
}

export default function Schedule({store, initialDate, navigate, onItemsChange, onApplicationChange}) {
  const today = todayKey();
  const [selected, setSelected] = useState(isDateKey(initialDate) ? initialDate : today);
  const [month, setMonth] = useState(selected.slice(0, 7) + '-01');
  const [drag, setDrag] = useState(null);
  const anchor = useRef('');
  const moving = useRef(null);
  const suppressClick = useRef(false);
  const clickTimer = useRef(0);
  const [move, setMove] = useState(null);
  const [weekAnchor, setWeekAnchor] = useState(selected);
  const selection = drag && calendarSelection(drag.start, drag.end);
  const weeklyColumn = selection?.repeat === 'weekly' ? new Date(selection.start).getUTCDay() : null;
  const [dialog, setDialog] = useState(null);
  const items = store.scheduleItems || [];
  const applications = store.applications;
  const supportEvents = applications.flatMap(allEvents).map(item => ({
    ...item, start: item.date, end: item.endDate || item.date,
  }));
  const weeks = calendarWeeks(month);
  const events = [...supportEvents.filter(item => isDateKey(item.start)),
    ...projectSchedule(items, weeks[0][0], weeks.at(-1).at(-1))];
  const undated = supportEvents.filter(event => !event.date);
  const days = weekDays(weekAnchor);
  const agenda = weekAgenda([...supportEvents.filter(item => isDateKey(item.start)),
    ...projectSchedule(items, days[0], days[6])], days);
  const weekOffset = Math.round((Date.parse(days[0]) - Date.parse(weekDays(today)[0])) / (7 * 86_400_000));
  const weekTitle = {'-1': '지난 주', 0: '이번 주', 1: '다음 주'}[weekOffset] || shortDay(days[0]) + ' 주';
  const moveRange = move && move.to !== move.from && shiftDates(move.event, move.from, move.to);

  function jump(date) {
    setSelected(date);
    setMonth(date.slice(0, 7) + '-01');
  }
  function moveMonth(direction) {
    const next = new Date(month + 'T00:00:00Z');
    next.setUTCMonth(next.getUTCMonth() + direction);
    jump(next.toISOString().slice(0, 10));
  }
  function add(start = selected, end = start) {
    const dates = calendarSelection(start, end);
    jump(dates.start);
    setDialog({type: 'form', item: {...personalItem(dates.start), ...dates}});
  }
  function edit(event) {
    if (event.applicationId) {
      setDialog({type: 'form', item: {...personalItem(event.start, event.end), ...event}});
    } else {
      const item = items.find(item => item.id === event.id);
      setDialog({type: item.repeat ? 'repeat' : 'form', item, date: event.date, done: event.done});
    }
  }
  function save(next) {
    const id = next.id || uid('event');
    if (next.applicationId) {
      onApplicationChange(next.applicationId, application => saveApplicationEvent(application, {
        id, title: next.title, type: next.type || '면접', date: next.start, endDate: next.end,
        time: next.time, endTime: next.endTime, note: next.note, color: next.color,
        ...(next.deadline && {deadline: true}),
      }));
    } else if (dialog.scope === 'date') {
      onItemsChange(previous => previous.flatMap(item => item.id === dialog.original.id
        ? replaceOccurrence(item, dialog.date, {...next, id: uid('event')}) : [item]));
    } else {
      const updated = {...next, id, completed: next.repeat || next.start === dialog.item.start
        ? next.completed : next.completed.length ? [next.start] : []};
      onItemsChange(previous => next.id ? previous.map(item => item.id === id ? updated : item) : [...previous, updated]);
    }
    jump(next.start);
    setWeekAnchor(next.start);
    setDialog(null);
  }
  function showDetail(event) {
    clearTimeout(clickTimer.current);
    setDialog({type: 'detail', event});
  }
  function removeTarget(event) {
    setDialog({type: 'remove', from: event,
      item: event.applicationId ? event : items.find(item => item.id === event.id)});
  }
  function completeEvent(event) {
    onItemsChange(previous => previous.map(item => item.id === event.id
      ? completeOccurrence(item, event.date, !event.done) : item));
    setDialog(previous => previous?.type === 'detail' ? {...previous, event: {...previous.event, done: !event.done}} : previous);
  }
  function moveEvent(event, {start, end}) {
    if (event.applicationId) {
      onApplicationChange(event.applicationId, application => saveApplicationEvent(application, {
        id: event.id, title: event.title, type: event.type || '면접', date: start, endDate: end,
        time: event.time, endTime: event.endTime ?? '', note: event.note ?? '', color: event.color ?? 'default',
        ...(event.deadline && {deadline: true}),
      }));
    } else {
      onItemsChange(previous => previous.map(item => item.id !== event.id ? item : {...item, start, end,
        completed: start === item.start ? item.completed : item.completed.length ? [start] : []}));
    }
  }
  function remove() {
    const item = dialog.item;
    if (dialog.scope === 'date') {
      onItemsChange(previous => previous.flatMap(item => item.id === dialog.original.id
        ? replaceOccurrence(item, dialog.date) : [item]));
    } else if (item.applicationId) {
      onApplicationChange(item.applicationId, application => removeApplicationEvent(application, item));
    } else {
      onItemsChange(previous => previous.filter(event => event.id !== item.id));
    }
    setDialog(null);
  }
  function toggleComplete() {
    onItemsChange(previous => previous.map(item => item.id === dialog.item.id
      ? completeOccurrence(item, dialog.date, !dialog.done) : item));
    setDialog(null);
  }

  function clearDrag() {
    anchor.current = '';
    setDrag(null);
  }

  function previewRange(event) {
    const start = anchor.current;
    if (!start) return;
    const end = dateAtPointer(event);
    if (!end || end === start) {
      setDrag(null);
      return;
    }
    setDrag(previous => previous?.end === end ? previous : {start, end});
  }

  function finishRange(event) {
    const start = anchor.current;
    if (!start) return;
    const end = dateAtPointer(event);
    clearDrag();
    if (end && end !== start) add(start, end);
  }

  function previewMove(event) {
    if (!moving.current) return;
    if (!event.buttons) {
      moving.current = null;
      setMove(null);
      return;
    }
    const {from, x, y} = moving.current;
    if (!move && Math.hypot(event.clientX - x, event.clientY - y) < 5) return;
    const to = dateAtPointer(event) || move?.to || from;
    setMove({...moving.current, to, x: event.clientX, y: event.clientY});
  }

  function finishMove(event) {
    const current = moving.current;
    if (!current) return;
    moving.current = null;
    setMove(null);
    const to = dateAtPointer(event);
    if (move) {
      suppressClick.current = true;
      setTimeout(() => { suppressClick.current = false; }, 150);
    }
    if (!to || to === current.from) return;
    moveEvent(current.event, shiftDates(current.event, current.from, to));
  }

  function cancelPointer() {
    clearDrag();
    moving.current = null;
    setMove(null);
  }

  return <>
    <div className="career-content schedule-content">
      <section className="schedule-month" aria-label="월간 캘린더">
        <div className="schedule-month-heading">
          <h1>{Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월</h1>
          <div>
            {undated.length > 0 && <button className="career-button schedule-undated" onClick={() => setDialog({type: 'undated'})}>
              날짜 미정 <span>{undated.length}</span>
            </button>}
            <button className="career-button" onClick={() => jump(today)}>오늘</button>
            <button className="career-button schedule-arrow" aria-label="이전 달" onClick={() => moveMonth(-1)}><ChevronLeft size={15}/></button>
            <button className="career-button schedule-arrow" aria-label="다음 달" onClick={() => moveMonth(1)}><ChevronRight size={15}/></button>
          </div>
        </div>
        <div className="schedule-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
        <div className={'schedule-calendar' + (move ? ' moving-event' : '')} onPointerMove={event => { previewRange(event); previewMove(event); }}
          onPointerUp={event => { finishRange(event); finishMove(event); }}
          onPointerCancel={cancelPointer} onPointerLeave={cancelPointer}>
          {weeks.map(days => {
            const bars = packWeek(events, days);
            const lanes = Math.max(1, ...bars.map(bar => bar.lane + 1));
            return <div className="schedule-week" key={days[0]} style={{'--lanes': lanes}}>
              {days.map((day, index) => {
                const marked = (selection && day >= selection.start && day <= (selection.repeatUntil || selection.end) &&
                  (weeklyColumn === null || index === weeklyColumn)) || (moveRange && day >= moveRange.start && day <= moveRange.end);
                return <div data-day={day} key={day} className={'schedule-cell' + (day === selected ? ' selected' : '') + (marked ? ' range' : '')}
                  style={{gridColumn: index + 1}}>
                  <button type="button" className={'schedule-day' + (day === today ? ' today' : '') + (day.slice(0, 7) !== month.slice(0, 7) ? ' outside' : '')}
                    aria-label={formatDay(day) + ' 선택'} aria-pressed={day === selected}
                    onPointerDown={event => {
                      if (event.button !== 0 || event.pointerType === 'touch') return;
                      anchor.current = day;
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                    }}
                    onClick={() => { setSelected(day); setWeekAnchor(day); }} onDoubleClick={() => add(day)}>
                    {Number(day.slice(8))}
                  </button>
                  {day === selected && <button type="button" className="schedule-cell-add"
                    aria-label={formatDay(day) + ' 일정 추가'} onClick={() => add(day)}><Plus size={13}/></button>}
                </div>;
              })}
              {bars.map(({event, startColumn, endColumn, lane}) => <div
                key={(event.applicationId || '') + '/' + event.id + '/' + event.date}
                className={'schedule-bar schedule-tone ' + scheduleTone(event) + (event.done ? ' completed' : '') +
                  (event.repeat ? '' : ' movable') + (move?.event.id === event.id && move.event.applicationId === event.applicationId ? ' moving' : '')}
                style={{gridColumn: startColumn + ' / ' + endColumn, gridRow: lane + 2}}
                onPointerDown={down => {
                  if (down.button !== 0 || down.pointerType === 'touch' || event.repeat) return;
                  const from = dateAtPointer(down);
                  if (from) moving.current = {event, from, x: down.clientX, y: down.clientY};
                }}>
                {isTask(event) && <Checkbox event={event} onToggle={completeEvent}/>}
                <button type="button" className="schedule-bar-main"
                  title={[eventTitle(event), event.repeat ? '클릭: 상세 · 더블클릭: 수정' : '클릭: 상세 · 더블클릭: 수정 · 끌어서 날짜 이동'].join(' · ')}
                  aria-label={[event.company, eventTitle(event), formatDay(event.date), '상세 보기'].filter(Boolean).join(' · ')}
                  onClick={click => {
                    if (suppressClick.current) return;
                    clearTimeout(clickTimer.current);
                    if (!click.detail || click.nativeEvent.pointerType === 'touch') showDetail(event);
                    else clickTimer.current = setTimeout(() => showDetail(event), 220);
                  }}
                  onDoubleClick={() => { clearTimeout(clickTimer.current); edit(event); }}>
                  {event.company && <strong>{event.company}</strong>}
                  <span>{eventTitle(event)}{event.time ? ' ' + event.time : ''}</span>
                  {event.repeat && <Repeat2 size={13} aria-hidden="true"/>}
                </button>
              </div>)}
            </div>;
          })}
        </div>
      </section>
      {move && <div className={'schedule-drag-ghost schedule-tone ' + scheduleTone(move.event)} aria-hidden="true"
        style={{left: move.x + 14, top: move.y + 14}}>
        <strong>{eventTitle(move.event)}</strong>
        <small>{moveRange ? rangeLabel(moveRange) : '같은 날짜'}</small>
      </div>}
      <section className="schedule-week-panel" aria-labelledby="schedule-week-heading">
        <div className="schedule-week-heading">
          <div>
            <h2 id="schedule-week-heading">{weekTitle} 일정</h2>
            <p>{shortDay(days[0])} ~ {shortDay(days[6])}</p>
          </div>
          <div>
            <button className="career-button schedule-arrow" aria-label="이전 주" onClick={() => setWeekAnchor(addDays(days[0], -7))}><ChevronLeft size={15}/></button>
            <button className="career-button" disabled={weekOffset === 0} onClick={() => setWeekAnchor(today)}>이번 주</button>
            <button className="career-button schedule-arrow" aria-label="다음 주" onClick={() => setWeekAnchor(addDays(days[0], 7))}><ChevronRight size={15}/></button>
          </div>
        </div>
        <ol className="schedule-week-days">
          {agenda.map(({day, events: dayEvents}) => <li key={day}
            className={'schedule-week-day' + (day === today ? ' today' : '') + (dayEvents.length ? '' : ' idle')}>
            <div className="schedule-week-date"><span>{weekdayName(day)}</span><strong>{dayNumber(day)}</strong></div>
            {dayEvents.length > 0 && <ul>{dayEvents.map(event =>
              <li key={(event.applicationId || '') + '/' + event.id + '/' + event.date}
                className={'schedule-week-item schedule-tone ' + scheduleTone(event) + (event.done ? ' completed' : '')}>
                {isTask(event) && <Checkbox event={event} onToggle={completeEvent}/>}
                <button type="button" className="schedule-week-main" onClick={() => showDetail(event)}>
                  {event.time && <small className="time">{event.time}{event.endTime && ' ~ ' + event.endTime}</small>}
                  <strong>{event.company || eventTitle(event)}</strong>
                  {event.company && <em>{eventTitle(event)}</em>}
                  {event.note && <p>{event.note}</p>}
                </button>
              </li>)}</ul>}
          </li>)}
        </ol>
      </section>
    </div>
    {dialog?.type === 'undated' && <Modal title="날짜 미정 일정" onClose={() => setDialog(null)}>
      <div className="dashboard-schedule-list">
        {undated.map(event => <button key={event.applicationId + '/' + event.id}
          onClick={() => edit({...event, start: selected, end: selected})}>
          <span><strong>{event.title}</strong><small>{event.company}</small></span><ChevronRight size={15}/>
        </button>)}
      </div>
    </Modal>}
    {dialog?.type === 'detail' && <ScheduleDetail event={dialog.event} onClose={() => setDialog(null)}
      onEdit={() => edit(dialog.event)} onRemove={() => removeTarget(dialog.event)}
      onToggle={completeEvent}
      onPrepare={dialog.event.type === '면접' ? () => navigate('/interviews/' + dialog.event.applicationId) : undefined}/>}
    {dialog?.type === 'form' && <ScheduleForm dialog={dialog} applications={applications} onClose={() => setDialog(null)}
      onSave={save} onRemove={dialog.item.id ? () => setDialog({...dialog, type: 'remove'}) : undefined}
      onPrepare={dialog.item.type === '면접' ? () => navigate('/interviews/' + dialog.item.applicationId) : undefined}/>}
    {dialog?.type === 'remove' && <Modal title="일정 삭제" onClose={() => setDialog(null)}>
      <p>{dialog.item.title} 일정을 삭제할까요?</p>
      {dialog.item.deadline && <p className="muted">지원 건의 마감일과 마감 시간이 지워져요.</p>}
      {dialog.item.repeat && <p className="muted">이 일정의 모든 반복 날짜가 삭제돼요.</p>}
      <div className="form-actions"><button className="button" onClick={() => setDialog(dialog.from ? {type: 'detail', event: dialog.from} : {...dialog, type: 'form'})}>취소</button>
        <button className="button danger" onClick={remove}>삭제</button></div>
    </Modal>}
    {dialog?.type === 'repeat' && <Modal title={(dialog.item.repeat === 'weekly' ? '매주 반복' : '매일 반복') + ' · ' + formatDay(dialog.date)} onClose={() => setDialog(null)}>
      <p>{dialog.item.title}</p><div className="schedule-repeat-actions">
        {dialog.item.kind === 'task' && <button className="button primary" onClick={toggleComplete}>
          {dialog.done ? '완료 취소' : '이 날짜 완료 표시'}
        </button>}
        <button className="button" onClick={() => setDialog({...dialog, type: 'form', scope: 'date', original: dialog.item,
          item: {...dialog.item, start: dialog.date, end: dialog.date, repeat: false}})}>이 날짜만 수정</button>
        <button className="button" onClick={() => setDialog({...dialog, type: 'form'})}>전체 반복 수정</button>
        <button className="button" onClick={() => {
          onItemsChange(previous => previous.flatMap(item => item.id === dialog.item.id ? replaceOccurrence(item, dialog.date) : [item]));
          setDialog(null);
        }}>이 날짜만 건너뛰기</button>
      </div>
    </Modal>}
  </>;
}
