/**
 * xpGrants — o XP que o SERVIDOR concede.
 *
 * O XP do atleta é DERIVADO (ver `xpTotal.js`): nunca um saldo que alguém
 * incrementa. Mas parte do XP não nasce de um fato que o navegador consiga
 * observar — o prêmio de fechar a temporada, o duelo ganho, a posição num
 * desafio. Isso o navegador nem deveria poder dizer: quem decide é o servidor.
 *
 * Por isso existe `user_xp_grants/{id}`: documentos escritos SÓ pelo servidor
 * (a regra recusa o cliente, inclusive o admin), com id determinístico
 * (`{uid}_{tipo}_{referência}`) — conceder duas vezes o mesmo prêmio é gravar o
 * mesmo documento. O XP total soma os documentos; recalcular do zero dá o mesmo
 * número, como nas outras parcelas.
 *
 * Lógica pura, sem I/O.
 */

/** Os tipos de concessão. O id é contrato (está no id do documento). */
export const XP_GRANT_KIND = Object.freeze({
  SEASON: 'season',
  DUEL: 'duel',
  CHALLENGE: 'challenge',
  EVENT: 'event',
  ADMIN: 'admin',
});

export const XP_GRANT_KIND_LABEL = Object.freeze({
  season: 'Prêmio de temporada',
  duel: 'Duelo da semana',
  challenge: 'Desafio',
  event: 'Evento',
  admin: 'Bônus da plataforma',
});

/** Teto por concessão — o servidor também respeita; defesa em profundidade. */
export const MAX_GRANT_XP = 5000;

/** Id determinístico do documento. */
export function grantId(uid, kind, ref) {
  return `${uid}_${kind}_${String(ref).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 80)}`;
}

/** A concessão é válida para contar? */
export function isValidGrant(g, uid) {
  if (!g || typeof g !== 'object') return false;
  if (uid && g.uid !== uid) return false;
  if (!Object.prototype.hasOwnProperty.call(XP_GRANT_KIND_LABEL, g.kind)) return false;
  const xp = Number(g.xp);
  return Number.isFinite(xp) && xp > 0 && xp <= MAX_GRANT_XP;
}

/**
 * Soma as concessões válidas, uma vez por id, e devolve o detalhamento por
 * tipo — a tela explica de onde veio cada pedaço do número.
 *
 * @param {Array<{ id?: string, uid?: string, kind: string, xp: number }>} docs
 * @param {string} [uid] quando informado, ignora documento de outro uid
 * @returns {{ total: number, byKind: Record<string, number>, count: number }}
 */
export function sumGrants(docs, uid) {
  const byKind = {};
  let total = 0;
  let count = 0;
  const vistos = new Set();
  (Array.isArray(docs) ? docs : []).forEach((g) => {
    if (!isValidGrant(g, uid)) return;
    const chave = g.id || `${g.uid}_${g.kind}_${g.refId || ''}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    const xp = Math.round(Number(g.xp));
    total += xp;
    count += 1;
    byKind[g.kind] = (byKind[g.kind] || 0) + xp;
  });
  return { total, byKind, count };
}
