/**
 * activityFacts — os FATOS da atividade do atleta, vindos dos registros reais.
 *
 * ## Por que existe
 *
 * O catálogo de conquistas tem 88 itens, e só ~28 podiam ser desbloqueados: os
 * outros leem campos como `follows_count`, `bookings_count`, `clubs_joined` ou
 * `lessons_count` — que NENHUM código fornecia. Eram conquistas bonitas,
 * mostradas como "bloqueadas" para sempre, e a missão do dia saía igual para
 * todo mundo porque só 3 métricas eram mensuráveis. A gamificação era feita
 * sobre uma fração do que a plataforma sabe.
 *
 * Aqui os registros que a pessoa já tem em outros módulos (quem ela segue,
 * reservas, aulas, clubes, kudos...) viram um único objeto de fatos, e dele
 * saem as conquistas, as missões e o roteiro dos primeiros passos.
 *
 * ## Regras
 *
 * 1. **Fato é DERIVADO.** Nada aqui é um contador que a tela incrementa: cada
 *    número sai de um registro que existe uma vez só, criado pelo fluxo
 *    próprio do módulo (e protegido pelas regras dele).
 * 2. **Falha não é zero.** Fonte que não carregou chega como `undefined` e vai
 *    para `unknown` — a tela diz "não deu para verificar", em vez de mostrar 0
 *    e afirmar que a pessoa não fez nada. Conquista que depende de fonte
 *    desconhecida fica bloqueada SEM prometer que "nunca".
 * 3. **Datas em ms, no fuso certo.** Cada fonte também entrega a lista de
 *    datas, que é o que permite recortar semana e mês nas missões.
 *
 * Lógica pura, sem I/O.
 */
import { instanteEmMs } from '@/core/domain/instant.js';
import { missionDateKey } from './missionDay.js';
import { hasDeclaredLevel, isRegistrationComplete } from '@/core/lib/profileValidation.js';

/** Nomes das fontes — o contrato entre o serviço que busca e quem monta. */
export const FACT_SOURCES = Object.freeze([
  'following', 'followers', 'bookings', 'lessons', 'clinicSignups', 'packageSales',
  'clubs', 'clubEventsCreated', 'gameDaysCreated', 'arenaReviews', 'kudosIndex',
  'sentKudos', 'referral', 'consents', 'matchReviews', 'partnerLetters', 'reputation',
  'challengeEntries', 'registrations', 'debriefs',
]);

/** Quanto tempo depois de acabar a reserva ela vale como "jogada". */
const STATUS_RESERVA_JOGADA = new Set(['completed']);
const STATUS_RESERVA_FEITA = new Set(['confirmed', 'completed']);

const lista = (v) => (Array.isArray(v) ? v : null);

function datasDe(docs, ...campos) {
  const out = [];
  (docs || []).forEach((d) => {
    for (const c of campos) {
      const ms = instanteEmMs(d?.[c]);
      if (Number.isFinite(ms) && ms > 0) { out.push(ms); return; }
    }
  });
  return out;
}

/** 'YYYY-MM-DD' (data civil) → meio-dia de Brasília, em ms. Nunca meia-noite UTC. */
function dataCivilEmMs(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(texto || ''));
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 15, 0, 0);
}

/** A data (ms) da reserva: o primeiro horário; na falta, quando foi criada. */
function dataDaReserva(r) {
  const primeiro = Array.isArray(r?.slots) ? r.slots.find((s) => s?.date) : null;
  const dia = dataCivilEmMs(primeiro?.date || r?.date);
  if (Number.isFinite(dia)) return dia;
  const criada = instanteEmMs(r?.created_at_ms ?? r?.created_at);
  return Number.isFinite(criada) ? criada : NaN;
}

/**
 * @param {Record<string, any>} src fontes (ver `FACT_SOURCES`); `undefined` = não carregou
 * @param {{ profile?: object|null, now?: Date }} [ctx]
 */
