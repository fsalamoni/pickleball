/**
 * Pré-busca do que a página de uma arena precisa.
 *
 * ## Por que existe
 *
 * Abrir uma arena era uma FILA de esperas: baixar o pacote da tela, montar o
 * componente, só então pedir a arena, e só então pedir quadras, janelas,
 * reservas e bloqueios. Nada disso depende de nada — mas tudo acontecia em
 * série, porque a primeira consulta só nascia quando o código chegava.
 *
 * Quando alguém passa o dedo ou o mouse sobre o cartão de uma arena, a decisão
 * já está quase tomada. Esse instante é de graça: as consultas saem enquanto o
 * pacote da tela ainda está baixando, e quando a tela monta o dado já está no
 * cache — a página abre pintada.
 *
 * ## Cuidados
 *
 * - **Nunca sobrescreve dado mais novo.** Semear a arena a partir da lista usa
 *   `setQueryData` só quando não há nada guardado.
 * - **Não repete.** `prefetchQuery` respeita `staleTime`: passar o mouse dez
 *   vezes no mesmo cartão não gera dez buscas.
 * - **Falha em silêncio.** Pré-busca que estoura um erro na tela é pior do que
 *   não ter pré-busca: o usuário não pediu nada. O erro de verdade, se houver,
 *   aparece quando a tela abrir e a consulta de verdade rodar.
 *
 * Este módulo é carregado sob demanda (import dinâmico em `useArenaPrefetch`),
 * para que o serviço de reservas não entre no pacote da LISTA de arenas.
 */

import { arenaKeys } from './arenaKeys.js';
import { arenaQueries } from './arenaQueries.js';
import { arenaBookingsQuery } from './useBookings.js';

/** Quanto tempo uma pré-busca vale antes de valer a pena repetir. */
const VALIDADE_MS = 60_000;

/**
 * Coloca no cache o que a página da arena vai pedir.
 *
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {string} arenaId
 * @param {{ arena?: object|null }} [ctx] a arena já conhecida (o cartão da
 *   lista tem o documento inteiro em mãos — não há motivo para buscá-lo de novo)
 * @returns {Promise<void>} resolve quando tudo terminou; erros não propagam
 */
export async function prefetchArena(queryClient, arenaId, { arena = null } = {}) {
  if (!queryClient || !arenaId) return;

  if (arena?.id === arenaId && queryClient.getQueryData(arenaKeys.arena(arenaId)) === undefined) {
    queryClient.setQueryData(arenaKeys.arena(arenaId), arena);
  }

  const consultas = [
    arenaQueries.arena(arenaId),
    arenaQueries.quadras(arenaId),
    arenaQueries.janelas(arenaId),
    arenaQueries.bloqueios(arenaId, undefined, undefined),
    arenaBookingsQuery(arenaId),
  ];

  await Promise.all(consultas.map((opcoes) => queryClient
    .prefetchQuery({ staleTime: VALIDADE_MS, ...opcoes })
    .catch(() => {})));
}
