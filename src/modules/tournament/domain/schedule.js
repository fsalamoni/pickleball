/**
 * Agendamento de jogos em quadras com slots de tempo.
 *
 * Inspirado em CourtHive/TMX, coderobotics e bracketmaker.app — atende à
 * necessidade de organizar dezenas de jogos em poucas quadras, garantindo
 * que um jogador não atue em duas quadras ao mesmo tempo e que tenha um
 * intervalo mínimo de descanso entre jogos.
 *
 * Algoritmo (guloso por horário, com EQUILÍBRIO de participação):
 *   - Preenche a grade horário a horário (slot a slot).
 *   - Em cada horário, ocupa as quadras disponíveis escolhendo, entre os jogos
 *     ainda não agendados cujos jogadores estão livres e descansados, aqueles
 *     cujos jogadores estão há MAIS tempo esperando e têm MAIS jogos restantes.
 *     Isso distribui o tempo de quadra e de espera de forma equilibrada: ninguém
 *     joga tudo no início e descansa no fim (nem o contrário), e os intervalos
 *     entre jogos de cada um ficam parecidos.
 *   - Respeita o descanso mínimo (`restSlots`) entre jogos do mesmo jogador e
 *     nunca coloca um jogador em duas quadras no mesmo horário.
 *   - A ordem (round, position) é usada apenas como critério de desempate
 *     estável, mantendo o resultado determinístico.
 *
 * Entrada/saída são puras: nenhum I/O, sem acesso a Firestore.
 */

/**
 * @typedef {Object} ScheduleMatch
 * @property {string} id
 * @property {number} round
 * @property {number} position
 * @property {string[]} player_ids  // ids dos jogadores (1 ou 2 por lado)
 * @property {number} [duration_slots]  // tamanho em slots (default 1)
 */

/**
 * @param {ScheduleMatch[]} matches
 * @param {{
 *   courts: Array<{ id: string, name?: string }>,
 *   slotMinutes?: number,
 *   restSlots?: number,
 *   startAt?: string|Date|null,
 *   maxSlots?: number,
 * }} options
 * @returns {{
 *   assignments: Array<{ match_id: string, court_id: string, slot: number, start_at: string|null }>,
 *   totalSlots: number,
 *   warnings: string[],
 * }}
 */
