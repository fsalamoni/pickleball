/**
 * A LINHA DO TEMPO da carreira — DERIVADA, sem documento próprio.
 *
 * Junta o que já existe: os torneios da plataforma em que a pessoa jogou
 * (`listMyTournaments` com `is_player`), os pódios desses torneios (a estante,
 * `listMyTrophies`), os pontos lançados no ranking oficial das federações e os
 * torneios de fora (`career_events`). As LIGAS em que ela jogou entram como
 * uma fonte opcional (`leagues`, uma participação por divisão), com o pódio da
 * estante (`trophies.ligas`).
 *
 * ⭐ A linha do tempo é de TORNEIOS (daqui ou de fora, federados ou não). Dia
 * de jogo não é torneio, ainda que tenha ranking do dia: só entra quando a
 * PESSOA pede (`includeGameDays`, a escolha "Incluir dias de jogo" da tela), e
 * mesmo assim sem medalha nem pódio e fora das contas da temporada, das metas
 * e da retrospectiva — só "N vitórias em M jogos". Cada fonte falha SOZINHA: a que chegou `undefined` vai
 * para `faltou` e a tela diz o que não carregou — nunca "você ainda não jogou".
 *
 * Organizada por temporada (o ano civil), com o divisor "Hoje": acima o que
 * vem (planejado), abaixo o histórico. PURO.
 */
import { fmtNumero, t, tk } from '@/core/i18n';
import { instanteDoDiaEmMs } from '@/core/domain/instant.js';
import { toISODate, todayLocal } from '@/modules/training/domain/dates.js';
import { PODIUM_PLACE } from '@/modules/tournament/domain/podium.js';
import {
  CAREER_STATUS, PLACEMENT_POSITION, awaitsResult, careerCompleteness, careerSeal, entryLabel, isCareerPlatformTournament, isOutsidePlayed, isPlatformPlan,
  placementText, platformPlanTournamentId,
} from './careerEvent.js';
import { careerDebriefFor } from './careerDebrief.js';
import { partnerSealFor } from './careerPartner.js';

/** Origem de um item. `fora` = declarado pela pessoa. Valor de `?origem=` (contrato). */
export const TIMELINE_SOURCE = Object.freeze({
  CAREER: 'fora', TOURNAMENT: 'torneio', GAME_DAY: 'dia_de_jogo', FEDERATION: 'federacao', LEAGUE: 'liga',
});
/** O filtro de origem da tela: da plataforma (tudo que não foi digitado) × de fora. */
export const ORIGIN_FILTER = Object.freeze({ PLATFORM: 'plataforma', OUTSIDE: 'fora' });

/** Selo derivado. Neste PR: declarado (digitado) e oficial (da plataforma ou da federação). */
export const SEAL = Object.freeze({ DECLARED: 'declared', CONFIRMED: 'confirmed', OFFICIAL: 'official' });
export const SEAL_LABEL = Object.freeze({ declared: tk('Declarado'), confirmed: tk('Confirmado pela dupla'), official: tk('Oficial') });

const FONTE_ROTULO = Object.freeze({
  career: tk('os torneios de fora'),
  tournaments: tk('os torneios da plataforma'),
  trophies: tk('os pódios da plataforma'),
  federationPoints: tk('os pontos das federações'),
});
const ROTULO_DIAS = tk('os dias de jogo publicados');

const dia = (v) => {
  const ms = instanteDoDiaEmMs(v);
  return Number.isFinite(ms) ? toISODate(new Date(ms)) : null;
};
const ano = (iso) => Number(String(iso).slice(0, 4));

/** "1.500 pontos no ranking oficial", com o separador do idioma. */
const pontosOficiais = (n) => t('{n} pontos no ranking oficial', { n: fmtNumero(n) });

const degraus = (lista) => lista.map(Number).filter((n) => n >= 1 && n <= 3).sort();

