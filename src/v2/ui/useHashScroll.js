/**
 * Rola até a âncora da URL (`#professor-clinicas`) — inclusive quando a seção
 * só aparece DEPOIS (ela depende de uma consulta). Rola UMA vez por âncora:
 * se a pessoa já começou a rolar, não é puxada de volta a cada renderização.
 *
 * É o que faz o banner "Ver clínicas" cair na seção certa do perfil, em vez de
 * no topo de uma página comprida. Respeita "menos movimento".
 *
 * 🐞 A primeira tentativa espera UM QUADRO: o layout volta o conteúdo ao topo a
 * cada troca de página, num efeito que roda DEPOIS dos efeitos da página (o
 * React roda o efeito do pai depois do dos filhos). Com a seção já na tela no
 * primeiro desenho — Configurações#pagina-inicial —, a rolagem era desfeita na
 * hora e a pessoa caía no topo. E quem rola é só o contêiner que rola de
 * verdade (`rolarAte`), nunca a raiz do aplicativo.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { rolarAte } from './rolarAte';

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
      rolarAte(el, { suave });
      return true;
    };
    let obs = null;
    let prazo = null;
    const comecar = () => {
      quadro = null;
      if (tentar() || typeof MutationObserver === 'undefined') return;
      obs = new MutationObserver(() => { if (tentar()) obs.disconnect(); });
      obs.observe(document.body, { childList: true, subtree: true });
      prazo = setTimeout(() => obs.disconnect(), ESPERA_MAX_MS);
    };
    const comRaf = typeof requestAnimationFrame === 'function';
    let quadro = comRaf ? requestAnimationFrame(comecar) : setTimeout(comecar, 0);
    return () => {
      if (quadro != null) {
        if (comRaf) cancelAnimationFrame(quadro);
        else clearTimeout(quadro);
      }
      obs?.disconnect();
      clearTimeout(prazo);
    };
  }, [hash]);
}
