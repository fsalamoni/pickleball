/**
 * Cloud Function callable que popula as coleções estáticas do torneio
 * (tournaments, stages, groups, teams, team_in_group, scoring_tiers, matches).
 *
 * Recebe um payload contendo a estrutura completa exportada do front
 * (src/data/seed*.js). Apenas Admin Geral pode executar.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { assertPlatformAdmin } from './auth';
import { FUNCTION_SERVICE_ACCOUNT } from './runtimeOptions';
import { getAppFirestore } from './firestore';

interface SeedPayload {
  tournament: {
    name: string;
    starts_at: string; // ISO
    ends_at: string;
  };
  groups: { code: string }[];
  teams: { code: string; name: string; group_code: string }[];
  scoring_tiers: {
    stage_code: string;
    label: string;
    exact_score: number;
    winner_plus_diff: number;
    winner_plus_team_goals: number;
    winner_only: number;
    team_goals_only: number;
    penalty_winner: number;
  }[];
  stages: { code: string; label: string; sort_order: number; bet_lock_at: string }[];
  matches: {
    stage_code: string;
    group_code?: string;
    sequence: number;
    home_team_code?: string;
    away_team_code?: string;
    home_placeholder?: string;
    away_placeholder?: string;
    kickoff_at: string;
    zebra_team_code?: string;
    zebra_multiplier?: 2 | 3 | 4;
  }[];
}

export const seedTournament = onCall<SeedPayload, Promise<{ ok: true; tournamentId: string }>>(
  { region: 'southamerica-east1', serviceAccount: FUNCTION_SERVICE_ACCOUNT },
  async (req) => {
    await assertPlatformAdmin(req.auth?.uid);
    const data = req.data;
    if (!data?.tournament || !data.matches?.length) {
      throw new HttpsError('invalid-argument', 'Payload inválido.');
    }
    const db = getAppFirestore();
    const batch = db.batch();

    // tournament
    const tournamentRef = db.collection('tournaments').doc();
    batch.set(tournamentRef, {
      name: data.tournament.name,
      starts_at: new Date(data.tournament.starts_at),
      ends_at: new Date(data.tournament.ends_at),
      status: 'scheduled',
      created_at: FieldValue.serverTimestamp(),
    });

    // groups
    const groupRefByCode: Record<string, FirebaseFirestore.DocumentReference> = {};
    for (const g of data.groups) {
      const ref = db.collection('groups').doc();
      groupRefByCode[g.code] = ref;
      batch.set(ref, { tournament_id: tournamentRef.id, code: g.code });
    }

    // teams + team_in_group
    const teamRefByCode: Record<string, FirebaseFirestore.DocumentReference> = {};
    for (const t of data.teams) {
      const ref = db.collection('teams').doc();
      teamRefByCode[t.code] = ref;
      batch.set(ref, { code: t.code, name: t.name });
      const tigRef = db.collection('team_in_group').doc();
      batch.set(tigRef, {
        team_id: ref.id,
        group_id: groupRefByCode[t.group_code]?.id || null,
        group_code: t.group_code,
      });
    }

    // scoring tiers
    const tierIdByStage: Record<string, string> = {};
    for (const t of data.scoring_tiers) {
      const ref = db.collection('scoring_tiers').doc();
      tierIdByStage[t.stage_code] = ref.id;
      batch.set(ref, t);
    }

    // stages
    const stageRefByCode: Record<string, FirebaseFirestore.DocumentReference> = {};
    for (const s of data.stages) {
      const ref = db.collection('stages').doc();
      stageRefByCode[s.code] = ref;
      batch.set(ref, {
        tournament_id: tournamentRef.id,
        code: s.code,
        label: s.label,
        sort_order: s.sort_order,
        bet_lock_at: new Date(s.bet_lock_at),
        scoring_tier_id: tierIdByStage[s.code] || null,
      });
    }

    // matches
    for (const m of data.matches) {
      const ref = db.collection('matches').doc();
      const stage = stageRefByCode[m.stage_code];
      batch.set(ref, {
        tournament_id: tournamentRef.id,
        stage_id: stage?.id || null,
        stage_code: m.stage_code,
        group_id: m.group_code ? groupRefByCode[m.group_code]?.id || null : null,
        group_code: m.group_code || null,
        sequence_in_stage: m.sequence,
        home_team_id: m.home_team_code ? teamRefByCode[m.home_team_code]?.id || null : null,
        away_team_id: m.away_team_code ? teamRefByCode[m.away_team_code]?.id || null : null,
        home_placeholder: m.home_placeholder || null,
        away_placeholder: m.away_placeholder || null,
        kickoff_at: new Date(m.kickoff_at),
        bet_lock_at: new Date(data.stages.find((s) => s.code === m.stage_code)!.bet_lock_at),
        zebra_team_id: m.zebra_team_code ? teamRefByCode[m.zebra_team_code]?.id || null : null,
        zebra_multiplier: m.zebra_multiplier ?? null,
        official_home_score: null,
        official_away_score: null,
        official_home_penalties: null,
        official_away_penalties: null,
        penalty_winner_team_id: null,
        status: 'scheduled',
      });
    }

    await batch.commit();
    return { ok: true, tournamentId: tournamentRef.id };
  },
);
