/**
 * As consultas da arena — chave E função de busca no mesmo lugar.
 *
 * O hook e a PRÉ-BUSCA precisam concordar nas duas coisas. Na chave, porque
 * chave diferente é cache que nunca se encontra; na função, porque é ela que
 * decide o FORMATO guardado (quadras e janelas saem ordenadas daqui — se a
 * pré-busca guardasse a lista crua, a tela receberia do cache uma ordem e da
 * rede outra, e a lista pularia na frente da pessoa).
 *
 * Só consultas do `arenaService`: as de reserva moram em `useBookings.js`, de
 * propósito. Este arquivo entra no pacote que TODA tela carrega (o menu
 * pergunta quais arenas você gere), e puxar o serviço de reservas para cá
 * levaria junto o módulo inteiro de reservas.
 */

import {
  getArena,
  listArenaCourts,
  listArenaCourtSchedules,
  listArenaUnavailabilities,
} from '../services/arenaService.js';
import { sortCourts } from '../domain/court.js';
import { sortSchedules } from '../domain/court_schedule.js';
import { arenaKeys } from './arenaKeys.js';

export const arenaQueries = Object.freeze({
  arena: (id) => ({
    queryKey: arenaKeys.arena(id),
    queryFn: () => getArena(id),
  }),
  quadras: (id) => ({
    queryKey: arenaKeys.quadras(id),
    queryFn: async () => sortCourts(await listArenaCourts(id)),
    staleTime: 30_000,
  }),
  janelas: (id) => ({
    queryKey: arenaKeys.janelas(id),
    queryFn: async () => sortSchedules(await listArenaCourtSchedules(id)),
    staleTime: 60_000,
  }),
  bloqueios: (id, from, to) => ({
    queryKey: arenaKeys.bloqueios(id, from, to),
    queryFn: () => listArenaUnavailabilities(id, { from, to }),
  }),
});
