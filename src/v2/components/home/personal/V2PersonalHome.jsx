/**
 * A TELA INICIAL PERSONALIZADA (flag `personalized_home`).
 *
 * Montada para cada pessoa, a partir de duas fontes (`resolveHomeFoci`):
 *  - o que ela DISSE que quer (os interesses do perfil — e o botão
 *    Personalizar, que muda isso ali mesmo);
 *  - o que ela FAZ (gere arena, dá aula, organiza torneio, tem reserva, é de
 *    clube), lido dos dados.
 *
 * A ordem da tela:
 *  1. o topo — o dia em uma frase, e o que a tela está mostrando;
 *  2. o que tem PRAZO (a chamada da fila do jogo aberto);
 *  3. os destaques (promoções e campanhas da região);
 *  4. os atalhos — cada um direto aonde a pessoa vai;
 *  5. a agenda (todos os compromissos) e as seções das frentes, na ordem da
 *     importância para ESTA pessoa.
 *
 * Regras que valem para a tela inteira:
 *  - nada vencido: torneio encerrado, prazo passado, dia de jogo de ontem —
 *    a régua é `freshness.js`;
 *  - falha não é vazio: cada seção separa "não carregou" (com Tentar de novo)
 *    de "não há" (com o próximo passo);
 *  - seção de interesse sem conteúdo DIZ que não há e oferece o caminho;
 *    vitrine sem conteúdo (destaques) some;
 *  - cada seção é isolada: um defeito numa delas não derruba as outras.
 *
 * Só leitura. Nenhuma coleção, campo ou regra nova.
 */
import React, { Suspense, lazy, useMemo } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useRelogio } from '@/core/lib/useRelogio';
import { useMyArenaSummary } from '@/modules/arenas/hooks/useMyArenaSummary';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';
import { useMyTournaments } from '@/modules/tournament/hooks/useTournament';
import { useMyClubs } from '@/modules/clubs/hooks/useClubs';
import { useHomeAgenda } from '@/modules/home/hooks/useHomeAgenda';
import { hojeLocal } from '@/modules/home/domain/freshness';
import {
  HOME_SECTION, focusReasonText, homeSectionsFor, resolveHomeFoci,
} from '@/modules/home/domain/homeProfile';
import { homeShortcuts } from '@/modules/home/domain/homeShortcuts';
import { managedTournamentsForHome, myCurrentTournaments } from '@/modules/home/domain/homeTournaments';
import HomeWaitlistCalls from '@/v2/components/arenas/openMatch/HomeWaitlistCalls';
import { EvolutionStrip } from '@/v2/components/home/V2ActionHome';
import HomeHero from './HomeHero';
import HomeShortcuts from './HomeShortcuts';
import { HomeSectionBoundary } from './HomeSection';
import HomeAgendaSection from './HomeAgendaSection';
import HomeTournamentsSection from './HomeTournamentsSection';
import HomeLastResultSection from './HomeLastResultSection';
import HomeRankingSection from './HomeRankingSection';
import HomeOrganizerSection from './HomeOrganizerSection';
import HomePlaySection from './HomePlaySection';
import HomeBookingSection from './HomeBookingSection';
import HomeArenaSection from './HomeArenaSection';
import HomeCoachSection from './HomeCoachSection';
import HomeLessonsSection from './HomeLessonsSection';
import HomeClubsSection from './HomeClubsSection';
import HomeCommunitySection from './HomeCommunitySection';

// Sob demanda: só com a chave-mestra dos módulos de arena.
const HomePromoBanners = lazy(() => import('@/v2/components/arenas/marketing/HomePromoBanners'));

/** O próximo passo de quem está com a agenda livre (os atalhos de jogar). */
const SUGESTOES_AGENDA_LIVRE = new Set(['procura-jogo', 'reservar', 'torneios', 'dia-de-jogo:criar', 'professores']);

