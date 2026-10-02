/**
 * Ranking sazonal (mensal) da gamificação V2.
 *
 * Escreve `season_rankings/{seasonId}_{uid}`. As regras do Firestore só
 * permitem escrita por platform_admin justamente porque posição em ranking
 * não pode ser decidida pelo cliente — quem calcula é esta função.
 *
 * **XP da temporada, não XP de vida.** `user_progression_v2.xpTotal` é
 * acumulado desde sempre; ranquear por ele faria a temporada ser uma cópia do
 * Hall da Fama, em que quem chegou agora nunca aparece. Então guardamos, na
 * primeira vez que vemos o atleta na temporada, o `baselineXp` — e o XP da
 * temporada é `xpTotal - baselineXp`. Sem livro de eventos, sem custo extra.
 */
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getApp } = require('firebase-admin/app');

/** Tetos de segurança: a função é agendada e não pode virar conta cara. */
const MAX_ATLETAS = 2000;
const SEASON_SCHEMA_VERSION = 2;

/** Prêmios espelham `MONTHLY_SEASON_PRIZES` em progression/domain/seasons.js. */
const PRIZE_TOP_1 = 1000;
const PRIZE_TOP_10 = 500;
const PRIZE_PARTICIPATION = 50;

/**
 * Id da temporada corrente: 'YYYY-MM' no fuso de Brasília (mesma regra do
 * cliente, em `missionDay.js`). Fuso importa: rodando de madrugada em UTC, o
 * mês vira antes da hora e a temporada errada seria gravada.
 *
 * @param {Date} [now]
 * @returns {string}
 */
function currentSeasonId(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now).slice(0, 7);
}

/**
 * Prêmio de XP pela posição, por faixa percentual.
 *
 * @param {number} position 1-based
 * @param {number} total
 * @returns {number}
 */
function prizeForPosition(position, total) {
  if (!Number.isFinite(position) || position < 1 || total < 1) return 0;
  const percentil = position / total;
  if (percentil <= 0.01) return PRIZE_TOP_1;
  if (percentil <= 0.10) return PRIZE_TOP_10;
  return PRIZE_PARTICIPATION;
}

/**
 * Monta as linhas do ranking a partir dos snapshots de progressão e das
 * linhas já existentes da temporada. Função PURA — testável sem Firestore.
 *
 * @param {Array<{uid: string, xpTotal: number, tier: string}>} progressoes
 * @param {Map<string, {baselineXp?: number, position?: number}>} existentes
 * @param {number} now
 * @returns {Array<object>} linhas prontas para gravar
 */
function buildSeasonRows(progressoes, existentes, now = Date.now()) {
  const comXpDaTemporada = progressoes.map((p) => {
    const anterior = existentes.get(p.uid) || {};
    // Primeira aparição na temporada: o XP de agora vira a linha de partida,
    // então o atleta começa a temporada zerado, como todo mundo.
    const baselineXp = Number.isFinite(anterior.baselineXp)
      ? anterior.baselineXp
      : Math.max(0, Number(p.xpTotal) || 0);
    const xp = Math.max(0, (Number(p.xpTotal) || 0) - baselineXp);
    return {
      uid: p.uid,
      tier: p.tier || 'Calouro',
      baselineXp,
      xp,
      posicaoAnterior: Number.isFinite(anterior.position) ? anterior.position : null,
    };
  });

  // Desempate estável pelo uid: sem isso, dois atletas com o mesmo XP trocam
  // de lugar a cada execução e o "subiu/desceu" vira ruído.
  comXpDaTemporada.sort((a, b) => (b.xp - a.xp) || a.uid.localeCompare(b.uid));

  const total = comXpDaTemporada.length;
  return comXpDaTemporada.map((r, i) => {
    const position = i + 1;
    return {
      seasonId: null, // preenchido pelo chamador
      uid: r.uid,
      schemaVersion: SEASON_SCHEMA_VERSION,
      xp: r.xp,
      baselineXp: r.baselineXp,
      tier: r.tier,
      position,
      // positivo = subiu; 0 na estreia (não havia de onde subir)
      deltaPosition: r.posicaoAnterior === null ? 0 : r.posicaoAnterior - position,
      prizeXp: prizeForPosition(position, total),
      updatedAt: now,
    };
  });
}

