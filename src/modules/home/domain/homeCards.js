/**
 * O INÍCIO SOB MEDIDA — quais cards a tela inicial mostra, e em que ordem, é
 * escolha de cada pessoa (lógica pura).
 *
 * Por que existe: a tela inicial personalizada (`homeProfile.js`) decidia
 * SOZINHA o que mostrar, somando o que a pessoa faz, o que ela disse e o que
 * tem marcado — e para quem faz muita coisa a tela ficava povoada demais. Aqui
 * a decisão passa para a pessoa:
 *
 *  1. ⭐ **O padrão são três cards**: Dias de jogo, Horários da arena e
 *     Ranking — nessa ordem. Todo o resto começa desligado e pode ser ligado.
 *  2. **A ordem é da pessoa**: ligar um card põe ele no FIM (o que ela já
 *     arrumou não se mexe); subir e descer mudam só ele.
 *  3. **O que a pessoa faz vira SUGESTÃO, não imposição**: quem gere uma arena
 *     vê "Sua arena" marcado como sugerido no seletor, com o motivo — a tela
 *     não volta a se encher sozinha.
 *  4. **Card que depende de funcionalidade desligada** (os destaques sem
 *     nenhuma fonte de promoção, a evolução sem a sua flag) não é oferecido
 *     nem desenhado — mas continua na escolha salva, e volta se a
 *     funcionalidade voltar.
 *  5. **O que tem prazo não é card**: a chamada da fila de um jogo aberto
 *     (vence em 1 hora) aparece sempre, como um aviso.
 *
 * A escolha mora no navegador, por usuário (`homeCardsStore.js`). Nada aqui
 * lê nem grava o banco.
 */
import { t, tn, tk, fmtLista } from '@/core/i18n';
import { FOCUS_REASON, HOME_FOCUS, HOME_SECTION, focusReasonText } from './homeProfile.js';

/** Os cards. Os das seções têm o MESMO id da seção (`HOME_SECTION`). */
export const HOME_CARD = Object.freeze({
  JOGAR: HOME_SECTION.JOGAR,
  RESERVAR: HOME_SECTION.RESERVAR,
  RANKING: HOME_SECTION.RANKING,
  AGENDA: HOME_SECTION.AGENDA,
  TORNEIOS: HOME_SECTION.TORNEIOS,
  RESULTADO: HOME_SECTION.RESULTADO,
  ORGANIZAR: HOME_SECTION.ORGANIZAR,
  AULAS: HOME_SECTION.AULAS,
  CLUBES: HOME_SECTION.CLUBES,
  COMUNIDADE: HOME_SECTION.COMUNIDADE,
  ARENA: HOME_SECTION.ARENA,
  PROFESSOR: HOME_SECTION.PROFESSOR,
  ATALHOS: 'atalhos',
  EVOLUCAO: 'evolucao',
  TREINO: 'treino',
  MERCADO: 'mercado',
  FEDERACAO: 'federacao',
  ASSOCIACAO_CLUBE: 'associacao_clube',
});

/** ⭐ O que todo mundo vê sem ter escolhido — nesta ordem. */
export const DEFAULT_HOME_CARDS = Object.freeze([
  HOME_CARD.JOGAR, HOME_CARD.RESERVAR, HOME_CARD.RANKING,
]);

/** Os grupos do seletor, na ordem em que aparecem. */
export const HOME_CARD_GROUP = Object.freeze({
  JOGAR: 'jogar',
  COMPETIR: 'competir',
  ROTINA: 'rotina',
  TRABALHO: 'trabalho',
});

export const HOME_CARD_GROUP_LABEL = Object.freeze({
  [HOME_CARD_GROUP.JOGAR]: tk('Para jogar'),
  [HOME_CARD_GROUP.COMPETIR]: tk('Para competir'),
  [HOME_CARD_GROUP.ROTINA]: tk('O seu dia a dia'),
  [HOME_CARD_GROUP.TRABALHO]: tk('Se você trabalha com pickleball'),
});

/**
 * O catálogo. `icon` é o nome do ícone (a tela traduz); `focos` são as frentes
 * de `homeProfile` que fazem o card ser SUGERIDO; `requer` diz de que
 * funcionalidade ele depende (ver `homeCardAvailable`); `nota` avisa quando o
 * card pode ficar sem nada para mostrar.
 */
