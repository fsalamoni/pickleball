/**
 * Quem é esta pessoa NA PLATAFORMA — e, portanto, o que a tela inicial mostra
 * primeiro (lógica pura).
 *
 * Duas fontes, com pesos diferentes de propósito:
 *
 * 1. **O que ela FAZ** (papel real, lido dos dados): gere uma arena, é
 *    professora, organiza um torneio que está valendo. Isso vence qualquer
 *    declaração — quem tem reserva esperando resposta precisa ver a arena
 *    primeiro, tenha marcado o interesse ou não.
 * 2. **O que ela DISSE que quer** (`users.interests`, escolhido no cadastro e
 *    no perfil). É o que decide a tela de quem ainda não faz nada.
 *
 * Um terceiro sinal, mais fraco, é a ATIVIDADE (tem reserva, tem aula, é de um
 * clube): ele traz a seção para a tela sem passar na frente do que a pessoa
 * escolheu.
 *
 * Sem interesse nenhum e sem papel nenhum, vale um começo que serve a quase
 * todo mundo (competir, jogar, reservar, ranking) — nunca uma tela vazia.
 *
 * Nada aqui lê o banco: os sinais entram prontos. A tela decide o que buscar
 * a partir do que esta função devolve, então uma seção que não é da pessoa
 * nem chega a consultar nada.
 */
import { PLATFORM_INTEREST, sanitizeInterests } from '../../athletes/domain/profileMeta.js';

/** As frentes da tela inicial. A ordem aqui é o desempate canônico. */
export const HOME_FOCUS = Object.freeze({
  ARENA: 'arena',             // gerir arena e quadras
  ENSINAR: 'ensinar',         // dar aulas
  ORGANIZAR: 'organizar',     // organizar torneios
  COMPETIR: 'competir',       // participar de torneios
  JOGAR: 'jogar',             // dias de jogo, procurar jogo, treino
  RESERVAR: 'reservar',       // reservar quadras
  APRENDER: 'aprender',       // professores e aulas
  CLUBES: 'clubes',           // clubes
  RANKING: 'ranking',         // ranking e evolução
  COMUNIDADE: 'comunidade',   // novidades e comunidade
});

const ORDEM_CANONICA = Object.values(HOME_FOCUS);

/** Rótulo de cada frente, para "Seu início mostra: …". */
export const HOME_FOCUS_LABEL = Object.freeze({
  [HOME_FOCUS.ARENA]: 'Minha arena',
  [HOME_FOCUS.ENSINAR]: 'Minhas aulas (professor)',
  [HOME_FOCUS.ORGANIZAR]: 'Organizar torneios',
  [HOME_FOCUS.COMPETIR]: 'Torneios',
  [HOME_FOCUS.JOGAR]: 'Dias de jogo',
  [HOME_FOCUS.RESERVAR]: 'Reservar quadras',
  [HOME_FOCUS.APRENDER]: 'Aulas e professores',
  [HOME_FOCUS.CLUBES]: 'Clubes',
  [HOME_FOCUS.RANKING]: 'Ranking e duplas',
  [HOME_FOCUS.COMUNIDADE]: 'Comunidade',
});

/** Interesse declarado → frente(s) da tela inicial. */
const FOCO_POR_INTERESSE = Object.freeze({
  [PLATFORM_INTEREST.PLAY_TOURNAMENTS]: [HOME_FOCUS.COMPETIR],
  [PLATFORM_INTEREST.ORGANIZE_TOURNAMENTS]: [HOME_FOCUS.ORGANIZAR],
  [PLATFORM_INTEREST.RANDOM_PARTNERS]: [HOME_FOCUS.JOGAR],
  [PLATFORM_INTEREST.TRAINING_PARTNERS]: [HOME_FOCUS.JOGAR],
  [PLATFORM_INTEREST.PERSONAL_TRAINING]: [HOME_FOCUS.JOGAR],
  [PLATFORM_INTEREST.FIND_COACH]: [HOME_FOCUS.APRENDER],
  [PLATFORM_INTEREST.COACH_TEACH]: [HOME_FOCUS.ENSINAR],
  [PLATFORM_INTEREST.ARENA_MANAGE]: [HOME_FOCUS.ARENA],
  [PLATFORM_INTEREST.BOOK_COURTS]: [HOME_FOCUS.RESERVAR],
  [PLATFORM_INTEREST.CLUBS]: [HOME_FOCUS.CLUBES],
  [PLATFORM_INTEREST.COMMUNITY]: [HOME_FOCUS.COMUNIDADE],
  [PLATFORM_INTEREST.RANKING]: [HOME_FOCUS.RANKING],
});

