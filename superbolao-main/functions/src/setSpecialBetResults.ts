/**
 * Callable de admin para registrar Campeão e Artilheiro do torneio.
 * Após registrar:
 *   - Marca tournament.champion_team_id e top_scorer_player_name
 *   - Para cada special_bet, calcula pontos e atualiza pool_memberships
 *   - Flipa special_bets.revealed = true
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { assertPlatformAdmin } from './auth';
import { FUNCTION_SERVICE_ACCOUNT } from './runtimeOptions';
import { getAppFirestore } from './firestore';

interface Payload {
  tournament_id: string;
  champion_team_id: string;
  top_scorer_player_name: string;
}

const POINTS = { champion: 300, top_scorer: 150 };

function normalize(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export const setSpecialBetResults = onCall<Payload>(
  { region: 'southamerica-east1', serviceAccount: FUNCTION_SERVICE_ACCOUNT },
  async (req) => {
    await assertPlatformAdmin(req.auth?.uid);
    const { tournament_id, champion_team_id, top_scorer_player_name } = req.data;
    if (!tournament_id || !champion_team_id || !top_scorer_player_name) {
      throw new HttpsError('invalid-argument', 'Payload inválido.');
    }
    const db = getAppFirestore();

    await db.collection('tournaments').doc(tournament_id).update({
      champion_team_id,
      top_scorer_player_name,
      finalized_at: FieldValue.serverTimestamp(),
    });

    const specialBets = await db.collection('special_bets').get();
    const targetTopScorer = normalize(top_scorer_player_name);

    const batches: FirebaseFirestore.WriteBatch[] = [db.batch()];
    let opCount = 0;
    const newBatch = () => {
      batches.push(db.batch());
      opCount = 0;
    };
    const currentBatch = () => batches[batches.length - 1];

    for (const sb of specialBets.docs) {
      const data = sb.data() as any;
      let points = 0;
      let isSuperBucha = false;
      let hit = false;

      if (data.type === 'champion') {
        hit = data.team_id === champion_team_id;
        isSuperBucha = hit;
      } else if (data.type === 'top_scorer') {
        hit = normalize(data.player_name) === targetTopScorer;
      }

      if (hit) {
        const poolSnap = await db.collection('pools').doc(data.pool_id).get();
        const specialPoints = poolSnap.data()?.settings?.special_bet_points || POINTS;
        points =
          data.type === 'champion'
            ? Number(specialPoints.champion) || POINTS.champion
            : Number(specialPoints.top_scorer) || POINTS.top_scorer;
      }

      // grava pontos no special_bet (e flag revealed)
      currentBatch().update(sb.ref, {
        revealed: true,
        hit,
        points,
        is_super_bucha: isSuperBucha,
        updated_at: FieldValue.serverTimestamp(),
      });
      opCount++;

      // incrementa membership
      if (points || isSuperBucha) {
        const memId = `${data.user_id}_${data.pool_id}`;
        currentBatch().update(db.collection('pool_memberships').doc(memId), {
          points: FieldValue.increment(points),
          super_buchas: isSuperBucha ? FieldValue.increment(1) : FieldValue.increment(0),
          updated_at: FieldValue.serverTimestamp(),
        });
        opCount++;
      }
      if (opCount >= 400) newBatch();
    }

    for (const b of batches) await b.commit();
    return { ok: true, processed: specialBets.size };
  },
);
