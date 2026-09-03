/**
 * Testes das regras do Firestore da gamificação V2 contra o emulador real.
 *
 * NÃO roda no `npm test` (Vitest): precisa do emulador do Firestore, que
 * exige Java e o .jar baixado. Rode manualmente antes de mexer nas regras:
 *
 *   npx firebase-tools setup:emulators:firestore
 *   npm install --no-save @firebase/rules-unit-testing
 *   npx firebase-tools emulators:exec --only firestore --project demo-picklerush \
 *     "node tests/rules/gamification.rules.emulator.mjs"
 *
 * O guarda-chuva que roda na CI é `firestore.rules.test.js` (sincronia do
 * vocabulário entre domínio e regras). Este arquivo cobre o comportamento.
 */
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';

const ALICE = 'alice', BOB = 'bob', ADMIN = 'admin';

const env = await initializeTestEnvironment({
  projectId: 'demo-picklerush',
  firestore: { rules: readFileSync('/home/user/pickleball/firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

const alice = env.authenticatedContext(ALICE).firestore();
const bob = env.authenticatedContext(BOB).firestore();
const admin = env.authenticatedContext(ADMIN).firestore();

// seed: admin precisa existir em users/ com role platform_admin
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'users', ADMIN), { role: 'platform_admin' });
  await setDoc(doc(ctx.firestore(), 'users', ALICE), { role: 'athlete' });
  await setDoc(doc(ctx.firestore(), 'users', BOB), { role: 'athlete' });
});

const results = [];
async function t(name, fn) {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message.split('\n')[0].slice(0, 160)]); }
}

const progression = (uid, over = {}) => ({
  uid, schemaVersion: 1, xpTotal: 15000, level: 8, tier: 'Regular',
  skillTrees: [
    { tree: 'tournament', level: 3, xp: 5000 }, { tree: 'social', level: 2, xp: 2000 },
    { tree: 'arena', level: 1, xp: 100 }, { tree: 'coach', level: 1, xp: 0 },
    { tree: 'club', level: 1, xp: 0 },
  ],
  achievementsUnlocked: 5, achievementsTotal: 88,
  source: 'seed', updatedAt: 1, createdAt: 1, ...over,
});

// ── user_progression_v2 ──────────────────────────────────────────────
await t('progressão: dono cria com tier "Regular" (o tier que o domínio gera)', () =>
  assertSucceeds(setDoc(doc(alice, 'user_progression_v2', ALICE), progression(ALICE))));
await t('progressão: tier "Imortal" com nível alto da curva é aceito', async () => {
  const dan = env.authenticatedContext('dan').firestore();
  // 1.000.000 XP dá nível 63 na curva (a mesma da V1, sem teto). O limite
  // antigo do schema era 20, e travava o save a partir de 105.000 XP.
  await assertSucceeds(setDoc(doc(dan, 'user_progression_v2', 'dan'),
    progression('dan', { tier: 'Imortal', level: 63, xpTotal: 1_000_000 })));
});
await t('progressão: nível absurdo (fora de qualquer curva real) é recusado', async () => {
  const eve = env.authenticatedContext('eve').firestore();
  await assertFails(setDoc(doc(eve, 'user_progression_v2', 'eve'),
    progression('eve', { tier: 'Imortal', level: 5000 })));
});
await t('progressão: tier inventado é recusado', () =>
  assertFails(setDoc(doc(alice, 'user_progression_v2', ALICE + '2'), progression(ALICE + '2', { tier: 'Semideus' }))));
await t('progressão: outro usuário NÃO escreve na minha', () =>
  assertFails(setDoc(doc(bob, 'user_progression_v2', ALICE), progression(ALICE, { xpTotal: 999999 }))));
await t('progressão: dono atualiza a própria', () =>
  assertSucceeds(setDoc(doc(alice, 'user_progression_v2', ALICE), progression(ALICE, { xpTotal: 16000 }))));
await t('HALL DA FAMA: qualquer autenticado lê a progressão alheia', () =>
  assertSucceeds(getDoc(doc(bob, 'user_progression_v2', ALICE))));
await t('HALL DA FAMA: query por tier + xpTotal desc é permitida', () =>
  assertSucceeds(getDocs(query(collection(bob, 'user_progression_v2'),
    where('tier', 'in', ['Jogador', 'Regular', 'Imortal']), orderBy('xpTotal', 'desc'), limit(50)))));

// ── user_achievements_v2 ─────────────────────────────────────────────
const ach = (uid, over = {}) => ({
  uid, achievementId: 'career_first_game', family: 'career', rarity: 'common',
  unlockedAt: 1, progress: 1, shareCount: 0, notified: false, ...over });
