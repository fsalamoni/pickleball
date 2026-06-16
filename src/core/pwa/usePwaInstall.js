import { useCallback, useEffect, useState } from 'react';
import { PWA_ENABLED } from './registerPwa';

function detectIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOSDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS recente se identifica como Mac, mas tem touch.
  const isIPadOS = /macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document;
  return isIOSDevice || isIPadOS;
}

function detectStandalone() {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  return Boolean(mql || window.navigator.standalone);
}

/**
 * Estado de instalação do PWA. No-op (tudo falso) quando a flag está desligada.
 * - canPrompt: navegador suporta o prompt nativo (Android/Chrome/Edge).
 * - isIOS: precisa de instruções manuais (Safari não expõe prompt).
 * - installed: já está rodando como app instalado.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => detectStandalone());
  const isIOS = PWA_ENABLED ? detectIOS() : false;

  useEffect(() => {
    if (!PWA_ENABLED) return undefined;

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => null);
    setDeferredPrompt(null);
    return choice?.outcome ?? null;
  }, [deferredPrompt]);

  const enabled = PWA_ENABLED && !installed;

  return {
    enabled,
    installed,
    isIOS,
    canPrompt: Boolean(deferredPrompt),
    // Mostra o CTA sempre que o PWA está ligado e ainda não foi instalado.
    // O clique decide o caminho: prompt nativo, instruções iOS ou genéricas.
    available: enabled,
    promptInstall,
  };
}
