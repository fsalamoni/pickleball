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
  /**
   * O PREFIXO de todos os bloqueios de uma arena, para invalidar de uma vez.
   *
   * Existe porque cada recorte de datas é uma consulta diferente: quem fecha
   * uma quadra não sabe quais meses estão em cache, e invalidar só o mês
   * corrente deixaria os outros mostrando a quadra à venda.
   */
  bloqueiosDaArena: (id) => ['arena-unavailabilities', id],
  /**
   * Os torneios DA CASA (`arena_internal_tournaments`, módulo `leagues`).
   *
   * 🐞 Antes a chave era `['arena-tournaments', id, filtros]` — o PREFIXO da
   * chave dos torneios DA PLATAFORMA sediados na arena
   * (`['arena-tournaments', id]`, em `tournament/hooks`). Duas coleções, duas
   * listas, uma chave encaixada na outra: invalidar uma derrubava a outra, e
   * qualquer chamada sem filtro passaria a ler uma no cache da outra.
   */
  torneiosDaCasa: (id, filtros = {}) => ['arena-internal-tournaments', id, filtros],
  /** O prefixo de todos os torneios da casa de uma arena (para invalidar). */
  torneiosDaCasaDaArena: (id) => ['arena-internal-tournaments', id],
  /** A classificação acumulada (ladder) de um período. */
  ladder: (id, periodo = 'geral') => ['arena-ladder', id, periodo],
  /** Módulos que ESTA arena ligou (camada 2). */
  modulos: (id) => ['arena-module-states', id],
  /** Módulos que a PLATAFORMA liberou (camada 1). Global, sem arena. */
  modulosPlataforma: () => ['platform-arena-modules'],
});

/**
 * O que uma arena precisa ter em mãos para a página abrir pronta.
 *
 * A ordem importa: é a ordem em que a tela usa. A arena primeiro (cabeçalho),
 * depois quadras e janelas (a grade do mês já desenha), e por fim reservas e
 * bloqueios (o que pinta a ocupação).
 */
export const ARENA_PREFETCH_ORDER = Object.freeze(['arena', 'quadras', 'janelas', 'reservas', 'bloqueios']);
