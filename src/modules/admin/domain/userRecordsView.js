/**
 * A LISTA de Cadastros do Painel admin — filtros, ordem, panorama, pedido de
 * atualização e planilha. Lógica pura, sem React e sem Firebase.
 *
 * Por que existe: a lista nasceu para dezenas de contas, e com milhares ela
 * deixa de responder às perguntas que o admin faz — "em que pé estão os
 * cadastros?", "quem está sem cidade em SP?", "quem não entra há três meses?",
 * "manda para essa gente completar o cadastro". Cada uma é uma conta aqui, e
 * a tela só desenha.
 *
 * As linhas que chegam são as ENRIQUECIDAS pela tela (`_status`, `_teste`,
 * `_conta`, `_dupr`, …) — o mesmo cálculo que já decidia os selos de cada
 * linha, para que filtro e selo nunca discordem.
 */
import { ADMIN_EDITABLE_FIELDS, isRequiredField } from '@/modules/admin/domain/adminUserEdit';
import { normalizeLocality, ufOf } from '@/core/domain/locality';
import { isBrazilUF } from '@/core/domain/ufs';
import { instanteEmMs } from '@/core/domain/instant';
import { readDuprRating } from '@/core/domain/duprRating';
import { tk } from '@/core/i18n';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Janelas de atividade. Constantes: o texto da tela as lê daqui. */
export const NEW_ACCOUNT_DAYS = 30;
export const ACTIVE_DAYS = 30;
export const INACTIVE_DAYS = 90;
/** Quem recebeu um pedido de atualização há menos disso não recebe outro, por padrão. */
export const REMINDER_COOLDOWN_DAYS = 7;
/** Quantos uids cabem num registro de auditoria do pedido (um documento por lote). */
export const REMINDER_AUDIT_CHUNK = 400;

/** Situação do cadastro. Os ids são contrato de link (`?situacao=`). */
export const RECORD_STATUS_FILTERS = Object.freeze([
  { id: 'todos', label: tk('Todos') },
  { id: 'pendentes', label: tk('Falta obrigatório') },
  { id: 'completos', label: tk('Completos') },
  { id: 'incompletos', label: tk('Algo a preencher') },
  { id: 'dupr', label: tk('DUPR a conferir') },
  { id: 'teste', label: tk('Parecem de teste') },
  { id: 'fechadas', label: tk('Suspensas e bloqueadas') },
]);

/** Atividade (`?atividade=`). */
export const RECORD_ACTIVITY_FILTERS = Object.freeze([
  { id: '', label: tk('Qualquer atividade') },
  { id: 'novos', label: tk('Cadastrados nos últimos {n} dias'), days: NEW_ACCOUNT_DAYS },
  { id: 'ativos', label: tk('Entraram nos últimos {n} dias'), days: ACTIVE_DAYS },
  { id: 'inativos', label: tk('Sem entrar há mais de {n} dias'), days: INACTIVE_DAYS },
]);

/** Perfil (`?perfil=`). */
export const RECORD_ROLE_FILTERS = Object.freeze([
  { id: '', label: tk('Todos os perfis') },
  { id: 'atletas', label: tk('Atletas') },
  { id: 'professores', label: tk('Professores') },
  { id: 'admins', label: tk('Administradores da plataforma') },
]);

/** Ordem (`?ordem=`). A primeira é o padrão: o que precisa de ação vem antes. */
export const RECORD_SORTS = Object.freeze([
  { id: 'prioridade', label: tk('O que precisa de ação primeiro') },
  { id: 'nome', label: tk('Nome (A–Z)') },
  { id: 'recentes', label: tk('Cadastro mais recente') },
  { id: 'antigos', label: tk('Cadastro mais antigo') },
  { id: 'acesso_recente', label: tk('Último acesso mais recente') },
  { id: 'acesso_antigo', label: tk('Há mais tempo sem entrar') },
  { id: 'menos_preenchido', label: tk('Menos preenchido') },
]);

/** UF "sem UF" no filtro — não colide com nenhuma UF de verdade. */
export const NO_UF = 'sem';

const ids = (lista) => new Set(lista.map((x) => x.id));
const SITUACOES = ids(RECORD_STATUS_FILTERS);
const ATIVIDADES = ids(RECORD_ACTIVITY_FILTERS);
const PERFIS = ids(RECORD_ROLE_FILTERS);
const ORDENS = ids(RECORD_SORTS);
const CAMPOS = new Set(ADMIN_EDITABLE_FIELDS.map((f) => f.key));

