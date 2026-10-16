/**
 * Lista de espera do professor — domínio puro.
 *
 * O aluno que não acha horário livre (o professor ainda não publicou, ou
 * nenhum dos livres serve) entra na lista e é avisado quando o professor
 * abrir horários novos ou quando uma aula confirmada for desfeita. Quem avisa
 * é o SERVIDOR (`functions/coachWaitlist.js`): o gatilho é a escrita do
 * professor (ou de quem cancelou), e o aviso vai para OUTRAS pessoas.
 *
 * Documento `coach_waitlist/{coachId}_{uid}` — um por aluno e professor:
 *  - coach_id, user_id, student_name, coach_name (para a lista do aluno)
 *  - format?   (o formato da aula que o aluno quer — LESSON_FORMAT)
 *  - periods?  ['manha','tarde','noite'] — quando prefere
 *  - weekdays? [0..6] — dias que prefere
 *  - note?     (até 500 caracteres)
 *  - created_at, updated_at; notified_at / notify_count (só o servidor)
 */
import { LESSON_FORMAT } from './lesson.js';
import { t, tk } from '@/core/i18n';

export const COACH_WAITLIST_COLLECTION = 'coach_waitlist';
export const WAITLIST_NOTE_MAX = 500;

export const WAITLIST_PERIODS = Object.freeze([
  { id: 'manha', label: tk('Manhã') },
  { id: 'tarde', label: tk('Tarde') },
  { id: 'noite', label: tk('Noite') },
]);

const PERIOD_IDS = WAITLIST_PERIODS.map((p) => p.id);
const str = (v) => String(v ?? '').trim();

/** Id do documento: um por professor e aluno (entrar de novo regrava). */
export function waitlistDocId(coachId, uid) {
  return `${str(coachId)}_${str(uid)}`;
}

/**
 * Normaliza o que o aluno manda ao entrar na lista.
 * @returns {{ valid: boolean, error: string|null, value: object }}
 */
export function normalizeWaitlistInput(input = {}) {
  const coach_id = str(input.coach_id);
  const user_id = str(input.user_id);
  const format = Object.values(LESSON_FORMAT).includes(str(input.format)) ? str(input.format) : null;
  const periods = Array.isArray(input.periods)
    ? PERIOD_IDS.filter((p) => input.periods.includes(p))
    : [];
  const weekdays = Array.isArray(input.weekdays)
    ? [...new Set(input.weekdays.map((d) => Math.trunc(Number(d))).filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b)
    : [];
  const note = str(input.note).slice(0, WAITLIST_NOTE_MAX);
  const value = {
    coach_id, user_id, student_name: str(input.student_name).slice(0, 120),
    coach_name: str(input.coach_name).slice(0, 120), format, periods, weekdays, note,
  };
  if (!coach_id || !user_id) return { valid: false, error: t('Professor ou aluno não informado.'), value };
  if (coach_id === user_id) return { valid: false, error: t('Você não pode entrar na sua própria lista de espera.'), value };
  return { valid: true, error: null, value };
}

/** As entradas do professor, da mais antiga para a mais nova (quem espera há mais tempo primeiro). */
export function sortWaitlist(entries = []) {
  const ms = (e) => {
    const c = e?.created_at;
    if (c && typeof c.toMillis === 'function') return c.toMillis();
    return Number(e?.created_at_ms) || 0;
  };
  return [...entries].sort((a, b) => ms(a) - ms(b));
}

/**
 * O que o aluno prefere, em uma linha ("Manhã, Noite · Seg, Qua").
 * @param {object} entry
 * @param {string[]} weekdayLabels rótulos já traduzidos (Dom..Sáb)
 */
export function waitlistPreferenceText(entry = {}, weekdayLabels = []) {
  const periodos = WAITLIST_PERIODS.filter((p) => (entry.periods || []).includes(p.id)).map((p) => t(p.label));
  const dias = (entry.weekdays || []).map((d) => weekdayLabels[d]).filter(Boolean);
  return [periodos.join(', '), dias.join(', ')].filter(Boolean).join(' · ');
}
