/**
 * "Jogar" na tela inicial — para quem procura jogo, parceria ou quer montar o
 * próprio dia de jogo.
 *
 * Duas vitrines que antes só existiam em telas separadas:
 *  - os convites e dias de jogo PÚBLICOS dos atletas ("procura-se jogo"),
 *    perto da pessoa primeiro;
 *  - os jogos com vaga que as ARENAS publicaram (com a chave dos módulos de
 *    arena, e só de arena que mantém o jogo aberto ligado).
 *
 * Só o que ainda vale: data de hoje em diante, com vaga, sem os convites que a
 * própria pessoa publicou.
 */
import React, { useMemo } from 'react';
import {
  Building2, Dices, Megaphone, Plus, Swords, Users,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useOpenGames } from '@/modules/games/hooks/useOpenGames';
import { useGlobalOpenSlots } from '@/modules/arenas/hooks/useArenaV3';
import { useModuleOnInArenas } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { openSlotsForDiscovery } from '@/modules/arenas/domain/openMatchView';
import { getAvailableSpots } from '@/modules/arenas/domain/openMatch';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { openGamesForMe } from '@/modules/home/domain/homePlay';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { HomeAction, HomeEmpty, HomeRow, HomeSection } from './HomeSection';

export default function HomePlaySection({ reason, hoje, perfil, arenaModulesOn = false }) {
  const { user } = useAuth();
  const convites = useOpenGames();
  const vagasQ = useGlobalOpenSlots({ limit: 100 }, { enabled: arenaModulesOn });
  const arenaIds = useMemo(() => (vagasQ.data || []).map((s) => s.arena_id), [vagasQ.data]);
  const { isOnIn, isLoading: modulosCarregando } = useModuleOnInArenas(
    arenaModulesOn ? arenaIds : [], ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH,
  );

  const lista = useMemo(
    () => openGamesForMe(convites.data || [], { hoje, perfil, uid: user?.uid, limite: 3 }),
    [convites.data, hoje, perfil, user?.uid],
  );
  const vagas = arenaModulesOn && !modulosCarregando
    ? openSlotsForDiscovery(vagasQ.data || [], isOnIn)
      .filter((s) => !(s.participants || []).includes(user?.uid))
      .slice(0, 3)
    : [];

  const carregando = convites.isLoading || (arenaModulesOn && (vagasQ.isLoading || modulosCarregando));
  const falhouConvites = convites.isError;
  const falhouVagas = arenaModulesOn && vagasQ.isError;
  const nada = !carregando && !falhouConvites && !falhouVagas && lista.length === 0 && vagas.length === 0;

  return (
    <HomeSection id="jogar" icon={Swords} title="Jogar" reason={reason} action={{ to: '/procura-jogo', label: 'Procura-se jogo' }}>
      <div className="space-y-4">
        {falhouConvites && (
          <V2ErrorState inline title="Não carregou os jogos com vaga" description="Pode haver jogo esperando gente." onRetry={convites.refetch} />
        )}
        {falhouVagas && (
          <V2ErrorState inline title="Não carregou os jogos das arenas" description="Tente de novo em instantes." onRetry={vagasQ.refetch} />
        )}
        {carregando ? (
          <V2Skeleton lines={3} />
        ) : nada ? (
          <HomeEmpty icon={Dices} actions={<HomeAction to="/dia-de-jogo?criar=1" primary><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Criar dia de jogo</HomeAction>}>
            Nenhum jogo com vaga agora. Monte o seu — público, ele aparece para quem procura jogo.
          </HomeEmpty>
        ) : (
          <>
            {lista.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">Procura-se jogo</p>
                <ul className="space-y-1">
                  {lista.map(({ game: g, perto }) => (
                    <li key={g.id}>
                      <HomeRow
                        to={g.game_day_id ? `/dia-de-jogo/${g.game_day_id}` : '/procura-jogo'}
                        icon={g.kind === 'game_day' ? Dices : Megaphone}
                        title={g.when_text || (g.date ? formatDateShortBR(g.date, { hoje }) : 'Jogo')}
                        subtitle={[g.creator_name, [g.city, g.state].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')}
                        badge={perto === 2 ? 'Na sua cidade' : perto === 1 ? 'No seu estado' : null}
                        badgeTone="acid"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {vagas.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">Jogos abertos nas arenas</p>
                <ul className="space-y-1">
                  {vagas.map((s) => {
                    const livres = getAvailableSpots(s);
                    return (
                      <li key={s.id}>
                        <HomeRow
                          to={s.game_day_id ? `/dia-de-jogo/${s.game_day_id}` : `/arenas/${s.arena_id}#arena-jogos-abertos`}
                          icon={Building2}
                          title={`${formatDateShortBR(s.date, { hoje })}${s.start ? ` · ${s.start}` : ''} · ${s.arena_name || 'Arena'}`}
                          subtitle={s.court || s.format || ''}
                          badge={`${livres} ${livres === 1 ? 'vaga' : 'vagas'}`}
                          badgeTone="green"
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
        <div className="flex flex-wrap gap-2">
          {!nada && (
            <HomeAction to="/dia-de-jogo?criar=1"><Dices className="h-3.5 w-3.5" aria-hidden="true" /> Criar dia de jogo</HomeAction>
          )}
          <HomeAction to="/encontrar-jogadores"><Users className="h-3.5 w-3.5" aria-hidden="true" /> Encontrar jogadores</HomeAction>
        </div>
      </div>
    </HomeSection>
  );
}
