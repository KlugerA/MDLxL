import React, { useRef } from 'react';
import { allGeosets, chooseGeosets, invertGeosets } from '../src/classic-selection.js';

// Same column order, checkbox/range selection and styling as Vertices.
// Checked means excluded here; this selection never controls visibility.
export default function OptimizeXLGeosets({count,excluded,onChange,hovered,onHover,highlight,onHighlight,color}) {
  const anchor=useRef(0);
  function choose(index,event) {
    const shift=!!(event.shiftKey||event.nativeEvent?.shiftKey),ctrl=!!(event.ctrlKey||event.metaKey||event.nativeEvent?.ctrlKey);
    onChange(chooseGeosets(excluded,index,{shift,ctrl,checked:event.target.checked,anchor:anchor.current,count}));
    if(!shift)anchor.current=index;
  }
  return <div className="classic-geosets ox-geosets">
    <div className="classic-geosets-heading">Exclude geosets</div>
    <label className="check"><input type="checkbox" checked={highlight} onChange={e=>onHighlight(e.target.checked)}/>Highlight Geoset</label>
    <div className="classic-selection-actions"><button onClick={()=>onChange(allGeosets(count))}>All</button><button onClick={()=>onChange(new Set())}>Clear</button><button onClick={()=>onChange(invertGeosets(excluded,count))}>Invert</button></div>
    <div className="classic-geoset-list" style={{'--geoset-rows':Math.max(1,Math.ceil(count/4)),'--ox-hover-color':color}} role="listbox" aria-label="Excluded geosets" aria-multiselectable="true">
      {Array.from({length:count},(_,i)=><div key={i} className={`geoset-row${excluded.has(i)?' selected':''}${hovered===i?' hovered':''}`} role="option" aria-selected={excluded.has(i)}>
        <label className="geoset-hover-target" onMouseEnter={()=>onHover(i)} onMouseLeave={()=>onHover(null)}><input type="checkbox" aria-label={`Exclude geoset ${i+1}`} checked={excluded.has(i)} onChange={event=>choose(i,event)}/><span>{i+1}</span></label>
      </div>)}
    </div>
    <div className="classic-geoset-count">{excluded.size} excluded · remain visible</div>
  </div>;
}
