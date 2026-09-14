/**
 * Domínio: o torneio interno da arena — a competição da casa.
 *
 * PURO, sem I/O.
 *
 * ## O que faltava
 *
 * **O torneio não gerava partida nenhuma.** Guardava `format:
 * 'single_elimination'` e ninguém sorteava nada: o atleta se inscrevia e...
 * acabava. Um torneio que não vira jogo é uma lista de nomes.
 *
 * **O ladder era lido e nunca escrito.** `getLadder` consultava
 * `arena_ladders` e nada no projeto gravava naquela coleção — a classificação
 * da arena estava vazia desde sempre, para todo mundo.
 *
 * **O torneio não ocupava a quadra.** Marcar um torneio das 14h às 18h no
 * sábado não impedia a arena de vender aquelas quadras no mesmo horário.
 *
 * **Não dava para sair.** Só entrar.
 *
 * ## A decisão que evitou reescrever a plataforma
 *
 * A arena já tem uma máquina completa de dia de jogo: sorteio equilibrado pela
 * régua 2.0–8.0, Play, Americano, Americano aprimorado, placar, ranking do
 * dia, telão e tutoriais. Um torneio interno é **exatamente isso** com
 * inscrição antecipada e prêmio.
 *
 * Então começar o torneio **cria um dia de jogo da arena** com os inscritos, e
 * o ambiente do atleta não precisou de nada novo. O torneio guarda o
 * `game_day_id` e vira a porta de entrada; o dia de jogo faz o trabalho.
 */

export const INTERNAL_TOURNAMENT_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  RUNNING: 'running',
  FINISHED: 'finished',
  CANCELLED: 'cancelled',
});

export const PRIZE_TYPE = Object.freeze({
  CASH: 'cash',
  CREDIT: 'credit',
  GIFT: 'gift',
  TROPHY: 'trophy',
});

const HORA_RE = /^\d{2}:\d{2}$/;

/**
 * Normaliza input de torneio interno.
 *
 * Ganhou **quadra e horário** (sem isso o torneio não ocupava nada, e a arena
 * vendia as mesmas quadras no mesmo sábado) e um **formato que o dia de jogo
 * sabe conduzir** — `single_elimination` era guardado e nada no projeto o
 * executava, o que fazia o torneio ser uma lista de nomes.
 */
export function normalizeInternalTournamentInput(input = {}) {
  const errors = {};
  const name = String(input.name || '').trim();
  if (!name) errors.name = 'Nome obrigatório.';
  const date = String(input.date || '').trim();
  if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) errors.date = 'Data inválida.';
  const maxParticipants = Number(input.max_participants);
  if (!Number.isFinite(maxParticipants) || maxParticipants < 2 || maxParticipants > 64) {
    errors.max_participants = '2-64 participantes.';
  }
  const entryFee = Number(input.entry_fee) || 0;
  if (entryFee < 0) errors.entry_fee = 'Taxa inválida.';

  const courtIds = (Array.isArray(input.court_ids) ? input.court_ids : [])
    .map((c) => String(c || '').trim())
    .filter(Boolean)
    .slice(0, 20);
  const inicio = HORA_RE.test(String(input.start_time || '')) ? input.start_time : null;
  const fim = HORA_RE.test(String(input.end_time || '')) ? input.end_time : null;

  // Escolher quadra sem dizer quando fecharia a quadra o dia inteiro — ou
  // nenhum minuto, dependendo de quem lê. As duas coisas andam juntas.
  if (courtIds.length > 0 && (!inicio || !fim)) {
    errors.start_time = 'Diga o horário do torneio nessas quadras.';
  }
  if (inicio && fim && fim <= inicio) errors.end_time = 'O fim vem depois do início.';

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      name,
      description: String(input.description || '').trim().slice(0, 500),
      date,
      max_participants: Number.isFinite(maxParticipants) ? maxParticipants : 8,
      entry_fee: entryFee,
      /**
       * O formato precisa ser um que o dia de jogo saiba conduzir — é ele
       * quem vai rodar o torneio. Desconhecido cai no Americano, que é o mais
       * comum numa arena.
       */
      format: Object.values(INTERNAL_TOURNAMENT_FORMAT).includes(input.format)
        ? input.format
        : INTERNAL_TOURNAMENT_FORMAT.AMERICANO,
      prizes: Array.isArray(input.prizes) ? input.prizes.slice(0, 10) : [],
      /** As quadras que o torneio ocupa. Vazio = não bloqueia nada. */
      court_ids: courtIds,
      start_time: courtIds.length > 0 ? inicio : (inicio || null),
      end_time: courtIds.length > 0 ? fim : (fim || null),
    },
  };
}

