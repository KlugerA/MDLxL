import React from 'react';

export default function BoneToolIcon({ kind, size = 20 }) {
  const bone = <path d="M5 7a2 2 0 1 1 3-2l8 8a2 2 0 1 1 2 3 2 2 0 1 1-3 2L7 10a2 2 0 1 1-2-3Z" fill="#2d78ed" stroke="#184389" strokeWidth="1.2"/>;
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    {kind === 'delete' && <><rect x="3" y="3" width="18" height="18" rx="3" fill="#a72222"/><path d="M7 12h10" stroke="white" strokeWidth="3" strokeLinecap="round"/></>}
    {kind === 'create' && <><rect x="3" y="3" width="18" height="18" rx="3" fill="#20883a"/><path d="M12 6v12M6 12h12" stroke="white" strokeWidth="3" strokeLinecap="round"/></>}
    {kind === 'attach' && <><rect x="2" y="8" width="7" height="7" fill="#3bba4c" stroke="#146b28"/><rect x="15" y="8" width="7" height="7" fill="#3bba4c" stroke="#146b28"/><path d="M9 11.5h6" stroke="#d12727" strokeWidth="2.5"/></>}
    {kind === 'detach' && <><rect x="2" y="8" width="7" height="7" fill="#c72828" stroke="#751414"/><rect x="15" y="8" width="7" height="7" fill="#c72828" stroke="#751414"/></>}
    {kind === 'soft' && <>{bone}<circle cx="18" cy="5" r="5" fill="#279842"/><path d="M18 2v6M15 5h6" stroke="white" strokeWidth="1.6"/></>}
    {kind === 'hard' && <>{bone}<circle cx="18" cy="5" r="4" fill="#29b64a" stroke="#126528"/></>}
    {kind === 'detachVertices' && <><circle cx="3" cy="17" r="2" fill="#d32626"/><circle cx="6" cy="11" r="2" fill="#d32626"/><circle cx="9" cy="5" r="2" fill="#d32626"/><path d="M3 21 20 3" stroke="#151515" strokeWidth="2"/><path d="m14 15 4-2 4 2v5l-4 2-4-2Z" fill="#40b455" stroke="#1c6f2c"/></>}
    {kind === 'bone' && bone}
    {kind === 'attachment' && <><circle cx="12" cy="5" r="3" fill="#c84141" stroke="#872020"/><path d="M12 8v11l-2 3" stroke="#454545" strokeWidth="2"/><path d="M8 10h8" stroke="#454545" strokeWidth="2"/></>}
  </svg>;
}