export function buildActivityFacts(src = {}, { profile = null, now = new Date() } = {}) {
  const unknown = FACT_SOURCES.filter((nome) => src[nome] === undefined || src[nome] === null);
  const conhecido = (nome) => !unknown.includes(nome);
  const agoraMs = now.getTime();

  const following = lista(src.following) || [];
  const followers = lista(src.followers) || [];
  const bookings = lista(src.bookings) || [];
  const lessons = lista(src.lessons) || [];
  const clinicSignups = lista(src.clinicSignups) || [];
  const packageSales = lista(src.packageSales) || [];
  const clubs = lista(src.clubs) || [];
  const arenaReviews = lista(src.arenaReviews) || [];
  const sentKudos = lista(src.sentKudos) || [];
  const matchReviews = lista(src.matchReviews) || [];
  const partnerLetters = lista(src.partnerLetters) || [];
  const challengeEntries = lista(src.challengeEntries) || [];
  const registrations = lista(src.registrations) || [];
  // Balanço do jogo: só o RESPONDIDO conta ("agora não" fica gravado e não é ato).
  const debriefs = (lista(src.debriefs) || []).filter((d) => d?.status === 'respondido');

  const reservasFeitas = bookings.filter((b) => STATUS_RESERVA_FEITA.has(b?.status));
  // Reserva "jogada": concluída, ou confirmada cujo horário já passou e que não
  // virou falta. Quem só pediu e foi recusado/cancelou não jogou.
  const reservasJogadas = reservasFeitas.filter((b) => {
    if (b?.no_show === true) return false;
    if (STATUS_RESERVA_JOGADA.has(b.status)) return true;
    const quando = dataDaReserva(b);
    return Number.isFinite(quando) && quando < agoraMs;
  });
  const aulasDadas = lessons.filter((l) => l?.status === 'completed');
  const arenasVisitadas = new Set(reservasJogadas.map((b) => b?.arena_id).filter(Boolean));

  const ownedClubs = clubs.filter((c) => c?.created_by === profile?.uid || c?.my_role === 'owner');
  const maiorClubeAdmin = clubs
    .filter((c) => c?.my_role === 'admin' || c?.my_role === 'owner')
    .reduce((m, c) => Math.max(m, Number(c?.member_count) || 0), 0);

  const kudos = src.kudosIndex || null;
  const referral = src.referral || null;

  return {
    unknown,
    known: conhecido,
    profile: {
      hasPhoto: Boolean(String(profile?.photo_url || '').trim()),
      hasLevel: profile ? hasDeclaredLevel(profile) : false,
      levelingLevel: String(profile?.leveling_level || '').trim() || null,
      registrationComplete: profile ? isRegistrationComplete(profile) : false,
      hasCityAndState: Boolean(String(profile?.city || '').trim() && String(profile?.state || '').trim()),
      city: String(profile?.city || '').trim() || null,
      state: String(profile?.state || '').trim() || null,
      birthMonth: (() => {
        const m = /^\d{4}-(\d{2})-\d{2}/.exec(String(profile?.birth_date || ''));
        return m ? Number(m[1]) : null;
      })(),
    },
    counts: {
      follows: following.length,
      followers: followers.length,
      bookings: reservasFeitas.length,
      bookingsPlayed: reservasJogadas.length,
      lessons: lessons.filter((l) => ['confirmed', 'completed'].includes(l?.status)).length,
      lessonsCompleted: aulasDadas.length,
      clinics: clinicSignups.length,
      packages: packageSales.length,
      clubsJoined: clubs.length,
      clubsCreated: ownedClubs.length,
      biggestClubAdminMembers: maiorClubeAdmin,
      clubEventsCreated: Number(src.clubEventsCreated) || 0,
      gameDaysCreated: Number(src.gameDaysCreated) || 0,
      arenaReviews: arenaReviews.length,
      arenasVisited: arenasVisitadas.size,
      kudosGiven: Number(kudos?.givenCount) || 0,
      kudosReceived: Number(kudos?.receivedCount) || 0,
      referralsActivated: Number(referral?.totalActivated) || 0,
      referralsSignedUp: Number(referral?.totalSignups) || 0,
      policyAccepted: (lista(src.consents) || []).length,
      matchReviewsGiven: matchReviews.length,
      fiveStarReceived: Number(src.reputation?.fiveStarCount) || 0,
      lettersSent: partnerLetters.length,
      challengesJoined: challengeEntries.length,
      tournamentRegistrations: registrations.length,
      debriefs: debriefs.length,
    },
    /** Datas (ms) de cada tipo de ato — o que permite recortar semana e mês. */
    dates: {
      follows: datasDe(following, 'created_at_ms', 'created_at'),
      bookings: reservasJogadas.map(dataDaReserva).filter(Number.isFinite),
      lessons: datasDe(aulasDadas, 'updated_at_ms', 'updated_at', 'created_at_ms', 'created_at'),
      arenaReviews: datasDe(arenaReviews, 'created_at_ms', 'created_at'),
      clinics: datasDe(clinicSignups, 'created_at_ms', 'created_at'),
      packages: datasDe(packageSales, 'created_at_ms', 'created_at'),
      kudosGiven: datasDe(sentKudos, 'createdAt', 'created_at_ms', 'created_at'),
      matchReviews: datasDe(matchReviews, 'createdAt', 'created_at_ms'),
      letters: datasDe(partnerLetters, 'createdAt', 'created_at_ms'),
      challengesJoined: datasDe(challengeEntries, 'joinedAt'),
      debriefs: datasDe(debriefs, 'created_at_ms', 'created_at'),
    },
  };
}

