/**
 * REGULARIDADE DA PRÓPRIA FEDERAÇÃO no servidor (rodada 3, Bloco 2, `docs/50`
 * §37). Só o servidor grava as duas coleções (a regra é `write: if false`);
 * financeiro e admin gerem, o conselho fiscal lê:
 *
 *  - `federation_certificates` (módulo `certificates`): a certidão com tipo,
 *    número, emissão, validade e o ARQUIVO, que é copiado da pasta de quem
 *    enviou (`federacao-contas/{uid}/`) para `federacao-certidoes/{fed}/…`
 *    (fechada à regra do Storage) e entregue pela ação `cert_file`. A
 *    varredura avisa 30, 7 e 1 dia antes de vencer e quando vence, uma vez
 *    cada, só a certidão ATUAL de cada tipo.
 *  - `federation_incentive_projects` (módulo `incentive_projects`): o projeto
 *    da Lei de Incentivo ao Esporte, os aportes recebidos e a prestação de
 *    contas. O aporte RECEBIDO entra nas contas como receita derivada
 *    (`receitas`, lida por `federationAccounts`); período com prestação de
 *    contas enviada não aceita aporte novo nem estorno.
 *
 * A conta pura é `federationInstitutionalPolicy.js` (cópia de
 * `src/modules/federations/domain/institutional.js`, com paridade).
 */
const crypto = require('node:crypto');
const P = require('./federationInstitutionalPolicy.js');
const A = require('./federationAccountsPolicy.js');
const m = require('./federationMembership.js');
const f = require('./federations.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const CERTS = 'federation_certificates';
const PROJECTS = 'federation_incentive_projects';
const FILE_MAX = 9 * 1024 * 1024;
const TIPOS_ARQUIVO = /^(application\/pdf|image\/(jpeg|png|webp))$/;
const linkGestao = (fedId, aba) => `/federacoes/${fedId}/gerir?aba=${aba}`;
const br = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? iso.split('-').reverse().join('/') : '');
const reais = (c) => `R$ ${(Math.trunc(Number(c) || 0) / 100).toFixed(2).replace('.', ',')}`;
const novoId = () => crypto.randomBytes(6).toString('hex').slice(0, 10);
const historico = (doc, actor, ctx, action, extra = {}) => [...(doc.history || []), { action, by: actor.uid, by_name: texto(actor.name, 80), at_ms: ctx.now, ...extra }].slice(-50);
const nomeCert = (c) => (c.kind === 'other' ? c.label : P.CERT_KIND_LABELS[c.kind] || c.kind);

function exigeValido(r) {
  if (!r.ok) falha('invalid-argument', `Confira os campos: ${Object.keys(r.errors).join(', ')}.`);
  return r.value;
}

function exigeMotivo(data) {
  const motivo = texto(data.reason, 300);
  if (motivo.length < 3) falha('invalid-argument', 'Diga o motivo.');
  return motivo;
}

async function contexto(ctx, actor, data, modulo) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  if (!(fed.modules && fed.modules[modulo] === true)) falha('failed-precondition', modulo === 'certificates' ? 'Esta federação não tem o cofre de certidões ligado.' : 'Esta federação não tem o módulo da Lei de Incentivo ligado.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  return { fed, perms, hoje: m.isoDateBR(ctx.now), admin: perms.includes('admin'), gere: P.canManageInstitutional(perms), le: P.canViewInstitutional(perms) };
}

const exigeGestao = (c) => { if (!c.gere) falha('permission-denied', 'Só o financeiro e a administração cuidam disto.'); };

