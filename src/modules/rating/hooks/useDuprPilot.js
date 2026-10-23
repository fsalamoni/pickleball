import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listPilotMatches, listPilotPlayers, pilotAction } from '@/modules/rating/services/duprOfficial';

const PLAYERS = ['dupr', 'pilot', 'players'];
const MATCHES = ['dupr', 'pilot', 'matches'];

/** Jogadores do piloto do DUPR (só o admin lê). */
export function usePilotPlayers() {
  return useQuery({ queryKey: PLAYERS, queryFn: listPilotPlayers });
}

/** Partidas de teste enviadas ao DUPR pelo piloto. */
export function usePilotMatches() {
  return useQuery({ queryKey: MATCHES, queryFn: listPilotMatches });
}

/** O endereço do login do DUPR (SSO), pedido só quando o admin vai autorizar uma conta. */
export function usePilotSsoConfig({ enabled = true } = {}) {
  return useQuery({ queryKey: ['dupr', 'pilot', 'sso'], queryFn: () => pilotAction('sso_config', {}), enabled, staleTime: 10 * 60_000 });
}

/** Uma ação do piloto no servidor (`player_save`, `match_send`…); recarrega as duas listas. */
export function usePilotAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ acao, ...payload }) => pilotAction(acao, payload),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: PLAYERS });
      qc.invalidateQueries({ queryKey: MATCHES });
    },
  });
}
