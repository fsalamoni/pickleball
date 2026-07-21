/**
 * Domínio: IoT + Multi-unit + White label + AI (Arena V3 — sprints 8-11).
 * Domínio puro mínimo para fechar o roadmap.
 */

export const DEVICE_KIND = Object.freeze({
  QR_KIOSK: 'qr_kiosk',
  LIGHTING: 'lighting',
  PRESENCE_SENSOR: 'presence_sensor',
  VIDEO_CAMERA: 'video_camera',
  HVAC: 'hvac',
});

export const DEVICE_STATUS = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline',
  FAULT: 'fault',
  MAINTENANCE: 'maintenance',
});

/** Normaliza device. */
export function normalizeDeviceInput(input = {}) {
  const errors = {};
  const name = String(input.name || '').trim();
  if (!name) errors.name = 'Nome obrigatório.';
  const kind = Object.values(DEVICE_KIND).includes(input.kind) ? input.kind : DEVICE_KIND.QR_KIOSK;
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      name: name.slice(0, 120),
      kind,
      serial: String(input.serial || '').trim().slice(0, 60),
      location: String(input.location || '').trim().slice(0, 120),
    },
  };
}

/** Calcula preço dinâmico baseado em demanda. */
export function calculateDynamicPrice({ basePrice, occupancyPct, hour, isWeekend = false }) {
  if (!Number.isFinite(basePrice) || basePrice <= 0) return 0;
  let multiplier = 1.0;
  // Horário de pico (18-22h)
  if (Number.isFinite(hour) && hour >= 18 && hour <= 22) multiplier += 0.30;
  // Fim de semana
  if (isWeekend) multiplier += 0.20;
  // Alta ocupação
  if (Number.isFinite(occupancyPct)) {
    if (occupancyPct >= 80) multiplier += 0.25;
    else if (occupancyPct >= 50) multiplier += 0.10;
  }
  return Math.round(basePrice * multiplier * 100) / 100;
}

/** Network: agrega stats de várias arenas. */
export function aggregateNetworkStats(arenas = []) {
  const total = arenas.length;
  const totalRevenue = arenas.reduce((acc, a) => acc + (a.revenue || 0), 0);
  const totalBookings = arenas.reduce((acc, a) => acc + (a.bookings_count || 0), 0);
  const avgOccupancy = total > 0
    ? Math.round(arenas.reduce((acc, a) => acc + (a.occupancy_pct || 0), 0) / total)
    : 0;
  return { total, totalRevenue, totalBookings, avgOccupancy };
}

/** Previsão simples de demanda (média móvel ponderada). */
export function forecastDemand(historical = [], daysAhead = 7) {
  if (!Array.isArray(historical) || historical.length === 0) return 0;
  // Weighted: pesos decrescentes (mais recente = mais peso)
  const weights = historical.map((_, idx) => idx + 1);
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  const weightedSum = historical.reduce((acc, v, idx) => acc + v * weights[idx], 0);
  const weightedAvg = weightedSum / sumWeights;
  return Math.round(weightedAvg * daysAhead);
}
