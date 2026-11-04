/**
 * A LINHA DO TEMPO da carreira — DERIVADA, sem documento próprio.
 *
 * Junta o que já existe: os torneios da plataforma em que a pessoa jogou
 * (`listMyTournaments` com `is_player`), os pódios desses torneios e dos dias
 * de jogo (a estante, `listMyTrophies`), os jogos de dia de jogo publicados,
 * os pontos lançados no ranking oficial das federações e os torneios de fora
 * (`career_events`). Cada fonte falha SOZINHA: a que chegou `undefined` vai
 * para `faltou` e a tela diz o que não carregou — nunca "você ainda não jogou".
 *
 * Organizada por temporada (o ano civil), com o divisor "Hoje": acima o que
 * vem (planejado), abaixo o histórico. PURO.
 */
import { t, tk } from '@/core/i18n';
import { instanteDoDiaEmMs } from '@/core/domain/instant.js';
import { toISODate, todayLocal } from '@/modules/training/domain/dates.js';
import { PODIUM_PLACE } from '@/modules/tournament/domain/podium.js';
import {
  CAREER_STATUS, bestPosition, careerCompleteness, careerSeal, entryLabel, isCareerPlatformTournament, placementText,
} from './careerEvent.js';
import { careerDebriefFor } from './careerDebrief.js';

/** Origem de um item. `fora` = declarado pela pessoa. Valor de `?origem=` (contrato). */
export const TIMELINE_SOURCE = Object.freeze({
  CAREER: 'fora', TOURNAMENT: 'torneio', GAME_DAY: 'dia_de_jogo', FEDERATION: 'federacao',
});
/** O filtro de origem da tela: da plataforma (tudo que não foi digitado) × de fora. */
export const ORIGIN_FILTER = Object.freeze({ PLATFORM: 'plataforma', OUTSIDE: 'fora' });

/** Selo derivado. Neste PR: declarado (digitado) e oficial (da plataforma ou da federação). */
export const SEAL = Object.freeze({ DECLARED: 'declared', OFFICIAL: 'official' });
export const SEAL_LABEL = Object.freeze({ declared: tk('Declarado'), official: tk('Oficial') });

const FONTE_ROTULO = Object.freeze({
  career: tk('os torneios de fora'),
  tournaments: tk('os torneios da plataforma'),
  trophies: tk('os pódios da plataforma'),
  gameDayGames: tk('os dias de jogo publicados'),
  federationPoints: tk('os pontos das federações'),
});

const dia = (v) => {
  const ms = instanteDoDiaEmMs(v);
  return Number.isFinite(ms) ? toISODate(new Date(ms)) : null;
};
const ano = (iso) => Number(String(iso).slice(0, 4));

function itemDeFora(ev, myTournaments) {
  const pos = bestPosition(ev);
  const cats = (ev.entries || []).map((e) => [entryLabel(e), placementText(e)].filter(Boolean).join(' — '));
  return {
    id: `fora:${ev.id}`,
    source: TIMELINE_SOURCE.CAREER,
    date: ev.start_date,
    datePrecision: ev.date_precision === 'year' ? 'year' : 'day',
    upcoming: ev.status === CAREER_STATUS.PLANNED,
    cancelled: ev.status === CAREER_STATUS.CANCELLED,
    title: ev.name,
    subtitle: cats.join(' · '),
    where: [ev.city, ev.state].filter(Boolean).join(' · '),
    position: pos,
    federated: ev.federated === true,
    federation: ev.federation_acronym || ev.federation_name || '',
    seal: careerSeal(ev, myTournaments),
    eventId: ev.id,
    platformTournamentId: ev.platform_tournament_id || null,
    link: null,
  };
}

/**
 * Monta a linha do tempo.
 * @param {{
 *   career?: object[], tournaments?: object[], trophies?: { torneios?: object[], diasDeJogo?: object[] },
 *   gameDayGames?: object[], federationPoints?: object[], today?: string,
 * }} fontes cada uma `undefined` quando a leitura falhou (ou ainda não chegou)
 * @returns {{ upcoming: object[], seasons: Array<{ year: number, items: object[], summary: object, closed: boolean }>, faltou: string[], total: number }}
 */
