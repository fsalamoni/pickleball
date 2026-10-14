import { t, tn, tk } from '@/core/i18n';
/**
 * supplyHealth — a saúde de quem OFERECE: professor, arena e clube.
 *
 * "Se o lado da demanda (atleta) está gamificado e o da oferta não, o sistema
 * colapsa" — o estudo. Quem traz gente para a plataforma é quem dá aula, quem
 * aluga quadra e quem mantém um clube vivo; eles precisam de um retrato claro
 * de como estão, do que melhorar e de metas do mês.
 *
 * ## Como o health score é calculado
 *
 * Cada dimensão vale de 0 a 100 e tem um peso. O total é a média ponderada SÓ
 * das dimensões que dá para medir: arena nova, sem avaliações, não é "nota 0
 * em satisfação" — é satisfação ainda não medida, e o total se apoia no resto.
 * `confidence` diz quantas dimensões sustentam o número, e a tela mostra isso
 * ("baseado em 3 de 5 dimensões") — número sem lastro vira ruído.
 *
 * O score NUNCA é público: aparece só para o próprio professor/arena/clube, e
 * serve para orientar — não é ranking nem selo de qualidade.
 *
 * ## Sugestões
 *
 * Regras simples e explicáveis, em pt-BR, cada uma com o número que a motivou.
 * Nenhuma promete XP: sugestão boa se justifica pelo resultado que traz.
 *
 * Lógica pura, sem I/O.
 */

const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const pct = (n) => Math.round(n);

/** Faixas do total. */
export function healthBand(score) {
  if (score == null) return { id: 'unknown', label: t('Ainda sem dados'), tone: 'neutral' };
  if (score >= 85) return { id: 'excellent', label: t('Excelente'), tone: 'green' };
  if (score >= 70) return { id: 'good', label: t('Muito bom'), tone: 'blue' };
  if (score >= 50) return { id: 'growing', label: t('Em evolução'), tone: 'amber' };
  return { id: 'attention', label: t('Precisa de atenção'), tone: 'red' };
}

/**
 * Média ponderada das dimensões medidas.
 * @param {Array<{ id: string, label: string, weight: number, score: number|null, detail?: string }>} dims
 */
export function combineHealth(dims) {
  const medidas = dims.filter((d) => d.score != null && Number.isFinite(d.score));
  const peso = medidas.reduce((s, d) => s + d.weight, 0);
  const total = peso > 0 ? Math.round(medidas.reduce((s, d) => s + d.score * d.weight, 0) / peso) : null;
  const n = medidas.length;
  return {
    score: total,
    band: healthBand(total),
    dimensions: dims,
    measured: n,
    totalDimensions: dims.length,
    confidence: n >= Math.min(4, dims.length) ? 'high' : n >= 2 ? 'medium' : 'low',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ARENA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   bookings7?: number, bookingsPrev7?: number, noShowRate?: number|null,
 *   pendingOver24h?: number, rating?: number|null, reviewsCount?: number,
 *   repeatRate?: number|null, eventsLast30?: number, lapsedCustomers?: number,
 * }} m
 */
