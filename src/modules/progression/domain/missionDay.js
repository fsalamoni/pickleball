/**
 * missionDay — o "dia" das missões, no fuso do usuário brasileiro.
 *
 * Por que existe: o dia da missão era calculado com `date.toISOString()`, que
 * é UTC. Para quem está em São Paulo (UTC−3), isso virava o dia às 21h — o
 * jogador perdia as missões da noite e recebia missões novas antes da meia-
 * noite. O produto é pt-BR, então o dia precisa ser o dia de Brasília.
 *
 * Lógica pura, sem I/O.
 */

/** Fuso de referência do produto. */
export const PLATFORM_TIME_ZONE = 'America/Sao_Paulo';

/**
 * Chave do dia no fuso da plataforma: 'YYYY-MM-DD'.
 *
 * Usa `Intl` (nativo, sem dependência nova) em vez de subtrair 3h na mão —
 * o Brasil já teve horário de verão e pode voltar a ter; deslocamento fixo
 * volta a errar nesse dia.
 *
 * @param {Date} [date]
 * @param {string} [timeZone]
 * @returns {string} 'YYYY-MM-DD'
 */
export function missionDateKey(date = new Date(), timeZone = PLATFORM_TIME_ZONE) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return missionDateKey(new Date(), timeZone);
  // 'en-CA' formata como YYYY-MM-DD, que é exatamente a chave que queremos.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/**
 * Semente determinística do dia, derivada da chave do dia.
 *
 * Todo mundo que abrir o app no mesmo dia (no fuso da plataforma) gera as
 * mesmas missões, e a Date recebida NUNCA é mutada — a versão anterior usava
 * `now.setHours(0,0,0,0)`, que alterava o objeto do chamador.
 *
 * @param {Date} [date]
 * @returns {number} inteiro estável para o dia
 */
export function missionDaySeed(date = new Date()) {
  const key = missionDateKey(date);
  const [y, m, d] = key.split('-').map(Number);
  return (y * 10000 + m * 100 + d) * 100 + 100;
}

/**
 * Chave do mês no fuso da plataforma: 'YYYY-MM'.
 * Mesma motivação de `missionDateKey` — o cap mensal de indicações precisa
 * virar na virada do mês em Brasília, não em UTC.
 *
 * @param {Date} [date]
 * @returns {string} 'YYYY-MM'
 */
export function platformMonthKey(date = new Date()) {
  return missionDateKey(date).slice(0, 7);
}