export function buildCareerTimeline(fontes = {}) {
  const today = fontes.today || todayLocal();
  // Os pódios vêm de DUAS leituras (`listMyTrophies`, allSettled): a metade que
  // falhou também é "faltou", senão a linha do tempo e a retrospectiva saem
  // com menos medalhas sem dizer.
  const ausente = (k) => fontes[k] === undefined
    || (k === 'trophies' && (fontes.trophies.torneios === undefined || fontes.trophies.diasDeJogo === undefined));
  const faltou = Object.entries(FONTE_ROTULO).filter(([k]) => ausente(k)).map(([, v]) => t(v));
  const myTournaments = fontes.tournaments;
  const itens = [];

  // Pódios da plataforma, pelo torneio e pelo dia de jogo.
  const podioTorneio = new Map();
  (fontes.trophies?.torneios || []).forEach((tr) => {
    const atual = podioTorneio.get(tr.tournamentId);
    if (!atual || tr.position < atual.position) podioTorneio.set(tr.tournamentId, tr);
  });
  const podioDia = new Map();
  (fontes.trophies?.diasDeJogo || []).forEach((tr) => {
    const atual = podioDia.get(tr.gameDayId);
    if (!atual || tr.position < atual.position) podioDia.set(tr.gameDayId, tr);
  });

  // Pontos oficiais por torneio (o torneio chancelado também está na lista da plataforma).
  const pontosPorTorneio = new Map();
  (fontes.federationPoints || []).filter((p) => p && p.status !== 'cancelled').forEach((p) => {
    const k = p.tournament_id || `r:${p.result_id || p.id}`;
    if (!pontosPorTorneio.has(k)) pontosPorTorneio.set(k, []);
    pontosPorTorneio.get(k).push(p);
  });

  // Torneio de fora ligado ao da plataforma ("É este") com o selo oficial: aparece UMA vez.
  const ligados = new Set((fontes.career || []).filter((e) => careerSeal(e, myTournaments) === SEAL.OFFICIAL).map((e) => e.platform_tournament_id));
  // Os pontos do torneio ligado também não viram um item "Federação" à parte.
  ligados.forEach((id) => pontosPorTorneio.delete(id));

  (fontes.career || []).forEach((ev) => itens.push(itemDeFora(ev, myTournaments)));

  (myTournaments || []).filter((tt) => isCareerPlatformTournament(tt) && !ligados.has(tt.id)).forEach((tt) => {
    const data = dia(tt.starts_at) || dia(tt.start_date);
    if (!data) return;
    const podio = podioTorneio.get(tt.id);
    const pontos = pontosPorTorneio.get(tt.id) || [];
    pontosPorTorneio.delete(tt.id);
    const melhorOficial = pontos.map((p) => Number(p.position)).filter((n) => n >= 1 && n <= 3).sort()[0] || null;
    const pos = podio?.position || melhorOficial;
    itens.push({
      id: `torneio:${tt.id}`,
      source: TIMELINE_SOURCE.TOURNAMENT,
      date: data,
      datePrecision: 'day',
      upcoming: data > today,
      cancelled: tt.status === 'cancelled',
      title: tt.name || t('Torneio'),
      subtitle: [podio?.subtitle, pos ? t(PODIUM_PLACE[pos].um) : '', pontos.length ? t('{n} pontos no ranking oficial', { n: pontos.reduce((s, p) => s + (Number(p.points) || 0), 0) }) : ''].filter(Boolean).join(' · '),
      where: [tt.city, tt.state].filter(Boolean).join(' · '),
      position: pos || null,
      federated: Boolean(tt.federation_id && tt.federation_sanction?.status === 'approved') || pontos.length > 0,
      federation: pontos[0]?.federation_acronym || '',
      seal: SEAL.OFFICIAL,
      link: `/torneios/${tt.id}`,
    });
  });

  // Pontos de federação sem o torneio na lista (torneio fora da plataforma, ou a lista falhou).
  pontosPorTorneio.forEach((pontos, k) => {
    const p = pontos[0];
    const data = dia(p.date);
    if (!data) return;
    const pos = pontos.map((x) => Number(x.position)).filter((n) => n >= 1 && n <= 3).sort()[0] || null;
    itens.push({
      id: `federacao:${k}`,
      source: TIMELINE_SOURCE.FEDERATION,
      date: data,
      datePrecision: 'day',
      upcoming: false,
      cancelled: false,
      title: p.tournament_name || t('Torneio'),
      subtitle: [p.modality_name, t('{n} pontos no ranking oficial', { n: pontos.reduce((s, x) => s + (Number(x.points) || 0), 0) })].filter(Boolean).join(' · '),
      where: '',
      position: pos,
      federated: true,
      federation: p.federation_acronym || '',
      seal: SEAL.OFFICIAL,
      link: null,
    });
  });

  // Dias de jogo publicados: um item por dia (os jogos daquele dia juntos).
  const porDia = new Map();
  (fontes.gameDayGames || []).forEach((g) => {
    const data = g.at ? toISODate(new Date(g.at)) : null;
    if (!data) return;
    const k = g.gameDayId || `${g.label}|${data}`;
    if (!porDia.has(k)) porDia.set(k, { data, label: g.label, gameDayId: g.gameDayId, jogos: 0, vitorias: 0 });
    const d = porDia.get(k);
    d.jogos += 1;
    if (g.won) d.vitorias += 1;
    if (data > d.data) d.data = data;
  });
  porDia.forEach((d, k) => {
    const podio = d.gameDayId ? podioDia.get(d.gameDayId) : null;
    itens.push({
      id: `dia:${k}`,
      source: TIMELINE_SOURCE.GAME_DAY,
      date: d.data,
      datePrecision: 'day',
      upcoming: false,
      cancelled: false,
      title: d.label || t('Dia de jogo'),
      subtitle: [t('{v} vitórias em {n} jogos', { v: d.vitorias, n: d.jogos }), podio ? t(PODIUM_PLACE[podio.position].um) : ''].filter(Boolean).join(' · '),
      where: '',
      position: podio?.position || null,
      federated: false,
      federation: '',
      seal: SEAL.OFFICIAL,
      link: d.gameDayId ? `/dia-de-jogo/${d.gameDayId}` : null,
    });
  });

  const upcoming = itens.filter((i) => i.upcoming && !i.cancelled).sort((a, b) => a.date.localeCompare(b.date));
  const passados = itens.filter((i) => !i.upcoming || i.cancelled).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  const anoAtual = ano(today);
  const porAno = new Map();
  passados.forEach((i) => {
    const y = ano(i.date);
    if (!porAno.has(y)) porAno.set(y, []);
    porAno.get(y).push(i);
  });
  const seasons = [...porAno.entries()].sort((a, b) => b[0] - a[0]).map(([year, items]) => ({
    year, items, closed: year < anoAtual, summary: seasonSummary(items),
  }));
  return { upcoming, seasons, faltou, total: itens.length };
}