/** Ordem dos tiers (espelha `TIER_NAMES` do cliente) — para o "tier mínimo" do placar público. */
const TIER_ORDEM = ['Calouro', 'Aprendiz', 'Jogador', 'Regular', 'Veterano', 'Expert', 'Elite', 'Lenda', 'Imortal'];
const tierRank = (nome) => Math.max(0, TIER_ORDEM.indexOf(nome));

/**
 * As linhas da temporada E do Hall da Fama — a regra de privacidade inteira
 * mora aqui, no servidor, que é o único lugar que a faz valer (o placar é
 * público; o cliente não decide quem aparece nele).
 *
 *  · conta EXCLUÍDA pela moderação: fora de tudo;
 *  · quem desligou "aparecer no placar" (prefs), sem perfil no diretório,
 *    escondido pela moderação ou abaixo do tier mínimo: ranqueia (a pessoa vê a
 *    própria posição e recebe o prêmio) mas NÃO é público;
 *  · quem tem sinal de XP sem lastro em revisão (`retidos`): fica fora do público
 *    até o admin olhar — o placar público não premia trapaça enquanto não há
 *    veredito, e o admin libera com um clique.
 *
 * O XP da temporada é `(xpTotal − XP concedido) − linha de partida`: o prêmio
 * que o servidor concede não pode contar como XP do mês seguinte.
 *
 * Função PURA.
 */
function buildRankingRows({
  progressoes, existentes = new Map(), perfis = new Map(), prefs = new Map(),
  moderacao = new Map(), retidos = new Set(), config, now = Date.now(),
}) {
  const minTier = tierRank(config.season.publicMinTier);
  const validos = progressoes.filter((p) => !(moderacao.get(p.uid) && moderacao.get(p.uid).excluded === true));

  const base = validos.map((p) => {
    const anterior = existentes.get(p.uid) || {};
    const proprio = Math.max(0, (Number(p.xpTotal) || 0) - (Number(p.grantsXp) || 0));
    const baselineXp = Number.isFinite(anterior.baselineXp) ? anterior.baselineXp : proprio;
    return {
      uid: p.uid, tier: p.tier || 'Calouro', level: Number(p.level) || 1,
      achievements: Number(p.achievementsUnlocked) || 0,
      xpTotal: Number(p.xpTotal) || 0, baselineXp,
      xp: Math.max(0, proprio - baselineXp),
      posicaoAnterior: Number.isFinite(anterior.position) ? anterior.position : null,
    };
  });

  const publico = (r) => {
    const perfil = perfis.get(r.uid);
    if (!perfil || perfil.hidden === true) return false;
    const pref = prefs.get(r.uid);
    if (pref && pref.privacy && pref.privacy.showInHallOfFame === false) return false;
    if (moderacao.get(r.uid) && moderacao.get(r.uid).hiddenFromPublic === true) return false;
    if (retidos.has(r.uid)) return false;
    return tierRank(r.tier) >= minTier;
  };

  // Temporada: por XP DA TEMPORADA. Desempate estável pelo uid.
  const temporada = [...base].sort((a, b) => (b.xp - a.xp) || a.uid.localeCompare(b.uid));
  let pub = 0;
  const rowsTemporada = temporada.map((r, i) => {
    const position = i + 1;
    const publica = publico(r);
    if (publica) pub += 1;
    const perfil = perfis.get(r.uid) || {};
    return {
      uid: r.uid, schemaVersion: SEASON_SCHEMA_VERSION, xp: r.xp, baselineXp: r.baselineXp,
      tier: r.tier, level: r.level, position,
      deltaPosition: r.posicaoAnterior === null ? 0 : r.posicaoAnterior - position,
      prizeXp: prizeFromConfig(position, temporada.length, r.xp, config.season),
      // Em que fatia do ranking a pessoa está (1 = o topo): é o que os critérios
      // "estar entre os X%" das recompensas leem — o cliente não conhece o total.
      percent: Math.round((position / temporada.length) * 10000) / 100,
      public: publica, publicPosition: publica ? pub : null,
      // O que é público só vai junto quando a linha é pública.
      displayName: publica ? String(perfil.platform_name || 'Atleta').slice(0, 60) : null,
      photoUrl: publica ? String(perfil.photo_url || '') : null,
      state: publica ? (perfil.state || null) : null,
      city: publica ? (perfil.city || null) : null,
      updatedAt: now,
    };
  });

  // Hall da Fama (XP de vida): só o que é público entra na coleção.
  const vida = [...base].sort((a, b) => (b.xpTotal - a.xpTotal) || a.uid.localeCompare(b.uid));
  let n = 0;
  const rowsHall = [];
  vida.forEach((r) => {
    if (!publico(r)) return;
    n += 1;
    const perfil = perfis.get(r.uid) || {};
    rowsHall.push({
      uid: r.uid, xp: r.xpTotal, tier: r.tier, level: r.level, achievements: r.achievements,
      position: n, displayName: String(perfil.platform_name || 'Atleta').slice(0, 60),
      photoUrl: String(perfil.photo_url || ''), state: perfil.state || null, city: perfil.city || null,
      updatedAt: now, schemaVersion: 1,
    });
  });
  return { temporada: rowsTemporada, hall: rowsHall };
}