async function doc(ctx, c, colecao, id, nome) {
  const ref = ctx.db.collection(colecao).doc(texto(id, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', `${nome} não encontrado.`);
  return { ref, d: { id: snap.id, ...snap.data() } };
}

/* ============================================================ certidões == */

/** Copia o arquivo enviado (só da pasta de quem salva) para a pasta fechada da federação. */
async function guardarArquivo(ctx, actor, fedId, certId, file) {
  const path = String((file && file.path) || '');
  if (!path.startsWith(`federacao-contas/${actor.uid}/`) || path.includes('..')) falha('invalid-argument', 'Envie o arquivo da certidão de novo.');
  if (!ctx.bucket) falha('unavailable', 'Arquivos indisponíveis no momento. Tente de novo.');
  const origem = ctx.bucket.file(path);
  const [meta] = await origem.getMetadata().catch(() => [null]);
  if (!meta) falha('failed-precondition', 'O arquivo não chegou ao servidor. Envie de novo.');
  const contentType = String(meta.contentType || '');
  const size = Number(meta.size) || 0;
  if (!TIPOS_ARQUIVO.test(contentType)) falha('failed-precondition', 'Envie a certidão em PDF ou imagem (JPG, PNG ou WebP).');
  if (!(size > 0) || size > FILE_MAX) falha('failed-precondition', 'A certidão passa de 9 MB.');
  const ext = contentType === 'application/pdf' ? 'pdf' : contentType.split('/')[1].replace('jpeg', 'jpg');
  const dest = `federacao-certidoes/${fedId}/${certId}/${ctx.now}.${ext}`;
  await origem.copy(ctx.bucket.file(dest));
  await origem.delete().catch(() => {});
  return { path: dest, name: texto(file.name, 120) || `certidao.${ext}`, size, content_type: contentType };
}

const apagarArquivo = (ctx, path) => (ctx.bucket && path ? ctx.bucket.file(path).delete().catch(() => {}) : Promise.resolve());

async function certSave(ctx, actor, data, c) {
  exigeGestao(c);
  const v = exigeValido(P.validateCertificate(data.cert || {}));
  if (v.issued_at > c.hoje) falha('invalid-argument', 'A emissão não pode ser no futuro.');
  if (!data.certId) {
    if (!data.file) falha('invalid-argument', 'Anexe o arquivo da certidão.');
    const ref = ctx.db.collection(CERTS).doc();
    const file = await guardarArquivo(ctx, actor, c.fed.id, ref.id, data.file);
    await ref.set({ ...v, file, federation_id: c.fed.id, warned_steps: [], created_by: actor.uid, created_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico({}, actor, ctx, 'create') });
    await f.auditoria(ctx, actor, 'federation_certificate_create', { federation_id: c.fed.id, certificate_id: ref.id, kind: v.kind, valid_until: v.valid_until });
    return { ok: true, certId: ref.id };
  }
  const { ref, d } = await doc(ctx, c, CERTS, data.certId, 'Certidão');
  const patch = { ...v, updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'update') };
  // Validade nova: os avisos recomeçam (a certidão renovada no mesmo registro volta a ser vigiada).
  if (v.valid_until !== d.valid_until) patch.warned_steps = [];
  if (data.file) {
    patch.file = await guardarArquivo(ctx, actor, c.fed.id, d.id, data.file);
    await apagarArquivo(ctx, d.file && d.file.path);
  }
  await ref.update(patch);
  await f.auditoria(ctx, actor, 'federation_certificate_update', { federation_id: c.fed.id, certificate_id: d.id, kind: v.kind, valid_until: v.valid_until, file: Boolean(data.file) });
  return { ok: true, certId: d.id };
}

async function certFile(ctx, actor, data, c) {
  if (!c.le) falha('permission-denied', 'Só o financeiro, a administração e o conselho fiscal veem as certidões.');
  const { d } = await doc(ctx, c, CERTS, data.certId, 'Certidão');
  if (!d.file || !d.file.path) falha('not-found', 'Esta certidão não tem arquivo.');
  if (!ctx.bucket) falha('unavailable', 'Arquivos indisponíveis no momento. Tente de novo.');
  const alvo = ctx.bucket.file(d.file.path);
  const [meta] = await alvo.getMetadata().catch(() => [null]);
  if (!meta) falha('not-found', 'O arquivo não está mais no servidor.');
  if (Number(meta.size) > FILE_MAX) falha('failed-precondition', 'Arquivo grande demais para abrir por aqui.');
  const [bytes] = await alvo.download();
  return { ok: true, name: d.file.name, contentType: meta.contentType || d.file.content_type || 'application/octet-stream', base64: Buffer.from(bytes).toString('base64') };
}

async function certDelete(ctx, actor, data, c) {
  if (!c.admin) falha('permission-denied', 'Só a administração apaga uma certidão.');
  const { ref, d } = await doc(ctx, c, CERTS, data.certId, 'Certidão');
  const motivo = exigeMotivo(data);
  await ref.delete();
  await apagarArquivo(ctx, d.file && d.file.path);
  await f.auditoria(ctx, actor, 'federation_certificate_delete', { federation_id: c.fed.id, certificate_id: d.id, kind: d.kind, reason: motivo });
  return { ok: true };
}

/* ============================================== Lei de Incentivo ao Esporte == */

async function relatorios(ctx, fedId) {
  const snap = await ctx.db.collection('federation_account_reports').where('federation_id', '==', fedId).get();
  return snap.docs.map((x) => ({ id: x.id, ...x.data() }));
}

/** O aporte mexe na conta: período com prestação ENVIADA não muda por baixo. */
async function exigePeriodoAberto(ctx, fed, date) {
  if (!(fed.modules && fed.modules.accounts === true)) return;
  const fechado = A.closedPeriodFor(date, await relatorios(ctx, fed.id));
  if (fechado) falha('failed-precondition', `A prestação de contas de ${fechado} já foi enviada: este período está fechado.`);
}

async function projectSave(ctx, actor, data, c) {
  exigeGestao(c);
  const v = exigeValido(P.validateIncentiveProject(data.project || {}));
  if (!data.projectId) {
    const ref = await ctx.db.collection(PROJECTS).add({
      ...v, federation_id: c.fed.id, status: P.INCENTIVE_STATUS.CAPTURING, receipts: [], accountability: null, warned_capture_for: '',
      created_by: actor.uid, created_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico({}, actor, ctx, 'create'),
    });
    await f.auditoria(ctx, actor, 'federation_incentive_create', { federation_id: c.fed.id, project_id: ref.id, approved_cents: v.approved_cents });
    return { ok: true, projectId: ref.id };
  }
  const { ref, d } = await doc(ctx, c, PROJECTS, data.projectId, 'Projeto');
  if (d.status === P.INCENTIVE_STATUS.CANCELLED) falha('failed-precondition', 'Projeto cancelado não se edita.');
  await ref.update({ ...v, updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'update') });
  await f.auditoria(ctx, actor, 'federation_incentive_update', { federation_id: c.fed.id, project_id: d.id });
  return { ok: true, projectId: d.id };
}