/** O resumo da temporada: quantos eventos, pódios e medalhas. Cancelado não conta. */
export function seasonSummary(items) {
  const valendo = (items || []).filter((i) => !i.cancelled);
  const conta = (p) => valendo.filter((i) => i.position === p).length;
  return {
    events: valendo.length,
    tournaments: valendo.filter((i) => i.source !== TIMELINE_SOURCE.GAME_DAY).length,
    podiums: valendo.filter((i) => i.position).length,
    gold: conta(1), silver: conta(2), bronze: conta(3),
  };
}

/** Lê os filtros da URL (`?podios=1&federados=1&origem=fora|plataforma`). */
export function timelineFiltersFromParams(params) {
  const get = (k) => (params && typeof params.get === 'function' ? params.get(k) : null);
  const origem = get('origem');
  return {
    podios: get('podios') === '1',
    federados: get('federados') === '1',
    origem: Object.values(ORIGIN_FILTER).includes(origem) ? origem : null,
  };
}

/** Aplica os filtros a uma lista de itens. */
export function filterTimelineItems(items, f = {}) {
  return (items || []).filter((i) => {
    if (f.podios && !i.position) return false;
    if (f.federados && !i.federated) return false;
    if (f.origem === ORIGIN_FILTER.OUTSIDE && i.source !== TIMELINE_SOURCE.CAREER) return false;
    if (f.origem === ORIGIN_FILTER.PLATFORM && i.source === TIMELINE_SOURCE.CAREER) return false;
    return true;
  });
}

/** A linha do tempo filtrada (temporada que fica vazia sai da lista). */
export function filterTimeline(timeline, f = {}) {
  if (!timeline) return timeline;
  const ativo = f.podios || f.federados || f.origem;
  if (!ativo) return timeline;
  return {
    ...timeline,
    upcoming: filterTimelineItems(timeline.upcoming, f),
    seasons: timeline.seasons
      .map((s) => ({ ...s, items: filterTimelineItems(s.items, f) }))
      .filter((s) => s.items.length > 0),
  };
}

/* ------------------------------------------ troféus de fora (estante) -- */

/**
 * Os troféus DECLARADOS para a estante ("Fora da plataforma"): um por
 * participação com pódio (1º a 3º) de um torneio jogado. Selo "declarado"
 * (ou "oficial" com o "É este?" confirmado). Nunca entram no `destaque`.
 */
