/**
 * GOVERNANÇA da federação (PR 4) — estatuto, mandato, diretoria e atas.
 * Mora em `federations.governance` (campo opcional, público: a página mostra)
 * e só quem tem `admin` edita. Lógica pura. Não é módulo: transparência não
 * se desliga — mas em branco, nada aparece.
 */
import { t } from '@/core/i18n';

export const BOARD_MAX = 12;
export const MINUTES_MAX = 24;
/** Mínimo de mulheres nos cargos de direção, em décimos (Lei 14.597/2023, art. 36, IX): 3 = 30%. */
export const WOMEN_QUOTA_TENTHS = 3;
const str = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isHttps = (u) => /^https:\/\/\S+$/i.test(u);
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

/**
 * @param {object} input { statute_url, bylaws, mandate: { start, end }, board: [{ role, name }], minutes: [{ title, date, url }] }
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object }}
 */
export function validateGovernance(input = {}) {
  const errors = {};
  const statute_url = str(input.statute_url, 500);
  if (statute_url && !isHttps(statute_url)) errors.statute_url = t('O estatuto precisa de um endereço https://');
  const start = str(input.mandate?.start, 10);
  const end = str(input.mandate?.end, 10);
  if (start && !isDate(start)) errors['mandate.start'] = t('Data inválida.');
  if (end && !isDate(end)) errors['mandate.end'] = t('Data inválida.');
  if (start && end && !errors['mandate.start'] && !errors['mandate.end'] && end < start) errors['mandate.end'] = t('O mandato termina depois de começar.');
  const boardIn = Array.isArray(input.board) ? input.board : [];
  const minutesIn = Array.isArray(input.minutes) ? input.minutes : [];
  // Passou do teto é ERRO dito, nunca corte silencioso: a diretoria perderia o 13º nome sem ninguém ver.
  if (boardIn.length > BOARD_MAX) errors.board = t('A diretoria tem no máximo {n} nomes.', { n: BOARD_MAX });
  if (minutesIn.length > MINUTES_MAX) errors.minutes = t('No máximo {n} atas. Apague as mais antigas.', { n: MINUTES_MAX });
  const board = boardIn.slice(0, BOARD_MAX).map((m, i) => {
    const role = str(m?.role, 60);
    const name = str(m?.name, 80);
    if (!role || !name) errors[`board.${i}`] = t('Cargo e nome.');
    return { role, name };
  });
  const minutes = minutesIn.slice(0, MINUTES_MAX).map((a, i) => {
    const title = str(a?.title, 120);
    const date = str(a?.date, 10);
    const url = str(a?.url, 500);
    if (title.length < 3) errors[`minutes.${i}.title`] = t('Título da ata (mínimo 3 caracteres).');
    if (date && !isDate(date)) errors[`minutes.${i}.date`] = t('Data inválida.');
    if (url && !isHttps(url)) errors[`minutes.${i}.url`] = t('O link começa com https://');
    return { title, date, url };
  });
  // Quantas mulheres ocupam os cargos da diretoria: só o número (nunca quem), para o aviso da cota.
  const wcRaw = String(input.women_count ?? '').trim();
  let women_count = null;
  if (wcRaw !== '') {
    const n = Number(wcRaw);
    if (!Number.isInteger(n) || n < 0) errors.women_count = t('Um número inteiro, zero ou mais.');
    else if (n > board.length) errors.women_count = t('Não passa do número de cargos da diretoria ({n}).', { n: board.length });
    else women_count = n;
  }
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { statute_url, bylaws: String(input.bylaws ?? '').trim().slice(0, 4000), mandate: { start, end }, board, minutes, women_count },
  };
}

/** Tem algo para mostrar? (em branco, a seção não aparece) */
export function hasGovernance(g) {
  return Boolean(g && (g.statute_url || g.bylaws || g.mandate?.start || g.mandate?.end || g.board?.length || g.minutes?.length));
}

/**
 * A cota de mulheres na direção (Lei 14.597/2023, art. 36, IX — no mínimo
 * 30%). Só AVISO: a plataforma não barra nada, a federação responde pelo
 * estatuto e pela lei. `status`: `empty` (sem diretoria cadastrada),
 * `unknown` (não disse quantas são mulheres), `ok` ou `below`.
 */
export function womenQuota(g) {
  const total = Array.isArray(g?.board) ? g.board.length : 0;
  const min = Math.ceil((total * WOMEN_QUOTA_TENTHS) / 10);
  if (!total) return { status: 'empty', total, min, women: null };
  const women = Number.isInteger(g?.women_count) ? g.women_count : null;
  if (women == null) return { status: 'unknown', total, min, women };
  return { status: women >= min ? 'ok' : 'below', total, min, women };
}

/** A frase do aviso da cota, para a tela (vazio quando não há diretoria). */
export function womenQuotaText(q) {
  if (q.status === 'empty') return '';
  if (q.status === 'unknown') return t('Diga quantas mulheres ocupam os cargos da diretoria: a lei pede no mínimo 30% ({min} de {total}).', { min: q.min, total: q.total });
  if (q.status === 'below') return t('{n} de {total} cargos da diretoria com mulheres: abaixo do mínimo de 30% que a lei pede ({min}). É só um aviso.', { n: q.women, total: q.total, min: q.min });
  return t('{n} de {total} cargos da diretoria com mulheres: dentro do mínimo de 30% ({min}).', { n: q.women, total: q.total, min: q.min });
}

/** As atas da mais recente para a mais antiga. */
export function sortMinutes(list = []) {
  return [...(list || [])].sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')));
}
