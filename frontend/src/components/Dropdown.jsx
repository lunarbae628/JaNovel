import React, {useId, useLayoutEffect, useRef, useState} from 'react';
import {Check, ChevronDown} from 'lucide-react';
import './dropdown.css';

const optionValue = option => typeof option === 'string' ? option : option.value;
const optionText = option => typeof option === 'string' ? option : option.label;

function focusOption(menu, option) {
  if (!option) return;
  option.focus({preventScroll: true});
  const {top, bottom} = option.getBoundingClientRect();
  const bounds = menu.getBoundingClientRect();
  if (top < bounds.top) menu.scrollTop -= bounds.top - top;
  if (bottom > bounds.bottom) menu.scrollTop += bottom - bounds.bottom;
}

export default function Dropdown({label, value, options, onChange, field = false, placeholder = '선택',
  disabled = false, className = '', triggerClassName = ''}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const selected = options.flatMap(item => item.options || [item]).find(item => optionValue(item) === value);
  const text = selected === undefined ? placeholder : optionText(selected);

  useLayoutEffect(() => {
    if (!open) return;
    const popup = menu.current;
    function position(event) {
      if (event?.target === popup) return;
      const viewport = document.documentElement;
      const bounds = trigger.current.getBoundingClientRect();
      const margin = 8;
      const gap = 6;
      const below = viewport.clientHeight - bounds.bottom - gap - margin;
      const above = bounds.top - gap - margin;
      popup.style.setProperty('--dropdown-anchor', Math.min(bounds.width, viewport.clientWidth - 2 * margin) + 'px');
      const up = below < Math.min(popup.scrollHeight + 2, 248) && above > below;
      const width = popup.offsetWidth;
      popup.style.maxHeight = Math.max(0, up ? above : below) + 'px';
      popup.style.left = Math.max(margin, Math.min(bounds.left, viewport.clientWidth - width - margin)) + 'px';
      popup.style.top = (up ? bounds.top - gap - popup.offsetHeight : bounds.bottom + gap) + 'px';
    }
    function dismiss(event) {
      if (!root.current.contains(event.target)) setOpen(false);
    }
    position();
    focusOption(popup, popup.querySelector('[aria-checked="true"]') || popup.querySelector('button'));
    document.addEventListener('pointerdown', dismiss);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);

  function close() {
    trigger.current.focus({preventScroll: true});
    setOpen(false);
  }

  function handleKey(event) {
    if (!open) {
      if (!disabled && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === 'Tab' || event.key === 'Escape') {
      if (event.key === 'Escape') event.preventDefault();
      close();
      return;
    }
    const items = [...menu.current.querySelectorAll('button')];
    const index = items.indexOf(document.activeElement);
    const targets = {
      ArrowDown: (index + 1) % items.length,
      ArrowUp: (index <= 0 ? items.length - 1 : index - 1),
      Home: 0,
      End: items.length - 1,
    };
    if (Object.hasOwn(targets, event.key)) {
      event.preventDefault();
      focusOption(menu.current, items[targets[event.key]]);
    } else if (event.key.length === 1 && event.key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const next = [...items.slice(index + 1), ...items.slice(0, index + 1)]
        .find(item => item.textContent.trim().toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
      if (next) {
        event.preventDefault();
        focusOption(menu.current, next);
      }
    }
  }

  function renderOption(option) {
    const key = optionValue(option);
    return <button key={key} type="button" role="menuitemradio" aria-checked={key === value} tabIndex={-1}
      onClick={() => {close(); onChange(key);}}>
      {key === value && <Check size={15} aria-hidden="true"/>}<span>{optionText(option)}</span>
    </button>;
  }

  return <div className={['dropdown', field && 'field', className].filter(Boolean).join(' ')} data-dropdown ref={root}
    onKeyDown={handleKey} onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);}}>
    {field && <span>{label}</span>}
    <button className={['dropdown-trigger', triggerClassName].filter(Boolean).join(' ')} ref={trigger} type="button"
      disabled={disabled || !options.length} aria-haspopup="menu" aria-expanded={open} aria-label={label + ' · ' + text}
      aria-controls={open ? id : undefined} onClick={() => setOpen(current => !current)}>
      <span>{text}</span><ChevronDown size={15} aria-hidden="true"/>
    </button>
    {open && <div className="dropdown-menu" id={id} ref={menu} role="menu" aria-label={label}>
      {options.map(option => option.options ?
        <div className="dropdown-group" key={option.label} role="group" aria-label={option.label}>
          <div className="dropdown-group-label" aria-hidden="true">{option.label}</div>
          {option.options.map(renderOption)}
        </div> : renderOption(option))}
    </div>}
  </div>;
}
