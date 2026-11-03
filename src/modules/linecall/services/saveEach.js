/**
 * Grava vários itens, uma escrita por item, 8 de cada vez: cada um confere a
 * regra sozinho, e o que falhar não derruba os outros. Nenhum gravou ⇒ a
 * primeira falha sobe (quem chamou mostra o erro); parte ⇒ a conta.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => Promise<unknown>} save
 * @returns {Promise<{ ok: number, failed: number }>}
 */
export async function saveEach(items, save) {
  let ok = 0;
  let failed = 0;
  let first = null;
  // ponytail: 8 de cada vez; basta para dezenas de quadras, sem enfileirar cem requisições.
  for (let i = 0; i < items.length; i += 8) {
    const r = await Promise.allSettled(items.slice(i, i + 8).map(save));
    r.forEach((x) => {
      if (x.status === 'fulfilled') ok += 1;
      else { failed += 1; first = first || x.reason; }
    });
  }
  if (!ok && first) throw first;
  return { ok, failed };
}