export function computeArenaHealth(m = {}) {
  const b7 = Number(m.bookings7) || 0;
  const p7 = Number(m.bookingsPrev7) || 0;
  let demanda = null;
  if (b7 > 0 || p7 > 0) {
    const crescimento = (b7 - p7) / Math.max(p7, 1);
    demanda = b7 === 0 ? 10 : clamp(60 + crescimento * 40);
  }
  let confiab = null;
  if (m.noShowRate != null) {
    confiab = clamp(100 - Number(m.noShowRate) * 6 - Math.min(40, (Number(m.pendingOver24h) || 0) * 10));
  } else if ((Number(m.pendingOver24h) || 0) > 0) {
    confiab = clamp(100 - Math.min(40, Number(m.pendingOver24h) * 10));
  }
  const satisf = m.rating != null && (Number(m.reviewsCount) || 0) >= 3
    ? clamp(((Number(m.rating) - 1) / 4) * 100) : null;
  const fideliz = m.repeatRate != null ? clamp(Number(m.repeatRate) * 1.5) : null;
  const ev = Number(m.eventsLast30);
  const comunidade = Number.isFinite(ev) ? (ev >= 4 ? 100 : ev >= 2 ? 75 : ev === 1 ? 50 : 10) : null;

  const dims = [
    { id: 'demand', label: t('Demanda'), weight: 30, score: demanda != null ? pct(demanda) : null, detail: demanda == null ? t('Sem reservas nas últimas 2 semanas.') : tn(b7, '{n} reserva esta semana, {ant} na anterior.', '{n} reservas esta semana, {ant} na anterior.', { ant: p7 }) },
    { id: 'reliability', label: t('Confiabilidade'), weight: 25, score: confiab != null ? pct(confiab) : null, detail: m.noShowRate != null ? (m.pendingOver24h ? tn(m.pendingOver24h, '{pct}% de faltas, {n} pedido sem resposta há mais de 24 h.', '{pct}% de faltas, {n} pedidos sem resposta há mais de 24 h.', { pct: m.noShowRate }) : t('{pct}% de faltas.', { pct: m.noShowRate })) : t('Ainda sem reservas decididas.') },
    { id: 'satisfaction', label: t('Satisfação'), weight: 20, score: satisf != null ? pct(satisf) : null, detail: satisf != null ? t('Nota {nota} em {n} avaliações.', { nota: m.rating, n: m.reviewsCount }) : t('Precisa de ao menos 3 avaliações.') },
    { id: 'loyalty', label: t('Fidelização'), weight: 15, score: fideliz != null ? pct(fideliz) : null, detail: m.repeatRate != null ? t('{pct}% dos clientes voltaram a reservar.', { pct: pct(m.repeatRate) }) : t('Sem clientes suficientes ainda.') },
    { id: 'community', label: t('Comunidade'), weight: 10, score: comunidade, detail: Number.isFinite(ev) ? tn(ev, '{n} evento (dia de jogo, jogo aberto ou aula) em 30 dias.', '{n} eventos (dia de jogo, jogo aberto ou aula) em 30 dias.') : t('Sem dados de eventos.') },
  ];
  return combineHealth(dims);
}

/** Sugestões para a arena. Cada uma carrega o número que a motivou. */
export function arenaSuggestions(m = {}) {
  const out = [];
  if ((Number(m.pendingOver24h) || 0) > 0) {
    out.push({ id: 'pending', tone: 'warn', text: tn(Number(m.pendingOver24h), '{n} pedido de reserva está sem resposta há mais de 24 horas. Responder rápido é o que mais pesa na confiança do cliente.', '{n} pedidos de reserva estão sem resposta há mais de 24 horas. Responder rápido é o que mais pesa na confiança do cliente.'), to: '?aba=reservas' });
  }
  if (m.noShowRate != null && Number(m.noShowRate) > 8) {
    out.push({ id: 'noshow', tone: 'warn', text: t('{pct}% das reservas viraram falta. Vale ligar a política de cancelamento e o aviso de lembrete.', { pct: m.noShowRate }), to: '?aba=configuracoes' });
  }
  if ((Number(m.lapsedCustomers) || 0) >= 3) {
    out.push({ id: 'lapsed', tone: 'idea', text: t('{n} clientes não voltam há mais de 30 dias. Uma campanha "sentimos sua falta" costuma recuperar parte deles.', { n: m.lapsedCustomers }), to: '?aba=marketing' });
  }
  if (Number(m.eventsLast30) === 0) {
    out.push({ id: 'events', tone: 'idea', text: t('Nenhum evento nos últimos 30 dias. Um dia de jogo aberto leva gente nova à quadra e enche os horários vagos.'), to: '?aba=jogo-aberto' });
  }
  if (m.reviewsCount != null && Number(m.reviewsCount) < 3) {
    out.push({ id: 'reviews', tone: 'idea', text: t('Poucas avaliações. Peça a quem acabou de jogar para avaliar a arena — com 3, o selo de satisfação passa a contar.') });
  }
  if (m.repeatRate != null && Number(m.repeatRate) < 30) {
    out.push({ id: 'repeat', tone: 'idea', text: t('Só {pct}% dos clientes voltam. Pacotes de horas e o programa de membros aumentam o retorno.', { pct: pct(m.repeatRate) }), to: '?aba=membros' });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   lessons30?: number, lessonsPrev30?: number, activeStudents30?: number, totalStudents?: number,
 *   newStudents30?: number, pendingOver24h?: number, respondedRate?: number|null,
 *   offers?: number, validatedStudents?: number,
 * }} m
 */
