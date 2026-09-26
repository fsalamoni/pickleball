/**
 * O RANKING DA CASA (Onda CB).
 *
 * O "torneio da casa" era um segundo jeito de fazer a mesma coisa que o jogo
 * aberto já faz: começar o torneio CRIAVA um dia de jogo da arena, e o
 * resultado saía do ranking do dia. A Onda CA fez de todo jogo aberto um dia
 * de jogo — sobrou o torneio da casa como uma cópia pior. Ele saiu, e o que
 * ele tinha de bom (a classificação que faz a turma voltar) virou isto:
 *
 *  - **os dias de jogo da arena com placar** (todo jogo aberto é um) — cada um
 *    distribui pontos pela colocação no RANKING DO DIA, o mesmo que o painel e
 *    o telão mostram (`computeGameDayLeaderboard`);
 *  - **os torneios da plataforma sediados na arena** — que passam a ser os
 *    torneios da casa, com as regras da plataforma. Cada CATEGORIA distribui
 *    pontos pela colocação final, e vale o dobro de um dia de jogo;
 *  - **o ladder antigo** (`arena_ladders/{arena}_geral`), com os pontos dos
 *    torneios internos que já aconteceram — lido, nunca reescrito.
 *
 * DERIVADO, nunca gravado. Nada disso escreve no banco: o ranking é somado a
 * cada leitura, a partir do que já existe. Ranking gravado por navegador é o
 * "segundo escritor" que já fez três rankings discordarem na plataforma
 * (Onda BJ); ranking derivado não tem como divergir da fonte.
 *
 * PURO. Sem React, sem Firebase.
 */
import { computeGameDayLeaderboard } from '@/modules/clubs/domain/gameDayLeaderboard.js';
import {
  GAME_KIND, GAME_KIND_LABELS, gameKindsIn, splitGamesByKind,
} from '@/modules/games/domain/gameKind.js';
import { GAME_DAY_FORMAT, formatHasScores } from '@/modules/clubs/domain/gameDayFormats.js';
import { buildRanking } from '@/modules/tournament/domain/ranking.js';
import { resolveStageScoringConfig } from '@/modules/tournament/domain/scoring.js';
import { normalizePhases } from '@/modules/tournament/domain/phases.js';
import { isMatchDecided, matchLoserIds, matchWinnerIds } from '@/modules/tournament/domain/progression.js';
import {
  MATCH_STATUS, TOURNAMENT_STATUS, TOURNAMENT_STAGE_TYPE,
} from '@/modules/tournament/domain/constants.js';
import { isTournamentRankingEligible } from '@/modules/tournament/domain/rankingEligibility.js';
import { LADDER_POINTS, LADDER_POINTS_PARTICIPATION, ladderPointsFor } from './leagues.js';
import { isOpenMatchGameDay, openMatchFormatLabel } from './openMatchGameDay.js';
import { houseEventDate, tournamentHouseDate } from './houseTournaments.js';

// As funções de LISTAR torneios moram em `houseTournaments.js` (leve, sem o
// motor). Reexportadas aqui para quem já importa tudo do ranking.
export {
  HOUSE_TOURNAMENT_TONE, houseEventDate, houseTournamentDateLabel, sortHouseTournaments, tournamentHouseDate,
} from './houseTournaments.js';

/** De onde veio cada linha de pontos. */
export const HOUSE_EVENT_KIND = Object.freeze({
  GAME_DAY: 'game_day',
  TOURNAMENT: 'tournament',
  LEGACY: 'legacy',
});

/** Um torneio da casa vale o dobro de um dia de jogo, por categoria. */
export const HOUSE_TOURNAMENT_WEIGHT = 2;

/** Chave de filtro "todos" (temporada ou modalidade). */
export const HOUSE_ALL = 'all';

/** Chave de filtro dos torneios, ao lado dos formatos de dia de jogo. */
export const HOUSE_FORMAT_TOURNAMENT = 'torneio';

/** A ordem em que as modalidades aparecem no filtro. */
const ORDEM_DOS_FORMATOS = [
  GAME_DAY_FORMAT.AMERICANO,
  GAME_DAY_FORMAT.AMERICANO_LIVE,
  GAME_DAY_FORMAT.MEXICANO,
  GAME_DAY_FORMAT.KING_OF_COURT,
  HOUSE_FORMAT_TOURNAMENT,
];