export function careerTrophies(events, { myTournaments, me = null } = {}) {
  const out = [];
  (events || []).filter((e) => e.status === CAREER_STATUS.PLAYED).forEach((ev) => {
    (ev.entries || []).forEach((en, i) => {
      const pos = { champion: 1, runner_up: 2, third: 3 }[en.placement];
      if (!pos) return;
      const people = [me ? { user_id: me.uid || null, name: me.name || t('Você'), photo_url: me.photo_url || null } : null, en.partner ? { user_id: en.partner.uid || null, name: en.partner.name, photo_url: null } : null].filter(Boolean);
      out.push({
        id: `c:${ev.id}:${i}`,
        kind: 'fora',
        position: pos,
        placeLabel: t(PODIUM_PLACE[pos][people.length > 1 ? 'varios' : 'um']),
        title: ev.name,
        subtitle: entryLabel(en),
        date: instanteDoDiaEmMs(ev.start_date) || 0,
        datePrecision: ev.date_precision === 'year' ? 'year' : 'day',
        // Só o ano é conhecido (modo lista): estante e cartão mostram o ano, nunca "1º de janeiro".
        dateLabel: ev.date_precision === 'year' ? String(ev.start_date).slice(0, 4) : null,
        platformTournamentId: ev.platform_tournament_id || null,
        city: ev.city || '', state: ev.state || '',
        people,
        declared: careerSeal(ev, myTournaments) !== SEAL.OFFICIAL,
        seal: careerSeal(ev, myTournaments),
        eventId: ev.id,
        link: `/carreira?aba=linha-do-tempo&evento=${encodeURIComponent(ev.id)}`,
        publicLink: null,
        shared: false,
      });
    });
  });
  return out.sort((a, b) => b.date - a.date || a.position - b.position);
}

/** As contagens dos troféus de fora (próprias — não somam com as verificadas). */
export function careerTrophyCounts(trophies) {
  const l = trophies || [];
  return {
    ouro: l.filter((x) => x.position === 1).length,
    prata: l.filter((x) => x.position === 2).length,
    bronze: l.filter((x) => x.position === 3).length,
    total: l.length,
  };
}

/* ------------------------------------------------------- abas e resumo -- */

/** As abas de `/carreira` (`?aba=`). Contrato de link: nunca renomeie. `proximos` e `metas` chegam no PR 4. */
export const CAREER_TAB = Object.freeze({ TIMELINE: 'linha-do-tempo', ACHIEVEMENTS: 'conquistas' });

/** A aba pedida na URL, ou a linha do tempo. */
export function careerTabFromParam(v) {
  return Object.values(CAREER_TAB).includes(v) ? v : CAREER_TAB.TIMELINE;
}

/**
 * O resumo da seção Carreira da Minha área: quantos torneios de fora, o
 * último jogado e o que falta nele (o ÚNICO próximo passo). `null` quando a
 * lista não carregou — nunca "nenhum torneio". `debriefs` (os balanços da
 * pessoa) põe o balanço na conta ("N de 4"); `undefined` — não carregou — tira
 * a camada da conta em vez de afirmar que falta.
 */
export function careerAreaSummary(events, { debriefs } = {}) {
  if (!Array.isArray(events)) return null;
  const jogados = events.filter((e) => e.status === CAREER_STATUS.PLAYED)
    .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)) || (Number(b.updated_at_ms) || 0) - (Number(a.updated_at_ms) || 0));
  const last = jogados[0] || null;
  return {
    total: events.length,
    played: jogados.length,
    planned: events.filter((e) => e.status === CAREER_STATUS.PLANNED).length,
    podiums: jogados.filter((e) => bestPosition(e)).length,
    last,
    lastCompleteness: last
      ? careerCompleteness(last, Array.isArray(debriefs) ? { debriefDone: Boolean(careerDebriefFor(last, debriefs)) } : {})
      : null,
  };
}

/* ------------------------------------------------- Meu desempenho -- */

/**
 * O bloco "Fora da plataforma (declarado por você)" de Meu desempenho: os
 * torneios de fora JOGADOS, os pódios e os títulos declarados. O torneio ligado
 * a um da plataforma ("É este") fica de fora da conta — ele já está nos números
 * verificados, e somar de novo seria contar duas vezes. `null` quando a lista
 * não carregou (nunca zero). Nada aqui entra em ranking, rating nem XP.
 */
export function careerPerformanceSummary(events) {
  if (!Array.isArray(events)) return null;
  const jogados = events.filter((e) => e.status === CAREER_STATUS.PLAYED);
  const declarados = jogados.filter((e) => !e.platform_tournament_id);
  const entradas = declarados.flatMap((e) => e.entries || []);
  const pos = (en) => ({ champion: 1, runner_up: 2, third: 3 }[en.placement] || null);
  return {
    tournaments: declarados.length,
    podiums: entradas.filter(pos).length,
    titles: entradas.filter((en) => pos(en) === 1).length,
    linked: jogados.length - declarados.length,
  };
}
