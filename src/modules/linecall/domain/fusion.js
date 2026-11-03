/**
 * A CENTRAL das câmeras — junta o que cada aparelho marcou num veredito só.
 *
 * Cada câmera decide sozinha, com o seu motor e a sua incerteza, e grava a
 * marcação (`line_calls`). Aqui as marcações de câmeras diferentes que falam
 * do MESMO lance viram uma: mesmo tipo, perto no tempo e, no quique, perto no
 * chão (no voleio, do mesmo lado da rede).
 *
 * Por que não é preciso sincronizar os relógios dos aparelhos ao milésimo:
 * cada câmera já achou o ponto do quique com a SUA imagem; a central só
 * precisa saber que duas marcações são o mesmo lance. Relógio de celular
 * acertado pela rede erra dezenas de milissegundos — a janela é de 0,7 s, e
 * dois quiques de verdade nunca caem a menos de 1,5 m e 0,7 s um do outro.
 *
 * O veredito:
 * · as câmeras SEGURAS (que não disseram "revisar") concordam ⇒ é o que elas
 *   dizem;
 * · discordam ⇒ "revisar", e a tela diz que as câmeras discordaram;
 * · nenhuma segura ⇒ "revisar".
 * A medida mostrada é a da melhor câmera: a de menor incerteza no quique; no
 * pé, a de menor incerteza dividida pelo peso da posição (a lateral da rede
 * vê o pé melhor que o fundo). No pé só as câmeras da MELHOR posição votam:
 * o "sem falta" do fundo pode ser o pé escondido atrás de outro jogador.
 */

import { CAMERA_POSITIONS } from './cameraLayouts.js';
import { courtSide } from './court.js';

export const FUSION_DEFAULTS = Object.freeze({ windowMs: 700, distM: 1.5 });

const weightOf = (position, kind) => {
  if (kind !== 'volley') return 1;
  return CAMERA_POSITIONS[position]?.footWeight ?? 0.5;
};

const hasPoint = (c) => Number.isFinite(c.x) && Number.isFinite(c.y);

function sameLance(cluster, c, o) {
  if (cluster.kind !== c.kind) return false;
  if (Math.abs(cluster.t_ms - c.t_ms) > o.windowMs) return false;
  if (cluster.calls.some((x) => x.position === c.position)) return false;
  const ref = cluster.calls.find(hasPoint);
  if (!ref || !hasPoint(c)) return true;
  if (c.kind === 'volley') return courtSide(ref) === courtSide(c);
  return Math.hypot(ref.x - c.x, ref.y - c.y) <= o.distM;
}

function verdict(cluster) {
  const score = (c) => (Number.isFinite(c.uncertainty_m) ? c.uncertainty_m : 0.5) / Math.max(weightOf(c.position, c.kind), 0.05);
  const ranked = [...cluster.calls].sort((a, b) => score(a) - score(b));
  let seguras = ranked.filter((c) => c.call !== 'review');
  // No pé, "voleio sem falta" de uma câmera que vê o pé PIOR não desmente a
  // que vê melhor: pode ser só o pé escondido atrás de alguém.
  if (cluster.kind === 'volley' && seguras.length) {
    const top = Math.max(...seguras.map((c) => weightOf(c.position, c.kind)));
    seguras = seguras.filter((c) => weightOf(c.position, c.kind) >= top);
  }
  const calls = new Set(seguras.map((c) => c.call));
  const best = seguras[0] || ranked[0];
  const machine = calls.size === 1 ? best.call : 'review';
  // A palavra final é de quem organiza: a decisão mais recente do lance vence.
  const decided = cluster.calls
    .filter((c) => DECISIONS[cluster.kind].includes(c.decision))
    .sort((a, b) => (b.decided_ms || 0) - (a.decided_ms || 0))[0];
  return {
    id: cluster.calls[0].id,
    kind: cluster.kind,
    t_ms: cluster.t_ms,
    call: decided ? decided.decision : machine,
    machineCall: machine,
    decided: Boolean(decided),
    decidedBy: decided?.decided_by || null,
    decisionDocId: decided?.id || cluster.calls[0].id,
    disagree: calls.size > 1,
    serve: cluster.calls.some((c) => c.serve === true),
    positions: cluster.calls.map((c) => c.position),
    calls: ranked,
    best,
  };
}

/** O que quem organiza pode decidir em cada tipo de lance. */
export const DECISIONS = Object.freeze({
  bounce: Object.freeze(['in', 'out']),
  volley: Object.freeze(['fault', 'clean']),
});

/**
 * @param {Array<{ id: string, position: string, kind: 'bounce'|'volley',
 *   call: string, t_ms: number, uncertainty_m?: number, x?: number, y?: number }>} calls
 * @returns {Array<object>} os lances, do mais recente ao mais antigo
 */
export function fuseLineCalls(calls, options = {}) {
  const o = { ...FUSION_DEFAULTS, ...options };
  const clusters = [];
  [...(calls || [])]
    .filter((c) => c && Number.isFinite(c.t_ms) && c.kind)
    .sort((a, b) => a.t_ms - b.t_ms)
    .forEach((c) => {
      const hit = clusters.find((k) => sameLance(k, c, o));
      if (hit) hit.calls.push(c);
      else clusters.push({ kind: c.kind, t_ms: c.t_ms, calls: [c] });
    });
  return clusters.map(verdict).sort((a, b) => b.t_ms - a.t_ms);
}

/** Câmera "no ar": deu sinal de vida há pouco (relógio do aparelho que olha). */
export const CAM_STALE_MS = 45000;
export function isCamOnline(cam, nowMs, staleMs = CAM_STALE_MS) {
  return Number.isFinite(cam?.seen_ms) && nowMs - cam.seen_ms <= staleMs;
}

/** Quem está em cada posição do arranjo: `{ fundo_a: cam|null, … }` (a mais recente vence). */
export function positionOccupancy(positions, cams, nowMs) {
  const out = Object.fromEntries((positions || []).map((p) => [p, null]));
  (cams || []).filter((c) => isCamOnline(c, nowMs) && c.position in out).forEach((c) => {
    if (!out[c.position] || c.seen_ms > out[c.position].seen_ms) out[c.position] = c;
  });
  return out;
}