/** Por que a frente está na tela (a tela diz isso a quem pergunta). */
export const FOCUS_REASON = Object.freeze({
  PAPEL: 'papel',           // você faz isso
  INTERESSE: 'interesse',   // você disse que quer isso
  ATIVIDADE: 'atividade',   // você tem algo disso em andamento
  PADRAO: 'padrao',         // começo comum a todo mundo
});

const PESO = Object.freeze({
  [FOCUS_REASON.PAPEL]: 4,
  [FOCUS_REASON.INTERESSE]: 3,
  [FOCUS_REASON.ATIVIDADE]: 2,
  [FOCUS_REASON.PADRAO]: 1,
});

/** Começo de quem não disse nada e não faz nada ainda. */
export const DEFAULT_FOCI = Object.freeze([
  HOME_FOCUS.COMPETIR, HOME_FOCUS.JOGAR, HOME_FOCUS.RESERVAR, HOME_FOCUS.RANKING,
]);

/**
 * @typedef {Object} HomeSignals
 * @property {number} [arenasGeridas]      quantas arenas a pessoa gere
 * @property {boolean} [ehProfessor]       tem perfil de professor
 * @property {number} [torneiosOrganizando] torneios que ela gere e ainda valem
 * @property {boolean} [temReservas]       tem reserva futura
 * @property {boolean} [temAulas]          tem aula futura como aluno
 * @property {boolean} [temClubes]         é de algum clube
 * @property {boolean} [temDiasDeJogo]     tem dia de jogo futuro
 * @property {boolean} [temTorneios]       está inscrita num torneio que vale
 */

/**
 * As frentes da tela inicial, da mais importante para a menos.
 *
 * @param {{ interests?: string[], sinais?: HomeSignals }} input
 * @returns {Array<{ focus: string, reason: string, weight: number }>}
 */
export function resolveHomeFoci({ interests, sinais = {} } = {}) {
  const melhor = new Map();
  const marcar = (focus, reason) => {
    const atual = melhor.get(focus);
    if (!atual || PESO[reason] > PESO[atual]) melhor.set(focus, reason);
  };

  // 1) Papel real.
  if ((sinais.arenasGeridas || 0) > 0) marcar(HOME_FOCUS.ARENA, FOCUS_REASON.PAPEL);
  if (sinais.ehProfessor) marcar(HOME_FOCUS.ENSINAR, FOCUS_REASON.PAPEL);
  if ((sinais.torneiosOrganizando || 0) > 0) marcar(HOME_FOCUS.ORGANIZAR, FOCUS_REASON.PAPEL);

  // 2) Interesse declarado.
  const escolhidos = sanitizeInterests(interests);
  escolhidos.forEach((i) => (FOCO_POR_INTERESSE[i] || []).forEach((f) => marcar(f, FOCUS_REASON.INTERESSE)));

  // 3) Atividade em andamento.
  if (sinais.temTorneios) marcar(HOME_FOCUS.COMPETIR, FOCUS_REASON.ATIVIDADE);
  if (sinais.temDiasDeJogo) marcar(HOME_FOCUS.JOGAR, FOCUS_REASON.ATIVIDADE);
  if (sinais.temReservas) marcar(HOME_FOCUS.RESERVAR, FOCUS_REASON.ATIVIDADE);
  if (sinais.temAulas) marcar(HOME_FOCUS.APRENDER, FOCUS_REASON.ATIVIDADE);
  if (sinais.temClubes) marcar(HOME_FOCUS.CLUBES, FOCUS_REASON.ATIVIDADE);

  // 4) Ninguém disse nada: um começo comum, nunca uma tela vazia.
  if (escolhidos.length === 0) DEFAULT_FOCI.forEach((f) => marcar(f, FOCUS_REASON.PADRAO));

  return [...melhor.entries()]
    .map(([focus, reason]) => ({ focus, reason, weight: PESO[reason] }))
    .sort((a, b) => b.weight - a.weight
      || ORDEM_CANONICA.indexOf(a.focus) - ORDEM_CANONICA.indexOf(b.focus));
}

