/**
 * ORÇAMENTO E PRESTAÇÃO DE CONTAS da federação (módulo `accounts`) — só o
 * SERVIDOR grava `federation_budgets`, `federation_ledger` e
 * `federation_account_reports` (a regra é `allow write: if false`). Por que
 * aqui: o lançamento não se apaga (estorna com motivo), o período com
 * prestação enviada fica fechado, o retrato das contas é congelado ao enviar,
 * o parecer é do conselho fiscal e publicar exige parecer — nada disso se
 * garante no navegador.
 *
 * Callable `federationAccounts`. Quem vê: `finance`, `fiscal` ou `admin`.
 * Quem prepara (orçamento, lançamentos, prestação): `finance` ou `admin`.
 * Quem dá o parecer: `fiscal` (ou `admin`, registrado como dado pelo admin).
 *  - `budget_save`: cria/edita o orçamento do ano; editar o aprovado ou o
 *    publicado é REFORMULAR (motivo, volta a rascunho, histórico guarda as
 *    linhas anteriores; o público segue vendo a última versão publicada);
 *  - `budget_submit` → `budget_approve` (data e, se houver, a reunião da
 *    agenda em que foi aprovado) → `budget_publish`;
 *  - `entry_add` / `entry_void`: lançamento manual (anexo copiado para a pasta
 *    oficial, fechada à regra) e estorno com motivo — nunca apagar;
 *  - `report_open` (abre o período ou reabre a enviada sem parecer, com
 *    motivo), `report_save` (demonstrações e notas), `report_submit`
 *    (CONGELA o retrato e avisa o conselho fiscal), `opinion` (parecer; avisa
 *    a equipe), `report_assembly` (resultado da assembleia) e
 *    `report_publish` (exige parecer; com o acervo ligado, publica as
 *    demonstrações e o parecer como atos de transparência pelo
 *    `federationAcervo`);
 *  - `file`: entrega o anexo de um lançamento ou uma demonstração a quem vê
 *    as contas.
 *
 * Receitas DERIVADAS: as cobranças pagas (`federation_charges`). Despesas
 * derivadas: `despesasDerivadas` abaixo (ponto de junção da arbitragem).
 * A conta pura é `federationAccountsPolicy.js`.
 */
const crypto = require('node:crypto');
const A = require('./federationAccountsPolicy.js');
const AG = require('./federationAgendaPolicy.js');
const RP = require('./federationRefereesPolicy.js');
const f = require('./federations.js');
const ac = require('./federationAcervo.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const BUDGETS = 'federation_budgets';
const LEDGER = 'federation_ledger';
const REPORTS = 'federation_account_reports';
const EVENTS = 'federation_events';
const HISTORY_MAX = 30;

const podePreparar = (perms) => perms.includes('finance') || perms.includes('admin');
const podeParecer = (perms) => perms.includes('fiscal') || perms.includes('admin');
const podeVer = (perms) => podePreparar(perms) || perms.includes('fiscal');

async function contexto(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  if (!(fed.modules && fed.modules.accounts === true)) falha('failed-precondition', 'Esta federação não tem o orçamento e a prestação de contas ligados.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  if (!podeVer(perms)) falha('permission-denied', 'Você não tem permissão para as contas desta federação.');
  return { fed, perms };
}

const exigePreparar = (perms) => { if (!podePreparar(perms)) falha('permission-denied', 'Só o financeiro (ou quem administra a federação) mexe nas contas.'); };
const hojeBR = (ctx) => A.dateBR(ctx.now);
const quem = (actor) => texto(actor.name, 80);
const entrada = (ctx, actor, kind, extra = {}) => ({ kind, at_ms: ctx.now, by_name: quem(actor), ...extra });
const comHistorico = (doc, item) => [...(Array.isArray(doc.history) ? doc.history : []), item].slice(-HISTORY_MAX);

function exigeValido(r) {
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]);
  return r.value;
}

function exigeMotivo(data, oQue) {
  const reason = texto(data.reason, 500);
  if (reason.length < A.REASON_MIN) falha('invalid-argument', `Diga o motivo ${oQue} (mínimo ${A.REASON_MIN} caracteres).`);
  return reason;
}