export function scheduleMatches(matches, options) {
  const { courts, slotMinutes = 45, restSlots = 1, startAt = null, maxSlots = null } = options;
  // Limite rígido de slots (janela de término). Quando definido, um jogo que
  // não couber dentro de [0, maxSlots) não é agendado (court/slot nulos) e um
  // aviso é emitido — preferimos não agendar a criar conflitos.
  const hasCap = Number.isFinite(maxSlots) && maxSlots >= 0;
  const slotCap = hasCap ? Math.floor(maxSlots) : 10000;
  if (!Array.isArray(courts) || courts.length === 0) {
    return { assignments: [], totalSlots: 0, warnings: ['Nenhuma quadra disponível.'] };
  }

  // Ordem estável de desempate (round, position) e índice original.
  const pending = matches
    .map((m, index) => ({
      id: m.id,
      duration: Math.max(1, m.duration_slots || 1),
      players: (m.player_ids || []).filter(Boolean),
      round: m.round || 1,
      position: m.position || index + 1,
      index,
    }))
    .sort((a, b) => (a.round - b.round) || (a.position - b.position) || (a.index - b.index));

  // Total de jogos restantes por jogador — usado para priorizar quem ainda tem
  // muito a jogar, evitando que alguém acumule partidas só no fim.
  const remainingByPlayer = new Map();
  pending.forEach((m) => {
    m.players.forEach((pid) => remainingByPlayer.set(pid, (remainingByPlayer.get(pid) || 0) + 1));
  });

  // playerLastEnd[playerId] = slot em que o último jogo do jogador terminou
  const playerLastEnd = new Map();
  // playerBusy[playerId] = Set<slot>
  const playerBusy = new Map();
  // playerPlayed[playerId] = quantos jogos já agendados (para equilibrar)
  const playerPlayed = new Map();

  const assignments = [];
  const warnings = [];
  const scheduled = new Set();
  let maxSlot = 0;
  const start = startAt ? new Date(startAt) : null;

  const playerFreeAt = (pid, slot, duration) => {
    const pb = playerBusy.get(pid);
    if (pb) {
      for (let d = 0; d < duration; d += 1) {
        if (pb.has(slot + d)) return false;
      }
    }
    const lastEnd = playerLastEnd.get(pid);
    return lastEnd === undefined || slot >= lastEnd + restSlots;
  };

  // Prioridade de equilíbrio de um jogo num dado horário: soma, por jogador,
  // do tempo de espera (slots desde o fim do último jogo) e dos jogos que ainda
  // lhe restam. Quanto maior, mais "urgente" colocá-lo agora — assim quem está
  // parado há mais tempo e tem mais jogos pela frente entra primeiro.
  const gamePriority = (m, slot) => {
    let score = 0;
    for (const pid of m.players) {
      const lastEnd = playerLastEnd.get(pid);
      const waited = lastEnd === undefined ? slot + 1 : slot - lastEnd; // nunca jogou → prioridade alta
      const remaining = remainingByPlayer.get(pid) || 0;
      const played = playerPlayed.get(pid) || 0;
      score += waited * 2 + remaining - played;
    }
    return score;
  };

  // Caminha horário a horário, preenchendo as quadras de cada horário.
  for (let slot = 0; slot < slotCap && scheduled.size < pending.length; slot += 1) {
    const busyThisSlot = new Set();
    let courtsUsed = 0;

    while (courtsUsed < courts.length) {
      // Candidatos: jogos ainda não agendados que cabem neste horário (todos os
      // jogadores livres, descansados e sem conflito com jogos já postos aqui).
      let best = null;
      let bestKey = null;
      for (const m of pending) {
        if (scheduled.has(m.id)) continue;
        if (slot + m.duration > slotCap) continue;
        if (m.players.some((pid) => busyThisSlot.has(pid))) continue;
        if (!m.players.every((pid) => playerFreeAt(pid, slot, m.duration))) continue;
        const prio = gamePriority(m, slot);
        // desempate estável por (round, position, index) já garantido pela ordem
        const key = prio;
        if (best === null || key > bestKey) {
          best = m;
          bestKey = key;
        }
      }
      if (best === null) break; // nada mais cabe neste horário

      const court = courts[courtsUsed];
      best.players.forEach((pid) => {
        busyThisSlot.add(pid);
        if (!playerBusy.has(pid)) playerBusy.set(pid, new Set());
        const pb = playerBusy.get(pid);
        for (let d = 0; d < best.duration; d += 1) pb.add(slot + d);
        playerLastEnd.set(pid, slot + best.duration);
        playerPlayed.set(pid, (playerPlayed.get(pid) || 0) + 1);
        remainingByPlayer.set(pid, (remainingByPlayer.get(pid) || 0) - 1);
      });

      const startIso = start
        ? new Date(start.getTime() + slot * slotMinutes * 60_000).toISOString()
        : null;
      assignments.push({ match_id: best.id, court_id: court.id, slot, start_at: startIso });
      scheduled.add(best.id);
      maxSlot = Math.max(maxSlot, slot + best.duration);
      courtsUsed += 1;
    }
  }

  // Jogos que não couberam (janela de término curta demais).
  pending.forEach((m) => {
    if (!scheduled.has(m.id)) {
      warnings.push(
        hasCap
          ? `O jogo ${m.id} não coube na janela de horário definida (término muito cedo para a quantidade de quadras).`
          : `Sem horário disponível para o jogo ${m.id}.`,
      );
    }
  });

  return { assignments, totalSlots: maxSlot, warnings };
}

/**
 * Estima a duração total do torneio em minutos, dada uma agenda.
 */
export function estimateScheduleDurationMinutes(schedule, slotMinutes = 45) {
  return (schedule.totalSlots || 0) * slotMinutes;
}
