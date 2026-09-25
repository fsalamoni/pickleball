/**
 * "Torneios da casa" — a seção da página da arena (Onda CB).
 *
 * Os torneios da casa SÃO os torneios da plataforma sediados na arena: a
 * inscrição, as chaves, os resultados e o ranking seguem as regras da
 * plataforma, e cada categoria que termina soma no ranking da casa. O antigo
 * "torneio da casa" (uma competição paralela, com regras próprias) saiu — o
 * que ele fazia, o jogo aberto já faz melhor.
 *
 * Ordem de quem olha: o que está rolando, o que vem aí, e só então o que já
 * terminou. Sem nenhum torneio, a seção não aparece (é a página de uma arena,
 * não um convite a criar torneio). Falhando, diz que falhou.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Trophy } from 'lucide-react';
import { useArenaTournaments } from '@/modules/tournament/hooks/useTournament';
import { TOURNAMENT_STATUS_LABELS } from '@/modules/tournament/domain/constants';
import {
  HOUSE_TOURNAMENT_TONE, houseTournamentDateLabel, sortHouseTournaments,
} from '@/modules/arenas/domain/houseTournaments';
import { V2Badge, V2ErrorState, V2Surface } from '@/v2/ui/primitives';

/** Quantos cabem na página da arena; o resto está em "ver todos". */
const NA_PAGINA = 4;

export function HouseTournamentRow({ t }) {
  const inicio = houseTournamentDateLabel(t.starts_at);
  const fim = houseTournamentDateLabel(t.ends_at);
  const periodo = inicio && fim && inicio !== fim ? `${inicio} a ${fim}` : (inicio || 'Data a definir');
  return (
    <Link
      to={`/torneios/${t.id}`}
      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3 transition-colors hover:border-ink/30"
    >
      <div className="min-w-0">
        <p className="line-clamp-1 font-bold text-ink">{t.name}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
          <span>{periodo}</span>
          {t.city && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="h-3 w-3" /> {t.city}{t.state ? `/${t.state}` : ''}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {t.status && (
          <V2Badge tone={HOUSE_TOURNAMENT_TONE[t.status] || 'neutral'}>
            {TOURNAMENT_STATUS_LABELS[t.status] || 'Torneio'}
          </V2Badge>
        )}
        <ArrowRight className="h-4 w-4 text-gray-400" aria-hidden />
      </div>
    </Link>
  );
}

export default function HouseTournamentsSection({ arenaId }) {
  const q = useArenaTournaments(arenaId);
  const torneios = useMemo(() => sortHouseTournaments(q.data || []), [q.data]);

  if (q.isLoading) return null;
  if (q.isError) {
    return (
      <div className="mt-6">
        <V2ErrorState
          inline
          title="Não foi possível carregar os torneios da casa"
          description="A conexão falhou. Os torneios continuam lá."
          onRetry={() => q.refetch()}
        />
      </div>
    );
  }
  if (torneios.length === 0) return null;

  return (
    <V2Surface className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
          <Trophy className="h-4 w-4" /> Torneios da casa
        </h3>
        <Link to={`/arenas/${arenaId}/torneios`} className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
          {torneios.length > NA_PAGINA ? `Ver todos (${torneios.length})` : 'Ver torneios'} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Torneios da plataforma sediados aqui, com inscrição, chaves e resultados pelas regras da plataforma.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {torneios.slice(0, NA_PAGINA).map((t) => <HouseTournamentRow key={t.id} t={t} />)}
      </div>
    </V2Surface>
  );
}
