/**
 * "Jogos abertos nas arenas" — em Procura-se jogo.
 *
 * Procura-se jogo reunia os convites que os ATLETAS publicam. Os jogos com
 * vaga que as ARENAS publicam — exatamente o que quem procura jogo quer —
 * existiam e não apareciam ali: só dentro da página de cada arena, para quem
 * já soubesse em que arena procurar. (O hook que lista as vagas de todas as
 * arenas, `useGlobalOpenSlots`, existia e não era usado por tela nenhuma.)
 *
 * Só entram vagas futuras, com lugar, de arenas que mantêm o módulo ligado —
 * uma arena que desligou o jogo aberto não pode ter jogo oferecido aqui, porque
 * o botão levaria a uma página que já não existe. Falha de leitura vira aviso;
 * nenhuma vaga, a seção não aparece.
 */

import React, { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useGlobalOpenSlots, useUserWaitlist } from '@/modules/arenas/hooks/useArenaV3';
import { useModuleOnInArenas } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { openSlotsForDiscovery } from '@/modules/arenas/domain/openMatchView';
import { useMyUnifiedLevel } from '@/modules/rating/hooks/useMyUnifiedLevel';
import { OpenSlotCard } from './OpenSlotCard';
import { useOpenSlotActions } from './useOpenSlotActions';
import { V2ErrorState } from '@/v2/ui/primitives';

const LIMITE = 6;

export default function OpenSlotsDiscovery() {
  const { user, isAuthenticated } = useAuth();
  const vagasQ = useGlobalOpenSlots({ limit: 100 });
  const { data: fila = [] } = useUserWaitlist();
  const { level } = useMyUnifiedLevel();
  const acoes = useOpenSlotActions();

  const arenaIds = useMemo(() => (vagasQ.data || []).map((s) => s.arena_id), [vagasQ.data]);
  const { isOnIn, isLoading: modulosCarregando } = useModuleOnInArenas(arenaIds, ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH);
  // Conta barata (no máximo 100 vagas): refeita a cada render, nunca fica
  // atrás de uma arena que ligou ou desligou o módulo.
  const vagas = openSlotsForDiscovery(vagasQ.data || [], isOnIn);
  const naFila = useMemo(() => new Set(fila.map((f) => f.slot_id)), [fila]);

  if (vagasQ.isError) {
    return (
      <div className="mb-8">
        <V2ErrorState inline title="Não foi possível carregar os jogos das arenas"
          description="Tente de novo em instantes." onRetry={() => vagasQ.refetch()} />
      </div>
    );
  }
  if (vagasQ.isLoading || modulosCarregando || vagas.length === 0) return null;

  return (
    <section className="mb-8">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
        <Building2 className="h-3.5 w-3.5" /> Jogos abertos nas arenas
      </p>
      <p className="mt-1 text-sm text-gray-500">
        Horários com vaga que as arenas publicaram. Entre direto — não precisa de convite nem de dupla.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {vagas.slice(0, LIMITE).map((s) => (
          <OpenSlotCard
            key={s.id} slot={s} meuNivel={level} mostrarArena
            jaEstou={Boolean(user?.uid) && (s.participants || []).includes(user.uid)}
            naFila={naFila.has(s.id)} semConta={!isAuthenticated} ocupado={acoes.ocupado}
            onEntrar={acoes.onEntrar} onSair={acoes.onSair} onFila={acoes.onFila}
          />
        ))}
      </div>
    </section>
  );
}
