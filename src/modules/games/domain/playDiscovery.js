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
 * | `game_days` dos CLUBES da pessoa (privados) | dia de jogo do CLUBE | um item "dia de jogo" |
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
 * O que a pessoa CRIOU não aparece (ela organiza; está em "Dia de jogo"). O
 * que ela já tem marcado aparece com "Você vai" e o botão de sair — sumir no
 * mesmo clique que entrou parece que a entrada falhou (pedido: *"para que os
 * usuários possam entrar e participar/sair"*).
 *
 * ## Os requisitos
 *
 * Cada item diz se a pessoa PREENCHE os requisitos para entrar (`cabe`): a
 * faixa de nível do jogo aberto (nível desconhecido cabe — a plataforma não
 * inventa nível); o dia da arena lotado não aparece; o dia do clube só chega a
 * quem é do clube (é a própria consulta que recorta). O "Jogar" do início
 * mostra só o que cabe (`playItemsForMe`); Procura-se jogo mostra tudo, com o
 * motivo escrito.
 */
import { formatDateISO, formatDateShortBR } from '../../arenas/domain/calendar.js';
import { toMillis } from '../../tournament/domain/participation.js';
import { getAvailableSpots, slotLevelFit } from '../../arenas/domain/openMatch.js';
import {
  arenaGameDayTimeRange, arenaGameDayVacancies, isArenaGameDay, normalizeCapacity, arenaGameDaySlots,
  ARENA_SIGNUP_MODE, arenaSignupMode,
} from './arenaGameDay.js';
import { isClubGameDay } from './clubGameDay.js';

export const PLAY_KIND = Object.freeze({
  DIA: 'dia',
  JOGO_ABERTO: 'jogo_aberto',
  CONVITE: 'convite',
});

/**
 * De QUEM é o jogo — é o que decide o botão de entrar: no dia do atleta e no
 * do clube, "Participar"; no da arena, "Marcar presença" (com a quadra, quando
 * a inscrição é por quadra); no jogo aberto, entrar ou a fila; no convite,
 * falar com quem convidou.
 */
export const PLAY_ORIGIN = Object.freeze({
  ATLETA: 'atleta',
  ARENA: 'arena',
  CLUBE: 'clube',
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
 * Cada item diz, além de o que é e para onde leva:
 *  - `origem` — de quem é (atleta, arena, clube, jogo aberto, convite), que é o
 *    que decide QUAL botão de entrar ele ganha na tela;
 *  - `estou` — a pessoa já está nele. Ele CONTINUA na lista, com "Você vai" e
 *    o botão de sair: sumir no mesmo clique que entrou parece que falhou;
 *  - `cabe` / `motivo` — a pessoa preenche os requisitos? (a faixa de nível do
 *    jogo aberto). Nível desconhecido CABE: a plataforma não inventa nível;
 *  - `porQuadra` — o dia da arena pede escolher a quadra ao entrar;
 *  - `fonte` — o documento de origem (é com ele que o botão entra).
 *
 * @param {{
 *   diasPublicos?: object[],       `listUpcomingPublicGameDays`
 *   diasDoClube?: object[],        `listUpcomingClubGameDays` dos clubes da pessoa
 *   clubesById?: Map<string, object>, os clubes da pessoa (nome e cidade)
 *   vagas?: object[],              jogos abertos já filtrados por `openSlotsForDiscovery`
 *   convites?: object[],           `listOpenGames`
 *   inscritosPorDia?: Map<string, object[]|undefined>, inscritos dos dias da arena com teto
 *   arenasById?: Map<string, object>,
 *   uid?: string|null,
 *   meusDias?: Set<string>,        ids dos dias de jogo em que eu já estou
 *   nivel?: number|null,           o meu nível na régua 2.0–8.0 (jogo aberto)
 *   hoje: string, agora: number,
 * }} fontes
 * @returns {Array<{
 *   key: string, kind: string, origem: string, id: string, link: string, inicio: number,
 *   title: string, subtitle: string, place: { city: string, state: string },
 *   vagas: number|null, badge: string|null, daArena: boolean,
 *   estou: boolean, cabe: boolean, motivo: string|null, porQuadra: boolean, fonte: object,
 * }>}
 */
export function buildPlayList({
  diasPublicos = [], diasDoClube = [], clubesById = new Map(), vagas = [], convites = [],
  inscritosPorDia = new Map(), arenasById = new Map(), uid = null, meusDias = new Set(), nivel = null,
  hoje, agora,
} = {}) {
  const itens = [];
  const janela = nextDaysISO(hoje);
  const ultimoDia = janela[janela.length - 1] || hoje;
  const diasListados = new Set();

  // Estou JOGANDO neste dia? Com a lista de inscritos em mãos, é ela que diz.
  // Sem ela: quem criou e quem foi nomeado administrador são MEMBROS do dia
  // sem serem jogadores (organizam), então não contam como "estou".
  const souJogador = (gd) => {
    if (!uid) return false;
    const inscritos = inscritosPorDia.get?.(gd.id);
    if (Array.isArray(inscritos)) return inscritos.some((p) => p?.user_id === uid);
    if (gd.created_by === uid || (gd.admin_uids || []).includes(uid)) return false;
    return meusDias.has(gd.id) || (gd.member_uids || []).includes(uid);
  };

  (diasPublicos || []).forEach((gd) => {
    if (!gd?.id || diasListados.has(gd.id)) return;
    diasListados.add(gd.id);
    if (gd.status === 'archived' || gd.visibility !== 'public') return;
    // O jogo aberto aparece pela vitrine dele (nível, valor, fila).
    if (gd.open_slot_id) return;
    // Quem CRIOU organiza — o dia está na lista dele, em "Dia de jogo".
    if (gd.created_by === uid) return;
    if (!DIA_ISO.test(String(gd.date || '')) || !(gameDayEndsAt(gd) > agora)) return;
    const estou = souJogador(gd);
    const daArena = isArenaGameDay(gd);
    const vagasLivres = daArena && !estou ? gameDayVacanciesLeft(gd, inscritosPorDia.get(gd.id)) : null;
    if (vagasLivres === 0) return; // lotado (e eu não estou nele)
    const faixa = daArena ? arenaGameDayTimeRange(gd) : null;
    const hora = daArena ? (faixa ? `${faixa.start}–${faixa.end}` : '') : (gd.time || '');
    const place = gameDayPlace(gd, arenasById);
    const onde = daArena
      ? (gd.arena_name || arenasById.get?.(gd.arena_id)?.name || 'Arena')
      : [gd.creator_name, place.city].filter(Boolean).join(' · ');
    itens.push({
      key: `dia:${gd.id}`,
      kind: PLAY_KIND.DIA,
      origem: daArena ? PLAY_ORIGIN.ARENA : PLAY_ORIGIN.ATLETA,
      id: gd.id,
      link: `/dia-de-jogo/${gd.id}`,
      inicio: ordem(gameDayStartsAt(gd)),
      title: gd.title || 'Dia de jogo',
      subtitle: [formatDateShortBR(gd.date, { hoje }), hora, onde].filter(Boolean).join(' · '),
      place,
      vagas: vagasLivres,
      badge: estou ? 'Você vai' : vagasTexto(vagasLivres),
      daArena,
      estou,
      cabe: true,
      motivo: null,
      porQuadra: daArena && arenaSignupMode(gd) === ARENA_SIGNUP_MODE.COURT,
      fonte: gd,
    });
  });

  // Os dias de jogo dos CLUBES da pessoa. São privados (o dia é do clube), e é
  // por ser membro que ela os vê e entra — ninguém de fora do clube os recebe.
  (diasDoClube || []).forEach((gd) => {
    if (!gd?.id || diasListados.has(gd.id)) return;
    diasListados.add(gd.id);
    if (gd.status === 'archived' || !isClubGameDay(gd)) return;
    if (!DIA_ISO.test(String(gd.date || '')) || !(gameDayEndsAt(gd) > agora)) return;
    const clube = clubesById.get?.(gd.club_id) || null;
    const nomeDoClube = gd.club_name || clube?.name || 'Clube';
    // Quem agendou a data NÃO vira jogador (um evento semanal cria dezenas de
    // datas de uma vez), e pode querer jogar: o dia aparece para ele também.
    const estou = souJogador(gd);
    itens.push({
      key: `clube:${gd.id}`,
      kind: PLAY_KIND.DIA,
      origem: PLAY_ORIGIN.CLUBE,
      id: gd.id,
      link: `/dia-de-jogo/${gd.id}`,
      inicio: ordem(gameDayStartsAt(gd)),
      title: gd.title || 'Dia de jogo do clube',
      subtitle: [formatDateShortBR(gd.date, { hoje }), gd.time || '', nomeDoClube].filter(Boolean).join(' · '),
      place: { city: clube?.city || '', state: clube?.state || '' },
      vagas: null,
      badge: estou ? 'Você vai' : 'Do seu clube',
      daArena: false,
      estou,
      cabe: true,
      motivo: null,
      porQuadra: false,
      fonte: gd,
    });
  });

  (vagas || []).forEach((s) => {
    if (!s?.id) return;
    const estou = Boolean(uid) && (s.participants || []).includes(uid);
    const livres = getAvailableSpots(s);
    if (livres <= 0 && !estou) return;
    const fit = estou ? { ok: true } : slotLevelFit(s, nivel);
    const arena = arenasById.get?.(s.arena_id);
    itens.push({
      key: `vaga:${s.id}`,
      kind: PLAY_KIND.JOGO_ABERTO,
      origem: PLAY_ORIGIN.JOGO_ABERTO,
      id: s.id,
      link: s.game_day_id ? `/dia-de-jogo/${s.game_day_id}` : `/arenas/${s.arena_id}#arena-jogos-abertos`,
      inicio: ordem(instante(s.date, s.start, { fimDoDia: false })),
      title: `Jogo aberto · ${s.arena_name || arena?.name || 'Arena'}`,
      subtitle: [formatDateShortBR(s.date, { hoje }), s.start && s.end ? `${s.start}–${s.end}` : s.start, s.court || s.format]
        .filter(Boolean).join(' · '),
      place: { city: arena?.city || '', state: arena?.state || '' },
      vagas: livres,
      badge: estou ? 'Você vai' : vagasTexto(livres),
      daArena: true,
      estou,
      cabe: fit.ok,
      motivo: fit.ok ? null : (fit.reason || null),
      porQuadra: false,
      fonte: s,
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
      origem: PLAY_ORIGIN.CONVITE,
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
      estou: false,
      cabe: true,
      motivo: null,
      porQuadra: false,
      fonte: g,
    });
  });

  return itens.sort((a, b) => (a.inicio === b.inicio ? 0 : a.inicio - b.inicio) || a.key.localeCompare(b.key));
}

/**
 * O "Jogar" do início mostra o que a pessoa PODE fazer: o que ela preenche os
 * requisitos para entrar (a faixa de nível do jogo aberto) e o que ela já tem
 * marcado. O resto segue em Procura-se jogo, com o motivo escrito.
 */
export function playItemsForMe(itens = []) {
  return (itens || []).filter((i) => i.estou || i.cabe !== false);
}
