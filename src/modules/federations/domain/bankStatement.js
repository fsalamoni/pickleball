/**
 * EXTRATO BANCÁRIO → lançamentos: lê o arquivo que o banco exporta (OFX, o
 * padrão dos bancos brasileiros, ou planilha CSV) e devolve os movimentos já
 * no formato do lançamento — crédito vira receita, débito vira despesa, a
 * categoria começa em "outras" e o financeiro ajusta antes de importar.
 * Pura: quem grava é `federationAccounts` (`entry_import`), que valida de novo
 * e usa `bank_ref` como identidade (importar o mesmo extrato não duplica).
 * Linhas de SALDO não são movimento e ficam de fora.
 */
import { t } from '@/core/i18n';
import { BANK_IMPORT_MAX, ENTRY_KIND, bankRef, validateEntryInput } from './accounts.js';
import { parseBrlCents } from './charges.js';
import { splitCsvLine, toISODateLoose } from './importMembers.js';

const SEM_DESCRICAO = 'Movimento do extrato';
const SALDO = /^\s*saldo\b/i;

const normaliza = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Valor com sinal, em centavos: "-1.234,56", "(150,00)", "150,00 D", "R$ 9,90", "-150.00". NaN se não entendeu. */
export function parseSignedCents(txt) {
  let s = String(txt ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/\s?[Dd]$/.test(s)) { neg = true; s = s.replace(/\s?[Dd]$/, ''); } else s = s.replace(/\s?[Cc]$/, '');
  s = s.replace(/R\$/g, '').trim();
  if (/^[-−–]|-$/.test(s)) { neg = true; s = s.replace(/^[-−–]\s*|\s*-$/g, ''); }
  s = s.replace(/^\+/, '');
  const v = parseBrlCents(s);
  return Number.isNaN(v) ? NaN : (neg ? -v : v);
}

/** Data do extrato: DD/MM/AAAA, DD/MM/AA, DD-MM-AAAA, AAAA-MM-DD ou AAAAMMDD (OFX). */
export function parseBankDate(txt) {
  const s = String(txt ?? '').trim();
  const ofx = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofx && !/[/-]/.test(s.slice(0, 8))) return toISODateLoose(`${ofx[1]}-${ofx[2]}-${ofx[3]}`);
  const br = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
  if (br) return toISODateLoose(`${br[1]}/${br[2]}/${br[3].length === 2 ? `20${br[3]}` : br[3]}`);
  return toISODateLoose(s.slice(0, 10));
}

function movimento({ line, date, cents, description, counterparty, ref }) {
  const kind = cents < 0 ? ENTRY_KIND.EXPENSE : ENTRY_KIND.INCOME;
  const desc = String(description || '').replace(/\s+/g, ' ').trim();
  return {
    line,
    kind,
    category: kind === ENTRY_KIND.EXPENSE ? 'other_expense' : 'other_income',
    date,
    amount_cents: Math.abs(cents),
    description: (desc.length >= 3 ? desc : SEM_DESCRICAO).slice(0, 300),
    counterparty: String(counterparty || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    bank_ref: bankRef(ref),
  };
}

const tag = (bloco, nome) => {
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i'));
  return m ? m[1].trim() : '';
};

/** OFX (SGML ou XML): um movimento por `<STMTTRN>`; a identidade é o FITID do banco. */
export function parseOfx(text) {
  const blocos = String(text || '').split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]);
  const rows = [];
  const errors = [];
  let skipped = 0;
  const conta = tag(String(text || ''), 'ACCTID');
  blocos.forEach((b, i) => {
    const date = parseBankDate(tag(b, 'DTPOSTED'));
    const cents = parseSignedCents(tag(b, 'TRNAMT'));
    const memo = tag(b, 'MEMO');
    const name = tag(b, 'NAME');
    const fitid = tag(b, 'FITID');
    if (!date || Number.isNaN(cents)) { errors.push(t('Movimento {n}: data ou valor não entendidos.', { n: i + 1 })); return; }
    if (cents === 0 || SALDO.test(memo || name)) { skipped += 1; return; }
    const ref = fitid ? `ofx:${conta}:${fitid}` : `ofx:${conta}:${date}|${cents}|${memo || name}|${i}`;
    rows.push(movimento({ line: i + 1, date, cents, description: memo || name, counterparty: memo && name && name !== memo ? name : '', ref }));
  });
  if (!blocos.length) errors.push(t('Nenhum movimento encontrado no arquivo OFX.'));
  return { rows, errors, skipped };
}

const COLUNAS = {
  date: ['data', 'date', 'dt', 'data lancamento', 'data do lancamento', 'data movimento', 'data da transacao', 'data mov.'],
  description: ['descricao', 'historico', 'lancamento', 'memo', 'detalhes', 'descricao do lancamento', 'transacao'],
  amount: ['valor', 'amount', 'valor (r$)', 'valor r$', 'quantia'],
  credit: ['credito', 'entrada', 'creditos', 'credito (r$)', 'entradas'],
  debit: ['debito', 'saida', 'debitos', 'debito (r$)', 'saidas'],
  counterparty: ['favorecido', 'contraparte', 'nome', 'beneficiario', 'pagador', 'origem/destino'],
  doc: ['documento', 'doc', 'numero do documento', 'n documento', 'identificador', 'id'],
};

