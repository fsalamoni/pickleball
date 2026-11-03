/**
 * O RESUMO e a PLANILHA dos lances de um jogo (os lances da central, já
 * juntados por `fuseLineCalls`). Zero banco: sai do que a central já leu.
 */

const KINDS = ['in', 'out', 'review', 'fault', 'clean'];

/** Quantos lances de cada veredito, e quantos o organizador decidiu. */
export function lanceSummary(lances) {
  const out = Object.fromEntries(KINDS.map((k) => [k, 0]));
  let decided = 0;
  let serves = 0;
  (lances || []).forEach((l) => {
    if (l.call in out) out[l.call] += 1;
    if (l.decided) decided += 1;
    if (l.serve) serves += 1;
  });
  return { ...out, total: (lances || []).length, decided, serves };
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
