/**
 * As chaves de cache da arena, num lugar só.
 *
 * Existem porque a PRÉ-BUSCA e o HOOK precisam concordar bit a bit: uma chave
 * escrita duas vezes é uma chave que um dia diverge, e quando diverge o
 * sintoma não é erro — é a tela buscando de novo o que já estava em cache,
 * silenciosamente, para sempre. Aqui elas nascem da mesma função, e há teste
 * travando a igualdade.
 *
 * Puras: nada de React, nada de Firestore.
 */

export const arenaKeys = Object.freeze({
  /** A lista pública de arenas. */
  lista: () => ['arenas'],
  /** Uma arena. */
  arena: (id) => ['arena', id],
  /** Quadras da arena (ordenadas). */
  quadras: (id) => ['arena-courts', id],
  /** Janelas de funcionamento (todas as quadras). */
  janelas: (id) => ['arena-court-schedules', id],
  /** Reservas da arena. */
  reservas: (id) => ['arena-bookings', id],
  /** Bloqueios do admin. O recorte de datas faz parte da chave. */
  bloqueios: (id, from, to) => ['arena-unavailabilities', id, from, to],
});

/**
 * O que uma arena precisa ter em mãos para a página abrir pronta.
 *
 * A ordem importa: é a ordem em que a tela usa. A arena primeiro (cabeçalho),
 * depois quadras e janelas (a grade do mês já desenha), e por fim reservas e
 * bloqueios (o que pinta a ocupação).
 */
export const ARENA_PREFETCH_ORDER = Object.freeze(['arena', 'quadras', 'janelas', 'reservas', 'bloqueios']);
