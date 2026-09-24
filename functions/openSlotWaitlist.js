/**
 * A fila de espera do jogo aberto — quem chama o próximo é o SERVIDOR.
 *
 * 🐞 Chamar o próximo é escrever na entrada de OUTRA pessoa (`waiting` →
 * `notified`), e o navegador de quem sai ou de quem recusa não pode fazer
 * isso: a regra recusava, o erro morria num `catch`, e a fila só andava
 * quando a tarefa de 10 em 10 minutos expirava alguém. Aqui a promoção roda:
 *
 *  - quando alguém SAI de uma vaga (gatilho na vaga);
 *  - quando alguém RECUSA a chamada, ou ela EXPIRA, ou a entrada chamada é
 *    apagada (gatilho na entrada da fila);
 *  - e na varredura periódica, que expira os prazos vencidos.
 *
 * Numa transação: dois gatilhos quase juntos (a expiração da varredura e o
 * gatilho que ela mesma dispara) não chamam duas pessoas para o mesmo lugar.
 *
 * Lugares livres = total − quem está na vaga − quem já foi chamado e ainda
 * está no prazo. Chama-se quantos couberem, pela ordem da fila.
 */

/** Minutos para aceitar a vaga. O cliente mostra o mesmo número. */
const JANELA_PROMOCAO_MIN = 60;

function ms(t) {
  if (!t) return NaN;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (t instanceof Date) return t.getTime();
  return Number(t);
}

/** A chamada venceu? */
function venceu(entrada, agoraMs) {
  const t = ms(entrada && entrada.notification_expires_at);
  return Number.isFinite(t) && t < agoraMs;
}

/** Quem espera, na ordem da fila (menor posição; empate, quem entrou antes). */
function naOrdemDaFila(entradas) {
  return entradas
    .filter((e) => e && e.status === 'waiting')
    .sort((a, b) => ((Number(a.position) || 0) - (Number(b.position) || 0))
      || ((ms(a.joined_at) || 0) - (ms(b.joined_at) || 0)));
}

/** Quantos lugares dá para oferecer agora. */
function lugaresParaChamar(slot, entradas, agoraMs) {
  if (!slot || !['open', 'full'].includes(slot.status || 'open')) return 0;
  const total = Number(slot.total_spots) || 0;
  const naVaga = Array.isArray(slot.participants) ? slot.participants.length : 0;
  const chamadosNoPrazo = entradas
    .filter((e) => e && e.status === 'notified' && !venceu(e, agoraMs)).length;
  return Math.max(0, total - naVaga - chamadosNoPrazo);
}

/**
 * Chama o(s) próximo(s) da fila de UMA vaga, se houver lugar.
 *
 * @param {{ db: object, Timestamp: object, agoraMs?: number, logger?: object }} ctx
 * @param {string} slotId
 * @returns {Promise<{ promoted: string[] }>} uids chamados
 */
async function promoverProximo(ctx, slotId) {
  const { db, Timestamp } = ctx;
  const agora = Number.isFinite(ctx.agoraMs) ? ctx.agoraMs : Date.now();
  if (!slotId) return { promoted: [] };

  const slotRef = db.collection('arena_open_slots').doc(slotId);
  const filaQuery = db.collection('arena_waitlist').where('slot_id', '==', slotId);

  const resultado = await db.runTransaction(async (tx) => {
    const slotSnap = await tx.get(slotRef);
    const slot = slotSnap.exists ? slotSnap.data() : null;
    const filaSnap = await tx.get(filaQuery);
    const entradas = filaSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));

    const lugares = lugaresParaChamar(slot, entradas, agora);
    if (lugares <= 0) return { slot, chamados: [] };

    const chamados = naOrdemDaFila(entradas).slice(0, lugares);
    chamados.forEach((e) => tx.update(e.ref, {
      status: 'notified',
      notified_at: Timestamp.fromMillis(agora),
      notification_expires_at: Timestamp.fromMillis(agora + JANELA_PROMOCAO_MIN * 60000),
      updated_at: Timestamp.fromMillis(agora),
    }));
    return { slot, chamados };
  });

  // O aviso sai DEPOIS da transação: se ela for repetida (conflito), não
  // manda o mesmo aviso duas vezes.
  const { slot, chamados } = resultado;
  for (const e of chamados) {
    // eslint-disable-next-line no-await-in-loop
    await db.collection('notifications').add({
      user_id: e.athlete_id,
      title: `Vagou um lugar em "${String((slot && slot.arena_name) || '').slice(0, 50)}"`,
      message: `${(slot && slot.date) || ''} ${(slot && slot.start) || ''} — você tem `
        + `${JANELA_PROMOCAO_MIN} minutos para confirmar.`,
      type: 'generic',
      link: slot && slot.arena_id ? `/arenas/${slot.arena_id}/open-match` : '/arenas',
      read: false,
      archived: false,
      created_at: Timestamp.fromMillis(agora),
    });
  }
  if (chamados.length > 0 && ctx.logger) {
    ctx.logger.info('Fila de espera: próximo chamado.', { slotId, chamados: chamados.length });
  }
  return { promoted: chamados.map((e) => e.athlete_id) };
}

/** Alguém SAIU da vaga (ou ela ganhou lugares)? Só aí vale olhar a fila. */
function vagaAbriuLugar(antes, depois) {
  if (!depois) return false;
  const nAntes = Array.isArray(antes && antes.participants) ? antes.participants.length : 0;
  const nDepois = Array.isArray(depois.participants) ? depois.participants.length : 0;
  const totalAntes = Number(antes && antes.total_spots) || 0;
  const totalDepois = Number(depois.total_spots) || 0;
  return nDepois < nAntes || totalDepois > totalAntes;
}

/** Uma chamada deixou de valer (recusada, expirada, apagada)? */
function chamadaLiberouLugar(antes, depois) {
  if (!antes || antes.status !== 'notified') return false;
  if (!depois) return true;
  return depois.status !== 'notified' && depois.status !== 'accepted';
}

module.exports = {
  JANELA_PROMOCAO_MIN,
  venceu,
  naOrdemDaFila,
  lugaresParaChamar,
  promoverProximo,
  vagaAbriuLugar,
  chamadaLiberouLugar,
};
