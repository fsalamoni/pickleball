/**
 * Domínio: Members & Packages (Arena V3 — sprint 2).
 *
 * PURO. Sem I/O.
 */

export const MEMBER_TIER = Object.freeze({
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  PLATINUM: 'platinum',
});

export const MEMBER_STATUS = Object.freeze({
  ACTIVE: 'active',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
});

/** Config padrão de tiers (a arena pode customizar). */
export const DEFAULT_TIERS = Object.freeze([
  { id: 'bronze', name: 'Bronze', min_points: 0, discount_pct: 0, color: 'amber', perks: [] },
  { id: 'silver', name: 'Prata', min_points: 100, discount_pct: 5, color: 'gray', perks: ['Prioridade em lotação'] },
  { id: 'gold', name: 'Ouro', min_points: 500, discount_pct: 10, color: 'yellow', perks: ['Prioridade', '10% off', 'Convite de eventos'] },
  { id: 'platinum', name: 'Platina', min_points: 1500, discount_pct: 15, color: 'violet', perks: ['Tudo do Ouro', 'Aula grátis/mês', 'Reserva antecipada 30 dias'] },
]);

/** Calcula o tier baseado nos pontos. */
export function computeTier(points, tiers = DEFAULT_TIERS) {
  if (!Number.isFinite(points) || points < 0) return tiers[0];
  return [...tiers]
    .sort((a, b) => a.min_points - b.min_points)
    .reverse()
    .find((t) => points >= t.min_points) || tiers[0];
}

/** Adiciona pontos a um membro, retornando o tier resultante. */
export function addPoints(currentPoints, pointsToAdd, tiers = DEFAULT_TIERS) {
  const total = (Number(currentPoints) || 0) + (Number(pointsToAdd) || 0);
  return { points: total, tier: computeTier(total, tiers) };
}

/** Valida input de criação de member. */
export function normalizeMemberInput(input = {}) {
  return {
    user_id: String(input.user_id || '').trim(),
    user_name: String(input.user_name || '').trim(),
    user_photo: String(input.user_photo || '').trim(),
    tier: Object.values(MEMBER_TIER).includes(input.tier) ? input.tier : MEMBER_TIER.BRONZE,
    points: Number.isFinite(Number(input.points)) ? Math.max(0, Number(input.points)) : 0,
    status: Object.values(MEMBER_STATUS).includes(input.status) ? input.status : MEMBER_STATUS.ACTIVE,
    joined_at: input.joined_at || null,
  };
}

/** Valida pacote. */
export function normalizePackageInput(input = {}) {
  const errors = {};
  const name = String(input.name || '').trim();
  if (!name) errors.name = 'Nome obrigatório.';
  if (name.length > 80) errors.name = 'Máx. 80 chars.';

  const hours = Number(input.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 200) {
    errors.hours = 'Horas deve ser entre 1 e 200.';
  }

  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0) {
    errors.price = 'Preço deve ser maior que 0.';
  }

  const validityDays = Number(input.validity_days) || 60;
  if (validityDays < 1 || validityDays > 365) {
    errors.validity_days = 'Validade deve ser entre 1 e 365 dias.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      name,
      description: String(input.description || '').trim().slice(0, 500),
      hours,
      price,
      validity_days: validityDays,
      active: input.active !== false,
    },
  };
}

/** Verifica se pacote está dentro da validade. */
export function isPackageValid(pkg, now = Date.now()) {
  if (!pkg?.expires_at) return false;
  const expiresMs = pkg.expires_at instanceof Date
    ? pkg.expires_at.getTime()
    : Number(pkg.expires_at);
  return Number.isFinite(expiresMs) && expiresMs > now;
}

/** Calcula horas restantes. */
export function getPackageRemainingHours(pkg) {
  if (!pkg) return 0;
  return Math.max(0, (pkg.total_hours || 0) - (pkg.used_hours || 0));
}

/** Consome horas de um pacote. */
export function consumePackageHours(pkg, hours) {
  if (!pkg) return null;
  const remaining = getPackageRemainingHours(pkg);
  const consume = Math.min(remaining, Number(hours) || 0);
  return {
    ...pkg,
    used_hours: (pkg.used_hours || 0) + consume,
  };
}

/** Cashback progressivo baseado no total gasto. */
export function calculateCashbackPct(totalSpent) {
  if (!Number.isFinite(totalSpent) || totalSpent <= 0) return 0;
  if (totalSpent >= 5000) return 7;
  if (totalSpent >= 2000) return 5;
  if (totalSpent >= 500) return 3;
  if (totalSpent >= 100) return 1;
  return 0;
}

/** Crédito de cashback (em R$). */
export function calculateCashback(amount, totalSpent) {
  const pct = calculateCashbackPct(totalSpent);
  return Math.round((amount * pct / 100) * 100) / 100;
}
