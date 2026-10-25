/**
 * CONTAS DO CLUBE-ASSOCIAÇÃO (Bloco D1, flag `club_association`) — orçamento,
 * lançamentos e prestação de contas com parecer do conselho fiscal. Só o
 * SERVIDOR grava `club_x/{clube}/budgets|ledger|reports` (a regra é
 * `write: if false` para essas espécies): o lançamento não se apaga (estorna com
 * motivo), o período com prestação enviada fica fechado, o retrato das contas é
 * congelado ao enviar, o parecer é do conselho fiscal e publicar exige parecer.
 *
 * É o desenho da federação (`federationAccounts.js`) sem copiar a conta: a régua
 * pura é a MESMA (`federationAccountsPolicy.js`, com a cópia no cliente em
 * `modules/federations/domain/accounts.js`), e aqui só mudam o endereço dos
 * dados (`club_x/{clube}/…`), quem pode (cargo do clube, `permsDe`) e o que não
 * existe no clube ainda: sem agenda oficial (a aprovação e a assembleia levam
 * data e nota, sem reunião ligada) e sem acervo (publicar liga a cópia pública).
 *
 * Callable `clubAccounts`. Quem vê: `finance`, `fiscal` ou `admin` (a
 * administração do clube tem todas). Quem prepara (orçamento, lançamentos,
 * prestação): `finance` ou `admin`. Quem dá o parecer: `fiscal` (ou `admin`,
 * registrado como dado pela administração).
 *
 * Ações: `budget_save` / `budget_submit` / `budget_approve` / `budget_publish`,
 * `entry_add` / `entry_import` / `entry_void`, `report_open` / `report_save` /
 * `report_submit` / `opinion` / `report_assembly` / `report_publish` e `file`.
 * Receita DERIVADA: as cobranças pagas da associação (`club_x/{clube}/charges`).
 */
