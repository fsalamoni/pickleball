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
 * vê o pé na cozinha melhor que o fundo; o pé de quem SACA, a câmera do fundo
 * dele). No pé só as câmeras da MELHOR posição votam: o "sem falta" do fundo
 * pode ser o pé escondido atrás de outro jogador.
 *
 * Os dois quiques (10.A) só saem de uma câmera que viu a troca inteira — e a
 * outra câmera pode DESMENTIR: um quique visto do lado de quem bateu, pouco
 * antes da batida, quer dizer que a bola quicou, e o lance vira "revisar".
 *
 * Lance de pé (voleio, saque, dois quiques) usa janela de tempo menor: num
 * bate-rebate na cozinha, dois voleios do mesmo lado caem a menos de 0,7 s um
 * do outro; o mesmo lance visto por duas câmeras, não.
 */

import { CAMERA_POSITIONS } from './cameraLayouts.js';
import { courtSide } from './court.js';

export const FUSION_DEFAULTS = Object.freeze({
  windowMs: 700,
  /** lance de pé (voleio, saque, dois quiques): janela menor */
  footWindowMs: 350,
  distM: 1.5,
  /** quique do lado de quem bateu, até este tempo antes da batida, desmente os dois quiques */
  bounceBeforeMs: 2500,
});

/** Lances julgados pelo pé: vale a posição que vê o pé melhor. */
const FOOT_KINDS = new Set(['volley', 'serve_foot']);

const hasPoint = (c) => Number.isFinite(c.x) && Number.isFinite(c.y);

/** Quanto a câmera vale neste lance (no quique, todas iguais: a incerteza decide). */
function weightOf(c) {
  const p = CAMERA_POSITIONS[c.position];
  if (c.kind === 'volley') return p?.footWeight ?? 0.5;
  if (c.kind !== 'serve_foot') return 1;
  // O pé de quem saca: a câmera do fundo DELE o vê de perto; a do outro
  // fundo, de longe e através da rede e dos jogadores.
  const w = p?.serveFootWeight ?? 0.5;
  return p?.end && hasPoint(c) && p.end !== courtSide(c) ? w * 0.4 : w;
}

function sameLance(cluster, c, o) {
  if (cluster.kind !== c.kind) return false;
  const win = c.kind === 'bounce' ? o.windowMs : o.footWindowMs;
  if (Math.abs(cluster.t_ms - c.t_ms) > win) return false;
  if (cluster.calls.some((x) => x.position === c.position)) return false;
  const ref = cluster.calls.find(hasPoint);
  if (!ref || !hasPoint(c)) return true;
  if (c.kind !== 'bounce') return courtSide(ref) === courtSide(c);
  return Math.hypot(ref.x - c.x, ref.y - c.y) <= o.distM;
}

function verdict(cluster) {
  const score = (c) => (Number.isFinite(c.uncertainty_m) ? c.uncertainty_m : 0.5) / Math.max(weightOf(c), 0.05);
  const ranked = [...cluster.calls].sort((a, b) => score(a) - score(b));
  let seguras = ranked.filter((c) => c.call !== 'review');
  // No pé, "sem falta" de uma câmera que vê o pé PIOR não desmente a que vê
  // melhor: pode ser só o pé escondido atrás de alguém.
  if (FOOT_KINDS.has(cluster.kind) && seguras.length) {
    const top = Math.max(...seguras.map(weightOf));
    seguras = seguras.filter((c) => weightOf(c) >= top);
  }
  const calls = new Set(seguras.map((c) => c.call));
  const best = seguras[0] || ranked[0];
  const machine = cluster.contradicted ? 'review' : (calls.size === 1 ? best.call : 'review');
  // A palavra final é de quem organiza: a decisão mais recente do lance vence.
  const decided = cluster.calls
    .filter((c) => decisionsFor(cluster.kind).includes(c.decision))
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
    disagree: calls.size > 1 || Boolean(cluster.contradicted),
    reason: best.reason || null,
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
  serve_foot: Object.freeze(['fault', 'clean']),
  two_bounce: Object.freeze(['fault', 'clean']),
});

/** O que quem organiza pode decidir num lance (tipo desconhecido ⇒ nada). */
export const decisionsFor = (kind) => DECISIONS[kind] || [];

/**
 * Os dois quiques que outra câmera desmente: um quique visto do lado de quem
 * bateu, entre `bounceBeforeMs` e um instante antes da batida.
 */
function markContradictions(clusters, o) {
  const bounces = clusters.filter((k) => k.kind === 'bounce');
  clusters.filter((k) => k.kind === 'two_bounce').forEach((k) => {
    const ref = k.calls.find(hasPoint);
    if (!ref) return;
    const side = courtSide(ref);
    k.contradicted = bounces.some((b) => {
      const dt = k.t_ms - b.t_ms;
      const bp = b.calls.find(hasPoint);
      return dt > 50 && dt <= o.bounceBeforeMs && bp && courtSide(bp) === side;
    });
  });
}

/**
 * @param {Array<{ id: string, position: string, kind: string, call: string,
 *   t_ms: number, uncertainty_m?: number, x?: number, y?: number, reason?: string }>} calls
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
  markContradictions(clusters, o);
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

/** Por quanto tempo um "revisar" sem decisão segue como "em revisão" no telão (ms). */
export const REVIEW_HOLD_MS = 90000;

/**
 * O que o TELÃO diz sobre o controle de linhas: quantas câmeras estão
 * ANALISANDO, quais posições estão sem câmera ou paradas, e se o último lance
 * está esperando a palavra de quem organiza.
 */
export function telaoLineStatus({ positions = [], cams = [], lances = [], nowMs }) {
  const occ = positionOccupancy(positions, cams, nowMs);
  const down = positions.filter((p) => !occ[p]?.analyzing);
  const last = lances[0];
  const inReview = Boolean(last && last.call === 'review' && !last.decided && nowMs - last.t_ms <= REVIEW_HOLD_MS);
  return {
    total: positions.length,
    analyzing: positions.length - down.length,
    down,
    ready: positions.length > 0 && down.length === 0,
    inReview: inReview ? last : null,
  };
}
