/**
 * Os torneios DA CASA em que a pessoa está inscrita, em todas as arenas —
 * em "Torneios → Meus torneios".
 *
 * Antes, a inscrição num torneio interno só aparecia dentro da página de
 * torneios daquela arena: quem se inscrevia em duas arenas tinha de lembrar
 * de abrir as duas. Recebe os dados prontos (`useMyInternalTournaments`) para
 * a página saber se há algo antes de dizer "você ainda não tem torneios".
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Play, Trophy } from 'lucide-react';
import {
  INTERNAL_TOURNAMENT_STATUS, INTERNAL_TOURNAMENT_STATUS_META,
} from '@/modules/arenas/domain/leagues';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { V2Badge, V2Surface } from '@/v2/ui/primitives';

export default function MyHouseTournaments({ torneios = [], arenas = [] }) {
  if (torneios.length === 0) return null;
  const nomeDaArena = new Map(arenas.map((a) => [a.id, a.name]));
  return (
    <V2Surface className="mb-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
        <Trophy className="h-5 w-5" /> Torneios da casa
      </h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">Os torneios internos das arenas em que você se inscreveu.</p>
      <div className="grid gap-2 md:grid-cols-2">
        {torneios.map((t) => {
          const meta = INTERNAL_TOURNAMENT_STATUS_META[t.status]
            || INTERNAL_TOURNAMENT_STATUS_META[INTERNAL_TOURNAMENT_STATUS.SCHEDULED];
          const rolando = t.status === INTERNAL_TOURNAMENT_STATUS.RUNNING && t.game_day_id;
          return (
            <Link
              key={t.id}
              to={rolando ? `/dia-de-jogo/${t.game_day_id}` : `/arenas/${t.arena_id}/torneios`}
              className="flex items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3 transition-colors hover:border-ink/30"
            >
              <div className="min-w-0">
                <p className="font-bold text-ink line-clamp-1">{t.name}</p>
                <p className="flex items-center gap-1 text-xs text-gray-500">
                  <Building2 className="h-3 w-3" /> {nomeDaArena.get(t.arena_id) || 'Arena'} · {formatDateShortBR(t.date)}
                </p>
              </div>
              {rolando
                ? <V2Badge tone="acid"><Play className="mr-1 inline h-3 w-3" />Rolando</V2Badge>
                : <V2Badge tone={meta.tone}>{meta.label}</V2Badge>}
            </Link>
          );
        })}
      </div>
    </V2Surface>
  );
}
