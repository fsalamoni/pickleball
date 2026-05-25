/**
 * Seed do torneio executado direto pelo cliente via Firestore SDK,
 * autenticado como platform_admin. Usado pela tela /admin/seed
 * sem depender da Cloud Function `seedTournament`.
 *
 * As regras (`firestore.rules`) liberam escrita nas coleções estáticas
 * do torneio apenas quando `isPlatformAdmin()`.
 */
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { SEED_TEAMS, SEED_GROUPS } from '@/modules/tournament/data/seedTeams';
import { SEED_SCORING_TIERS } from '@/modules/tournament/data/seedScoringTiers';
import {
  SEED_DEADLINES_BRT,
  TOURNAMENT_START_BRT,
  TOURNAMENT_END_BRT,
} from '@/modules/tournament/data/seedDeadlines';
import { SEED_MATCHES } from '@/modules/tournament/data/seedMatches';

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

const STATIC_COLLECTIONS = [
  'matches',
  'stages',
  'team_in_group',
  'teams',
  'groups',
  'scoring_tiers',
  'tournaments',
];

const FIRESTORE_BATCH_LIMIT = 450;

async function commitInChunks(operations) {
  let batch = writeBatch(db);
  let count = 0;
  for (const op of operations) {
    op(batch);
    count += 1;
    if (count >= FIRESTORE_BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
}

async function purgeStaticCollections(onProgress) {
  for (const col of STATIC_COLLECTIONS) {
    const snap = await getDocs(query(collection(db, col)));
    if (snap.empty) continue;
    onProgress?.(`Limpando ${col} (${snap.size} docs)…`);
    const ops = snap.docs.map((d) => (batch) => batch.delete(d.ref));
    await commitInChunks(ops);
  }
}

export async function runClientSeed({ onProgress } = {}) {
  onProgress?.('Limpando coleções estáticas existentes…');
  await purgeStaticCollections(onProgress);

  onProgress?.('Preparando documentos…');

  const tournamentRef = doc(collection(db, 'tournaments'));
  const groupRefByCode = {};
  const teamRefByCode = {};
  const stageRefByCode = {};
  const tierIdByStage = {};

  const ops = [];

  ops.push((batch) =>
    batch.set(tournamentRef, {
      name: 'Copa do Mundo FIFA 2026',
      starts_at: Timestamp.fromDate(new Date(TOURNAMENT_START_BRT)),
      ends_at: Timestamp.fromDate(new Date(TOURNAMENT_END_BRT)),
      status: 'scheduled',
      created_at: serverTimestamp(),
    }),
  );

  for (const g of SEED_GROUPS) {
    const ref = doc(collection(db, 'groups'));
    groupRefByCode[g.code] = ref;
    ops.push((batch) =>
      batch.set(ref, { tournament_id: tournamentRef.id, code: g.code }),
    );
  }

  for (const t of SEED_TEAMS) {
    const teamRef = doc(collection(db, 'teams'));
    teamRefByCode[t.code] = teamRef;
    ops.push((batch) => batch.set(teamRef, { code: t.code, name: t.name }));

    const tigRef = doc(collection(db, 'team_in_group'));
    ops.push((batch) =>
      batch.set(tigRef, {
        team_id: teamRef.id,
        group_id: groupRefByCode[t.group_code]?.id || null,
        group_code: t.group_code,
      }),
    );
  }

  for (const tier of SEED_SCORING_TIERS) {
    const ref = doc(collection(db, 'scoring_tiers'));
    tierIdByStage[tier.stage_code] = ref.id;
    ops.push((batch) => batch.set(ref, tier));
  }

  for (let i = 0; i < STAGE_ORDER.length; i += 1) {
    const code = STAGE_ORDER[i];
    const ref = doc(collection(db, 'stages'));
    stageRefByCode[code] = ref;
    ops.push((batch) =>
      batch.set(ref, {
        tournament_id: tournamentRef.id,
        code,
        label: STAGE_LABELS[code],
        sort_order: i,
        bet_lock_at: Timestamp.fromDate(new Date(SEED_DEADLINES_BRT[code])),
        scoring_tier_id: tierIdByStage[code] || null,
      }),
    );
  }

  for (const m of SEED_MATCHES) {
    const ref = doc(collection(db, 'matches'));
    const stageRef = stageRefByCode[m.stage_code];
    ops.push((batch) =>
      batch.set(ref, {
        tournament_id: tournamentRef.id,
        stage_id: stageRef?.id || null,
        stage_code: m.stage_code,
        group_id: m.group_code ? groupRefByCode[m.group_code]?.id || null : null,
        group_code: m.group_code || null,
        sequence_in_stage: m.sequence,
        home_team_id: m.home ? teamRefByCode[m.home]?.id || null : null,
        away_team_id: m.away ? teamRefByCode[m.away]?.id || null : null,
        home_placeholder: m.home_placeholder || null,
        away_placeholder: m.away_placeholder || null,
        kickoff_at: Timestamp.fromDate(new Date(m.kickoff)),
        bet_lock_at: Timestamp.fromDate(new Date(SEED_DEADLINES_BRT[m.stage_code])),
        zebra_team_id: m.zebra ? teamRefByCode[m.zebra]?.id || null : null,
        zebra_multiplier: m.zebra_mult ?? null,
        official_home_score: null,
        official_away_score: null,
        official_home_penalties: null,
        official_away_penalties: null,
        penalty_winner_team_id: null,
        status: 'scheduled',
      }),
    );
  }

  onProgress?.(`Gravando ${ops.length} documentos no Firestore…`);
  await commitInChunks(ops);

  return {
    tournament_id: tournamentRef.id,
    teams: SEED_TEAMS.length,
    groups: SEED_GROUPS.length,
    matches: SEED_MATCHES.length,
    stages: STAGE_ORDER.length,
  };
}
