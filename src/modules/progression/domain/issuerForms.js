/**
 * issuerForms — o que o formulário de desafio e de recompensa edita, e como isso
 * vira (e volta de) o que o domínio valida. Puro e testado: datas em pt-BR
 * ("até o dia 30" inclui o dia 30) e prêmios em linhas são os pontos onde um
 * formulário costuma errar sem ninguém ver.
 */
import { addDaysToDateKey, dayStartMs, missionDateKey } from './missionDay.js';

const hojeKey = (now = new Date()) => missionDateKey(now);

/** 'YYYY-MM-DD' (dia civil de Brasília) a partir de ms. */
export function msToDateKey(ms) {
  return Number.isFinite(Number(ms)) && Number(ms) > 0 ? missionDateKey(new Date(Number(ms))) : '';
}

/** O formulário de um desafio novo (começa hoje, dura uma semana). */
export function emptyChallengeForm(now = new Date()) {
  const ini = hojeKey(now);
  return {
    title: '', emoji: '🏆', description: '', rules: '', metric: 'games_played', subject: 'athlete',
    startDate: ini, endDate: addDaysToDateKey(ini, 6), regionState: '', publish: true,
    prizes: [{ label: '', xp: '' }],
  };
}

/** Desafio gravado → formulário. */
export function challengeToForm(c) {
  const fim = Number(c?.endsAt) ? msToDateKey(Number(c.endsAt) - 1) : ''; // o fim é exclusivo (meia-noite do dia seguinte)
  return {
    title: c?.title || '', emoji: c?.emoji || '🏆', description: c?.description || '', rules: c?.rules || '',
    metric: c?.metric || 'games_played', subject: c?.subject === 'club' ? 'club' : 'athlete',
    startDate: msToDateKey(c?.startsAt), endDate: fim, regionState: c?.regionState || '',
    publish: c?.status !== 'draft',
    prizes: (c?.prizes?.length ? c.prizes : [{ label: '', xp: '' }]).map((p) => ({ label: p.label || '', xp: p.xp || '' })),
  };
}

/** Formulário → entrada de `validateChallenge`. O dia final VALE (fim = meia-noite seguinte). */
export function formToChallengeInput(f) {
  const ini = /^\d{4}-\d{2}-\d{2}$/.test(f.startDate) ? dayStartMs(f.startDate) : NaN;
  const fim = /^\d{4}-\d{2}-\d{2}$/.test(f.endDate) ? dayStartMs(addDaysToDateKey(f.endDate, 1)) : NaN;
  return {
    title: f.title, emoji: f.emoji, description: f.description, rules: f.rules, metric: f.metric, subject: f.subject,
    startsAt: ini, endsAt: fim, regionState: f.regionState || null,
    prizes: (f.prizes || []).map((p) => ({ label: p.label, xp: Number(p.xp) || 0 })),
    status: f.publish ? 'active' : 'draft',
  };
}

/** O formulário de uma recompensa nova. */
export function emptyRewardForm() {
  return {
    title: '', description: '', instructions: '', kind: 'discount', quantity: '', validUntil: '', active: true,
    minTier: '', minLevel: '', minGames: '', minStreakWeeks: '', topPercent: '', achievementId: '',
  };
}

export function rewardToForm(r) {
  const e = r?.eligibility || {};
  return {
    title: r?.title || '', description: r?.description || '', instructions: r?.instructions || '', kind: r?.kind || 'other',
    quantity: r?.quantity != null ? String(r.quantity) : '', validUntil: msToDateKey(r?.validUntil ? Number(r.validUntil) - 1 : 0),
    active: r?.status !== 'paused',
    minTier: e.minTier || '', minLevel: e.minLevel ? String(e.minLevel) : '', minGames: e.minGames ? String(e.minGames) : '',
    minStreakWeeks: e.minStreakWeeks ? String(e.minStreakWeeks) : '', topPercent: e.topPercent ? String(e.topPercent) : '',
    achievementId: e.achievementId || '',
  };
}

/** Formulário → entrada de `validateReward`. A validade vale até o fim do dia. */
export function formToRewardInput(f, atual = null) {
  const num = (v) => (v === '' || v == null ? undefined : Number(v));
  return {
    title: f.title, description: f.description, instructions: f.instructions, kind: f.kind,
    quantity: f.quantity === '' ? null : Number(f.quantity),
    validUntil: /^\d{4}-\d{2}-\d{2}$/.test(f.validUntil || '') ? dayStartMs(addDaysToDateKey(f.validUntil, 1)) : null,
    status: f.active ? 'active' : 'paused',
    approvedCount: atual?.approvedCount || 0,
    eligibility: {
      minTier: f.minTier || undefined, minLevel: num(f.minLevel), minGames: num(f.minGames),
      minStreakWeeks: num(f.minStreakWeeks), topPercent: num(f.topPercent), achievementId: f.achievementId || undefined,
    },
  };
}