await t('conquista: dono desbloqueia (family "career" — a família real)', () =>
  assertSucceeds(setDoc(doc(alice, 'user_achievements_v2', `${ALICE}_career_first_game`), ach(ALICE))));
await t('conquista: dono marca como notificada (merge)', () =>
  assertSucceeds(updateDoc(doc(alice, 'user_achievements_v2', `${ALICE}_career_first_game`), { notified: true })));
await t('conquista: progresso NÃO pode regredir', () =>
  assertFails(updateDoc(doc(alice, 'user_achievements_v2', `${ALICE}_career_first_game`), { progress: 0.2 })));
await t('conquista: progresso parcial pode avançar', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'user_achievements_v2', `${ALICE}_p`), ach(ALICE, { achievementId: 'p', progress: 0.3 }));
  });
  await assertSucceeds(updateDoc(doc(alice, 'user_achievements_v2', `${ALICE}_p`), { progress: 0.7 }));
});
await t('PERFIL PÚBLICO: outro usuário lê minhas conquistas', () =>
  assertSucceeds(getDocs(query(collection(bob, 'user_achievements_v2'), where('uid', '==', ALICE)))));
await t('conquista: não posso criar conquista no nome de outro', () =>
  assertFails(setDoc(doc(bob, 'user_achievements_v2', `${ALICE}_fake`), ach(ALICE, { achievementId: 'fake' }))));

// ── user_streak_meta ─────────────────────────────────────────────────
const streak = (uid, over = {}) => ({
  uid, schemaVersion: 1, lastPlayAt: null, graceDaysRemaining: 3, freezesAvailable: 3,
  freezesUsed: 0, vacationMode: false, vacationStartedAt: null, comebackBonus: 0, updatedAt: 1, ...over });
await t('streak: dono cria o meta', () =>
  assertSucceeds(setDoc(doc(alice, 'user_streak_meta', ALICE), streak(ALICE))));
await t('streak: freezesUsed acumulado (6) é aceito', () =>
  assertSucceeds(setDoc(doc(alice, 'user_streak_meta', ALICE), streak(ALICE, { freezesUsed: 6, freezesAvailable: 0 }))));
await t('streak: é privado — outro usuário não lê', () =>
  assertFails(getDoc(doc(bob, 'user_streak_meta', ALICE))));

// ── missions ─────────────────────────────────────────────────────────
const mission = (uid) => ({ uid, date: '2026-09-03', scope: 'daily', missions: [], bonusClaimed: false, completedAt: null, createdAt: 1, updatedAt: 1 });
await t('missões: dono cria o doc do dia', () =>
  assertSucceeds(setDoc(doc(alice, 'user_missions', `${ALICE}_2026-09-03`), mission(ALICE))));
await t('missões: são privadas', () =>
  assertFails(getDoc(doc(bob, 'user_missions', `${ALICE}_2026-09-03`))));

// ── kudos ────────────────────────────────────────────────────────────
await t('KUDO: alice dá kudo pra bob (cria o kudo)', () =>
  assertSucceeds(setDoc(doc(alice, 'user_kudos', 'k1'), {
    kudoId: 'k1', fromUid: ALICE, toUid: BOB, type: 'sportsmanship', scope: 'universal', createdAt: 1, expiresAt: 2 })));
await t('KUDO: não posso dar kudo pra mim mesmo', () =>
  assertFails(setDoc(doc(alice, 'user_kudos', 'k2'), {
    kudoId: 'k2', fromUid: ALICE, toUid: ALICE, type: 'clutch', scope: 'universal', createdAt: 1, expiresAt: 2 })));
await t('KUDO: não posso forjar kudo vindo de outro', () =>
  assertFails(setDoc(doc(alice, 'user_kudos', 'k3'), {
    kudoId: 'k3', fromUid: BOB, toUid: ALICE, type: 'clutch', scope: 'universal', createdAt: 1, expiresAt: 2 })));

const kIdx = (uid, over = {}) => ({ uid, schemaVersion: 2, receivedCount: 0, givenCount: 0, receivedToday: 0, givenToday: 0, lastKudoDay: '2026-09-03', updatedAt: 1, ...over });
await t('KUDO: alice atualiza o próprio índice (givenCount)', async () => {
  await assertSucceeds(setDoc(doc(alice, 'user_kudos_index', ALICE), kIdx(ALICE, { givenCount: 1, givenToday: 1 })));
});
await t('KUDO: alice CRIA o índice de bob ao dar o 1º kudo (escrita cruzada)', () =>
  assertSucceeds(setDoc(doc(alice, 'user_kudos_index', BOB), kIdx(BOB, { receivedCount: 1, receivedToday: 1 }))));
