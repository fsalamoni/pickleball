/**
 * Torneios na tela inicial — o que abrir, o que acompanhar, o que organizar e
 * como foi o último (lógica pura).
 *
 * Quatro perguntas diferentes, quatro respostas diferentes, e todas passam
 * pela MESMA régua de "ainda vale" (`tournamentPhase`): torneio encerrado não
 * aparece como aberto, nem como destaque, nem como "em andamento".
 */
import { formatDateShortBR } from '../../arenas/domain/calendar.js';
import { normalizeLocality } from '../../arenas/domain/homeBanners.js';
import { TOURNAMENT_STATUS } from '../../tournament/domain/constants.js';
import {
  TOURNAMENT_PHASE, diaLocal, isTournamentCurrent, isTournamentOpen, prazoRelativo, tournamentPhase,
} from './freshness.js';

const uf = (v) => String(v || '').trim().toUpperCase().slice(0, 2);
const ADMIN_ROLES = new Set(['owner', 'admin']);

/** Quão perto de mim: 2 = minha cidade, 1 = meu estado, 0 = longe/desconhecido. */
export function proximidade(t, perfil = {}) {
  const minhaCidade = normalizeLocality(perfil?.city);
  const meuEstado = uf(perfil?.state);
  if (minhaCidade && normalizeLocality(t?.city) === minhaCidade
    && (!meuEstado || !t?.state || uf(t.state) === meuEstado)) return 2;
  if (meuEstado && uf(t?.state) === meuEstado) return 1;
  return 0;
}

/** "Inscrições até Qui, 01/10 (em 5 dias)" — ou `null` sem prazo. */
export function prazoTexto(t, hoje) {
  const prazo = diaLocal(t?.registration_deadline);
  if (!prazo) return null;
  const rel = prazoRelativo(prazo, hoje);
  if (rel === 'hoje') return 'Inscrições encerram hoje';
  return `Inscrições até ${formatDateShortBR(prazo, { hoje })}${rel ? ` (${rel})` : ''}`;
}

/** "Sáb, 03/10" ou "Sáb, 03/10 – Dom, 04/10" — ou `null` sem data. */
export function periodoTexto(t, hoje) {
  const ini = diaLocal(t?.starts_at);
  const fim = diaLocal(t?.ends_at);
  if (!ini && !fim) return null;
  if (ini && fim && fim !== ini) {
    return `${formatDateShortBR(ini, { hoje })} – ${formatDateShortBR(fim, { hoje })}`;
  }
  return formatDateShortBR(ini || fim, { hoje });
}

/** Local curto: "Porto Alegre / RS". */
export function localTexto(t) {
  const cidade = String(t?.city || '').trim();
  if (!cidade) return null;
  return t?.state ? `${cidade} / ${uf(t.state)}` : cidade;
}

/**
 * Torneios com inscrição aberta DE VERDADE (status + prazo), com os mais perto
 * de mim primeiro e, entre iguais, o prazo que vence antes (é o que a pessoa
 * pode perder).
 *
 * @param {Array<object>} publicos  `usePublicTournaments`
 * @param {{ hoje: string, perfil?: object, inscritos?: Set<string> }} ctx
 */
export function openTournamentsForMe(publicos = [], { hoje, perfil = {}, inscritos = new Set() } = {}) {
  return (publicos || [])
    .filter((t) => t?.id && isTournamentOpen(t, hoje))
    .map((t) => ({
      tournament: t,
      perto: proximidade(t, perfil),
      inscrito: inscritos.has(t.id),
      prazo: diaLocal(t.registration_deadline) || '9999-12-31',
      inicio: diaLocal(t.starts_at) || '9999-12-31',
    }))
    .sort((a, b) => b.perto - a.perto
      || a.prazo.localeCompare(b.prazo)
      || a.inicio.localeCompare(b.inicio)
      || String(a.tournament.name || '').localeCompare(String(b.tournament.name || '')))
    .map(({ tournament, perto, inscrito }) => ({ tournament, perto, inscrito }));
}

/** Torneios em que ESTOU INSCRITO e que ainda valem (abertos, por começar, rolando). */
export function myCurrentTournaments(meus = [], hoje) {
  return (meus || [])
    .filter((t) => t?.id && t.my_role === 'player' && isTournamentCurrent(t, hoje))
    .map((t) => ({ tournament: t, phase: tournamentPhase(t, hoje) }))
    .sort((a, b) => ordemFase(a.phase) - ordemFase(b.phase)
      || String(diaLocal(a.tournament.starts_at) || '9').localeCompare(String(diaLocal(b.tournament.starts_at) || '9')));
}

