/**
 * A LIGA NA VIDA DO ATLETA, fora da página da liga: os jogos que ele AINDA VAI
 * jogar ("Próximos" de Meus jogos e da Carreira) e a participação dele em cada
 * liga (a linha do tempo da Carreira). DERIVADO do que a liga já guarda —
 * nada é gravado.
 *
 * A data do jogo: a que a organização marcou no jogo (`scheduled_date`) e, na
 * falta, a da RODADA no calendário da temporada (`roundCalendar`). Playoff e
 * escada não têm rodada com data: ficam "a combinar".
 *
 * Puro: recebe os documentos já lidos.
 */
import { instanteEmMs } from '@/core/domain/instant.js';
import { t } from '@/core/i18n';
import { LEAGUE_STATUS, isTeamFormat } from './leagueFormats.js';
import { matchSideEntries } from './leagueRankingGames.js';
import { matchWinner } from './leagueResults.js';
import { isIsoDate, normalizeSeason, roundCalendar } from './leagueSeason.js';

/** Liga em que ainda se joga. */
const EM_JOGO = Object.freeze([LEAGUE_STATUS.OPEN, LEAGUE_STATUS.RUNNING]);
/** Liga que conta na história do atleta (rascunho e cancelada ficam de fora). */
const NA_HISTORIA = Object.freeze([LEAGUE_STATUS.OPEN, LEAGUE_STATUS.RUNNING, LEAGUE_STATUS.FINISHED]);

const minhaInscricao = (uid) => (e) => Array.isArray(e?.player_uids) && e.player_uids.includes(uid);

/**
 * Os jogos de liga que a pessoa ainda vai jogar, do mais próximo ao mais
 * distante (os sem data por último).
 *
 * @param {string} uid
 * @param {object} league liga (com `id`)
 * @param {Array<object>} entries inscrições (com `id`) — as da pessoa e as adversárias
 * @param {Array<object>} matches jogos da pessoa (com `id`)
 * @returns {Array<{ id: string, leagueId: string, leagueName: string, matchId: string, phase: string, round: number|null,
 *   date: string|null, deadline: string|null, time: string, team: string, partner: string, opponent: string }>}
 */
export function leagueUpcomingOfPlayer(uid, league, entries, matches) {
  if (!uid || !league || !EM_JOGO.includes(league.status)) return [];
  const porId = new Map((entries || []).map((e) => [e.id, e]));
  const meus = new Set((entries || []).filter((e) => minhaInscricao(uid)(e) && e.status !== 'withdrawn').map((e) => e.id));
  if (!meus.size) return [];
  const equipe = isTeamFormat(league.format);
  const nomes = (ids, semMim = false) => (equipe
    ? ids.map((id) => porId.get(id)?.name || t('Equipe'))
    : ids.flatMap((id) => (porId.get(id)?.players || []).filter((p) => !(semMim && p?.uid === uid)).map((p) => String(p?.name || '').trim() || t('Atleta'))));
  const pendentes = (matches || []).filter((m) => m && m.status === 'scheduled' && !matchWinner(m));
  const fase = (m) => m.phase || 'season';
  const rodadas = Math.max(0, ...pendentes.filter((m) => fase(m) === 'season').map((m) => Number(m.round) || 0));
  const calendario = roundCalendar(league.season, rodadas);
  const hora = normalizeSeason(league.season).play_time;
  return pendentes.map((m) => {
    const [a, b] = matchSideEntries(m);
    const lado = a.some((id) => meus.has(id)) ? 'a' : (b.some((id) => meus.has(id)) ? 'b' : null);
    if (!lado) return null;
    const meuLado = lado === 'a' ? a : b;
    const deles = lado === 'a' ? b : a;
    // Adversário que saiu da liga: o jogo não vai acontecer.
    if (deles.some((id) => porId.get(id)?.status === 'withdrawn')) return null;
    const rodada = fase(m) === 'season' ? calendario[(Number(m.round) || 0) - 1] : null;
    return {
      id: `lg_${league.id}_${m.id}`,
      leagueId: league.id,
      leagueName: league.name || t('Liga'),
      matchId: m.id,
      phase: fase(m),
      round: Number(m.round) || null,
      date: isIsoDate(m.scheduled_date) ? m.scheduled_date : (rodada?.date || null),
      deadline: rodada?.deadline || null,
      time: hora,
      team: equipe ? nomes(meuLado).join(' / ') : '',
      partner: equipe ? '' : nomes(meuLado, true).join(' / '),
      opponent: nomes(deles).join(' / ') || t('A definir'),
    };
  }).filter(Boolean).sort((x, y) => (x.date || '9999').localeCompare(y.date || '9999') || (x.round || 0) - (y.round || 0));
}

/**
 * A participação da pessoa em UMA liga, uma por inscrição (divisão): o que a
 * linha do tempo da Carreira mostra. Quem saiu sem jogar não tem história.
 *
 * @param {string} uid
 * @param {object} league liga (com `id`)
 * @param {Array<object>} divisions divisões da liga (com `id`, `name`)
 * @param {Array<object>} entries inscrições (com `id`)
 * @param {Array<object>} matches jogos da pessoa (com `id`)
 * @returns {Array<{ id: string, leagueId: string, divisionId: string|null, entryId: string, name: string, divisionName: string,
 *   status: string, withdrawn: boolean, startDate: string|null, endedAt: number|null, joinedAt: number|null,
 *   city: string, state: string, wins: number, losses: number }>}
 */
export function leagueSeasonsOfPlayer(uid, league, divisions, entries, matches) {
  if (!uid || !league || !NA_HISTORIA.includes(league.status)) return [];
  const nomeDaDivisao = new Map((divisions || []).map((d) => [d.id, String(d.name || '').trim()]));
  const encerrada = league.status === LEAGUE_STATUS.FINISHED;
  return (entries || []).filter(minhaInscricao(uid)).map((e) => {
    let wins = 0;
    let losses = 0;
    let ultimo = 0;
    (matches || []).forEach((m) => {
      const [a, b] = matchSideEntries(m);
      const lado = a.includes(e.id) ? 'a' : (b.includes(e.id) ? 'b' : null);
      const venceu = lado && matchWinner(m);
      if (!venceu) return;
      if (venceu === lado) wins += 1; else losses += 1;
      ultimo = Math.max(ultimo, instanteEmMs(m.recorded_at) || 0);
    });
    const withdrawn = e.status === 'withdrawn';
    if (withdrawn && wins + losses === 0) return null;
    return {
      id: `${league.id}:${e.id}`,
      leagueId: league.id,
      divisionId: e.division_id || null,
      entryId: e.id,
      name: league.name || t('Liga'),
      // Liga de uma divisão só: o nome dela não acrescenta nada.
      divisionName: (divisions || []).length > 1 ? (nomeDaDivisao.get(e.division_id) || '') : '',
      status: league.status,
      withdrawn,
      startDate: normalizeSeason(league.season).start_date,
      endedAt: encerrada ? (ultimo || instanteEmMs(league.updated_at) || null) : null,
      joinedAt: instanteEmMs(e.created_at) || instanteEmMs(league.created_at) || null,
      city: league.city || '',
      state: league.state || '',
      wins,
      losses,
    };
  }).filter(Boolean);
}
