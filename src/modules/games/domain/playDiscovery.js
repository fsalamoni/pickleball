/**
 * JOGOS COM VAGA — a lista única de "onde dá para jogar" (lógica pura).
 *
 * ## O defeito que esta lista corrige
 *
 * *"Para muitos usuários, na página início, na sessão 'jogar', não estão
 * aparecendo os dias de jogo abertos e com vaga."*
 *
 * O "Jogar" lia só duas fontes: os convites de "Procura-se jogo"
 * (`open_games`) e os jogos abertos das arenas. O **dia de jogo que a arena
 * marca no calendário** — público, com vagas — nunca cria convite (de
 * propósito: o canal dele era a página da arena), e por isso **nunca aparecia
 * no início nem em Procura-se jogo**. O card prometia "Dias de jogo e jogos
 * com vaga perto de você, das arenas e dos atletas" e entregava metade.
 *
 * ## As fontes, e quem representa cada jogo
 *
 * | fonte | o que é | vira |
 * |---|---|---|
 * | `game_days` públicos dos próximos 30 dias | dia de jogo do ATLETA ou da ARENA | um item "dia de jogo" |
 * | `arena_open_slots` | o JOGO ABERTO (a vitrine: nível, valor, fila) | um item "jogo aberto" |
 * | `open_games` | o convite solto — e o espelho do dia de jogo do atleta | um item "convite" |
 *
 * Um jogo, um item: o dia de jogo que nasceu de um JOGO ABERTO aparece pela
 * vitrine dele (a mesma regra da página da arena), e o espelho em `open_games`
 * só aparece quando o dia de jogo não veio na lista (sem data, ou além da
 * janela) — dia de jogo arquivado ou que virou privado deixa o espelho órfão,
 * e órfão não aparece.
 *
 * ## "O que já passou, não mostre mais"
 *
 * - dia de jogo: some quando TERMINA (a faixa de horário da arena; o atleta
 *   informa só o início — contamos 3 horas; sem hora, vale até o fim do dia);
 * - jogo aberto: some quando COMEÇA (é quando a vaga deixa de fazer sentido);
 * - convite com data: vale até o fim do dia; sem data ("sábado de manhã"),
 *   vale 14 dias desde a última atualização — convite solto não vive para
 *   sempre.
 *
 * E não aparece o que a pessoa já tem: o dia de jogo em que ela já está (ele
 * mora na agenda) e o que ela mesma criou.
 */
import { formatDateISO, formatDateShortBR } from '../../arenas/domain/calendar.js';
import { toMillis } from '../../tournament/domain/participation.js';
import { getAvailableSpots } from '../../arenas/domain/openMatch.js';
import {
  arenaGameDayTimeRange, arenaGameDayVacancies, isArenaGameDay, normalizeCapacity, arenaGameDaySlots,
  ARENA_SIGNUP_MODE, arenaSignupMode,
} from './arenaGameDay.js';

export const PLAY_KIND = Object.freeze({
  DIA: 'dia',
  JOGO_ABERTO: 'jogo_aberto',
  CONVITE: 'convite',
});

/** Quantos dias à frente o "Jogar" olha. O Firestore aceita até 30 valores num `in`. */
export const PLAY_WINDOW_DAYS = 30;
/** Um convite sem data vale por quantos dias desde a última atualização. */
export const UNDATED_INVITE_DAYS = 14;
/** Quanto dura um dia de jogo do atleta que só informou o início. */
export const ATHLETE_GAME_DAY_HOURS = 3;

const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Os `n` dias a partir de hoje (dia local), como 'YYYY-MM-DD'. */
export function nextDaysISO(hoje, n = PLAY_WINDOW_DAYS) {
  const m = String(hoje || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return [];
  const total = Math.max(1, Math.min(PLAY_WINDOW_DAYS, Math.trunc(n) || 1));
  return Array.from({ length: total }, (_, i) => (
    formatDateISO(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + i))
  ));
}

/** Dia + hora locais → ms (sem hora: o fim do dia). */
function instante(dia, hora, { fimDoDia = true } = {}) {
  const m = String(dia || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return NaN;
  const [hh, mm] = HORA.test(String(hora || '')) ? hora.split(':').map(Number) : (fimDoDia ? [23, 59] : [0, 0]);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hh, mm, 0, 0).getTime();
}