async function projectReceive(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, d } = await doc(ctx, c, PROJECTS, data.projectId, 'Projeto');
  if (![P.INCENTIVE_STATUS.CAPTURING, P.INCENTIVE_STATUS.EXECUTING].includes(d.status)) falha('failed-precondition', 'Só se registra aporte em projeto em captação ou em execução.');
  const v = exigeValido(P.validateIncentiveReceipt(data.receipt || {}, c.hoje));
  if ((d.receipts || []).length >= P.RECEIPTS_MAX) falha('failed-precondition', `No máximo ${P.RECEIPTS_MAX} aportes por projeto.`);
  await exigePeriodoAberto(ctx, c.fed, v.date);
  const r = { id: novoId(), ...v, by: actor.uid, at_ms: ctx.now, voided_at: '' };
  await ref.update({ receipts: [...(d.receipts || []), r], updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'receive', { receipt: r.id, amount_cents: v.amount_cents }) });
  await f.auditoria(ctx, actor, 'federation_incentive_receive', { federation_id: c.fed.id, project_id: d.id, receipt_id: r.id, amount_cents: v.amount_cents });
  return { ok: true, receiptId: r.id };
}

async function projectVoid(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, d } = await doc(ctx, c, PROJECTS, data.projectId, 'Projeto');
  const id = texto(data.receiptId, 12);
  const r = (d.receipts || []).find((x) => x.id === id);
  if (!r || r.voided_at) falha('failed-precondition', 'Este aporte não está registrado.');
  const motivo = exigeMotivo(data);
  await exigePeriodoAberto(ctx, c.fed, r.date);
  const receipts = d.receipts.map((x) => (x.id === id ? { ...x, voided_at: c.hoje, voided_by: actor.uid, voided_reason: motivo } : x));
  await ref.update({ receipts, updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'void', { receipt: id, reason: motivo }) });
  await f.auditoria(ctx, actor, 'federation_incentive_void', { federation_id: c.fed.id, project_id: d.id, receipt_id: id, reason: motivo });
  return { ok: true };
}

