/**
 * Critérios OFICIAIS de desempate de um grupo / pontos corridos.
 *
 * ## A ordem, e de onde ela vem
 *
 * É a sequência do regulamento da USA Pickleball (15.B.4), a mesma que os
 * circuitos usam:
 *
 *   1. mais **vitórias**;
 *   2. **confronto direto** entre os empatados;
 *   3. **saldo de pontos** em todos os jogos do grupo;
 *   4. **saldo de pontos no confronto direto** entre os empatados;
 *   5. mais **pontos a favor** (desempate final);
 *   6. menos **pontos sofridos**.
 *
 * 🐞 **O que faltava.** A plataforma pulava do 1 direto para o 3: dois
 * empatados em vitórias eram separados pelo saldo GERAL, mesmo quando um tinha
 * ganhado do outro em quadra. É a reclamação nº 1 de quadra — *"mas eu ganhei
 * dele"* — e quem organiza não tinha como explicar, porque a tela mostrava o
 * resultado certo de uma conta errada.
 *
 * ## Empate de TRÊS ou mais: a mini-tabela
 *
 * Com dois empatados, "confronto direto" é o jogo entre eles. Com três ou
 * mais, não existe um jogo só — o regulamento manda olhar os jogos ENTRE OS
 * EMPATADOS como um torneio à parte (a *mini-tabela*). Quem venceu mais
 * DENTRO desse recorte fica à frente.
 *
 * E o recorte é recalculado a cada nível: se a mini-tabela separa o grupo de
 * três em 1 + 2, os dois que continuam empatados são comparados de novo entre
 * SI — não pelo que fizeram contra o terceiro, que já saiu. Sem isso, "A ganhou
 * de B" deixaria de valer só porque C estava na conversa.
 *
 * ## Quem não se enfrentou
 *
 * Grupo com desistência, fase interrompida, rodada que não aconteceu: o
 * confronto direto simplesmente não existe, e o critério é PULADO — os dois
 * seguem empatados e a decisão cai no saldo geral. Nunca inventamos um
 * vencedor a partir de um jogo que não houve.
 *
 * Lógica pura: sem React, sem Firebase.
 */

/**
 * Os critérios disponíveis, com o que cada um significa e quando faz sentido.
 *
 * O organizador MONTA A ORDEM que quiser (`tiebreak_order` na fase). Não há
 * uma ordem certa para todo torneio: circuitos diferentes decidem diferente, e
 * quem conhece o público sabe o que a quadra vai aceitar. O que a plataforma
 * garante é que a ordem escolhida seja aplicada exatamente, e que ela apareça
 * na tela — classificação que ninguém consegue explicar vira discussão.
 */
export const TIEBREAK_CRITERIA = Object.freeze([
  {
    key: 'wins',
    label: 'Mais vitórias',
    help: 'O critério básico: quem ganhou mais jogos. Quase sempre o primeiro.',
  },
  {
    key: 'head_to_head',
    label: 'Confronto direto',
    help: 'Entre os empatados, quem venceu mais jogos CONTRA os outros empatados. Com três ou mais, vale a mini-tabela só entre eles. É o critério que a quadra cobra ("eu ganhei dele").',
  },
  {
    key: 'balance',
    label: 'Saldo de pontos',
    help: 'Pontos a favor menos pontos contra, em todos os jogos do grupo. Premia quem vence com folga — e pune quem perde feio.',
  },
  {
    key: 'head_to_head_balance',
    label: 'Saldo no confronto direto',
    help: 'O mesmo saldo, mas contando só os jogos entre os empatados.',
  },
  {
    key: 'points_for',
    label: 'Mais pontos a favor',
    help: 'Total de pontos marcados. Premia quem ataca; num formato de tempo, premia quem joga rápido.',
  },
  {
    key: 'points_against',
    label: 'Menos pontos sofridos',
    help: 'Total de pontos cedidos. O espelho do anterior: premia quem defende.',
  },
  {
    key: 'win_rate',
    label: 'Aproveitamento (%)',
    help: 'Vitórias divididas por jogos DISPUTADOS. Use quando alguém do grupo jogou menos (desistência, W.O., grupo interrompido) — aí o número absoluto de vitórias mente.',
  },
  {
    key: 'balance_rate',
    label: 'Saldo por partida',
    help: 'Saldo dividido por jogos disputados. Mesma ideia do aproveitamento, aplicada ao saldo.',
  },
  {
    key: 'sets',
    label: 'Saldo de games/sets',
    help: 'Games (ou sets) ganhos menos perdidos. Só muda alguma coisa em formato de mais de um game por jogo.',
  },
]);

