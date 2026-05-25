/**
 * Guarded Firestore static tournament seed for database "bolao2026".
 *
 * Default mode is a dry-run. To write, pass --apply. If static tournament
 * collections already contain data, pass --delete-existing explicitly.
 *
 * This script imports the canonical frontend seed files so the local CLI seed
 * cannot drift from the admin/client seed or the production schedule migration.
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { SEED_TEAMS, SEED_GROUPS } from '../src/modules/tournament/data/seedTeams.js';
import { SEED_SCORING_TIERS } from '../src/modules/tournament/data/seedScoringTiers.js';
import {
  SEED_DEADLINES_BRT,
  TOURNAMENT_END_BRT,
  TOURNAMENT_START_BRT,
} from '../src/modules/tournament/data/seedDeadlines.js';
import { SEED_MATCHES } from '../src/modules/tournament/data/seedMatches.js';

const PROJECT_ID = 'hocapp-44760';
const DATABASE_ID = 'bolao2026';
const BATCH_LIMIT = 450;
const STATIC_COLLECTIONS = [
  'matches',
  'stages',
  'team_in_group',
  'teams',
  'groups',
  'scoring_tiers',
  'tournaments',
];
const STAGE_ORDER = ['group', 'r16', 'qf', 'sf', 'semi', 'third', 'final'];
const STAGE_LABELS = {
  group: 'Fase de Grupos',
  r16: '16-avos de Final',
  qf: 'Oitavas de Final',
  sf: 'Quartas de Final',
  semi: 'Semifinais',
  third: 'Disputa de 3º Lugar',
  final: 'Final',
};

const args = new Set(process.argv.slice(2));
const shouldApply = args.has('--apply');
const shouldDeleteExisting = args.has('--delete-existing');

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(DATABASE_ID);

async function main() {
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Database: ${DATABASE_ID}`);
  console.log(`Seed payload: ${SEED_TEAMS.length} teams, ${SEED_GROUPS.length} groups, ${SEED_MATCHES.length} matches`);

  if (SEED_MATCHES.length !== 104) throw new Error(`Expected 104 matches, got ${SEED_MATCHES.length}.`);

  const existingCounts = await countStaticCollections();
  const existingTotal = Object.values(existingCounts).reduce((sum, count) => sum + count, 0);
  if (existingTotal > 0) console.log('Existing static data:', existingCounts);

  if (!shouldApply) {
    console.log('Dry run only. Re-run with --apply to write. Add --delete-existing to replace existing static data.');
    return;
  }

  if (existingTotal > 0 && !shouldDeleteExisting) {
    throw new Error('Static tournament data already exists. Re-run with --apply --delete-existing only if you intentionally want to replace it.');
  }

  if (shouldDeleteExisting) await purgeStaticCollections();
  const result = await seedTournament();

  console.log('Seed completed successfully.');
  console.log(result);
}

async function countStaticCollections() {
  const entries = await Promise.all(
    STATIC_COLLECTIONS.map(async (collectionName) => {
      const snap = await db.collection(collectionName).count().get();
      return [collectionName, snap.data().count];
    }),
  );
  return Object.fromEntries(entries);
}

async function purgeStaticCollections() {
  for (const collectionName of STATIC_COLLECTIONS) {
    const snap = await db.collection(collectionName).get();
    if (snap.empty) continue;

    const operations = snap.docs.map((docSnap) => (batch) => batch.delete(docSnap.ref));
    await commitInChunks(operations);
    console.log(`Deleted ${snap.size} docs from ${collectionName}.`);
  }
}

async function seedTournament() {
  const tournamentRef = db.collection('tournaments').doc();
  const groupRefByCode = {};
  const teamRefByCode = {};
  const stageRefByCode = {};
  const tierIdByStage = {};
  const operations = [];

  operations.push((batch) => batch.set(tournamentRef, {
    name: 'Copa do Mundo FIFA 2026',
    starts_at: new Date(TOURNAMENT_START_BRT),
    ends_at: new Date(TOURNAMENT_END_BRT),
    status: 'scheduled',
    created_at: FieldValue.serverTimestamp(),
  }));

  for (const group of SEED_GROUPS) {
    const ref = db.collection('groups').doc();
    groupRefByCode[group.code] = ref;
    operations.push((batch) => batch.set(ref, { tournament_id: tournamentRef.id, code: group.code }));
  }

  for (const team of SEED_TEAMS) {
    const teamRef = db.collection('teams').doc();
    teamRefByCode[team.code] = teamRef;
    operations.push((batch) => batch.set(teamRef, { code: team.code, name: team.name }));

    const relationRef = db.collection('team_in_group').doc();
    operations.push((batch) => batch.set(relationRef, {
      team_id: teamRef.id,
      group_id: groupRefByCode[team.group_code]?.id || null,
      group_code: team.group_code,
    }));
  }

  for (const tier of SEED_SCORING_TIERS) {
    const ref = db.collection('scoring_tiers').doc();
    tierIdByStage[tier.stage_code] = ref.id;
    operations.push((batch) => batch.set(ref, tier));
  }

  for (let index = 0; index < STAGE_ORDER.length; index += 1) {
    const code = STAGE_ORDER[index];
    const ref = db.collection('stages').doc();
    stageRefByCode[code] = ref;
    operations.push((batch) => batch.set(ref, {
      tournament_id: tournamentRef.id,
      code,
      label: STAGE_LABELS[code],
      sort_order: index,
      bet_lock_at: new Date(SEED_DEADLINES_BRT[code]),
      scoring_tier_id: tierIdByStage[code] || null,
    }));
  }

  for (const match of SEED_MATCHES) {
    const ref = db.collection('matches').doc();
    const stageRef = stageRefByCode[match.stage_code];
    operations.push((batch) => batch.set(ref, {
      tournament_id: tournamentRef.id,
      stage_id: stageRef?.id || null,
      stage_code: match.stage_code,
      group_id: match.group_code ? groupRefByCode[match.group_code]?.id || null : null,
      group_code: match.group_code || null,
      sequence_in_stage: match.sequence,
      home_team_id: match.home ? teamRefByCode[match.home]?.id || null : null,
      away_team_id: match.away ? teamRefByCode[match.away]?.id || null : null,
      home_placeholder: match.home_placeholder || null,
      away_placeholder: match.away_placeholder || null,
      kickoff_at: new Date(match.kickoff),
      bet_lock_at: new Date(SEED_DEADLINES_BRT[match.stage_code]),
      zebra_team_id: match.zebra ? teamRefByCode[match.zebra]?.id || null : null,
      zebra_multiplier: match.zebra_mult ?? null,
      official_home_score: null,
      official_away_score: null,
      penalty_winner_team_id: null,
      status: 'scheduled',
    }));
  }

  await commitInChunks(operations);

  return {
    tournament_id: tournamentRef.id,
    teams: SEED_TEAMS.length,
    groups: SEED_GROUPS.length,
    matches: SEED_MATCHES.length,
    stages: STAGE_ORDER.length,
  };
}

async function commitInChunks(operations) {
  let batch = db.batch();
  let count = 0;

  for (const operation of operations) {
    operation(batch);
    count += 1;
    if (count >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) await batch.commit();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
