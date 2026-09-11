/**
 * RECÁLCULO DE TODOS OS RANKINGS DA PLATAFORMA, no servidor.
 *
 * Uma passada só, a partir da MESMA leitura, produzindo os três rankings que
 * dependem de resultado de partida:
 *
 *   · ELO / ranking nacional   → `player_ratings` + `rating_history`
 *   · rating estilo DUPR 2–8   → `player_skill_ratings` + `skill_rating_history`
 *   · ranking de DUPLAS        → `doubles_rankings`
 *
 * ## Por que isto existe (e por que no servidor)
 *
 * Materializar ranking é escrita em coleção que, pelas regras, só o admin da
 * plataforma escreve — e com razão: é o placar oficial de todo mundo. O
 * cliente tentava recalcular na publicação, mas quem publica um dia de jogo
 * quase nunca é o admin: a escrita era recusada e o erro caía num `catch` com
 * log. Na prática, o ranking só se atualizava quando o admin clicava no botão.
 * Aqui a função roda com privilégio de servidor, então funciona para QUALQUER
 * pessoa que publique um resultado.
 *
 * ## O que foi corrigido junto
 *
 * O recálculo de servidor que já existia (`ranking.js`) lia apenas
 * `tournament_matches` — ignorava `club_event_games`, que é onde vivem os
 * resultados de dia de jogo. Como o cliente lia os dois, os dois escreviam
 * rankings DIFERENTES na mesma coleção e vencia quem rodasse por último: uma
 * mudança de status de torneio apagava do ranking nacional todos os dias de
 * jogo. Aqui as duas fontes entram sempre, como no cliente.
 *
 * ## Coalescência (por que não recalcula N vezes)
 *
 * Publicar um dia de jogo escreve dezenas de partidas de uma vez, e cada
 * escrita acorda um gatilho. Recalcular a plataforma inteira por partida seria
 * absurdo. O controle é um "lease" em `platform_settings/ranking_worker`:
 * quem chega primeiro recalcula; quem chega durante marca `pending` e sai na
 * hora; ao terminar, quem estava rodando vê o `pending` e faz UMA passada
 * final. Resultado: a rajada inteira custa duas passadas, e a última enxerga
 * todos os resultados.
 *
 * Os motores são cópias fiéis dos do cliente, com teste de paridade em
 * `functions/engines/parity.test.js`.
 */

const { FieldValue } = require('firebase-admin/firestore');

const {
  computeRatings, seedFromLevelOrdinal, resolveSideUids, toMillis,
  computeSignature, isEligible, LEVEL_IDS, FINISHED_STATUSES,
} = require('./ranking');
const { computeDuprRatings, seedFromProfile } = require('./engines/dupr');
const { computeDoublesRanking } = require('./engines/doubles');

/* --------------------------------------------------------------- constantes */

const ELO_COLLECTION = 'player_ratings';
const ELO_HISTORY = 'rating_history';
const ELO_HISTORY_MAX = 50;

const DUPR_COLLECTION = 'player_skill_ratings';
const DUPR_HISTORY = 'skill_rating_history';
const DUPR_HISTORY_MAX = 150;

const DOUBLES_COLLECTION = 'doubles_rankings';

const SAFE_BATCH_WRITE_SIZE = 450;
/** Gravando rating + histórico no mesmo lote são 2 escritas por atleta. */
const COMBINED_BATCH_ROWS = 200;

const WORKER_DOC = 'ranking_worker';
const SETTINGS_COLLECTION = 'platform_settings';
/** Depois disto, um lease é considerado abandonado (instância morreu no meio). */
const LEASE_TTL_MS = 9 * 60 * 1000;
/** Teto de passadas extras por rajada — evita ping-pong infinito. */
const MAX_PASSADAS_EXTRAS = 2;

/**
 * Tabela de níveis (id + USAP) para a semente do rating 2.0–8.0.
 * Espelha `src/modules/leveling/data/levels.js`; a ORDEM importa (o ELO usa o
 * índice) e o `usap` importa (o motor DUPR converte o texto em rating).
 * O teste de paridade confere a ordem contra a tabela do cliente.
 */
