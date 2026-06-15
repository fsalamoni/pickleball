/**
 * Agendamento de jogos em quadras com slots de tempo.
 *
 * Inspirado em CourtHive/TMX, coderobotics e bracketmaker.app — atende à
 * necessidade de organizar dezenas de jogos em poucas quadras, garantindo
 * que um jogador não atue em duas quadras ao mesmo tempo e que tenha um
 * intervalo mínimo de descanso entre jogos.
 *
 * Algoritmo (guloso, eficaz para os tamanhos típicos de torneios amadores):
 *   - Itera por ordem (round, position) dos jogos.
 *   - Aloca cada jogo no menor (court, slot) em que TODOS os jogadores
 *     envolvidos estejam livres por `slotMinutes` e tenham respeitado
 *     `restSlots` desde seu último jogo.
 *   - Se não houver folga, abre novos slots no fim.
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

  const sorted = matches.slice().sort(
    (a, b) => (a.round - b.round) || (a.position - b.position),
  );

  // courtBusy[courtId] = Set<slot>
  const courtBusy = new Map(courts.map((c) => [c.id, new Set()]));
  // playerLastSlot[playerId] = último slot (final do jogo anterior) em que jogou
  const playerLastSlot = new Map();
  // playerBusy[playerId] = Set<slot> (cobre todos os slots ocupados)
  const playerBusy = new Map();

  const assignments = [];
  const warnings = [];
  let maxSlot = 0;

  const start = startAt ? new Date(startAt) : null;

  for (const m of sorted) {
    const duration = Math.max(1, m.duration_slots || 1);
    const players = (m.player_ids || []).filter(Boolean);
    let chosenCourt = null;
    let chosenSlot = null;

    for (let slot = 0; slot + duration <= slotCap && chosenSlot === null; slot += 1) {
      for (const court of courts) {
        const busy = courtBusy.get(court.id);
        let ok = true;
        for (let d = 0; d < duration; d += 1) {
          if (busy.has(slot + d)) { ok = false; break; }
        }
        if (!ok) continue;
        ok = players.every((pid) => {
          const pb = playerBusy.get(pid);
          if (pb) {
            for (let d = 0; d < duration; d += 1) {
              if (pb.has(slot + d)) return false;
            }
          }
          const last = playerLastSlot.get(pid);
          return last === undefined || slot >= last + restSlots;
        });
        if (ok) { chosenCourt = court; chosenSlot = slot; break; }
      }
    }

    if (chosenSlot === null) {
      warnings.push(
        hasCap
          ? `O jogo ${m.id} não coube na janela de horário definida (término muito cedo para a quantidade de quadras).`
          : `Sem horário disponível para o jogo ${m.id}.`,
      );
      continue;
    }

    const busy = courtBusy.get(chosenCourt.id);
    for (let d = 0; d < duration; d += 1) busy.add(chosenSlot + d);
    players.forEach((pid) => {
      if (!playerBusy.has(pid)) playerBusy.set(pid, new Set());
      const pb = playerBusy.get(pid);
      for (let d = 0; d < duration; d += 1) pb.add(chosenSlot + d);
      playerLastSlot.set(pid, chosenSlot + duration);
    });

    const startIso = start
      ? new Date(start.getTime() + chosenSlot * slotMinutes * 60_000).toISOString()
      : null;

    assignments.push({
      match_id: m.id,
      court_id: chosenCourt.id,
      slot: chosenSlot,
      start_at: startIso,
    });
    maxSlot = Math.max(maxSlot, chosenSlot + duration);
  }

  return { assignments, totalSlots: maxSlot, warnings };
}

/**
 * Estima a duração total do torneio em minutos, dada uma agenda.
 */
export function estimateScheduleDurationMinutes(schedule, slotMinutes = 45) {
  return (schedule.totalSlots || 0) * slotMinutes;
}