export function computeCoachHealth(m = {}) {
  const l30 = Number(m.lessons30) || 0;
  const lp = Number(m.lessonsPrev30) || 0;
  let atividade = null;
  if (l30 > 0 || lp > 0) {
    atividade = l30 === 0 ? 10 : clamp(60 + ((l30 - lp) / Math.max(lp, 1)) * 40 + Math.min(20, l30));
  }
  const total = Number(m.totalStudents) || 0;
  const retencao = total > 0 ? clamp(((Number(m.activeStudents30) || 0) / total) * 100) : null;
  let resposta = null;
  if (m.respondedRate != null) {
    resposta = clamp(Number(m.respondedRate) - Math.min(40, (Number(m.pendingOver24h) || 0) * 10));
  } else if ((Number(m.pendingOver24h) || 0) > 0) {
    resposta = clamp(100 - Math.min(60, Number(m.pendingOver24h) * 15));
  }
  const novos = Number(m.newStudents30);
  const crescimento = Number.isFinite(novos) && (total > 0 || novos > 0)
    ? (novos >= 5 ? 100 : novos >= 3 ? 80 : novos >= 1 ? 55 : 20) : null;
  const ofertas = Number(m.offers);
  const oferta = Number.isFinite(ofertas) ? (ofertas >= 3 ? 100 : ofertas === 2 ? 75 : ofertas === 1 ? 50 : 15) : null;

  const dims = [
    { id: 'activity', label: t('Atividade'), weight: 30, score: atividade != null ? pct(atividade) : null, detail: atividade == null ? t('Sem aulas nos últimos 60 dias.') : tn(l30, '{n} aula em 30 dias, {ant} nos 30 anteriores.', '{n} aulas em 30 dias, {ant} nos 30 anteriores.', { ant: lp }) },
    { id: 'retention', label: t('Retenção'), weight: 25, score: retencao != null ? pct(retencao) : null, detail: retencao != null ? t('{ativos} de {total} alunos tiveram aula nos últimos 30 dias.', { ativos: m.activeStudents30 || 0, total }) : t('Sem alunos no roster.') },
    { id: 'responsiveness', label: t('Resposta'), weight: 20, score: resposta != null ? pct(resposta) : null, detail: resposta != null ? `${m.respondedRate != null ? t('{pct}% dos pedidos respondidos em 24 h', { pct: pct(m.respondedRate) }) : t('Pedidos aguardando resposta')}${m.pendingOver24h ? t('; {n} pendente(s) há mais de 24 h', { n: m.pendingOver24h }) : ''}.` : t('Sem pedidos de aula ainda.') },
    { id: 'growth', label: t('Crescimento'), weight: 15, score: crescimento, detail: Number.isFinite(novos) ? tn(novos, '{n} aluno novo em 30 dias.', '{n} alunos novos em 30 dias.') : t('Sem dados.') },
    { id: 'offer', label: t('Oferta'), weight: 10, score: oferta, detail: Number.isFinite(ofertas) ? tn(ofertas, '{n} oferta ativa (pacote, clínica ou conteúdo).', '{n} ofertas ativas (pacote, clínica ou conteúdo).') : t('Sem dados.') },
  ];
  return combineHealth(dims);
}

/** Selos de reputação do professor — cada um com o critério à vista. */
export function coachBadges(m = {}) {
  const out = [];
  if ((Number(m.validatedStudents) || 0) >= 5) {
    out.push({ id: 'mentor', emoji: '🎓', label: t('Mentor'), criterion: t('5 ou mais alunos com o nível validado por você.') });
  }
  if (m.respondedRate != null && Number(m.respondedRate) >= 90 && (Number(m.responseSample) || 0) >= 5) {
    out.push({ id: 'fast', emoji: '⚡', label: t('Resposta rápida'), criterion: t('90% dos pedidos respondidos em até 24 horas (mínimo de 5 pedidos).') });
  }
  if ((Number(m.lessons30) || 0) >= 10) {
    out.push({ id: 'veteran', emoji: '🏅', label: t('Veterano do ensino'), criterion: t('10 ou mais aulas em 30 dias.') });
  }
  if ((Number(m.totalStudents) || 0) >= 20) {
    out.push({ id: 'roster', emoji: '👥', label: t('Turma grande'), criterion: t('20 ou mais alunos no roster.') });
  }
  return out;
}