/** A tabela de pontos, para a tela explicar a conta. */
export function houseRankingPointsTable() {
  const posicoes = Object.keys(LADDER_POINTS).map(Number).sort((a, b) => a - b);
  return {
    gameDay: [
      ...posicoes.map((p) => ({ label: `${p}º`, points: LADDER_POINTS[p] })),
      { label: 'Jogou', points: LADDER_POINTS_PARTICIPATION },
    ],
    tournament: [
      ...posicoes.map((p) => ({ label: `${p}º`, points: LADDER_POINTS[p] * HOUSE_TOURNAMENT_WEIGHT })),
      { label: 'Jogou', points: LADDER_POINTS_PARTICIPATION * HOUSE_TOURNAMENT_WEIGHT },
    ],
  };
}

/** O nome do filtro de modalidade. */
export function houseFormatLabel(format) {
  if (format === HOUSE_ALL) return 'Tudo';
  if (format === HOUSE_FORMAT_TOURNAMENT) return 'Torneios';
  return openMatchFormatLabel(format) || 'Outro';
}

/* ------------------------------------------------------------------ */
/*  Datas                                                             */
/* ------------------------------------------------------------------ */

/** A temporada (ano) de uma data `YYYY-MM-DD`; `null` sem data. */
export function houseSeasonOf(dataISO) {
  const m = /^(\d{4})-/.exec(String(dataISO || ''));
  return m ? Number(m[1]) : null;
}

function naTemporada(dataISO, season) {
  if (season === HOUSE_ALL || season == null) return true;
  return houseSeasonOf(dataISO) === Number(season);
}

/* ------------------------------------------------------------------ */
/*  O que precisa ser carregado                                       */
/* ------------------------------------------------------------------ */

/**
 * Os dias de jogo cujo placar precisa ser lido: da temporada, que já
 * aconteceram (ou acontecem hoje) e com formato que tem placar. Play não tem
 * placar — não há o que ler, e ele não pontua.
 *
 * `excludeIds`: dias cujos pontos JÁ estão no ladder antigo (os dias de jogo
 * de torneios internos encerrados — ver `legacyLadderGameDayIds`). Somá-los de
 * novo contaria o mesmo torneio duas vezes.
 */
export function houseGameDaysToLoad(gameDays = [], { season = HOUSE_ALL, today = '', excludeIds = null } = {}) {
  return (gameDays || []).filter((g) => g?.id
    && g.status !== 'archived'
    && !(excludeIds && excludeIds.has(g.id))
    && formatHasScores(g.format)
    && g.date
    && (!today || String(g.date) <= today)
    && naTemporada(g.date, season));
}

/** O torneio conta no ranking da casa quando é público e já terminou. */
export function isHouseTournamentCounted(t) {
  return isTournamentRankingEligible(t) && t.status === TOURNAMENT_STATUS.FINISHED;
}

/** Os torneios cujos jogos precisam ser lidos: os que contam, na temporada. */
export function houseTournamentsToLoad(tournaments = [], { season = HOUSE_ALL } = {}) {
  return (tournaments || []).filter((t) => t?.id
    && isHouseTournamentCounted(t)
    && naTemporada(tournamentHouseDate(t), season));
}

/* ------------------------------------------------------------------ */
/*  Um dia de jogo → pontos                                           */
/* ------------------------------------------------------------------ */

function jogoDecidido(g) {
  if (!g || g.score_a == null || g.score_b == null) return false;
  return Number.isFinite(Number(g.score_a)) && Number.isFinite(Number(g.score_b));
}

/** Mesma campanha ⇒ mesma posição (quem empata em tudo não é separado pelo nome). */
function mesmaCampanha(a, b) {
  return a.wins === b.wins && a.losses === b.losses
    && a.diff === b.diff && a.pointsAgainst === b.pointsAgainst;
}

/**
 * O que um dia de jogo da arena leva ao ranking da casa.
 *
 * A colocação é a do RANKING DO DIA, com TODO mundo — convidado sem conta
 * inclusive. Se um convidado venceu o dia, o primeiro atleta com conta ficou
 * em 2º, e é 2º que ele leva: tirar o convidado da conta daria ao atleta uma
 * posição que ele não conquistou. Só quem tem conta recebe pontos (é pela
 * conta que o ranking reconhece a pessoa).
 *
 * @returns {{ key, kind, id, title, date, format, formatLabel, isOpenMatch, link,
 *   status: 'counted'|'no_results', decidedGames: number,
 *   entries: Array<{ user_id, name, photo_url, position: number, won: number, played: number }> }}
 */