const crypto = require('node:crypto');
const A = require('./federationAccountsPolicy.js');
const ac = require('./federationAcervo.js');
const a = require('./clubAssociation.js');
const S = require('./clubStaffPolicy.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto, col } = a;
const BUDGETS = 'budgets';
const LEDGER = 'ledger';
const REPORTS = 'reports';
const HISTORY_MAX = 30;

const podePreparar = (perms) => perms.includes('finance') || perms.includes('admin');
const podeParecer = (perms) => perms.includes('fiscal') || perms.includes('admin');
const podeVer = (perms) => podePreparar(perms) || perms.includes('fiscal');

async function contexto(ctx, actor, data) {
  await a.exigeFlag(ctx);
  const club = await a.clube(ctx, data.clubId);
  if (!(club.association && club.association.enabled === true)) falha('failed-precondition', 'Este clube ainda não abriu a associação.');
  const perms = await a.permsDe(ctx, club.id, actor.uid);
  if (!podeVer(perms)) falha('permission-denied', 'Você não tem permissão para as contas deste clube.');
  return { club, perms };
}

const exigePreparar = (perms) => { if (!podePreparar(perms)) falha('permission-denied', 'Só o financeiro (ou quem administra o clube) mexe nas contas.'); };
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

/** Tudo o que entra na conta do clube: lançamentos à mão + cobranças pagas da associação. */
async function itensDaConta(ctx, club) {
  const [led, chg] = await Promise.all([col(ctx, club.id, LEDGER).get(), col(ctx, club.id, 'charges').get()]);
  return A.accountItems({
    ledger: led.docs.map((d) => ({ id: d.id, ...d.data() })),
    charges: chg.docs.map((d) => ({ id: d.id, ...d.data() })),
  });
}

async function relatorios(ctx, club) {
  const snap = await col(ctx, club.id, REPORTS).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** O período com prestação já ENVIADA está fechado: o retrato que o conselho examina não muda por baixo. */
async function exigePeriodoAberto(ctx, club, date) {
  const fechado = A.closedPeriodFor(date, await relatorios(ctx, club));
  if (fechado) falha('failed-precondition', `A prestação de contas de ${fechado} já foi enviada: este período está fechado. Lance o ajuste numa data do período aberto, explicando na descrição.`);
}

const linkCentral = (club) => `/clubes/${encodeURIComponent(club.id)}/gerir?aba=prestacao`;

/** Avisa quem tem a permissão (sem repetir, sem quem agiu). */
async function avisarEquipe(ctx, actor, club, perms, msg) {
  const listas = await Promise.all(perms.map((p) => a.quemTem(ctx, club.id, p)));
  const uids = [...new Set(listas.flat())].filter((u) => u && u !== actor.uid);
  if (!uids.length) return 0;
  const batch = ctx.db.batch();
  uids.forEach((u) => a.aviso(ctx, batch, u, msg));
  await batch.commit();
  return uids.length;
}

/* ------------------------------------------------------------ arquivos -- */

const extensao = (ct) => (String(ct).split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';

/** Anexo NOVO só da pasta de quem salva; copiado para a pasta oficial (fechada à regra), com SHA-256. */
async function oficializarAnexo(ctx, actor, item, dest) {
  if (!item.path.startsWith(`clube-contas/${actor.uid}/`)) falha('permission-denied', `O arquivo "${item.name}" não foi enviado por você. Envie de novo.`);
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

async function orcamento(ctx, club, year) {
  const ref = col(ctx, club.id, BUDGETS).doc(String(Number(year) || 0));
  const snap = await ref.get();
  return { ref, budget: snap.exists ? { id: snap.id, ...snap.data() } : null };
}

async function budgetSave(ctx, actor, data, { club, perms }) {
  exigePreparar(perms);
  const v = exigeValido(A.validateBudget(data.budget || {}));
  const { ref, budget } = await orcamento(ctx, club, v.year);
  const ts = ctx.Timestamp.fromMillis(ctx.now);
  if (!budget) {
    await ref.set({
      club_id: club.id, year: v.year, lines: v.lines, notes: v.notes, status: A.BUDGET_STATUS.DRAFT, history: [entrada(ctx, actor, 'created')],
      created_by: actor.uid, created_by_name: quem(actor), created_at: ts, created_at_ms: ctx.now, updated_by: actor.uid, updated_at_ms: ctx.now,
    });
    await a.auditoria(ctx, actor, 'club_budget_save', { club_id: club.id, year: v.year, created: true });
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
  await a.auditoria(ctx, actor, 'club_budget_save', { club_id: club.id, year: v.year, reformulated: aprovado });
  return { ok: true, budgetId: ref.id };
}

async function budgetStep(ctx, actor, data, { club, perms }, acao) {
  exigePreparar(perms);
  const { ref, budget } = await orcamento(ctx, club, data.year);
  if (!budget) falha('not-found', 'Orçamento não encontrado.');
  const precisa = { submit: A.BUDGET_STATUS.DRAFT, approve: A.BUDGET_STATUS.SUBMITTED, publish: A.BUDGET_STATUS.APPROVED }[acao];
  if (budget.status !== precisa) falha('failed-precondition', { submit: 'Só o rascunho é enviado para aprovação.', approve: 'Envie o orçamento para aprovação antes de registrar a aprovação.', publish: 'Só o orçamento aprovado é publicado.' }[acao]);
  const patch = { updated_by: actor.uid, updated_at_ms: ctx.now };
  if (acao === 'submit') {
    patch.status = A.BUDGET_STATUS.SUBMITTED;
    patch.history = comHistorico(budget, entrada(ctx, actor, 'submitted'));
  } else if (acao === 'approve') {
    // Sem agenda oficial no clube (ainda): a aprovação leva a data e a nota da assembleia ou reunião.
    const v = exigeValido(A.validateAssembly({ ...(data.approval || {}), result: 'approved', event_id: '' }));
    patch.status = A.BUDGET_STATUS.APPROVED;
    patch.approved_in = { date: v.date, note: v.note, event_id: '', event_title: '', event_date: '' };
    patch.history = comHistorico(budget, entrada(ctx, actor, 'approved', { date: v.date }));
  } else {
    patch.status = A.BUDGET_STATUS.PUBLISHED;
    patch.published = { lines: budget.lines || {}, notes: budget.notes || '', approved_in: budget.approved_in || null, at_ms: ctx.now };
    // O público lê só a CÓPIA (`{ano}_pub`): o documento de trabalho nunca leva `pub`, então
    // reformular depois não expõe o rascunho a quem lê a página.
    await col(ctx, club.id, BUDGETS).doc(`${ref.id}_pub`).set({ club_id: club.id, year: budget.year, pub: true, copy_of: ref.id, published: patch.published, updated_at_ms: ctx.now });
    patch.history = comHistorico(budget, entrada(ctx, actor, 'published'));
  }
  await ref.update(patch);
  await a.auditoria(ctx, actor, `club_budget_${acao}`, { club_id: club.id, year: budget.year });
  return { ok: true };
}

/* ---------------------------------------------------------- lançamentos -- */

async function entryAdd(ctx, actor, data, { club, perms }) {
  exigePreparar(perms);
  const v = exigeValido(A.validateEntry(data.entry || {}, { hoje: hojeBR(ctx) }));
  if (v.document && !A.UPLOAD_RE.test(v.document.path)) falha('invalid-argument', 'Anexo inválido. Envie de novo.');
  await exigePeriodoAberto(ctx, club, v.date);
  const ref = col(ctx, club.id, LEDGER).doc();
  const document = v.document ? await oficializarAnexo(ctx, actor, v.document, `clube-contas-oficial/${club.id}/ledger/${ref.id}/1.${extensao(v.document.content_type)}`) : null;
  await ref.set({
    club_id: club.id, ...v, document, status: 'posted',
    created_by: actor.uid, created_by_name: quem(actor), created_at: ctx.Timestamp.fromMillis(ctx.now), created_at_ms: ctx.now,
  });
  await a.auditoria(ctx, actor, 'club_ledger_add', { club_id: club.id, entry_id: ref.id, kind: v.kind, category: v.category, amount_cents: v.amount_cents, date: v.date });
  return { ok: true, entryId: ref.id };
}

async function entryVoid(ctx, actor, data, { club, perms }) {
  exigePreparar(perms);
  const ref = col(ctx, club.id, LEDGER).doc(texto(data.entryId, 80));
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Lançamento não encontrado.');
  const e = snap.data();
  if (e.status === 'void') falha('failed-precondition', 'Este lançamento já foi estornado.');
  const reason = exigeMotivo(data, 'do estorno');
  await exigePeriodoAberto(ctx, club, e.date);
  await ref.update({ status: 'void', void_reason: reason, voided_by: actor.uid, voided_by_name: quem(actor), voided_at_ms: ctx.now });
  await a.auditoria(ctx, actor, 'club_ledger_void', { club_id: club.id, entry_id: snap.id, amount_cents: e.amount_cents, reason });
  return { ok: true };
}

/**
 * Importa os movimentos do extrato bancário (OFX ou planilha, lidos na tela)
 * como lançamentos: a mesma validação do lançamento à mão e o período aberto; a
 * identidade do movimento (`bank_ref`) vira o id do documento, então importar o
 * mesmo extrato de novo só traz o que faltava. Tudo numa transação.
 */
async function entryImport(ctx, actor, data, { club, perms }) {
  exigePreparar(perms);
  const rows = Array.isArray(data.entries) ? data.entries : [];
  if (!rows.length) falha('invalid-argument', 'Escolha ao menos um movimento do extrato.');
  if (rows.length > A.BANK_IMPORT_MAX) falha('invalid-argument', `No máximo ${A.BANK_IMPORT_MAX} movimentos por vez. Importe o extrato em partes.`);
  const hoje = hojeBR(ctx);
  const reps = await relatorios(ctx, club);
  const porId = new Map();
  rows.forEach((r, i) => {
    const ref = A.bankRef(r && r.bank_ref);
    const chk = A.validateEntry({ ...(r || {}), document: null }, { hoje });
    if (!ref || !chk.ok) falha('invalid-argument', `O movimento ${i + 1} do extrato está incompleto (${Object.values(chk.errors)[0] || 'sem identificação'}). Leia o arquivo de novo.`);
    const v = chk.value;
    const fechado = A.closedPeriodFor(v.date, reps);
    if (fechado) falha('failed-precondition', `O movimento de ${v.date} cai no período ${fechado}, cuja prestação de contas já foi enviada. Desmarque-o.`);
    const id = `bk_${crypto.createHash('sha256').update(ref).digest('hex').slice(0, 24)}`;
    if (!porId.has(id)) porId.set(id, { ...v, document: null, bank_ref: ref });
  });
  const refs = [...porId.keys()].map((id) => col(ctx, club.id, LEDGER).doc(id));
  const batchId = col(ctx, club.id, LEDGER).doc().id;
  const novos = await ctx.db.runTransaction(async (tr) => {
    const snaps = await tr.getAll(...refs);
    const faltam = refs.filter((_, i) => !snaps[i].exists);
    faltam.forEach((ref) => tr.set(ref, {
      club_id: club.id, ...porId.get(ref.id), status: 'posted', source: 'bank', import_batch: batchId,
      created_by: actor.uid, created_by_name: quem(actor), created_at: ctx.Timestamp.fromMillis(ctx.now), created_at_ms: ctx.now,
    }));
    return faltam.length;
  });
  const repetidos = rows.length - novos;
  await a.auditoria(ctx, actor, 'club_ledger_import', { club_id: club.id, batch: batchId, imported: novos, skipped: repetidos });
  return { ok: true, imported: novos, skipped: repetidos };
}

/* ---------------------------------------------------- prestação de contas -- */

async function relatorio(ctx, club, reportId) {
  const ref = col(ctx, club.id, REPORTS).doc(texto(reportId, 120));
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Prestação de contas não encontrada.');
  return { ref, report: { id: snap.id, ...snap.data() } };
}

async function reportOpen(ctx, actor, data, { club, perms }) {
  exigePreparar(perms);
  const period = texto(data.period, 7);
  if (!A.isValidPeriod(period)) falha('invalid-argument', 'Período inválido: o ano (2026) ou o trimestre (2026-Q1).');
  if (A.periodRange(period).from > hojeBR(ctx)) falha('invalid-argument', 'Este período ainda não começou.');
  const ref = col(ctx, club.id, REPORTS).doc(period);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      club_id: club.id, period, status: A.REPORT_STATUS.DRAFT, statements: [], notes: '', snapshot: null, history: [entrada(ctx, actor, 'opened')],
      opened_by: actor.uid, opened_by_name: quem(actor), opened_at_ms: ctx.now, updated_at_ms: ctx.now,
    });
    await a.auditoria(ctx, actor, 'club_account_report_open', { club_id: club.id, period });
    return { ok: true, reportId: ref.id };
  }
  const report = snap.data();
  if (report.status === A.REPORT_STATUS.DRAFT) return { ok: true, reportId: ref.id };
  if (report.status !== A.REPORT_STATUS.SUBMITTED) falha('failed-precondition', 'Depois do parecer a prestação não volta a rascunho.');
  const reason = exigeMotivo(data, 'para reabrir');
  await ref.update({ status: A.REPORT_STATUS.DRAFT, snapshot: null, history: comHistorico(report, entrada(ctx, actor, 'reopened', { reason })), updated_at_ms: ctx.now });
  await a.auditoria(ctx, actor, 'club_account_report_reopen', { club_id: club.id, period, reason });
  return { ok: true, reportId: ref.id };
}

async function reportSave(ctx, actor, data, { club, perms }) {
  exigePreparar(perms);
  const { ref, report } = await relatorio(ctx, club, data.reportId);
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
      out.push(await oficializarAnexo(ctx, actor, item, `clube-contas-oficial/${club.id}/reports/${report.id}/${ctx.now}-${i + 1}.${extensao(item.content_type)}`));
    }
  }
  const tirados = atuais.filter((x) => !out.some((y) => y.path === x.path));
  if (ctx.bucket) await Promise.all(tirados.map((x) => ctx.bucket.file(x.path).delete().catch(() => {})));
  await ref.update({ statements: out, notes: texto(data.notes, A.NOTES_MAX), updated_at_ms: ctx.now, updated_by: actor.uid });
  await a.auditoria(ctx, actor, 'club_account_report_save', { club_id: club.id, report_id: report.id, statements: out.length });
  return { ok: true };
}

