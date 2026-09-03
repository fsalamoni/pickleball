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
const MAX_ATLETAS = 500;
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

/**
 * Recalcula e grava o ranking da temporada corrente.
 *
 * @param {{ now?: Date, logger?: object }} [options]
 * @returns {Promise<{ seasonId: string, ranked: number }>}
 */
async function recomputeSeasonRanking({ now = new Date(), logger = console } = {}) {
  const db = getFirestore(getApp(), 'pickleball');
  const seasonId = currentSeasonId(now);

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
    return { uid: data.uid || d.id, xpTotal: Number(data.xpTotal) || 0, tier: data.tier };
  });

  // Linhas já existentes da temporada (para baseline e posição anterior).
  const existentes = new Map();
  const atuaisSnap = await db
    .collection('season_rankings')
    .where('seasonId', '==', seasonId)
    .limit(MAX_ATLETAS)
    .get();
  atuaisSnap.docs.forEach((d) => {
    const data = d.data() || {};
    if (data.uid) existentes.set(data.uid, { baselineXp: data.baselineXp, position: data.position });
  });

  const linhas = buildSeasonRows(progressoes, existentes, Date.now());

  // Lotes de 400 (o limite do Firestore é 500 operações por lote).
  let gravadas = 0;
  for (let i = 0; i < linhas.length; i += 400) {
    const batch = db.batch();
    for (const linha of linhas.slice(i, i + 400)) {
      const ref = db.collection('season_rankings').doc(`${seasonId}_${linha.uid}`);
      batch.set(ref, { ...linha, seasonId, serverUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
      gravadas += 1;
    }
    await batch.commit();
  }

  logger.info(`recomputeSeasonRanking: ${gravadas} atletas ranqueados na temporada ${seasonId}.`);
  return { seasonId, ranked: gravadas };
}

module.exports = {
  recomputeSeasonRanking,
  buildSeasonRows,
  currentSeasonId,
  prizeForPosition,
  MAX_ATLETAS,
};
