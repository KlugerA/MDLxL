import React, { useEffect, useRef, useState } from 'react';

// Keep an editable string while focused: clearing "48" must not insert "6".
export default function ShowcaseNumber({value,onChange,min,max,...props}) {
  const [draft,setDraft]=useState(String(value)),focused=useRef(false),cancelled=useRef(false);
  useEffect(()=>{if(!focused.current)setDraft(String(value));},[value]);
  function commit(){
    const parsed=draft.trim()===''?Number(value):Number(draft);
    const next=Math.max(min,Math.min(max,Number.isFinite(parsed)?parsed:Number(value)));
    setDraft(String(next));onChange(next);
  }
  return <input {...props} type="number" min={min} max={max} value={draft}
    onFocus={()=>{focused.current=true;}} onChange={event=>{const text=event.target.value;setDraft(text);const number=Number(text);if(text.trim()!==''&&Number.isFinite(number)&&number>=min&&number<=max)onChange(number);}}
    onBlur={()=>{focused.current=false;if(cancelled.current){cancelled.current=false;setDraft(String(value));}else commit();}} onKeyDown={event=>{event.stopPropagation();if(event.key==='Enter')event.currentTarget.blur();if(event.key==='Escape'){cancelled.current=true;event.currentTarget.blur();}}}/>;
}