/** Quando o dia de jogo começa (ms), para ordenar. */
export function gameDayStartsAt(gd) {
  if (!gd?.date) return NaN;
  if (isArenaGameDay(gd)) return instante(gd.date, arenaGameDayTimeRange(gd)?.start, { fimDoDia: false });
  return instante(gd.date, gd.time, { fimDoDia: false });
}

/** Quando o dia de jogo TERMINA (ms) — depois disso ele "já passou". */
export function gameDayEndsAt(gd) {
  if (!gd?.date) return NaN;
  if (isArenaGameDay(gd)) {
    const faixa = arenaGameDayTimeRange(gd);
    return instante(gd.date, faixa?.end);
  }
  if (HORA.test(String(gd.time || ''))) {
    return instante(gd.date, gd.time) + ATHLETE_GAME_DAY_HOURS * 3_600_000;
  }
  return instante(gd.date, null);
}

/** Onde é o dia de jogo: a cidade dele ou, na arena, a da arena. */
export function gameDayPlace(gd, arenasById = null) {
  const arena = gd?.arena_id && arenasById ? arenasById.get?.(gd.arena_id) || arenasById[gd.arena_id] : null;
  return {
    city: gd?.city || gd?.arena_city || arena?.city || '',
    state: gd?.state || gd?.arena_state || arena?.state || '',
  };
}

/** O dia de jogo da arena tem teto de vagas? (senão, não precisa contar inscritos) */
export function arenaGameDayHasLimit(gd) {
  if (!isArenaGameDay(gd)) return false;
  if (arenaSignupMode(gd) === ARENA_SIGNUP_MODE.COURT) {
    return arenaGameDaySlots(gd).length > 0 && arenaGameDaySlots(gd).every((s) => normalizeCapacity(s?.capacity) != null);
  }
  return normalizeCapacity(gd.capacity) != null;
}

/** Vagas que sobram num dia de jogo da arena (`null`: sem limite, ou desconhecido). */
export function gameDayVacanciesLeft(gd, participants) {
  if (!arenaGameDayHasLimit(gd) || !Array.isArray(participants)) return null;
  const v = arenaGameDayVacancies(gd, participants);
  if (v.mode === ARENA_SIGNUP_MODE.COURT) return v.byCourt.reduce((a, c) => a + (c.left ?? 0), 0);
  return v.left;
}

/** Instante que ordena: desconhecido vai para o fim. */
const ordem = (ms) => (Number.isFinite(ms) ? ms : Infinity);

const vagasTexto = (n) => (n == null ? null : `${n} ${n === 1 ? 'vaga' : 'vagas'}`);

/**
 * A lista única de jogos com vaga, do mais cedo para o mais tarde.
 *
 * @param {{
 *   diasPublicos?: object[],       `listUpcomingPublicGameDays`
 *   vagas?: object[],              jogos abertos já filtrados por `openSlotsForDiscovery`
 *   convites?: object[],           `listOpenGames`
 *   inscritosPorDia?: Map<string, object[]|undefined>, inscritos dos dias da arena com teto
 *   arenasById?: Map<string, object>,
 *   uid?: string|null,
 *   meusDias?: Set<string>,        ids dos dias de jogo em que eu já estou
 *   hoje: string, agora: number,
 * }} fontes
 * @returns {Array<{
 *   key: string, kind: string, id: string, link: string, inicio: number,
 *   title: string, subtitle: string, place: { city: string, state: string },
 *   vagas: number|null, badge: string|null, daArena: boolean,
 * }>}
 */
