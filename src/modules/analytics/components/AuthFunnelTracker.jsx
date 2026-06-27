import { useEffect, useRef } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFunnel } from '../hooks/useFunnel.js';
import { FUNNEL_EVENT } from '../domain/funnelEvents.js';

const SESSION_KEY = 'funnel_login_tracked';

/**
 * Dispara o evento de funil `login` uma única vez por sessão de navegador
 * quando o usuário está autenticado. Não renderiza nada. Fechado pela flag
 * `funnel_analytics` (via `useFunnel`).
 */
export default function AuthFunnelTracker() {
  const { isAuthenticated, user } = useAuth();
  const { track } = useFunnel();
  const tracked = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.uid || tracked.current) return;
    let already = false;
    try {
      already = sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      already = false;
    }
    if (already) {
      tracked.current = true;
      return;
    }
    track(FUNNEL_EVENT.LOGIN);
    tracked.current = true;
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // sessionStorage indisponível (modo privado): segue sem persistir.
    }
  }, [isAuthenticated, user?.uid, track]);

  return null;
}