/** Normaliza prize. */
export function normalizePrizeInput(input = {}) {
  const errors = {};
  const position = Number(input.position);
  if (!Number.isFinite(position) || position < 1 || position > 10) errors.position = 'Posição 1-10.';
  const value = String(input.value || '').trim();
  if (!value) errors.value = 'Valor obrigatório.';
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      position: Number.isFinite(position) ? position : 1,
      type: Object.values(PRIZE_TYPE).includes(input.type) ? input.type : PRIZE_TYPE.TROPHY,
      value,
    },
  };
}

/** Ladder: calcula posição baseada em pontos. */
export function calculateLadderPosition(participants, sortBy = 'points') {
  if (!Array.isArray(participants)) return [];
  return [...participants]
    .sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0))
    .map((p, idx) => ({ ...p, ladder_position: idx + 1 }));
}


/* ================================================================== */
/*  O torneio OCUPA a quadra                                          */
/* ================================================================== */

export const INTERNAL_TOURNAMENT_STATUS_META = Object.freeze({
  [INTERNAL_TOURNAMENT_STATUS.SCHEDULED]: { label: 'Inscrições abertas', tone: 'acid' },
  [INTERNAL_TOURNAMENT_STATUS.RUNNING]: { label: 'Em andamento', tone: 'blue' },
  [INTERNAL_TOURNAMENT_STATUS.FINISHED]: { label: 'Encerrado', tone: 'green' },
  [INTERNAL_TOURNAMENT_STATUS.CANCELLED]: { label: 'Cancelado', tone: 'neutral' },
});

export const PRIZE_TYPE_META = Object.freeze({
  [PRIZE_TYPE.CASH]: { label: 'Dinheiro' },
  [PRIZE_TYPE.CREDIT]: { label: 'Crédito na arena' },
  [PRIZE_TYPE.GIFT]: { label: 'Brinde' },
  [PRIZE_TYPE.TROPHY]: { label: 'Troféu' },
});

/** Formatos que o dia de jogo sabe conduzir. É o que o torneio pode ser. */
export const INTERNAL_TOURNAMENT_FORMAT = Object.freeze({
  AMERICANO: 'americano',
  AMERICANO_LIVE: 'americano_live',
  MEXICANO: 'mexicano',
  KING: 'king',
  PLAY: 'play',
});

export const INTERNAL_TOURNAMENT_FORMAT_META = Object.freeze({
  [INTERNAL_TOURNAMENT_FORMAT.AMERICANO]: {
    label: 'Americano',
    hint: 'Todos jogam com todos, rodada a rodada, com placar e ranking do dia.',
  },
  [INTERNAL_TOURNAMENT_FORMAT.AMERICANO_LIVE]: {
    label: 'Americano aprimorado',
    hint: 'Quadra a quadra, com fila — dá para entrar e sair no meio, e conta placar.',
  },
  [INTERNAL_TOURNAMENT_FORMAT.MEXICANO]: {
    label: 'Mexicano',
    hint: 'Duplas por classificação: quem vai bem joga com quem vai bem.',
  },
  [INTERNAL_TOURNAMENT_FORMAT.KING]: {
    label: 'Rei da Quadra',
    hint: 'Quem vence fica na quadra.',
  },
  [INTERNAL_TOURNAMENT_FORMAT.PLAY]: {
    label: 'Open Play',
    hint: 'Sem placar: rodízio equilibrado, para jogar por jogar.',
  },
});

/** O torneio ainda aceita gente? */
export function isTournamentOpen(t) {
  return (t?.status || INTERNAL_TOURNAMENT_STATUS.SCHEDULED) === INTERNAL_TOURNAMENT_STATUS.SCHEDULED;
}

/** Quantas vagas sobram. `null` quando não há teto. */
export function tournamentSeatsLeft(t) {
  const teto = Number(t?.max_participants);
  if (!Number.isFinite(teto) || teto <= 0) return null;
  return Math.max(0, teto - Math.max(0, Number(t?.enrolled) || 0));
}

/**
 * Os bloqueios de calendário que o torneio implica — DERIVADOS.
 *
 * Derivado, como o dia de jogo e a aula: `arena_internal_tournaments` é
 * legível por qualquer conta autenticada, então a tela do atleta monta a
 * verdade a partir da FONTE.
 *
 * Torneio sem quadra escolhida não bloqueia nada — a arena pode anunciar a
 * data antes de decidir onde, e fechar quadra por um torneio que ainda não tem
 * lugar seria inventar ocupação.
 *
 * Torneio que virou dia de jogo **também não bloqueia por aqui**: o dia de
 * jogo já bloqueia, e contar duas vezes faria a tela de gestão mostrar dois
 * bloqueios para o mesmo horário.
 *
 * @param {Array<object>} tournaments
 * @returns {Array<object>} no formato de `arena_unavailabilities`
 */
