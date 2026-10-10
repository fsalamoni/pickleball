/**
 * Os TORNEIOS DA CASA — na Central (Onda CB).
 *
 * Torneio da casa é o torneio da PLATAFORMA sediado nesta arena: inscrição,
 * chaves, resultados e ranking seguem as regras da plataforma, e cada
 * categoria que termina soma no ranking da casa. Quem organiza gere pela
 * página do torneio; aqui a arena vê o que vai acontecer nas quadras dela e
 * cria um torneio já com a arena escolhida.
 *
 * O antigo "torneio da casa" (`arena_internal_tournaments`, uma competição
 * paralela com regras próprias) saiu da tela. Os que ainda estavam abertos
 * aparecem no fim, num aviso, para a arena fechá-los avisando os inscritos —
 * sumir com eles calado deixaria gente inscrita num torneio que ninguém vê.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Plus, Trophy, X } from 'lucide-react';
import {
  useArenaTournaments as useArenaPlatformTournaments,
  useDecideTournamentArena,
} from '@/modules/tournament/hooks/useTournament';
import { isHostConfirmed, sortHouseTournaments } from '@/modules/arenas/domain/houseTournaments';
import { V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { HouseTournamentRow } from './HouseTournamentsSection';
import LegacyInternalTournamentsNotice from './LegacyInternalTournamentsNotice';

export default function ArenaPlatformTournamentsTab({ arena }) {
  const q = useArenaPlatformTournaments(arena.id, { includePending: true });
  const todos = useMemo(() => sortHouseTournaments(q.data || [], { includeDrafts: true }), [q.data]);
  const pendentes = todos.filter((t) => !isHostConfirmed(t));
  const torneios = todos.filter(isHostConfirmed);
  const decidir = useDecideTournamentArena(arena.id);

  const handleDecide = async (tournament, confirm) => {
    try {
      await decidir.mutateAsync({ tournament, confirm });
      toast.success(confirm ? 'Sede confirmada. O torneio já aparece na página da arena.' : 'Sede recusada. O organizador foi avisado.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível registrar a decisão.');
    }
  };

  return (
    <div className="space-y-4">
      {pendentes.length > 0 && (
        <V2Surface>
          <h2 className="font-display text-lg font-bold text-ink">Pedidos de sede</h2>
          <p className="mt-1 mb-4 text-sm text-gray-500">
            Estes torneios escolheram a arena como sede. Só depois de confirmados eles aparecem na página da arena e somam no ranking da casa.
          </p>
          <div className="space-y-3">
            {pendentes.map((t) => (
              <div key={t.id} className="space-y-2">
                <HouseTournamentRow t={t} />
                <div className="flex flex-wrap gap-2">
                  <V2Button size="sm" onClick={() => handleDecide(t, true)} disabled={decidir.isPending}>
                    <Check className="h-4 w-4" /> Confirmar sede
                  </V2Button>
                  <V2Button size="sm" variant="ghost" onClick={() => handleDecide(t, false)} disabled={decidir.isPending}>
                    <X className="h-4 w-4" /> Recusar
                  </V2Button>
                </div>
              </div>
            ))}
          </div>
        </V2Surface>
      )}

      <V2Surface>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-ink" />
            <h2 className="font-display text-lg font-bold text-ink">Torneios da casa</h2>
          </div>
          <V2Button asChild size="sm" variant="secondary">
            <Link to={`/torneios/criar?arena=${arena.id}`}>
              <Plus className="h-4 w-4" /> Criar torneio aqui
            </Link>
          </V2Button>
        </div>
        <p className="-mt-2 mb-4 text-sm text-gray-500">
          Torneios da plataforma sediados nesta arena, com inscrição, chaves e resultados pelas regras da plataforma.
          Quem organiza gere pela página do torneio. Cada categoria que termina soma no ranking da casa.
        </p>

        {q.isLoading ? (
          <V2Skeleton lines={3} />
        ) : q.isError ? (
          <V2ErrorState
            title="Não foi possível carregar os torneios"
            description="A conexão falhou no meio do caminho. Nenhum torneio foi perdido — tente de novo."
            onRetry={() => q.refetch()}
          />
        ) : torneios.length === 0 ? (
          <V2EmptyState
            icon={Trophy}
            title="Nenhum torneio sediado aqui ainda"
            description="Ao criar um torneio, escolha esta arena como sede — ele aparece aqui, na página da arena e passa a somar no ranking da casa."
          />
        ) : (
          <div className="space-y-2">
            {torneios.map((t) => <HouseTournamentRow key={t.id} t={t} />)}
          </div>
        )}
      </V2Surface>

      <LegacyInternalTournamentsNotice arena={arena} />
    </div>
  );
}
