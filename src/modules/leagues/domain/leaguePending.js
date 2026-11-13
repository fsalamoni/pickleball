/**
 * O que a liga espera de MIM: os placares da liga flexível que o outro lado
 * lançou e eu tenho de confirmar ou contestar. A conta é do servidor
 * (`leagues.pending_confirm`, refeito a cada lançamento, confirmação e
 * correção); aqui só se soma. `undefined` = a lista não carregou (nunca zero).
 *
 * @returns {{ count: number, leagueId: string|null } | undefined}
 */
export function myLeaguePending(leagues, uid) {
  if (!Array.isArray(leagues) || !uid) return undefined;
  const comPendencia = leagues
    .filter((l) => l?.status === 'running')
    .map((l) => ({ id: l.id, n: Number(l.pending_confirm?.[uid]) || 0 }))
    .filter((l) => l.n > 0);
  return {
    count: comPendencia.reduce((s, l) => s + l.n, 0),
    leagueId: comPendencia.length === 1 ? comPendencia[0].id : null,
  };
}
