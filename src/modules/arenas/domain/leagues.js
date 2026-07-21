/**
 * Domínio: Leagues (Arena V3 — sprint 5).
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

/** Normaliza input de torneio interno. */
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
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      name,
      description: String(input.description || '').trim().slice(0, 500),
      date,
      max_participants: Number.isFinite(maxParticipants) ? maxParticipants : 8,
      entry_fee: entryFee,
      format: input.format || 'single_elimination',
      prizes: Array.isArray(input.prizes) ? input.prizes.slice(0, 10) : [],
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
