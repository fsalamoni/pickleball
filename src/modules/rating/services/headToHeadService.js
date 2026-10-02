/**
 * Coleta os confrontos do atleta para o head-to-head (I/O).
 *
 * Reaproveita os serviços de inscrições e jogos do torneio: encontra as
 * inscrições do atleta, varre os jogos finalizados das suas modalidades e
 * produz um registro por jogo (rótulo do adversário + se o atleta venceu).
 * A agregação é feita pela lógica pura em `domain/headToHead`.
 */

import { listMyRegistrations, listRegistrations } from '@/modules/tournament/services/registrationService';
import { listAllMatchesForModality } from '@/modules/tournament/services/matchService';
import { toMillis } from '@/modules/tournament/domain/participation';

function regLabel(reg) {
  if (!reg) return '';
  return (
    reg.label
    || `${reg.player_a_name || ''}${reg.player_b_name ? ' / ' + reg.player_b_name : ''}`.trim()
  );
}

/**
 * Registros de confronto do atleta: `[{ opponent, won, at }]`.
 * @param {string} uid
 */
export async function getPlayerH2HRecords(uid) {
  if (!uid) return [];
  const myRegs = await listMyRegistrations(uid);
  if (myRegs.length === 0) return [];

  const myRegIds = new Set(myRegs.map((r) => r.id));
  const modalityIds = [...new Set(myRegs.map((r) => r.modality_id).filter(Boolean))];

  const records = [];
  for (const modalityId of modalityIds) {
    // eslint-disable-next-line no-await-in-loop
    const [matches, regs] = await Promise.all([
      listAllMatchesForModality(modalityId),
      listRegistrations(modalityId),
    ]);
    const labelById = new Map(regs.map((r) => [r.id, regLabel(r)]));
    const regPorId = new Map(regs.map((r) => [r.id, r]));
    // As contas (uid) de cada inscrição — a avaliação pós-jogo precisa de QUEM.
    const uidsDe = (ids) => ids.flatMap((id) => {
      const r = regPorId.get(id);
      return r ? [r.player_a_user_id, r.player_b_user_id].filter(Boolean) : [];
    });

    matches.forEach((m) => {
      if (m.winner_side !== 'a' && m.winner_side !== 'b') return;
      const aIds = m.side_a_ids || [];
      const bIds = m.side_b_ids || [];
      const inA = aIds.some((id) => myRegIds.has(id));
      const inB = bIds.some((id) => myRegIds.has(id));
      if (inA === inB) return; // fora do jogo, ou (defensivo) nos dois lados
      const mySide = inA ? 'a' : 'b';
      const oppIds = mySide === 'a' ? bIds : aIds;
      const opponent = oppIds.map((id) => labelById.get(id) || id).join(' / ').trim();
      if (!opponent) return;
      const meusUids = uidsDe((mySide === 'a' ? aIds : bIds));
      records.push({
        opponent,
        won: m.winner_side === mySide,
        at: toMillis(m.result_recorded_at),
        // Aditivo: quem jogou, por conta, e a chave que o servidor confere.
        matchKey: m.id ? `tm:${m.id}` : null,
        partnerUids: meusUids.filter((u) => u !== uid),
        opponentUids: uidsDe(oppIds),
      });
    });
  }
  return records;
}