function ordemFase(fase) {
  return [
    TOURNAMENT_PHASE.LIVE, TOURNAMENT_PHASE.STALE, TOURNAMENT_PHASE.OPEN,
    TOURNAMENT_PHASE.UPCOMING, TOURNAMENT_PHASE.DRAFT,
  ].indexOf(fase);
}

/**
 * Torneios que EU ORGANIZO e que ainda pedem trabalho: rascunho, aberto, por
 * começar, rolando — e o "esquecido" (data de fim vencida sem encerrar), que é
 * justamente o que o organizador precisa ver para fechar.
 */
export function managedTournamentsForHome(meus = [], hoje) {
  return (meus || [])
    .filter((t) => t?.id && ADMIN_ROLES.has(t.my_role))
    .map((t) => ({ tournament: t, phase: tournamentPhase(t, hoje) }))
    .filter(({ phase }) => phase !== TOURNAMENT_PHASE.OVER)
    .sort((a, b) => ordemFase(a.phase) - ordemFase(b.phase)
      || String(diaLocal(a.tournament.starts_at) || '9').localeCompare(String(diaLocal(b.tournament.starts_at) || '9')));
}

/** O que o organizador precisa fazer, por fase (a frase do cartão). */
export function organizerHint(phase) {
  switch (phase) {
    case TOURNAMENT_PHASE.DRAFT: return 'Rascunho — publique quando estiver pronto';
    case TOURNAMENT_PHASE.OPEN: return 'Inscrições abertas';
    case TOURNAMENT_PHASE.UPCOMING: return 'Inscrições fechadas — hora do sorteio';
    case TOURNAMENT_PHASE.LIVE: return 'Acontecendo — lance os resultados';
    case TOURNAMENT_PHASE.STALE: return 'A data passou — encerre o torneio';
    default: return '';
  }
}

/**
 * O resultado do ÚLTIMO torneio que a pessoa disputou, a partir do histórico
 * (`useMyTournamentHistory`, já ordenado do mais recente).
 *
 * Conta o torneio que JÁ COMEÇOU e tem classificação com jogo (cancelado e
 * rascunho não contam; futuro ainda não tem resultado). Entre as modalidades,
 * a de melhor colocação relativa vem primeiro.
 *
 * ⚠️ A colocação é a da CLASSIFICAÇÃO da modalidade (vitórias + desempate
 * somados das fases), a mesma da aba Ranking do torneio — não a posição na
 * chave. A tela diz "na classificação" para não prometer pódio de mata-mata.
 *
 * @returns {null | { tournamentId, name, phase, when, entries, best, podio }}
 */
export function lastTournamentResult(historico = [], hoje) {
  for (const grupo of historico || []) {
    const t = grupo?.tournament;
    if (!t || t.status === TOURNAMENT_STATUS.CANCELLED || t.status === TOURNAMENT_STATUS.DRAFT) continue;
    const inicio = diaLocal(t.starts_at);
    if (inicio && inicio > hoje) continue;
    const entries = (grupo.entries || [])
      .filter((e) => e?.ranking?.started && Number.isFinite(e.ranking.position))
      .map((e) => ({
        modality: e.modality?.name || 'Modalidade',
        partnerName: e.partnerName || null,
        position: e.ranking.position,
        total: e.ranking.total,
        wins: e.ranking.wins || 0,
        losses: e.ranking.losses || 0,
        played: e.ranking.played || 0,
      }))
      .sort((a, b) => (a.position / (a.total || 1)) - (b.position / (b.total || 1)));
    if (entries.length === 0) continue;
    const phase = tournamentPhase(t, hoje);
    return {
      tournamentId: grupo.tournamentId || t.id,
      name: t.name || 'Torneio',
      phase,
      encerrado: t.status === TOURNAMENT_STATUS.FINISHED,
      when: periodoTexto(t, hoje),
      entries,
      best: entries[0],
      podio: entries[0].position <= 3,
    };
  }
  return null;
}

/** "3º de 12" */
export function colocacaoTexto(entry) {
  if (!entry) return '';
  return entry.total ? `${entry.position}º de ${entry.total}` : `${entry.position}º`;
}
