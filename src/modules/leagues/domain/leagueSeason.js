/**
 * A TEMPORADA da liga: quando cada rodada acontece (fonte única do cliente).
 *
 * As datas das rodadas são DERIVADAS da temporada gravada (`leagues.season`),
 * nunca gravadas jogo a jogo: mudar a cadência ou pular um feriado muda o
 * calendário inteiro sem regravar nada. Datas são `AAAA-MM-DD` e a conta é
 * feita em UTC para não depender do fuso do aparelho (só o dia importa).
 *
 * A normalização tem cópia no servidor (`functions/leaguePolicy.js`), com
 * paridade: o que a tela aceita é o que a função grava.
 */
import { tk } from '@/core/i18n';

export const SEASON_CADENCE = Object.freeze({ WEEKLY: 'weekly', BIWEEKLY: 'biweekly', MONTHLY: 'monthly', CUSTOM: 'custom' });

export const SEASON_CADENCE_LABELS = Object.freeze({
  weekly: tk('Toda semana'),
  biweekly: tk('A cada 2 semanas'),
  monthly: tk('Todo mês'),
  custom: tk('Datas escolhidas'),
});

/** Dias de prazo padrão por cadência (o prazo da rodada). */
const WINDOW_DEFAULT = Object.freeze({ weekly: 7, biweekly: 14, monthly: 28, custom: 7 });
const MAX_DATES = 60;
const PLAYOFF_SIZES = Object.freeze([2, 4, 8]);

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `AAAA-MM-DD` válido (e que existe no calendário)? */
export function isIsoDate(v) {
  if (typeof v !== 'string' || !DATA.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const toMs = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromMs = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso, n) => fromMs(toMs(iso) + n * 86400000);

/** Soma meses mantendo o dia (31/01 + 1 mês = 28 ou 29/02). */
export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return fromMs(alvo.getTime());
}

const datas = (lista) => [...new Set((Array.isArray(lista) ? lista : []).filter(isIsoDate))].sort().slice(0, MAX_DATES);
const inteiro = (v, min, max, padrao) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : padrao;
};

/**
 * A temporada como a liga a usa. Campo inválido volta ao padrão; sem data de
 * início válida, `start_date` é `null` (o calendário fica "a definir").
 */
export function normalizeSeason(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const cadence = Object.values(SEASON_CADENCE).includes(r.cadence) ? r.cadence : SEASON_CADENCE.WEEKLY;
  const playoff = r.playoff && typeof r.playoff === 'object' ? r.playoff : {};
  return {
    start_date: isIsoDate(r.start_date) ? r.start_date : null,
    cadence,
    custom_dates: cadence === SEASON_CADENCE.CUSTOM ? datas(r.custom_dates) : [],
    skip_dates: datas(r.skip_dates),
    play_time: typeof r.play_time === 'string' && HORA.test(r.play_time) ? r.play_time : '',
    round_window_days: inteiro(r.round_window_days, 1, 31, WINDOW_DEFAULT[cadence]),
    legs: inteiro(r.legs, 1, 2, 1),
    playoff: {
      enabled: playoff.enabled === true,
      size: PLAYOFF_SIZES.includes(Number(playoff.size)) ? Number(playoff.size) : 4,
      third_place: playoff.third_place === true,
    },
  };
}

/** Quantas rodadas tem o pontos corridos de `n` inscritos (ímpar folga uma vez por turno). */
export function roundsFor(entryCount, legs = 1) {
  const n = Math.floor(Number(entryCount)) || 0;
  if (n < 2) return 0;
  return (n % 2 === 0 ? n - 1 : n) * (legs === 2 ? 2 : 1);
}

/**
 * O calendário: `[{ round, date, deadline }]`. Data pulada empurra a rodada
 * para o próximo passo da cadência (o feriado não "come" a rodada). Nas datas
 * escolhidas, a rodada sem data fica com `date: null` (a definir).
 */
export function roundCalendar(seasonRaw, roundCount) {
  const s = normalizeSeason(seasonRaw);
  const total = Math.max(0, Math.min(200, Math.floor(Number(roundCount)) || 0));
  const pular = new Set(s.skip_dates);
  const fim = (date) => (date ? addDays(date, s.round_window_days - 1) : null);
  const out = [];
  if (s.cadence === SEASON_CADENCE.CUSTOM) {
    const livres = s.custom_dates.filter((d) => !pular.has(d));
    for (let i = 0; i < total; i += 1) {
      const date = livres[i] || null;
      out.push({ round: i + 1, date, deadline: fim(date) });
    }
    return out;
  }
  if (!s.start_date) return Array.from({ length: total }, (_, i) => ({ round: i + 1, date: null, deadline: null }));
  const passo = (iso, k) => {
    if (s.cadence === SEASON_CADENCE.MONTHLY) return addMonths(s.start_date, k);
    return addDays(iso, s.cadence === SEASON_CADENCE.BIWEEKLY ? 14 * k : 7 * k);
  };
  let k = 0;
  for (let i = 0; i < total; i += 1) {
    let date = passo(s.start_date, k);
    let guarda = 0;
    while (pular.has(date) && guarda < MAX_DATES) {
      k += 1;
      guarda += 1;
      date = passo(s.start_date, k);
    }
    out.push({ round: i + 1, date, deadline: fim(date) });
    k += 1;
  }
  return out;
}

/** A rodada em que estamos hoje (`hoje` = `AAAA-MM-DD`): a primeira cujo prazo não passou. */
export function currentRound(calendar, hoje) {
  const lista = Array.isArray(calendar) ? calendar : [];
  if (!isIsoDate(hoje)) return null;
  return lista.find((r) => r.deadline && r.deadline >= hoje) || null;
}
