/**
 * Os TORNEIOS DA CASA na tela (Onda CB) — o que a página da arena precisa para
 * LISTAR os torneios, sem o motor do ranking.
 *
 * Mora separado de `houseRanking.js` de propósito: aquele arquivo importa a
 * classificação do dia de jogo e a do torneio (desempate, fases, chave), e a
 * página da arena — que todo visitante abre — só precisa ordenar uma lista.
 * Importar a ordem de lá jogava o motor inteiro no pacote da página.
 *
 * PURO. Sem React, sem Firebase.
 */
import { instanteEmMs } from '@/core/domain/instant.js';
import { TOURNAMENT_STATUS } from '@/modules/tournament/domain/constants.js';
import { formatDateShortBR } from './calendar.js';

/* ------------------------------------------------------------------ */
/*  Datas                                                             */
/* ------------------------------------------------------------------ */

function doisDigitos(n) {
  return String(n).padStart(2, '0');
}

/**
 * A data de um evento em `YYYY-MM-DD`.
 *
 * Texto ISO é cortado, não convertido: `'2026-09-25'` passado por `new Date`
 * vira meia-noite UTC, que no Brasil é o dia ANTERIOR. Instante (Timestamp,
 * Date, número) usa a data local.
 */
export function houseEventDate(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) return valor.slice(0, 10);
  const ms = instanteEmMs(valor);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

/** A data de um torneio: o fim, senão o começo, senão quando foi criado. */
export function tournamentHouseDate(t) {
  return houseEventDate(t?.ends_at) || houseEventDate(t?.starts_at) || houseEventDate(t?.created_at);
}

/* ------------------------------------------------------------------ */
/*  Os torneios da casa, na ordem em que interessam                   */
/* ------------------------------------------------------------------ */

const GRUPO_DO_STATUS = Object.freeze({
  [TOURNAMENT_STATUS.IN_PROGRESS]: 0,
  [TOURNAMENT_STATUS.REGISTRATIONS_OPEN]: 1,
  [TOURNAMENT_STATUS.REGISTRATIONS_CLOSED]: 1,
  [TOURNAMENT_STATUS.DRAFT]: 2,
  [TOURNAMENT_STATUS.FINISHED]: 3,
  [TOURNAMENT_STATUS.CANCELLED]: 4,
});

/**
 * Os torneios da casa (torneios da plataforma sediados na arena), na ordem
 * de quem olha: o que está rolando, o que vem aí (do mais próximo), e só
 * depois o que já terminou (do mais recente). Arquivado nunca aparece;
 * rascunho só para a arena (`includeDrafts`) — para o público ele ainda não
 * existe. Cancelado vai para o fim, e só para a arena.
 */
export function sortHouseTournaments(tournaments = [], { includeDrafts = false } = {}) {
  return (tournaments || [])
    .filter((t) => t?.id && t.archived !== true)
    .filter((t) => includeDrafts || (t.status !== TOURNAMENT_STATUS.DRAFT && t.status !== TOURNAMENT_STATUS.CANCELLED))
    .map((t) => ({ t, grupo: GRUPO_DO_STATUS[t.status] ?? 2, data: houseEventDate(t.starts_at) || tournamentHouseDate(t) }))
    .sort((a, b) => (a.grupo - b.grupo)
      || (a.grupo >= 3
        ? String(b.data).localeCompare(String(a.data))
        : String(a.data || '9999').localeCompare(String(b.data || '9999'))))
    .map((x) => x.t);
}

/** O tom do selo de status de um torneio da casa. */
export const HOUSE_TOURNAMENT_TONE = Object.freeze({
  [TOURNAMENT_STATUS.IN_PROGRESS]: 'acid',
  [TOURNAMENT_STATUS.REGISTRATIONS_OPEN]: 'green',
  [TOURNAMENT_STATUS.REGISTRATIONS_CLOSED]: 'amber',
  [TOURNAMENT_STATUS.DRAFT]: 'neutral',
  [TOURNAMENT_STATUS.FINISHED]: 'neutral',
  [TOURNAMENT_STATUS.CANCELLED]: 'red',
});

/** "Qui, 23/07" a partir de texto ISO ou Timestamp; vazio sem data. */
export function houseTournamentDateLabel(valor) {
  const iso = houseEventDate(valor);
  return iso ? formatDateShortBR(iso) : '';
}
