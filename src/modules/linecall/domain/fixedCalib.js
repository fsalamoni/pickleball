/**
 * A CÂMERA FIXA lembra a calibração (docs/53 §5b). Câmera presa no poste da
 * arena não sai do lugar de um dia de jogo para o outro; marcar os quatro
 * pontos toda vez é trabalho à toa. Cada aparelho guarda, por POSIÇÃO e por
 * CÂMERA, a última calibração e a "foto" dos pedaços em volta dos pontos
 * (`cameraHealth.cutPatch`). Ao abrir num dia novo, os pedaços são procurados
 * na imagem de agora:
 *
 * - achados no lugar → `same`: a calibração volta inteira;
 * - achados deslocados → `moved`: não volta (mediria errado);
 * - não achados (luz diferente, gente na frente) → `unsure`: volta, mas o
 *   5º ponto é pedido de novo, que é quem diz se mede certo;
 * - resolução diferente → `size`: não volta (os pontos são pixels do vídeo).
 *
 * Fica só no aparelho (preferência local), como a calibração do dia.
 */

/** O "nome" da câmera aberta: a do sistema, a câmera IP ou a padrão. */
export function cameraKey(choice) {
  if (choice && typeof choice === 'object') return choice.url ? `ip:${choice.url}` : 'ip';
  return choice ? `dev:${choice}` : 'padrao';
}

export const fixedPrefId = (position, key) => `linhas:calibracao:fixa:${position}:${key}`;

function encode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function decode(text) {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}

/**
 * O que se guarda. null se a calibração não está completa ou não há pedaços
 * (sem eles não dá para conferir se a câmera mexeu: melhor não guardar).
 */
export function fixedSnapshot(calib, { vw, vh, patches, now = Date.now() }) {
  if (calib?.corners?.length !== 4 || !vw || !vh) return null;
  const ok = (patches || []).filter(Boolean);
  if (ok.length < 2) return null;
  const { remoteMs, ...rest } = calib; // eslint-disable-line no-unused-vars
  return {
    v: 1, ...rest, vw, vh, savedMs: now,
    patches: (patches || []).map((p) => (p ? { size: p.size, cx: p.cx, cy: p.cy, data: encode(p.data) } : null)),
  };
}

/** Os pedaços guardados, de volta ao formato de `matchPatch`. */
export function fixedPatches(saved) {
  try {
    return (saved?.patches || []).map((p) => (p ? { size: p.size, cx: p.cx, cy: p.cy, data: decode(p.data) } : null));
  } catch { return []; }
}

/**
 * Volta ou não volta?
 * @param {object|null} saved o que `fixedSnapshot` guardou
 * @param {{ vw: number, vh: number, drift: { known: boolean, moved: boolean } }} now
 * @returns {'none'|'size'|'same'|'unsure'|'moved'}
 */
export function restoreDecision(saved, { vw, vh, drift }) {
  if (saved?.v !== 1 || saved.corners?.length !== 4) return 'none';
  if (saved.vw !== vw || saved.vh !== vh) return 'size';
  if (!drift?.known) return 'unsure';
  return drift.moved ? 'moved' : 'same';
}

/** A calibração que volta (sem o 5º ponto quando não há certeza). null se não volta. */
export function restoredCalib(saved, decision) {
  if (decision !== 'same' && decision !== 'unsure') return null;
  const { v, vw, vh, savedMs, patches, ...calib } = saved; // eslint-disable-line no-unused-vars
  if (decision === 'unsure') delete calib.checkTap;
  return calib;
}
