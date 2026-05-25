import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { SEED_MATCHES } from '../src/modules/tournament/data/seedMatches.js';
import { SEED_DEADLINES_BRT } from '../src/modules/tournament/data/seedDeadlines.js';

const PROJECT_ID = 'hocapp-44760';
const DATABASE_ID = 'bolao2026';
const BATCH_LIMIT = 450;
const SOURCE = 'FIFA match schedule via Wikipedia 2026-05-05';

const args = new Set(process.argv.slice(2));
const shouldApply = args.has('--apply');
const tournamentIdArg = process.argv.find((arg) => arg.startsWith('--tournament-id='));
const requestedTournamentId = tournamentIdArg?.split('=')[1] || null;

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(DATABASE_ID);

async function main() {
  const tournamentId = requestedTournamentId || await findTournamentId();
  if (!tournamentId) throw new Error('No tournament found. Pass --tournament-id=<id> or seed the tournament first.');

  const teamsByCode = await loadTeamsByCode();
  const matchesByKey = await loadMatchesBySeedKey(tournamentId);
  const operations = [];
  const missing = [];

  for (const seedMatch of SEED_MATCHES) {
    const key = matchKey(seedMatch.stage_code, seedMatch.sequence, seedMatch.group_code);
    const matchDoc = matchesByKey.get(key);
    if (!matchDoc) {
      missing.push(key);
      continue;
    }

    const update = {
      kickoff_at: new Date(seedMatch.kickoff),
      bet_lock_at: new Date(SEED_DEADLINES_BRT[seedMatch.stage_code]),
      home_team_id: seedMatch.home ? teamsByCode.get(seedMatch.home) || null : null,
      away_team_id: seedMatch.away ? teamsByCode.get(seedMatch.away) || null : null,
      home_placeholder: seedMatch.home_placeholder || null,
      away_placeholder: seedMatch.away_placeholder || null,
      schedule_source: SOURCE,
      schedule_verified_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    operations.push({ ref: matchDoc.ref, update, key });
  }

  console.log(`Tournament: ${tournamentId}`);
  console.log(`Schedule updates prepared: ${operations.length}`);
  if (missing.length) console.warn(`Missing matches: ${missing.join(', ')}`);

  if (!shouldApply) {
    console.log('Dry run only. Re-run with --apply to write updates.');
    return;
  }

  await commitUpdates(operations);
  console.log(`Updated ${operations.length} match documents without changing official results.`);
}

async function findTournamentId() {
  const snap = await db.collection('tournaments').limit(1).get();
  return snap.docs[0]?.id || null;
}

async function loadTeamsByCode() {
  const snap = await db.collection('teams').get();
  return new Map(snap.docs.map((docSnap) => [docSnap.data().code, docSnap.id]));
}

async function loadMatchesBySeedKey(tournamentId) {
  const snap = await db.collection('matches').where('tournament_id', '==', tournamentId).get();
  return new Map(snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return [matchKey(data.stage_code, data.sequence_in_stage, data.group_code), docSnap];
  }));
}

async function commitUpdates(operations) {
  let batch = db.batch();
  let count = 0;

  for (const operation of operations) {
    batch.update(operation.ref, operation.update);
    count += 1;
    if (count >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) await batch.commit();
}

function matchKey(stageCode, sequence, groupCode = null) {
  return stageCode === 'group'
    ? `${stageCode}:${groupCode}:${sequence}`
    : `${stageCode}:${sequence}`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