export function tournamentBlocks(tournaments = []) {
  if (!Array.isArray(tournaments)) return [];
  return tournaments
    .filter((t) => t
      && t.date
      && t.start_time
      && t.end_time
      && t.end_time > t.start_time
      && !t.game_day_id
      && t.status !== INTERNAL_TOURNAMENT_STATUS.CANCELLED
      && t.status !== INTERNAL_TOURNAMENT_STATUS.FINISHED)
    .flatMap((t) => (Array.isArray(t.court_ids) ? t.court_ids : [])
      .filter(Boolean)
      .map((courtId, i) => ({
        id: `torneio:${t.id}:${i}`,
        derivado: true,
        arena_id: t.arena_id,
        court_id: courtId,
        date: t.date,
        start_time: t.start_time,
        end_time: t.end_time,
        source: 'internal_tournament',
        tournament_id: t.id,
        notes: t.name ? `Torneio: ${t.name}` : 'Torneio da arena',
      })));
}

/** A identidade de um bloqueio de torneio, para não contar duas vezes. */
function chaveDoTorneio(b) {
  return [b?.tournament_id, b?.court_id, b?.date, b?.start_time, b?.end_time].join('|');
}

/** Os bloqueios que a tela já tem mais os que os torneios implicam. */
export function mergeTournamentBlocks(blocks = [], tournaments = []) {
  const base = Array.isArray(blocks) ? blocks : [];
  const jaTem = new Set(base.filter((b) => b?.tournament_id).map(chaveDoTorneio));
  const faltando = tournamentBlocks(tournaments).filter((b) => !jaTem.has(chaveDoTorneio(b)));
  return faltando.length === 0 ? base : [...base, ...faltando];
}

/* ================================================================== */
/*  O ladder — a classificação da casa                                */
/* ================================================================== */

/** Quantas pessoas o ladder guarda. Além disso vira relatório, não motivação. */
export const LADDER_MAX = 100;

/** Pontos por posição num torneio. Chegar ao fim já vale alguma coisa. */
export const LADDER_POINTS = Object.freeze({
  1: 100, 2: 70, 3: 50, 4: 35,
});
export const LADDER_POINTS_PARTICIPATION = 10;

/**
 * Quanto vale terminar um torneio nesta posição.
 *
 * Quem participou e não pontuou leva os pontos de presença: um ladder em que
 * só os quatro primeiros somam faz todo mundo desistir na segunda semana.
 */
export function ladderPointsFor(position) {
  const p = Math.trunc(Number(position) || 0);
  if (p <= 0) return LADDER_POINTS_PARTICIPATION;
  return LADDER_POINTS[p] ?? LADDER_POINTS_PARTICIPATION;
}

/**
 * O ladder atualizado com o resultado de UM torneio.
 *
 * PURO: recebe o ladder atual e a classificação final, devolve o novo. É o que
 * permite testar a acumulação sem tocar no banco — e a acumulação é a parte
 * que ninguém confere de olho.
 *
 * @param {Array<object>} ladder linhas atuais `{ user_id, name, points, played, wins }`
 * @param {Array<{ user_id: string, name?: string, position?: number, won?: number }>} resultado
 * @returns {Array<object>} ordenado, com `ladder_position` preenchido
 */
export function applyTournamentToLadder(ladder = [], resultado = []) {
  const porUid = new Map(
    (Array.isArray(ladder) ? ladder : [])
      .filter((l) => l?.user_id)
      .map((l) => [l.user_id, { ...l }]),
  );

  (Array.isArray(resultado) ? resultado : []).forEach((r) => {
    if (!r?.user_id) return;
    const atual = porUid.get(r.user_id) || {
      user_id: r.user_id, name: r.name || 'Atleta', points: 0, played: 0, wins: 0, titles: 0,
    };
    porUid.set(r.user_id, {
      ...atual,
      // O nome mais recente vence: quem trocou de nome na plataforma não pode
      // aparecer com o antigo para sempre.
      name: r.name || atual.name,
      points: (Number(atual.points) || 0) + ladderPointsFor(r.position),
      played: (Number(atual.played) || 0) + 1,
      wins: (Number(atual.wins) || 0) + (Number(r.won) || 0),
      titles: (Number(atual.titles) || 0) + (Number(r.position) === 1 ? 1 : 0),
    });
  });

  return calculateLadderPosition([...porUid.values()]).slice(0, LADDER_MAX);
}