export function gameDayHouseEvent({ gameDay, participants = [], games = [] } = {}) {
  const base = {
    key: `gd:${gameDay?.id}`,
    kind: HOUSE_EVENT_KIND.GAME_DAY,
    id: gameDay?.id,
    title: gameDay?.title || (isOpenMatchGameDay(gameDay) ? 'Jogo aberto' : 'Dia de jogo'),
    date: houseEventDate(gameDay?.date),
    format: gameDay?.format || '',
    formatLabel: openMatchFormatLabel(gameDay?.format),
    isOpenMatch: isOpenMatchGameDay(gameDay),
    link: `/dia-de-jogo/${gameDay?.id}`,
  };
  const decididos = (games || []).filter(jogoDecidido);
  if (decididos.length === 0) return { ...base, status: 'no_results', decidedGames: 0, entries: [] };

  const lista = (participants || []).filter((p) => p?.id);
  const linhas = computeGameDayLeaderboard(
    lista.map((p) => ({ id: p.id, name: p.name })),
    decididos,
  ).filter((l) => Number(l.games) > 0);

  const porId = new Map(lista.map((p) => [p.id, p]));
  const porUid = new Map();
  let posicaoAnterior = 0;
  linhas.forEach((l, i) => {
    const posicao = i > 0 && mesmaCampanha(l, linhas[i - 1]) ? posicaoAnterior : i + 1;
    posicaoAnterior = posicao;
    const p = porId.get(l.id);
    if (!p?.user_id || porUid.has(p.user_id)) return;
    porUid.set(p.user_id, {
      user_id: p.user_id,
      name: p.name || l.name || 'Atleta',
      photo_url: p.photo_url || null,
      position: posicao,
      won: Number(l.wins) || 0,
      played: Number(l.games) || 0,
    });
  });

  return {
    ...base,
    status: 'counted',
    decidedGames: decididos.length,
    entries: [...porUid.values()],
  };
}

/**
 * Os eventos de UM dia de jogo, SEPARADOS POR TIPO de jogo (Onda CF).
 *
 * Com jogo simples e em duplas no mesmo dia são DOIS rankings do dia — e,
 * portanto, duas colocações. Somá-las numa só daria ao vencedor do simples a
 * posição de uma disputa que ele não jogou. Cada tipo vira um evento:
 *
 *  - duplas mantém a chave de sempre (`gd:<id>`) — um dia só de duplas sai
 *    exatamente como antes;
 *  - simples ganha a sua (`gd:<id>:simples`), com "· simples" no título.
 *
 * Sem resultado, é o evento "sem resultado" de sempre, um só.
 *
 * @returns {Array<object>} os eventos, no formato de `gameDayHouseEvent`
 */
export function gameDayHouseEvents({ gameDay, participants = [], games = [] } = {}) {
  const decididos = (games || []).filter(jogoDecidido);
  const tipos = gameKindsIn(decididos);
  if (tipos.length <= 1) {
    const ev = gameDayHouseEvent({ gameDay, participants, games });
    if (tipos[0] !== GAME_KIND.SINGLES) return [ev];
    return [{ ...ev, key: `${ev.key}:simples`, title: `${ev.title} · simples`, gameKind: GAME_KIND.SINGLES }];
  }
  const porTipo = splitGamesByKind(decididos);
  return tipos.map((tipo) => {
    const ev = gameDayHouseEvent({ gameDay, participants, games: porTipo[tipo] });
    return tipo === GAME_KIND.DOUBLES
      ? { ...ev, title: `${ev.title} · duplas`, gameKind: tipo }
      : { ...ev, key: `${ev.key}:simples`, title: `${ev.title} · ${GAME_KIND_LABELS[tipo].toLowerCase()}`, gameKind: tipo };
  });
}

/* ------------------------------------------------------------------ */
/*  Um torneio → pontos                                               */
/* ------------------------------------------------------------------ */

function idsDoLado(m, lado) {
  const ids = m?.[lado === 'a' ? 'side_a_ids' : 'side_b_ids'];
  if (Array.isArray(ids) && ids.length > 0) return ids.map(String).filter(Boolean);
  const bruto = m?.[lado === 'a' ? 'side_a' : 'side_b'];
  if (bruto == null) return [];
  if (Array.isArray(bruto)) return bruto.map(String).filter(Boolean);
  return String(bruto).split('+').map((s) => s.trim()).filter(Boolean);
}

