/**
 * onboardingFunnel — o funil dos "Primeiros passos" para o admin.
 *
 * O servidor grava, no retrato do dia (`gamification_metrics/{dia}`), quantas
 * pessoas concluíram cada etapa do roteiro e quantas o dispensaram. Aqui só se
 * lê esse retrato e se responde à pergunta de quem administra: *em que passo as
 * pessoas travam?*
 *
 * Duas coisas que a conta evita de propósito:
 *  - o número NÃO medido nunca vira zero: retrato antigo (sem funil) devolve
 *    `null`, e a tela diz que ainda não mediu;
 *  - a base é quem tem preferências salvas (`prefsDocs`) — o roteiro só é
 *    gravado para quem abriu o hub, então dividir pelo total de atletas faria
 *    toda etapa parecer abandonada por quem nem chegou lá.
 *
 * Lógica pura, sem I/O.
 */
import { ONBOARDING_STEPS } from './onboarding.js';

const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);

/**
 * @param {object|null} retrato o último documento de `gamification_metrics`
 * @returns {null | {
 *   base: number, dismissed: number, dismissedPct: number|null,
 *   rows: Array<{ id: string, label: string, kind: string, xp: number, count: number, pct: number|null }>,
 *   hardest: { id: string, label: string, pct: number }|null,
 * }}
 */
export function onboardingFunnel(retrato) {
  const funil = retrato && retrato.onboarding;
  if (!funil || typeof funil !== 'object' || !funil.steps || typeof funil.steps !== 'object') return null;
  const base = num(retrato.prefsDocs);
  const pct = (n) => (base > 0 ? Math.min(100, Math.round((n / base) * 100)) : null);

  const rows = ONBOARDING_STEPS.map((p) => {
    const count = num(funil.steps[p.id]);
    return { id: p.id, label: p.label, kind: p.kind, xp: p.xp, count, pct: pct(count) };
  });

  // O passo que menos gente conclui — só vale com amostra: sem base, não há "pior".
  const medidos = rows.filter((r) => r.pct != null);
  const pior = base > 0 && medidos.length > 0
    ? medidos.reduce((a, b) => (b.pct < a.pct ? b : a))
    : null;

  const dismissed = num(funil.dismissed);
  return {
    base,
    dismissed,
    dismissedPct: pct(dismissed),
    rows,
    hardest: pior ? { id: pior.id, label: pior.label, pct: pior.pct } : null,
  };
}