const LEVEL_TABLE = [
  { id: 'iniciante_1', usap: '1.0 – 1.5' },
  { id: 'iniciante_2', usap: '2.0' },
  { id: 'iniciante_plus', usap: '2.5' },
  { id: 'intermediario', usap: '3.0' },
  { id: 'intermediario_plus', usap: '3.5' },
  { id: 'avancado', usap: '4.0' },
  { id: 'pro', usap: '4.5' },
  { id: 'open', usap: '5.0+' },
];

/* ------------------------------------------------------------- normalização */

/**
 * Constrói a lista de jogos normalizados a partir das DUAS fontes.
 * Espelha `src/modules/rating/domain/gameLog.js` + o filtro de elegibilidade
 * de `ratingService.recomputeAllRatings({ onlyPublicClosed: true })`.
 *
 * @param {object} p
 * @param {Array} p.tournamentMatches jogos de torneio finalizados
 * @param {Array} p.clubEventMatches jogos de `club_event_games` finalizados
 * @param {Map} p.regById inscrições por id
 * @param {Set} p.eligibleTournamentIds torneios públicos e encerrados
 * @returns {Array<object>}
 */
function normalizeMatches({ tournamentMatches, clubEventMatches, regById, eligibleTournamentIds }) {
  const out = [];

  tournamentMatches.forEach((m) => {
    // Confrontos de EQUIPES não pontuam aqui: cada etapa já é espelhada com os
    // uids reais em `club_event_games`, e contariam duas vezes.
    if (m.team_confrontation) return;
    if (m.winner_side !== 'a' && m.winner_side !== 'b') return;
    if (!eligibleTournamentIds.has(m.tournament_id)) return;
    const a = resolveSideUids(m.side_a_ids, regById);
    const b = resolveSideUids(m.side_b_ids, regById);
    if (!a.complete || !b.complete) return;
    const games = Array.isArray(m.games) ? m.games : [];
    out.push({
      side_a: a.uids,
      side_b: b.uids,
      winner: m.winner_side,
      points_a: games.reduce((s, g) => s + (Number(g.a) || 0), 0),
      points_b: games.reduce((s, g) => s + (Number(g.b) || 0), 0),
      tournament_id: m.tournament_id || null,
      at: toMillis(m.result_recorded_at) || toMillis(m.updated_at) || toMillis(m.created_at),
    });
  });

  // Dias de jogo (clube e atleta): os ids já são uids de verdade e NÃO
  // dependem de torneio público/encerrado — publicar já é a escolha do dono.
  clubEventMatches.forEach((m) => {
    if (m.winner_side !== 'a' && m.winner_side !== 'b') return;
    const sideA = Array.isArray(m.side_a_ids) ? m.side_a_ids : [];
    const sideB = Array.isArray(m.side_b_ids) ? m.side_b_ids : [];
    if (sideA.length === 0 || sideB.length === 0) return;
    if (sideA.some((u) => !u) || sideB.some((u) => !u)) return;
    out.push({
      side_a: sideA,
      side_b: sideB,
      winner: m.winner_side,
      points_a: Number(m.score_a) || 0,
      points_b: Number(m.score_b) || 0,
      tournament_id: m.tournament_id || null,
      source: m.source || 'club_event_game',
      event_id: m.event_id || null,
      club_id: m.club_id || null,
      at: toMillis(m.result_recorded_at) || toMillis(m.created_at) || Date.now(),
    });
  });

  return out;
}

function flattenSide(side) {
  return {
    rating: side.rating,
    peak: side.peak_rating,
    games: side.games,
    wins: side.wins,
    losses: side.losses,
    balance: side.points_balance,
    tournaments: side.tournaments,
    reliability: side.reliability,
    provisional: side.provisional,
  };
}

