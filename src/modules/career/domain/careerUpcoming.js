/**
 * MINHA CARREIRA — a aba PRÓXIMOS (docs/54 §4.9). PURO.
 *
 *  - a DESCOBERTA: a agenda oficial das federações da pessoa
 *    (`federation_events` esportivos), os torneios chancelados e os públicos
 *    da plataforma — o que ainda vai acontecer e ainda não está no plano;
 *  - "Pôr no meu plano": o rascunho do `career_events` planejado, já
 *    preenchido (`planDraftFrom`), com `origin_ref` para não oferecer de novo;
 *  - o PLANO: os planejados + os torneios da plataforma em que a pessoa está
 *    inscrita (derivados, nada gravado);
 *  - a contagem regressiva do PRINCIPAL, o prazo de inscrição e o .ics.
 *
 * Fonte que FALHOU chega `undefined` e fica de fora da conta — quem diz o que
 * faltou é a tela (`docs/27`).
 */
import { t, tk } from '@/core/i18n';
import { instanteDoDiaEmMs } from '@/core/domain/instant.js';
import { addDays, daysBetween, isISODate, toISODate, todayLocal } from '@/modules/training/domain/dates.js';
import { brtDateTime } from '@/modules/tournament/domain/ics.js';
import { CAREER_FORMAT, CAREER_STATUS, awaitsResult, platformPlanTournamentId } from './careerEvent.js';

/** Rótulos da prioridade (o valor gravado está em `CAREER_PRIORITY`). */
export const PRIORITY_LABEL = Object.freeze({
  main: tk('Principal'), important: tk('Importante'), casual: tk('Só para jogar'),
});

/** De onde vem o item da descoberta. */
export const DISCOVERY_KIND = Object.freeze({ FEDERATION: 'federation', SANCTIONED: 'sanctioned', PLATFORM: 'platform' });
export const DISCOVERY_KIND_LABEL = Object.freeze({
  federation: tk('Agenda da federação'), sanctioned: tk('Chancelado'), platform: tk('No PickleRush'),
});

/** Os tipos da agenda da federação que são torneio para jogar. */
const FED_KINDS = new Set(['competition', 'selection']);

const dia = (v) => {
  if (isISODate(v)) return v;
  const ms = instanteDoDiaEmMs(v);
  return Number.isFinite(ms) ? toISODate(new Date(ms)) : null;
};
const fimDe = (ini, fim) => (isISODate(fim) && fim >= ini ? fim : ini);

/** Agenda das federações → itens da descoberta (só o esportivo, marcado, que não passou). */
export function discoveryFromFederationEvents(events, { federations = {}, today = todayLocal() } = {}) {
  return (events || []).map((ev) => {
    if (!ev?.id || !FED_KINDS.has(ev.kind) || ev.status === 'cancelled' || ev.status === 'postponed') return null;
    const ini = dia(ev.date);
    if (!ini) return null;
    const fim = fimDe(ini, ev.end_date);
    if (fim < today) return null;
    const fed = federations[ev.federation_id] || {};
    return {
      key: `fed:${ev.id}`,
      kind: DISCOVERY_KIND.FEDERATION,
      title: String(ev.title || t('Torneio')).slice(0, 120),
      start_date: ini,
      end_date: fim,
      city: ev.place?.city || '',
      state: ev.place?.state || '',
      federation_id: ev.federation_id || null,
      federation_name: fed.name || '',
      federation_acronym: fed.acronym || '',
      // A agenda da federação (a aba dela, onde o evento tem local e horário).
      link: ev.federation_id ? `/federacoes/${ev.federation_id}?aba=agenda` : null,
    };
  }).filter(Boolean);
}