/**
 * O item do torneio de fora. `oficial` (`{ positions, points, federated }`)
 * chega quando ele está ligado a um torneio daqui ("É este") com o selo
 * Oficial: o selo confere que a pessoa JOGOU, não a colocação que ela digitou —
 * então pódio, medalha e pontos saem da PLATAFORMA, nunca do declarado (a mesma
 * régua da vitrine pública).
 */
function itemDeFora(ev, myTournaments, partners, oficial = null) {
  // O selo da dupla sai dos documentos que só o servidor grava (`career_partner`).
  const partnerState = partners ? partnerSealFor(ev, partners) : null;
  // Um degrau por PARTICIPAÇÃO com pódio (ouro em duplas e prata na mista são dois pódios).
  const positions = oficial ? oficial.positions : degraus((ev.entries || []).map((e) => PLACEMENT_POSITION[e.placement]));
  const pos = positions[0] || null;
  const cats = (ev.entries || []).map((e) => [entryLabel(e), oficial ? '' : placementText(e)].filter(Boolean).join(' — '));
  if (oficial && pos) cats.push(t(PODIUM_PLACE[pos].um));
  if (oficial?.points) cats.push(pontosOficiais(oficial.points));
  return {
    id: `fora:${ev.id}`,
    source: TIMELINE_SOURCE.CAREER,
    date: ev.start_date,
    datePrecision: ev.date_precision === 'year' ? 'year' : 'day',
    upcoming: ev.status === CAREER_STATUS.PLANNED,
    cancelled: ev.status === CAREER_STATUS.CANCELLED,
    // O plano que passou sem resposta: fica na lista ("Como foi?") e fora das contas.
    pending: awaitsResult(ev),
    title: ev.name,
    subtitle: cats.join(' · '),
    where: [ev.city, ev.state].filter(Boolean).join(' · '),
    position: pos,
    positions,
    federated: ev.federated === true || Boolean(oficial?.federated),
    federation: ev.federation_acronym || ev.federation_name || '',
    seal: careerSeal(ev, myTournaments, partnerState),
    partnerState,
    eventId: ev.id,
    platformTournamentId: ev.platform_tournament_id || null,
    link: null,
  };
}

/**
 * Monta a linha do tempo.
 * @param {{
 *   career?: object[], tournaments?: object[], trophies?: { torneios?: object[] },
 *   gameDayGames?: object[], federationPoints?: object[], today?: string, includeGameDays?: boolean,
 *   leagues?: object[],
 * }} fontes cada uma `undefined` quando a leitura falhou (ou ainda não chegou).
 *   `gameDayGames` só conta com `includeGameDays` (a escolha da pessoa).
 *   `leagues` (as participações de `leagueSeasonsOfPlayer`) é opcional: só quem a lê passa a chave.
 * @returns {{ upcoming: object[], seasons: Array<{ year: number, items: object[], summary: object, closed: boolean }>, faltou: string[], total: number }}
 */
