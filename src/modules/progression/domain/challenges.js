/**
 * challenges — desafios e eventos (comunitários e do admin).
 *
 * Um desafio é uma competição com começo, fim e placar: "O clube mais ativo da
 * semana", "Mês do Iniciante", "Semana das Duplas". Quem cria é o EMISSOR —
 * a plataforma, uma arena, um clube ou um professor — e cada um enxerga só o
 * que é seu.
 *
 * ## Quem decide o placar é o servidor
 *
 * O desafio mede jogos (disputados, vencidos, dias ativos), reservas ou aulas
 * — coisas que existem uma vez só nos documentos de quem os fez. O navegador
 * NÃO calcula nem grava posição: a regra recusa escrita de `value`/`position`
 * por cliente, e uma função agendada recalcula o placar a partir dos
 * registros. Entrar é um ato do cliente (opt-in); competir é do servidor.
 *
 * ## O que a pessoa vê
 *
 * Posição, valor, quanto falta para o pódio, o prazo e o prêmio — antes de
 * entrar, para decidir; e o resultado ao fim, com o XP já creditado (concessão
 * do servidor, ver `xpGrants.js`).
 *
 * Lógica pura, sem I/O.
 */

export const CHALLENGE_ISSUER = Object.freeze({
  PLATFORM: 'platform',
  ARENA: 'arena',
  CLUB: 'club',
  COACH: 'coach',
});

export const CHALLENGE_ISSUER_LABEL = Object.freeze({
  platform: 'PickleRush',
  arena: 'Arena',
  club: 'Clube',
  coach: 'Professor',
});

/**
 * As métricas que o servidor sabe medir. O id é contrato (gravado no desafio).
 * `issuers`: quem pode usar (reserva só faz sentido para arena; aula, para
 * professor).
 */
export const CHALLENGE_METRICS = Object.freeze({
  games_played: {
    label: 'Jogos disputados', unit: 'jogos', description: 'Partidas de torneio e de dia de jogo com resultado publicado.',
    issuers: ['platform', 'arena', 'club', 'coach'],
  },
  games_won: {
    label: 'Vitórias', unit: 'vitórias', description: 'Partidas vencidas, de torneio e de dia de jogo publicado.',
    issuers: ['platform', 'arena', 'club', 'coach'],
  },
  active_days: {
    label: 'Dias com jogo', unit: 'dias', description: 'Dias diferentes em que a pessoa jogou — premia constância, não maratona.',
    issuers: ['platform', 'arena', 'club', 'coach'],
  },
  arena_bookings: {
    label: 'Reservas jogadas na arena', unit: 'reservas', description: 'Reservas de quadra concluídas nesta arena.',
    issuers: ['arena'],
  },
  coach_lessons: {
    label: 'Aulas concluídas', unit: 'aulas', description: 'Aulas marcadas como concluídas pelo professor.',
    issuers: ['coach'],
  },
});

export const CHALLENGE_STATUS = Object.freeze({
  DRAFT: 'draft', ACTIVE: 'active', FINISHED: 'finished', CANCELLED: 'cancelled',
});

export const CHALLENGE_STATUS_LABEL = Object.freeze({
  draft: 'Rascunho', active: 'Ativo', finished: 'Encerrado', cancelled: 'Cancelado',
});

/** Duração mínima e máxima (dias) — desafio de uma hora ou de um ano não é desafio. */
export const CHALLENGE_DURATION_DAYS = Object.freeze({ min: 1, max: 92 });
export const CHALLENGE_PRIZE_XP_MAX = 2000;
export const CHALLENGE_MAX_PRIZES = 5;

/** Estado temporal derivado: antes, durante, depois. */
export function challengeTimeState(def, now = Date.now()) {
  if (!def) return 'unknown';
  if (def.status === 'cancelled') return 'cancelled';
  if (def.status === 'draft') return 'draft';
  const ini = Number(def.startsAt);
  const fim = Number(def.endsAt);
  if (def.status === 'finished' || (Number.isFinite(fim) && now >= fim)) return 'ended';
  if (Number.isFinite(ini) && now < ini) return 'upcoming';
  return 'live';
}

/** O desafio aceita inscrição agora? (ativo, não cancelado, até 1 dia antes do fim). */
export function canJoinChallenge(def, now = Date.now()) {
  const estado = challengeTimeState(def, now);
  if (estado === 'live') return Number(def.endsAt) - now > 86_400_000 / 2 ? { ok: true } : { ok: false, reason: 'O desafio está terminando — a inscrição já fechou.' };
  if (estado === 'upcoming') return { ok: true };
  if (estado === 'ended') return { ok: false, reason: 'Este desafio já terminou.' };
  if (estado === 'cancelled') return { ok: false, reason: 'Este desafio foi cancelado.' };
  return { ok: false, reason: 'Este desafio ainda não foi aberto.' };
}

/**
 * Valida e normaliza a definição de um desafio criado por um emissor.
 *
 * @param {object} input
 * @param {{ type: string, id: string, uid: string }} issuer
 * @returns {{ ok: true, value: object } | { ok: false, errors: Record<string, string> }}
 */
