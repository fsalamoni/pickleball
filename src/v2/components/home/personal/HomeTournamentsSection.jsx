/**
 * "Torneios" na tela inicial — para quem quer competir.
 *
 * Em cima, os torneios em que a pessoa JÁ está (acontecendo ou por começar);
 * embaixo, os com inscrição aberta DE VERDADE (status + prazo), perto dela
 * primeiro. Nenhum encerrado, nenhum com prazo vencido — é a régua de
 * `freshness.js`.
 *
 * Com a MINHA REGIÃO (flag `my_region`), os abertos são os da região da
 * pessoa (a cidade e o raio que ela escolheu), com a distância ao lado e o
 * que ficou de fora dito — nunca escondido calado.
 */
import React, { useMemo } from 'react';
import { MapPin, Trophy } from 'lucide-react';
import { usePublicTournaments } from '@/modules/tournament/hooks/useTournament';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { TOURNAMENT_PHASE, TOURNAMENT_PHASE_LABEL } from '@/modules/home/domain/freshness';
import {
  localTexto, myCurrentTournaments, openTournamentsForMe, periodoTexto, prazoTexto,
} from '@/modules/home/domain/homeTournaments';
import { useRegionalList } from '@/core/lib/useMyRegion';
import { distanceLabel } from '@/core/domain/region';
import RegionBar, { RegionEmptyHint } from '@/v2/components/region/RegionBar';
import { HomeAction, HomeEmpty, HomeRow, HomeSection } from './HomeSection';

const LIMITE_ABERTOS = 4;

export default function HomeTournamentsSection({ reason, hoje, perfil, meus = [], meusQ, podeCriar = false }) {
  const publicos = usePublicTournaments();
  const inscritos = useMemo(
    () => new Set((meus || []).filter((t) => t.my_role === 'player').map((t) => t.id)),
    [meus],
  );
  const abertos = useMemo(
    () => openTournamentsForMe(publicos.data || [], { hoje, perfil, inscritos }),
    [publicos.data, hoje, perfil, inscritos],
  );
  const meusAtuais = useMemo(() => myCurrentTournaments(meus, hoje), [meus, hoje]);
  const naoInscritoTodos = useMemo(() => abertos.filter((a) => !a.inscrito), [abertos]);
  const regional = useRegionalList(naoInscritoTodos, (a) => ({ city: a.tournament.city, state: a.tournament.state }));
  const naoInscrito = regional.itens;

  return (
    <HomeSection id="torneios" icon={Trophy} title="Torneios" reason={reason} action={{ to: '/torneios', label: 'Ver todos' }}>
      <div className="space-y-4">
        {meusQ?.isError ? (
          <V2ErrorState inline title="Não carregou os seus torneios" description="Os seus torneios continuam lá." onRetry={meusQ.refetch} />
        ) : meusAtuais.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">Você está inscrito</p>
            <ul className="space-y-1">
              {meusAtuais.slice(0, 3).map(({ tournament: t, phase }) => (
                <li key={t.id}>
                  <HomeRow
                    to={`/torneios/${t.id}`}
                    icon={Trophy}
                    title={t.name}
                    subtitle={[periodoTexto(t, hoje), localTexto(t)].filter(Boolean).join(' · ')}
                    badge={TOURNAMENT_PHASE_LABEL[phase]}
                    badgeTone={phase === TOURNAMENT_PHASE.LIVE ? 'acid' : 'blue'}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">Inscrições abertas</p>
          <RegionBar regional={regional} compacta className="mb-2" nomeItens={['torneio', 'torneios']} />
          {publicos.isLoading || regional.carregando ? (
            <V2Skeleton lines={3} />
          ) : publicos.isError ? (
            <V2ErrorState
              inline
              title="Não carregou os torneios abertos"
              description="Pode haver torneio com inscrição aberta — tente de novo."
              onRetry={publicos.refetch}
            />
          ) : naoInscrito.length === 0 && regional.fora > 0 ? (
            <RegionEmptyHint regional={regional} oque="Nenhum torneio com inscrição aberta" />
          ) : naoInscrito.length === 0 ? (
            <HomeEmpty
              icon={Trophy}
              actions={(
                <>
                  <HomeAction to="/torneios">Ver torneios</HomeAction>
                  {podeCriar && <HomeAction to="/torneios/criar" primary>Criar torneio</HomeAction>}
                </>
              )}
            >
              {abertos.length > 0
                ? 'Você já está inscrito em todos os torneios com inscrição aberta agora.'
                : `Nenhum torneio com inscrição aberta agora${regional.limita ? ` ${regional.frase}` : ''}. Novos torneios aparecem aqui assim que abrirem.`}
            </HomeEmpty>
          ) : (
            <ul className="space-y-1">
              {naoInscrito.slice(0, LIMITE_ABERTOS).map((item) => { const { tournament: t, perto } = item; return (
                <li key={t.id}>
                  <HomeRow
                    to={`/torneios/${t.id}`}
                    icon={perto > 0 ? MapPin : Trophy}
                    title={t.name}
                    subtitle={[prazoTexto(t, hoje), localTexto(t), regional.ativa ? distanceLabel(regional.infoDe(item)?.km) : null].filter(Boolean).join(' · ')}
                    // Só entra aqui quem ainda NÃO se inscreveu: o selo diz o
                    // que o toque faz (a inscrição, dentro do torneio).
                    badge={regional.ativa || !perto ? 'Inscreva-se' : (perto === 2 ? 'Na sua cidade · inscreva-se' : 'No seu estado · inscreva-se')}
                    badgeTone="green"
                  />
                </li>
              ); })}
            </ul>
          )}
        </div>
      </div>
    </HomeSection>
  );
}
