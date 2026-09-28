import React from 'react';

export default function OptimizeXLReview({review,model,onInspect,onHover,onClose}) {
  const {stage,geosets,animations,removed}=review;
  const count=stage==='animation'?animations.length:stage==='unused'?removed.length:geosets.length;
  if(!count)return <p className="ox-review-empty">{stage==='animation'?'No animations changed.':stage==='unused'?'No unused data to remove.':'No geosets affected.'}</p>;
  const hover=index=>({onMouseEnter:()=>onHover(index),onMouseLeave:()=>onHover(null),onFocus:()=>onHover(index),onBlur:()=>onHover(null)});
  return <details className="ox-review" onToggle={event=>{if(!event.currentTarget.open){onHover(null);onClose();}}}>
    <summary>{stage==='animation'?'Changed animations':stage==='unused'?'Data to remove':'Geosets to review'} ({count})</summary>
    <div className="ox-review-list">
      {stage==='animation'&&animations.map(a=><button className="ox-review-animation" key={a.sequence} onClick={()=>onInspect(a)}>{a.changes} {a.changes===1?'change':'changes'} to animation {model.Sequences[a.sequence].Name}</button>)}
      {stage==='duplicates'&&geosets.map(row=><div className="ox-review-row" key={row.index} tabIndex={0} {...hover(row.index)}>Geoset {row.index+1}</div>)}
      {stage==='unused'&&removed.map((row,i)=><div className="ox-review-row" key={i} tabIndex={row.geoset!=null?0:undefined} {...hover(row.geoset??null)}>{row.label}</div>)}
    </div>
  </details>;
}