/** Planilha: acha o cabeçalho (o banco às vezes põe linhas da conta antes), `;` ou `,`. */
export function parseBankCsv(text) {
  const linhas = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  let cab = -1;
  let sep = ';';
  let idx = {};
  for (let i = 0; i < Math.min(linhas.length, 20) && cab < 0; i += 1) {
    const l = linhas[i];
    if (!l.trim()) continue;
    const s = (l.match(/;/g) || []).length >= (l.match(/,/g) || []).length ? ';' : ',';
    const cols = splitCsvLine(l, s).map(normaliza);
    const achar = (nomes) => cols.findIndex((c) => nomes.includes(c));
    const ix = Object.fromEntries(Object.entries(COLUNAS).map(([k, nomes]) => [k, achar(nomes)]));
    if (ix.date >= 0 && (ix.amount >= 0 || ix.credit >= 0 || ix.debit >= 0)) { cab = i; sep = s; idx = ix; }
  }
  if (cab < 0) return { rows: [], errors: [t('Não achei o cabeçalho do extrato: a planilha precisa das colunas "data" e "valor" (ou "crédito" e "débito").')], skipped: 0 };
  const rows = [];
  const errors = [];
  let skipped = 0;
  const vistos = new Map();
  linhas.slice(cab + 1).forEach((l, i) => {
    if (!l.trim()) return;
    const linha = cab + i + 2;
    const cols = splitCsvLine(l, sep);
    const pega = (k) => (idx[k] >= 0 ? cols[idx[k]] || '' : '');
    const description = pega('description');
    if (SALDO.test(description) || SALDO.test(pega('date'))) { skipped += 1; return; }
    const date = parseBankDate(pega('date'));
    let cents;
    if (idx.amount >= 0) cents = parseSignedCents(pega('amount'));
    else {
      const cr = pega('credit').trim() ? parseSignedCents(pega('credit')) : 0;
      const db = pega('debit').trim() ? parseSignedCents(pega('debit')) : 0;
      cents = Number.isNaN(cr) || Number.isNaN(db) ? NaN : Math.abs(cr) - Math.abs(db);
    }
    if (!date || Number.isNaN(cents)) { errors.push(t('Linha {n}: data ou valor não entendidos.', { n: linha })); return; }
    if (cents === 0) { skipped += 1; return; }
    const doc = pega('doc').trim();
    // Sem número de documento, a identidade é a própria linha — com a ORDEM da repetição,
    // porque duas tarifas iguais no mesmo dia são dois movimentos.
    const base = `${date}|${cents}|${normaliza(description)}`;
    const n = (vistos.get(base) || 0) + 1;
    vistos.set(base, n);
    const ref = doc ? `csv:doc:${doc}|${date}|${cents}` : `csv:${base}|${n}`;
    rows.push(movimento({ line: linha, date, cents, description, counterparty: pega('counterparty'), ref }));
  });
  return { rows, errors, skipped };
}

/** Bytes do arquivo → texto. Banco brasileiro costuma exportar em Windows-1252: UTF-8 inválido cai nele. */
export function decodeBankFile(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/** Lê o extrato pelo conteúdo: OFX se tiver as marcas do formato; senão, planilha. */
export function parseBankStatement(text) {
  const s = String(text || '');
  return /<OFX>|OFXHEADER/i.test(s) ? parseOfx(s) : parseBankCsv(s);
}

/**
 * Como cada movimento chega à tela de conferência: já lançado (mesma identidade
 * no livro), no futuro, em período fechado ou pronto. Só os prontos vêm marcados.
 */
export function reviewBankRows(rows, { ledger = [], hoje, closedPeriod = () => null } = {}) {
  const refs = new Set((Array.isArray(ledger) ? ledger : []).map((e) => e && e.bank_ref).filter(Boolean));
  return (Array.isArray(rows) ? rows : []).map((r) => {
    let problem = '';
    if (refs.has(r.bank_ref)) problem = 'duplicate';
    else if (!r.bank_ref) problem = 'invalid';
    else if (closedPeriod(r.date)) problem = 'closed';
    else if (!validateEntryInput(r, { hoje }).ok) problem = 'invalid';
    // O mesmo movimento duas vezes no arquivo (FITID repetido): vale o primeiro.
    if (!problem) refs.add(r.bank_ref);
    return { ...r, problem, selected: !problem };
  });
}

/** O que vai ao servidor: só os marcados, no formato do lançamento, até o teto. */
export function bankImportPayload(rows) {
  return (Array.isArray(rows) ? rows : []).filter((r) => r.selected && !r.problem).slice(0, BANK_IMPORT_MAX)
    .map(({ kind, category, date, amount_cents, description, counterparty, bank_ref }) => ({ kind, category, date, amount_cents, description, counterparty, bank_ref }));
}
