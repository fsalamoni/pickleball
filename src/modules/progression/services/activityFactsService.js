/**
 * activityFactsService — busca as FONTES dos fatos de atividade (I/O).
 *
 * Cada fonte é uma consulta PELO CAMPO QUE A REGRA CONFERE (o Firestore só
 * aceita a consulta se conseguir provar a regra para tudo o que ela devolve):
 * quem eu sigo (`follower_uid`), minhas reservas (`athlete_id`), minhas aulas
 * (`student_id`)... Nenhuma é uma varredura de coleção.
 *
 * Cada uma falha SOZINHA: `Promise.allSettled` e `undefined` na que falhou. O
 * domínio trata `undefined` como "não deu para verificar" (e não como zero) —
 * falha de rede não pode virar "você não fez nada" na tela da pessoa.
 *
 * Limites de leitura em todas: o hub abre com ~15 consultas, e uma pessoa
 * muito ativa não pode transformar isso em dezenas de milhares de leituras.
 */
import {
  collection, doc, getCountFromServer, getDoc, getDocs, limit, query, where,
} from 'firebase/firestore';
import { gamificationDb } from './firestoreDb.js';

const LIMITE = 500;

const db = () => gamificationDb();

async function lista(colecao, campo, valor, max = LIMITE) {
  const snap = await getDocs(query(collection(db(), colecao), where(campo, '==', valor), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function contar(colecao, campo, valor) {
  const snap = await getCountFromServer(query(collection(db(), colecao), where(campo, '==', valor)));
  return snap.data().count;
}

async function umDoc(colecao, id) {
  const snap = await getDoc(doc(db(), colecao, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Os clubes da pessoa, com o papel dela e o tamanho do clube. */
async function meusClubes(uid) {
  const vinculos = await lista('club_members', 'user_id', uid, 30);
  const clubes = await Promise.allSettled(vinculos.map((v) => umDoc('clubs', v.club_id)));
  return vinculos.map((v, i) => {
    const c = clubes[i].status === 'fulfilled' ? clubes[i].value : null;
    return {
      id: v.club_id, my_role: v.role || 'member',
      created_by: c ? c.created_by : null,
      member_count: c ? Number(c.member_count) || 0 : 0,
    };
  });
}

/** Inscrições em torneio da pessoa (as três formas de estar numa inscrição). */
async function minhasInscricoes(uid) {
  const consultas = ['user_id', 'player_a_user_id', 'player_b_user_id']
    .map((campo) => lista('tournament_registrations', campo, uid, 200));
  const partes = await Promise.all(consultas);
  const porId = new Map();
  partes.flat().forEach((r) => porId.set(r.id, r));
  return [...porId.values()];
}

/**
 * @param {string} uid
 * @returns {Promise<Record<string, any>>} fontes; `undefined` = não carregou
 */
export async function fetchActivitySources(uid) {
  if (!uid) return {};
  const tarefas = {
    following: () => lista('follows', 'follower_uid', uid),
    followers: () => lista('follows', 'target_uid', uid),
    bookings: () => lista('arena_bookings', 'athlete_id', uid),
    lessons: () => lista('coach_lessons', 'student_id', uid),
    clinicSignups: () => lista('coach_clinic_signups', 'athlete_id', uid),
    packageSales: () => lista('coach_package_sales', 'student_id', uid),
    clubs: () => meusClubes(uid),
    clubEventsCreated: () => contar('club_events', 'created_by', uid),
    gameDaysCreated: () => contar('game_days', 'created_by', uid),
    arenaReviews: () => lista('arena_reviews', 'user_id', uid),
    kudosIndex: () => umDoc('user_kudos_index', uid),
    sentKudos: () => lista('user_kudos', 'fromUid', uid, 300),
    referral: () => umDoc('user_referral_codes', uid),
    consents: () => lista('legal_consents', 'user_id', uid, 10),
    matchReviews: () => lista('match_reviews', 'fromUid', uid, 300),
    partnerLetters: () => lista('partner_letter_authors', 'fromUid', uid, 300),
    reputation: () => umDoc('user_reputation', uid),
    challengeEntries: () => lista('challenge_entries', 'uid', uid, 100),
    registrations: () => minhasInscricoes(uid),
  };
  const nomes = Object.keys(tarefas);
  const resultados = await Promise.allSettled(nomes.map((n) => tarefas[n]()));
  const fontes = {};
  resultados.forEach((r, i) => {
    // `null` de um documento que não existe é um DADO ("não tem"), não falha:
    // o domínio o lê como vazio. Só a rejeição vira `undefined`.
    fontes[nomes[i]] = r.status === 'fulfilled' ? r.value : undefined;
  });
  // Documento único ausente (índice de kudos, código de convite, reputação) =
  // a pessoa ainda não tem: vira `{}` para o domínio contar zero (e não "falha").
  ['kudosIndex', 'referral', 'reputation'].forEach((n) => {
    if (fontes[n] === null) fontes[n] = {};
  });
  return fontes;
}