async function projectStatus(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, d } = await doc(ctx, c, PROJECTS, data.projectId, 'Projeto');
  const to = String(data.to || '');
  const tr = P.incentiveTransition(d, to);
  if (!tr.ok) falha('failed-precondition', tr.error);
  const patch = { status: to, updated_at_ms: ctx.now };
  const extra = {};
  if (tr.back || to === P.INCENTIVE_STATUS.CANCELLED) extra.reason = exigeMotivo(data);
  if (to === P.INCENTIVE_STATUS.REPORTING && !tr.back) {
    const sent = /^\d{4}-\d{2}-\d{2}$/.test(String(data.sentAt || '')) ? data.sentAt : '';
    if (!sent || sent > c.hoje) falha('invalid-argument', 'Informe a data em que a prestação de contas foi enviada.');
    patch.accountability = { sent_at: sent, protocol: texto(data.protocol, 60), result: '', result_at: '', result_note: '' };
  }
  if (to === P.INCENTIVE_STATUS.CLOSED) {
    const result = P.ACCOUNTABILITY_RESULTS.includes(data.result) ? data.result : '';
    const em = /^\d{4}-\d{2}-\d{2}$/.test(String(data.resultAt || '')) ? data.resultAt : '';
    if (!result || !em || em > c.hoje) falha('invalid-argument', 'Informe o resultado da prestação de contas e a data.');
    patch.accountability = { ...(d.accountability || {}), result, result_at: em, result_note: texto(data.note, 500) };
  }
  if (tr.back && d.status === P.INCENTIVE_STATUS.CLOSED) patch.accountability = { ...(d.accountability || {}), result: '', result_at: '', result_note: '' };
  if (tr.back && d.status === P.INCENTIVE_STATUS.REPORTING) patch.accountability = null;
  await ref.update({ ...patch, history: historico(d, actor, ctx, 'status', { from: d.status, to, ...extra }) });
  await f.auditoria(ctx, actor, 'federation_incentive_status', { federation_id: c.fed.id, project_id: d.id, from: d.status, to, ...extra });
  return { ok: true };
}

async function projectDelete(ctx, actor, data, c) {
  if (!c.admin) falha('permission-denied', 'Só a administração apaga um projeto.');
  const { ref, d } = await doc(ctx, c, PROJECTS, data.projectId, 'Projeto');
  if ((d.receipts || []).length) falha('failed-precondition', 'Projeto com aporte registrado não se apaga: cancele ou encerre.');
  await ref.delete();
  await f.auditoria(ctx, actor, 'federation_incentive_delete', { federation_id: c.fed.id, project_id: d.id });
  return { ok: true };
}

/* ============================================================== callable == */

const ACOES = {
  cert_save: ['certificates', certSave],
  cert_file: ['certificates', certFile],
  cert_delete: ['certificates', certDelete],
  project_save: ['incentive_projects', projectSave],
  project_receive: ['incentive_projects', projectReceive],
  project_void: ['incentive_projects', projectVoid],
  project_status: ['incentive_projects', projectStatus],
  project_delete: ['incentive_projects', projectDelete],
};

async function institutional(ctx, actor, data = {}) {
  const acao = ACOES[data.action];
  if (!acao) falha('invalid-argument', 'Ação desconhecida.');
  return acao[1](ctx, actor, data, await contexto(ctx, actor, data, acao[0]));
}

/* ============================================================= varredura == */

