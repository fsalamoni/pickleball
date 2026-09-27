/**
 * Rola até um elemento mexendo SÓ no contêiner que rola de verdade.
 *
 * 🐞 `scrollIntoView` rola TODOS os ancestrais que podem rolar — inclusive os
 * de `overflow: hidden`. No V2 o `.v2-root` é `h-[100dvh] overflow-hidden` e o
 * conteúdo rola no `<main>`; o `scrollIntoView` deslocava o aplicativo inteiro
 * (a barra lateral cortada em cima, uma faixa vazia embaixo) — medido: 131 px
 * em Configurações → Página inicial. E o deslocamento não tinha volta: a
 * pessoa não rola um `overflow: hidden`.
 *
 * Aqui o alvo é o ancestral mais próximo com `overflow-y` auto/scroll que de
 * fato tem o que rolar, respeitando o `scroll-margin-top` do elemento. Sem
 * nenhum (página que rola no documento, ou o jsdom dos testes), cai no
 * `scrollIntoView` de sempre.
 */

const ROLA = /(auto|scroll|overlay)/;

/** O ancestral que rola de verdade, ou `null` (então quem rola é o documento). */
export function conteinerQueRola(el) {
  if (!el || typeof window === 'undefined') return null;
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const { overflowY } = window.getComputedStyle(p);
    if (ROLA.test(overflowY) && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/**
 * @param {Element|null} el
 * @param {{ suave?: boolean }} [opcoes] - `suave: false` para "menos movimento"
 * @returns {boolean} se havia o que rolar
 */
export function rolarAte(el, { suave = true } = {}) {
  if (!el) return false;
  const behavior = suave ? 'smooth' : 'auto';
  const conteiner = conteinerQueRola(el);
  if (!conteiner) {
    el.scrollIntoView?.({ behavior, block: 'start' });
    return true;
  }
  const margem = parseFloat(window.getComputedStyle(el).scrollMarginTop) || 0;
  const topo = el.getBoundingClientRect().top - conteiner.getBoundingClientRect().top + conteiner.scrollTop - margem;
  const top = Math.max(0, Math.round(topo));
  if (typeof conteiner.scrollTo === 'function') conteiner.scrollTo({ top, behavior });
  else conteiner.scrollTop = top;
  return true;
}
