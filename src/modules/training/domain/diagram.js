/**
 * Diagrama de quadra: é DADO, não imagem. Fica no próprio item, é desenhado
 * em SVG (`CourtDiagram`) com as cores da paleta (vale no modo escuro) e pode
 * ser editado na tela (`DiagramEditor`).
 *
 * Sistema de coordenadas: a quadra INTEIRA em pé, 0–100 nos dois eixos.
 * `x` atravessa a largura (20 pés), `y` percorre o comprimento (44 pés):
 * y = 0 é o fundo de cima, y = 100 o fundo de baixo, a rede em y = 50.
 * A zona de não-voleio (cozinha) tem 7 pés de cada lado da rede.
 * "meia" e "cozinha" só recortam a VISTA — as coordenadas não mudam.
 */

export const COURT = Object.freeze({
  widthFt: 20,
  lengthFt: 44,
  net: 50,
  kitchenTop: 50 - (7 / 44) * 100,
  kitchenBottom: 50 + (7 / 44) * 100,
});

export const COURT_VIEWS = Object.freeze(['inteira', 'meia', 'cozinha']);
export const COURT_VIEW_LABELS = Object.freeze({ inteira: 'Quadra inteira', meia: 'Meia quadra', cozinha: 'Cozinha' });

/** Recorte de y (0–100) que cada vista mostra. */
export const VIEW_BOUNDS = Object.freeze({
  inteira: { y0: 0, y1: 100 },
  meia: { y0: 40, y1: 100 },
  cozinha: { y0: 25, y1: 75 },
});

export const DIAGRAM_TAGS = Object.freeze(['neutro', 'certo', 'errado']);
export const DIAGRAM_TAG_LABELS = Object.freeze({ neutro: 'Diagrama', certo: 'Certo', errado: 'Errado' });

export const ELEMENT_TYPES = Object.freeze(['jogador', 'bola', 'cone', 'alvo', 'seta', 'zona', 'texto']);
export const ELEMENT_LABELS = Object.freeze({
  jogador: 'Jogador', bola: 'Bola', cone: 'Cone', alvo: 'Alvo', seta: 'Seta', zona: 'Zona', texto: 'Texto',
});
export const ARROW_STYLES = Object.freeze(['bola', 'movimento']);
export const ARROW_STYLE_LABELS = Object.freeze({ bola: 'Trajetória da bola', movimento: 'Deslocamento' });

export const MAX_DIAGRAMS = 4;
export const MAX_ELEMENTS = 24;

const clamp = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
};
const str = (v, max) => String(v ?? '').trim().slice(0, max);

/** Um elemento válido ou `null`. */
export function normalizeElement(raw = {}) {
  const t = ELEMENT_TYPES.includes(raw?.t) ? raw.t : null;
  if (!t) return null;
  const x = clamp(raw.x);
  const y = clamp(raw.y);
  if (x === null || y === null) return null;
  const el = { t, x, y };
  if (t === 'seta' || t === 'zona') {
    const x2 = clamp(raw.x2);
    const y2 = clamp(raw.y2);
    if (x2 === null || y2 === null) return null;
    if (x2 === x && y2 === y) return null;
    el.x2 = x2;
    el.y2 = y2;
  }
  if (t === 'seta') el.style = ARROW_STYLES.includes(raw.style) ? raw.style : 'bola';
  if (t === 'jogador') el.team = raw.team === 'b' ? 'b' : 'a';
  const label = str(raw.label, 12);
  if (t === 'texto' && !label) return null;
  if (label) el.label = label;
  return el;
}

/** Um diagrama válido ou `null` (sem elementos não é diagrama). */
export function normalizeDiagram(raw = {}) {
  const elements = (Array.isArray(raw?.elements) ? raw.elements : [])
    .map(normalizeElement)
    .filter(Boolean)
    .slice(0, MAX_ELEMENTS);
  if (!elements.length) return null;
  return {
    title: str(raw.title, 80),
    tag: DIAGRAM_TAGS.includes(raw.tag) ? raw.tag : 'neutro',
    court: COURT_VIEWS.includes(raw.court) ? raw.court : 'inteira',
    elements,
  };
}

export function normalizeDiagrams(list) {
  return (Array.isArray(list) ? list : []).map(normalizeDiagram).filter(Boolean).slice(0, MAX_DIAGRAMS);
}

/**
 * Descrição em texto do diagrama — para leitor de tela e para quem não
 * enxerga bem a figura. Sem isso o diagrama vira informação que só alguns têm.
 */
export function describeDiagram(diagram) {
  if (!diagram?.elements?.length) return '';
  const count = (t) => diagram.elements.filter((e) => e.t === t).length;
  const partes = [];
  const jogadores = count('jogador');
  if (jogadores) partes.push(`${jogadores} jogador${jogadores > 1 ? 'es' : ''}`);
  const setasBola = diagram.elements.filter((e) => e.t === 'seta' && e.style === 'bola').length;
  const setasMov = diagram.elements.filter((e) => e.t === 'seta' && e.style === 'movimento').length;
  if (setasBola) partes.push(`${setasBola} trajetória${setasBola > 1 ? 's' : ''} da bola`);
  if (setasMov) partes.push(`${setasMov} deslocamento${setasMov > 1 ? 's' : ''}`);
  const alvos = count('alvo') + count('zona');
  if (alvos) partes.push(`${alvos} alvo${alvos > 1 ? 's' : ''}`);
  const cones = count('cone');
  if (cones) partes.push(`${cones} cone${cones > 1 ? 's' : ''}`);
  const tag = diagram.tag === 'certo' ? 'Forma certa' : diagram.tag === 'errado' ? 'Forma errada' : 'Diagrama';
  const titulo = diagram.title ? `: ${diagram.title}` : '';
  return `${tag}${titulo}${partes.length ? ` — ${partes.join(', ')}` : ''}.`;
}

/** Em que parte da quadra um ponto está (para textos e testes). */
export function zoneOf(y) {
  if (y < COURT.kitchenTop) return 'fundo_superior';
  if (y < COURT.net) return 'cozinha_superior';
  if (y <= COURT.kitchenBottom) return 'cozinha_inferior';
  return 'fundo_inferior';
}
