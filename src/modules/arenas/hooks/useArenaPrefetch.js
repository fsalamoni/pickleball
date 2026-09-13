/**
 * `useArenaPrefetch()` — devolve uma função para chamar quando alguém
 * demonstra intenção de abrir uma arena (passar o mouse, focar pelo teclado,
 * encostar o dedo).
 *
 * O trabalho de verdade mora em `arenaPrefetch.js`, carregado por import
 * DINÂMICO: ele conhece o serviço de reservas, e este hook é usado na LISTA de
 * arenas — importá-lo direto jogaria o módulo de reservas dentro do pacote da
 * lista, que hoje tem 5 kB. O import só acontece na primeira intenção, em
 * paralelo com as consultas.
 */

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useArenaPrefetch() {
  const queryClient = useQueryClient();
  // Uma pré-busca por arena por montagem da lista basta: `prefetchQuery` já
  // não repete busca fresca, mas nem o import dinâmico nem a promessa
  // precisam ser refeitos a cada pixel que o mouse anda sobre o cartão.
  const pedidas = useRef(new Set());

  return useCallback((arenaId, arena = null) => {
    if (!arenaId || pedidas.current.has(arenaId)) return;
    pedidas.current.add(arenaId);
    import('./arenaPrefetch.js')
      .then((m) => m.prefetchArena(queryClient, arenaId, { arena }))
      .catch(() => { pedidas.current.delete(arenaId); });
  }, [queryClient]);
}