/** Atalho: a frente está na tela? */
export function hasFocus(foci, focus) {
  return (foci || []).some((f) => f.focus === focus);
}

/** Texto curto do motivo, para o "por que estou vendo isto". */
export function focusReasonText(reason) {
  switch (reason) {
    case FOCUS_REASON.PAPEL: return 'Porque você faz isso na plataforma';
    case FOCUS_REASON.INTERESSE: return 'Porque está nos seus interesses';
    case FOCUS_REASON.ATIVIDADE: return 'Porque você tem algo disso marcado';
    default: return 'Um bom começo para quem está chegando';
  }
}

/** As seções da tela inicial (a agenda é de todo mundo e vem sempre primeiro). */
export const HOME_SECTION = Object.freeze({
  AGENDA: 'agenda',
  ARENA: 'arena',
  PROFESSOR: 'professor',
  ORGANIZAR: 'organizar',
  TORNEIOS: 'torneios',
  RESULTADO: 'resultado',
  JOGAR: 'jogar',
  RESERVAR: 'reservar',
  AULAS: 'aulas',
  CLUBES: 'clubes',
  RANKING: 'ranking',
  COMUNIDADE: 'comunidade',
});

const SECOES_POR_FRENTE = Object.freeze({
  [HOME_FOCUS.ARENA]: [HOME_SECTION.ARENA],
  [HOME_FOCUS.ENSINAR]: [HOME_SECTION.PROFESSOR],
  [HOME_FOCUS.ORGANIZAR]: [HOME_SECTION.ORGANIZAR],
  [HOME_FOCUS.COMPETIR]: [HOME_SECTION.TORNEIOS, HOME_SECTION.RESULTADO],
  [HOME_FOCUS.JOGAR]: [HOME_SECTION.JOGAR],
  [HOME_FOCUS.RESERVAR]: [HOME_SECTION.RESERVAR],
  [HOME_FOCUS.APRENDER]: [HOME_SECTION.AULAS],
  [HOME_FOCUS.CLUBES]: [HOME_SECTION.CLUBES],
  [HOME_FOCUS.RANKING]: [HOME_SECTION.RANKING, HOME_SECTION.RESULTADO],
  [HOME_FOCUS.COMUNIDADE]: [HOME_SECTION.COMUNIDADE],
});

/**
 * As seções, na ordem das frentes, sem repetir — cada uma com o motivo da
 * frente que a trouxe (a primeira que a pediu).
 * @returns {Array<{ id: string, focus: string, reason: string }>}
 */
export function homeSectionsFor(foci = []) {
  const saida = [{ id: HOME_SECTION.AGENDA, focus: null, reason: null }];
  const vistas = new Set([HOME_SECTION.AGENDA]);
  (foci || []).forEach(({ focus, reason }) => {
    (SECOES_POR_FRENTE[focus] || []).forEach((id) => {
      if (vistas.has(id)) return;
      vistas.add(id);
      saida.push({ id, focus, reason });
    });
  });
  return saida;
}
