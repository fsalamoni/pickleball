/**
 * Meus jogos abertos — em Minhas reservas, de TODAS as arenas.
 *
 * Antes, o que a pessoa tinha em jogo aberto só aparecia dentro da página de
 * cada arena: quem entrou num jogo precisava lembrar em qual arena foi para
 * conferir o horário, e a CHAMADA da fila de espera — que tem prazo — só
 * podia ser aceita abrindo a arena certa. Aqui fica tudo junto:
 *
 *  1. **vagou para você** — a chamada, com o botão de confirmar;
 *  2. **você vai jogar** — os jogos em que já está;
 *  3. **na fila de espera** — onde está esperando, com "sair da fila".
 *
 * Sem nada disso, a seção não aparece. Falha ao ler NÃO some: vira aviso —
 * sumir seria dizer que a pessoa não tem jogo marcado, e ela não iria.
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Users } from 'lucide-react';
import { useMyOpenSlots, useOpenSlotsByIds, useUserWaitlist } from '@/modules/arenas/hooks/useArenaV3';
import { myUpcomingOpenSlots, pendingWaitlistCalls, promotionWindowLabel } from '@/modules/arenas/domain/openMatchView';
import { WAITLIST_STATUS } from '@/modules/arenas/domain/waitlist';
import { formatSlotLabel } from '@/modules/arenas/domain/calendar';
import { useMyUnifiedLevel } from '@/modules/rating/hooks/useMyUnifiedLevel';
import { OpenSlotCard, WaitlistCallCard } from './OpenSlotCard';
import { useOpenSlotActions } from './useOpenSlotActions';
import { V2Button, V2ErrorState } from '@/v2/ui/primitives';

export default function MyOpenMatches() {
  const meusQ = useMyOpenSlots();
  const { data: fila = [] } = useUserWaitlist();
  const { level } = useMyUnifiedLevel();
  const acoes = useOpenSlotActions();

  const idsDaFila = useMemo(
    () => fila.filter((f) => f.status === WAITLIST_STATUS.NOTIFIED || f.status === WAITLIST_STATUS.WAITING)
      .map((f) => f.slot_id),
    [fila],
  );
  const { slots: vagasDaFila } = useOpenSlotsByIds(idsDaFila);
  const porId = useMemo(() => new Map(vagasDaFila.map((s) => [s.id, s])), [vagasDaFila]);

  const meus = useMemo(() => myUpcomingOpenSlots(meusQ.data || []), [meusQ.data]);
  const chamadas = useMemo(() => pendingWaitlistCalls(fila, porId), [fila, porId]);
  const esperando = useMemo(() => fila
    .filter((f) => f.status === WAITLIST_STATUS.WAITING)
    .map((f) => ({ entrada: f, slot: porId.get(f.slot_id) }))
    .filter(({ slot }) => slot && slot.status !== 'cancelled'), [fila, porId]);

  if (meusQ.isError) {
    return (
      <div className="mb-8">
        <V2ErrorState inline title="Não foi possível carregar os seus jogos abertos"
          description="Os seus jogos continuam marcados — tente de novo." onRetry={() => meusQ.refetch()} />
      </div>
    );
  }
  if (chamadas.length + meus.length + esperando.length === 0) return null;

  return (
    <div className="mb-8 space-y-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
        <Users className="h-3.5 w-3.5" /> Jogos abertos nas arenas
      </p>

      {chamadas.map(({ entrada, slot }) => (
        <WaitlistCallCard key={entrada.id} entrada={entrada} slot={slot} mostrarArena
          ocupado={acoes.ocupado} onAceitar={acoes.onAceitar} onRecusar={acoes.onRecusar} />
      ))}

      {meus.map((s) => (
        <OpenSlotCard key={s.id} slot={s} meuNivel={level} jaEstou mostrarArena
          ocupado={acoes.ocupado} onSair={acoes.onSair} />
      ))}

      {esperando.length > 0 && (
        <div className="rounded-3xl border border-gray-100 bg-paper-pure p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Na fila de espera</p>
          <ul className="mt-2 space-y-2">
            {esperando.map(({ entrada, slot }) => (
              <li key={entrada.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-ink">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="min-w-0">
                    {formatSlotLabel(slot)}
                    {slot.arena_name && (
                      <> · <Link to={`/arenas/${slot.arena_id}/open-match`} className="font-bold hover:underline">{slot.arena_name}</Link></>
                    )}
                  </span>
                </span>
                <V2Button variant="ghost" size="sm" disabled={acoes.ocupado}
                  onClick={() => acoes.onSairDaFila(slot.id)}>
                  Sair da fila
                </V2Button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            Se alguém sair, a vaga é oferecida a você — e você tem {promotionWindowLabel()} para confirmar.
          </p>
        </div>
      )}
    </div>
  );
}
