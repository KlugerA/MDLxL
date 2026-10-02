import {useEffect,useLayoutEffect,useRef} from 'react';

/** Wheel zoom stays under the pointer; middle/right drag pans either image view. */
export function usePaintImageNavigation(scroll,image,zoom,setZoom,onNavigate){
  const current=useRef(),anchor=useRef(),pan=useRef();
  current.current={zoom,setZoom,onNavigate};
  useEffect(()=>{
    const element=scroll.current;
    const wheel=e=>{
      if(!image.current)return;e.preventDefault();current.current.onNavigate?.();
      const rect=image.current.getBoundingClientRect(),z=current.current.zoom;
      anchor.current={x:(e.clientX-rect.left)/z,y:(e.clientY-rect.top)/z,clientX:e.clientX,clientY:e.clientY};
      current.current.setZoom(Math.max(.05,Math.min(32,z*Math.exp(-e.deltaY*.002))));
    };
    element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);
  },[]);
  useLayoutEffect(()=>{
    const a=anchor.current;if(!a)return;anchor.current=null;
    const rect=image.current.getBoundingClientRect();scroll.current.scrollLeft+=rect.left+a.x*zoom-a.clientX;scroll.current.scrollTop+=rect.top+a.y*zoom-a.clientY;
  },[zoom]);
  return {
    onContextMenu:e=>e.preventDefault(),
    onPointerDownCapture:e=>{if(e.button!==1&&e.button!==2)return;e.preventDefault();e.stopPropagation();current.current.onNavigate?.();pan.current={x:e.clientX,y:e.clientY,left:scroll.current.scrollLeft,top:scroll.current.scrollTop};scroll.current.setPointerCapture(e.pointerId);},
    onPointerMoveCapture:e=>{const p=pan.current;if(!p)return;e.preventDefault();e.stopPropagation();scroll.current.scrollLeft=p.left+p.x-e.clientX;scroll.current.scrollTop=p.top+p.y-e.clientY;},
    onPointerUpCapture:e=>{if(!pan.current)return;pan.current=null;e.stopPropagation();if(scroll.current.hasPointerCapture(e.pointerId))scroll.current.releasePointerCapture(e.pointerId);},
    onPointerCancel:()=>{pan.current=null;},
  };
}
