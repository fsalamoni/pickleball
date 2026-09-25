/**
 * A chamada da fila do jogo aberto na TELA INICIAL.
 *
 * A chamada tem prazo (1 hora) e é o item mais urgente que um atleta pode ter:
 * perdeu o prazo, a vaga passa para o próximo. Ela aparecia na página da arena
 * e em Minhas reservas — lugares aonde a pessoa só vai se já sabe que tem algo
 * lá. Aqui ela aparece onde todo mundo abre o aplicativo, com o mesmo cartão
 * (prazo, confirmar, não vou poder).
 *
 * Só existe quando há chamada. É uma superfície de cortesia (a chamada também
 * chega por aviso e está em Minhas reservas), então a falha de leitura não
 * afirma nada: simplesmente não mostra.
 */
import React, { useMemo } from 'react';
import { useOpenSlotsByIds, useUserWaitlist } from '@/modules/arenas/hooks/useArenaV3';
import { pendingWaitlistCalls } from '@/modules/arenas/domain/openMatchView';
import { WAITLIST_STATUS } from '@/modules/arenas/domain/waitlist';
import { WaitlistCallCard } from './OpenSlotCard';
import { useOpenSlotActions } from './useOpenSlotActions';

export default function HomeWaitlistCalls() {
  const { data: fila = [] } = useUserWaitlist();
  const acoes = useOpenSlotActions();
  // Só busca as vagas das CHAMADAS: quem só está esperando não custa nada aqui.
  const ids = useMemo(
    () => fila.filter((f) => f.status === WAITLIST_STATUS.NOTIFIED).map((f) => f.slot_id),
    [fila],
  );
  const { slots } = useOpenSlotsByIds(ids);
  const porId = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);
  const chamadas = useMemo(() => pendingWaitlistCalls(fila, porId), [fila, porId]);

  if (chamadas.length === 0) return null;
  return (
    <div className="mb-8 space-y-3">
      {chamadas.map(({ entrada, slot }) => (
        <WaitlistCallCard
          key={entrada.id}
          entrada={entrada}
          slot={slot}
          mostrarArena
          ocupado={acoes.ocupado}
          onAceitar={acoes.onAceitar}
          onRecusar={acoes.onRecusar}
        />
      ))}
    </div>
  );
}