async function reportSubmit(ctx, actor, data, { club, perms }) {
  exigePreparar(perms);
  const { ref, report } = await relatorio(ctx, club, data.reportId);
  if (report.status !== A.REPORT_STATUS.DRAFT) falha('failed-precondition', 'Esta prestação já foi enviada.');
  const range = A.periodRange(report.period);
  if (range.to >= hojeBR(ctx)) falha('failed-precondition', 'O período ainda não terminou: envie depois do último dia.');
  const items = await itensDaConta(ctx, club);
  const { budget } = A.isAnnualPeriod(report.period) ? await orcamento(ctx, club, report.period) : { budget: null };
  const snapshot = A.buildSnapshot({ items, period: report.period, budget, nowMs: ctx.now });
  await ref.update({
    status: A.REPORT_STATUS.SUBMITTED, snapshot, submitted_at_ms: ctx.now, submitted_by: actor.uid, submitted_by_name: quem(actor),
    history: comHistorico(report, entrada(ctx, actor, 'submitted')), updated_at_ms: ctx.now,
  });
  const avisados = await avisarEquipe(ctx, actor, club, ['fiscal'], {
    title: tx('{clube}: prestação de contas para o seu parecer', { clube: club.name }),
    message: tx('Período {periodo}. Os totais estão congelados: confira os lançamentos e registre o parecer do conselho fiscal.', { periodo: report.period }),
    link: linkCentral(club),
  });
  await a.auditoria(ctx, actor, 'club_account_report_submit', { club_id: club.id, report_id: report.id, balance: snapshot.balance, fiscal_notified: avisados });
  return { ok: true, notified: avisados };
}

