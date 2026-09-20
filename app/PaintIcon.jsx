import React from 'react';
import {Brush,FilePenLine,Save,MousePointer2,Move,RotateCw,Trash2,LampDesk,Plus,FolderOpen,Scissors,RefreshCw} from 'lucide-react';
const icons={paint:Brush,uv:FilePenLine,save:Save,select:MousePointer2,move:Move,rotate:RotateCw,delete:Trash2,lamp:LampDesk,new:Plus,import:FolderOpen,crop:Scissors,refresh:RefreshCw};
export default function PaintIcon({name}){
  const Icon=icons[name];if(Icon)return <Icon size={23} strokeWidth={1.65} aria-hidden="true"/>;
  return <svg viewBox="0 0 32 32" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name==='original'?<text x="16" y="21" textAnchor="middle" stroke="none" fill="currentColor" fontSize="14" fontWeight="bold" fontFamily="Tahoma, sans-serif">O.G</text>:name==='half'?<><path d="M16 3a4 4 0 0 0 0 8v-8ZM16 13c-6 0-9 4-9 10h5v6h4V13Z" fill="currentColor"/><path d="M18 3a4 4 0 0 1 0 8m0 2c5 0 8 4 8 10h-5v6h-3" strokeDasharray="2 3"/><path d="M17 1v30" opacity=".4"/></>:<>
      <path d="M26 29c2-5 3-9 2-13l-2-7c-.5-2-2-2.8-3.2-1.8l-5.4 4.6c-1.3 1.2.3 3.1 1.8 2.1l3.6-2.1.7 5.5-8-1.1-5.8-5.8c-1.5-1.5-3.8.5-2.2 2.3l4.4 5.8-3.7.2c-2.5.2-3.1 2.2-1.4 3.5l2.1 1.5c-1.1 1.3-.5 2.7 1 3.4l2.7 1.3c2.9 1.4 7 1.8 10.4 1.1"/>
      <path d="m13 21 5.9 2.4m-8.4.8 6.7 2.2m5.1-8.4-2.9 2.8"/><path d="M12 11h6M13 9l1-3h2l1 3m-3-5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z"/>
    </>}
  </svg>;
}
export function PaintTool({icon,label,active,onClick,disabled,children,action}){return <button className="paint-tool" title={label} aria-label={label} aria-pressed={active} onClick={onClick} disabled={disabled} data-warmkey={action} data-warmkey-badges="false"><PaintIcon name={icon}/>{children}</button>;}
