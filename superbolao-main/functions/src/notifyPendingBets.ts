/**
 * Função agendada que roda 1x/dia. Para cada fase cujo deadline está
 * a menos de 24h e que ainda não foi encerrada, identifica usuários
 * de cada bolão sem palpite completo e cria uma notificação.
 */
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { FieldValue } from 'firebase-admin/firestore';
import { getAppFirestore } from './firestore';

export const notifyPendingBets = onMessagePublished(
  {
    topic: 'notifyPendingBets',
    region: 'southamerica-east1',
    serviceAccount: 'firebase-adminsdk-fbsvc@hocapp-44760.iam.gserviceaccount.com'
  },
  async (event) => {
    const db = getAppFirestore();
    const now = Date.now();
    const in24h = new Date(now + 24 * 60 * 60 * 1000);
    const nowDate = new Date(now);

    const stagesSnap = await db
      .collection('stages')
      .where('bet_lock_at', '>', nowDate)
      .where('bet_lock_at', '<=', in24h)
      .get();

    for (const stage of stagesSnap.docs) {
      const s = stage.data() as any;

      // Matches dessa fase
      const matches = await db.collection('matches').where('stage_id', '==', stage.id).get();
      const matchIds = matches.docs.map((d) => d.id);

      // Para cada bolão ativo
      const pools = await db.collection('pools').get();
      for (const pool of pools.docs) {
        const memSnap = await db
          .collection('pool_memberships')
          .where('pool_id', '==', pool.id)
          .get();

        for (const mem of memSnap.docs) {
          const userId = (mem.data() as any).user_id;
          // checa quantos palpites tem nessa fase
          let count = 0;
          for (let i = 0; i < matchIds.length; i += 30) {
            const chunk = matchIds.slice(i, i + 30);
            const bets = await db
              .collection('bets')
              .where('user_id', '==', userId)
              .where('pool_id', '==', pool.id)
              .where('match_id', 'in', chunk)
              .get();
            count += bets.size;
          }
          const missing = matchIds.length - count;
          if (missing <= 0) continue;

          await db.collection('notifications').add({
            user_id: userId,
            title: `Palpites pendentes — ${s.label}`,
            message: `Faltam ${missing} palpite(s) para "${s.label}" no bolão "${(pool.data() as any).name}". Prazo final: ${new Date(s.bet_lock_at._seconds * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
            link: `/boloes/${pool.id}/cartao`,
            read: false,
            created_at: FieldValue.serverTimestamp(),
          });
        }
      }
    }
    console.log('notifyPendingBets done.');
  }
);