async function opinion(ctx, actor, data, { club, perms }) {
  if (!podeParecer(perms)) falha('permission-denied', 'O parecer é do conselho fiscal.');
  const { ref, report } = await relatorio(ctx, club, data.reportId);
  if (report.status !== A.REPORT_STATUS.SUBMITTED) falha('failed-precondition', 'O parecer é dado sobre a prestação enviada e ainda sem parecer.');
  const v = exigeValido(A.validateOpinion(data.opinion || {}));
  // A administração do clube tem toda permissão, mas só é "conselho fiscal" quem tem o cargo (mandato valendo).
  const st = await col(ctx, club.id, 'staff').doc(actor.uid).get();
  const porAdmin = !(st.exists && S.permsOf(st.data(), ctx.now).includes('fiscal'));
  const parecer = { ...v, by: actor.uid, by_name: quem(actor), at_ms: ctx.now, by_admin: porAdmin };
  await ref.update({ status: A.REPORT_STATUS.OPINION, fiscal_opinion: parecer, history: comHistorico(report, entrada(ctx, actor, 'opinion', { verdict: v.verdict, by_admin: porAdmin })), updated_at_ms: ctx.now });
  const avisados = await avisarEquipe(ctx, actor, club, ['finance', 'admin'], {
    title: tx('{clube}: chegou o parecer do conselho fiscal', { clube: club.name }),
    message: tx('Prestação de contas de {periodo}. Leve à assembleia e publique na transparência.', { periodo: report.period }),
    link: linkCentral(club),
  });
  await a.auditoria(ctx, actor, 'club_account_opinion', { club_id: club.id, report_id: report.id, verdict: v.verdict, by_admin: porAdmin, notified: avisados });
  return { ok: true, notified: avisados };
}

