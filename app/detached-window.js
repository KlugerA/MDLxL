export const UV_WINDOW_NAME = 'MDLxL-UV';
export function openOptimizeXLWindow(hostWindow = window) {
  const child = hostWindow.open('about:blank', 'MDLxL-OptimizeXL', 'popup=yes,width=1280,height=800');
  child?.focus();
  return child;
}

export function openDetachedUVWindow(hostWindow = window) {
  const child = hostWindow.open('about:blank', UV_WINDOW_NAME, 'popup=yes,width=900,height=700');
  child?.focus();
  return child;
}
