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
import { t } from '@/core/i18n';

const MOTIVO = 'Os torneios da casa passaram a ser os torneios da plataforma. Fique de olho nos jogos abertos e nos próximos torneios da arena.';

export default function LegacyInternalTournamentsNotice({ arena }) {
  const q = useArenaInternalTournaments(arena.id);
  const cancelar = useCancelTournament();
  const [cancelando, setCancelando] = useState(null);

  const abertos = useMemo(() => (q.data || []).filter((tor) => (
    tor.status === INTERNAL_TOURNAMENT_STATUS.SCHEDULED
    || tor.status === INTERNAL_TOURNAMENT_STATUS.RUNNING
  )), [q.data]);

  if (q.isLoading) return null;
  if (q.isError) {
    return (
      <V2ErrorState
        inline
        title={t('Não foi possível conferir os torneios internos antigos')}
        description={t('Se houver algum ainda aberto, ele aparece aqui.')}
        onRetry={() => q.refetch()}
      />
    );
  }
  if (abertos.length === 0) return null;

  const encerrar = async (tor) => {
    setCancelando(tor.id);
    try {
      await cancelar.mutateAsync({ tid: tor.id, motivo: MOTIVO });
      toast.success(t('Torneio encerrado. Os inscritos foram avisados.'));
    } catch (e) {
      toast.error(e?.message || t('Não foi possível encerrar o torneio.'));
    } finally {
      setCancelando(null);
    }
  };

  return (
    <V2Surface className="border-amber-200 bg-amber-50/60">
      <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
        <Archive className="h-4 w-4 shrink-0" /> {t('Torneios internos no formato antigo')}
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        {t('O torneio interno saiu da plataforma: o jogo aberto faz o que ele fazia, e os torneios da casa passaram a ser os da plataforma.')}{' '}
        {abertos.length === 1
          ? t('Este ainda está aberto e os atletas não o veem mais — encerre avisando quem se inscreveu.')
          : t('Estes ainda estão abertos e os atletas não os veem mais — encerre avisando quem se inscreveu.')}
      </p>
      <ul className="mt-3 space-y-2">
        {abertos.map((tor) => {
          const rolando = tor.status === INTERNAL_TOURNAMENT_STATUS.RUNNING;
          return (
            <li key={tor.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-paper-pure p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{tor.name}</p>
                <p className="text-xs text-gray-500">
                  {[tor.date ? formatDateShortBR(tor.date) : '', t('{n} inscritos', { n: tor.enrolled || 0 })].filter(Boolean).join(' · ')}
                </p>
              </div>
              {rolando && tor.game_day_id ? (
                <V2Button asChild size="sm" variant="secondary">
                  <Link to={`/dia-de-jogo/${tor.game_day_id}`}>{t('Abrir o dia de jogo')} <ArrowRight className="h-3.5 w-3.5" /></Link>
                </V2Button>
              ) : (
                <V2Button size="sm" variant="secondary" disabled={cancelando === tor.id} onClick={() => encerrar(tor)}>
                  {cancelando === tor.id ? t('Encerrando…') : t('Cancelar e avisar os inscritos')}
                </V2Button>
              )}
            </li>
          );
        })}
      </ul>
    </V2Surface>
  );
}