/** A ordem OFICIAL (USA Pickleball 15.B.4) — o padrão de quem não configurar. */
export const DEFAULT_TIEBREAK_ORDER = Object.freeze([
  'wins', 'head_to_head', 'balance', 'head_to_head_balance', 'points_for', 'points_against',
]);

/** Ordens prontas, para o organizador não ter que montar do zero. */
export const TIEBREAK_PRESETS = Object.freeze([
  {
    id: 'oficial',
    label: 'Oficial (USA Pickleball)',
    order: [...DEFAULT_TIEBREAK_ORDER],
    help: 'A sequência do regulamento: vitórias, confronto direto, saldo geral, saldo no confronto direto e pontos. É o que um torneio sancionado usa.',
  },
  {
    id: 'confronto_primeiro',
    label: 'Confronto direto acima de tudo',
    order: ['head_to_head', 'wins', 'balance', 'points_for', 'points_against'],
    help: 'Quem ganhou do outro fica à frente, mesmo com uma vitória a menos no grupo. Costuma agradar em torneio pequeno, onde todo mundo assistiu a todos os jogos.',
  },
  {
    id: 'aproveitamento',
    label: 'Aproveitamento (grupos desiguais ou com desistência)',
    order: ['win_rate', 'head_to_head', 'balance_rate', 'points_for'],
    help: 'Compara por percentual em vez de número absoluto. É o certo quando os grupos têm tamanhos diferentes ou quando alguém abandonou no meio.',
  },
  {
    id: 'saldo',
    label: 'Saldo acima do confronto direto',
    order: ['wins', 'balance', 'points_for', 'head_to_head', 'points_against'],
    help: 'Premia quem venceu com folga. Era o comportamento da plataforma antes de o confronto direto existir; fica aqui para quem prefere assim.',
  },
]);

const num0 = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const perGame = (valor, jogos) => (jogos > 0 ? valor / jogos : 0);

