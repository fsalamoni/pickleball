/**
 * "Jogos abertos" — a seção da página da arena (módulos de matchmaking).
 *
 * Antes o jogo aberto e o buscar parceiro eram dois BOTÕES no topo da página,
 * levando para telas separadas: quem chegava na arena não via que havia jogo
 * com vaga hoje, a não ser que adivinhasse o que o botão fazia. Agora a
 * pergunta "tem jogo aqui em que eu caiba?" é respondida no fluxo da página,
 * com o botão de entrar ali mesmo.
 *
 * Ordem, e o porquê:
 *  1. **a chamada da fila** — tem prazo; perder o prazo passa a vaga adiante;
 *  2. **os meus jogos** — para não entrar duas vezes e saber para quando é;
 *  3. **até 3 jogos** — os que cabem no meu nível primeiro;
 *  4. **buscar parceiro** — para quem não achou jogo pronto.
 *
 * Some por inteiro quando não há o que mostrar (módulos desligados, ou
 * nenhum jogo e sem buscar parceiro). Falha de leitura NÃO some: vira aviso
 * com "tentar de novo" — sumir seria dizer que não há jogo.
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Swords, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { useArenaOpenSlots, useUserWaitlist } from '@/modules/arenas/hooks/useArenaV3';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { openMatchSectionModel } from '@/modules/arenas/domain/openMatchView';
import { useMyUnifiedLevel } from '@/modules/rating/hooks/useMyUnifiedLevel';
import { OpenSlotRow, WaitlistCallCard } from './OpenSlotCard';
import { useOpenSlotActions } from './useOpenSlotActions';
import { V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

export default function ArenaOpenMatchSection({ arena }) {
  const arenaId = arena?.id;
  const { user, isAuthenticated } = useAuth();
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);
  const jogoAberto = isOn(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH);
  const parceiro = isOn(ARENA_MODULE_ID.MATCHMAKING_PARTNER_FINDER);

  const slotsQ = useArenaOpenSlots(jogoAberto ? arenaId : null);
  const { data: minhaFila = [] } = useUserWaitlist();
  const { level } = useMyUnifiedLevel();
  const acoes = useOpenSlotActions();

  const modelo = useMemo(() => openMatchSectionModel({
    slots: slotsQ.data || [], uid: user?.uid, level, waitlist: minhaFila,
  }), [slotsQ.data, user?.uid, level, minhaFila]);
  const naFila = useMemo(
    () => new Set(minhaFila.filter((f) => f.status === 'waiting').map((f) => f.slot_id)),
    [minhaFila],
  );

  if (modulosCarregando || (!jogoAberto && !parceiro)) return null;

  const falhou = jogoAberto && slotsQ.isError;
  const carregando = jogoAberto && slotsQ.isLoading;
  const temJogo = modelo.chamadas.length + modelo.meus.length + modelo.destaque.length > 0;
  // Sem jogo e sem buscar parceiro, a seção não tem o que oferecer.
  if (!falhou && !carregando && !temJogo && !parceiro) return null;

  const todos = `/arenas/${arenaId}/open-match`;
  const linha = (s, jaEstou) => (
    <OpenSlotRow
      key={s.id} slot={s} meuNivel={level} jaEstou={jaEstou} naFila={naFila.has(s.id)}
      semConta={!isAuthenticated} ocupado={acoes.ocupado}
      onEntrar={acoes.onEntrar} onSair={acoes.onSair} onFila={acoes.onFila}
    />
  );

  return (
    <V2Surface className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
          <Users className="h-4 w-4" /> {jogoAberto ? 'Jogos abertos' : 'Parceiros para jogar aqui'}
        </h3>
        {jogoAberto && modelo.total > 0 && (
          <Link to={todos} className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
            Ver todos ({modelo.total}) <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {jogoAberto && (
        <p className="mt-1 text-xs text-gray-500">
          Horários que a arena abriu para quem quiser entrar — não precisa levar dupla.
        </p>
      )}

      {falhou && (
        <V2ErrorState inline className="mt-3" title="Não foi possível carregar os jogos abertos"
          description="Os jogos continuam lá — tente de novo." onRetry={() => slotsQ.refetch()} />
      )}
      {carregando && <V2Skeleton className="mt-3 h-20 rounded-2xl" />}

      {modelo.chamadas.length > 0 && (
        <div className="mt-3 space-y-2">
          {modelo.chamadas.map(({ entrada, slot }) => (
            <WaitlistCallCard key={entrada.id} entrada={entrada} slot={slot} ocupado={acoes.ocupado}
              onAceitar={acoes.onAceitar} onRecusar={acoes.onRecusar} />
          ))}
        </div>
      )}

      {modelo.meus.length > 0 && (
        <>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-gray-500">Você vai jogar</p>
          <ul className="mt-2 space-y-2">{modelo.meus.map((s) => linha(s, true))}</ul>
        </>
      )}

      {modelo.destaque.length > 0 && (
        <>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-gray-500">
            {modelo.meus.length > 0 ? 'Outros jogos' : 'Com vaga'}
          </p>
          <ul className="mt-2 space-y-2">{modelo.destaque.map((s) => linha(s, false))}</ul>
        </>
      )}

      {parceiro && (
        <Link
          to={`/arenas/${arenaId}/matchmaking`}
          className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper px-4 py-3 text-sm font-bold text-ink transition-colors hover:border-ink/30"
        >
          <span className="inline-flex items-center gap-2">
            <Swords className="h-4 w-4" />
            {temJogo ? 'Prefere montar o seu jogo? Veja quem joga aqui no seu nível' : 'Veja quem joga aqui no seu nível e combine um jogo'}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      )}
    </V2Surface>
  );
}
