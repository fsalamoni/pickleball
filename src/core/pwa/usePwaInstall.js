import { useSyncExternalStore } from 'react';
import { PWA_ENABLED } from './registerPwa';
import {
  abrirPedidoDeInstalacao,
  appFoiInstalado,
  assinarPedidoDeInstalacao,
  lerPedidoDeInstalacao,
} from './pedidoDeInstalacao';

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
 * O convite nativo vem de `pedidoDeInstalacao.js`, guardado desde a abertura.
 * - canPrompt: navegador suporta o prompt nativo (Android/Chrome/Edge).
 * - isIOS: precisa de instruções manuais (Safari não expõe prompt).
 * - installed: já está rodando como app instalado.
 */
export function usePwaInstall() {
  const pedido = useSyncExternalStore(assinarPedidoDeInstalacao, lerPedidoDeInstalacao, () => null);
  const instaladoAgora = useSyncExternalStore(assinarPedidoDeInstalacao, appFoiInstalado, () => false);
  const installed = instaladoAgora || detectStandalone();
  const isIOS = PWA_ENABLED ? detectIOS() : false;
  const enabled = PWA_ENABLED && !installed;

  return {
    enabled,
    installed,
    isIOS,
    canPrompt: PWA_ENABLED && Boolean(pedido),
    // Mostra o CTA sempre que o PWA está ligado e ainda não foi instalado.
    // O clique decide o caminho: prompt nativo, instruções iOS ou genéricas.
    available: enabled,
    promptInstall: abrirPedidoDeInstalacao,
  };
}
