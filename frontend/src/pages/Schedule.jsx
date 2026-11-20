import React, {useRef, useState} from 'react';
import {Check, ChevronLeft, ChevronRight, Plus, Repeat2} from 'lucide-react';
import Dropdown from '../components/Dropdown.jsx';
import {Field, Modal, Notice} from '../components/UI.jsx';
import {allEvents} from './Applications.jsx';
import {uid} from '../model.js';
import {
  applicationEventTypes, calendarWeeks, completeOccurrence, isDateKey, packWeek, projectSchedule, replaceOccurrence,
  removeApplicationEvent, saveApplicationEvent, scheduleColors, scheduleLegend, scheduleTone, todayKey, validateScheduleItem,
} from '../schedule.js';

const colors = ['기본', '파랑', '보라', '초록', '황토', '분홍'];
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const formatDay = key => new Intl.DateTimeFormat('ko-KR', {
  month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC',
}).format(new Date(key));
const personalItem = (start, end = start) => ({
  title: '', kind: 'event', start, end, time: '', endTime: '', note: '', color: 'default',
  repeat: false, repeatUntil: '', completed: [], skipped: [],
});

function ScheduleForm({dialog, applications, onClose, onSave, onRemove, onComplete, onPrepare}) {
  const [data, setData] = useState(dialog.item);
  const [allDay, setAllDay] = useState(!data.time);
  const [error, setError] = useState('');
  const change = (key, value) => setData(previous => ({...previous, [key]: value}));
  const support = Boolean(data.applicationId);
  const deadline = Boolean(data.deadline);
  const conflict = data.repeat && data.start !== data.end;

  return <Modal title={deadline ? '지원 마감 수정' : data.id ? '일정 수정' : '일정 추가'} onClose={onClose} className="schedule-modal">
    <form onSubmit={event => {
      event.preventDefault();
      const next = {...data, title: data.title.trim(), time: allDay ? '' : data.time,
        endTime: allDay ? '' : data.endTime ?? '', repeatUntil: data.repeat ? data.repeatUntil : ''};
      const problem = validateScheduleItem(next);
      if (problem) setError(problem); else onSave(next);
    }}>
      {!deadline && applications.length > 0 && <Dropdown field label="연결할 지원"
        value={data.applicationId || ''} disabled={Boolean(data.id)}
        options={[{value: '', label: '개인 일정'}, ...applications.map(item => ({value: item.id, label: item.company + ' · ' + item.role}))]}
        onChange={applicationId => setData(previous => ({...previous, applicationId,
          ...(applicationId && {kind: 'event', repeat: false, repeatUntil: ''})}))}/>}
      <Field label="제목"><input value={data.title} maxLength={100} required onChange={event => change('title', event.target.value)}/></Field>
      {support && !deadline && <Dropdown field label="종류" value={data.type || '면접'}
        options={[...new Set([...applicationEventTypes, data.type || '면접'])]} onChange={value => change('type', value)}/>}
      <div className="form-grid">
        <Field label={deadline ? '마감일' : '시작일'}><input type="date" required value={data.start} onChange={event => {
          const start = event.target.value;
          setData(previous => ({...previous, start, end: previous.start === previous.end ? start : previous.end}));
        }}/></Field>
        {!deadline && <Field label="종료일"><input type="date" required value={data.end} onChange={event => change('end', event.target.value)}/></Field>}
      </div>
      <label className="schedule-checkbox"><input type="checkbox" checked={allDay} onChange={event => setAllDay(event.target.checked)}/>{deadline ? '시간 미정' : '종일'}</label>
      {!allDay && <div className="form-grid">
        <Field label={deadline ? '마감 시간' : '시작 시간'}><input type="time" value={data.time} onChange={event => change('time', event.target.value)}/></Field>
        {!deadline && <Field label="종료 시간"><input type="time" value={data.endTime || ''} onChange={event => change('endTime', event.target.value)}/></Field>}
      </div>}
      {!support && dialog.scope !== 'date' && <>
        <div className="form-grid">
          <Dropdown field label="반복" value={data.repeat ? 'daily' : 'none'}
            options={[{value: 'none', label: '반복 안 함'}, {value: 'daily', label: '매일'}]}
            onChange={value => change('repeat', value === 'daily')}/>
          <Dropdown field label="관리 방식" value={data.kind}
            options={[{value: 'event', label: '일반 일정'}, {value: 'task', label: '체크리스트'}]}
            onChange={value => change('kind', value)}/>
        </div>
        {conflict && <Notice type="error">일일 반복은 하루 일정에만 설정할 수 있어요.</Notice>}
        {data.repeat && <Field label="반복 종료일" hint="비워 두면 계속 반복해요.">
          <input type="date" value={data.repeatUntil || ''} onChange={event => change('repeatUntil', event.target.value)}/>
        </Field>}
      </>}
      <fieldset className="schedule-palette"><legend>색상</legend>
        {scheduleColors.map((color, i) => <button key={color} type="button" className={'schedule-swatch schedule-tone ' + (color === 'default' ? scheduleTone({...data, color}) : color)}
          aria-label={colors[i]} title={colors[i]} aria-pressed={data.color === color} onClick={() => change('color', color)}/>)}
      </fieldset>
      <Field label="메모"><textarea value={data.note} rows={2} maxLength={240}
        onChange={event => change('note', event.target.value)}/></Field>
      {error && !conflict && <Notice type="error">{error}</Notice>}
      {(onComplete || onPrepare) && <div className="schedule-context-actions">
        {onComplete && <button type="button" className="button" onClick={onComplete}>{dialog.done ? '완료 취소' : '완료 표시'}</button>}
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

export default function Schedule({store, initialDate, navigate, onItemsChange, onApplicationChange}) {
  const today = todayKey();
  const [selected, setSelected] = useState(isDateKey(initialDate) ? initialDate : today);
  const [month, setMonth] = useState(selected.slice(0, 7) + '-01');
  const [drag, setDrag] = useState(null);
  const anchor = useRef('');
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
    jump(start);
    setDialog({type: 'form', item: personalItem(start, end)});
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
    setDialog(null);
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

  function finishRange(event) {
    if (!anchor.current) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const cell = target?.closest('[data-day]') || Array.from(target?.closest('.schedule-week')?.querySelectorAll('[data-day]') || [])
      .find(item => {
        const {left, right} = item.getBoundingClientRect();
        return left <= event.clientX && event.clientX < right;
      });
    const end = cell?.dataset.day;
    const start = anchor.current;
    anchor.current = '';
    setDrag(null);
    if (!end || end === start) return;
    const [first, last] = [start, end].sort();
    add(first, last);
  }

  return <>
    <div className="career-content career-full-width schedule-content">
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
        <div className="schedule-legend">{scheduleLegend.map(([label, tone]) =>
          <span className={'schedule-tone ' + tone} key={label}>{label}</span>)}</div>
        <div className="schedule-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
        <div className="schedule-calendar" style={{'--week-count': weeks.length}} onPointerUp={finishRange} onPointerCancel={() => {anchor.current = ''; setDrag(null);}}
          onPointerLeave={() => {anchor.current = ''; setDrag(null);}}>
          {weeks.map(days => {
            const bars = packWeek(events, days);
            const lanes = Math.max(2, ...bars.map(bar => bar.lane + 1));
            return <div className="schedule-week" key={days[0]} style={{'--lanes': lanes}}>
              {days.map((day, index) => {
                const marked = drag && day >= drag[0] && day <= drag[1];
                return <div data-day={day} key={day} className={'schedule-cell' + (day === selected ? ' selected' : '') + (marked ? ' range' : '')}
                  style={{gridColumn: index + 1}} onPointerEnter={() => {
                    if (anchor.current) setDrag([anchor.current, day].sort());
                  }}>
                  <button type="button" className={'schedule-day' + (day === today ? ' today' : '') + (day.slice(0, 7) !== month.slice(0, 7) ? ' outside' : '')}
                    aria-label={formatDay(day) + ' 선택'} aria-pressed={day === selected}
                    onPointerDown={event => {
                      if (event.button !== 0 || event.pointerType === 'touch') return;
                      anchor.current = day;
                    }}
                    onClick={() => setSelected(day)} onDoubleClick={() => add(day)}>
                    {Number(day.slice(8))}
                  </button>
                  {day === selected && <button type="button" className="schedule-cell-add"
                    aria-label={formatDay(day) + ' 일정 추가'} onClick={() => add(day)}><Plus size={13}/></button>}
                </div>;
              })}
              {bars.map(({event, startColumn, endColumn, lane}) => <button type="button"
                key={(event.applicationId || '') + '/' + event.id + '/' + event.date}
                className={'schedule-bar schedule-tone ' + scheduleTone(event) + (event.done ? ' completed' : '')}
                style={{gridColumn: startColumn + ' / ' + endColumn, gridRow: lane + 2}}
                title={[event.title, event.type || (event.kind === 'task' ? '체크리스트' : '일정'), '더블클릭하여 수정·삭제'].join(' · ')}
                aria-label={[event.company, event.title, formatDay(event.date),
                  event.type || (event.kind === 'task' && (event.done ? '완료' : '할 일')), '수정 및 삭제'].filter(Boolean).join(' · ')}
                onClick={click => {
                  setSelected(days[startColumn - 1]);
                  if (!click.detail || click.nativeEvent.pointerType === 'touch') edit(event);
                }}
                onDoubleClick={() => edit(event)}>
                {event.company && <strong>{event.company}</strong>}
                <span>{event.title}{event.time ? ' ' + event.time : ''}</span>
                {event.done ? <Check size={13} aria-hidden="true"/> : event.repeat && <Repeat2 size={13} aria-hidden="true"/>}
              </button>)}
            </div>;
          })}
        </div>
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
    {dialog?.type === 'form' && <ScheduleForm dialog={dialog} applications={applications} onClose={() => setDialog(null)}
      onSave={save} onRemove={dialog.item.id ? () => setDialog({...dialog, type: 'remove'}) : undefined}
      onComplete={dialog.item.kind === 'task' && dialog.date && !dialog.item.repeat && !dialog.scope ? toggleComplete : undefined}
      onPrepare={dialog.item.type === '면접' ? () => navigate('/interviews/' + dialog.item.applicationId) : undefined}/>}
    {dialog?.type === 'remove' && <Modal title="일정 삭제" onClose={() => setDialog(null)}>
      <p>{dialog.item.title} 일정을 삭제할까요?</p>
      {dialog.item.deadline && <p className="muted">지원 건의 마감일과 마감 시간이 지워져요.</p>}
      {dialog.item.repeat && <p className="muted">이 일정의 모든 반복 날짜가 삭제돼요.</p>}
      <div className="form-actions"><button className="button" onClick={() => setDialog({...dialog, type: 'form'})}>취소</button>
        <button className="button danger" onClick={remove}>삭제</button></div>
    </Modal>}
    {dialog?.type === 'repeat' && <Modal title={'매일 반복 · ' + formatDay(dialog.date)} onClose={() => setDialog(null)}>
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
