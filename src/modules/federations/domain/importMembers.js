/**
 * IMPORTAÇÃO de filiados por planilha (CSV): a federação que já tem filiados
 * traz nome, e-mail, número antigo e validade. Quem tem conta na PickleRush é
 * LIGADO pelo e-mail no servidor; quem não tem fica na lista de pendentes da
 * importação (a federação convida por fora). Ninguém cria conta por terceiros.
 * Aqui só a leitura do arquivo (pura); quem grava é `federationImportMembers`.
 */
import { t } from '@/core/i18n';
import { IMPORT_MAX_ROWS } from './constants.js';

export const normalizeEmail = (v) => String(v ?? '').trim().toLowerCase();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Separa uma linha CSV respeitando aspas; `;` ou `,` (o que aparecer mais no cabeçalho). */
export function splitCsvLine(line, sep) {
  const out = [];
  let cur = '';
  let aspas = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (aspas) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (c === '"') aspas = false; else cur += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const COLUNAS = {
  name: ['nome', 'name', 'atleta'],
  email: ['email', 'e-mail', 'mail'],
  member_number: ['numero', 'número', 'number', 'matricula', 'matrícula', 'registro'],
  valid_until: ['validade', 'valid_until', 'vencimento', 'valido_ate', 'válido até'],
};

const normalizaCabecalho = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Converte 'DD/MM/AAAA' ou 'AAAA-MM-DD' em ISO; vazio se não entendeu. */
export function toISODateLoose(v) {
  const s = String(v || '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '');
  if (!iso) return '';
  // 31/02/2026 tem o formato certo e não existe: `Date` normaliza para março, e a comparação acusa.
  const [y, mo, d] = iso.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? iso : '';
}

/**
 * Lê o CSV. Cabeçalho obrigatório com pelo menos `nome` e `email`.
 * @returns {{ rows: Array<{ line: number, name: string, email: string, member_number: string, valid_until: string }>, errors: string[] }}
 */
export function parseMembersCsv(text) {
  const linhas = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) return { rows: [], errors: [t('O arquivo precisa de um cabeçalho e pelo menos uma linha.')] };
  const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ';' : ',';
  const cab = splitCsvLine(linhas[0], sep).map(normalizaCabecalho);
  const idx = {};
  Object.entries(COLUNAS).forEach(([campo, nomes]) => { idx[campo] = cab.findIndex((c) => nomes.map(normalizaCabecalho).includes(c)); });
  const errors = [];
  if (idx.name < 0 || idx.email < 0) return { rows: [], errors: [t('O cabeçalho precisa das colunas "nome" e "email".')] };
  const rows = [];
  const vistos = new Set();
  linhas.slice(1).forEach((l, i) => {
    const cols = splitCsvLine(l, sep);
    const pega = (k) => (idx[k] >= 0 ? cols[idx[k]] || '' : '');
    const name = String(pega('name')).slice(0, 120);
    const email = normalizeEmail(pega('email'));
    const linha = i + 2;
    if (!name || !EMAIL.test(email)) { errors.push(t('Linha {n}: nome ou e-mail inválido.', { n: linha })); return; }
    if (vistos.has(email)) { errors.push(t('Linha {n}: e-mail repetido ({email}).', { n: linha, email })); return; }
    vistos.add(email);
    const bruto = pega('valid_until');
    const valid_until = toISODateLoose(bruto);
    if (bruto && !valid_until) errors.push(t('Linha {n}: validade "{v}" não entendida (use DD/MM/AAAA).', { n: linha, v: bruto }));
    rows.push({ line: linha, name, email, member_number: String(pega('member_number')).slice(0, 40), valid_until });
  });
  if (rows.length > IMPORT_MAX_ROWS) errors.push(t('No máximo {n} linhas por importação. Divida o arquivo.', { n: IMPORT_MAX_ROWS }));
  return { rows: rows.slice(0, IMPORT_MAX_ROWS), errors };
}
