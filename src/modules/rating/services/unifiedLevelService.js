/**
 * unifiedLevelService — reúne as fontes de nível de vários atletas de uma vez.
 *
 * O domínio (`unifiedLevel.js`) sabe COMO equiparar as escalas; este service
 * só busca os dados. Leitura pura: não escreve nada em lugar nenhum.
 *
 * Lê três coleções, todas por id de documento (sem índice novo):
 *   - `athlete_profiles/{uid}` → DUPR informado e nível indicado
 *   - `player_skill_ratings/{uid}` → rating 2.0–8.0 da plataforma
 *   - `player_ratings/{uid}` → rating ELO do ranking nacional
 *
 * Falha graciosa por princípio: se qualquer coleção estiver indisponível, o
 * que já foi lido continua valendo e o resto vira "nível desconhecido". Um
 * sorteio precisa acontecer mesmo com o ranking fora do ar.
 */
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { resolveUnifiedLevel } from '../domain/unifiedLevel.js';

/** O `in` do Firestore aceita no máximo 30 valores por consulta. */
const CHUNK = 30;

/** Quantos atletas no máximo por chamada (trava de custo). */
const MAX_UIDS = 300;

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Lê documentos por id, em lotes. Devolve um Map id → dados.
 * Nunca lança: coleção indisponível vira mapa vazio.
 */
async function readByIds(collectionName, ids) {
  const found = new Map();
  if (ids.length === 0) return found;
  try {
    const lotes = chunk(ids, CHUNK);
    const snaps = await Promise.all(
      lotes.map((lote) => getDocs(query(collection(db, collectionName), where(documentId(), 'in', lote)))),
    );
    snaps.forEach((snap) => snap.docs.forEach((d) => found.set(d.id, d.data())));
  } catch (err) {
    logger.warn(`[unifiedLevel] não foi possível ler ${collectionName}`, err);
  }
  return found;
}

/**
 * Nível unificado de um conjunto de atletas.
 *
 * @param {Array<string>} uids
 * @param {{ side?: 'doubles'|'singles' }} [options]
 *   `side` escolhe qual rating da plataforma usar. O padrão é `doubles`,
 *   porque todo sorteio de dupla equilibra duplas — usar o rating de simples
 *   para formar duplas compararia habilidades diferentes.
 * @returns {Promise<Map<string, { value: number, source: string, confidence: number }>>}
 *   Só contém quem tem nível conhecido. Ausente = desconhecido.
 */
export async function fetchUnifiedLevels(uids = [], options = {}) {
  const side = options.side === 'singles' ? 'singles' : 'doubles';
  const ids = [...new Set((uids || []).filter((u) => typeof u === 'string' && u))].slice(0, MAX_UIDS);
  const out = new Map();
  if (ids.length === 0) return out;

  const [perfis, skill, elo] = await Promise.all([
    readByIds('athlete_profiles', ids),
    readByIds('player_skill_ratings', ids),
    readByIds('player_ratings', ids),
  ]);

  for (const uid of ids) {
    const p = perfis.get(uid) || {};
    const s = skill.get(uid) || {};
    const e = elo.get(uid) || {};
    const resolvido = resolveUnifiedLevel({
      duprRating: p.dupr_rating,
      platformSkillRating: s[`${side}_rating`],
      platformSkillGames: s[`${side}_games`],
      platformSkillReliability: s[`${side}_reliability`],
      eloRating: e.rating,
      eloGames: e.games,
      declaredLevel: p.leveling_level || p.level || null,
    });
    if (resolvido) out.set(uid, resolvido);
  }
  return out;
}

/**
 * Mesma coisa, devolvendo só os números — formato que os motores de sorteio
 * consomem.
 *
 * @param {Array<string>} uids
 * @param {{ side?: 'doubles'|'singles' }} [options]
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchUnifiedLevelValues(uids = [], options = {}) {
  const mapa = await fetchUnifiedLevels(uids, options);
  const out = {};
  mapa.forEach((v, uid) => { out[uid] = v.value; });
  return out;
}

/**
 * Níveis por id de PARTICIPANTE (não por uid).
 *
 * Os sorteios de dia de jogo trabalham com o id do documento de participante,
 * enquanto o nível vive por uid. Este adaptador faz a ponte e é o formato que
 * `generateGameDayGames({ levels })` espera.
 *
 * Convidado avulso (participante sem `user_id`) simplesmente não entra no
 * mapa — o motor trata como nível desconhecido e o encaixa pela mediana do
 * grupo, sem empurrá-lo para nenhuma das pontas.
 *
 * @param {Array<{ id: string, user_id?: string|null }>} participants
 * @returns {Promise<Record<string, number>>} id do participante → nível
 */
export async function fetchUnifiedLevelsByParticipant(participants = []) {
  const comConta = (participants || []).filter((p) => p?.id && p?.user_id);
  if (comConta.length === 0) return {};
  const porUid = await fetchUnifiedLevelValues(comConta.map((p) => p.user_id), { side: 'doubles' });
  const out = {};
  comConta.forEach((p) => {
    const v = porUid[p.user_id];
    if (Number.isFinite(v)) out[p.id] = v;
  });
  return out;
}