async function avisar(ctx, uids, msg) {
  const lista = [...new Set(uids.filter(Boolean))];
  if (!lista.length) return 0;
  const batch = ctx.db.batch();
  lista.forEach((uid) => f.aviso(ctx, batch, uid, msg));
  await batch.commit();
  return lista.length;
}

async function federacaoLigada(ctx, cache, fedId, modulo) {
  if (!cache.has(fedId)) {
    const s = await ctx.db.collection(f.C.federations).doc(fedId).get();
    cache.set(fedId, s.exists ? s.data() : null);
  }
  const fed = cache.get(fedId);
  return Boolean(fed && fed.status === 'approved' && fed.modules && fed.modules[modulo] === true);
}

const gestores = async (ctx, fedId) => [...await f.staffIds(ctx, fedId, 'admin'), ...await f.staffIds(ctx, fedId, 'finance')];

async function sweep(ctx) {
  if (!(await f.flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = m.isoDateBR(ctx.now);
  const feds = new Map();
  let avisos = 0;
  /* eslint-disable no-await-in-loop */
  const certs = await ctx.db.collection(CERTS).get();
  const porFed = new Map();
  certs.docs.forEach((s) => {
    const c = { id: s.id, ref: s.ref, ...s.data() };
    if (!porFed.has(c.federation_id)) porFed.set(c.federation_id, []);
    porFed.get(c.federation_id).push(c);
  });
  for (const [fedId, lista] of porFed) {
    if (!(await federacaoLigada(ctx, feds, fedId, 'certificates'))) continue;
    for (const c of P.currentCertificates(lista)) {
      const passo = P.certificateWarnStep(c, hoje);
      if (passo === null) continue;
      const nome = nomeCert(c);
      const msg = passo === 0
        ? { title: tx('Certidão vencida: {nome}', { nome }), message: tx('Venceu em {data}. Certidão vencida pode travar repasses públicos: emita a nova e anexe no cofre.', { data: br(c.valid_until) }) }
        : { title: tx('Certidão vence em {data}: {nome}', { data: br(c.valid_until), nome }), message: tx('Faltam {n} dia(s). Emita a nova certidão e anexe no cofre antes de vencer.', { n: P.certificateState(c, hoje).daysLeft }) };
      avisos += await avisar(ctx, await gestores(ctx, fedId), { ...msg, link: linkGestao(fedId, 'certidoes') });
      await c.ref.update({ warned_steps: [...new Set([...(c.warned_steps || []), passo])] });
    }
  }
  const projetos = await ctx.db.collection(PROJECTS).where('status', '==', P.INCENTIVE_STATUS.CAPTURING).get();
  for (const s of projetos.docs) {
    const p = { id: s.id, ...s.data() };
    const st = P.incentiveProjectState(p, hoje);
    if (!st.captureEnding || p.warned_capture_for === p.capture_until) continue;
    if (!(await federacaoLigada(ctx, feds, p.federation_id, 'incentive_projects'))) continue;
    avisos += await avisar(ctx, await gestores(ctx, p.federation_id), {
      title: tx('Captação termina em {data}: {projeto}', { data: br(p.capture_until), projeto: p.title }),
      message: tx('Captados {captado} de {aprovado}. Peça a prorrogação ou prepare o encerramento da captação.', { captado: reais(st.captured_cents), aprovado: reais(st.approved_cents) }),
      link: linkGestao(p.federation_id, 'lei-incentivo'),
    });
    await s.ref.update({ warned_capture_for: p.capture_until });
  }
  /* eslint-enable no-await-in-loop */
  if (ctx.logger) ctx.logger.info('Federações: certidões e projetos incentivados.', { avisos });
  return { notices: avisos };
}

/** As receitas derivadas das contas: os aportes recebidos dos projetos incentivados (módulo ligado). */
async function receitas(ctx, fed) {
  if (!(fed.modules && fed.modules.incentive_projects === true)) return [];
  const snap = await ctx.db.collection(PROJECTS).where('federation_id', '==', fed.id).get();
  return P.incentiveIncome(snap.docs.map((x) => ({ id: x.id, ...x.data() })));
}

module.exports = { institutional, sweep, receitas, CERTS, PROJECTS };