/**
 * Os filtros a partir da URL. Valor inventado cai no padrão em vez de virar
 * uma lista vazia que parece "ninguém".
 *
 * @param {{ get(k: string): string|null }} params `URLSearchParams` ou parecido
 */
export function readRecordFilters(params) {
  const get = (k) => String(params?.get?.(k) ?? '').trim();
  const situacao = get('situacao');
  const atividade = get('atividade');
  const perfil = get('perfil');
  const ordem = get('ordem');
  const falta = get('falta');
  const uf = get('uf');
  return {
    busca: get('busca'),
    situacao: SITUACOES.has(situacao) ? situacao : 'todos',
    atividade: ATIVIDADES.has(atividade) ? atividade : '',
    perfil: PERFIS.has(perfil) ? perfil : '',
    ordem: ORDENS.has(ordem) ? ordem : 'prioridade',
    falta: CAMPOS.has(falta) ? falta : '',
    uf: uf === NO_UF ? NO_UF : (isBrazilUF(uf) ? ufOf(uf) : ''),
  };
}

/** Algum recorte além da busca e da ordem? (Mostra "Limpar filtros".) */
export function hasActiveRecordFilters(f = {}) {
  return Boolean(f.busca || (f.situacao && f.situacao !== 'todos') || f.atividade || f.perfil || f.falta || f.uf);
}

/** Cadastro e último acesso, em ms (NaN quando não há). */
export function recordTimes(user = {}) {
  return {
    createdMs: instanteEmMs(user.created_at ?? user.created_at_ms),
    lastLoginMs: instanteEmMs(user.last_login),
  };
}

/** O perfil, para o filtro. Admin vence professor. */
export function recordRole(user = {}) {
  if (['platform_admin', 'admin'].includes(user.role)) return 'admins';
  if (user.is_coach === true) return 'professores';
  return 'atletas';
}

const nomeDe = (u) => String(u?.platform_name || u?.full_name || '').trim();

/** O que a busca procura: nome, e-mail, cidade, UF, ID DUPR e uid — sem acento nem caixa. */
function textoDeBusca(u) {
  return normalizeLocality([u.platform_name, u.full_name, u.email, u.city, u.state, u.dupr_id, u.uid].filter(Boolean).join(' '));
}

function dentroDe(ms, now, days) {
  return Number.isFinite(ms) && now - ms <= days * DIA_MS;
}

function casaSituacao(u, situacao) {
  switch (situacao) {
    case 'pendentes': return !u._status.complete;
    case 'completos': return u._status.complete;
    case 'incompletos': return u._status.missingCount > 0;
    case 'dupr': return u._dupr.issues.length > 0;
    case 'teste': return u._teste.length > 0;
    case 'fechadas': return u._conta.status !== 'active';
    default: return true;
  }
}

function casaAtividade(u, atividade, now) {
  if (!atividade) return true;
  const { createdMs, lastLoginMs } = u._tempo || recordTimes(u);
  if (atividade === 'novos') return dentroDe(createdMs, now, NEW_ACCOUNT_DAYS);
  if (atividade === 'ativos') return dentroDe(lastLoginMs, now, ACTIVE_DAYS);
  // Nunca registrou acesso também é "sem entrar".
  if (atividade === 'inativos') return !dentroDe(lastLoginMs, now, INACTIVE_DAYS);
  return true;
}

/**
 * Aplica os filtros. Todos se somam (E).
 *
 * @param {Array<object>} rows linhas enriquecidas
 * @param {ReturnType<typeof readRecordFilters>} f
 * @param {{ now?: number }} [opts]
 */
export function filterRecords(rows = [], f = {}, { now = Date.now() } = {}) {
  const termos = normalizeLocality(f.busca).split(' ').filter(Boolean);
  return rows.filter((u) => {
    if (!casaSituacao(u, f.situacao)) return false;
    if (!casaAtividade(u, f.atividade, now)) return false;
    if (f.perfil && recordRole(u) !== f.perfil) return false;
    if (f.falta && !u._status.missing.some((m) => m.key === f.falta)) return false;
    if (f.uf) {
      const uf = isBrazilUF(u.state) ? ufOf(u.state) : NO_UF;
      if (uf !== f.uf) return false;
    }
    if (termos.length === 0) return true;
    // Cada palavra em algum lugar: "ana porto" acha a Ana de Porto Alegre.
    const alvo = u._busca ?? textoDeBusca(u);
    return termos.every((p) => alvo.includes(p));
  });
}

