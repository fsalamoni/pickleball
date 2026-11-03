/**
 * Como uma marcação aparece na tela — o mesmo texto na câmera, na central, no
 * cartão do dia de jogo e no telão. Quatro tipos (`kind`, gravado) e o motivo
 * (`reason`, gravado) que diz QUAL linha ou regra decidiu: fora longa ou
 * lateral, saque curto (na cozinha) ou na área errada, pé na cozinha no voleio
 * ou no impulso, pé no saque e dois quiques (docs/53 §2).
 */

import { t, tk } from '@/core/i18n';

export const CALL_LABEL = {
  bounce: { in: tk('Dentro'), out: tk('Fora'), review: tk('Revisar') },
  volley: { fault: tk('Falta: pé na cozinha'), clean: tk('Voleio sem falta'), review: tk('Revisar o pé') },
  serve_foot: { fault: tk('Falta: pé no saque'), clean: tk('Saque sem falta de pé'), review: tk('Revisar o pé no saque') },
  two_bounce: { fault: tk('Falta: dois quiques'), clean: tk('Dois quiques respeitados'), review: tk('Revisar os dois quiques') },
};
export const CALL_TONE = { in: 'green', out: 'red', review: 'amber', fault: 'red', clean: 'green' };
export const CALL_COLOR = { in: '#16a34a', out: '#dc2626', review: '#ca8a04', fault: '#dc2626', clean: '#16a34a' };
export const CALL_TEXT = { in: 'text-green-700', out: 'text-red-600', review: 'text-amber-700', fault: 'text-red-600', clean: 'text-green-700' };

/** O rótulo da FALTA quando o motivo é sabido (quique fora, pé, dois quiques). */
const FAULT_BY_REASON = {
  long: tk('Fora: longa'),
  wide: tk('Fora: lateral'),
  short: tk('Saque curto: na cozinha'),
  wrong_box: tk('Saque na área errada'),
  net: tk('Não passou a rede'),
  contact: tk('Falta: pé na cozinha no voleio'),
  momentum: tk('Falta: pé na cozinha no impulso'),
  reentry: tk('Falta: voleio sem sair da cozinha'),
  baseline: tk('Falta no saque: pé na linha de fundo'),
  sideline: tk('Falta no saque: pé fora da lateral'),
  centerline: tk('Falta no saque: pé fora da central'),
  return: tk('Falta: devolução sem quicar'),
  third: tk('Falta: 3ª bola sem quicar'),
};

/** A linha (ou o momento) que decidiu, para o "revisar" dizer onde olhar. */
const REASON_WHERE = {
  long: tk('linha de fundo'),
  wide: tk('linha lateral'),
  short: tk('linha da cozinha'),
  wrong_box: tk('linha central'),
  net: tk('rede'),
  contact: tk('pé no voleio'),
  momentum: tk('pé no impulso'),
  reentry: tk('pé antes do voleio'),
  unseen: tk('pé fora de vista'),
  airborne: tk('pé no ar'),
  baseline: tk('linha de fundo'),
  sideline: tk('extensão da lateral'),
  centerline: tk('extensão da central'),
};

const kindOf = (e) => e.type || e.kind;

/** O rótulo de um evento do motor (`type`) ou de um lance da central (`kind`). */
export function callLabel(e) {
  const k = kindOf(e);
  const r = e.reason;
  if ((e.call === 'out' || e.call === 'fault') && FAULT_BY_REASON[r]) {
    const txt = t(FAULT_BY_REASON[r]);
    // "Saque curto" e "área errada" já dizem que é saque.
    return e.serve && k === 'bounce' && !['short', 'wrong_box'].includes(r) ? t('Saque: {c}', { c: txt.toLowerCase() }) : txt;
  }
  if (e.call === 'review' && REASON_WHERE[r]) {
    return t('Revisar: {o}', { o: t(REASON_WHERE[r]) });
  }
  const base = t(CALL_LABEL[k]?.[e.call] || CALL_LABEL.bounce.review);
  return e.serve && k === 'bounce' ? t('Saque: {c}', { c: base.toLowerCase() }) : base;
}