/** O jogo aconteceu de verdade (dois lados, resultado) — bye e W.O. não. */
function jogouDeVerdade(m) {
  return m?.status === MATCH_STATUS.FINISHED
    && idsDoLado(m, 'a').length > 0 && idsDoLado(m, 'b').length > 0
    && matchWinnerIds(m) != null;
}

/**
 * A colocação final de UMA categoria de torneio.
 *
 * Mata-mata: 1º quem venceu a final, 2º quem perdeu; 3º e 4º pela disputa de
 * 3º lugar, ou — sem ela — os dois semifinalistas dividem o 3º. Contar
 * vitórias no lugar da chave daria o título a quem ganhou mais jogos na fase
 * de grupos, e não a quem venceu a final.
 *
 * Qualquer outra estrutura (pontos corridos, grupos, suíço, americana,
 * mexicano, dupla eliminação): a classificação oficial da ÚLTIMA fase, com os
 * critérios de desempate da plataforma (`buildRanking`).
 *
 * @returns {Map<string, { position: number|null, played: number, won: number }>}
 *   chave = id da inscrição
 */
export function modalityHousePlacement({ modality = null, tournament = null, matches = [] } = {}) {
  const saida = new Map();
  const garante = (id) => {
    if (!saida.has(id)) saida.set(id, { position: null, played: 0, won: 0 });
    return saida.get(id);
  };

  const daCategoria = (matches || []).filter((m) => !modality?.id || !m.modality_id || m.modality_id === modality.id);
  daCategoria.filter(jogouDeVerdade).forEach((m) => {
    const vencedores = new Set(matchWinnerIds(m) || []);
    [...idsDoLado(m, 'a'), ...idsDoLado(m, 'b')].forEach((id) => {
      const s = garante(id);
      s.played += 1;
      if (vencedores.has(id)) s.won += 1;
    });
  });

  const decididos = daCategoria.filter((m) => isMatchDecided(m));
  if (decididos.length === 0) return saida;

  const ultimaFase = Math.max(...decididos.map((m) => Number(m.stage_index ?? 0) || 0));
  const naUltima = decididos.filter((m) => (Number(m.stage_index ?? 0) || 0) === ultimaFase);
  const fases = normalizePhases(modality?.stages);
  const tipo = fases[ultimaFase]?.type;

  const coloca = (ids, posicao) => (ids || []).forEach((id) => {
    const s = garante(String(id));
    if (s.position == null || posicao < s.position) s.position = posicao;
  });

  if (tipo === TOURNAMENT_STAGE_TYPE.KNOCKOUT) {
    const principais = naUltima.filter((m) => !m.third_place);
    const ultimaRodada = Math.max(0, ...principais.map((m) => Number(m.round) || 1));
    const finais = principais.filter((m) => (Number(m.round) || 1) === ultimaRodada);
    if (finais.length === 1) {
      coloca(matchWinnerIds(finais[0]), 1);
      coloca(matchLoserIds(finais[0]), 2);
      const terceiro = naUltima.find((m) => m.third_place);
      if (terceiro) {
        coloca(matchWinnerIds(terceiro), 3);
        coloca(matchLoserIds(terceiro), 4);
      } else {
        principais
          .filter((m) => (Number(m.round) || 1) === ultimaRodada - 1)
          .forEach((m) => coloca(matchLoserIds(m), 3));
      }
      return saida;
    }
    // Final ainda sem vencedor: cai na classificação geral da fase.
  }

  const participantes = [...new Set(naUltima.flatMap((m) => [...idsDoLado(m, 'a'), ...idsDoLado(m, 'b')]))];
  const config = (m) => resolveStageScoringConfig(modality, tournament, m.stage_index ?? 0);
  buildRanking(naUltima, participantes, config)
    .filter((r) => Number(r.played) > 0)
    .forEach((r) => coloca([String(r.participant_id)], Number(r.position)));
  return saida;
}

