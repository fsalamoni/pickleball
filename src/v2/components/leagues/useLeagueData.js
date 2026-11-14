/**
 * O que a página da liga e a página de gestão leem: a liga, as divisões, as
 * inscrições, os jogos e se quem está vendo gere a liga. As duas telas usam
 * as MESMAS chaves de consulta, então ir de uma à outra não busca de novo.
 */
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyClubs } from '@/modules/clubs/hooks/useClubs';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useMyFederationRoles } from '@/modules/federations/hooks/useFederations';
import { useLeague, useLeagueDivisions, useLeagueEntries, useLeagueMatches } from '@/modules/leagues/hooks/useLeagues';
import { canManageLeague } from '@/modules/leagues/domain/leagueAccess';

export function useLeagueData(leagueId) {
  const { user, isPlatformAdmin } = useAuth();
  const liga = useLeague(leagueId);
  const divisoes = useLeagueDivisions(leagueId);
  const inscricoes = useLeagueEntries(leagueId);
  const jogos = useLeagueMatches(leagueId);
  const tipo = liga.data?.organizer?.type;
  const clubs = useMyClubs({ enabled: tipo === 'club' });
  const arenas = useMyManagedArenas();
  const papeis = useMyFederationRoles({ enabled: tipo === 'federation' });

  const gere = canManageLeague(liga.data, {
    uid: user?.uid, isPlatformAdmin, clubs: clubs.data, arenas: arenas.data, federationRoles: papeis.data,
  });
  // Enquanto clube, arena ou federação carregam, "não gere" ainda não é resposta.
  const acessoCarregando = clubs.isLoading || papeis.isLoading || (tipo === 'arena' && arenas.isLoading);
  return { liga, divisoes, inscricoes, jogos, gere, acessoCarregando };
}