const porNome = (a, b) => {
  const na = normalizeLocality(nomeDe(a));
  const nb = normalizeLocality(nomeDe(b));
  // Sem nome vai para o fim: é o que menos se acha por ordem alfabética.
  if (!na !== !nb) return na ? -1 : 1;
  if (na !== nb) return na < nb ? -1 : 1;
  return String(a.uid).localeCompare(String(b.uid));
};

/** Data ausente vai para o fim nas duas direções. */
const porData = (campo, desc) => (a, b) => {
  const va = (a._tempo || recordTimes(a))[campo];
  const vb = (b._tempo || recordTimes(b))[campo];
  const fa = Number.isFinite(va);
  const fb = Number.isFinite(vb);
  if (fa !== fb) return fa ? -1 : 1;
  if (fa && va !== vb) return desc ? vb - va : va - vb;
  return porNome(a, b);
};

const prioridade = (u) => {
  // Obrigatório faltando > DUPR a conferir > algo opcional faltando > em dia.
  if (!u._status.complete) return 0;
  if (u._dupr.issues.length > 0) return 1;
  if (u._status.missingCount > 0) return 2;
  return 3;
};

const COMPARADORES = {
  prioridade: (a, b) => (prioridade(a) - prioridade(b))
    || (b._status.missingRequired.length - a._status.missingRequired.length)
    || (b._status.missingCount - a._status.missingCount)
    || porNome(a, b),
  nome: porNome,
  recentes: porData('createdMs', true),
  antigos: porData('createdMs', false),
  acesso_recente: porData('lastLoginMs', true),
  // "Há mais tempo sem entrar": quem nunca entrou vem primeiro.
  acesso_antigo: (a, b) => {
    const va = (a._tempo || recordTimes(a)).lastLoginMs;
    const vb = (b._tempo || recordTimes(b)).lastLoginMs;
    const fa = Number.isFinite(va);
    const fb = Number.isFinite(vb);
    if (fa !== fb) return fa ? 1 : -1;
    if (fa && va !== vb) return va - vb;
    return porNome(a, b);
  },
  menos_preenchido: (a, b) => (a._status.filledCount - b._status.filledCount) || porNome(a, b),
};

/** Ordena (cópia). Ordem desconhecida = prioridade. */
export function sortRecords(rows = [], ordem = 'prioridade') {
  return [...rows].sort(COMPARADORES[ordem] || COMPARADORES.prioridade);
}

/**
 * Pré-calcula o que filtro e ordem consultam a cada tecla, para que milhares
 * de linhas não refaçam a mesma conta: datas e o texto da busca.
 */
export function withRecordIndex(row) {
  return { ...row, _tempo: recordTimes(row), _busca: textoDeBusca(row) };
}

/**
 * O panorama — "em que estágio estão os cadastros". Conta sobre TODAS as
 * linhas (não sobre o recorte), para o número de cada atalho não mudar
 * conforme se filtra.
 */
