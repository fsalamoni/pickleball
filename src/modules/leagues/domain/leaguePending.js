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

const ORDEM_STATUS = { running: 0, open: 1 };

/**
 * As linhas do card "Ligas" do início: as minhas ligas em andamento ou com
 * inscrição aberta (até `max`), primeiro as que esperam a minha confirmação,
 * depois as em andamento. `undefined` = a lista não carregou.
 *
 * @returns {Array<{ id: string, name: string, status: string, pending: number, startDate: string|null }> | undefined}
 */
export function homeLeagueRows(leagues, uid, max = 3) {
  if (!Array.isArray(leagues)) return undefined;
  return leagues
    .filter((l) => l?.status in ORDEM_STATUS)
    .map((l) => ({
      id: l.id,
      name: l.name || '',
      status: l.status,
      pending: l.status === 'running' ? Number(l.pending_confirm?.[uid]) || 0 : 0,
      startDate: l.season?.start_date || null,
    }))
    .sort((a, b) => (b.pending > 0) - (a.pending > 0)
      || ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status]
      || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, max);
}