async function reportAssembly(ctx, actor, data, { club, perms }) {
  exigePreparar(perms);
  const { ref, report } = await relatorio(ctx, club, data.reportId);
  if (report.status !== A.REPORT_STATUS.OPINION) falha('failed-precondition', 'A assembleia vota as contas depois do parecer do conselho fiscal.');
  const v = exigeValido(A.validateAssembly({ ...(data.assembly || {}), event_id: '' }));
  const assembly = { date: v.date, result: v.result, note: v.note, event_id: '', event_title: '', event_date: '', by_name: quem(actor), at_ms: ctx.now };
  await ref.update({ status: v.result, assembly, history: comHistorico(report, entrada(ctx, actor, 'assembly', { result: v.result })), updated_at_ms: ctx.now });
  await a.auditoria(ctx, actor, 'club_account_assembly', { club_id: club.id, report_id: report.id, result: v.result });
  return { ok: true };
}

async function reportPublish(ctx, actor, data, { club, perms }) {
  exigePreparar(perms);
  const { ref, report } = await relatorio(ctx, club, data.reportId);
  if (![A.REPORT_STATUS.OPINION, A.REPORT_STATUS.APPROVED, A.REPORT_STATUS.REJECTED].includes(report.status)) falha('failed-precondition', 'Só se publica a prestação com o parecer do conselho fiscal registrado.');
  await ref.update({
    status: A.REPORT_STATUS.PUBLISHED, pub: true, published_at_ms: ctx.now, published_by: actor.uid, published_by_name: quem(actor),
    history: comHistorico(report, entrada(ctx, actor, 'published')), updated_at_ms: ctx.now,
  });
  await a.auditoria(ctx, actor, 'club_account_report_publish', { club_id: club.id, report_id: report.id });
  return { ok: true };
}

/* ---------------------------------------------------------------- anexo -- */

async function file(ctx, actor, data, { club }) {
  if (data.entryId) {
    const s = await col(ctx, club.id, LEDGER).doc(texto(data.entryId, 80)).get();
    const e = s.exists ? s.data() : null;
    if (!e || !e.document) falha('not-found', 'Anexo não encontrado.');
    return entregar(ctx, e.document.path, e.document.name, e.document.content_type);
  }
  const { report } = await relatorio(ctx, club, data.reportId);
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
  entry_import: entryImport,
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

module.exports = { accounts, BUDGETS, LEDGER, REPORTS };