/** Torneios públicos da plataforma → itens (chancelado quando a chancela foi aprovada). */
export function discoveryFromTournaments(tournaments, { today = todayLocal() } = {}) {
  return (tournaments || []).map((tt) => {
    if (!tt?.id || tt.visibility !== 'public' || tt.archived === true || ['draft', 'cancelled', 'finished'].includes(tt.status)) return null;
    const ini = dia(tt.starts_at) || dia(tt.start_date);
    if (!ini) return null;
    const fim = fimDe(ini, dia(tt.ends_at));
    if (fim < today) return null;
    const chancela = tt.federation_sanction?.status === 'approved';
    return {
      key: `tor:${tt.id}`,
      kind: chancela ? DISCOVERY_KIND.SANCTIONED : DISCOVERY_KIND.PLATFORM,
      title: String(tt.name || t('Torneio')).slice(0, 120),
      start_date: ini,
      end_date: fim,
      city: tt.city || '',
      state: tt.state || '',
      federation_id: chancela ? tt.federation_id || null : null,
      federation_name: chancela ? tt.federation_sanction?.federation_name || '' : '',
      federation_acronym: chancela ? tt.federation_sanction?.federation_acronym || '' : '',
      tournament_id: tt.id,
      link: `/torneios/${tt.id}`,
    };
  }).filter(Boolean);
}

/**
 * A descoberta: as duas fontes juntas, sem o que já está no plano (pelo
 * `origin_ref` ou pelo torneio ligado) nem os torneios em que a pessoa já
 * está inscrita. Do mais cedo ao mais tarde.
 */
export function buildDiscovery({ federationEvents, tournaments, events, myTournaments, federations, today = todayLocal() } = {}) {
  const noPlano = new Set();
  (events || []).forEach((e) => {
    if (e.origin_ref) noPlano.add(e.origin_ref);
    if (e.platform_tournament_id) noPlano.add(`tor:${e.platform_tournament_id}`);
  });
  (myTournaments || []).filter((tt) => tt?.is_player).forEach((tt) => noPlano.add(`tor:${tt.id}`));
  return [
    ...discoveryFromFederationEvents(federationEvents, { federations, today }),
    ...discoveryFromTournaments(tournaments, { today }),
  ].filter((i) => !noPlano.has(i.key))
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.title.localeCompare(b.title));
}

/** "Pôr no meu plano": o planejado já preenchido (prioridade "Só para jogar"). */
export function planDraftFrom(item) {
  if (!item) return null;
  return {
    name: item.title,
    start_date: item.start_date,
    end_date: item.end_date !== item.start_date ? item.end_date : null,
    city: item.city || '',
    state: item.state || '',
    federated: Boolean(item.federation_id || item.federation_name),
    federation_id: item.federation_id || null,
    federation_name: item.federation_name || '',
    federation_acronym: item.federation_acronym || '',
    status: CAREER_STATUS.PLANNED,
    priority: 'casual',
    entries: [{ format: CAREER_FORMAT.DOUBLES }],
    // Só `origin_ref`: `platform_tournament_id` é o vínculo do "É este" (o resultado oficial).
    origin_ref: item.key,
  };
}

/**
 * O PLANO: os planejados (não cancelados) e os torneios da plataforma em que
 * a pessoa está inscrita e que ainda vêm (sem repetir o planejado ligado a
 * eles). Do mais cedo ao mais tarde. Lista que falhou chega `undefined`.
 */