export function buildPlayList({
  diasPublicos = [], vagas = [], convites = [], inscritosPorDia = new Map(), arenasById = new Map(),
  uid = null, meusDias = new Set(), hoje, agora,
} = {}) {
  const itens = [];
  const janela = nextDaysISO(hoje);
  const ultimoDia = janela[janela.length - 1] || hoje;
  const diasListados = new Set();

  (diasPublicos || []).forEach((gd) => {
    if (!gd?.id) return;
    diasListados.add(gd.id);
    if (gd.status === 'archived' || gd.visibility !== 'public') return;
    // O jogo aberto aparece pela vitrine dele (nível, valor, fila).
    if (gd.open_slot_id) return;
    if (gd.created_by === uid || meusDias.has(gd.id) || (uid && (gd.member_uids || []).includes(uid))) return;
    if (!DIA_ISO.test(String(gd.date || '')) || !(gameDayEndsAt(gd) > agora)) return;
    const daArena = isArenaGameDay(gd);
    const vagasLivres = daArena ? gameDayVacanciesLeft(gd, inscritosPorDia.get(gd.id)) : null;
    if (vagasLivres === 0) return; // lotado
    const faixa = daArena ? arenaGameDayTimeRange(gd) : null;
    const hora = daArena ? (faixa ? `${faixa.start}–${faixa.end}` : '') : (gd.time || '');
    const place = gameDayPlace(gd, arenasById);
    const onde = daArena
      ? (gd.arena_name || arenasById.get?.(gd.arena_id)?.name || 'Arena')
      : [gd.creator_name, place.city].filter(Boolean).join(' · ');
    itens.push({
      key: `dia:${gd.id}`,
      kind: PLAY_KIND.DIA,
      id: gd.id,
      link: `/dia-de-jogo/${gd.id}`,
      inicio: ordem(gameDayStartsAt(gd)),
      title: gd.title || 'Dia de jogo',
      subtitle: [formatDateShortBR(gd.date, { hoje }), hora, onde].filter(Boolean).join(' · '),
      place,
      vagas: vagasLivres,
      badge: vagasTexto(vagasLivres),
      daArena,
    });
  });

  (vagas || []).forEach((s) => {
    if (!s?.id) return;
    if (uid && (s.participants || []).includes(uid)) return;
    if (s.game_day_id && meusDias.has(s.game_day_id)) return;
    const livres = getAvailableSpots(s);
    if (livres <= 0) return;
    const arena = arenasById.get?.(s.arena_id);
    itens.push({
      key: `vaga:${s.id}`,
      kind: PLAY_KIND.JOGO_ABERTO,
      id: s.id,
      link: s.game_day_id ? `/dia-de-jogo/${s.game_day_id}` : `/arenas/${s.arena_id}#arena-jogos-abertos`,
      inicio: ordem(instante(s.date, s.start, { fimDoDia: false })),
      title: `Jogo aberto · ${s.arena_name || arena?.name || 'Arena'}`,
      subtitle: [formatDateShortBR(s.date, { hoje }), s.start && s.end ? `${s.start}–${s.end}` : s.start, s.court || s.format]
        .filter(Boolean).join(' · '),
      place: { city: arena?.city || '', state: arena?.state || '' },
      vagas: livres,
      badge: vagasTexto(livres),
      daArena: true,
    });
  });

  const limiteSemData = agora - UNDATED_INVITE_DAYS * 86_400_000;
  (convites || []).forEach((g) => {
    if (!g?.id || g.status !== 'open' || g.created_by === uid) return;
    if (g.kind === 'game_day') {
      if (!g.game_day_id || diasListados.has(g.game_day_id) || meusDias.has(g.game_day_id)) return;
      // Com data dentro da janela e sem o dia de jogo na lista: o dia foi
      // arquivado ou virou privado — o espelho ficou órfão.
      if (g.date && g.date <= ultimoDia) return;
    }
    if (g.date) {
      if (!DIA_ISO.test(g.date) || g.date < hoje) return;
    } else {
      const quando = toMillis(g.updated_at) || toMillis(g.created_at);
      if (quando && quando < limiteSemData) return;
    }
    const lugar = [g.city, g.state].filter(Boolean).join(' / ');
    itens.push({
      key: `convite:${g.id}`,
      kind: PLAY_KIND.CONVITE,
      id: g.id,
      link: g.kind === 'game_day' && g.game_day_id ? `/dia-de-jogo/${g.game_day_id}` : '/procura-jogo',
      inicio: g.date ? ordem(instante(g.date, null, { fimDoDia: false })) : Infinity,
      title: g.when_text || (g.date ? formatDateShortBR(g.date, { hoje }) : 'Procura-se jogo'),
      subtitle: [g.date && g.when_text ? formatDateShortBR(g.date, { hoje }) : null, g.creator_name, lugar]
        .filter(Boolean).join(' · '),
      place: { city: g.city || '', state: g.state || '' },
      vagas: null,
      badge: null,
      daArena: false,
    });
  });

  return itens.sort((a, b) => (a.inicio === b.inicio ? 0 : a.inicio - b.inicio) || a.key.localeCompare(b.key));
}