/** Prêmio de XP da posição, com os valores do admin. Participação exige XP no mês. */
function prizeFromConfig(position, total, xpSeason, prizes) {
  if (!(position >= 1) || !(total >= 1) || !(xpSeason > 0)) return 0;
  const percentil = position / total;
  if (percentil <= 0.01 || position === 1) return prizes.prizeTop1;
  if (percentil <= 0.10) return prizes.prizeTop10Percent;
  return prizes.prizeParticipation;
}

/** Grava em lotes de 400 (o limite do Firestore é 500 operações por lote). */
async function gravarEmLotes(db, colecao, linhas, idDe, extra = {}) {
  let gravadas = 0;
  for (let i = 0; i < linhas.length; i += 400) {
    const batch = db.batch();
    for (const linha of linhas.slice(i, i + 400)) {
      batch.set(db.collection(colecao).doc(idDe(linha)), { ...linha, ...extra }, { merge: true });
      gravadas += 1;
    }
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  return gravadas;
}

/**
 * Fecha a temporada que acabou: concede o prêmio de XP (uma vez — o documento
 * de concessão tem id fixo) e marca a linha como final. A posição final é a da
 * última passada do mês (no máximo 24 h defasada — documentado).
 */
async function finalizarTemporada(db, seasonId, config, logger) {
  const g = require('./gamification');
  const linhas = await g.lerColecao(db, 'season_rankings', (q) => q.where('seasonId', '==', seasonId));
  const abertas = linhas.filter((l) => l.finalized !== true);
  if (abertas.length === 0) return 0;
  let premiados = 0;
  for (const l of abertas) {
    // Quem está retido para revisão não recebe até o veredito (o público segue
    // protegido); o prêmio fica registrado na linha.
    const retida = l.heldForReview === true;
    if (!retida && l.prizeXp > 0) {
      // eslint-disable-next-line no-await-in-loop
      const novo = await g.conceder(db, {
        uid: l.uid, kind: 'season', ref: seasonId, xp: l.prizeXp,
        label: `Temporada ${seasonId} — ${l.position}º lugar`,
      });
      if (novo) premiados += 1;
    }
    // eslint-disable-next-line no-await-in-loop
    await db.collection('season_rankings').doc(`${seasonId}_${l.uid}`).update({ finalized: true, finalizedAt: Date.now() });
  }
  logger.info(`Temporada ${seasonId} encerrada: ${abertas.length} linhas, ${premiados} prêmios.`);
  return premiados;
}

/**
 * Recalcula e grava a temporada corrente E o Hall da Fama; fecha a anterior.
 *
 * @param {{ now?: Date, logger?: object, db?: object }} [options] `db` só para teste
 * @returns {Promise<{ seasonId: string, ranked: number }>}
 */
async function recomputeSeasonRanking({ now = new Date(), logger = console, db: dbInjetado = null } = {}) {
  const db = dbInjetado || getFirestore(getApp(), 'pickleball');
  const seasonId = currentSeasonId(now);
  const g = require('./gamification');
  const core = require('./gamificationCore');

  if (!(await g.gamificacaoLigada(db))) return { seasonId, ranked: 0, skipped: 'flag_desligada' };
  const config = await g.carregarConfig(db);
  if (!g.moduloLigado(config, 'hall_of_fame')) return { seasonId, ranked: 0, skipped: 'modulo_desligado' };

  const progSnap = await db
    .collection('user_progression_v2')
    .orderBy('xpTotal', 'desc')
    .limit(MAX_ATLETAS)
    .get();

  if (progSnap.empty) {
    logger.info(`recomputeSeasonRanking: nenhum atleta com progressão (${seasonId}).`);
    return { seasonId, ranked: 0 };
  }

  const progressoes = progSnap.docs.map((d) => {
    const data = d.data() || {};
    return {
      uid: data.uid || d.id, xpTotal: Number(data.xpTotal) || 0, tier: data.tier,
      level: data.level, achievementsUnlocked: data.achievementsUnlocked,
      grantsXp: Number(data.grantsXp) || 0,
    };
  });
  const uids = progressoes.map((p) => p.uid);

  const [perfis, prefs, moderacao, existentesRows, flagsAbertas] = await Promise.all([
    g.lerPorIds(db, 'athlete_profiles', uids),
    g.lerPrefs(db, uids),
    g.lerPorIds(db, 'gamification_moderation', uids),
    g.lerColecao(db, 'season_rankings', (q) => q.where('seasonId', '==', seasonId)),
    g.lerColecao(db, 'gamification_flags', (q) => q.where('status', '==', 'open')),
  ]);
  const existentes = new Map();
  existentesRows.forEach((d) => {
    if (d.uid) existentes.set(d.uid, { baselineXp: d.baselineXp, position: d.position });
  });
  const retidos = new Set(flagsAbertas.filter((f) => f.severity === 'high').map((f) => f.subjectUid));

  const { temporada, hall } = buildRankingRows({
    progressoes, existentes, perfis: new Map([...perfis].map(([k, v]) => [k, v])),
    prefs, moderacao, retidos, config, now: now.getTime(),
  });
  const linhas = temporada.map((l) => ({ ...l, seasonId, heldForReview: retidos.has(l.uid) }));

  const gravadas = await gravarEmLotes(db, 'season_rankings', linhas, (l) => `${seasonId}_${l.uid}`,
    { serverUpdatedAt: FieldValue.serverTimestamp() });

  // Hall da Fama: grava os públicos e REMOVE quem deixou de ser (privacidade que
  // vale na hora, não só no próximo mês).
  await gravarEmLotes(db, 'hall_of_fame', hall, (l) => l.uid, { serverUpdatedAt: FieldValue.serverTimestamp() });
  const hallAntigo = await g.lerColecao(db, 'hall_of_fame');
  const vivos = new Set(hall.map((h) => h.uid));
  const sobras = hallAntigo.filter((h) => !vivos.has(h.id));
  for (let i = 0; i < sobras.length; i += 400) {
    const batch = db.batch();
    sobras.slice(i, i + 400).forEach((h) => batch.delete(db.collection('hall_of_fame').doc(h.id)));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }

  // Fecha o mês anterior (concede o prêmio, uma única vez).
  const anterior = core.previousMonthKey(seasonId);
  const premiados = await finalizarTemporada(db, anterior, config, logger);

  logger.info(`recomputeSeasonRanking: ${gravadas} atletas na temporada ${seasonId}; ${hall.length} no Hall.`);
  return { seasonId, ranked: gravadas, hall: hall.length, prizesGranted: premiados };
}

module.exports = {
  recomputeSeasonRanking,
  buildRankingRows,
  prizeFromConfig,
  finalizarTemporada,
  buildSeasonRows,
  currentSeasonId,
  prizeForPosition,
  MAX_ATLETAS,
};
