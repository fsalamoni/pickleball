/**
 * O push deste aparelho enquanto o app está aberto (montado no V2Layout):
 *
 *  - renova o push de quem o ativou aqui (`refreshPush`): atualiza o service
 *    worker do push e regrava o token, que o navegador troca de tempos em
 *    tempos. O código do push (e o FCM) só é baixado por quem ativou;
 *  - abre a página do aviso quando a pessoa toca na notificação com o app
 *    já aberto: o service worker do push não controla as páginas (quem
 *    controla é o do PWA) e não consegue navegar por elas — ele manda a
 *    mensagem e o app navega, pelo mesmo crivo dos links de aviso.
 */
import { useEffect } from 'react';
import { destinoDeAviso } from '@/core/domain/internalLink';
import { PUSH_SCOPE, pushAtivoAqui } from '@/core/lib/pushNoAparelho';

export const MENSAGEM_ABRIR_AVISO = 'picklerush:abrir-aviso';

export function usePushNoAparelho(user, navigate) {
  const uid = user?.uid || null;

  useEffect(() => {
    if (!uid || typeof Notification === 'undefined' || Notification.permission !== 'granted') return undefined;
    const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : null;
    if (!sw) return undefined;
    let vivo = true;
    Promise.resolve(pushAtivoAqui(uid) || sw.getRegistration(PUSH_SCOPE).then(Boolean).catch(() => false))
      .then((ativou) => (vivo && ativou ? import('@/core/services/pushService') : null))
      .then((m) => m && m.refreshPush(user))
      .catch(() => {});
    return () => { vivo = false; };
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : null;
    if (!sw) return undefined;
    const aoReceber = (e) => {
      if (!e.data || e.data.tipo !== MENSAGEM_ABRIR_AVISO) return;
      const destino = destinoDeAviso(e.data.link);
      if (destino) navigate(destino);
    };
    sw.addEventListener('message', aoReceber);
    // Com addEventListener, as mensagens só chegam depois de startMessages.
    if (typeof sw.startMessages === 'function') sw.startMessages();
    return () => sw.removeEventListener('message', aoReceber);
  }, [navigate]);
}
