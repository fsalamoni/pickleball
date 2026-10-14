/**
 * Agendamento de jogos em quadras com slots de tempo.
 *
 * Inspirado em CourtHive/TMX, coderobotics e bracketmaker.app — atende à
 * necessidade de organizar dezenas de jogos em poucas quadras, garantindo
 * que um jogador não atue em duas quadras ao mesmo tempo e que tenha um
 * intervalo mínimo de descanso entre jogos.
 *
 * Algoritmo (montagem rodada a rodada, com EQUILÍBRIO de participação):
 *   - Monta a grade rodada a rodada, na ordem das rodadas. Em cada rodada, os
 *     jogos (que são disjuntos por jogador — uma classe paralela) ocupam as
 *     quadras em paralelo a partir do mesmo horário; se houver mais jogos do que
 *     quadras, a rodada avança para o(s) horário(s) seguinte(s).
 *   - A rodada seguinte só começa após o fim da anterior (com um descanso
 *     opcional entre rodadas, `restSlots`). Isso dá horários monotônicos
 *     alinhados às rodadas, todas as quadras aproveitadas e tempo de espera
 *     equilibrado: cada jogador joga uma vez por rodada (quando há folga, ela
 *     circula), sem ninguém acumular jogos só no início ou no fim.
 *   - Nunca coloca um jogador em duas quadras no mesmo horário.
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
import { t } from '@/core/i18n';

export function scheduleMatches(matches, options) {
  const { courts, slotMinutes = 45, restSlots = 0, startAt = null, maxSlots = null } = options;
  // Janela de término (maxSlots) é um ALVO, não um corte: TODOS os jogos são
  // sempre agendados — assim todos os jogos de todos os grupos aparecem na grade,
  // dimensionada para caber todos. Quando um jogo cai DEPOIS do término planejado,
  // emitimos um aviso (faltam quadras ou a janela é curta), sem nunca deixar jogos
  // sem horário nem criar conflitos de jogador.
  const windowSlots = Number.isFinite(maxSlots) && maxSlots >= 0 ? Math.floor(maxSlots) : null;
  const slotCap = 100000;
  if (!Array.isArray(courts) || courts.length === 0) {
    return { assignments: [], totalSlots: 0, warnings: [t('Nenhuma quadra disponível.')] };
  }

  // Ordem estável (round, position): a grade é montada rodada a rodada, em
  // ordem, o que dá horários monotônicos e alinhados às rodadas.
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

  // courtBusy[courtId] = Set<slot>; playerBusy[playerId] = Set<slot>
  const courtBusy = new Map(courts.map((c) => [c.id, new Set()]));
  const playerBusy = new Map();

  const assignments = [];
  const warnings = [];
  let maxSlot = 0;
  const start = startAt ? new Date(startAt) : null;

  const courtFree = (courtId, slot, duration) => {
    const busy = courtBusy.get(courtId);
    for (let d = 0; d < duration; d += 1) if (busy.has(slot + d)) return false;
    return true;
  };
  const playersFree = (players, slot, duration) =>
    players.every((pid) => {
      const pb = playerBusy.get(pid);
      if (!pb) return true;
      for (let d = 0; d < duration; d += 1) if (pb.has(slot + d)) return false;
      return true;
    });

  // Montagem rodada a rodada: cada rodada começa em `roundFloor` (logo após o
  // fim da rodada anterior, com um descanso opcional entre rodadas). Dentro de
  // uma rodada, os jogos são distintos por jogador (classe paralela), então
  // ocupam as quadras em paralelo a partir do mesmo horário; se houver mais
  // jogos do que quadras, a rodada avança para o(s) horário(s) seguinte(s).
  // Resultado: horários monotônicos, quadras aproveitadas e espera equilibrada
  // (todos jogam uma vez por rodada).
  let roundFloor = 0;
  let prevRound;
  for (const m of pending) {
    if (prevRound !== undefined && m.round !== prevRound) {
      roundFloor = maxSlot + restSlots; // próxima rodada após a anterior
    }
    prevRound = m.round;

    let placed = false;
    for (let slot = roundFloor; slot + m.duration <= slotCap; slot += 1) {
      if (!playersFree(m.players, slot, m.duration)) continue;
      const court = courts.find((c) => courtFree(c.id, slot, m.duration));
      if (!court) continue;
      const busy = courtBusy.get(court.id);
      for (let d = 0; d < m.duration; d += 1) busy.add(slot + d);
      m.players.forEach((pid) => {
        if (!playerBusy.has(pid)) playerBusy.set(pid, new Set());
        const pb = playerBusy.get(pid);
        for (let d = 0; d < m.duration; d += 1) pb.add(slot + d);
      });
      const startIso = start
        ? new Date(start.getTime() + slot * slotMinutes * 60_000).toISOString()
        : null;
      assignments.push({ match_id: m.id, court_id: court.id, slot, start_at: startIso });
      maxSlot = Math.max(maxSlot, slot + m.duration);
      placed = true;
      // Todos os jogos são agendados; se passou do término planejado, avisa.
      if (windowSlots != null && slot + m.duration > windowSlots) {
        warnings.push(
          t('O jogo {id} foi agendado após o horário de término planejado — há mais jogos do que a janela/quadras comportam. Adicione quadras ou estenda o horário.', { id: m.id }),
        );
      }
      break;
    }
    if (!placed) {
      warnings.push(t('Sem horário disponível para o jogo {id}.', { id: m.id }));
    }
  }

  return { assignments, totalSlots: maxSlot, warnings };
}

/**
 * Estima a duração total do torneio em minutos, dada uma agenda.
 */
export function estimateScheduleDurationMinutes(schedule, slotMinutes = 45) {
  return (schedule.totalSlots || 0) * slotMinutes;
}
