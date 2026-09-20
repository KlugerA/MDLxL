import React from 'react';
import { translate } from '../src/localization.js';
const textProps=['title','aria-label','aria-description','placeholder','alt','data-warmkey-label'];
function textChildren(value){return typeof value==='string'?translate(value):Array.isArray(value)?value.map(textChildren):value;}
/** JSX presentation adapter. Preserve original values, event handlers, IDs and refs. */
export function localizedCreateElement(type, props, ...children) {
  if(typeof type!=='string' || props?.translate==='no')return React.createElement(type,props,...children);
  const next={...props};for(const key of textProps)if(typeof next[key]==='string')next[key]=translate(next[key]);
  // An option's implicit value must not change when its visible label changes.
  if(type==='option' && next.value===undefined && children.length===1 && typeof children[0]==='string')next.value=children[0];
  if(type==='input' && ['button','submit','reset'].includes(next.type))next.value=translate(next.value);
  if(next.children!==undefined)next.children=textChildren(next.children);
  return React.createElement(type,next,...(['textarea','script','style','code','pre'].includes(type)?children:children.map(textChildren)));
}
