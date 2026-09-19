/** One bounded step per wheel event; disabled options and groups are skipped. */
export function wheelOptionIndex(options, index, deltaY) {
  if (!deltaY) return index;
  const direction = deltaY > 0 ? 1 : -1;
  for (let next=index+direction; next>=0 && next<options.length; next+=direction) {
    if (!options[next].disabled && !options[next].parentElement?.disabled) return next;
  }
  return index;
}
export function bindDropdownWheel(targetDocument) {
  const wheel = event => {
    const select = event.target.closest?.('select');
    if (!select || select.disabled || select.multiple || select.size>1 || event.ctrlKey || event.metaKey || !event.deltaY) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const index = wheelOptionIndex(select.options, select.selectedIndex, event.deltaY);
    if (index === select.selectedIndex) return;
    const setter = Object.getOwnPropertyDescriptor(targetDocument.defaultView.HTMLSelectElement.prototype, 'selectedIndex').set;
    setter.call(select,index);
    select.dispatchEvent(new targetDocument.defaultView.Event('change',{bubbles:true}));
  };
  targetDocument.addEventListener('wheel',wheel,{capture:true,passive:false});
  return () => targetDocument.removeEventListener('wheel',wheel,true);
}
