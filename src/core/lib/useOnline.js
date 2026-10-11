import { useSyncExternalStore } from 'react';

function subscribe(cb) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}
const get = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

/** `navigator.onLine` reativo. No servidor/teste sem navegador, sempre `true`. */
export function useOnline() {
  return useSyncExternalStore(subscribe, get, () => true);
}
