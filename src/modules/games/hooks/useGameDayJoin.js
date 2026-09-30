/**
 * O painel "Participar" aparece para esta pessoa, neste dia de jogo?
 *
 * Um lugar só para a pergunta, porque ela é feita em DOIS pontos da mesma tela
 * — o painel no alto do dia e o cartão "Minha participação" do Play, que diz
 * "use o Participar" em vez de repetir o botão. Se cada um decidisse do seu
 * jeito, um apontaria para um botão que o outro escondeu.
 *
 * No dia do CLUBE a resposta depende de a pessoa ser do clube — os clubes dela
 * já estão em cache (menu, início); sem a lista em mãos, o painel espera.
 */
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyClubs } from '@/modules/clubs/hooks/useClubs';
import { isClubGameDay } from '../domain/clubGameDay.js';
import { joinPanelApplies } from '../domain/gameDayJoin.js';

export function useJoinPanelApplies(gameDay, { podeConfigurar = false } = {}) {
  const { user } = useAuth();
  const doClube = isClubGameDay(gameDay);
  const clubesQ = useMyClubs({ enabled: doClube });
  const souDoClube = doClube && (clubesQ.data || []).some((c) => c.id === gameDay.club_id);
  return joinPanelApplies(gameDay, { uid: user?.uid || null, podeConfigurar, souDoClube });
}