export function recordsOverview(rows = [], { now = Date.now(), essencial = true } = {}) {
  const conta = (pred) => rows.reduce((n, u) => n + (pred(u) ? 1 : 0), 0);
  const total = rows.length;
  const completos = conta((u) => u._status.complete);
  const obrigatorios = ADMIN_EDITABLE_FIELDS.filter((f) => isRequiredField(f, { essencial }));
  const porCampo = obrigatorios
    .map((f) => ({
      key: f.key,
      label: f.label,
      count: conta((u) => u._status.missingRequired.some((m) => m.key === f.key)),
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
  return {
    total,
    completos,
    pendentes: total - completos,
    completosPct: total ? Math.round((completos / total) * 100) : 0,
    incompletos: conta((u) => u._status.missingCount > 0),
    dupr: conta((u) => u._dupr.issues.length > 0),
    teste: conta((u) => u._teste.length > 0),
    fechadas: conta((u) => u._conta.status !== 'active'),
    vencidas: conta((u) => u._conta.vencida),
    novos: conta((u) => casaAtividade(u, 'novos', now)),
    ativos: conta((u) => casaAtividade(u, 'ativos', now)),
    inativos: conta((u) => casaAtividade(u, 'inativos', now)),
    porCampo,
  };
}

/** UFs presentes, com contagem, para o seletor (as que existem antes; "sem UF" no fim). */
export function recordUfCounts(rows = []) {
  const mapa = new Map();
  rows.forEach((u) => {
    const uf = isBrazilUF(u.state) ? ufOf(u.state) : NO_UF;
    mapa.set(uf, (mapa.get(uf) || 0) + 1);
  });
  return [...mapa.entries()]
    .map(([uf, count]) => ({ uf, count }))
    .sort((a, b) => (a.uf === NO_UF) - (b.uf === NO_UF) || b.count - a.count || a.uf.localeCompare(b.uf));
}

/**
 * Quando cada pessoa recebeu o último pedido de atualização, a partir da
 * Auditoria (`admin_profile_reminder_sent`, um registro por lote, com os uids).
 * @returns {Map<string, number>} uid → ms
 */
export function lastReminderByUid(logs = []) {
  const mapa = new Map();
  (logs || []).forEach((l) => {
    const ms = Number(l?.created_at_ms) || instanteEmMs(l?.created_at);
    if (!Number.isFinite(ms)) return;
    (l?.details?.uids || []).forEach((uid) => {
      if ((mapa.get(uid) || 0) < ms) mapa.set(uid, ms);
    });
  });
  return mapa;
}

/**
 * Quem recebe o pedido de completar o cadastro: quem tem OBRIGATÓRIO faltando
 * (pedir DUPR ou foto a todo mundo vira ruído), com a conta aberta e visível.
 * Com `lastReminder`, deixa de fora quem recebeu um pedido há menos de
 * `cooldownDays` — insistir todo dia ensina a ignorar o aviso.
 *
 * @returns {{ uids: string[], recentes: number, fechadas: number, emDia: number }}
 */
export function reminderAudience(rows = [], { lastReminder = null, cooldownDays = REMINDER_COOLDOWN_DAYS, now = Date.now() } = {}) {
  const uids = [];
  let recentes = 0;
  let fechadas = 0;
  let emDia = 0;
  rows.forEach((u) => {
    if (u._status.complete) { emDia += 1; return; }
    if (u.hidden === true || u._conta.status !== 'active') { fechadas += 1; return; }
    const ultimo = lastReminder?.get?.(u.uid);
    if (lastReminder && ultimo && now - ultimo < cooldownDays * DIA_MS) { recentes += 1; return; }
    uids.push(u.uid);
  });
  return { uids: [...new Set(uids)], recentes, fechadas, emDia };
}

/** Divide os uids nos lotes de um registro de auditoria cada. */
export function reminderAuditChunks(uids = [], size = REMINDER_AUDIT_CHUNK) {
  const lotes = [];
  for (let i = 0; i < uids.length; i += size) lotes.push(uids.slice(i, i + size));
  return lotes;
}

/* ------------------------------ planilha ------------------------------ */

const SEP = ';';
const BOM = String.fromCharCode(0xFEFF);

/** Campo CSV: aspas quando preciso e sem virar fórmula no Excel (`=`, `+`, `-`, `@`). */
export function csvCell(valor) {
  let s = String(valor ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const dataCsv = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : '');

export const RECORDS_CSV_HEADERS = Object.freeze([
  tk('Nome'), tk('uid'), tk('Cidade'), tk('UF'), tk('Perfil'), tk('Situação da conta'),
  tk('Cadastro completo'), tk('Falta preencher'), tk('Cadastrado em'), tk('Último acesso'),
  tk('ID DUPR'), tk('Rating DUPR'), tk('DUPR a conferir'),
]);

/**
 * A planilha do recorte. **Sem e-mail, telefone, endereço nem nascimento**: na
 * tela esses dados aparecem mascarados e só se revelam com motivo e registro —
 * uma planilha com eles seria a porta dos fundos dessa regra.
 *
 * @param {Array<object>} rows linhas enriquecidas
 * @param {(texto: string) => string} traduzir `t` da tela (rótulos)
 */
export function recordsCsv(rows = [], traduzir = (s) => s) {
  const linhas = [RECORDS_CSV_HEADERS.map((h) => csvCell(traduzir(h))).join(SEP)];
  rows.forEach((u) => {
    const tempo = u._tempo || recordTimes(u);
    const dupr = readDuprRating(u.dupr_rating);
    linhas.push([
      nomeDe(u), u.uid, u.city || '', isBrazilUF(u.state) ? ufOf(u.state) : '',
      traduzir(RECORD_ROLE_FILTERS.find((p) => p.id === recordRole(u))?.label || ''),
      traduzir(u._conta.label), u._status.complete ? traduzir('sim') : traduzir('não'),
      u._status.missing.map((m) => traduzir(m.label)).join(', '),
      dataCsv(tempo.createdMs), dataCsv(tempo.lastLoginMs),
      u.dupr_id || '', dupr.status === 'ok' ? dupr.value.toFixed(3) : String(u.dupr_rating ?? ''),
      u._dupr.issues.length > 0 ? traduzir('sim') : '',
    ].map(csvCell).join(SEP));
  });
  return BOM + linhas.join('\r\n');
}