export function upcomingPlan({ events, myTournaments, today = todayLocal() } = {}) {
  const planejados = (events || []).filter((e) => e.status === CAREER_STATUS.PLANNED)
    .map((e) => ({ key: `fora:${e.id}`, kind: 'career', event: e, date: e.start_date, title: e.name }));
  // Só o plano que ESTÁ na lista esconde o torneio: o que já saiu dela (jogado) não pode sumir com ele.
  const ligados = new Set(planejados.flatMap(({ event: e }) => [e.platform_tournament_id, platformPlanTournamentId(e)]).filter(Boolean));
  const daqui = (myTournaments || []).filter((tt) => tt?.is_player && !ligados.has(tt.id)
    && !['draft', 'cancelled'].includes(tt.status)).map((tt) => {
    const d = dia(tt.starts_at) || dia(tt.start_date);
    return d && fimDe(d, dia(tt.ends_at)) >= today
      ? { key: `tor:${tt.id}`, kind: 'platform', tournament: tt, date: d, title: tt.name || t('Torneio') }
      : null;
  }).filter(Boolean);
  return [...planejados, ...daqui].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

/** Dias até o planejado (0 = hoje). */
export const daysUntil = (iso, today = todayLocal()) => (isISODate(iso) ? daysBetween(today, iso) : null);

/**
 * A contagem regressiva: o PRINCIPAL mais próximo que ainda vem; sem nenhum
 * Principal, o planejado mais próximo (todo plano nasce "Só para jogar").
 * O torneio em andamento (hoje entre o início e o fim) conta como "É hoje"
 * (`days: 0`). `null` sem planejado.
 */
export function mainCountdown(events, today = todayLocal()) {
  const p = (events || [])
    .filter((e) => e.status === CAREER_STATUS.PLANNED && isISODate(e.start_date) && fimDe(e.start_date, e.end_date) >= today)
    .sort((a, b) => (b.priority === 'main') - (a.priority === 'main') || a.start_date.localeCompare(b.start_date))[0];
  return p ? { event: p, days: Math.max(0, daysUntil(p.start_date, today)) } : null;
}

/** "Faltam 12 dias", "É amanhã", "É hoje". */
export function countdownText(days) {
  if (days === 0) return t('É hoje');
  if (days === 1) return t('É amanhã');
  return t('Faltam {n} dias', { n: days });
}

/** O prazo de inscrição: `null` sem prazo; senão dias que faltam e se fechou. */
export function deadlineInfo(event, today = todayLocal()) {
  const d = event?.registration_deadline;
  if (!isISODate(d)) return null;
  const days = daysUntil(d, today);
  return { date: d, days, closed: days < 0, soon: days >= 0 && days <= 3 };
}

/** O .ics do planejado: o dia inteiro de jogo, das 8h às 20h de Brasília. */
export function careerEventIcs(event) {
  if (!event || !isISODate(event.start_date)) return null;
  const fim = fimDe(event.start_date, event.end_date);
  return {
    uid: `${event.id || event.start_date}@picklerush-carreira`,
    start: brtDateTime(event.start_date, '08:00'),
    end: brtDateTime(fim, '20:00'),
    title: event.name,
    location: [event.city, event.state].filter(Boolean).join(' - '),
    description: [event.aim ? t('Meta: {m}', { m: event.aim }) : '', event.if_then || ''].filter(Boolean).join('\n'),
  };
}

/**
 * O foco SUGERIDO para o torneio: o aspecto que mais aparece a melhorar nos
 * balanços respondidos (`weaknesses`). `null` sem balanço — nunca inventa.
 */
export function suggestedFocus(debriefs) {
  const conta = new Map();
  (debriefs || []).filter((d) => d?.status === 'respondido').forEach((d) => (d.weaknesses || []).forEach((a) => conta.set(a, (conta.get(a) || 0) + 1)));
  const [melhor] = [...conta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return melhor ? melhor[0] : null;
}

/**
 * O que a carreira pede da pessoa ("Precisa de você"): os planejados que
 * passaram sem resultado ("Como foi?") e as inscrições que fecham em até 3
 * dias sem "Já me inscrevi". `undefined` com a lista que não carregou.
 */
export function careerPlanPending(events, today = todayLocal()) {
  if (!Array.isArray(events)) return undefined;
  const comoFoi = events.filter(awaitsResult);
  const prazos = events.filter((e) => e.status === CAREER_STATUS.PLANNED && !e.registered && deadlineInfo(e, today)?.soon);
  return {
    comoFoi: comoFoi.length,
    comoFoiEvento: comoFoi.length === 1 ? comoFoi[0].id : null,
    prazos: prazos.length,
    prazoEvento: prazos.length === 1 ? prazos[0].id : null,
  };
}

/** A véspera (D-1) do principal: o dia em que a tela lembra o foco. */
export const isEve = (event, today = todayLocal()) => Boolean(event?.start_date) && addDays(today, 1) === event.start_date;
