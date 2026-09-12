/**
 * useGameDayRoles — o que ESTA pessoa pode fazer NESTE dia de jogo.
 *
 * Existe para não espalhar a mesma pergunta por cinco telas. Antes, cada uma
 * chamava `canManageGameDay(gameDay, uid, { participants })` por conta
 * própria; com o dia de jogo de arena entrou um terceiro caminho — quem
 * gerencia a ARENA administra o dia — e repetir isso em cinco lugares seria
 * garantir que um deles ficasse para trás.
 *
 * ## Por que não custa consulta nenhuma
 *
 * `useMyManagedArenas` já é buscado pelo `V2Layout` (via `useMyArenaSummary`)
 * em toda tela autenticada, sob a mesma chave de React Query. Aqui ele volta
 * do cache. Num dia de jogo de atleta o resultado nem é usado.
 *
 * ## O que isto NÃO é
 *
 * Não é segurança. Decide o que a TELA mostra; quem recusa de verdade é a
 * regra do Firestore (`isArenaManager(arena_id)` e as demais).
 */

import { useMemo } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { isArenaGameDay } from '../domain/arenaGameDay.js';
import {
  canConfigureGameDay, canManageGameDay, isGameDayAdmin, isGameDayCreator,
} from '../domain/gameDayRoles.js';

/**
 * @param {object|null} gameDay
 * @param {Array<object>|null} [participants] a lista real de inscritos — é ela
 *   que decide se quem olha gerencia num dia ABERTO. Sem ela, o domínio cai em
 *   `member_uids`, que inclui convidados que ainda não entraram.
 * @returns {{
 *   uid: string|null,
 *   ehCriador: boolean,
 *   ehGestorDaArena: boolean,
 *   ehAdmin: boolean,
 *   podeGerenciar: boolean,
 *   podeConfigurar: boolean,
 * }}
 */
export function useGameDayRoles(gameDay, participants = null) {
  const { user } = useAuth();
  const { data: arenasGeridas = [] } = useMyManagedArenas();
  const uid = user?.uid || null;

  return useMemo(() => {
    const ehGestorDaArena = isArenaGameDay(gameDay)
      && (arenasGeridas || []).some((a) => a?.id === gameDay.arena_id);
    const opts = { participants, arenaManager: ehGestorDaArena };
    return {
      uid,
      ehCriador: isGameDayCreator(gameDay, uid),
      ehGestorDaArena,
      ehAdmin: isGameDayAdmin(gameDay, uid, { arenaManager: ehGestorDaArena }),
      podeGerenciar: canManageGameDay(gameDay, uid, opts),
      podeConfigurar: canConfigureGameDay(gameDay, uid, { arenaManager: ehGestorDaArena }),
    };
  }, [gameDay, participants, arenasGeridas, uid]);
}