/**
 * Contagem de datas por mês, como VETOR de 12 posições (índice 0 = janeiro) —
 * é o formato que os predicados das conquistas sazonais leem.
 * @param {Array<number|Date>} datas ms
 * @returns {number[]}
 */
export function monthsFromDates(datas = []) {
  const porMes = Array(12).fill(0);
  datas.forEach((d) => {
    const ms = d instanceof Date ? d.getTime() : Number(d);
    if (!Number.isFinite(ms) || ms <= 0) return;
    const mes = Number(missionDateKey(new Date(ms)).slice(5, 7));
    if (mes >= 1 && mes <= 12) porMes[mes - 1] += 1;
  });
  return porMes;
}

/** Quantas datas caem de 25 a 31 de dezembro (a "última semana do ano"). */
export function lastWeekOfDecember(datas = []) {
  return datas.filter((d) => {
    const ms = d instanceof Date ? d.getTime() : Number(d);
    if (!Number.isFinite(ms) || ms <= 0) return false;
    const [, mm, dd] = missionDateKey(new Date(ms)).split('-').map(Number);
    return mm === 12 && dd >= 25;
  }).length;
}

/**
 * A maior sequência de ESTAÇÕES seguidas (trimestres do calendário: jan–mar,
 * abr–jun, jul–set, out–dez) em que houve ao menos uma data.
 */
export function consecutiveSeasons(datas = []) {
  const trimestres = new Set();
  datas.forEach((d) => {
    const ms = d instanceof Date ? d.getTime() : Number(d);
    if (!Number.isFinite(ms) || ms <= 0) return;
    const [ano, mes] = missionDateKey(new Date(ms)).split('-').map(Number);
    trimestres.add(ano * 4 + Math.floor((mes - 1) / 3));
  });
  const ordenados = [...trimestres].sort((a, b) => a - b);
  let melhor = 0;
  let atual = 0;
  ordenados.forEach((t, i) => {
    atual = i > 0 && t === ordenados[i - 1] + 1 ? atual + 1 : 1;
    melhor = Math.max(melhor, atual);
  });
  return melhor;
}

/** Dias DISTINTOS (no fuso da plataforma) com ao menos um registro. */
export function distinctDays(datas = []) {
  const dias = new Set();
  datas.forEach((d) => {
    const ms = d instanceof Date ? d.getTime() : Number(d);
    if (Number.isFinite(ms) && ms > 0) dias.add(missionDateKey(new Date(ms)));
  });
  return dias;
}

/**
 * O objeto `user` que os predicados de `achievementsV2` leem.
 *
 * Campo cuja fonte não carregou NÃO é preenchido (fica `undefined`): o
 * predicado vê "sem dado" e a conquista continua bloqueada, sem que o app
 * afirme que a pessoa não fez. Os campos que dependem de dado que a
 * plataforma ainda não registra (ex.: respostas marcadas como solução)
 * simplesmente não existem aqui — `ACHIEVEMENT_TRACKING` os declara.
 *
 * @param {ReturnType<typeof buildActivityFacts>} facts
 * @param {{
 *   uid?: string, rating?: number, stats?: object, streakWeeks?: number,
 *   level?: string|null, xpTotal?: number, matchDates?: number[], opponents?: number,
 *   position?: number|null,
 * }} base o que já vem do desempenho (jogos, rating, sequência)
 */
