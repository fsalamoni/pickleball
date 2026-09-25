/**
 * O JOGO ABERTO dentro da página do dia de jogo (Onda CA).
 *
 * *"Os usuários, dentro da página da arena, podem dizer que vão no jogo aberto
 * (dia de jogo) e devem poder visualizar as configurações do dia de jogo, os
 * participantes inscritos e tudo mais."* A página do dia de jogo já mostra o
 * formato, as regras, as quadras e quem vai — faltava, aqui, o que é do jogo
 * aberto: faixa de nível, valor, vagas e o botão de entrar (ou a fila).
 *
 * O botão é o MESMO da página da arena (`SlotAction` + `slotActionState` +
 * `useOpenSlotActions`): mensagem que diverge entre telas ensina a desconfiar
 * das duas. E entrar aqui é entrar no jogo aberto — as duas listas são
 * gravadas juntas pelo serviço.
 *
 * As vagas contam também os convidados que a arena inseriu no dia de jogo
 * (`linkedOccupancy`): eles ocupam lugar na quadra.
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Info, Trophy, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useOpenSlot, useUserWaitlist } from '@/modules/arenas/hooks/useArenaV3';
import { useGameDayParticipants } from '@/modules/games/hooks/useGameDays';
import { useMyUnifiedLevel } from '@/modules/rating/hooks/useMyUnifiedLevel';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { formatHasScores } from '@/modules/clubs/domain/gameDayFormats';
import { formatLevel, slotLevelRangeLabel, slotLevelFit } from '@/modules/arenas/domain/openMatch';
import { OPEN_SLOT_FORMAT_LABEL, slotActionState } from '@/modules/arenas/domain/openMatchView';
import { linkedOccupancy } from '@/modules/arenas/domain/openMatchGameDay';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { V2Badge, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { SlotAction, WaitlistCallCard } from './OpenSlotCard';
import { useOpenSlotActions } from './useOpenSlotActions';

export default function OpenMatchGameDayPanel({ gameDay, className = '' }) {
  const slotId = gameDay?.open_slot_id || null;
  const { user, isAuthenticated } = useAuth();
  const slotQ = useOpenSlot(slotId);
  const { data: participants } = useGameDayParticipants(slotId ? gameDay.id : null);
  const { data: minhaFila = [] } = useUserWaitlist();
  const { level } = useMyUnifiedLevel();
  const acoes = useOpenSlotActions();
  // O ranking da casa (Onda CB): o jogo aberto com placar soma pontos nele.
  const { isOn: moduloLigado } = useArenaModules(slotId ? gameDay.arena_id : null);
  const comRanking = moduloLigado(ARENA_MODULE_ID.LEAGUES);

  const slot = slotQ.data || null;
  const occ = useMemo(() => linkedOccupancy(slot, participants), [slot, participants]);

  if (!slotId) return null;
  if (slotQ.isLoading) return <V2Skeleton className={`h-28 rounded-4xl ${className}`} />;
  if (slotQ.isError) {
    return (
      <V2Surface className={className}>
        <V2ErrorState inline title="Não foi possível carregar o jogo aberto"
          description="As vagas continuam lá — tente de novo." onRetry={() => slotQ.refetch()} />
      </V2Surface>
    );
  }
  if (!slot) return null;

  const uid = user?.uid || null;
  const jaEstou = Boolean(uid) && (
    (slot.participants || []).includes(uid)
    || (participants || []).some((p) => p.user_id === uid)
  );
  const naFila = minhaFila.some((f) => f.slot_id === slotId && f.status === 'waiting');
  const chamada = minhaFila.find((f) => f.slot_id === slotId && f.status === 'notified') || null;
  const cancelado = slot.status === 'cancelled';
  // Os convidados da arena ocupam lugar: a conta do botão usa a ocupação real.
  const slotEfetivo = { ...slot, participants: undefined, filled_spots: occ.usados };
  const { estado, motivo } = slotActionState(slotEfetivo, { jaEstou, naFila, level });
  const faixa = slotLevelRangeLabel(slot);
  const encaixe = slotLevelFit(slot, level);

  return (
    <V2Surface className={className}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
            <Users className="h-4 w-4" aria-hidden="true" /> Jogo aberto
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {[
              slot.format ? (OPEN_SLOT_FORMAT_LABEL[slot.format] || slot.format) : null,
              Number(slot.price) > 0 ? `${formatPrice(Number(slot.price))} por atleta` : 'valor a combinar na arena',
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        {!cancelado && (
          <V2Badge tone={occ.cheio ? 'amber' : 'green'}>
            {occ.cheio ? 'Lotado' : `${occ.livres} vaga${occ.livres === 1 ? '' : 's'} de ${occ.total}`}
          </V2Badge>
        )}
      </div>

      {cancelado ? (
        <p className="mt-3 text-sm text-gray-600">
          Este jogo aberto foi cancelado pela arena.
          {gameDay.arena_id && (
            <> Veja outros jogos na <Link to={`/arenas/${gameDay.arena_id}#arena-jogos-abertos`} className="font-bold text-ink underline">página da arena</Link>.</>
          )}
        </p>
      ) : (
        <>
          {faixa && (
            <p className={`mt-3 flex gap-1.5 rounded-2xl p-2.5 text-xs leading-5 ${
              encaixe.ok ? 'bg-paper text-gray-600' : 'bg-amber-50 text-amber-800'
            }`}
            >
              <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Nível <strong>{faixa}</strong>
                {Number.isFinite(level)
                  ? ` · o seu é ${formatLevel(level)}`
                  : ' · ainda não temos o seu nível, então você pode entrar'}
                {!encaixe.ok && ' — fora da faixa deste jogo.'}
              </span>
            </p>
          )}

          {chamada && (
            <div className="mt-3">
              <WaitlistCallCard entrada={chamada} slot={slot} ocupado={acoes.ocupado}
                onAceitar={acoes.onAceitar} onRecusar={acoes.onRecusar} />
            </div>
          )}

          {!chamada && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SlotAction estado={estado} semConta={!isAuthenticated} ocupado={acoes.ocupado}
                onEntrar={() => acoes.onEntrar(slot)} onSair={() => acoes.onSair(slot)}
                onFila={() => acoes.onFila(slot)} />
              {motivo && <span className="text-xs text-amber-700">{motivo}</span>}
              {jaEstou && <span className="text-xs text-gray-500">Você está na lista abaixo.</span>}
            </div>
          )}

          {comRanking && gameDay.arena_id && (
            <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-500">
              <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {formatHasScores(gameDay.format) ? (
                <>
                  <span>Este jogo conta no ranking da casa: cada colocação vale pontos.</span>
                  <Link to={`/arenas/${gameDay.arena_id}/torneios`} className="inline-flex items-center gap-0.5 font-bold text-ink hover:underline">
                    Ver o ranking <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <span>Play não tem placar, então este jogo não pontua no ranking da casa.</span>
              )}
            </p>
          )}
        </>
      )}
    </V2Surface>
  );
}
