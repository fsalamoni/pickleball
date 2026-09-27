/**
 * Rola até a âncora da URL (`#professor-clinicas`) — inclusive quando a seção
 * só aparece DEPOIS (ela depende de uma consulta). Rola UMA vez por âncora:
 * se a pessoa já começou a rolar, não é puxada de volta a cada renderização.
 *
 * É o que faz o banner "Ver clínicas" cair na seção certa do perfil, em vez de
 * no topo de uma página comprida. Respeita "menos movimento".
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ESPERA_MAX_MS = 8000;

export function useHashScroll() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash || hash.length < 2 || typeof document === 'undefined') return undefined;
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return undefined; }
    let feito = false;
    const suave = !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
    const tentar = () => {
      if (feito) return true;
      const el = document.getElementById(id);
      if (!el) return false;
      feito = true;
      el.scrollIntoView?.({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
      return true;
    };
    if (tentar()) return undefined;
    const obs = new MutationObserver(() => { if (tentar()) obs.disconnect(); });
    obs.observe(document.body, { childList: true, subtree: true });
    const t = setTimeout(() => obs.disconnect(), ESPERA_MAX_MS);
    return () => { obs.disconnect(); clearTimeout(t); };
  }, [hash]);
}
