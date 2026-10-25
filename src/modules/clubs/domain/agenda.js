/**
 * AGENDA OFICIAL DO CLUBE-ASSOCIAÇÃO (Bloco D2b) — lógica pura. O evento, a validação,
 * o horário e o arquivo de calendário são os da federação
 * (`modules/federations/domain/agenda.js`); o clube só troca quem cuida de quê
 * (`sports` = a diretoria esportiva, o que na federação é `competitions`) e os
 * endereços das páginas.
 *
 * ⚠️ A régua de "quem marca o quê" tem cópia no servidor (`functions/clubAgenda.js`,
 * `podeTipo`), com paridade em `functions/clubAgenda.parity.test.js`. Os ids de tipo
 * e de situação são GRAVADOS: nunca renomeie.
 */
import { CLUB_PERM } from './association.js';

/** As permissões do clube na linguagem da agenda da federação (`competitions` = `sports`). */
export const clubAgendaPerms = (perms = []) => perms.map((p) => (p === CLUB_PERM.SPORTS ? 'competitions' : p));

/** Quem usa a agenda do clube: a secretaria (`docs`), a diretoria esportiva (`sports`) e a administração. */
export const canUseClubAgenda = (perms = []) => [CLUB_PERM.ADMIN, CLUB_PERM.DOCS, CLUB_PERM.SPORTS].some((p) => perms.includes(p));

/**
 * O endereço da agenda (ou de um evento) na página do clube. `publica`: a vitrine sem login
 * (`/c/:clubId?evento=`, `?agenda=1`), em vez da página do app (`/clubes/:id?tab=agenda`).
 */
export function clubAgendaPath(clubId, eventId, { publica = false } = {}) {
  const id = encodeURIComponent(clubId);
  if (publica) return `/c/${id}${eventId ? `?evento=${encodeURIComponent(eventId)}` : '?agenda=1'}`;
  return `/clubes/${id}?tab=agenda${eventId ? `&evento=${encodeURIComponent(eventId)}` : ''}`;
}

/** A agenda assinável (só o que é público), servida pela função `federationAgendaFeed`. */
export const clubAgendaFeedPath = (clubId) => `/api/agenda/clube/${encodeURIComponent(clubId)}.ics`;