export const HOME_CARD_META = Object.freeze({
  [HOME_CARD.JOGAR]: Object.freeze({
    label: tk('Dias de jogo'),
    description: tk('Dias de jogo e jogos com vaga perto de você, das arenas e dos atletas.'),
    icon: 'Swords',
    group: HOME_CARD_GROUP.JOGAR,
    focos: [HOME_FOCUS.JOGAR],
  }),
  [HOME_CARD.RESERVAR]: Object.freeze({
    label: tk('Horários da arena'),
    description: tk('Os horários livres da arena onde você costuma jogar, para reservar.'),
    icon: 'CalendarCheck',
    group: HOME_CARD_GROUP.JOGAR,
    focos: [HOME_FOCUS.RESERVAR],
  }),
  [HOME_CARD.RANKING]: Object.freeze({
    label: tk('Ranking'),
    description: tk('A sua posição no ranking, o seu nível e as suas duplas.'),
    icon: 'Medal',
    group: HOME_CARD_GROUP.COMPETIR,
    focos: [HOME_FOCUS.RANKING],
  }),
  [HOME_CARD.AGENDA]: Object.freeze({
    label: tk('Sua agenda'),
    description: tk('Tudo o que você tem marcado — jogos, reservas, aulas e eventos — numa linha do tempo.'),
    icon: 'CalendarDays',
    group: HOME_CARD_GROUP.ROTINA,
    focos: [],
  }),
  [HOME_CARD.ATALHOS]: Object.freeze({
    label: tk('Atalhos'),
    description: tk('Botões diretos para o que você mais usa, como criar dia de jogo ou abrir a sua arena.'),
    icon: 'Zap',
    group: HOME_CARD_GROUP.ROTINA,
    focos: [],
  }),
  [HOME_CARD.EVOLUCAO]: Object.freeze({
    label: tk('Sua evolução'),
    description: tk('Sequência de semanas jogando, nível e as próximas conquistas.'),
    icon: 'TrendingUp',
    group: HOME_CARD_GROUP.ROTINA,
    focos: [],
    requer: 'evolucao',
  }),
  [HOME_CARD.TREINO]: Object.freeze({
    label: tk('Treino'),
    description: tk('O treino de hoje, o que o seu professor mandou e a porta para o Centro de Treino.'),
    icon: 'Dumbbell',
    group: HOME_CARD_GROUP.ROTINA,
    focos: [HOME_FOCUS.TREINAR],
    requer: 'treino',
  }),
  [HOME_CARD.MERCADO]: Object.freeze({
    label: tk('Mercado'),
    description: tk('As suas compras que esperam por você e o que acabou de chegar à venda.'),
    icon: 'Store',
    group: HOME_CARD_GROUP.ROTINA,
    focos: [],
    requer: 'mercado',
  }),
  [HOME_CARD.FEDERACAO]: Object.freeze({
    label: tk('Federação'),
    description: tk('As suas filiações, o que falta pagar ou renovar e a última notícia da federação.'),
    icon: 'Landmark',
    group: HOME_CARD_GROUP.ROTINA,
    focos: [],
    requer: 'federacao',
  }),
  [HOME_CARD.ASSOCIACAO_CLUBE]: Object.freeze({
    label: tk('Associação do clube'),
    description: tk('A sua filiação nos clubes: o que falta pagar, renovar ou responder.'),
    icon: 'IdCard',
    group: HOME_CARD_GROUP.ROTINA,
    focos: [],
    requer: 'associacaoClube',
  }),
  [HOME_CARD.TORNEIOS]: Object.freeze({
    label: tk('Torneios'),
    description: tk('Os torneios em que você está e os com inscrição aberta perto de você.'),
    icon: 'Trophy',
    group: HOME_CARD_GROUP.COMPETIR,
    focos: [HOME_FOCUS.COMPETIR],
  }),
  [HOME_CARD.RESULTADO]: Object.freeze({
    label: tk('Seu último torneio'),
    description: tk('A sua colocação no último torneio que você disputou.'),
    icon: 'Medal',
    group: HOME_CARD_GROUP.COMPETIR,
    focos: [HOME_FOCUS.COMPETIR],
    nota: tk('Antes do seu primeiro torneio, ele avisa que ainda não há resultado.'),
  }),
  [HOME_CARD.ORGANIZAR]: Object.freeze({
    label: tk('Torneios que você organiza'),
    description: tk('O que cada torneio seu pede agora: inscrições, sorteio, jogos, encerrar.'),
    icon: 'ClipboardList',
    group: HOME_CARD_GROUP.COMPETIR,
    focos: [HOME_FOCUS.ORGANIZAR],
  }),
  [HOME_CARD.AULAS]: Object.freeze({
    label: tk('Aulas e professores'),
    description: tk('Professores aceitando alunos perto de você.'),
    icon: 'GraduationCap',
    group: HOME_CARD_GROUP.JOGAR,
    focos: [HOME_FOCUS.APRENDER],
  }),
  [HOME_CARD.CLUBES]: Object.freeze({
    label: tk('Seus clubes'),
    description: tk('Os seus clubes e os próximos eventos deles.'),
    icon: 'Users',
    group: HOME_CARD_GROUP.JOGAR,
    focos: [HOME_FOCUS.CLUBES],
  }),
  [HOME_CARD.COMUNIDADE]: Object.freeze({
    label: tk('Comunidade'),
    description: tk('Atletas perto de você para jogar, e as novidades.'),
    icon: 'Handshake',
    group: HOME_CARD_GROUP.JOGAR,
    focos: [HOME_FOCUS.COMUNIDADE],
  }),
  [HOME_CARD.ARENA]: Object.freeze({
    label: tk('Sua arena'),
    description: tk('Os pedidos de reserva esperando resposta e as portas para a Central da arena.'),
    icon: 'Building2',
    group: HOME_CARD_GROUP.TRABALHO,
    focos: [HOME_FOCUS.ARENA],
  }),
  [HOME_CARD.PROFESSOR]: Object.freeze({
    label: tk('Suas aulas (professor)'),
    description: tk('Pedidos de aula esperando a sua resposta, próximas aulas e alunos.'),
    icon: 'GraduationCap',
    group: HOME_CARD_GROUP.TRABALHO,
    focos: [HOME_FOCUS.ENSINAR],
  }),
});

