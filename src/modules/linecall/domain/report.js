/**
 * O RESUMO e a PLANILHA dos lances de um jogo (os lances da central, já
 * juntados por `fuseLineCalls`). Zero banco: sai do que a central já leu.
 */

const KINDS = ['in', 'out', 'review', 'fault', 'clean'];

/**
 * Quantos lances de cada veredito, e quantos o organizador decidiu. As faltas
 * também por TIPO (`faults`): pé na cozinha no voleio, pé no saque e dois
 * quiques são regras diferentes.
 */
export function lanceSummary(lances) {
  const out = Object.fromEntries(KINDS.map((k) => [k, 0]));
  const faults = { volley: 0, serve_foot: 0, two_bounce: 0 };
  let decided = 0;
  let serves = 0;
  (lances || []).forEach((l) => {
    if (l.call in out) out[l.call] += 1;
    if (l.call === 'fault' && l.kind in faults) faults[l.kind] += 1;
    if (l.decided) decided += 1;
    if (l.serve) serves += 1;
  });
  return { ...out, faults, total: (lances || []).length, decided, serves };
}

/**
 * O MAPA DOS QUIQUES (como nas análises de jogo): onde cada bola quicou, no
 * desenho comum da quadra, e a profundidade média do saque (quanto ele
 * caiu da linha de fundo do recebedor). Só quiques com posição.
 * @returns {{ marks: Array<{ id, x, y, call, serve }>, serveDepthM: number|null }}
 */
export function bounceMap(lances, { length = 13.411 } = {}) {
  const marks = (lances || [])
    .filter((l) => l.kind === 'bounce' && Number.isFinite(l.best?.x) && Number.isFinite(l.best?.y))
    .map((l) => ({ id: l.id, x: l.best.x, y: l.best.y, call: l.call, serve: Boolean(l.serve) }));
  const fundo = marks.filter((m) => m.serve && m.call === 'in').map((m) => Math.min(m.y, length - m.y));
  const serveDepthM = fundo.length ? fundo.reduce((a, b) => a + b, 0) / fundo.length : null;
  return { marks, serveDepthM };
}

const cm = (m) => (Number.isFinite(m) ? String(Math.round(m * 100)) : '');
const cell = (v) => {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * A planilha (CSV com `;`, que o Excel em português abre direto).
 * @param {Array<object>} lances
 * @param {{ label: (l) => string, time: (ms) => string, positions: (ids) => string,
 *   header: string[] }} fmt  os textos já traduzidos
 */
export function lancesCsv(lances, fmt) {
  const rows = [...(lances || [])].sort((a, b) => a.t_ms - b.t_ms).map((l) => [
    fmt.time(l.t_ms),
    fmt.label(l),
    l.decided ? 'x' : '',
    l.disagree ? 'x' : '',
    cm(l.best?.margin_m ?? l.best?.depth_m),
    cm(l.best?.uncertainty_m),
    fmt.positions(l.positions),
  ]);
  return [fmt.header, ...rows].map((r) => r.map(cell).join(';')).join('\n');
}