/** Dados de exibição de um atleta, para as linhas materializadas. */
function perfilResumo(profile) {
  return {
    platform_name: profile.platform_name || 'Atleta',
    photo_url: profile.photo_url || '',
    city: profile.city || null,
    state: profile.state || null,
    level: profile.level || null,
    leveling_level: profile.leveling_level || null,
    gender: profile.gender || null,
    age: Number.isFinite(profile.age) ? profile.age : null,
    club_ids: Array.isArray(profile.club_ids) ? profile.club_ids : [],
    clubs: Array.isArray(profile.clubs) ? profile.clubs : [],
  };
}

/** Grava um conjunto de documentos em lotes seguros. */
async function gravarEmLotes(db, colecao, linhas, idDe, tamanho = SAFE_BATCH_WRITE_SIZE) {
  for (let i = 0; i < linhas.length; i += tamanho) {
    const batch = db.batch();
    linhas.slice(i, i + tamanho).forEach((linha) => {
      batch.set(db.collection(colecao).doc(idDe(linha)), {
        ...linha,
        updated_at: FieldValue.serverTimestamp(),
      });
    });
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
}

/** Apaga documentos que não fazem mais parte do ranking (jogos removidos). */
async function apagarOrfaos(db, colecao, idsAtuais, idsExistentes) {
  const vivos = new Set(idsAtuais);
  const mortos = idsExistentes.filter((id) => !vivos.has(id));
  for (let i = 0; i < mortos.length; i += SAFE_BATCH_WRITE_SIZE) {
    const batch = db.batch();
    mortos.slice(i, i + SAFE_BATCH_WRITE_SIZE)
      .forEach((id) => batch.delete(db.collection(colecao).doc(id)));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  return mortos.length;
}

/* --------------------------------------------------------------- o recálculo */

/**
 * Recalcula e materializa TODOS os rankings da plataforma.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @returns {Promise<object>} resumo (para o log da função)
 */
async function recomputeAllPlatformRankings(db) {
  // 1) Leitura — UMA vez, para os três rankings.
  const [
    tournamentMatchesSnap, clubEventGamesSnap, regsSnap, profilesSnap, tournamentsSnap,
  ] = await Promise.all([
    db.collection('tournament_matches').where('status', 'in', FINISHED_STATUSES).get(),
    db.collection('club_event_games').where('status', '==', 'finished').get(),
    db.collection('tournament_registrations').get(),
    db.collection('athlete_profiles').get(),
    db.collection('tournaments').get(),
  ]);

  const tournaments = tournamentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const eligibleTournamentIds = new Set(tournaments.filter(isEligible).map((t) => t.id));
  const ratingSignature = computeSignature(tournaments);

  const regById = new Map(regsSnap.docs.map((d) => [d.id, d.data()]));
  const profileById = new Map(profilesSnap.docs.map((d) => [d.id, { uid: d.id, ...d.data() }]));

  const matches = normalizeMatches({
    tournamentMatches: tournamentMatchesSnap.docs.map((d) => d.data()),
    clubEventMatches: clubEventGamesSnap.docs.map((d) => d.data()),
    regById,
    eligibleTournamentIds,
  });

  // 2) Sementes — cada motor tem a sua escala.
  const eloSeeds = {};
  const duprSeeds = {};
  profileById.forEach((profile, uid) => {
    const idx = LEVEL_IDS.indexOf(profile.leveling_level);
    if (idx >= 0) eloSeeds[uid] = seedFromLevelOrdinal(idx, LEVEL_IDS.length);
    duprSeeds[uid] = seedFromProfile(profile, LEVEL_TABLE);
  });

  // 3) Os três rankings, dos mesmos jogos.
  const elo = computeRatings(matches, eloSeeds);
  const dupr = computeDuprRatings(matches, { seeds: duprSeeds });
  const duplas = computeDoublesRanking(matches, { minGames: 1 });

  const snapshotAt = Date.now();

  /* -------------------------------------------------------- ELO / nacional */
  const eloRows = elo.map((p, index) => ({
    uid: p.player_id,
    rating: p.rating,
    peak_rating: p.peak_rating,
    games: p.games,
    wins: p.wins,
    losses: p.losses,
    points_for: p.points_for,
    points_against: p.points_against,
    points_balance: p.points_balance,
    tournaments: p.tournaments,
    position: index + 1,
    ...perfilResumo(profileById.get(p.player_id) || {}),
  }));

  const [eloHistorySnap, eloExistingSnap] = await Promise.all([
    db.collection(ELO_HISTORY).get(),
    db.collection(ELO_COLLECTION).get(),
  ]);
  const eloHistoryByUid = new Map(eloHistorySnap.docs.map((d) => [d.id, d.data()]));

  for (let i = 0; i < eloRows.length; i += COMBINED_BATCH_ROWS) {
    const batch = db.batch();
    eloRows.slice(i, i + COMBINED_BATCH_ROWS).forEach((row) => {
      batch.set(db.collection(ELO_COLLECTION).doc(row.uid), {
        ...row, updated_at: FieldValue.serverTimestamp(),
      });
      const prev = eloHistoryByUid.get(row.uid);
      const points = Array.isArray(prev && prev.points)
        ? prev.points.slice(-(ELO_HISTORY_MAX - 1)) : [];
      points.push({ at: snapshotAt, rating: row.rating });
      batch.set(db.collection(ELO_HISTORY).doc(row.uid), {
        uid: row.uid, points, updated_at: FieldValue.serverTimestamp(),
      });
    });
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  const eloRemovidos = await apagarOrfaos(
    db, ELO_COLLECTION, eloRows.map((r) => r.uid), eloExistingSnap.docs.map((d) => d.id),
  );

  /* ------------------------------------------------- rating estilo DUPR 2–8 */
  const duprRows = dupr.map((p) => {
    const profile = profileById.get(p.player_id) || {};
    const d = flattenSide(p.doubles);
    const s = flattenSide(p.singles);
    return {
      uid: p.player_id,
      ...perfilResumo(profile),
      dupr_id: profile.dupr_id || null,
      seed_rating: duprSeeds[p.player_id] !== undefined ? duprSeeds[p.player_id] : null,
      doubles_rating: d.rating,
      doubles_peak: d.peak,
      doubles_games: d.games,
      doubles_wins: d.wins,
      doubles_losses: d.losses,
      doubles_balance: d.balance,
      doubles_reliability: d.reliability,
      doubles_provisional: d.provisional,
      singles_rating: s.rating,
      singles_peak: s.peak,
      singles_games: s.games,
      singles_wins: s.wins,
      singles_losses: s.losses,
      singles_balance: s.balance,
      singles_reliability: s.reliability,
      singles_provisional: s.provisional,
    };
  });
  const trajByUid = new Map(dupr.map((p) => [p.player_id, {
    doubles: (p.doubles.trajectory || []).slice(-DUPR_HISTORY_MAX),
    singles: (p.singles.trajectory || []).slice(-DUPR_HISTORY_MAX),
  }]));

  const duprExistingSnap = await db.collection(DUPR_COLLECTION).get();
  for (let i = 0; i < duprRows.length; i += COMBINED_BATCH_ROWS) {
    const batch = db.batch();
    duprRows.slice(i, i + COMBINED_BATCH_ROWS).forEach((row) => {
      batch.set(db.collection(DUPR_COLLECTION).doc(row.uid), {
        ...row, updated_at: FieldValue.serverTimestamp(),
      });
      const traj = trajByUid.get(row.uid) || { doubles: [], singles: [] };
      batch.set(db.collection(DUPR_HISTORY).doc(row.uid), {
        uid: row.uid,
        doubles: traj.doubles,
        singles: traj.singles,
        updated_at: FieldValue.serverTimestamp(),
      });
    });
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  const duprRemovidos = await apagarOrfaos(
    db, DUPR_COLLECTION, duprRows.map((r) => r.uid), duprExistingSnap.docs.map((d) => d.id),
  );

  /* ------------------------------------------------------ ranking de duplas */
  // Nomes e fotos vão junto: a página lê UMA coleção e já desenha a tabela,
  // sem ter de buscar o perfil de cada atleta para descobrir como se chamam.
  const duplasRows = duplas.map((r) => ({
    pair_key: r.pair_key,
    player_ids: r.player_ids,
    players: r.player_ids.map((uid) => {
      const perfil = profileById.get(uid) || {};
      return {
        uid,
        name: perfil.platform_name || perfil.full_name || 'Atleta',
        photo: perfil.photo_url || '',
      };
    }),
    games: r.games,
    wins: r.wins,
    losses: r.losses,
    win_rate: r.win_rate,
    points_for: r.points_for,
    points_against: r.points_against,
    points_balance: r.points_balance,
    position: r.position,
  }));

  const duplasExistingSnap = await db.collection(DOUBLES_COLLECTION).get();
  await gravarEmLotes(db, DOUBLES_COLLECTION, duplasRows, (r) => r.pair_key);
  const duplasRemovidas = await apagarOrfaos(
    db, DOUBLES_COLLECTION, duplasRows.map((r) => r.pair_key),
    duplasExistingSnap.docs.map((d) => d.id),
  );

  /* --------------------------------------------------------------- estado */
  await db.collection(SETTINGS_COLLECTION).doc('global').set({
    ratings_signature: ratingSignature,
    ratings_recomputed_at: FieldValue.serverTimestamp(),
    dupr_ratings_recomputed_at: FieldValue.serverTimestamp(),
    doubles_ranking_recomputed_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    matchesUsed: matches.length,
    eloPlayers: eloRows.length,
    duprPlayers: duprRows.length,
    doublesPairs: duplasRows.length,
    removed: { elo: eloRemovidos, dupr: duprRemovidos, doubles: duplasRemovidas },
  };
}

/* ------------------------------------------------------------ coalescência */

/**
 * Tenta tomar o lease. Se já há um recálculo em curso, apenas marca `pending`.
 * @returns {Promise<boolean>} `true` se tomou o lease (deve recalcular)
 */
async function tomarLease(db, motivo) {
  const ref = db.collection(SETTINGS_COLLECTION).doc(WORKER_DOC);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const atual = snap.exists ? snap.data() : {};
    const desde = toMillis(atual.running_since);
    const emCurso = desde > 0 && Date.now() - desde < LEASE_TTL_MS;
    if (emCurso) {
      // Alguém já está recalculando: basta avisar que chegou coisa nova.
      tx.set(ref, { pending: true, last_request_reason: motivo || null }, { merge: true });
      return false;
    }
    tx.set(ref, {
      running_since: FieldValue.serverTimestamp(),
      pending: false,
      last_request_reason: motivo || null,
    }, { merge: true });
    return true;
  });
}

/**
 * Ao terminar uma passada: se chegou pedido novo no meio, limpa a marca e
 * devolve `true` para rodar mais uma vez. Senão, solta o lease.
 */
async function consumirPendente(db, resumo) {
  const ref = db.collection(SETTINGS_COLLECTION).doc(WORKER_DOC);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const pendente = Boolean(snap.exists && snap.data().pending);
    if (pendente) {
      tx.set(ref, {
        pending: false,
        running_since: FieldValue.serverTimestamp(),
        last_run_at: FieldValue.serverTimestamp(),
        last_result: resumo || null,
      }, { merge: true });
      return true;
    }
    tx.set(ref, {
      pending: false,
      running_since: null,
      last_run_at: FieldValue.serverTimestamp(),
      last_result: resumo || null,
    }, { merge: true });
    return false;
  });
}

/** Solta o lease depois de uma falha, para a próxima publicação não travar. */
async function soltarLease(db, erro) {
  const patch = { running_since: null, pending: false };
  // Só registra erro quando houve erro: soltar o lease também é o caminho
  // normal ao bater o teto de passadas, e marcar isso como falha poluiria o
  // diagnóstico de quem for investigar um problema de verdade.
  if (erro) {
    patch.last_error = String((erro && erro.message) || erro);
    patch.last_error_at = FieldValue.serverTimestamp();
  }
  try {
    await db.collection(SETTINGS_COLLECTION).doc(WORKER_DOC).set(patch, { merge: true });
  } catch (falha) {
    // Se nem isto grava, o TTL do lease resolve na próxima publicação.
  }
}

/**
 * Ponto de entrada dos gatilhos: pede um recálculo, coalescendo rajadas.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} motivo de onde veio o pedido (vai para o log)
 * @param {{ logger?: object }} [opts]
 * @returns {Promise<{ ran: boolean, reason?: string, passadas?: number }>}
 */
async function requestRankingRecompute(db, motivo, opts = {}) {
  const log = opts.logger || console;
  let tenho = false;
  try {
    tenho = await tomarLease(db, motivo);
  } catch (err) {
    log.error('Ranking: falha ao tomar o lease; recalculando assim mesmo.', err);
    tenho = true; // melhor recalcular duas vezes do que não recalcular
  }
  if (!tenho) return { ran: false, reason: 'coalesced' };

  let passadas = 0;
  let resumo = null;
  let denovo = false;
  try {
    do {
      // eslint-disable-next-line no-await-in-loop
      resumo = await recomputeAllPlatformRankings(db);
      passadas += 1;
      log.info('Rankings recalculados.', { motivo, passada: passadas, ...resumo });
      // `consumirPendente` já renova o lease quando devolve `true`, para a
      // passada seguinte continuar protegida.
      // eslint-disable-next-line no-await-in-loop
      denovo = await consumirPendente(db, resumo);
    } while (denovo && passadas <= MAX_PASSADAS_EXTRAS);
  } catch (err) {
    await soltarLease(db, err);
    throw err;
  }

  // Saímos com pedido pendente porque batemos o teto de passadas. O lease foi
  // RENOVADO pela última `consumirPendente`, então é preciso soltá-lo aqui:
  // esquecer isto travaria todos os recálculos até o TTL expirar. O pedido não
  // se perde — a próxima escrita de resultado chama tudo de novo.
  if (denovo) {
    await soltarLease(db, null);
    log.warn('Ranking: teto de passadas atingido; lease liberado.', { motivo, passadas });
  }

  return { ran: true, passadas, ...resumo };
}

/* ------------------------------------------------- que escrita importa? ---- */

/**
 * Campos de uma partida de TORNEIO que podem mudar o ranking.
 * Tudo o que não está aqui (quadra, horário, ordem no chaveamento, observação)
 * é escrita que não move pontuação nenhuma.
 */
const CAMPOS_PARTIDA_TORNEIO = Object.freeze([
  'status', 'winner_side', 'games', 'side_a_ids', 'side_b_ids',
  'tournament_id', 'team_confrontation',
]);

/** Idem para o espelho de dia de jogo / evento de clube. */
const CAMPOS_JOGO_EVENTO = Object.freeze([
  'status', 'winner_side', 'score_a', 'score_b', 'side_a_ids', 'side_b_ids',
  'club_id', 'event_id',
]);

/**
 * Algum campo que MUDA O RANKING foi alterado?
 *
 * Uma partida é escrita muitas vezes por motivos que não afetam pontuação
 * (quadra, horário, observação). Recalcular a plataforma inteira nessas horas
 * é desperdício e, pior, atrasa na fila o recálculo que importa.
 *
 * Criação e exclusão sempre contam: um jogo que nasce ou some muda o ranking
 * por definição.
 *
 * @param {object|null} before
 * @param {object|null} after
 * @param {string[]} campos
 * @returns {boolean}
 */
function mudouResultado(before, after, campos) {
  if (!before || !after) return true;
  return campos.some((c) => {
    const a = before[c] === undefined ? null : before[c];
    const b = after[c] === undefined ? null : after[c];
    return JSON.stringify(a) !== JSON.stringify(b);
  });
}

module.exports = {
  recomputeAllPlatformRankings,
  requestRankingRecompute,
  normalizeMatches,
  LEVEL_TABLE,
  DOUBLES_COLLECTION,
  WORKER_DOC,
  mudouResultado,
  CAMPOS_PARTIDA_TORNEIO,
  CAMPOS_JOGO_EVENTO,
};