/** Todos os cards, na ordem do catálogo (a do seletor dentro de cada grupo). */
export const ALL_HOME_CARDS = Object.freeze(Object.keys(HOME_CARD_META));

const CONHECIDOS = new Set(ALL_HOME_CARDS);

/** O card é de uma SEÇÃO (vai na grade) — os outros têm lugar próprio. */
export function isSectionCard(id) {
  return Object.values(HOME_SECTION).includes(id);
}

/**
 * Qualquer lista vira uma escolha válida: só cards conhecidos, sem repetir, na
 * ordem em que vieram. Uma escolha de uma versão que tinha outro card nunca
 * ressuscita como algo que a tela não sabe desenhar.
 * @param {unknown} lista
 * @returns {string[]}
 */
export function normalizeHomeCards(lista) {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set();
  const saida = [];
  lista.forEach((id) => {
    if (typeof id !== 'string' || !CONHECIDOS.has(id) || vistos.has(id)) return;
    vistos.add(id);
    saida.push(id);
  });
  return saida;
}

/**
 * A escolha em vigor: a salva (mesmo vazia — "não quero nada" é escolha) ou o
 * padrão, quando não há nada salvo.
 * @param {string[]|null|undefined} salvo `null`/`undefined` = nunca escolheu
 */
export function chosenHomeCards(salvo) {
  return Array.isArray(salvo) ? normalizeHomeCards(salvo) : [...DEFAULT_HOME_CARDS];
}

/** A escolha é exatamente o padrão (mesmos cards, mesma ordem)? */
export function isDefaultHomeCards(lista) {
  const l = normalizeHomeCards(lista);
  return l.length === DEFAULT_HOME_CARDS.length && l.every((id, i) => id === DEFAULT_HOME_CARDS[i]);
}

/**
 * O card pode aparecer agora? Depende da funcionalidade de que ele precisa.
 * @param {string} id
 * @param {{ evolucao?: boolean, treino?: boolean, mercado?: boolean, federacao?: boolean, associacaoClube?: boolean }} [ctx] o que está ligado
 */
export function homeCardAvailable(id, ctx = {}) {
  const meta = HOME_CARD_META[id];
  if (!meta) return false;
  if (!meta.requer) return true;
  return Boolean(ctx?.[meta.requer]);
}

/** Os cards escolhidos que podem aparecer agora, na ordem da pessoa. */
export function visibleHomeCards(escolhidos, ctx = {}) {
  return normalizeHomeCards(escolhidos).filter((id) => homeCardAvailable(id, ctx));
}

/** Liga (no FIM da lista) ou desliga um card. */
export function toggleHomeCard(lista, id) {
  const atual = normalizeHomeCards(lista);
  if (!CONHECIDOS.has(id)) return atual;
  return atual.includes(id) ? atual.filter((c) => c !== id) : [...atual, id];
}