/** Valor de um critério SIMPLES (os que não dependem do confronto direto). */
function valorSimples(chave, linha) {
  const jogos = num0(linha?.played);
  switch (chave) {
    case 'wins': return num0(linha?.wins);
    case 'balance': return balanceOf(linha);
    case 'points_for': return num0(linha?.points_for);
    case 'points_against': return -num0(linha?.points_against); // menos é melhor
    case 'win_rate': return perGame(num0(linha?.wins), jogos);
    case 'balance_rate': return perGame(balanceOf(linha), jogos);
    case 'sets': return num0(linha?.sets_won) - num0(linha?.sets_lost);
    default: return null; // critério de confronto direto, tratado à parte
  }
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Saldo de pontos de uma linha de classificação. */
export function balanceOf(row) {
  return num(row?.points_for) - num(row?.points_against);
}

/**
 * Índice de confrontos diretos: para cada par de participantes, quantas
 * vitórias e quantos pontos cada um fez CONTRA o outro.
 *
 * @param {Array<object>} matches jogos já decididos do recorte
 * @param {{
 *   sideIds: (match: object, side: 'a'|'b') => string[],
 *   result: (match: object) => ({ winner: 'a'|'b'|null, pointsA: number, pointsB: number }|null),
 * }} adapters como ler um jogo (o formato varia entre torneio e dia de jogo)
 * @returns {Map<string, { wins: number, points_for: number, points_against: number }>}
 *   chave `"<id>|<oponente>"`.
 */
export function buildHeadToHead(matches, adapters) {
  const mapa = new Map();
  const somar = (id, oponente, venceu, pf, pa) => {
    const chave = `${id}|${oponente}`;
    const atual = mapa.get(chave) || { wins: 0, points_for: 0, points_against: 0 };
    atual.wins += venceu ? 1 : 0;
    atual.points_for += pf;
    atual.points_against += pa;
    mapa.set(chave, atual);
  };

  (matches || []).forEach((m) => {
    const r = adapters.result(m);
    if (!r || !r.winner) return;
    const idsA = adapters.sideIds(m, 'a');
    const idsB = adapters.sideIds(m, 'b');
    if (idsA.length === 0 || idsB.length === 0) return;
    const pa = num(r.pointsA);
    const pb = num(r.pointsB);
    idsA.forEach((a) => idsB.forEach((b) => {
      somar(a, b, r.winner === 'a', pa, pb);
      somar(b, a, r.winner === 'b', pb, pa);
    }));
  });
  return mapa;
}

/**
 * Mini-tabela: soma, para cada id do recorte, só o que ele fez CONTRA os
 * outros ids do MESMO recorte.
 *
 * @returns {Map<string, { wins: number, balance: number, played: number }>}
 */
export function miniTable(ids, headToHead) {
  const saida = new Map();
  ids.forEach((id) => {
    let wins = 0;
    let balance = 0;
    let played = 0;
    ids.forEach((outro) => {
      if (outro === id) return;
      const h = headToHead.get(`${id}|${outro}`);
      if (!h) return;
      wins += h.wins;
      balance += h.points_for - h.points_against;
      played += 1;
    });
    saida.set(id, { wins, balance, played });
  });
  return saida;
}

/**
 * Ordena um bloco de EMPATADOS pelos critérios 2 a 6, recursivamente.
 *
 * Recursivo de propósito: cada vez que um critério separa o bloco em
 * sub-blocos, os que continuam empatados são comparados de novo ENTRE SI —
 * com a mini-tabela recalculada só com eles. É o que o regulamento manda e o
 * que faz "eu ganhei dele" continuar valendo quando um terceiro sai da conta.
 */
/**
 * Aplica a ORDEM escolhida, critério a critério.
 *
 * Toda vez que um critério parte o bloco, os sub-blocos recomeçam do PRIMEIRO
 * critério — comparados agora só entre quem sobrou. É o que faz "eu ganhei
 * dele" continuar valendo quando um terceiro sai da conversa, e termina sempre
 * porque cada sub-bloco é estritamente menor.
 */
function desempatar(bloco, contexto, nivel) {
  if (bloco.length <= 1) return bloco;
  const { ordem } = contexto;

  for (let n = Math.max(0, nivel); n < ordem.length; n += 1) {
    const chave = ordem[n];
    const blocos = dividirPorCriterio(bloco, chave, contexto);
    if (blocos && blocos.length > 1) {
      return blocos.flatMap((sub) => desempatar(sub, contexto, 0));
    }
  }
  return bloco;
}

/**
 * Divide o bloco por UM critério. `null` quando o critério não se aplica —
 * confronto direto entre quem não se enfrentou, por exemplo. Critério que não
 * se aplica é PULADO, nunca inventado.
 */
function dividirPorCriterio(bloco, chave, contexto) {
  const { headToHead, idOf } = contexto;

  if (chave === 'head_to_head' || chave === 'head_to_head_balance') {
    if (!headToHead) return null;
    const ids = bloco.map(idOf);
    const mini = miniTable(ids, headToHead);
    if (!ids.some((id) => (mini.get(id)?.played || 0) > 0)) return null;
    const campo = chave === 'head_to_head' ? 'wins' : 'balance';
    return agrupar(bloco, (r) => mini.get(idOf(r))?.[campo] || 0);
  }

  const amostra = valorSimples(chave, bloco[0]);
  if (amostra === null) return null; // critério desconhecido: ignorado
  return agrupar(bloco, (r) => valorSimples(chave, r));
}

/**
 * Normaliza a ordem pedida: só critérios conhecidos, sem repetição, e nunca
 * vazia (vazia ⇒ a oficial). Assim uma configuração antiga, um campo em
 * branco ou um critério removido no futuro nunca deixam a classificação sem
 * regra.
 */
export function normalizeTiebreakOrder(ordem) {
  const validas = new Set(TIEBREAK_CRITERIA.map((c) => c.key));
  const limpa = (Array.isArray(ordem) ? ordem : [])
    .map((k) => String(k || '').trim())
    .filter((k) => validas.has(k));
  const semRepetir = [...new Set(limpa)];
  return semRepetir.length > 0 ? semRepetir : [...DEFAULT_TIEBREAK_ORDER];
}

/** Descreve a ordem em texto, para a tela mostrar como a classificação saiu. */
export function describeTiebreakOrder(ordem) {
  const porChave = new Map(TIEBREAK_CRITERIA.map((c) => [c.key, c]));
  return normalizeTiebreakOrder(ordem).map((k, i) => ({
    position: i + 1,
    key: k,
    label: porChave.get(k)?.label || k,
    help: porChave.get(k)?.help || '',
  }));
}

/** Agrupa em blocos por valor DECRESCENTE da chave (maior primeiro). */
function agrupar(linhas, chave) {
  const porValor = new Map();
  linhas.forEach((r) => {
    const v = chave(r);
    if (!porValor.has(v)) porValor.set(v, []);
    porValor.get(v).push(r);
  });
  return Array.from(porValor.keys())
    .sort((a, b) => b - a)
    .map((v) => porValor.get(v));
}

/**
 * Classifica aplicando os critérios oficiais na ordem.
 *
 * **Sem `headToHead`, o resultado é bit a bit o de antes** (vitórias → saldo →
 * pontos a favor → pontos sofridos): o confronto direto é um critério que se
 * ACRESCENTA, e quem não tem os jogos em mãos continua com a conta antiga.
 *
 * A ordem de entrada é preservada nos empates absolutos (classificação
 * estável), então dois participantes idênticos em tudo nunca trocam de lugar
 * entre duas leituras da mesma tela.
 *
 * @param {Array<object>} rows linhas com `{ wins, played, points_for, points_against }`
 * @param {{
 *   headToHead?: Map|null,
 *   idOf?: (row: object) => string,
 *   order?: string[]|null,
 * }} [options] `order` é a ORDEM DOS CRITÉRIOS escolhida pelo organizador;
 *   vazia ou ausente ⇒ a oficial.
 * @returns {Array<object>} as mesmas linhas, em ordem de classificação
 */
export function rankByOfficialCriteria(rows, options = {}) {
  const lista = Array.isArray(rows) ? rows.slice() : [];
  if (lista.length <= 1) return lista;
  const idOf = options.idOf || ((r) => String(r?.participant_id ?? r?.id ?? ''));
  const contexto = {
    headToHead: options.headToHead || null,
    idOf,
    ordem: normalizeTiebreakOrder(options.order),
  };

  // Estabilidade: a ordem de entrada decide os empates absolutos, então a
  // mesma tela aberta duas vezes mostra a mesma classificação.
  const ordemOriginal = new Map(lista.map((r, i) => [r, i]));
  const estabilizar = (bloco) => bloco
    .slice()
    .sort((a, b) => (ordemOriginal.get(a) ?? 0) - (ordemOriginal.get(b) ?? 0));

  return desempatar(estabilizar(lista), contexto, 0);
}
