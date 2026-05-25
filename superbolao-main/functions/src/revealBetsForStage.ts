/**
 * Cloud Function agendada: a cada 15 minutos, identifica fases cujo
 * `bet_lock_at` acabou de passar e ainda não foram processadas, e:
 *   - flipa todas as bets dessa fase para `revealed: true`
 *   - gera `pool_stage_aggregates` (distribuição de placares palpitados)
 *
 * Mecanismo de sigilo: ANTES dessa função rodar para uma fase, ninguém —
 * nem mesmo Admin Geral — consegue ler `bets.predicted_home/away` (Security
 * Rules barram). DEPOIS, participantes do bolão e admins podem ver.
 */
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { FieldValue } from 'firebase-admin/firestore';
import { getAppFirestore } from './firestore';

export const revealBetsForStage = onMessagePublished(
  {
    topic: 'revealBetsForStage',
    region: 'southamerica-east1',
    retry: true,
    serviceAccount: 'firebase-adminsdk-fbsvc@hocapp-44760.iam.gserviceaccount.com'
  },
  async (event) => {
    const db = getAppFirestore();
    const now = new Date();

    // Fases não-reveladas e cujo deadline passou
    const stagesSnap = await db.collection('stages').where('bet_lock_at', '<=', now).get();

    for (const stage of stagesSnap.docs) {
      const stageData = stage.data() as any;
      if (stageData.bets_revealed_at) continue; // já processada

      const stageId = stage.id;

      // Matches da fase
      const matchesSnap = await db.collection('matches').where('stage_id', '==', stageId).get();
      const matchIds = matchesSnap.docs.map((d) => d.id);
      if (!matchIds.length) {
        await stage.ref.update({ bets_revealed_at: FieldValue.serverTimestamp() });
        continue;
      }

      // Bets de todos os matches dessa fase, em chunks de 30 (limit do `in`)
      const allBets: { id: string; data: any }[] = [];
      for (let i = 0; i < matchIds.length; i += 30) {
        const chunk = matchIds.slice(i, i + 30);
        const snap = await db.collection('bets').where('match_id', 'in', chunk).get();
        snap.docs.forEach((d) => allBets.push({ id: d.id, data: d.data() }));
      }

      // Reveals em lotes de 400 (limite do batch é 500 ops)
      for (let i = 0; i < allBets.length; i += 400) {
        const batch = db.batch();
        for (const b of allBets.slice(i, i + 400)) {
          if (!b.data.revealed) {
            batch.update(db.collection('bets').doc(b.id), {
              revealed: true,
              updated_at: FieldValue.serverTimestamp(),
            });
          }
        }
        await batch.commit();
      }

      // Aggregates por pool: distribuição de placares palpitados nesta fase
      const byPool: Record<string, { total: number; distribution: Record<string, number>; goals_sum: number }> = {};
      for (const b of allBets) {
        const p = b.data.pool_id;
        const key = `${b.data.predicted_home}-${b.data.predicted_away}`;
        const agg = (byPool[p] ||= { total: 0, distribution: {}, goals_sum: 0 });
        agg.total += 1;
        agg.distribution[key] = (agg.distribution[key] || 0) + 1;
        agg.goals_sum += (b.data.predicted_home || 0) + (b.data.predicted_away || 0);
      }
      const aggBatch = db.batch();
      for (const [poolId, agg] of Object.entries(byPool)) {
        const ref = db.collection('pool_stage_aggregates').doc(`${poolId}_${stageId}`);
        aggBatch.set(ref, {
          pool_id: poolId,
          stage_id: stageId,
          total_bets: agg.total,
          score_distribution: agg.distribution,
          avg_predicted_goals: agg.total ? agg.goals_sum / agg.total : 0,
          computed_at: FieldValue.serverTimestamp(),
        });
      }
      await aggBatch.commit();

      await stage.ref.update({ bets_revealed_at: FieldValue.serverTimestamp() });
      console.log(`Revealed ${allBets.length} bets for stage ${stageData.label || stageId}.`);
    }
  }
);