/**
 * Como uma marcação aparece na tela — o mesmo texto na câmera, na central, no
 * cartão do dia de jogo e no telão.
 */

import { t, tk } from '@/core/i18n';

export const CALL_LABEL = {
  bounce: { in: tk('Dentro'), out: tk('Fora'), review: tk('Revisar') },
  volley: { fault: tk('Falta: pé na cozinha'), clean: tk('Voleio sem falta'), review: tk('Revisar o pé') },
};
export const CALL_TONE = { in: 'green', out: 'red', review: 'amber', fault: 'red', clean: 'green' };
export const CALL_COLOR = { in: '#16a34a', out: '#dc2626', review: '#ca8a04', fault: '#dc2626', clean: '#16a34a' };
export const CALL_TEXT = { in: 'text-green-700', out: 'text-red-600', review: 'text-amber-700', fault: 'text-red-600', clean: 'text-green-700' };

const cm = (m) => Math.round(Math.abs(m) * 100);

/** O rótulo de um evento do motor (`type`) ou de um lance da central (`kind`). */
export function callLabel(e) {
  const k = e.type || e.kind;
  return t(CALL_LABEL[k]?.[e.call] || CALL_LABEL.bounce.review);
}

/**
 * A medida por trás da marcação. Aceita o evento do motor (`marginM`…) e a
 * marcação gravada (`margin_m`…).
 */
export function callDetail(e) {
  const k = e.type || e.kind;
  const margin = e.marginM ?? e.margin_m;
  const depth = e.depthM ?? e.depth_m;
  const u = e.uncertaintyM ?? e.uncertainty_m;
  if (k === 'bounce') {
    if (margin == null) return '';
    return margin >= 0
      ? t('{d} cm para dentro da linha (±{u} cm)', { d: cm(margin), u: cm(u || 0) })
      : t('{d} cm para fora da linha (±{u} cm)', { d: cm(margin), u: cm(u || 0) });
  }
  if (depth == null) return t('Os pés ficaram fora da cozinha durante o voleio e o impulso.');
  return depth >= 0
    ? t('Pé {d} cm dentro da cozinha (±{u} cm)', { d: cm(depth), u: cm(u || 0) })
    : t('Pé a {d} cm da linha da cozinha (±{u} cm)', { d: cm(depth), u: cm(u || 0) });
}