export function validateChallenge(input = {}, issuer = {}) {
  const errors = {};
  const titulo = String(input.title || '').trim();
  if (titulo.length < 4) errors.title = 'Dê um nome ao desafio (ao menos 4 letras).';
  if (titulo.length > 80) errors.title = 'O nome pode ter até 80 letras.';
  const metrica = CHALLENGE_METRICS[input.metric];
  if (!metrica) errors.metric = 'Escolha o que será medido.';
  else if (!metrica.issuers.includes(issuer.type)) errors.metric = 'Esta medida não vale para o seu tipo de desafio.';
  const subject = input.subject === 'club' ? 'club' : 'athlete';
  if (subject === 'club' && issuer.type !== 'platform') errors.subject = 'Só a plataforma cria desafio entre clubes.';
  const ini = Number(input.startsAt);
  const fim = Number(input.endsAt);
  if (!Number.isFinite(ini) || !Number.isFinite(fim)) errors.period = 'Informe o início e o fim.';
  else {
    const dias = (fim - ini) / 86_400_000;
    if (dias < CHALLENGE_DURATION_DAYS.min) errors.period = 'O desafio precisa durar ao menos 1 dia.';
    else if (dias > CHALLENGE_DURATION_DAYS.max) errors.period = `O desafio pode durar até ${CHALLENGE_DURATION_DAYS.max} dias.`;
  }
  const premios = (Array.isArray(input.prizes) ? input.prizes : []).slice(0, CHALLENGE_MAX_PRIZES).map((p, i) => ({
    place: i + 1,
    label: String(p?.label || '').trim().slice(0, 80),
    xp: Math.min(CHALLENGE_PRIZE_XP_MAX, Math.max(0, Math.round(Number(p?.xp) || 0))),
  })).filter((p) => p.label || p.xp > 0);
  // XP de prêmio só nasce de desafio da PLATAFORMA: se o emissor fosse livre
  // para prometer XP, qualquer arena inflaria o XP de quem ela quisesse.
  const xpPermitido = issuer.type === 'platform';
  const premiosFinais = premios.map((p) => ({ ...p, xp: xpPermitido ? p.xp : 0 }));
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      issuerType: issuer.type,
      issuerId: issuer.id,
      title: titulo,
      description: String(input.description || '').trim().slice(0, 400),
      rules: String(input.rules || '').trim().slice(0, 600),
      emoji: String(input.emoji || '🏆').slice(0, 4),
      metric: input.metric,
      subject,
      startsAt: ini,
      endsAt: fim,
      regionState: /^[A-Z]{2}$/.test(String(input.regionState || '')) ? input.regionState : null,
      prizes: premiosFinais,
      status: input.status === 'draft' ? 'draft' : 'active',
      createdBy: issuer.uid,
      schemaVersion: 1,
    },
  };
}

/**
 * Ordena as entradas e calcula a posição. Empate de valor = mesma posição
 * (competição "1224"), e desempate estável pelo momento de entrada.
 *
 * @param {Array<{ subjectId: string, value?: number, joinedAt?: number }>} entries
 */
export function rankEntries(entries) {
  const lista = [...(entries || [])].filter((e) => e && e.eligible !== false)
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0) || (Number(a.joinedAt) || 0) - (Number(b.joinedAt) || 0));
  let pos = 0;
  let ultimo = null;
  return lista.map((e, i) => {
    const v = Number(e.value) || 0;
    if (v !== ultimo) { pos = i + 1; ultimo = v; }
    return { ...e, position: pos };
  });
}

/**
 * A situação da pessoa: onde está, quanto falta para subir e para o pódio.
 *
 * @returns {{ position: number|null, value: number, total: number, toNext: number|null, toPodium: number|null, inPodium: boolean }|null}
 */
export function myStanding(ranked, subjectId) {
  const lista = rankEntries(ranked);
  const eu = lista.find((e) => e.subjectId === subjectId);
  if (!eu) return null;
  const acima = lista.filter((e) => e.position < eu.position);
  const ultimoAcima = acima[acima.length - 1];
  const terceiro = lista.find((e) => e.position === 3) || lista[2];
  const valor = Number(eu.value) || 0;
  return {
    position: eu.position,
    value: valor,
    total: lista.length,
    toNext: ultimoAcima ? Math.max(1, (Number(ultimoAcima.value) || 0) - valor + 1) : null,
    toPodium: eu.position > 3 && terceiro ? Math.max(1, (Number(terceiro.value) || 0) - valor + 1) : null,
    inPodium: eu.position <= 3,
  };
}

/** O prêmio de uma posição (ou null). */
export function prizeFor(def, position) {
  return (def?.prizes || []).find((p) => p.place === position) || null;
}

/** Frase do prazo: "termina em 3 dias", "começa amanhã", "terminou". */
export function challengeTimeLabel(def, now = Date.now()) {
  const estado = challengeTimeState(def, now);
  const dias = (ms) => Math.max(0, Math.ceil(ms / 86_400_000));
  if (estado === 'live') {
    const d = dias(Number(def.endsAt) - now);
    return d <= 1 ? 'termina hoje' : `termina em ${d} dias`;
  }
  if (estado === 'upcoming') {
    const d = dias(Number(def.startsAt) - now);
    return d <= 1 ? 'começa amanhã' : `começa em ${d} dias`;
  }
  if (estado === 'ended') return 'terminou';
  if (estado === 'cancelled') return 'cancelado';
  return 'rascunho';
}