/** As pessoas (com conta) de uma inscrição: A e B numa dupla, o elenco numa equipe. */
export function registrationHousePeople(reg) {
  if (!reg) return [];
  if (reg.kind === 'team') {
    return (reg.members || [])
      .filter((m) => m?.user_id)
      .map((m) => ({ user_id: m.user_id, name: m.name || 'Atleta', photo_url: m.photo_url || null }));
  }
  return [
    reg.player_a_user_id || reg.user_id
      ? { user_id: reg.player_a_user_id || reg.user_id, name: reg.player_a_name || 'Atleta', photo_url: reg.player_a_photo || null }
      : null,
    reg.player_b_user_id
      ? { user_id: reg.player_b_user_id, name: reg.player_b_name || 'Atleta', photo_url: reg.player_b_photo || null }
      : null,
  ].filter(Boolean);
}

/**
 * O que um torneio da casa leva ao ranking: um evento por CATEGORIA que teve
 * jogo. Quem jogou pela dupla leva os pontos da dupla, cada um.
 */
export function tournamentHouseEvents({ tournament, modalities = [], registrations = [], matches = [] } = {}) {
  if (!tournament?.id) return [];
  const regPorId = new Map((registrations || []).filter((r) => r?.id).map((r) => [String(r.id), r]));
  const data = tournamentHouseDate(tournament);
  const status = isHouseTournamentCounted(tournament) ? 'counted' : 'waiting';

  return (modalities || []).filter((m) => m?.id).map((modality) => {
    const colocacao = modalityHousePlacement({
      modality, tournament, matches: (matches || []).filter((x) => x?.modality_id === modality.id),
    });
    const porUid = new Map();
    colocacao.forEach((c, regId) => {
      if (c.played <= 0 && c.position == null) return;
      registrationHousePeople(regPorId.get(regId)).forEach((pessoa) => {
        const atual = porUid.get(pessoa.user_id);
        if (atual && (atual.position ?? 99) <= (c.position ?? 99)) return;
        porUid.set(pessoa.user_id, {
          ...pessoa,
          position: c.position,
          won: c.won,
          played: Math.max(1, c.played),
        });
      });
    });
    return {
      key: `t:${tournament.id}:${modality.id}`,
      kind: HOUSE_EVENT_KIND.TOURNAMENT,
      id: tournament.id,
      modalityId: modality.id,
      title: tournament.name || 'Torneio',
      subtitle: modality.name || '',
      date: data,
      format: HOUSE_FORMAT_TOURNAMENT,
      formatLabel: 'Torneio',
      isOpenMatch: false,
      link: `/torneios/${tournament.id}`,
      status: porUid.size > 0 ? status : 'no_results',
      decidedGames: (matches || []).filter((x) => x?.modality_id === modality.id && isMatchDecided(x)).length,
      entries: [...porUid.values()],
    };
  });
}

/* ------------------------------------------------------------------ */
/*  O ladder antigo                                                   */
/* ------------------------------------------------------------------ */

/**
 * Os pontos dos torneios internos que já aconteceram. O documento acumula sem
 * data por torneio; a temporada é a do último resultado (`updated_at`).
 */
export function legacyLadderHouseEvent(ladderDoc) {
  const linhas = Array.isArray(ladderDoc?.rankings) ? ladderDoc.rankings : [];
  const entries = linhas
    .filter((l) => l?.user_id && Number(l.points) > 0)
    .map((l) => ({
      user_id: l.user_id,
      name: l.name || 'Atleta',
      photo_url: l.photo_url || null,
      points: Number(l.points) || 0,
      played: Number(l.played) || 0,
      won: Number(l.wins) || 0,
      titles: Number(l.titles) || 0,
      position: null,
    }));
  if (entries.length === 0) return null;
  return {
    key: 'legacy',
    kind: HOUSE_EVENT_KIND.LEGACY,
    id: 'legacy',
    title: 'Torneios internos (formato antigo)',
    date: houseEventDate(ladderDoc?.updated_at),
    format: '',
    formatLabel: 'Torneio interno',
    isOpenMatch: false,
    link: null,
    status: 'counted',
    decidedGames: 0,
    entries,
  };
}

/**
 * Os dias de jogo cujos pontos já foram para o ladder antigo: os dos torneios
 * internos ENCERRADOS (encerrar somava o pódio ao ladder). O torneio interno
 * que começou e nunca foi encerrado não somou nada — o dia de jogo dele conta
 * pelo placar, como qualquer outro.
 */
export function legacyLadderGameDayIds(internalTournaments = []) {
  return new Set((internalTournaments || [])
    .filter((t) => t?.status === 'finished' && typeof t.game_day_id === 'string' && t.game_day_id)
    .map((t) => t.game_day_id));
}