export function coachSuggestions(m = {}) {
  const out = [];
  if ((Number(m.pendingOver24h) || 0) > 0) {
    out.push({ id: 'pending', tone: 'warn', text: tn(Number(m.pendingOver24h), '{n} pedido de aula está sem resposta há mais de 24 horas. Quem espera muito escolhe outro professor.', '{n} pedidos de aula estão sem resposta há mais de 24 horas. Quem espera muito escolhe outro professor.') });
  }
  const inativos = Math.max(0, (Number(m.totalStudents) || 0) - (Number(m.activeStudents30) || 0));
  if (inativos >= 3) {
    out.push({ id: 'inactive', tone: 'idea', text: t('{n} alunos não têm aula há mais de 30 dias. Uma mensagem "volta pra quadra?" costuma reativar parte deles.', { n: inativos }) });
  }
  if (Number(m.offers) === 0) {
    out.push({ id: 'offer', tone: 'idea', text: t('Você ainda não tem pacote, clínica nem conteúdo ativos. Um pacote de 5 aulas é o que mais aumenta a retenção.') });
  }
  if (Number(m.newStudents30) === 0 && (Number(m.totalStudents) || 0) > 0) {
    out.push({ id: 'growth', tone: 'idea', text: t('Nenhum aluno novo em 30 dias. Uma clínica aberta ou um cupom de aula experimental atraem quem ainda não conhece você.') });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLUBE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atividade do clube num período: jogos, quem jogou, novos membros, e quem mais
 * contribuiu. Os jogos vêm de `club_event_games` (publicados no ranking).
 *
 * @param {{
 *   games: Array<{ at: number, side_a_ids?: string[], side_b_ids?: string[], winner_side?: string }>,
 *   members: Array<{ user_id: string, joined_at_ms?: number }>,
 *   startMs: number, endMs: number,
 * }} p
 */
export function computeClubActivity({ games = [], members = [], startMs, endMs } = {}) {
  const dentro = (ms) => Number.isFinite(ms) && ms >= startMs && ms < endMs;
  const doPeriodo = games.filter((g) => dentro(Number(g?.at)));
  const porMembro = new Map();
  const ids = new Set(members.map((m) => m.user_id));
  doPeriodo.forEach((g) => {
    const lado = (uids, ganhou) => (uids || []).forEach((u) => {
      if (!u || !ids.has(u)) return; // contribuição é de MEMBRO
      const c = porMembro.get(u) || { uid: u, games: 0, wins: 0 };
      c.games += 1;
      if (ganhou) c.wins += 1;
      porMembro.set(u, c);
    });
    lado(g.side_a_ids, g.winner_side === 'a');
    lado(g.side_b_ids, g.winner_side === 'b');
  });
  const ranking = [...porMembro.values()]
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.uid.localeCompare(b.uid));
  const novos = members.filter((m) => dentro(Number(m.joined_at_ms))).length;
  return {
    games: doPeriodo.length,
    activeMembers: porMembro.size,
    totalMembers: members.length,
    activeRate: members.length ? Math.round((porMembro.size / members.length) * 100) : 0,
    newMembers: novos,
    topContributors: ranking.slice(0, 3),
    ranking,
  };
}

/** As conquistas COLETIVAS do clube, com o progresso de cada uma. */
export const CLUB_COLLECTIVE_GOALS = Object.freeze([
  { id: 'week_10_games', scope: 'week', metric: 'games', target: 10, emoji: '🎾', label: tk('10 jogos na semana'), hint: tk('O clube jogou 10 partidas publicadas em uma semana.') },
  { id: 'week_half_active', scope: 'week', metric: 'activeRate', target: 50, emoji: '🔥', label: tk('Metade do clube jogou'), hint: tk('Ao menos 50% dos membros jogaram na semana.') },
  { id: 'month_100_games', scope: 'month', metric: 'games', target: 100, emoji: '🏟️', label: tk('100 jogos no mês'), hint: tk('Marca histórica: 100 partidas publicadas no mês.') },
  { id: 'month_5_new', scope: 'month', metric: 'newMembers', target: 5, emoji: '🌱', label: tk('5 membros novos no mês'), hint: tk('O clube está crescendo.') },
]);

export function evaluateClubGoals(activity, scope) {
  return CLUB_COLLECTIVE_GOALS.filter((g) => g.scope === scope).map((g) => {
    const valor = Number(activity?.[g.metric]) || 0;
    return { ...g, value: valor, done: valor >= g.target, progress: Math.min(1, valor / g.target) };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// METAS DO MÊS (as três frentes)
// ─────────────────────────────────────────────────────────────────────────────

/** As medidas que cada frente pode escolher como meta. O id é contrato. */
export const GOAL_METRICS = Object.freeze({
  coach: {
    lessons: { label: tk('Aulas concluídas no mês'), unit: tk('aulas'), suggested: 20 },
    new_students: { label: tk('Alunos novos no mês'), unit: tk('alunos'), suggested: 3 },
    clinics: { label: tk('Clínicas abertas no mês'), unit: tk('clínicas'), suggested: 1 },
    validations: { label: tk('Níveis validados no mês'), unit: tk('validações'), suggested: 5 },
  },
  arena: {
    bookings: { label: tk('Reservas jogadas no mês'), unit: tk('reservas'), suggested: 60 },
    events: { label: tk('Eventos abertos no mês'), unit: tk('eventos'), suggested: 2 },
    reviews: { label: tk('Avaliações recebidas no mês'), unit: tk('avaliações'), suggested: 5 },
    new_customers: { label: tk('Clientes novos no mês'), unit: tk('clientes'), suggested: 10 },
  },
  club: {
    games: { label: tk('Jogos publicados no mês'), unit: tk('jogos'), suggested: 40 },
    new_members: { label: tk('Membros novos no mês'), unit: tk('membros'), suggested: 3 },
    events: { label: tk('Eventos no mês'), unit: tk('eventos'), suggested: 2 },
    active_rate: { label: tk('Membros ativos no mês'), unit: '%', suggested: 50 },
  },
});

/**
 * Normaliza a lista de metas de um dono.
 * @param {'coach'|'arena'|'club'} ownerType
 */
export function normalizeGoals(ownerType, goals) {
  const catalogo = GOAL_METRICS[ownerType] || {};
  const vistos = new Set();
  return (Array.isArray(goals) ? goals : [])
    .map((g) => ({ metric: String(g?.metric || ''), target: Math.round(Number(g?.target)) }))
    .filter((g) => catalogo[g.metric] && g.target >= 1 && g.target <= 100000 && !vistos.has(g.metric) && vistos.add(g.metric))
    .slice(0, 6);
}

/**
 * Progresso das metas contra os números reais do mês.
 * @param {'coach'|'arena'|'club'} ownerType
 * @param {Array<{ metric: string, target: number }>} goals
 * @param {Record<string, number|null>} actuals `null` = não dá para medir (não vira 0)
 */
export function evaluateGoals(ownerType, goals, actuals = {}) {
  const catalogo = GOAL_METRICS[ownerType] || {};
  return normalizeGoals(ownerType, goals).map((g) => {
    const real = actuals[g.metric];
    const conhecido = real != null && Number.isFinite(Number(real));
    const valor = conhecido ? Number(real) : null;
    return {
      ...g,
      label: catalogo[g.metric].label,
      unit: catalogo[g.metric].unit,
      value: valor,
      known: conhecido,
      done: conhecido && valor >= g.target,
      progress: conhecido ? Math.min(1, valor / g.target) : 0,
      remaining: conhecido ? Math.max(0, g.target - valor) : null,
    };
  });
}

/** O id do documento de metas: um por dono e por mês. */
export function goalsDocId(ownerType, ownerId, monthKey) {
  return `${ownerType}_${ownerId}_${monthKey}`;
}
