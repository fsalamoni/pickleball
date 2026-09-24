/**
 * Os torneios DA PLATAFORMA sediados nesta arena — na Central.
 *
 * Um torneio da plataforma com `arena_id` aparecia na página pública da arena
 * e em lugar nenhum da gestão: o dono da arena não tinha onde ver o que vai
 * acontecer nas quadras dele. Aqui ele vê, com o status em pt-BR, e tem o
 * caminho para criar um torneio já vinculado à arena.
 *
 * Quem GERE o torneio continua sendo o organizador (a página do torneio);
 * a arena acompanha.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus, Trophy } from 'lucide-react';
import { useArenaTournaments as useArenaPlatformTournaments } from '@/modules/tournament/hooks/useTournament';
import { TOURNAMENT_STATUS_LABELS } from '@/modules/tournament/domain/constants';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

const TOM = {
  registrations_open: 'green', in_progress: 'acid', registrations_closed: 'amber',
  finished: 'neutral', cancelled: 'red', draft: 'neutral',
};

/** A data do torneio, seja texto ISO ou Timestamp. */
function tournamentDateLabel(v) {
  if (!v) return '';
  const d = typeof v?.toDate === 'function' ? v.toDate() : null;
  const iso = d ? d.toISOString().slice(0, 10) : String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? formatDateShortBR(iso) : '';
}

export default function ArenaPlatformTournamentsTab({ arena }) {
  const q = useArenaPlatformTournaments(arena.id);
  const torneios = useMemo(() => (q.data || []).filter((t) => !t.archived), [q.data]);

  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Torneios da plataforma nesta arena</h2>
        </div>
        <V2Button asChild size="sm" variant="secondary">
          <Link to={`/torneios/criar?arena=${arena.id}`}>
            <Plus className="h-4 w-4" /> Criar torneio aqui
          </Link>
        </V2Button>
      </div>
      <p className="-mt-2 mb-4 text-sm text-gray-500">
        Torneios abertos a toda a plataforma, com modalidades, chaves e ranking nacional. Quem organiza
        gere pela página do torneio; aqui a arena acompanha o que vai acontecer nas quadras.
      </p>

      {q.isLoading ? (
        <V2Skeleton lines={3} />
      ) : q.isError ? (
        <V2EmptyState
          icon={Trophy}
          title="Não foi possível carregar os torneios"
          description="Pode ser a conexão."
          action={<V2Button size="sm" onClick={() => q.refetch()}>Tentar de novo</V2Button>}
        />
      ) : torneios.length === 0 ? (
        <V2EmptyState
          icon={Trophy}
          title="Nenhum torneio da plataforma aqui ainda"
          description="Ao criar um torneio, escolha esta arena como sede — ele aparece aqui e na página da arena."
        />
      ) : (
        <div className="space-y-2">
          {torneios.map((t) => (
            <Link key={t.id} to={`/torneios/${t.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3 transition-colors hover:border-ink/30">
              <div className="min-w-0">
                <p className="font-bold text-ink line-clamp-1">{t.name}</p>
                <p className="text-xs text-gray-500">
                  {tournamentDateLabel(t.starts_at) || 'Data a definir'}
                  {t.city ? ` · ${t.city}${t.state ? `/${t.state}` : ''}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {t.status && <V2Badge tone={TOM[t.status] || 'neutral'}>{TOURNAMENT_STATUS_LABELS[t.status] || 'Torneio'}</V2Badge>}
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </V2Surface>
  );
}
