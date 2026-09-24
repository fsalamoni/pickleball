/**
 * V2ArenaOpenMatch — os jogos abertos de uma arena, na visão do ATLETA.
 *
 * Rota: `/arenas/:arenaId/open-match`
 * Módulo: `matchmaking_open_match`.
 *
 * A pergunta que esta tela responde é uma só: **existe jogo aqui hoje que eu
 * possa entrar?** Por isso:
 *
 * - a data aparece em português (`Qui, 23/07 · 19:00–21:00`), não a ISO crua;
 * - o nível é dito nos DOIS lados — a faixa da vaga e o seu — porque "nível
 *   mínimo 4.0" sozinho não diz se você entra;
 * - quando lota, a fila é oferecida no mesmo lugar, sem trocar de tela;
 * - o que você já confirmou fica em cima e marcado, para não entrar duas vezes;
 * - falha de leitura NÃO vira "nenhum jogo aberto": vira erro com "tentar de
 *   novo". Lista vazia tem um significado próprio, e mentir aqui faz o atleta
 *   desistir da arena.
 */

import React, { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena } from '@/modules/arenas/hooks/useArenas';
import { useArenaOpenSlots, useUserWaitlist } from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { useMyUnifiedLevel } from '@/modules/rating/hooks/useMyUnifiedLevel';
import { todayISO } from '@/modules/arenas/domain/calendar';
import { WAITLIST_STATUS } from '@/modules/arenas/domain/waitlist';
import { OpenSlotCard as VagaCard, WaitlistCallCard as ChamadaDaFila } from '@/v2/components/arenas/openMatch/OpenSlotCard';
import { useOpenSlotActions } from '@/v2/components/arenas/openMatch/useOpenSlotActions';
import { V2Button, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

export default function V2ArenaOpenMatch() {
  const { arenaId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const {
    data: slots = [], isLoading: carregando, isError, refetch,
  } = useArenaOpenSlots(arenaId);
  const { isOn, isLoading: carregandoModulos } = useArenaModules(arenaId);
  const { level: meuNivel } = useMyUnifiedLevel();
  const { data: minhaFila = [] } = useUserWaitlist();
  const {
    ocupado, onEntrar: aoEntrar, onSair: aoSair, onFila: aoEntrarNaFila,
    onAceitar: aoAceitar, onRecusar: aoRecusar,
  } = useOpenSlotActions();

  const hoje = todayISO();
  const idsNaFila = useMemo(
    () => new Set(minhaFila.map((f) => f.slot_id).filter(Boolean)),
    [minhaFila],
  );
  // As chamadas em aberto NESTA arena: a fila só vale se houver onde aceitar.
  const chamadas = useMemo(() => {
    const porId = new Map(slots.map((s) => [s.id, s]));
    return minhaFila
      .filter((f) => f.status === WAITLIST_STATUS.NOTIFIED && porId.has(f.slot_id))
      .map((f) => ({ entrada: f, slot: porId.get(f.slot_id) }));
  }, [minhaFila, slots]);

  const { meus, disponiveis } = useMemo(() => {
    const futuros = slots
      .filter((s) => String(s.date || '') >= hoje && s.status !== 'cancelled');
    return {
      meus: futuros.filter((s) => (s.participants || []).includes(user?.uid)),
      disponiveis: futuros.filter((s) => !(s.participants || []).includes(user?.uid)),
    };
  }, [slots, hoje, user?.uid]);

  if (isLoading || carregandoModulos) {
    return <V2Skeleton className="mx-auto h-96 max-w-[820px] rounded-4xl" />;
  }
  if (!arena) return <Navigate to="/arenas" replace />;
  if (!isOn(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH)) {
    return <Navigate to={`/arenas/${arena.id}`} replace />;
  }

  return (
    <div className="mx-auto max-w-[820px]">
      <Link
        to={`/arenas/${arena.id}`}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {arena.name}
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Jogos abertos</h1>
      <p className="mt-1 text-sm text-gray-500">
        Horários que a arena abriu para quem quiser entrar. Não precisa levar dupla.
      </p>

      {!isAuthenticated && (
        <V2Surface className="mt-4">
          <p className="text-sm text-gray-600">
            <Link to="/entrar" className="font-bold text-ink underline">Entre na sua conta</Link>{' '}
            para se inscrever nos jogos.
          </p>
        </V2Surface>
      )}

      {chamadas.length > 0 && (
        <div className="mt-5 space-y-3">
          {chamadas.map(({ entrada, slot }) => (
            <ChamadaDaFila
              key={entrada.id}
              entrada={entrada}
              slot={slot}
              ocupado={ocupado}
              onAceitar={aoAceitar}
              onRecusar={aoRecusar}
            />
          ))}
        </div>
      )}

      <div className="mt-5 space-y-4">
        {isError ? (
          <V2Surface>
            <p className="text-sm text-red-700">
              Não foi possível carregar os jogos abertos.{' '}
              <button type="button" className="font-bold underline" onClick={() => refetch()}>
                Tentar de novo
              </button>
            </p>
          </V2Surface>
        ) : carregando ? (
          <V2Skeleton className="h-56" />
        ) : (
          <>
            {meus.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  Você vai jogar
                </h2>
                {meus.map((s) => (
                  <VagaCard
                    key={s.id} slot={s} meuNivel={meuNivel} jaEstou
                    naFila={idsNaFila.has(s.id)} ocupado={ocupado}
                    onEntrar={aoEntrar} onSair={aoSair} onFila={aoEntrarNaFila}
                  />
                ))}
              </div>
            )}

            {disponiveis.length === 0 && meus.length === 0 ? (
              <V2Surface>
                <V2EmptyState
                  icon={Users}
                  title="Nenhum jogo aberto agora"
                  description={`A ${arena.name} ainda não publicou horários com vagas. Volte mais tarde ou reserve uma quadra.`}
                  action={(
                    <V2Button asChild variant="secondary">
                      <Link to={`/arenas/${arena.id}`}>Ver a arena</Link>
                    </V2Button>
                  )}
                />
              </V2Surface>
            ) : disponiveis.length > 0 && (
              <div className="space-y-3">
                {meus.length > 0 && (
                  <h2 className="pt-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                    Outros jogos
                  </h2>
                )}
                {disponiveis.map((s) => (
                  <VagaCard
                    key={s.id} slot={s} meuNivel={meuNivel} jaEstou={false}
                    naFila={idsNaFila.has(s.id)} ocupado={ocupado}
                    onEntrar={aoEntrar} onSair={aoSair} onFila={aoEntrarNaFila}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