export function achievementUserFromFacts(facts, base = {}) {
  const c = facts?.counts || {};
  const ok = (fonte) => facts?.known?.(fonte) !== false;
  const todasDatas = [...(base.matchDates || []), ...(base.gameDayDates || [])];
  const porMes = monthsFromDates(todasDatas);
  const user = {
    uid: base.uid,
    rating: base.rating || 0,
    stats: base.stats || {},
    streak: { weeks: base.streakWeeks || 0 },
    level: base.level || null,
    position: base.position ?? null,
    xp_total: base.xpTotal || 0,
    photo_url: facts?.profile?.hasPhoto ? 'ok' : '',
    city: facts?.profile?.city || '',
    state: facts?.profile?.state || '',
    profile_completed: Boolean(facts?.profile?.registrationComplete),
    leveling_level: facts?.profile?.levelingLevel || null,
    birth_month: facts?.profile?.birthMonth ?? null,
    games_by_month: porMes,
    tournaments_by_month: monthsFromDates(base.tournamentDates || []),
    game_days_by_month: monthsFromDates(base.gameDayDates || []),
    unique_opponents: base.opponents || 0,
    last_week_december_games: lastWeekOfDecember(todasDatas),
    consecutive_seasons_played: consecutiveSeasons(todasDatas),
  };
  const set = (campo, valor, fonte) => { if (ok(fonte)) user[campo] = valor; };
  set('follows_count', c.follows, 'following');
  set('followers_count', c.followers, 'followers');
  set('bookings_count', c.bookings, 'bookings');
  set('arenas_visited_count', c.arenasVisited, 'bookings');
  set('lessons_count', c.lessons, 'lessons');
  set('lessons_completed', c.lessonsCompleted, 'lessons');
  set('clinics_count', c.clinics, 'clinicSignups');
  set('packages_count', c.packages, 'packageSales');
  set('clubs_joined', c.clubsJoined, 'clubs');
  set('clubs_created', c.clubsCreated, 'clubs');
  set('biggest_club_members', c.biggestClubAdminMembers, 'clubs');
  set('club_events_created', c.clubEventsCreated, 'clubEventsCreated');
  set('game_days_created', c.gameDaysCreated, 'gameDaysCreated');
  set('arena_reviews', c.arenaReviews, 'arenaReviews');
  set('kudos_given', c.kudosGiven, 'kudosIndex');
  set('kudos_received', c.kudosReceived, 'kudosIndex');
  set('referrals_activated', c.referralsActivated, 'referral');
  set('legal_consents', c.policyAccepted ? ['aceito'] : [], 'consents');
  set('letters_sent', c.lettersSent, 'partnerLetters');
  set('match_reviews_5star', c.fiveStarReceived, 'reputation');
  set('november_purchase', facts?.dates?.packages ? monthsFromDates(facts.dates.packages)[10] : 0, 'packageSales');
  return user;
}

/**
 * Conquistas cujos dados a plataforma AINDA NÃO registra. A tela as mostra
 * como "em breve", fora da conta de "x de y": prometer o que nada consegue
 * medir é o defeito que esta camada veio resolver.
 */
export const ACHIEVEMENT_TRACKING = Object.freeze({
  career_tri_champion: 'sem registro de títulos consecutivos',
  career_nocaute: 'sem registro do placar de cada jogo na carreira',
  career_revanche: 'sem registro de revanche',
  social_first_chat: 'o chat não expõe o total de mensagens enviadas',
  social_first_post: 'a publicação em fórum não é contada por autor',
  social_10_photos: 'fotos são do torneio, não do atleta',
  social_match_review_5star: null, // medido: avaliações pós-jogo (módulo novo)
  social_mascot: 'sem registro de boas-vindas',
  discovery_first_tournament_watched: 'a plataforma não registra quem assistiu ao torneio',
  discovery_3_states: 'sem registro dos estados em que a pessoa jogou',
  platform_5_states: 'sem registro dos estados em que a pessoa jogou',
  platform_100_arena_visited: null,
  seasonal_pascoa: 'sem registro de torneio beneficente',
  seasonal_volta_aulas: 'sem registro da data do primeiro vínculo com professor',
  community_club_post: 'a publicação no mural não é contada por autor',
  community_recruiter: 'sem registro de convites aceitos por quem convidou',
  community_pillar: 'sem registro do tempo como admin',
  community_ambassador: 'sem registro de convidados que viraram admin',
  community_recurring: 'sem registro de eventos recorrentes por criador',
  community_arena_referral: 'sem registro de arenas indicadas',
  community_help_newcomer: 'sem registro de respostas marcadas como solução',
  community_1y_admin: 'sem registro do tempo como admin',
  community_gameday_ref: 'sem registro de dias fechados com placar por criador',
  platform_100_validations: 'sem contagem de validações por professor no atleta',
});

/** A conquista é mensurável hoje? */
export function isAchievementTracked(id) {
  return !Object.prototype.hasOwnProperty.call(ACHIEVEMENT_TRACKING, id)
    || ACHIEVEMENT_TRACKING[id] === null;
}
