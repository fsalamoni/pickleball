/**
 * "Torneios que você organiza" — o que pede trabalho, com o próximo passo.
 *
 * Rascunho, inscrições abertas, hora do sorteio, acontecendo — e o
 * "esquecido" (data de fim vencida sem encerrar), que é justamente o que o
 * organizador precisa ver. Torneio encerrado não aparece.
 */
import React, { useMemo } from 'react';
import { ClipboardList, Plus, Trophy } from 'lucide-react';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { TOURNAMENT_PHASE, TOURNAMENT_PHASE_LABEL } from '@/modules/home/domain/freshness';
import { managedTournamentsForHome, organizerHint, periodoTexto } from '@/modules/home/domain/homeTournaments';
import { HomeAction, HomeEmpty, HomeRow, HomeSection } from './HomeSection';

const TOM = {
  [TOURNAMENT_PHASE.LIVE]: 'acid',
  [TOURNAMENT_PHASE.STALE]: 'amber',
  [TOURNAMENT_PHASE.OPEN]: 'green',
  [TOURNAMENT_PHASE.UPCOMING]: 'blue',
  [TOURNAMENT_PHASE.DRAFT]: 'neutral',
};

export default function HomeOrganizerSection({ reason, hoje, meus = [], meusQ }) {
  const lista = useMemo(() => managedTournamentsForHome(meus, hoje), [meus, hoje]);

  return (
    <HomeSection
      id="organizar"
      icon={ClipboardList}
      title="Torneios que você organiza"
      reason={reason}
      action={{ to: '/perfil/torneios', label: 'Todos' }}
    >
      {meusQ?.isLoading ? (
        <V2Skeleton lines={3} />
      ) : meusQ?.isError ? (
        <V2ErrorState inline title="Não carregou os seus torneios" description="Os seus torneios continuam lá." onRetry={meusQ.refetch} />
      ) : lista.length === 0 ? (
        <HomeEmpty icon={Trophy} actions={<HomeAction to="/torneios/criar" primary><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Criar torneio</HomeAction>}>
          Nenhum torneio seu em andamento. Monte o próximo em poucos passos.
        </HomeEmpty>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-1">
            {lista.slice(0, 4).map(({ tournament: t, phase }) => (
              <li key={t.id}>
                <HomeRow
                  to={`/torneios/${t.id}/gerenciar`}
                  icon={Trophy}
                  title={t.name}
                  subtitle={[organizerHint(phase), periodoTexto(t, hoje)].filter(Boolean).join(' · ')}
                  badge={TOURNAMENT_PHASE_LABEL[phase]}
                  badgeTone={TOM[phase]}
                  highlight={phase === TOURNAMENT_PHASE.STALE}
                />
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <HomeAction to="/torneios/criar" primary><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Criar torneio</HomeAction>
          </div>
        </div>
      )}
    </HomeSection>
  );
}
