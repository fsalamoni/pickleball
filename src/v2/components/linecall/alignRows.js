/**
 * Câmeras lado a lado na mesma tela (o computador com várias webcams): cada
 * pedaço da configuração de uma fica na MESMA altura do mesmo pedaço da outra.
 *
 * Quem quer alinhar marca o bloco com `data-alinhar="<nome>"`; os blocos de
 * mesmo nome, em colunas diferentes, ganham a altura do maior (`min-height`).
 * Um aviso que só uma câmera tem (a câmera que recusou um ajuste, o texto da
 * lateral) abre o mesmo espaço na outra, e a etapa seguinte começa na mesma
 * linha nas duas. Com uma coluna só (tela estreita) nada é mexido.
 */

import { useEffect } from 'react';

/** Altura de cada nome: a maior entre os blocos medidos. Puro. */
export function rowHeights(blocks) {
  const max = new Map();
  blocks.forEach(({ key, h }) => {
    if (!key) return;
    max.set(key, Math.max(max.get(key) || 0, h));
  });
  return max;
}

/**
 * @param {{ current: HTMLElement|null }} ref o contêiner das colunas
 * @param {boolean} on alinhar (várias câmeras na tela)
 */
export function useAlignedRows(ref, on) {
  useEffect(() => {
    const root = ref.current;
    if (!on || !root || typeof ResizeObserver === 'undefined') return undefined;
    let frame = null;
    const els = () => [...root.querySelectorAll('[data-alinhar]')];
    const limpar = () => els().forEach((el) => { el.style.minHeight = ''; });
    const alinhar = () => {
      frame = null;
      const list = els();
      list.forEach((el) => { el.style.minHeight = ''; });
      // Uma coluna só (as seções empilhadas): nada a alinhar.
      const lefts = new Set(list.map((el) => Math.round(el.getBoundingClientRect().left)));
      if (lefts.size < 2) return;
      const blocks = list.map((el) => ({ el, key: el.dataset.alinhar, h: el.getBoundingClientRect().height }));
      const max = rowHeights(blocks);
      blocks.forEach(({ el, key, h }) => { if (max.get(key) > h + 0.5) el.style.minHeight = `${max.get(key)}px`; });
    };
    const pedir = () => { if (frame == null) frame = requestAnimationFrame(alinhar); };
    const ro = new ResizeObserver(pedir);
    ro.observe(root);
    let vistos = new Set();
    // Só quando um bloco entra ou sai (a imagem da análise muda o tempo todo e não conta).
    const observar = () => {
      const agora = new Set(els());
      let mudou = false;
      agora.forEach((el) => { if (!vistos.has(el)) { ro.observe(el); mudou = true; } });
      vistos.forEach((el) => { if (!agora.has(el)) { ro.unobserve(el); mudou = true; } });
      vistos = agora;
      if (mudou) pedir();
    };
    // Blocos aparecem e somem (aviso, imagem da câmera): observa de novo.
    const mo = new MutationObserver(observar);
    mo.observe(root, { childList: true, subtree: true });
    observar();
    return () => {
      mo.disconnect();
      ro.disconnect();
      if (frame != null) cancelAnimationFrame(frame);
      limpar();
    };
  }, [ref, on]);
}
