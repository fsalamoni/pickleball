import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'hocapp-44760';
const DATABASE_ID = 'bolao2026';
const OWNER_EMAIL = 'fsalamoni@gmail.com';
const BATCH_LIMIT = 450;

const args = new Set(process.argv.slice(2));
const shouldApply = args.has('--apply');
const shouldCleanup = args.has('--cleanup');
const poolIdArg = process.argv.find((arg) => arg.startsWith('--pool-id='));
const runIdArg = process.argv.find((arg) => arg.startsWith('--test-run-id='));
const requestedPoolId = poolIdArg?.split('=')[1] || null;
const testRunId = runIdArg?.split('=')[1] || `demo_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

const fakeUsers = [
  { slug: 'ana', name: 'Ana Teste', email: 'ana.teste@example.com', birthDate: '1991-02-11', phone: '+5511999991001' },
  { slug: 'bruno', name: 'Bruno Teste', email: 'bruno.teste@example.com', birthDate: '1987-05-03', phone: '+5511999991002' },
  { slug: 'carla', name: 'Carla Teste', email: 'carla.teste@example.com', birthDate: '1996-08-24', phone: '+5511999991003' },
  { slug: 'diego', name: 'Diego Teste', email: 'diego.teste@example.com', birthDate: '1984-12-30', phone: '+5511999991004' },
  { slug: 'elisa', name: 'Elisa Teste', email: 'elisa.teste@example.com', birthDate: '1999-03-19', phone: '+5511999991005' },
  { slug: 'felipe', name: 'Felipe Teste', email: 'felipe.teste@example.com', birthDate: '1993-10-07', phone: '+5511999991006' },
  { slug: 'giulia', name: 'Giulia Teste', email: 'giulia.teste@example.com', birthDate: '1990-06-16', phone: '+5511999991007' },
  { slug: 'henrique', name: 'Henrique Teste', email: 'henrique.teste@example.com', birthDate: '1988-09-28', phone: '+5511999991008' },
];

const hitTypes = [
  'exact_score',
  'winner_plus_diff',
  'winner_plus_team_goals',
  'winner_only',
  'team_goals_only',
  'none',
];

const stagePoints = {
  group: { exact_score: 25, winner_plus_diff: 18, winner_plus_team_goals: 15, winner_only: 12, team_goals_only: 5, penalty_winner: 0 },
  r16: { exact_score: 50, winner_plus_diff: 35, winner_plus_team_goals: 30, winner_only: 25, team_goals_only: 10, penalty_winner: 25 },
  qf: { exact_score: 100, winner_plus_diff: 70, winner_plus_team_goals: 60, winner_only: 50, team_goals_only: 20, penalty_winner: 50 },
  sf: { exact_score: 200, winner_plus_diff: 140, winner_plus_team_goals: 120, winner_only: 100, team_goals_only: 40, penalty_winner: 100 },
  semi: { exact_score: 300, winner_plus_diff: 210, winner_plus_team_goals: 180, winner_only: 150, team_goals_only: 60, penalty_winner: 150 },
  third: { exact_score: 300, winner_plus_diff: 210, winner_plus_team_goals: 180, winner_only: 150, team_goals_only: 60, penalty_winner: 150 },
  final: { exact_score: 500, winner_plus_diff: 350, winner_plus_team_goals: 300, winner_only: 250, team_goals_only: 100, penalty_winner: 250 },
};

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(DATABASE_ID);

async function main() {
  if (shouldCleanup) {
    await cleanupTestRun();
    return;
  }

  const pool = await resolvePool();
  const tournament = await resolveTournament(pool.tournament_id);
  const matches = await loadMatches(tournament.id);
  const teamIds = uniqueTeamIds(matches);
  const operations = [];
  const totalsByUserId = new Map();

  console.log(`Test run: ${testRunId}`);
  console.log(`Pool: ${pool.id} (${pool.name})`);
  console.log(`Tournament: ${tournament.id}`);
  console.log(`Matches available: ${matches.length}`);

  for (let userIndex = 0; userIndex < fakeUsers.length; userIndex += 1) {
    const fakeUser = fakeUsers[userIndex];
    const userId = fakeUserId(fakeUser.slug);
    totalsByUserId.set(userId, { points: 0, buchas: 0, superBuchas: 0 });

    operations.push({
      type: 'set',
      ref: db.collection('users').doc(userId),
      data: buildUserDoc(fakeUser, userId),
      options: { merge: true },
    });

    operations.push({
      type: 'set',
      ref: db.collection('pool_memberships').doc(`${userId}_${pool.id}`),
      data: buildMembershipDoc(fakeUser, userId, pool.id, userIndex),
      options: { merge: true },
    });

    for (let matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
      const match = matches[matchIndex];
      if (shouldSkipBet(userIndex, matchIndex)) continue;
      operations.push({
        type: 'set',
        ref: db.collection('bets').doc(`${userId}_${pool.id}_${match.id}`),
        data: buildBetDoc(userId, pool.id, match, matchIndex, userIndex),
        options: { merge: true },
      });

      const score = buildScoreDoc(userId, pool.id, match, matchIndex, userIndex);
      addTotals(totalsByUserId.get(userId), score);
      operations.push({
        type: 'set',
        ref: db.collection('processed_scores').doc(`${userId}_${pool.id}_${match.id}`),
        data: score,
        options: { merge: true },
      });
    }

    operations.push({
      type: 'set',
      ref: db.collection('special_bets').doc(`${userId}_${pool.id}_champion`),
      data: buildSpecialBetDoc(userId, pool.id, 'champion', pickTeamId(teamIds, userIndex)),
      options: { merge: true },
    });
    operations.push({
      type: 'set',
      ref: db.collection('special_bets').doc(`${userId}_${pool.id}_top_scorer`),
      data: buildSpecialBetDoc(userId, pool.id, 'top_scorer', null, `${fakeUser.name.split(' ')[0]} Silva`),
      options: { merge: true },
    });
  }

  for (const [userId, totals] of totalsByUserId.entries()) {
    operations.push({
      type: 'update',
      ref: db.collection('pool_memberships').doc(`${userId}_${pool.id}`),
      data: {
        points: totals.points,
        buchas: totals.buchas,
        super_buchas: totals.superBuchas,
        updated_at: FieldValue.serverTimestamp(),
      },
    });
  }

  console.log(`Firestore writes prepared: ${operations.length}`);
  if (!shouldApply) {
    console.log('Dry run only. Re-run with --apply to write test data.');
    return;
  }

  await commitOperations(operations);
  await recomputePoolMemberCount(pool.id);
  console.log(`Seeded ${fakeUsers.length} fake users and synthetic rankings. Cleanup with: npm run testdata:cleanup -- --test-run-id=${testRunId} --apply`);
}

async function cleanupTestRun() {
  const collections = ['users', 'pool_memberships', 'bets', 'special_bets', 'processed_scores'];
  const operations = [];
  const affectedPoolIds = new Set();

  for (const collectionName of collections) {
    const snap = await db.collection(collectionName).where('test_run_id', '==', testRunId).get();
    snap.docs.forEach((docSnap) => {
      if (docSnap.data().pool_id) affectedPoolIds.add(docSnap.data().pool_id);
      operations.push({ type: 'delete', ref: docSnap.ref });
    });
  }

  console.log(`Cleanup run: ${testRunId}`);
  console.log(`Documents to delete: ${operations.length}`);
  if (!shouldApply) {
    console.log('Dry run only. Re-run with --cleanup --apply to delete test data.');
    return;
  }

  await commitOperations(operations);
  for (const poolId of affectedPoolIds) await recomputePoolMemberCount(poolId);
  console.log(`Deleted ${operations.length} test documents.`);
}

async function resolvePool() {
  if (requestedPoolId) {
    const poolSnap = await db.collection('pools').doc(requestedPoolId).get();
    if (!poolSnap.exists) throw new Error(`Pool not found: ${requestedPoolId}`);
    return { id: poolSnap.id, ...poolSnap.data() };
  }

  const ownerSnap = await db.collection('users').where('email', '==', OWNER_EMAIL).limit(1).get();
  if (ownerSnap.empty) throw new Error(`Owner user not found for ${OWNER_EMAIL}`);

  const poolSnap = await db.collection('pools').where('owner_user_id', '==', ownerSnap.docs[0].id).limit(1).get();
  if (poolSnap.empty) throw new Error(`No pool found for owner ${OWNER_EMAIL}. Pass --pool-id=<id>.`);
  return { id: poolSnap.docs[0].id, ...poolSnap.docs[0].data() };
}

async function resolveTournament(poolTournamentId) {
  if (poolTournamentId) {
    const tournamentSnap = await db.collection('tournaments').doc(poolTournamentId).get();
    if (tournamentSnap.exists) return { id: tournamentSnap.id, ...tournamentSnap.data() };
  }

  const tournamentSnap = await db.collection('tournaments').limit(1).get();
  if (tournamentSnap.empty) throw new Error('No tournament found.');
  return { id: tournamentSnap.docs[0].id, ...tournamentSnap.docs[0].data() };
}

async function loadMatches(tournamentId) {
  const snap = await db.collection('matches').where('tournament_id', '==', tournamentId).get();
  return snap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .sort((first, second) => {
      const firstTime = first.kickoff_at?.toDate?.()?.getTime?.() || 0;
      const secondTime = second.kickoff_at?.toDate?.()?.getTime?.() || 0;
      return firstTime - secondTime || (first.sequence_in_stage || 0) - (second.sequence_in_stage || 0);
    });
}

function buildUserDoc(fakeUser, userId) {
  return {
    uid: userId,
    email: fakeUser.email,
    full_name: fakeUser.name,
    platform_name: fakeUser.name,
    birth_date: fakeUser.birthDate,
    phone: fakeUser.phone,
    photo_url: '',
    role: 'user',
    can_create_pools: false,
    is_test_user: true,
    test_run_id: testRunId,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };
}

function buildMembershipDoc(fakeUser, userId, poolId, userIndex) {
  return {
    user_id: userId,
    pool_id: poolId,
    user_email_snapshot: fakeUser.email,
    user_name_snapshot: fakeUser.name,
    user_photo_snapshot: '',
    role: 'participant',
    points: 0,
    buchas: 0,
    super_buchas: 0,
    group_stage_position: userIndex + 1,
    is_test_user: true,
    test_run_id: testRunId,
    joined_at: FieldValue.serverTimestamp(),
  };
}

function buildBetDoc(userId, poolId, match, matchIndex, userIndex) {
  const homeScore = (matchIndex + userIndex) % 5;
  const awayScore = (matchIndex * 2 + userIndex) % 4;
  return {
    user_id: userId,
    pool_id: poolId,
    match_id: match.id,
    predicted_home: homeScore,
    predicted_away: awayScore,
    penalty_winner_team_id: match.stage_code === 'group' ? null : pickPenaltyTeam(match, userIndex),
    revealed: true,
    is_test_user: true,
    test_run_id: testRunId,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };
}

function buildScoreDoc(userId, poolId, match, matchIndex, userIndex) {
  const tier = stagePoints[match.stage_code] || stagePoints.group;
  const hitType = hitTypes[(matchIndex + userIndex) % hitTypes.length];
  const zebraApplied = Boolean(match.zebra_team_id) && (matchIndex + userIndex) % 4 === 0;
  const multiplier = zebraApplied ? Number(match.zebra_multiplier || 2) : 1;
  const basePoints = Number(tier[hitType] || 0) * multiplier;
  const penaltyPoints = match.stage_code !== 'group' && (matchIndex + userIndex) % 3 === 0 ? tier.penalty_winner : 0;
  const isBucha = hitType === 'exact_score';
  const isSuperBucha = isBucha && (penaltyPoints > 0 || zebraApplied);

  return {
    user_id: userId,
    pool_id: poolId,
    match_id: match.id,
    tournament_id: match.tournament_id || null,
    stage_id: match.stage_id || null,
    stage_code: match.stage_code || null,
    sequence_in_stage: match.sequence_in_stage || null,
    points: basePoints + penaltyPoints,
    base_points: basePoints,
    penalty_points: penaltyPoints,
    multiplier,
    hit_type: hitType,
    is_bucha: isBucha,
    is_super_bucha: isSuperBucha,
    zebra_applied: zebraApplied,
    synthetic: true,
    is_test_user: true,
    test_run_id: testRunId,
    computed_at: FieldValue.serverTimestamp(),
  };
}

function buildSpecialBetDoc(userId, poolId, type, teamId = null, playerName = null) {
  return {
    user_id: userId,
    pool_id: poolId,
    type,
    team_id: teamId,
    player_name: playerName,
    revealed: true,
    is_test_user: true,
    test_run_id: testRunId,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };
}

function addTotals(totals, score) {
  totals.points += score.points || 0;
  totals.buchas += score.is_bucha ? 1 : 0;
  totals.superBuchas += score.is_super_bucha ? 1 : 0;
}

function shouldSkipBet(userIndex, matchIndex) {
  return userIndex === 0 ? false : (matchIndex + userIndex) % (userIndex + 5) === 0;
}

function uniqueTeamIds(matches) {
  const ids = new Set();
  matches.forEach((match) => {
    if (match.home_team_id) ids.add(match.home_team_id);
    if (match.away_team_id) ids.add(match.away_team_id);
  });
  return [...ids];
}

function pickTeamId(teamIds, index) {
  return teamIds[index % Math.max(teamIds.length, 1)] || null;
}

function pickPenaltyTeam(match, userIndex) {
  const teams = [match.home_team_id, match.away_team_id].filter(Boolean);
  if (!teams.length) return null;
  return teams[userIndex % teams.length];
}

async function recomputePoolMemberCount(poolId) {
  const snap = await db.collection('pool_memberships').where('pool_id', '==', poolId).get();
  await db.collection('pools').doc(poolId).set({
    stats: { members_count: snap.size },
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function commitOperations(operations) {
  let batch = db.batch();
  let count = 0;

  for (const operation of operations) {
    if (operation.type === 'delete') batch.delete(operation.ref);
    if (operation.type === 'update') batch.update(operation.ref, operation.data);
    if (operation.type === 'set') batch.set(operation.ref, operation.data, operation.options || {});
    count += 1;

    if (count >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) await batch.commit();
}

function fakeUserId(slug) {
  return `test_${testRunId}_${slug}`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
