/**
 * Os torneios internos no FORMATO ANTIGO que ainda estão abertos (Onda CB).
 *
 * O "torneio da casa" (`arena_internal_tournaments`) saiu da tela: o jogo
 * aberto faz o que ele fazia, e os torneios da casa passaram a ser os da
 * plataforma. Nada foi apagado do banco — e um torneio antigo ainda aberto
 * tem gente inscrita que não o vê mais. Este aviso existe para a arena
 * fechar esses torneios AVISANDO os inscritos, em vez de deixá-los pendurados.
 *
 * - Aberto (inscrições): "Cancelar e avisar os inscritos".
 * - Em andamento: ele já virou um dia de jogo — o caminho é o dia de jogo,
 *   que conta sozinho no ranking da casa.
 *
 * Sem nenhum antigo aberto, o aviso não aparece. Falhando a leitura, diz que
 * não conseguiu conferir — não afirma que não há nenhum.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Archive, ArrowRight } from 'lucide-react';
import { useArenaInternalTournaments, useCancelTournament } from '@/modules/arenas/hooks/useArenaV3';
import { INTERNAL_TOURNAMENT_STATUS } from '@/modules/arenas/domain/leagues';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { V2Button, V2ErrorState, V2Surface } from '@/v2/ui/primitives';

const MOTIVO = 'Os torneios da casa passaram a ser os torneios da plataforma. Fique de olho nos jogos abertos e nos próximos torneios da arena.';

export default function LegacyInternalTournamentsNotice({ arena }) {
  const q = useArenaInternalTournaments(arena.id);
  const cancelar = useCancelTournament();
  const [cancelando, setCancelando] = useState(null);

  const abertos = useMemo(() => (q.data || []).filter((t) => (
    t.status === INTERNAL_TOURNAMENT_STATUS.SCHEDULED
    || t.status === INTERNAL_TOURNAMENT_STATUS.RUNNING
  )), [q.data]);

  if (q.isLoading) return null;
  if (q.isError) {
    return (
      <V2ErrorState
        inline
        title="Não foi possível conferir os torneios internos antigos"
        description="Se houver algum ainda aberto, ele aparece aqui."
        onRetry={() => q.refetch()}
      />
    );
  }
  if (abertos.length === 0) return null;

  const encerrar = async (t) => {
    setCancelando(t.id);
    try {
      await cancelar.mutateAsync({ tid: t.id, motivo: MOTIVO });
      toast.success('Torneio encerrado. Os inscritos foram avisados.');
    } catch (e) {
      toast.error(e?.message || 'Não foi possível encerrar o torneio.');
    } finally {
      setCancelando(null);
    }
  };

  return (
    <V2Surface className="border-amber-200 bg-amber-50/60">
      <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
        <Archive className="h-4 w-4 shrink-0" /> Torneios internos no formato antigo
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        O torneio interno saiu da plataforma: o jogo aberto faz o que ele fazia, e os torneios da casa passaram a ser
        os da plataforma. {abertos.length === 1 ? 'Este ainda está aberto' : 'Estes ainda estão abertos'} e os atletas
        não {abertos.length === 1 ? 'o veem' : 'os veem'} mais — encerre avisando quem se inscreveu.
      </p>
      <ul className="mt-3 space-y-2">
        {abertos.map((t) => {
          const rolando = t.status === INTERNAL_TOURNAMENT_STATUS.RUNNING;
          return (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-paper-pure p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{t.name}</p>
                <p className="text-xs text-gray-500">
                  {[t.date ? formatDateShortBR(t.date) : '', `${t.enrolled || 0} inscritos`].filter(Boolean).join(' · ')}
                </p>
              </div>
              {rolando && t.game_day_id ? (
                <V2Button asChild size="sm" variant="secondary">
                  <Link to={`/dia-de-jogo/${t.game_day_id}`}>Abrir o dia de jogo <ArrowRight className="h-3.5 w-3.5" /></Link>
                </V2Button>
              ) : (
                <V2Button size="sm" variant="secondary" disabled={cancelando === t.id} onClick={() => encerrar(t)}>
                  {cancelando === t.id ? 'Encerrando…' : 'Cancelar e avisar os inscritos'}
                </V2Button>
              )}
            </li>
          );
        })}
      </ul>
    </V2Surface>
  );
}