export function buildCareerTimeline(fontes = {}) {
  const today = fontes.today || todayLocal();
  // Os pódios chegam como `{ torneios }` (`listMyTrophies`): a lista que falhou
  // também é "faltou", senão a linha do tempo e a retrospectiva saem com menos
  // medalhas sem dizer.
  const ausente = (k) => fontes[k] === undefined || (k === 'trophies' && fontes.trophies.torneios === undefined);
  const faltou = Object.entries(FONTE_ROTULO).filter(([k]) => ausente(k)).map(([, v]) => t(v));
  const comDias = fontes.includeGameDays === true;
  if (comDias && fontes.gameDayGames === undefined) faltou.push(t(ROTULO_DIAS));
  // As confirmações das duplas são opcionais (só quem as lê passa a chave): pedidas e
  // sem resposta, o selo "Confirmado pela dupla" não pode virar "Declarado" calado.
  if ('partners' in fontes && fontes.partners === undefined) faltou.push(t('as confirmações das duplas'));
  // As ligas também são opcionais. Sem a lista, ou sem os pódios delas, a linha do
  // tempo sai com menos do que a pessoa jogou — e diz.
  if ('leagues' in fontes && fontes.leagues === undefined) faltou.push(t('as ligas'));
  else if ('leagues' in fontes && fontes.trophies && fontes.trophies.ligas === undefined) faltou.push(t('os pódios das ligas'));
  const myTournaments = fontes.tournaments;
  const itens = [];

  // Pódios da plataforma: só de torneio (dia de jogo não tem medalha). TODOS os
  // do torneio (um por categoria), o melhor primeiro.
  const podiosTorneio = new Map();
  (fontes.trophies?.torneios || []).forEach((tr) => {
    if (!podiosTorneio.has(tr.tournamentId)) podiosTorneio.set(tr.tournamentId, []);
    podiosTorneio.get(tr.tournamentId).push(tr);
  });
  podiosTorneio.forEach((l) => l.sort((a, b) => a.position - b.position));
  // Os degraus OFICIAIS de um torneio: os pódios dele e, na falta, o melhor dos pontos lançados.
  const degrausOficiais = (id, pontos) => {
    const dosPodios = degraus((podiosTorneio.get(id) || []).map((tr) => tr.position));
    return dosPodios.length ? dosPodios : degraus(pontos.map((p) => p.position)).slice(0, 1);
  };
  const chancelado = (tt) => Boolean(tt?.federation_id && tt.federation_sanction?.status === 'approved');

  // Pontos oficiais por torneio (o torneio chancelado também está na lista da plataforma).
  const pontosPorTorneio = new Map();
  (fontes.federationPoints || []).filter((p) => p && p.status !== 'cancelled').forEach((p) => {
    const k = p.tournament_id || `r:${p.result_id || p.id}`;
    if (!pontosPorTorneio.has(k)) pontosPorTorneio.set(k, []);
    pontosPorTorneio.get(k).push(p);
  });

  // Torneio de fora ligado ao da plataforma ("É este") com o selo oficial: aparece UMA vez.
  // O item que fica é o de fora, mas com o resultado OFICIAL (pódios e pontos do
  // torneio daqui) — a colocação digitada não vira medalha sob o selo Oficial.
  const oficialDe = new Map();
  (fontes.career || []).filter((e) => careerSeal(e, myTournaments) === SEAL.OFFICIAL).forEach((e) => {
    const id = e.platform_tournament_id;
    const pontos = pontosPorTorneio.get(id) || [];
    oficialDe.set(id, {
      positions: degrausOficiais(id, pontos),
      points: pontos.reduce((s, p) => s + (Number(p.points) || 0), 0),
      federated: pontos.length > 0 || chancelado(myTournaments.find((tt) => tt?.id === id)),
    });
  });
  const ligados = new Set(oficialDe.keys());
  // Os pontos do torneio ligado também não viram um item "Federação" à parte.
  ligados.forEach((id) => pontosPorTorneio.delete(id));

  // O plano de um torneio do PickleRush: só enquanto vem e a pessoa não está
  // inscrita (inscrita, o próprio torneio aparece); passado, vale o oficial.
  const inscrito = new Set((myTournaments || []).filter(isCareerPlatformTournament).map((tt) => tt.id));
  (fontes.career || []).filter((ev) => !isPlatformPlan(ev)
    || (ev.status === CAREER_STATUS.PLANNED && !inscrito.has(platformPlanTournamentId(ev))))
    .forEach((ev) => itens.push(itemDeFora(ev, myTournaments, fontes.partners,
      careerSeal(ev, myTournaments) === SEAL.OFFICIAL ? oficialDe.get(ev.platform_tournament_id) : null)));

  (myTournaments || []).filter((tt) => isCareerPlatformTournament(tt) && !ligados.has(tt.id)).forEach((tt) => {
    const data = dia(tt.starts_at) || dia(tt.start_date);
    if (!data) return;
    const podio = (podiosTorneio.get(tt.id) || [])[0];
    const pontos = pontosPorTorneio.get(tt.id) || [];
    pontosPorTorneio.delete(tt.id);
    const positions = degrausOficiais(tt.id, pontos);
    const pos = positions[0] || null;
    itens.push({
      id: `torneio:${tt.id}`,
      source: TIMELINE_SOURCE.TOURNAMENT,
      date: data,
      datePrecision: 'day',
      upcoming: data > today,
      cancelled: tt.status === 'cancelled',
      title: tt.name || t('Torneio'),
      subtitle: [podio?.subtitle, pos ? t(PODIUM_PLACE[pos].um) : '', pontos.length ? pontosOficiais(pontos.reduce((s, p) => s + (Number(p.points) || 0), 0)) : ''].filter(Boolean).join(' · '),
      where: [tt.city, tt.state].filter(Boolean).join(' · '),
      position: pos,
      positions,
      federated: chancelado(tt) || pontos.length > 0,
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
    const pos = degraus(pontos.map((x) => x.position))[0] || null;
    itens.push({
      id: `federacao:${k}`,
      source: TIMELINE_SOURCE.FEDERATION,
      date: data,
      datePrecision: 'day',
      upcoming: false,
      cancelled: false,
      title: p.tournament_name || t('Torneio'),
      // A colocação vai no texto: o selo com o número é só visual (`aria-hidden`).
      subtitle: [p.modality_name, pos ? t(PODIUM_PLACE[pos].um) : '', pontosOficiais(pontos.reduce((s, x) => s + (Number(x.points) || 0), 0))].filter(Boolean).join(' · '),
      where: '',
      position: pos,
      positions: pos ? [pos] : [],
      federated: true,
      federation: p.federation_acronym || '',
      seal: SEAL.OFFICIAL,
      link: null,
    });
  });

  // Ligas: uma participação por divisão. A data é a do FIM quando a liga
  // encerrou (é quando o resultado existe); antes disso, a do começo.
  const podiosLiga = new Map((fontes.trophies?.ligas || []).map((tr) => [`${tr.leagueId}:${tr.divisionId}`, tr]));
  (fontes.leagues || []).forEach((lg) => {
    const encerrada = lg.status === 'finished';
    const data = (encerrada && lg.endedAt ? toISODate(new Date(lg.endedAt)) : null)
      || lg.startDate || (lg.joinedAt ? toISODate(new Date(lg.joinedAt)) : null);
    if (!data) return;
    const podio = encerrada && !lg.withdrawn ? podiosLiga.get(`${lg.leagueId}:${lg.divisionId}`) : null;
    const pos = podio?.position || null;
    const jogos = lg.wins + lg.losses;
    itens.push({
      id: `liga:${lg.id}`,
      source: TIMELINE_SOURCE.LEAGUE,
      date: data,
      datePrecision: 'day',
      upcoming: !encerrada && data > today,
      cancelled: false,
      title: lg.name || t('Liga'),
      subtitle: [
        lg.divisionName,
        lg.withdrawn ? t('Saiu da liga') : (encerrada ? '' : t('Em andamento')),
        pos ? podio.placeLabel : '',
        jogos > 0 ? t('{v} vitórias em {n} jogos', { v: lg.wins, n: jogos }) : '',
      ].filter(Boolean).join(' · '),
      where: [lg.city, lg.state].filter(Boolean).join(' · '),
      position: pos,
      positions: pos ? [pos] : [],
      federated: false,
      federation: '',
      seal: SEAL.OFFICIAL,
      link: `/ligas/${lg.leagueId}`,
    });
  });

  // Dias de jogo publicados — SÓ quando a pessoa pediu. Um item por dia (os
  // jogos daquele dia juntos), sem medalha nem pódio: dia de jogo não é torneio.
  const porDia = new Map();
  (comDias ? fontes.gameDayGames || [] : []).forEach((g) => {
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
    itens.push({
      id: `dia:${k}`,
      source: TIMELINE_SOURCE.GAME_DAY,
      date: d.data,
      datePrecision: 'day',
      upcoming: false,
      cancelled: false,
      title: d.label || t('Dia de jogo'),
      subtitle: t('{v} vitórias em {n} jogos', { v: d.vitorias, n: d.jogos }),
      where: '',
      position: null,
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

/**
 * O resumo da temporada: quantos torneios, ligas, pódios e medalhas. Cancelado
 * não conta, e o dia de jogo (quando a pessoa o incluiu) também não: ele aparece
 * na lista, mas não é torneio — `gameDays` só diz quantos estão à vista. Liga
 * não é torneio: tem a conta dela (`leagues`), e o pódio dela é pódio.
 */
export function seasonSummary(items) {
  const valendo = (items || []).filter((i) => !i.cancelled);
  const dias = valendo.filter((i) => i.source === TIMELINE_SOURCE.GAME_DAY);
  // O plano que passou sem resposta (`pending`) aparece na lista, mas não é torneio jogado.
  const disputas = valendo.filter((i) => i.source !== TIMELINE_SOURCE.GAME_DAY && !i.pending);
  const ligas = disputas.filter((i) => i.source === TIMELINE_SOURCE.LEAGUE);
  const podios = disputas.flatMap(itemPodiums);
  const conta = (p) => podios.filter((x) => x === p).length;
  return {
    events: disputas.length,
    tournaments: disputas.length - ligas.length,
    leagues: ligas.length,
    gameDays: dias.length,
    podiums: podios.length,
    gold: conta(1), silver: conta(2), bronze: conta(3),
  };
}

/**
 * Os pódios de um item da linha do tempo: um degrau (1–3) por PARTICIPAÇÃO.
 * O jeito ÚNICO de contar pódio — temporada, metas e retrospectiva usam este.
 */
export const itemPodiums = (item) => item?.positions || (item?.position ? [item.position] : []);

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
 * participação com pódio (1º a 3º) de um torneio jogado. Sempre "declarado"
 * (ou "confirmado pela dupla"): o torneio ligado a um daqui com o selo Oficial
 * NÃO gera troféu — o selo confere que a pessoa jogou, não a colocação
 * digitada, e o troféu verdadeiro já está na aba Torneios. Nunca entram no `destaque`.
 */
export function careerTrophies(events, { myTournaments, me = null } = {}) {
  const out = [];
  (events || []).filter((e) => isOutsidePlayed(e) && careerSeal(e, myTournaments) !== SEAL.OFFICIAL).forEach((ev) => {
    (ev.entries || []).forEach((en, i) => {
      const pos = PLACEMENT_POSITION[en.placement];
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
        declared: true,
        seal: SEAL.DECLARED,
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

/** As abas de `/carreira` (`?aba=`). Contrato de link: nunca renomeie. */
export const CAREER_TAB = Object.freeze({
  TIMELINE: 'linha-do-tempo', UPCOMING: 'proximos', GOALS: 'metas', ACHIEVEMENTS: 'conquistas',
});

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
  // Só o torneio de fora JOGADO: o plano de um torneio daqui e o plano sem resposta não contam.
  const jogados = events.filter(isOutsidePlayed)
    .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)) || (Number(b.updated_at_ms) || 0) - (Number(a.updated_at_ms) || 0));
  const last = jogados[0] || null;
  return {
    total: events.length,
    played: jogados.length,
    planned: events.filter((e) => e.status === CAREER_STATUS.PLANNED).length,
    podiums: declaredPodiums(jogados).length,
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
  const jogados = events.filter(isOutsidePlayed);
  const declarados = jogados.filter((e) => !e.platform_tournament_id);
  const podios = declaredPodiums(jogados);
  return {
    tournaments: declarados.length,
    podiums: podios.length,
    titles: podios.filter((p) => p === 1).length,
    linked: jogados.length - declarados.length,
  };
}

/**
 * Os pódios DECLARADOS de uma lista de torneios de fora: um degrau por
 * participação, sem os do torneio ligado a um da plataforma (o pódio dele é o
 * oficial). A conta única de Minha área e Meu desempenho.
 */
function declaredPodiums(events) {
  return degraus(events.filter((e) => !e.platform_tournament_id).flatMap((e) => (e.entries || []).map((en) => PLACEMENT_POSITION[en.placement])));
}
