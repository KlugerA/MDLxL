import { useEffect, useRef, useState } from 'react';

/** Move the actual dialog by its title bar; controls keep their normal clicks. */
export default function useMovableWindow(ref) {
  const [position, setPosition] = useState(null), drag = useRef(null);
  const clamp = (left, top) => {
    const box = ref.current?.getBoundingClientRect(), owner = ref.current?.ownerDocument.defaultView;
    return box && owner ? { left: Math.max(0, Math.min(left, owner.innerWidth - box.width)), top: Math.max(0, Math.min(top, owner.innerHeight - box.height)) } : { left, top };
  };
  useEffect(() => {
    const owner = ref.current?.ownerDocument.defaultView;
    const resize = () => setPosition(old => old && clamp(old.left, old.top));
    owner?.addEventListener('resize', resize);
    return () => owner?.removeEventListener('resize', resize);
  }, []);
  return {
    style: position ? { position: 'fixed', ...position, margin: 0, transform: 'none' } : undefined,
    handleProps: {
      style: { cursor: 'move', touchAction: 'none', userSelect: 'none' },
      onPointerDown: event => {
        if (event.button !== 0 || event.target.closest('button,input,select,a')) return;
        const box = ref.current.getBoundingClientRect();
        drag.current = { x: event.clientX - box.left, y: event.clientY - box.top };
        event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: event => { if (drag.current) setPosition(clamp(event.clientX - drag.current.x, event.clientY - drag.current.y)); },
      onPointerUp: event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); },
      onPointerCancel: () => { drag.current = null; },
    },
  };
}