/**
 * O que dizer em voz alta (curto, como o juiz de linha: "Fora!", "Curta!").
 * O juiz de linha só GRITA a falta: "dentro" e "sem falta" ficam calados
 * (`''`) — no meio do ponto, falar a cada quique atrapalha quem joga.
 */
export const CALL_SPOKEN = {
  bounce: { in: '', out: tk('Fora'), review: tk('Revisar') },
  volley: { fault: tk('Falta na cozinha'), clean: '', review: tk('Revisar o pé') },
  serve_foot: { fault: tk('Pé no saque'), clean: '', review: tk('Revisar o saque') },
  two_bounce: { fault: tk('Dois quiques'), clean: '', review: tk('Revisar') },
};
const SPOKEN_BY_REASON = { short: tk('Curta'), net: tk('Rede') };

export function callSpoken(e) {
  const k = kindOf(e);
  if (e.call === 'out' && SPOKEN_BY_REASON[e.reason]) return t(SPOKEN_BY_REASON[e.reason]);
  const said = CALL_SPOKEN[k]?.[e.call];
  if (said === '') return '';
  return t(said || CALL_SPOKEN.bounce.review);
}

const cm = (m) => Math.round(Math.abs(m) * 100);

/** O pé no saque: além de qual linha, ou a quanto dela. */
const SERVE_FOOT_LINE = { baseline: tk('linha de fundo'), sideline: tk('extensão da lateral'), centerline: tk('extensão da linha central') };

/**
 * A medida por trás da marcação. Aceita o evento do motor (`marginM`…) e a
 * marcação gravada (`margin_m`…).
 */
export function callDetail(e) {
  if (e.moved) return t('A câmera tinha saído do lugar: a medida não vale. Marque os pontos de novo.');
  const k = kindOf(e);
  const margin = e.marginM ?? e.margin_m;
  const depth = e.depthM ?? e.depth_m;
  const u = e.uncertaintyM ?? e.uncertainty_m;
  if (k === 'bounce') {
    if (margin == null) return '';
    return margin >= 0
      ? t('{d} cm para dentro da linha (±{u} cm)', { d: cm(margin), u: cm(u || 0) })
      : t('{d} cm para fora da linha (±{u} cm)', { d: cm(margin), u: cm(u || 0) });
  }
  if (k === 'two_bounce') {
    return e.reason === 'third'
      ? t('A 3ª bola foi batida no ar: a devolução do saque tem de quicar antes (regra dos dois quiques).')
      : t('A devolução foi batida no ar: o saque tem de quicar antes (regra dos dois quiques).');
  }
  if (k === 'serve_foot') {
    if (e.reason === 'airborne') return t('No instante do saque nenhum pé estava firme no chão: confira o pé de apoio.');
    if (depth == null) return '';
    const l = t(SERVE_FOOT_LINE[e.reason] || SERVE_FOOT_LINE.baseline);
    return depth >= 0
      ? t('Pé {d} cm além da {l} no saque (±{u} cm)', { d: cm(depth), l, u: cm(u || 0) })
      : t('Pé a {d} cm da {l} no saque (±{u} cm)', { d: cm(depth), l, u: cm(u || 0) });
  }
  if (e.reason === 'reentry') return t('O jogador estava na cozinha e voleou sem antes firmar os dois pés fora dela.');
  if (e.reason === 'airborne') return t('O voleio foi no ar: a falta depende de onde o pé toca ao cair.');
  if (e.reason === 'unseen' && depth == null) return t('O pé saiu de vista da câmera antes de o jogador se firmar.');
  if (depth == null) return t('Os pés ficaram fora da cozinha durante o voleio e o impulso.');
  const quando = e.reason === 'momentum' ? t('no impulso, depois do voleio') : t('no voleio');
  return depth >= 0
    ? t('Pé {d} cm dentro da cozinha {q} (±{u} cm)', { d: cm(depth), q: quando, u: cm(u || 0) })
    : t('Pé a {d} cm da linha da cozinha (±{u} cm)', { d: cm(depth), u: cm(u || 0) });
}
