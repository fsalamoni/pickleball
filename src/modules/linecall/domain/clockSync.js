/**
 * Os relógios dos aparelhos — trazer tudo para o relógio de quem OLHA.
 *
 * Cada câmera marca a hora do lance (`t_ms`) e o seu sinal de vida
 * (`seen_ms`) no relógio DELA. A central, o telão e a escolha de posição
 * comparam essas horas com o relógio DELES. Celular com o relógio acertado à
 * mão, ou que não sincroniza há semanas, erra segundos ou minutos — e aí a
 * câmera aparece "fora do ar" estando no ar, dois aparelhos que viram o MESMO
 * quique viram dois lances (a janela da central é de 0,7 s; a do pé, 0,35 s)
 * e o telão não mostra o lance (ele mostra só os dos últimos segundos).
 *
 * O banco dá a régua comum sem nada novo gravado: o sinal de vida leva as
 * duas horas, a do aparelho (`seen_ms`) e a do servidor (`updated_at`).
 * · relógio da câmera → servidor: `updated_at − seen_ms` (mais o tempo de
 *   subida, que é parecido para todos);
 * · servidor → relógio de quem olha: `chegada − updated_at` de um sinal que
 *   acabou de mudar (mais o tempo de descida).
 * Vale o MENOR de várias amostras (como no NTP: o atraso só soma, nunca
 * tira). Sem amostra nenhuma a diferença é zero — exatamente o de antes.
 *
 * A câmera sem conta (`lineGuest`) já grava o sinal com a hora do servidor e
 * a marcação convertida para ela pela função; a conta dá ~0 e nada muda.
 */

/** Amostras guardadas por relógio (as mais novas). */
export const CLOCK_SAMPLES = 8;

/** A hora do servidor de um `Timestamp` do Firestore (ou `{ seconds, nanoseconds }`), em ms. */
export function serverMs(v) {
  if (!v) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (Number.isFinite(v.seconds)) return v.seconds * 1000 + Math.round((v.nanoseconds || 0) / 1e6);
  return null;
}

/** O relógio de quem marcou: a câmera de um aparelho numa posição. */
export const clockKey = (c) => `${c?.uid}_${c?.position}`;

const keep = (list, v, max) => [...list, v].slice(-max);

/**
 * Junta as amostras de um retrato das câmeras.
 * @param {{ cams: object, view: number[] }} prev
 * @param {Array<object>} changed as câmeras cujo sinal MUDOU neste retrato
 * @param {number} receivedMs quando o retrato chegou (relógio de quem olha)
 */
export function addClockSamples(prev, changed, receivedMs, max = CLOCK_SAMPLES) {
  const cams = { ...(prev?.cams || {}) };
  let view = prev?.view || [];
  (changed || []).forEach((c) => {
    const u = serverMs(c?.updated_at);
    if (!Number.isFinite(u)) return;
    if (Number.isFinite(c.seen_ms)) {
      const k = clockKey(c);
      const list = cams[k] || [];
      // O mesmo sinal relido (cache, metadados) não vira amostra nova.
      if (!list.some((s) => s.seen === c.seen_ms)) cams[k] = keep(list, { seen: c.seen_ms, off: u - c.seen_ms }, max);
    }
    if (Number.isFinite(receivedMs)) view = keep(view, receivedMs - u, max);
  });
  return { cams, view };
}

const min = (list) => (list.length ? Math.min(...list) : 0);

/**
 * As diferenças: `cams[chave]` (relógio da câmera → servidor) e `view`
 * (servidor → relógio de quem olha). Sem amostra, zero.
 */
export function clockOffsets(samples) {
  const cams = {};
  Object.entries(samples?.cams || {}).forEach(([k, list]) => { cams[k] = min(list.map((s) => s.off)); });
  return { cams, view: min(samples?.view || []) };
}

/** Do relógio da câmera `c` para o de quem olha (ms). */
export function toViewerMs(ms, c, offsets) {
  if (!Number.isFinite(ms)) return ms;
  return ms + (offsets?.cams?.[clockKey(c)] || 0) + (offsets?.view || 0);
}

/** As marcações e as câmeras com as horas no relógio de quem olha (o original fica em `*_raw`). */
export function alignCalls(calls, offsets) {
  return (calls || []).map((c) => (Number.isFinite(c?.t_ms)
    ? { ...c, t_ms: toViewerMs(c.t_ms, c, offsets), t_ms_raw: c.t_ms }
    : c));
}

export function alignCams(cams, offsets) {
  return (cams || []).map((c) => (Number.isFinite(c?.seen_ms)
    ? { ...c, seen_ms: toViewerMs(c.seen_ms, c, offsets), seen_ms_raw: c.seen_ms }
    : c));
}