/**
 * Move um card uma (ou mais) posições. Fora dos limites, não faz nada — nunca
 * dá a volta: quem aperta "subir" no primeiro não espera que ele vá para o fim.
 * @param {string[]} lista
 * @param {string} id
 * @param {number} passo -1 sobe, +1 desce
 */
export function moveHomeCard(lista, id, passo) {
  const atual = normalizeHomeCards(lista);
  const de = atual.indexOf(id);
  const para = de + Math.trunc(passo);
  if (de < 0 || para < 0 || para >= atual.length || para === de) return atual;
  const saida = [...atual];
  saida.splice(de, 1);
  saida.splice(para, 0, id);
  return saida;
}

/**
 * Os cards que valem a pena SUGERIR: não escolhidos, disponíveis, e ligados a
 * uma frente que a pessoa tem por papel, interesse ou atividade (o "começo
 * comum" de quem não disse nada não sugere nada — seria o padrão de novo). Da
 * frente mais forte para a mais fraca, cada um com o motivo em texto.
 *
 * @param {Array<{ focus: string, reason: string, weight: number }>} foci `resolveHomeFoci`
 * @param {string[]} escolhidos
 * @param {object} [ctx] o que está ligado (ver `homeCardAvailable`)
 * @returns {Array<{ id: string, reason: string, motivo: string }>}
 */
export function suggestedHomeCards(foci = [], escolhidos = [], ctx = {}) {
  const ja = new Set(normalizeHomeCards(escolhidos));
  const saida = [];
  const vistos = new Set();
  (foci || [])
    .filter((f) => f && f.reason !== FOCUS_REASON.PADRAO)
    .forEach(({ focus, reason }) => {
      ALL_HOME_CARDS.forEach((id) => {
        if (vistos.has(id) || ja.has(id) || !homeCardAvailable(id, ctx)) return;
        if (!(HOME_CARD_META[id].focos || []).includes(focus)) return;
        vistos.add(id);
        saida.push({ id, reason, motivo: focusReasonText(reason) });
      });
    });
  return saida;
}

/** Os cards que ocupam SEMPRE a linha inteira da grade (listas e faixas). */
export const WIDE_HOME_CARDS = Object.freeze([HOME_CARD.AGENDA, HOME_CARD.ATALHOS, HOME_CARD.EVOLUCAO]);

/**
 * Quais cards ocupam a linha inteira, na grade de duas colunas.
 *
 * Os "largos" sempre; e, entre dois largos (ou no fim), o card que ficaria
 * SOZINHO numa linha — senão sobra um buraco ao lado dele. É o caso do
 * próprio padrão (três cards: dois numa linha e o Ranking sozinho). O card
 * que sobra é o ÚLTIMO da sequência: a ordem da pessoa não muda.
 *
 * Supõe que todo card renderiza algo — por isso "Seu último torneio", quando
 * escolhido, mostra um "ainda não há" em vez de sumir.
 *
 * @param {string[]} lista - os cards VISÍVEIS, na ordem
 * @returns {Set<string>}
 */
export function wideHomeCards(lista) {
  const largos = new Set();
  let seguidos = [];
  const fechar = () => {
    if (seguidos.length % 2 === 1) largos.add(seguidos[seguidos.length - 1]);
    seguidos = [];
  };
  normalizeHomeCards(lista).forEach((id) => {
    if (WIDE_HOME_CARDS.includes(id)) {
      fechar();
      largos.add(id);
    } else {
      seguidos.push(id);
    }
  });
  fechar();
  return largos;
}

/** Os cards disponíveis de um grupo, na ordem do catálogo. */
export function homeCardsOfGroup(group, ctx = {}) {
  return ALL_HOME_CARDS.filter((id) => HOME_CARD_META[id].group === group && homeCardAvailable(id, ctx));
}

/**
 * Resumo em uma frase, para Configurações e para o topo da tela inicial.
 * @returns {string} ex.: "3 cards: Dias de jogo, Horários da arena e Ranking"
 */
export function homeCardsSummary(lista, ctx = {}) {
  const nomes = visibleHomeCards(lista, ctx).map((id) => t(HOME_CARD_META[id].label));
  if (nomes.length === 0) return t('Nenhum card escolhido');
  return tn(nomes.length, '{n} card: {nomes}', '{n} cards: {nomes}', { nomes: fmtLista(nomes) });
}
