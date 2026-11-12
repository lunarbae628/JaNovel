import React from'react';
export default function PanelResizer({side,value,min,max,onChange,controls}){
 function drag(e){e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);const start=e.clientX,width=value,node=e.currentTarget;
  const move=ev=>onChange(Math.max(min,Math.min(max,width+(side==='left'?ev.clientX-start:start-ev.clientX))));
  const end=()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);};
  node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
 }
 return <div className={'panel-resizer '+side} role="separator" aria-label={side==='left'?'버전 그래프 너비 조절':'AI 채팅 너비 조절'} aria-orientation="vertical" aria-valuenow={Math.round(value)} aria-valuemin={min} aria-valuemax={max} aria-controls={controls} tabIndex={0} onPointerDown={drag} onKeyDown={e=>{const direction=side==='left'?1:-1;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();onChange(Math.max(min,Math.min(max,value+(e.key==='ArrowRight'?1:-1)*direction*(e.shiftKey?32:8))));}if(e.key==='Home'||e.key==='End'){e.preventDefault();onChange(e.key==='Home'?min:max);}}}><span/></div>
}