await t('KUDO: alice incrementa +1 os recebidos de bob', () =>
  assertSucceeds(setDoc(doc(alice, 'user_kudos_index', BOB), kIdx(BOB, { receivedCount: 2, receivedToday: 2 }))));
await t('KUDO: alice NÃO pode inflar os recebidos de bob em +50', () =>
  assertFails(setDoc(doc(alice, 'user_kudos_index', BOB), kIdx(BOB, { receivedCount: 52, receivedToday: 52 }))));
await t('KUDO: alice NÃO pode mexer no givenCount de bob', () =>
  assertFails(setDoc(doc(alice, 'user_kudos_index', BOB), kIdx(BOB, { receivedCount: 3, receivedToday: 3, givenCount: 99 }))));

// ── rivals ───────────────────────────────────────────────────────────
const rival = (over = {}) => ({ pairKey: 'alice_bob', userA: ALICE, userB: BOB, gamesA: 0, gamesB: 0, winsA: 0, winsB: 0, lastGameAt: null, createdAt: 1, updatedAt: 1, ...over });
await t('RIVAIS: alice CRIA a rivalidade (era negado — resource null no create)', () =>
  assertSucceeds(setDoc(doc(alice, 'user_rivals', 'alice_bob'), rival())));
await t('RIVAIS: bob (o outro lado) atualiza o placar', () =>
  assertSucceeds(setDoc(doc(bob, 'user_rivals', 'alice_bob'), rival({ gamesA: 1, gamesB: 1, winsB: 1 }))));
await t('RIVAIS: terceiro não cria rivalidade alheia', async () => {
  const carol = env.authenticatedContext('carol').firestore();
  await assertFails(setDoc(doc(carol, 'user_rivals', 'alice_bobX'), rival({ pairKey: 'alice_bobX' })));
});

// ── crews ────────────────────────────────────────────────────────────
const crew = (id, over = {}) => ({ crewId: id, schemaVersion: 2, name: 'Turma do Saque', isPublic: true, createdBy: ALICE, membersCount: 1, totalXp: 0, totalWins: 0, createdAt: 1, updatedAt: 1, ...over });
await t('CREW: alice cria a crew', () =>
  assertSucceeds(setDoc(doc(alice, 'crews', 'c1'), crew('c1'))));
await t('CREW: alice entra como owner em crew_members', () =>
  assertSucceeds(setDoc(doc(alice, 'crew_members', 'c1_alice'), { crewId: 'c1', uid: ALICE, role: 'owner', joinedAt: 1, contributionXp: 0, updatedAt: 1 })));
await t('CREW: bob entra na crew (cria a própria membership)', () =>
  assertSucceeds(setDoc(doc(bob, 'crew_members', 'c1_bob'), { crewId: 'c1', uid: BOB, role: 'member', joinedAt: 1, contributionXp: 0, updatedAt: 1 })));
await t('CREW: bob incrementa membersCount ao entrar (era negado)', () =>
  assertSucceeds(updateDoc(doc(bob, 'crews', 'c1'), { membersCount: 2, updatedAt: 2 })));
await t('CREW: bob NÃO pode renomear a crew', () =>
  assertFails(updateDoc(doc(bob, 'crews', 'c1'), { name: 'Sequestrada' })));
await t('CREW: bob NÃO pode pular membersCount para 40', () =>
  assertFails(updateDoc(doc(bob, 'crews', 'c1'), { membersCount: 40 })));
await t('CREW: bob lista os membros da crew', () =>
  assertSucceeds(getDocs(query(collection(bob, 'crew_members'), where('crewId', '==', 'c1')))));
await t('CREW privada: membro consegue ler', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'crews', 'c2'), crew('c2', { isPublic: false }));
    await setDoc(doc(ctx.firestore(), 'crew_members', 'c2_bob'), { crewId: 'c2', uid: BOB, role: 'member', joinedAt: 1, contributionXp: 0, updatedAt: 1 });
  });
  await assertSucceeds(getDoc(doc(bob, 'crews', 'c2')));
});
await t('CREW privada: não-membro NÃO lê', async () => {
  const carol = env.authenticatedContext('carol').firestore();
  await assertFails(getDoc(doc(carol, 'crews', 'c2')));
});

