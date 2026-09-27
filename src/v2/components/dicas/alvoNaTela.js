/**
 * Achar e acompanhar, NO DOM, o elemento de uma dica (`data-dica="…"`).
 *
 * - `encontrarAlvo(ancoras)`: a primeira âncora que tiver um elemento VISÍVEL
 *   (a mesma âncora pode existir duas vezes — a barra lateral e a gaveta do
 *   celular — e só uma está à vista);
 * - `useAlvoNaTela(ancoras)`: acompanha o elemento enquanto a tela rola, muda
 *   de tamanho ou re-renderiza, e diz se ele sumiu. O elemento muitas vezes
 *   chega DEPOIS (a consulta carrega, o diálogo abre, o cartão expande): por
 *   isso a busca continua, e só depois de um tempo o passo diz que não achou.
 */
import { useEffect, useRef, useState } from 'react';

/** Quanto esperar o alvo aparecer antes de dizer que não está na tela. */
export const ESPERA_ALVO_MS = 1600;
const INTERVALO_MS = 250;

const escapar = (s) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'));

/** O elemento está desenhado e à vista (não `display:none`, não sem tamanho)? */
export function elementoVisivel(el) {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (!(r.width > 0) || !(r.height > 0)) return false;
  const cs = window.getComputedStyle(el);
  // Opacidade vazia (ambiente sem motor de estilo) não é "transparente".
  const transparente = cs.opacity !== '' && Number(cs.opacity) === 0;
  return cs.visibility !== 'hidden' && cs.display !== 'none' && !transparente;
}

/** A primeira âncora com um elemento visível, na ordem de preferência. */
export function encontrarAlvo(ancoras, { foraDeDialogo = false } = {}) {
  if (typeof document === 'undefined') return null;
  for (const a of ancoras || []) {
    if (!a) continue;
    const els = document.querySelectorAll(`[data-dica="${escapar(a)}"]`);
    for (const el of els) {
      if (foraDeDialogo && dialogoDe(el)) continue;
      if (elementoVisivel(el)) return el;
    }
  }
  return null;
}

/** O diálogo (Radix ou próprio) em que o elemento está, se estiver num. */
export function dialogoDe(el) {
  return el?.closest?.('[role="dialog"],[role="alertdialog"]') || null;
}

/** Há algum diálogo aberto na tela? (os pontos de dica se recolhem) */
export function haDialogoAberto() {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector('[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],[role="dialog"][aria-modal="true"]'));
}

const retangulo = (el) => {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};
const igual = (a, b) => a && b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5
  && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

/**
 * @param {string[]} ancoras
 * @param {{ ativo?: boolean, chave?: string }} [opcoes] `chave` muda a cada
 *   passo: é o que reinicia a espera ("ainda procurando" × "não achei").
 * @returns {{ el: Element|null, rect: object|null, procurando: boolean }}
 */
export function useAlvoNaTela(ancoras, { ativo = true, chave = '' } = {}) {
  const lista = (ancoras || []).join('|');
  // A medida vale para UMA busca (esta chave, estas âncoras). 🐞 Sem isto, no
  // primeiro desenho de um passo novo o hook ainda devolvia o alvo do passo
  // ANTERIOR — e quem rola a tela até o alvo rolava até o velho, dava o passo
  // novo por "já rolado" e nunca trazia o alvo novo à vista.
  const busca = `${ativo ? 1 : 0}|${chave}|${lista}`;
  const [estado, setEstado] = useState({ busca, el: null, rect: null, procurando: true });
  const inicio = useRef(0);

  useEffect(() => {
    if (!ativo || !lista) {
      setEstado({ busca, el: null, rect: null, procurando: false });
      return undefined;
    }
    inicio.current = Date.now();
    let quadro = null;
    let vivo = true;
    const medir = () => {
      quadro = null;
      if (!vivo) return;
      const el = encontrarAlvo(lista.split('|'));
      const procurando = !el && Date.now() - inicio.current < ESPERA_ALVO_MS;
      setEstado((antes) => {
        const rect = el ? retangulo(el) : null;
        if (antes.busca === busca && antes.el === el && antes.procurando === procurando
          && (rect === antes.rect || igual(rect, antes.rect))) return antes;
        return { busca, el, rect, procurando };
      });
    };
    const agendar = () => { if (quadro == null) quadro = requestAnimationFrame(medir); };
    medir();
    const intervalo = setInterval(medir, INTERVALO_MS);
    window.addEventListener('scroll', agendar, true);
    window.addEventListener('resize', agendar);
    return () => {
      vivo = false;
      clearInterval(intervalo);
      if (quadro != null) cancelAnimationFrame(quadro);
      window.removeEventListener('scroll', agendar, true);
      window.removeEventListener('resize', agendar);
    };
  }, [ativo, lista, chave]); // eslint-disable-line react-hooks/exhaustive-deps

  // Medida de outra busca ainda não foi refeita: por ora, ainda procurando.
  if (estado.busca !== busca) return { el: null, rect: null, procurando: Boolean(ativo && lista) };
  return estado;
}