/**
 * Despesas DERIVADAS de outros módulos, no formato de `extraExpenseItems`
 * (`{ date, amount_cents, category, ref, auto }`). ⭐ Ponto de junção da
 * arbitragem: as diárias pagas (`refereeFeesAsExpenses(assignments)`) entram
 * aqui, sem serem lançadas de novo à mão — com o módulo de arbitragem ligado.
 */
async function despesasDerivadas(ctx, fed) {
  if (!(fed.modules && fed.modules.referees === true)) return [];
  const snap = await ctx.db.collection('federation_assignments').where('federation_id', '==', fed.id).get();
  return RP.refereeFeesAsExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

/** Tudo o que entra na conta da federação: manual + cobranças pagas + derivadas. */
async function itensDaConta(ctx, fed) {
  const [led, chg, extra] = await Promise.all([
    ctx.db.collection(LEDGER).where('federation_id', '==', fed.id).get(),
    ctx.db.collection(f.C.charges).where('federation_id', '==', fed.id).get(),
    despesasDerivadas(ctx, fed),
  ]);
  return A.accountItems({
    ledger: led.docs.map((d) => ({ id: d.id, ...d.data() })),
    charges: chg.docs.map((d) => ({ id: d.id, ...d.data() })),
    extraExpenses: extra,
  });
}

async function relatorios(ctx, fed) {
  const snap = await ctx.db.collection(REPORTS).where('federation_id', '==', fed.id).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** O período com prestação já ENVIADA está fechado: o retrato que o conselho examina não muda por baixo. */
async function exigePeriodoAberto(ctx, fed, date) {
  const fechado = A.closedPeriodFor(date, await relatorios(ctx, fed));
  if (fechado) falha('failed-precondition', `A prestação de contas de ${fechado} já foi enviada: este período está fechado. Lance o ajuste numa data do período aberto, explicando na descrição.`);
}

async function reuniaoDaAgenda(ctx, fed, eventId) {
  if (!eventId) return null;
  const s = await ctx.db.collection(EVENTS).doc(eventId).get();
  const d = s.exists ? s.data() : null;
  if (!d || d.federation_id !== fed.id || !(AG.KINDS[d.kind] && AG.KINDS[d.kind].meeting)) falha('failed-precondition', 'Escolha uma reunião ou assembleia da agenda desta federação.');
  return { event_id: eventId, event_title: texto(d.title, 160), event_date: texto(d.date, 10) };
}

const linkCentral = (fed, aba) => `/federacoes/${encodeURIComponent(fed.id)}/gerir?aba=${aba}`;

/** Avisa a equipe com a permissão (sem repetir, sem quem agiu). */
async function avisarEquipe(ctx, actor, fed, perms, msg) {
  const listas = await Promise.all(perms.map((p) => f.staffIds(ctx, fed.id, p)));
  const uids = [...new Set(listas.flat())].filter((u) => u && u !== actor.uid);
  if (!uids.length) return 0;
  const batch = ctx.db.batch();
  uids.forEach((u) => f.aviso(ctx, batch, u, msg));
  await batch.commit();
  return uids.length;
}

/* ------------------------------------------------------------ arquivos -- */

const extensao = (ct) => (String(ct).split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';

/** Anexo NOVO só da pasta de quem salva; copiado para a pasta oficial (fechada à regra), com SHA-256. */
async function oficializarAnexo(ctx, actor, item, dest) {
  if (!item.path.startsWith(`federacao-contas/${actor.uid}/`)) falha('permission-denied', `O arquivo "${item.name}" não foi enviado por você. Envie de novo.`);
  const r = await ac.oficializar(ctx, item, dest, false);
  return { ...r, ...(item.kind ? { kind: item.kind } : {}) };
}

async function entregar(ctx, path, nome, tipo) {
  if (!ctx.bucket) falha('unavailable', 'Arquivos indisponíveis no momento. Tente de novo.');
  const alvo = ctx.bucket.file(path);
  const [meta] = await alvo.getMetadata().catch(() => [null]);
  if (!meta) falha('not-found', 'O arquivo não está mais no servidor.');
  if (Number(meta.size) > A.FILE_MAX) falha('failed-precondition', 'Arquivo grande demais para abrir por aqui.');
  const [bytes] = await alvo.download();
  return { ok: true, name: nome, contentType: meta.contentType || tipo || 'application/octet-stream', base64: Buffer.from(bytes).toString('base64') };
}

/* ----------------------------------------------------------- orçamento -- */

async function orcamento(ctx, fed, year) {
  const ref = ctx.db.collection(BUDGETS).doc(`${fed.id}_${Number(year) || 0}`);
  const snap = await ref.get();
  return { ref, budget: snap.exists ? { id: snap.id, ...snap.data() } : null };
}

async function budgetSave(ctx, actor, data, { fed, perms }) {
  exigePreparar(perms);
  const v = exigeValido(A.validateBudget(data.budget || {}));
  const { ref, budget } = await orcamento(ctx, fed, v.year);
  const ts = ctx.Timestamp.fromMillis(ctx.now);
  if (!budget) {
    await ref.set({
      federation_id: fed.id, year: v.year, lines: v.lines, notes: v.notes, status: A.BUDGET_STATUS.DRAFT, history: [entrada(ctx, actor, 'created')],
      created_by: actor.uid, created_by_name: quem(actor), created_at: ts, created_at_ms: ctx.now, updated_by: actor.uid, updated_at_ms: ctx.now,
    });
    await f.auditoria(ctx, actor, 'federation_budget_save', { federation_id: fed.id, year: v.year, created: true });
    return { ok: true, budgetId: ref.id };
  }
  const aprovado = [A.BUDGET_STATUS.APPROVED, A.BUDGET_STATUS.PUBLISHED].includes(budget.status);
  const patch = { lines: v.lines, notes: v.notes, status: A.BUDGET_STATUS.DRAFT, updated_by: actor.uid, updated_at_ms: ctx.now };
  if (aprovado) {
    const reason = exigeMotivo(data, 'da reformulação');
    patch.history = comHistorico(budget, entrada(ctx, actor, 'reformulated', { reason, previous_status: budget.status, previous_lines: budget.lines || {} }));
    patch.approved_in = null;
  }
  await ref.update(patch);
  await f.auditoria(ctx, actor, 'federation_budget_save', { federation_id: fed.id, year: v.year, reformulated: aprovado });
  return { ok: true, budgetId: ref.id };
}

async function budgetStep(ctx, actor, data, { fed, perms }, acao) {
  exigePreparar(perms);
  const { ref, budget } = await orcamento(ctx, fed, data.year);
  if (!budget) falha('not-found', 'Orçamento não encontrado.');
  const precisa = { submit: A.BUDGET_STATUS.DRAFT, approve: A.BUDGET_STATUS.SUBMITTED, publish: A.BUDGET_STATUS.APPROVED }[acao];
  if (budget.status !== precisa) falha('failed-precondition', { submit: 'Só o rascunho é enviado para aprovação.', approve: 'Envie o orçamento para aprovação antes de registrar a aprovação.', publish: 'Só o orçamento aprovado é publicado.' }[acao]);
  const patch = { updated_by: actor.uid, updated_at_ms: ctx.now };
  if (acao === 'submit') {
    patch.status = A.BUDGET_STATUS.SUBMITTED;
    patch.history = comHistorico(budget, entrada(ctx, actor, 'submitted'));
  } else if (acao === 'approve') {
    const v = exigeValido(A.validateAssembly({ ...(data.approval || {}), result: 'approved' }));
    const reuniao = await reuniaoDaAgenda(ctx, fed, v.event_id);
    patch.status = A.BUDGET_STATUS.APPROVED;
    patch.approved_in = { date: v.date, note: v.note, ...(reuniao || { event_id: '', event_title: '', event_date: '' }) };
    patch.history = comHistorico(budget, entrada(ctx, actor, 'approved', { date: v.date }));
  } else {
    patch.status = A.BUDGET_STATUS.PUBLISHED;
    patch.published = { lines: budget.lines || {}, notes: budget.notes || '', approved_in: budget.approved_in || null, at_ms: ctx.now };
    // O público lê só a CÓPIA (`{id}_pub`): o documento de trabalho nunca leva `pub`, então
    // reformular depois não expõe o rascunho a quem lê a página.
    await ctx.db.collection(BUDGETS).doc(`${ref.id}_pub`).set({ federation_id: fed.id, year: budget.year, pub: true, copy_of: ref.id, published: patch.published, updated_at_ms: ctx.now });
    patch.history = comHistorico(budget, entrada(ctx, actor, 'published'));
  }
  await ref.update(patch);
  await f.auditoria(ctx, actor, `federation_budget_${acao}`, { federation_id: fed.id, year: budget.year });
  return { ok: true };
}

/* ---------------------------------------------------------- lançamentos -- */

async function entryAdd(ctx, actor, data, { fed, perms }) {
  exigePreparar(perms);
  const v = exigeValido(A.validateEntry(data.entry || {}, { hoje: hojeBR(ctx) }));
  if (v.document && !A.UPLOAD_RE.test(v.document.path)) falha('invalid-argument', 'Anexo inválido. Envie de novo.');
  await exigePeriodoAberto(ctx, fed, v.date);
  const ref = ctx.db.collection(LEDGER).doc();
  const document = v.document ? await oficializarAnexo(ctx, actor, v.document, `federacao-contas-oficial/${fed.id}/ledger/${ref.id}/1.${extensao(v.document.content_type)}`) : null;
  await ref.set({
    federation_id: fed.id, ...v, document, status: 'posted',
    created_by: actor.uid, created_by_name: quem(actor), created_at: ctx.Timestamp.fromMillis(ctx.now), created_at_ms: ctx.now,
  });
  await f.auditoria(ctx, actor, 'federation_ledger_add', { federation_id: fed.id, entry_id: ref.id, kind: v.kind, category: v.category, amount_cents: v.amount_cents, date: v.date });
  return { ok: true, entryId: ref.id };
}

async function entryVoid(ctx, actor, data, { fed, perms }) {
  exigePreparar(perms);
  const ref = ctx.db.collection(LEDGER).doc(texto(data.entryId, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== fed.id) falha('not-found', 'Lançamento não encontrado.');
  const e = snap.data();
  if (e.status === 'void') falha('failed-precondition', 'Este lançamento já foi estornado.');
  const reason = exigeMotivo(data, 'do estorno');
  await exigePeriodoAberto(ctx, fed, e.date);
  await ref.update({ status: 'void', void_reason: reason, voided_by: actor.uid, voided_by_name: quem(actor), voided_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_ledger_void', { federation_id: fed.id, entry_id: snap.id, amount_cents: e.amount_cents, reason });
  return { ok: true };
}

/* ---------------------------------------------------- prestação de contas -- */

async function relatorio(ctx, fed, reportId) {
  const ref = ctx.db.collection(REPORTS).doc(texto(reportId, 120));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== fed.id) falha('not-found', 'Prestação de contas não encontrada.');
  return { ref, report: { id: snap.id, ...snap.data() } };
}

async function reportOpen(ctx, actor, data, { fed, perms }) {
  exigePreparar(perms);
  const period = texto(data.period, 7);
  if (!A.isValidPeriod(period)) falha('invalid-argument', 'Período inválido: o ano (2026) ou o trimestre (2026-Q1).');
  if (A.periodRange(period).from > hojeBR(ctx)) falha('invalid-argument', 'Este período ainda não começou.');
  const ref = ctx.db.collection(REPORTS).doc(`${fed.id}_${period}`);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      federation_id: fed.id, period, status: A.REPORT_STATUS.DRAFT, statements: [], notes: '', snapshot: null, history: [entrada(ctx, actor, 'opened')],
      opened_by: actor.uid, opened_by_name: quem(actor), opened_at_ms: ctx.now, updated_at_ms: ctx.now,
    });
    await f.auditoria(ctx, actor, 'federation_account_report_open', { federation_id: fed.id, period });
    return { ok: true, reportId: ref.id };
  }
  const report = snap.data();
  if (report.status === A.REPORT_STATUS.DRAFT) return { ok: true, reportId: ref.id };
  if (report.status !== A.REPORT_STATUS.SUBMITTED) falha('failed-precondition', 'Depois do parecer a prestação não volta a rascunho.');
  const reason = exigeMotivo(data, 'para reabrir');
  await ref.update({ status: A.REPORT_STATUS.DRAFT, snapshot: null, history: comHistorico(report, entrada(ctx, actor, 'reopened', { reason })), updated_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_account_report_reopen', { federation_id: fed.id, period, reason });
  return { ok: true, reportId: ref.id };
}

async function reportSave(ctx, actor, data, { fed, perms }) {
  exigePreparar(perms);
  const { ref, report } = await relatorio(ctx, fed, data.reportId);
  if (report.status !== A.REPORT_STATUS.DRAFT) falha('failed-precondition', 'Só a prestação em rascunho muda.');
  const v = exigeValido(A.validateStatements(data.statements));
  const atuais = Array.isArray(report.statements) ? report.statements : [];
  const out = [];
  for (const [i, item] of v.entries()) {
    if (A.OFFICIAL_RE.test(item.path)) {
      const ja = atuais.find((x) => x.path === item.path);
      if (!ja) falha('invalid-argument', 'Uma demonstração não pertence a esta prestação. Envie de novo.');
      out.push({ ...ja, kind: item.kind });
    } else {
      out.push(await oficializarAnexo(ctx, actor, item, `federacao-contas-oficial/${fed.id}/reports/${report.id}/${ctx.now}-${i + 1}.${extensao(item.content_type)}`));
    }
  }
  const tirados = atuais.filter((x) => !out.some((y) => y.path === x.path));
  if (ctx.bucket) await Promise.all(tirados.map((x) => ctx.bucket.file(x.path).delete().catch(() => {})));
  await ref.update({ statements: out, notes: texto(data.notes, A.NOTES_MAX), updated_at_ms: ctx.now, updated_by: actor.uid });
  await f.auditoria(ctx, actor, 'federation_account_report_save', { federation_id: fed.id, report_id: report.id, statements: out.length });
  return { ok: true };
}

async function reportSubmit(ctx, actor, data, { fed, perms }) {
  exigePreparar(perms);
  const { ref, report } = await relatorio(ctx, fed, data.reportId);
  if (report.status !== A.REPORT_STATUS.DRAFT) falha('failed-precondition', 'Esta prestação já foi enviada.');
  const range = A.periodRange(report.period);
  if (range.to >= hojeBR(ctx)) falha('failed-precondition', 'O período ainda não terminou: envie depois do último dia.');
  const items = await itensDaConta(ctx, fed);
  const { budget } = A.isAnnualPeriod(report.period) ? await orcamento(ctx, fed, report.period) : { budget: null };
  const snapshot = A.buildSnapshot({ items, period: report.period, budget, nowMs: ctx.now });
  await ref.update({
    status: A.REPORT_STATUS.SUBMITTED, snapshot, submitted_at_ms: ctx.now, submitted_by: actor.uid, submitted_by_name: quem(actor),
    history: comHistorico(report, entrada(ctx, actor, 'submitted')), updated_at_ms: ctx.now,
  });
  const avisados = await avisarEquipe(ctx, actor, fed, ['fiscal'], {
    title: tx('{sigla}: prestação de contas para o seu parecer', { sigla: fed.acronym || fed.name }),
    message: tx('Período {periodo}. Os totais estão congelados: confira os lançamentos e registre o parecer do conselho fiscal.', { periodo: report.period }),
    link: linkCentral(fed, 'prestacao-contas'),
  });
  await f.auditoria(ctx, actor, 'federation_account_report_submit', { federation_id: fed.id, report_id: report.id, balance: snapshot.balance, fiscal_notified: avisados });
  return { ok: true, notified: avisados };
}

async function opinion(ctx, actor, data, { fed, perms }) {
  if (!podeParecer(perms)) falha('permission-denied', 'O parecer é do conselho fiscal.');
  const { ref, report } = await relatorio(ctx, fed, data.reportId);
  if (report.status !== A.REPORT_STATUS.SUBMITTED) falha('failed-precondition', 'O parecer é dado sobre a prestação enviada e ainda sem parecer.');
  const v = exigeValido(A.validateOpinion(data.opinion || {}));
  const porAdmin = !perms.includes('fiscal');
  const parecer = { ...v, by: actor.uid, by_name: quem(actor), at_ms: ctx.now, by_admin: porAdmin };
  await ref.update({ status: A.REPORT_STATUS.OPINION, fiscal_opinion: parecer, history: comHistorico(report, entrada(ctx, actor, 'opinion', { verdict: v.verdict, by_admin: porAdmin })), updated_at_ms: ctx.now });
  const avisados = await avisarEquipe(ctx, actor, fed, ['finance', 'admin'], {
    title: tx('{sigla}: chegou o parecer do conselho fiscal', { sigla: fed.acronym || fed.name }),
    message: tx('Prestação de contas de {periodo}. Leve à assembleia e publique na transparência.', { periodo: report.period }),
    link: linkCentral(fed, 'prestacao-contas'),
  });
  await f.auditoria(ctx, actor, 'federation_account_opinion', { federation_id: fed.id, report_id: report.id, verdict: v.verdict, by_admin: porAdmin, notified: avisados });
  return { ok: true, notified: avisados };
}

async function reportAssembly(ctx, actor, data, { fed, perms }) {
  exigePreparar(perms);
  const { ref, report } = await relatorio(ctx, fed, data.reportId);
  if (report.status !== A.REPORT_STATUS.OPINION) falha('failed-precondition', 'A assembleia vota as contas depois do parecer do conselho fiscal.');
  const v = exigeValido(A.validateAssembly(data.assembly || {}));
  const reuniao = await reuniaoDaAgenda(ctx, fed, v.event_id);
  const assembly = { date: v.date, result: v.result, note: v.note, ...(reuniao || { event_id: '', event_title: '', event_date: '' }), by_name: quem(actor), at_ms: ctx.now };
  await ref.update({ status: v.result, assembly, history: comHistorico(report, entrada(ctx, actor, 'assembly', { result: v.result })), updated_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_account_assembly', { federation_id: fed.id, report_id: report.id, result: v.result });
  return { ok: true };
}

const reais = (c) => `R$ ${(Math.trunc(Number(c) || 0) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const VEREDITO = { approve: 'pela aprovação', approve_with_reservations: 'pela aprovação com ressalvas', reject: 'pela rejeição' };

/** O texto do ato de transparência: os totais congelados, o parecer e a assembleia. */
function resumoDaPrestacao(report) {
  const s = report.snapshot || {};
  const op = report.fiscal_opinion || {};
  const linhas = [
    `Prestação de contas — período ${report.period} (${s.from || ''} a ${s.to || ''}).`,
    '',
    `Receitas: ${reais(s.income_total)}. Despesas: ${reais(s.expense_total)}. Resultado: ${reais(s.balance)}.`,
    `Parecer do conselho fiscal: ${VEREDITO[op.verdict] || '—'}.`,
  ];
  if (report.assembly && report.assembly.result) linhas.push(`Assembleia de ${report.assembly.date}: contas ${report.assembly.result === 'approved' ? 'aprovadas' : 'rejeitadas'}.`);
  return linhas.join('\n');
}

/** Cópia das demonstrações oficiais para a pasta de quem publica no acervo (a régua do acervo só aceita de lá). */
async function paraOAcervo(ctx, actor, statements) {
  if (!statements.length) return [];
  if (!ctx.bucket) falha('unavailable', 'Arquivos indisponíveis no momento. Tente de novo.');
  const out = [];
  for (const s of statements) {
    const dest = `federacao-acervo/${actor.uid}/${crypto.randomBytes(8).toString('hex')}.${extensao(s.content_type)}`;
    await ctx.bucket.file(s.path).copy(ctx.bucket.file(dest));
    out.push({ name: s.name, path: dest, size: s.size, content_type: s.content_type });
  }
  return out;
}

async function reportPublish(ctx, actor, data, { fed, perms }) {
  exigePreparar(perms);
  const { ref, report } = await relatorio(ctx, fed, data.reportId);
  if (![A.REPORT_STATUS.OPINION, A.REPORT_STATUS.APPROVED, A.REPORT_STATUS.REJECTED].includes(report.status)) falha('failed-precondition', 'Só se publica a prestação com o parecer do conselho fiscal registrado.');
  let acervo = null;
  if (fed.modules && fed.modules.official_docs === true) {
    const hoje = hojeBR(ctx);
    const op = report.fiscal_opinion || {};
    const dem = await ac.publicarAto(ctx, actor, fed, {
      type: 'financial_statements', title: `Prestação de contas ${report.period}`, summary: resumoDaPrestacao(report).split('\n')[2],
      body: [resumoDaPrestacao(report), report.notes ? `\n${report.notes}` : ''].join(''), act_date: hoje, visibility: 'public', tags: ['contas', report.period],
      files: await paraOAcervo(ctx, actor, Array.isArray(report.statements) ? report.statements : []),
    });
    const par = await ac.publicarAto(ctx, actor, fed, {
      type: 'fiscal_opinion', title: `Parecer do conselho fiscal — contas de ${report.period}`, summary: `Parecer ${VEREDITO[op.verdict] || ''}.`,
      body: texto(op.text, 8000), act_date: hoje, signed_by: texto(op.by_name, 160), visibility: 'public', tags: ['contas', report.period],
      relations: [{ kind: 'refers', doc_id: dem.docId }],
    });
    acervo = { statements_doc_id: dem.docId, statements_code: dem.code || '', opinion_doc_id: par.docId };
  }
  await ref.update({
    status: A.REPORT_STATUS.PUBLISHED, pub: true, acervo, published_at_ms: ctx.now, published_by: actor.uid, published_by_name: quem(actor),
    history: comHistorico(report, entrada(ctx, actor, 'published')), updated_at_ms: ctx.now,
  });
  await f.auditoria(ctx, actor, 'federation_account_report_publish', { federation_id: fed.id, report_id: report.id, acervo });
  return { ok: true, acervo };
}

/* ---------------------------------------------------------------- anexo -- */

async function file(ctx, actor, data, { fed }) {
  if (data.entryId) {
    const s = await ctx.db.collection(LEDGER).doc(texto(data.entryId, 80)).get();
    const e = s.exists ? s.data() : null;
    if (!e || e.federation_id !== fed.id || !e.document) falha('not-found', 'Anexo não encontrado.');
    return entregar(ctx, e.document.path, e.document.name, e.document.content_type);
  }
  const { report } = await relatorio(ctx, fed, data.reportId);
  const item = (report.statements || []).find((x) => x.path === String(data.path || ''));
  if (!item) falha('not-found', 'Arquivo não encontrado nesta prestação.');
  return entregar(ctx, item.path, item.name, item.content_type);
}

const ACOES = {
  budget_save: budgetSave,
  budget_submit: (ctx, actor, data, c) => budgetStep(ctx, actor, data, c, 'submit'),
  budget_approve: (ctx, actor, data, c) => budgetStep(ctx, actor, data, c, 'approve'),
  budget_publish: (ctx, actor, data, c) => budgetStep(ctx, actor, data, c, 'publish'),
  entry_add: entryAdd,
  entry_void: entryVoid,
  report_open: reportOpen,
  report_save: reportSave,
  report_submit: reportSubmit,
  opinion,
  report_assembly: reportAssembly,
  report_publish: reportPublish,
  file,
};

async function accounts(ctx, actor, data = {}) {
  const fn = ACOES[data.action];
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  const c = await contexto(ctx, actor, data);
  return fn(ctx, actor, data, c);
}

module.exports = { accounts, despesasDerivadas, BUDGETS, LEDGER, REPORTS };
