import React, {useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, Plus, Repeat2} from 'lucide-react';
import {CareerHeader} from '../components/CareerLayout.jsx';
import {Field, Modal, Notice} from '../components/UI.jsx';
import {allEvents} from './Applications.jsx';
import {uid} from '../model.js';
import {
  calendarWeeks, completeOccurrence, isDateKey, packWeek, projectSchedule, replaceOccurrence,
  scheduleColors, todayKey, validateScheduleItem,
} from '../schedule.js';

const colors = ['기본', '파랑', '보라', '초록', '황토', '분홍'];
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const formatDay = key => new Intl.DateTimeFormat('ko-KR', {
  month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC',
}).format(new Date(key));
const short = date => date.slice(5).replace('-', '.');
const personalItem = (start, end = start) => ({
  title: '', kind: 'event', start, end, time: '', endTime: '', note: '', color: 'default',
  repeat: false, repeatUntil: '', completed: [], skipped: [],
});

function ScheduleForm({dialog, applications, onClose, onSave, onRemove}) {
  const [data, setData] = useState(dialog.item);
  const [allDay, setAllDay] = useState(!data.time);
  const [error, setError] = useState('');
  const change = (key, value) => setData(previous => ({...previous, [key]: value}));
  const support = Boolean(data.applicationId);
  const conflict = data.repeat && data.start !== data.end;

  return <Modal title={data.id ? '일정 수정' : '일정 추가'} onClose={onClose} className="schedule-modal">
    <form onSubmit={event => {
      event.preventDefault();
      const next = {...data, title: data.title.trim(), time: allDay ? '' : data.time,
        endTime: allDay ? '' : data.endTime ?? '', repeatUntil: data.repeat ? data.repeatUntil : ''};
      const problem = validateScheduleItem(next);
      if (problem) setError(problem); else onSave(next);
    }}>
      {applications.length > 0 && <Field label="연결할 지원">
        <select value={data.applicationId || ''} disabled={Boolean(data.id)} onChange={event => {
          const applicationId = event.target.value;
          setData(previous => ({...previous, applicationId,
            ...(applicationId && {kind: 'event', repeat: false, repeatUntil: ''})}));
        }}>
          <option value="">개인 일정</option>
          {applications.map(item => <option value={item.id} key={item.id}>{item.company} · {item.role}</option>)}
        </select>
      </Field>}
      <Field label="제목"><input value={data.title} maxLength={100} required onChange={event => change('title', event.target.value)}/></Field>
      {support && <Field label="종류"><select value={data.type || '면접'} onChange={event => change('type', event.target.value)}>
        {['면접', '과제', '코딩테스트', '기타'].map(type => <option key={type}>{type}</option>)}
      </select></Field>}
      <div className="form-grid">
        <Field label="시작일"><input type="date" required value={data.start} onChange={event => {
          const start = event.target.value;
          setData(previous => ({...previous, start, end: previous.start === previous.end ? start : previous.end}));
        }}/></Field>
        <Field label="종료일"><input type="date" required value={data.end} onChange={event => change('end', event.target.value)}/></Field>
      </div>
      <label className="schedule-checkbox"><input type="checkbox" checked={allDay} onChange={event => setAllDay(event.target.checked)}/>종일</label>
      {!allDay && <div className="form-grid">
        <Field label="시작 시간"><input type="time" value={data.time} onChange={event => change('time', event.target.value)}/></Field>
        <Field label="종료 시간"><input type="time" value={data.endTime || ''} onChange={event => change('endTime', event.target.value)}/></Field>
      </div>}
      {!support && dialog.scope !== 'date' && <>
        <div className="form-grid">
          <Field label="반복"><select value={data.repeat ? 'daily' : 'none'} onChange={event => change('repeat', event.target.value === 'daily')}>
            <option value="none">반복 안 함</option><option value="daily">매일</option>
          </select></Field>
          <Field label="관리 방식"><select value={data.kind} onChange={event => change('kind', event.target.value)}>
            <option value="event">일반 일정</option><option value="task">체크리스트</option>
          </select></Field>
        </div>
        {conflict && <Notice type="error">일일 반복은 하루 일정에만 설정할 수 있어요.</Notice>}
        {data.repeat && <Field label="반복 종료일" hint="비워 두면 계속 반복해요.">
          <input type="date" value={data.repeatUntil || ''} onChange={event => change('repeatUntil', event.target.value)}/>
        </Field>}
      </>}
      {!support && <fieldset className="schedule-palette"><legend>색상</legend>
        {scheduleColors.map((color, i) => <button key={color} type="button" className={'schedule-swatch ' + color}
          aria-label={colors[i]} title={colors[i]} aria-pressed={data.color === color} onClick={() => change('color', color)}/>)}
      </fieldset>}
      <Field label="메모"><input value={data.note} maxLength={240} onChange={event => change('note', event.target.value)}/></Field>
      {error && !conflict && <Notice type="error">{error}</Notice>}
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
    color: item.type === '면접' ? 'blue' : item.type === '과제' ? 'assignment' : 'default',
  }));
  const weeks = calendarWeeks(month);
  const events = [...supportEvents.filter(item => isDateKey(item.start)),
    ...projectSchedule(items, weeks[0][0], weeks.at(-1).at(-1))];
  const selectedEvents = events.filter(event => event.start <= selected && selected <= event.end);
  const tasks = selectedEvents.filter(event => event.kind === 'task');
  const entries = selectedEvents.filter(event => event.kind !== 'task');

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
    if (event.deadline) {
      navigate('/posting/' + event.applicationId);
    } else if (event.applicationId) {
      setDialog({type: 'form', item: {...personalItem(event.start, event.end), ...event}});
    } else {
      const item = items.find(item => item.id === event.id);
      setDialog({type: item.repeat ? 'repeat' : 'form', item, date: event.date});
    }
  }
  function save(next) {
    const id = next.id || uid('event');
    if (next.applicationId) {
      onApplicationChange(next.applicationId, application => ({
        ...application,
        events: [...application.events.filter(event => event.id !== id), {
          id, title: next.title, type: next.type || '면접', date: next.start, endDate: next.end,
          time: next.time, endTime: next.endTime, note: next.note,
        }],
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
      onApplicationChange(item.applicationId, application => ({...application, events: application.events.filter(event => event.id !== item.id)}));
    } else {
      onItemsChange(previous => previous.filter(event => event.id !== item.id));
    }
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
    <CareerHeader title="일정">
      <button type="button" className="career-button primary" onClick={() => add()}><Plus size={14}/>일정 추가</button>
    </CareerHeader>
    <div className="career-content schedule-content">
      <section className="schedule-month career-sheet" aria-label="월간 캘린더">
        <div className="schedule-month-heading">
          <h2>{Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월</h2>
          <div>
            <button className="career-button" onClick={() => jump(today)}>오늘</button>
            <button className="career-button schedule-arrow" aria-label="이전 달" onClick={() => moveMonth(-1)}><ChevronLeft size={15}/></button>
            <button className="career-button schedule-arrow" aria-label="다음 달" onClick={() => moveMonth(1)}><ChevronRight size={15}/></button>
          </div>
        </div>
        <div className="schedule-legend"><span>마감</span><span>면접</span><span>과제</span><span>일정</span></div>
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
                    aria-label={formatDay(day) + ' 일정 보기'} aria-pressed={day === selected}
                    onPointerDown={event => {
                      if (event.button !== 0 || event.pointerType === 'touch') return;
                      anchor.current = day;
                    }}
                    onClick={() => jump(day)}>
                    {Number(day.slice(8))}
                  </button>
                </div>;
              })}
              {bars.map(({event, startColumn, endColumn, lane}) => <button type="button"
                key={event.id + event.date} className={'schedule-bar ' + event.color + (event.done ? ' completed' : '')}
                style={{gridColumn: startColumn + ' / ' + endColumn, gridRow: lane + 2}}
                title={event.title} onClick={() => setSelected(days[startColumn - 1])}>
                {event.company && <strong>{event.company}</strong>}
                <span>{event.title}{event.time ? ' ' + event.time : ''}</span>
                {event.repeat && <Repeat2 size={13} aria-label="일일 반복"/>}
              </button>)}
            </div>;
          })}
        </div>
      </section>
      <aside className="schedule-detail career-sheet" aria-label="선택한 날짜">
        <header className="schedule-detail-heading">
          <h2 aria-live="polite">{formatDay(selected)}</h2>
          <span>일정 {entries.length}건{tasks.length > 0 && ' · 할 일 ' + tasks.length + '건'}</span>
        </header>
        {entries.map(event => <article className="schedule-detail-event" key={event.id + event.date}>
          <span className={'dashboard-stage ' + (event.type === '면접' ? 'accented' : '')}>{event.type || '일정'}</span>
          <h3>{event.company || event.title}</h3>
          {event.company && <p>{event.title}</p>}
          {event.start !== event.end && <p>{short(event.start)} – {short(event.end)}</p>}
          {(event.time || event.note) && <p>{[event.time, event.note].filter(Boolean).join(' · ')}</p>}
          {event.type === '면접' && <button className="career-button primary" onClick={() => navigate('/interviews/' + event.applicationId)}>면접 준비</button>}
          <button className="career-button" onClick={() => edit(event)}>일정 수정</button>
        </article>)}
        {tasks.length > 0 && <section className="schedule-tasks">
          <h3>체크리스트 {tasks.length}</h3>
          {tasks.map(event => <div className="schedule-task" key={event.id + event.date}>
            <label className="schedule-checkbox"><input type="checkbox" checked={event.done}
              onChange={e => {
                const done = e.target.checked;
                onItemsChange(previous => previous.map(item => item.id === event.id
                  ? completeOccurrence(item, event.date, done) : item));
              }}/><span>{event.title}</span></label>
            {(event.time || event.repeat) && <p>{[event.time, event.repeat && '매일'].filter(Boolean).join(' · ')}</p>}
            <button className="career-button" onClick={() => edit(event)}>할 일 수정</button>
          </div>)}
        </section>}
        {!selectedEvents.length && <div className="schedule-empty">
          <p>등록된 일정이 없어요.</p>
          <button className="career-button" onClick={() => add()}><Plus size={14}/>일정 추가</button>
        </div>}
        {supportEvents.some(event => !event.date) && <section className="schedule-tasks">
          <h3>날짜 미정</h3>
          {supportEvents.filter(event => !event.date).map(event => <button className="career-button" key={event.id}
            onClick={() => edit({...event, start: selected, end: selected})}>{event.company} · {event.title}</button>)}
        </section>}
      </aside>
    </div>
    {dialog?.type === 'form' && <ScheduleForm dialog={dialog} applications={applications} onClose={() => setDialog(null)}
      onSave={save} onRemove={dialog.item.id ? () => setDialog({...dialog, type: 'remove'}) : undefined}/>}
    {dialog?.type === 'remove' && <Modal title="일정 삭제" onClose={() => setDialog(null)}>
      <p>{dialog.item.title} 일정을 삭제할까요?</p>
      <div className="form-actions"><button className="button" onClick={() => setDialog(null)}>취소</button>
        <button className="button danger" onClick={remove}>삭제</button></div>
    </Modal>}
    {dialog?.type === 'repeat' && <Modal title={'매일 반복 · ' + formatDay(dialog.date)} onClose={() => setDialog(null)}>
      <p>{dialog.item.title}</p><div className="schedule-repeat-actions">
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
