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

// ──────────────────────────────────────────────────────────────────────────
// Semana e mês de Brasília — as chaves das missões semanais e mensais.
// ──────────────────────────────────────────────────────────────────────────

const DIA_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' → dia da semana (0 = domingo) da DATA CIVIL, sem fuso nem hora. */
function diaDaSemanaDe(chave) {
  const [y, m, d] = chave.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Soma `dias` a uma data civil 'YYYY-MM-DD' (aritmética no calendário, sem fuso). */
export function addDaysToDateKey(chave, dias) {
  const [y, m, d] = chave.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + dias));
  return t.toISOString().slice(0, 10);
}

/**
 * A SEGUNDA-FEIRA da semana de `date`, no fuso da plataforma: 'YYYY-MM-DD'.
 * É a chave das missões semanais — a semana vai de segunda a domingo, como no
 * resto do produto (ranking, revisão da semana).
 */
export function platformWeekKey(date = new Date()) {
  const dia = missionDateKey(date);
  const dow = diaDaSemanaDe(dia); // 0 = domingo
  const desdeSegunda = (dow + 6) % 7;
  return addDaysToDateKey(dia, -desdeSegunda);
}

/** O primeiro dia do mês de `date` ('YYYY-MM-01'): a chave das missões mensais. */
export function platformMonthStartKey(date = new Date()) {
  return `${platformMonthKey(date)}-01`;
}

/** A chave de `date` no escopo: dia, segunda-feira da semana ou dia 1 do mês. */
export function scopeKey(scope, date = new Date()) {
  if (scope === 'weekly') return platformWeekKey(date);
  if (scope === 'monthly') return platformMonthStartKey(date);
  return missionDateKey(date);
}

/**
 * Id do documento de missões. O diário NÃO mudou (`{uid}_{dia}`, o que já está
 * no banco); semana e mês ganham um marcador, para a chave nunca colidir com o
 * dia 'YYYY-MM-01' de um diário.
 */
export function missionDocId(uid, scope, key) {
  if (scope === 'weekly') return `${uid}_w_${key}`;
  if (scope === 'monthly') return `${uid}_m_${key}`;
  return `${uid}_${key}`;
}

/** Meia-noite (00:00) da data civil `chave`, em Brasília, em ms. */
export function dayStartMs(chave, timeZone = PLATFORM_TIME_ZONE) {
  // Chute com o deslocamento de hoje e corrige pelo que o Intl realmente diz —
  // o Brasil já teve horário de verão; deslocamento fixo erra nesse dia.
  let ms = Date.parse(`${chave}T00:00:00-03:00`);
  for (let i = 0; i < 3; i += 1) {
    const visto = missionDateKey(new Date(ms), timeZone);
    if (visto === chave) {
      const antes = missionDateKey(new Date(ms - 1), timeZone);
      if (antes !== chave) return ms; // é o primeiro instante do dia
      ms -= 3600_000;
    } else {
      ms += visto < chave ? 3600_000 : -3600_000;
    }
  }
  return ms;
}

/**
 * A janela [início, fim) do escopo, em ms, no fuso da plataforma — o que a tela
 * usa para dizer "faltam 2 dias".
 * @returns {{ key: string, startMs: number, endMs: number }}
 */
export function scopeWindowBR(scope, date = new Date()) {
  const key = scopeKey(scope, date);
  const startMs = dayStartMs(key);
  let fimKey;
  if (scope === 'weekly') fimKey = addDaysToDateKey(key, 7);
  else if (scope === 'monthly') {
    const [y, m] = key.split('-').map(Number);
    fimKey = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`;
  } else fimKey = addDaysToDateKey(key, 1);
  return { key, startMs, endMs: dayStartMs(fimKey) };
}

/** Quanto falta (ms) para o escopo virar. Nunca negativo. */
export function msUntilReset(scope, date = new Date()) {
  return Math.max(0, scopeWindowBR(scope, date).endMs - date.getTime());
}

/** "faltam 2 dias", "faltam 5 h", "faltam 12 min" — para o contador da missão. */
export function formatTimeLeft(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'encerra agora';
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `faltam ${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `faltam ${h} h`;
  const d = Math.floor(h / 24);
  return `faltam ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

export { DIA_MS };