// ── mentorships ──────────────────────────────────────────────────────
const mentor = (over = {}) => ({ pairKey: 'alice_bob', schemaVersion: 2, mentorUid: ALICE, apprenticeUid: BOB, status: 'active', lessonsCompleted: 0, startedAt: 1, endedAt: null, updatedAt: 1, ...over });
await t('MENTORIA: mentor CRIA a mentoria (era negado)', () =>
  assertSucceeds(setDoc(doc(alice, 'mentorships', 'alice_bob'), mentor())));
await t('MENTORIA: aprendiz registra aula', () =>
  assertSucceeds(setDoc(doc(bob, 'mentorships', 'alice_bob'), mentor({ lessonsCompleted: 1 }))));
await t('MENTORIA: terceiro não cria mentoria alheia', async () => {
  const carol = env.authenticatedContext('carol').firestore();
  await assertFails(setDoc(doc(carol, 'mentorships', 'alice_bobZ'), mentor({ pairKey: 'alice_bobZ' })));
});

// ── referrals ────────────────────────────────────────────────────────
const code = (uid, over = {}) => ({ uid, schemaVersion: 2, code: 'ABCD2345', createdAt: 1, totalSignups: 0, totalActivated: 0, totalTournaments: 0, totalXpEarned: 0, monthlyCount: 0, monthKey: '2026-09', updatedAt: 1, ...over });
await t('REFERRAL: alice cria o próprio código', () =>
  assertSucceeds(setDoc(doc(alice, 'user_referral_codes', ALICE), code(ALICE))));
await t('REFERRAL: bob (indicado) CRIA o vínculo user_referrals (era negado)', () =>
  assertSucceeds(setDoc(doc(bob, 'user_referrals', BOB), {
    refereeUid: BOB, referrerUid: ALICE, code: 'ABCD2345', signedUpAt: 1, activatedAt: null, tournamentAt: null, xpPaidOut: 0, updatedAt: 1 })));
await t('REFERRAL: bob credita +1 signup no código de alice (escrita cruzada)', () =>
  assertSucceeds(updateDoc(doc(bob, 'user_referral_codes', ALICE), { totalSignups: 1, monthlyCount: 1, monthKey: '2026-09', updatedAt: 2 })));
await t('REFERRAL: bob NÃO pode inflar o código de alice em +30', () =>
  assertFails(updateDoc(doc(bob, 'user_referral_codes', ALICE), { totalSignups: 31, monthlyCount: 31 })));
await t('REFERRAL: bob NÃO pode trocar o código de alice', () =>
  assertFails(updateDoc(doc(bob, 'user_referral_codes', ALICE), { code: 'HACKHACK', totalSignups: 2 })));
await t('REFERRAL: não posso registrar vínculo em nome de terceiro', async () => {
  const carol = env.authenticatedContext('carol').firestore();
  await assertFails(setDoc(doc(carol, 'user_referrals', ALICE), {
    refereeUid: ALICE, referrerUid: 'carol', code: 'ABCD2345', signedUpAt: 1, activatedAt: null, tournamentAt: null, xpPaidOut: 0, updatedAt: 1 }));
});

// ── season_rankings ──────────────────────────────────────────────────
await t('SEASON: cliente NÃO escreve o ranking sazonal (só admin/CF)', () =>
  assertFails(setDoc(doc(alice, 'season_rankings', '2026-09_alice'), {
    seasonId: '2026-09', uid: ALICE, schemaVersion: 2, xp: 999999, tier: 'Imortal', position: 1, deltaPosition: 0, prizeXp: 0, updatedAt: 1 })));
await t('SEASON: admin escreve', () =>
  assertSucceeds(setDoc(doc(admin, 'season_rankings', '2026-09_alice'), {
    seasonId: '2026-09', uid: ALICE, schemaVersion: 2, xp: 100, tier: 'Jogador', position: 1, deltaPosition: 0, prizeXp: 0, updatedAt: 1 })));
await t('SEASON: placar é legível por qualquer autenticado (leaderboard)', () =>
  assertSucceeds(getDocs(query(collection(bob, 'season_rankings'), where('seasonId', '==', '2026-09'), orderBy('xp', 'desc'), limit(50)))));

await env.cleanup();
const fails = results.filter((r) => r[0] === 'FAIL');
for (const r of results) console.log(r[0] === 'PASS' ? `  ✓ ${r[1]}` : `  ✗ ${r[1]}\n      ${r[2]}`);
console.log(`\n${results.length - fails.length}/${results.length} regras OK`);
process.exit(fails.length ? 1 : 0);
