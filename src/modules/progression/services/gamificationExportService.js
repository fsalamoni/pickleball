/**
 * O que a exportação de dados (LGPD) leva da GAMIFICAÇÃO. Cada parte falha
 * SOZINHA e vai para `incomplete` — nunca um arquivo "completo" com buraco
 * (docs/27). Só o que a própria pessoa LÊ pela regra: os sinais de
 * integridade, a fotografia do antifarm e a decisão de moderação são do admin
 * e do servidor (ver `exclusaoCobreColecoes.test.js`, isenções com motivo).
 *
 * As listas são lidas com um teto (`TETO`); a que ENCHE o teto pode ter mais
 * do que veio e também vai para `incomplete` — corte calado é buraco.
 */
import { getUserProgressionV2 } from './progressionV2Service.js';
import { listUserMissions } from './missionService.js';
import { getStreakMeta } from './streakMetaService.js';
import { getReferralCode, getReferralForReferee, listReferralsByReferrer } from './referralService.js';
import { getKudoIndex, listKudosGivenBy, listKudosReceivedBy } from './kudoService.js';
import { listRivalsFor } from './socialBondService.js';
import { getGamificationPrefs } from './gamificationPrefsService.js';
import { listXpGrants } from './xpGrantService.js';
import {
  getMyPrivateReputation, getReputation, listMyReviews, listReceivedLetters, listSentLetters,
} from './socialGamificationService.js';
import { fetchMyHallRow } from './hallOfFameService.js';
import { listMyDuels, listMyEntries } from './challengeService.js';
import { listMyClaims } from './rewardService.js';
import { listUserAchievementsV2 } from '@/modules/achievements/services/achievementsV2Service';

export const TETO = 2000;

/** Lista que encheu o teto: pode ter mais do que veio. */
const cheia = (xs) => Array.isArray(xs) && xs.length >= TETO;
/** Duelo: o teto vale por LADO (`uidA` e `uidB` são duas consultas). */
const duelosCheios = (uid) => (xs) => Array.isArray(xs)
  && (xs.filter((d) => d.uidA === uid).length >= TETO || xs.filter((d) => d.uidB === uid).length >= TETO);

/**
 * A carta anônima recebida não pode levar quem escreveu: o id do documento é
 * `{jogo}__{autor}__{destinatário}`. Sai só o que a pessoa vê na tela.
 */
function semAutorOculto(cartas) {
  return (cartas || []).map((c) => {
    if (c && c.showName === true) return c;
    const { id: _id, fromUid: _f, fromName: _n, ...resto } = c || {};
    return resto;
  });
}

/** @returns {Promise<{ gamification: object, incomplete: string[] }>} */
export async function collectGamificationExport(uid) {
  // [chave, rótulo, leitura, encheu o teto?]
  const partes = [
    ['progression', 'Progressão (XP e nível)', () => getUserProgressionV2(uid)],
    ['missions', 'Missões', () => listUserMissions(uid, TETO), cheia],
    ['achievements', 'Conquistas', () => listUserAchievementsV2(uid)],
    ['streak', 'Sequência', () => getStreakMeta(uid)],
    ['xp_grants', 'XP concedido pelo servidor', () => listXpGrants(uid)],
    ['preferences', 'Preferências da gamificação', () => getGamificationPrefs(uid)],
    ['referral_code', 'Código de convite', () => getReferralCode(uid)],
    ['referrals_made', 'Convites que fez', () => listReferralsByReferrer(uid)],
    ['referred_by', 'Quem convidou', () => getReferralForReferee(uid)],
    ['kudos_received', 'Kudos recebidos', () => listKudosReceivedBy(uid, { limit: TETO }), cheia],
    ['kudos_given', 'Kudos enviados', () => listKudosGivenBy(uid, { limit: TETO }), cheia],
    ['kudos_index', 'Índice de kudos', () => getKudoIndex(uid)],
    ['rivals', 'Rivalidades', () => listRivalsFor(uid)],
    ['reviews_written', 'Avaliações pós-jogo que fez', () => listMyReviews(uid, TETO), cheia],
    ['reputation', 'Reputação', () => getReputation(uid)],
    ['reputation_private', 'Reputação (parte privada)', () => getMyPrivateReputation(uid)],
    ['letters_received', 'Cartas ao companheiro recebidas', async () => semAutorOculto(await listReceivedLetters(uid, TETO)), cheia],
    ['letters_sent', 'Cartas ao companheiro enviadas', () => listSentLetters(uid, TETO), cheia],
    ['hall_of_fame', 'Linha no Hall da Fama', () => fetchMyHallRow(uid)],
    ['challenge_entries', 'Desafios em que entrou', () => listMyEntries(uid, TETO), cheia],
    ['duels', 'Duelos da semana', () => listMyDuels(uid, TETO), duelosCheios(uid)],
    ['reward_claims', 'Pedidos de recompensa', () => listMyClaims(uid, TETO), cheia],
  ];
  const lidas = await Promise.allSettled(partes.map(([, , ler]) => ler()));
  const gamification = {};
  const incomplete = [];
  partes.forEach(([chave, rotulo, , encheu], i) => {
    if (lidas[i].status !== 'fulfilled') { incomplete.push(rotulo); return; }
    gamification[chave] = lidas[i].value ?? null;
    if (encheu && encheu(lidas[i].value)) incomplete.push(`${rotulo} (só os primeiros ${TETO})`);
  });
  return { gamification, incomplete };
}
