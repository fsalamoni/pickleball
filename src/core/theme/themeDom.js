/**
 * Aplicar a aparência no DOCUMENTO — a única parte do modo escuro que mexe na
 * página. Três cuidados, cada um de um defeito que se vê:
 *
 *  1. **Idempotente.** Aplicar o que já está aplicado não faz nada — nem a
 *     supressão de transição. O efeito do provedor roda a cada mudança de
 *     estado, e trocar de novo o que não mudou faria a página piscar.
 *  2. ⭐ **Sem cascata de transições.** Botões, abas e cartões têm
 *     `transition-colors` com durações diferentes; trocar a paleta com elas
 *     ligadas faz cada pedaço mudar num ritmo — a página "derrete" em ondas.
 *     A troca liga `.tema-trocando` (que zera as transições, em
 *     `index.css`), força o cálculo e desliga no quadro seguinte.
 *  3. **Troca pedida pela pessoa ganha um esmaecer** (View Transitions, onde o
 *     navegador tem), a página inteira de uma vez — e nunca com "menos
 *     movimento" ligado no aparelho. Mudança do SISTEMA (o automático às 18h)
 *     não anima: a pessoa nem está olhando.
 *
 * Tudo protegido por `try`: aparência é conveniência, e nenhuma falha aqui
 * pode derrubar uma tela.
 */
import { COR_DA_BARRA, TEMA, TEMA_DISPOSITIVO_KEY } from './themePreference.js';

/** Classe que liga o escuro (no `<html>`). */
export const CLASSE_ESCURO = 'dark';

/** Classe que zera as transições durante a troca (ver `index.css`). */
export const CLASSE_TROCANDO = 'tema-trocando';

/** O documento está no escuro agora? */
export function documentoEscuro(doc = globalThis.document) {
  return Boolean(doc?.documentElement?.classList?.contains(CLASSE_ESCURO));
}

/** Troca a cor da barra do navegador/sistema. */
function pintarBarra(doc, efetivo) {
  const meta = doc.querySelector?.('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', efetivo === TEMA.ESCURO ? COR_DA_BARRA.escuro : COR_DA_BARRA.claro);
}

/** Muda classe e barra, sem mais nada. */
function aplicarDireto(doc, efetivo) {
  doc.documentElement.classList.toggle(CLASSE_ESCURO, efetivo === TEMA.ESCURO);
  pintarBarra(doc, efetivo);
}

/** Roda `mudar` com as transições desligadas, religando no quadro seguinte. */
function semTransicao(doc, mudar) {
  const raiz = doc.documentElement;
  raiz.classList.add(CLASSE_TROCANDO);
  try {
    mudar();
    // Força o cálculo do estilo COM as transições desligadas; sem isso o
    // navegador junta tudo num quadro só e as transições voltam a valer.
    // eslint-disable-next-line no-unused-expressions
    doc.defaultView?.getComputedStyle?.(raiz).color;
  } finally {
    const religar = () => raiz.classList.remove(CLASSE_TROCANDO);
    const quadro = doc.defaultView?.requestAnimationFrame;
    if (typeof quadro === 'function') quadro(() => quadro(religar));
    else religar();
  }
}

/** O aparelho pede menos movimento? */
function menosMovimento(doc) {
  try {
    return Boolean(doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  } catch {
    return false;
  }
}

/**
 * Aplica a aparência ao documento.
 * @param {'claro'|'escuro'} efetivo
 * @param {{ doc?: Document, animar?: boolean }} [opcoes] `animar`: troca pedida
 *   pela pessoa (esmaece, quando dá). Sem ela: troca seca, sem transições.
 * @returns {boolean} se mudou alguma coisa
 */
export function aplicarTema(efetivo, { doc = globalThis.document, animar = false } = {}) {
  try {
    if (!doc?.documentElement) return false;
    const querEscuro = efetivo === TEMA.ESCURO;
    if (documentoEscuro(doc) === querEscuro) {
      // A classe já está certa; a barra pode não estar (o script de
      // `index.html` só a pinta no escuro). Conferir não custa nada.
      pintarBarra(doc, efetivo);
      return false;
    }
    const mudar = () => semTransicao(doc, () => aplicarDireto(doc, efetivo));
    if (animar && typeof doc.startViewTransition === 'function' && !menosMovimento(doc)) {
      try {
        doc.startViewTransition(mudar);
        return true;
      } catch {
        // cai na troca seca abaixo
      }
    }
    mudar();
    return true;
  } catch {
    return false;
  }
}

/**
 * Atualiza o ESPELHO do aparelho (a chave lida pelo script de `index.html`).
 * `null` apaga. Nunca lança.
 * @param {'escuro'|'automatico'|null} valor
 */
export function gravarEspelho(valor, { storage } = {}) {
  try {
    const store = storage || globalThis.window?.localStorage;
    if (!store) return;
    if (valor) store.setItem(TEMA_DISPOSITIVO_KEY, valor);
    else store.removeItem(TEMA_DISPOSITIVO_KEY);
  } catch {
    // modo privado / armazenamento bloqueado: a próxima abertura só pisca
  }
}
