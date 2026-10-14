/**
 * As contas puras do editor de diagrama: que elemento cada ferramenta põe,
 * mover sem sair da quadra, o histórico de desfazer e o nome acessível de
 * cada elemento. A validação continua sendo `normalizeElement` (domínio).
 */

import {
  ARROW_STYLE_LABELS, ELEMENT_LABELS, VIEW_BOUNDS, normalizeElement, zoneOf,
} from '@/modules/training/domain/diagram';
import { t, tk } from '@/core/i18n';

/** As ferramentas, na ordem da paleta. Seta e zona pedem dois toques (início e fim). */
export const TOOLS = Object.freeze([
  { id: 'selecionar', label: tk('Mover') },
  { id: 'jogador_a', label: tk('Jogador A') },
  { id: 'jogador_b', label: tk('Jogador B') },
  { id: 'bola', label: tk('Bola') },
  { id: 'cone', label: tk('Cone') },
  { id: 'alvo', label: tk('Alvo') },
  { id: 'seta_bola', label: tk('Seta da bola') },
  { id: 'seta_mov', label: tk('Deslocamento') },
  { id: 'zona', label: tk('Zona') },
  { id: 'texto', label: tk('Texto') },
]);

export const TWO_TAP = new Set(['seta_bola', 'seta_mov', 'zona']);

/** Passo dos botões de mover (unidades da quadra, 0–100). */
export const NUDGE = 2;

export function blankDiagram() {
  return { title: '', tag: 'neutro', court: 'inteira', elements: [] };
}

/** Próximo rótulo de jogador do time: A1, A2… / B1, B2… */
export function nextPlayerLabel(elements = [], team = 'a') {
  const n = elements.filter((e) => e?.t === 'jogador' && (e.team === 'b' ? 'b' : 'a') === team).length;
  return `${team.toUpperCase()}${n + 1}`;
}

/**
 * O elemento que a ferramenta põe no ponto. Para seta e zona, `start` é o
 * primeiro toque e `point` o segundo. `null` se não der elemento válido
 * (ex.: os dois toques no mesmo lugar).
 */
export function buildElement(tool, point, { elements = [], start = null } = {}) {
  if (!point) return null;
  const { x, y } = point;
  switch (tool) {
    case 'jogador_a':
    case 'jogador_b': {
      const team = tool === 'jogador_b' ? 'b' : 'a';
      return normalizeElement({ t: 'jogador', team, label: nextPlayerLabel(elements, team), x, y });
    }
    case 'bola':
    case 'cone':
    case 'alvo':
      return normalizeElement({ t: tool, x, y });
    case 'texto':
      return normalizeElement({ t: 'texto', label: 'Texto', x, y });
    case 'seta_bola':
    case 'seta_mov':
    case 'zona':
      if (!start) return null;
      return normalizeElement({
        t: tool === 'zona' ? 'zona' : 'seta',
        style: tool === 'seta_mov' ? 'movimento' : 'bola',
        x: start.x, y: start.y, x2: x, y2: y,
      });
    default:
      return null;
  }
}

/** O meio da área que a vista mostra. */
export function viewCenter(court = 'inteira') {
  const b = VIEW_BOUNDS[court] || VIEW_BOUNDS.inteira;
  return { x: 50, y: Math.round(((b.y0 + b.y1) / 2) * 10) / 10 };
}

/**
 * O elemento posto SEM tocar na quadra (teclado, leitor de tela): no meio da
 * vista; seta e zona saem como um traço curto, para depois mover.
 */
export function defaultElement(tool, court, elements = []) {
  const c = viewCenter(court);
  if (TWO_TAP.has(tool)) {
    return buildElement(tool, { x: c.x + 15, y: c.y + 8 }, { elements, start: { x: c.x - 15, y: c.y - 8 } });
  }
  return buildElement(tool, c, { elements });
}

const r1 = (v) => Math.round(v * 10) / 10;

/** Quanto dá para deslocar sem que nenhum dos pontos saia de 0–100. */
function limitar(d, valores) {
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  return Math.min(100 - max, Math.max(-min, d));
}

/** Desloca o elemento inteiro (a seta e a zona levam os dois pontos), sem sair da quadra. */
export function translateElement(el, dx, dy) {
  if (!el) return el;
  const duplo = Number.isFinite(el.x2) && Number.isFinite(el.y2);
  const xs = duplo ? [el.x, el.x2] : [el.x];
  const ys = duplo ? [el.y, el.y2] : [el.y];
  const ddx = limitar(Number(dx) || 0, xs);
  const ddy = limitar(Number(dy) || 0, ys);
  const out = { ...el, x: r1(el.x + ddx), y: r1(el.y + ddy) };
  if (duplo) {
    out.x2 = r1(el.x2 + ddx);
    out.y2 = r1(el.y2 + ddy);
  }
  return out;
}

// ── Desfazer ─────────────────────────────────────────────────────────────

export const HISTORY_LIMIT = 50;

/** Guarda o retrato ANTERIOR à mudança (a pilha fica limitada). */
export function pushHistory(stack = [], snapshot, limit = HISTORY_LIMIT) {
  return [...stack, snapshot].slice(-limit);
}

/** Tira o último retrato: `{ stack, snapshot }` (`snapshot` nulo se não há o que desfazer). */
export function popHistory(stack = []) {
  if (!stack.length) return { stack, snapshot: null };
  return { stack: stack.slice(0, -1), snapshot: stack[stack.length - 1] };
}

// ── Leitura ──────────────────────────────────────────────────────────────

// A frase inteira por zona: a preposição muda com o gênero e com o idioma.
const EM = {
  fundo_superior: tk('no fundo de cima'),
  cozinha_superior: tk('na cozinha de cima'),
  cozinha_inferior: tk('na cozinha de baixo'),
  fundo_inferior: tk('no fundo de baixo'),
};
const DE = {
  fundo_superior: tk('do fundo de cima'),
  cozinha_superior: tk('da cozinha de cima'),
  cozinha_inferior: tk('da cozinha de baixo'),
  fundo_inferior: tk('do fundo de baixo'),
};
const ATE = {
  fundo_superior: tk('o fundo de cima'),
  cozinha_superior: tk('a cozinha de cima'),
  cozinha_inferior: tk('a cozinha de baixo'),
  fundo_inferior: tk('o fundo de baixo'),
};
const em = (y) => t(EM[zoneOf(y)]);
const de = (y) => t(DE[zoneOf(y)]);
const ate = (y) => t(ATE[zoneOf(y)]);

const lado = (x) => (x < 40 ? t(', à esquerda') : x > 60 ? t(', à direita') : t(', no meio'));

/** Nome acessível: "Jogador A1, na cozinha de baixo, à esquerda". */
export function elementName(el) {
  if (!el) return '';
  if (el.t === 'seta') {
    const tipo = t(ARROW_STYLE_LABELS[el.style]) || t('Seta');
    return `${tipo}${el.label ? ` ${el.label}` : ''}, ${t('{de} até {ate}', { de: de(el.y), ate: ate(el.y2) })}`;
  }
  if (el.t === 'zona') return `${t('Zona')}${el.label ? ` ${el.label}` : ''}, ${em((el.y + el.y2) / 2)}`;
  const nome = el.t === 'jogador'
    ? t('Jogador {nome}', { nome: el.label || (el.team === 'b' ? 'B' : 'A') })
    : el.t === 'texto' ? t('Texto "{texto}"', { texto: el.label || '' }) : t(ELEMENT_LABELS[el.t]) || t('Elemento');
  return `${nome}, ${em(el.y)}${lado(el.x)}`;
}
