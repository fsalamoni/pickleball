/**
 * RECUPERAÇÃO DOS RANKINGS — o gatilho que não disparou.
 *
 * Os rankings da plataforma (ELO, 2.0–8.0 e duplas) são recalculados por
 * GATILHO: cada resultado publicado acorda uma Cloud Function. Gatilho tem um
 * ponto cego: se a função não existe no momento da escrita, o evento se perde —
 * não há fila, não há nova tentativa. E a função pode deixar de existir por
 * motivos que nada têm a ver com o PickleRush:
 *
 * 🐞 2026-09-22: o projeto Firebase é compartilhado com outro aplicativo, e o
 * deploy dele apagou as funções daqui. Um dia de jogo publicado naquela noite
 * (12 partidas) NUNCA entrou no ranking 2.0–8.0 — a última passada do servidor
 * era de 18/09. Quando as funções voltaram, nada aconteceu, porque nada novo foi
 * escrito: o ranking esperava um evento que já tinha passado.
 *
 * ## O que esta peça faz
 *
 * Cada passada do servidor guarda uma IMPRESSÃO do que leu (quantas partidas de
 * torneio decididas, quantos jogos de dia de jogo publicados e a assinatura dos
 * torneios elegíveis). A recuperação agendada lê a impressão ATUAL — duas
 * contagens (uma leitura por mil documentos) e a lista de torneios — e compara.
 * Diferente, ou sem impressão nenhuma (a primeira vez depois deste deploy),
 * pede um recálculo. Igual, não faz nada: não grava, não suja o histórico.
 *
 * Limite honesto: editar o PLACAR de um jogo já publicado não muda contagem
 * nem assinatura. Se essa edição acontecer justamente com as funções fora do
 * ar, ela só entra na próxima passada. Contar tudo campo a campo custaria ler a
 * base inteira a cada meia hora — é o preço que não vale a pena pagar pelo caso
 * mais raro.
 */

const { createHash } = require('node:crypto');

const { computeSignature, FINISHED_STATUSES } = require('./ranking');

/** Status do espelho de dia de jogo que conta para o ranking. */
const STATUS_JOGO_PUBLICADO = 'finished';

/**
 * A impressão de uma leitura. É o que a passada grava e o que a recuperação
 * compara — as duas pontas usam ESTA função, para não divergirem.
 *
 * A assinatura dos torneios vai como hash: com cem torneios ela passa de 5 kB,
 * e o que importa é só saber se mudou.
 *
 * @param {{ partidasTorneio: number, jogosEvento: number, assinatura: string }} p
 * @returns {{ tournament_matches: number, club_event_games: number, signature_hash: string }}
 */
function impressaoDosResultados({ partidasTorneio, jogosEvento, assinatura }) {
  return {
    tournament_matches: Number(partidasTorneio) || 0,
    club_event_games: Number(jogosEvento) || 0,
    signature_hash: createHash('sha1').update(String(assinatura || '')).digest('hex'),
  };
}

/**
 * Faltou alguma passada? Sem impressão anterior conta como "faltou": é o caso
 * da primeira execução depois deste deploy, e o caso de uma passada que morreu
 * antes de gravar o resultado.
 *
 * @param {object|null|undefined} anterior impressão gravada pela última passada
 * @param {object} atual impressão lida agora
 * @returns {boolean}
 */
function precisaRecuperar(anterior, atual) {
  if (!anterior || typeof anterior !== 'object') return true;
  return anterior.tournament_matches !== atual.tournament_matches
    || anterior.club_event_games !== atual.club_event_games
    || anterior.signature_hash !== atual.signature_hash;
}

/**
 * Lê a impressão ATUAL do banco, barata: duas contagens e a lista de torneios.
 * @param {import('firebase-admin/firestore').Firestore} db
 */
async function lerImpressaoAtual(db) {
  const [partidas, jogos, torneios] = await Promise.all([
    db.collection('tournament_matches').where('status', 'in', FINISHED_STATUSES).count().get(),
    db.collection('club_event_games').where('status', '==', STATUS_JOGO_PUBLICADO).count().get(),
    db.collection('tournaments').get(),
  ]);
  return impressaoDosResultados({
    partidasTorneio: partidas.data().count,
    jogosEvento: jogos.data().count,
    assinatura: computeSignature(torneios.docs.map((d) => ({ id: d.id, ...d.data() }))),
  });
}

/**
 * Confere e, se faltou passada, pede o recálculo.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {object} deps
 * @param {(db: object, motivo: string, opts?: object) => Promise<object>} deps.requestRankingRecompute
 * @param {(db: object) => Promise<object>} [deps.lerImpressao] injetável nos testes
 * @param {object} [deps.logger]
 * @returns {Promise<{ ran: boolean, reason: string }>}
 */
async function recuperarSeFaltou(db, deps) {
  const log = deps.logger || console;
  const lerImpressao = deps.lerImpressao || lerImpressaoAtual;

  const workerSnap = await db.collection('platform_settings').doc('ranking_worker').get();
  const worker = workerSnap.exists ? workerSnap.data() : {};
  const anterior = worker.last_result ? worker.last_result.fingerprint : null;

  const atual = await lerImpressao(db);
  if (!precisaRecuperar(anterior, atual)) return { ran: false, reason: 'em-dia' };

  log.info('Ranking: resultado sem passada correspondente — recuperando.', { anterior, atual });
  const res = await deps.requestRankingRecompute(db, 'recuperacao-agendada', { logger: log });
  return { ran: Boolean(res && res.ran), reason: res && res.ran ? 'recalculado' : (res && res.reason) || 'coalesced' };
}

module.exports = {
  impressaoDosResultados,
  precisaRecuperar,
  lerImpressaoAtual,
  recuperarSeFaltou,
  STATUS_JOGO_PUBLICADO,
};