/* ------------------------------------------------------------------ */
/*  A soma                                                            */
/* ------------------------------------------------------------------ */

/** Quantos pontos uma linha vale no ranking da casa. */
export function houseEntryPoints(event, entry) {
  if (!event || !entry) return 0;
  if (event.kind === HOUSE_EVENT_KIND.LEGACY) return Number(entry.points) || 0;
  if (!(Number(entry.played) > 0) && entry.position == null) return 0;
  const base = ladderPointsFor(entry.position);
  return event.kind === HOUSE_EVENT_KIND.TOURNAMENT ? base * HOUSE_TOURNAMENT_WEIGHT : base;
}

function combinaFiltro(event, { season, format }) {
  if (event?.status !== 'counted') return false;
  if (!naTemporada(event.date, season)) return false;
  if (format && format !== HOUSE_ALL) {
    // O ladder antigo não tem modalidade: entra só em "Tudo".
    if (event.kind === HOUSE_EVENT_KIND.LEGACY) return false;
    return event.format === format;
  }
  return true;
}

/**
 * O ranking da casa.
 *
 * Ordem: pontos → títulos → vitórias → MENOS eventos (a mesma pontuação em
 * menos jogos é campanha melhor) → nome. Empate em tudo divide a posição.
 *
 * @returns {{ rows: Array<object>, events: Array<object> }}
 */
export function buildHouseRanking(events = [], { season = HOUSE_ALL, format = HOUSE_ALL } = {}) {
  const contam = (events || []).filter((e) => combinaFiltro(e, { season, format }));
  const porUid = new Map();

  // Do mais antigo ao mais recente: o nome mais recente vence.
  [...contam].sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).forEach((ev) => {
    (ev.entries || []).forEach((en) => {
      const pontos = houseEntryPoints(ev, en);
      if (pontos <= 0) return;
      const atual = porUid.get(en.user_id) || {
        user_id: en.user_id, name: en.name || 'Atleta', photo_url: en.photo_url || null,
        points: 0, events: 0, wins: 0, titles: 0, podiums: 0, best: null, breakdown: [],
      };
      const ehLegado = ev.kind === HOUSE_EVENT_KIND.LEGACY;
      const pos = Number(en.position) || null;
      porUid.set(en.user_id, {
        ...atual,
        name: en.name || atual.name,
        photo_url: en.photo_url || atual.photo_url,
        points: atual.points + pontos,
        events: atual.events + (ehLegado ? Number(en.played) || 0 : 1),
        wins: atual.wins + (Number(en.won) || 0),
        titles: atual.titles + (ehLegado ? Number(en.titles) || 0 : (pos === 1 ? 1 : 0)),
        podiums: atual.podiums + (!ehLegado && pos && pos <= 3 ? 1 : 0),
        best: pos && (atual.best == null || pos < atual.best) ? pos : atual.best,
        breakdown: [...atual.breakdown, { key: ev.key, title: ev.title, date: ev.date, position: pos, points: pontos }],
      });
    });
  });

  const ordenadas = [...porUid.values()].sort((a, b) => (b.points - a.points)
    || (b.titles - a.titles)
    || (b.wins - a.wins)
    || (a.events - b.events)
    || String(a.name).localeCompare(String(b.name), 'pt-BR'));

  let anterior = null;
  const rows = ordenadas.map((r, i) => {
    const empata = anterior
      && anterior.points === r.points && anterior.titles === r.titles
      && anterior.wins === r.wins && anterior.events === r.events;
    const position = empata ? anterior.position : i + 1;
    anterior = { ...r, position };
    return anterior;
  });

  return { rows, events: contam };
}

/** As temporadas com resultado — o ano corrente sempre entra. */
export function houseSeasons(events = [], currentYear = new Date().getFullYear()) {
  const anos = new Set([Number(currentYear)]);
  (events || []).forEach((e) => {
    if (e?.status !== 'counted') return;
    const ano = houseSeasonOf(e.date);
    if (ano) anos.add(ano);
  });
  return [...anos].sort((a, b) => b - a);
}

/**
 * As temporadas que PODEM ter resultado, a partir das listas-base — sem ler o
 * placar de nenhum dia. É o que monta o seletor antes de carregar o detalhe da
 * temporada escolhida (ler todas as temporadas para montar um seletor seria
 * pagar o histórico inteiro a cada visita).
 */
