/**
 * A chamada para o RANKING DA CASA na página da arena (Onda CB).
 *
 * Só a chamada — sem a conta. O ranking soma os jogos de uma temporada
 * inteira, e fazer essa soma para cada visitante da página da arena seria
 * pagar a temporada a cada visita. A conta vive na página própria
 * (`/arenas/:id/torneios`), aberta por quem quer ver.
 *
 * Aparece só com o módulo do ranking da casa ligado (`leagues`).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Crown, Trophy } from 'lucide-react';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { V2Button, V2Surface } from '@/v2/ui/primitives';

export default function HouseRankingTeaser({ arenaId }) {
  const { isOn, isLoading } = useArenaModules(arenaId);
  if (isLoading || !isOn(ARENA_MODULE_ID.LEAGUES)) return null;
  const ano = new Date().getFullYear();
  return (
    <V2Surface className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-acid text-ink">
            <Crown className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
              <Trophy className="h-4 w-4 shrink-0" /> Ranking da casa · {ano}
            </h3>
            <p className="text-xs text-gray-500">
              Cada jogo aberto com placar e cada torneio da casa soma pontos. Veja quem lidera e onde você está.
            </p>
          </div>
        </div>
        <V2Button asChild size="sm">
          <Link to={`/arenas/${arenaId}/torneios`}>
            Ver o ranking <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </V2Button>
      </div>
    </V2Surface>
  );
}
