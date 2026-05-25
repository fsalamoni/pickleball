/**
 * Prazos finais para palpites, extraídos da aba "Regras" da planilha.
 * Timezone: America/Sao_Paulo (UTC-3 durante Junho/Julho de 2026 — sem horário de verão).
 *
 * Convertidos para ISO em UTC para armazenamento no Firestore.
 */
export const SEED_DEADLINES_BRT = {
  group: '2026-06-09T20:00:00-03:00', // 1ª fase + Campeão + Artilheiro
  r16: '2026-06-29T00:00:00-03:00', // 16-avos
  qf: '2026-07-04T00:00:00-03:00', // Oitavas
  sf: '2026-07-08T20:00:00-03:00', // Quartas
  semi: '2026-07-13T20:00:00-03:00', // Semifinais
  third: '2026-07-17T20:00:00-03:00', // 3º lugar
  final: '2026-07-17T20:00:00-03:00', // Final
};

export const TOURNAMENT_START_BRT = '2026-06-11T16:00:00-03:00';
export const TOURNAMENT_END_BRT = '2026-07-19T16:00:00-03:00';

/**
 * Resolve um deadline ISO string para Date.
 */
export function resolveDeadline(stageCode) {
  const iso = SEED_DEADLINES_BRT[stageCode];
  if (!iso) throw new Error(`Unknown stage code: ${stageCode}`);
  return new Date(iso);
}