export function houseSeasonsFromSources({
  gameDays = [], tournaments = [], legacy = null, today = '', currentYear = new Date().getFullYear(),
  excludeIds = null,
} = {}) {
  const anos = new Set([Number(currentYear)]);
  houseGameDaysToLoad(gameDays, { season: HOUSE_ALL, today, excludeIds })
    .forEach((g) => { const a = houseSeasonOf(g.date); if (a) anos.add(a); });
  houseTournamentsToLoad(tournaments, { season: HOUSE_ALL })
    .forEach((t) => { const a = houseSeasonOf(tournamentHouseDate(t)); if (a) anos.add(a); });
  const legado = legacyLadderHouseEvent(legacy);
  if (legado) { const a = houseSeasonOf(legado.date); if (a) anos.add(a); }
  return [...anos].sort((a, b) => b - a);
}

/** As modalidades com resultado na temporada, na ordem do filtro. */
export function houseFormats(events = [], { season = HOUSE_ALL } = {}) {
  const presentes = new Set((events || [])
    .filter((e) => e?.status === 'counted' && e.kind !== HOUSE_EVENT_KIND.LEGACY && naTemporada(e.date, season))
    .map((e) => e.format));
  return ORDEM_DOS_FORMATOS.filter((f) => presentes.has(f));
}

/**
 * O resumo do que entrou (para a tela dizer de onde vêm os pontos).
 *
 * @returns {{ gameDays: number, openMatches: number, tournaments: number, categories: number, legacy: boolean }}
 */
export function houseRankingSummary(events = []) {
  const contam = (events || []).filter((e) => e?.status === 'counted');
  const dias = contam.filter((e) => e.kind === HOUSE_EVENT_KIND.GAME_DAY);
  const categorias = contam.filter((e) => e.kind === HOUSE_EVENT_KIND.TOURNAMENT);
  // Um dia com simples e duplas vira DOIS eventos (um por tipo) — mas
  // continua sendo UM dia de jogo.
  return {
    gameDays: new Set(dias.map((e) => e.id)).size,
    openMatches: new Set(dias.filter((e) => e.isOpenMatch).map((e) => e.id)).size,
    tournaments: new Set(categorias.map((e) => e.id)).size,
    categories: categorias.length,
    legacy: contam.some((e) => e.kind === HOUSE_EVENT_KIND.LEGACY),
  };
}

/**
 * O que ainda NÃO entrou — e por quê. Sem isto, a arena olha o ranking, não
 * acha o jogo de ontem e conclui que o sistema errou.
 *
 * @returns {Array<{ key, title, date, link, reason: string }>}
 */
export function houseRankingWaiting({
  gameDays = [], tournaments = [], events = [], season = HOUSE_ALL, today = '', excludeIds = null,
} = {}) {
  const saida = [];
  (tournaments || [])
    .filter((t) => t?.id && isTournamentRankingEligible(t) && !isHouseTournamentCounted(t)
      && naTemporada(tournamentHouseDate(t), season))
    .forEach((t) => saida.push({
      key: `t:${t.id}`,
      title: t.name || 'Torneio',
      date: tournamentHouseDate(t),
      link: `/torneios/${t.id}`,
      reason: t.status === TOURNAMENT_STATUS.IN_PROGRESS
        ? 'Em andamento — entra quando o torneio terminar.'
        : 'Ainda não começou — entra quando terminar.',
    }));

  (events || [])
    .filter((e) => e?.kind === HOUSE_EVENT_KIND.GAME_DAY && e.status === 'no_results' && naTemporada(e.date, season))
    .forEach((e) => saida.push({
      key: e.key, title: e.title, date: e.date, link: e.link,
      reason: 'Nenhum resultado lançado neste dia.',
    }));

  (gameDays || [])
    .filter((g) => g?.id && g.status !== 'archived' && !formatHasScores(g.format)
      && !(excludeIds && excludeIds.has(g.id))
      && g.date && (!today || String(g.date) <= today) && naTemporada(g.date, season))
    .forEach((g) => saida.push({
      key: `gd:${g.id}`,
      title: g.title || 'Dia de jogo',
      date: houseEventDate(g.date),
      link: `/dia-de-jogo/${g.id}`,
      reason: 'Play não tem placar, então não pontua.',
    }));

  return saida.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}
