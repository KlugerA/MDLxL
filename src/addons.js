import { COMMANDS } from './commands.js';

// API v1 deliberately offers declarative editor commands: add-ons never execute
// code at install/startup, and command enablement remains owned by the editor.
const commands = new Set(COMMANDS.map(action=>action.id));
export function validateAddon(input) {
  const value=typeof input==='string'?JSON.parse(input):input;
  if(value?.schema!=='mdlxl-addon' || value.apiVersion!==1)throw new Error('Unsupported add-on API. Expected mdlxl-addon version 1.');
  if(!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(value.id||''))throw new Error('Invalid add-on ID.');
  if(typeof value.name!=='string'||!value.name.trim()||value.name.length>80)throw new Error('Add-on needs a name of 1–80 characters.');
  if(!Array.isArray(value.actions)||!value.actions.length||value.actions.length>32)throw new Error('An add-on needs 1–32 actions.');
  const seen=new Set();
  const actions=value.actions.map(action=>{
    if(!/^[a-z0-9._-]{1,64}$/.test(action?.id||'')||seen.has(action.id))throw new Error('Action IDs must be valid and unique.');
    seen.add(action.id);
    if(typeof action.label!=='string'||!action.label.trim()||action.label.length>100)throw new Error('Each action needs a short label.');
    if(!commands.has(action.command))throw new Error('Unknown editor command: '+action.command);
    return {id:action.id,label:action.label,command:action.command};
  });
  return {schema:'mdlxl-addon',apiVersion:1,id:value.id,name:value.name,actions};
}
export function installAddon(installed,input) {
  const addon=validateAddon(input);
  if(installed.some(item=>item.id===addon.id))throw new Error('An add-on with this ID is already installed. Remove it before installing a replacement.');
  return [...installed,{...addon,enabled:true}];
}
export function loadAddons(text) {
  const value=JSON.parse(text||'[]');if(!Array.isArray(value))throw new Error('Invalid saved add-on list.');
  let result=[];
  for(const entry of value) {result=installAddon(result,entry);result.at(-1).enabled=entry.enabled===true;}
  return result;
}