export default function V2PersonalHome() {
  const { user, userProfile, isPlatformAdmin } = useAuth();
  const uid = user?.uid || null;
  const { ms: agora } = useRelogio(60_000);
  const hoje = hojeLocal(new Date(agora));
  const arenaModulesOn = useFeatureFlag(FEATURE_FLAG.ARENA_MODULES);
  const actionHomeOn = useFeatureFlag(FEATURE_FLAG.ACTION_HOME);
  const coachMarketingOn = useFeatureFlag(FEATURE_FLAG.COACH_MARKETING);

  // Papéis reais — todos já em cache pela barra lateral (arena, professor).
  const { arenas, pendingByArena, totalPendingBookings } = useMyArenaSummary();
  const arenasQ = useMyManagedArenas(); // mesma chave do resumo; daqui sai o isError
  const coachQ = useCoach(uid);
  const coach = coachQ.data;
  const ehProfessor = !!coach && coach.active !== false;
  const meusQ = useMyTournaments();
  const meus = useMemo(() => meusQ.data || [], [meusQ.data]);
  const organizando = useMemo(() => managedTournamentsForHome(meus, hoje).length, [meus, hoje]);
  const competindo = useMemo(() => myCurrentTournaments(meus, hoje).length > 0, [meus, hoje]);
  const clubesQ = useMyClubs();
  const temClubes = (clubesQ.data || []).length > 0;

  const agenda = useHomeAgenda({
    agora, ehProfessor, competindo, arenaModulesOn, comClubes: temClubes,
  });

  const foci = useMemo(() => resolveHomeFoci({
    interests: userProfile?.interests,
    sinais: {
      arenasGeridas: arenas.length,
      ehProfessor,
      torneiosOrganizando: organizando,
      temTorneios: competindo,
      temClubes,
      ...agenda.sinais,
    },
  }), [userProfile?.interests, arenas.length, ehProfessor, organizando, competindo, temClubes, agenda.sinais]);

  const secoes = useMemo(() => homeSectionsFor(foci), [foci]);
  const atalhos = useMemo(() => homeShortcuts(foci, {
    arenas: arenas.map((a) => ({ id: a.id, name: a.name, pending: pendingByArena?.[a.id] || 0 })),
    ehProfessor,
    isPlatformAdmin,
    arenasDesconhecidas: arenasQ.isError,
    professorDesconhecido: coachQ.isError,
  }), [foci, arenas, pendingByArena, ehProfessor, isPlatformAdmin, arenasQ.isError, coachQ.isError]);
  const sugestoes = useMemo(
    () => atalhos.filter((a) => SUGESTOES_AGENDA_LIVRE.has(a.id)),
    [atalhos],
  );

  const nome = (userProfile?.platform_name || user?.displayName || 'Atleta').split(' ')[0];
  const perfil = useMemo(
    () => ({ city: userProfile?.city || '', state: userProfile?.state || '' }),
    [userProfile?.city, userProfile?.state],
  );
  const podeCriarTorneio = foci.some((f) => f.focus === 'organizar');

  const renderSecao = ({ id, reason }) => {
    const motivo = reason ? focusReasonText(reason) : null;
    switch (id) {
      case HOME_SECTION.AGENDA:
        return <HomeAgendaSection agenda={agenda} hoje={hoje} sugestoes={sugestoes} />;
      case HOME_SECTION.ARENA:
        return <HomeArenaSection reason={motivo} />;
      case HOME_SECTION.PROFESSOR:
        return (
          <HomeCoachSection
            reason={motivo} coachId={uid} ehProfessor={ehProfessor} marketingOn={coachMarketingOn}
            perfilQ={coachQ}
          />
        );
      case HOME_SECTION.ORGANIZAR:
        return <HomeOrganizerSection reason={motivo} hoje={hoje} meus={meus} meusQ={meusQ} />;
      case HOME_SECTION.TORNEIOS:
        return (
          <HomeTournamentsSection
            reason={motivo} hoje={hoje} perfil={perfil} meus={meus} meusQ={meusQ} podeCriar={podeCriarTorneio}
          />
        );
      case HOME_SECTION.RESULTADO:
        return <HomeLastResultSection reason={motivo} hoje={hoje} />;
      case HOME_SECTION.RANKING:
        return <HomeRankingSection reason={motivo} />;
      case HOME_SECTION.JOGAR:
        return <HomePlaySection reason={motivo} hoje={hoje} perfil={perfil} arenaModulesOn={arenaModulesOn} />;
      case HOME_SECTION.RESERVAR:
        return <HomeBookingSection reason={motivo} hoje={hoje} agora={agora} />;
      case HOME_SECTION.AULAS:
        return <HomeLessonsSection reason={motivo} perfil={perfil} uid={uid} />;
      case HOME_SECTION.CLUBES:
        return <HomeClubsSection reason={motivo} hoje={hoje} />;
      case HOME_SECTION.COMUNIDADE:
        return <HomeCommunitySection reason={motivo} perfil={perfil} uid={uid} />;
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <HomeHero
        nome={nome}
        hoje={hoje}
        agora={agora}
        agenda={agenda}
        foci={foci}
        pendenciasExtras={totalPendingBookings}
      />

      {/* O que tem PRAZO vem antes de tudo: a chamada da fila vence em 1 hora. */}
      {arenaModulesOn && <HomeWaitlistCalls />}

      {/* Destaques da região (promoções e campanhas). Vitrine: some sem nada. */}
      {arenaModulesOn && <Suspense fallback={null}><HomePromoBanners /></Suspense>}

      <HomeShortcuts atalhos={atalhos} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {secoes.map((s) => (
          <HomeSectionBoundary key={s.id} name={s.id} wide={s.id === HOME_SECTION.AGENDA}>
            {renderSecao(s)}
          </HomeSectionBoundary>
        ))}
      </div>

      {actionHomeOn && (
        <div className="mt-10">
          <HomeSectionBoundary name="evolucao">
            <EvolutionStrip uid={uid} />
          </HomeSectionBoundary>
        </div>
      )}
    </div>
  );
}
