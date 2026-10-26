/**
 * SEDES E COPA no servidor (rodada 3, Bloco 3, `docs/50` §39). Só o servidor
 * grava as coleções (a regra não tem `write`); competições e a administração
 * decidem:
 *
 *  - `federation_host_bids/{id}` (módulo `host_bids`): o edital de sede. Em
 *    rascunho a equipe edita; publicado, recebe as cartas de intenção dos
 *    clubes e arenas filiados (na confederação: filiados a uma estadual da
 *    rede) em `federation_host_entries/{bid}_{kind}_{org}`. A equipe escolhe
 *    quem segue, esses mandam a proposta, a comissão dá as notas
 *    (`federation_host_scores/{entry}_{uid}`, só a equipe lê) e o resultado
 *    sai publicado no próprio edital (nome, cidade e nota — sem uid).
 *  - `federation_cups/{id}` (módulo `federation_cup`, só confederação): a Copa
 *    das Federações. Cada estadual da rede monta o elenco com os SEUS filiados
 *    em dia em `federation_cup_teams/{cup}_{fed}`, manda, e a confederação
 *    aprova ou devolve com motivo. O elenco aprovado vai para
 *    `federation_cups.teams_public` (nome e categoria, sem uid).
 *
 * A conta pura é `federationHostingPolicy.js` (cópia de
 * `src/modules/federations/domain/hosting.js`, com paridade).
 */
const P = require('./federationHostingPolicy.js');
const m = require('./federationMembership.js');
const f = require('./federations.js');
const { gereOrg, KINDS } = require('./federationOrgMembers.js');
const { rosterKey } = require('./federationSelection.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const BIDS = 'federation_host_bids';
const ENTRIES = 'federation_host_entries';
const SCORES = 'federation_host_scores';
const CUPS = 'federation_cups';
const TEAMS = 'federation_cup_teams';
const AFF = 'federation_affiliations';
const LINKS = 'federation_national_links';
const FILE_MAX = 9 * 1024 * 1024;
const BS = P.HOST_BID_STATUS;
const ES = P.HOST_ENTRY_STAGE;
const CS = P.CUP_STATUS;
const TS = P.CUP_TEAM_STATUS;
const linkGestao = (fedId, aba) => `/federacoes/${fedId}/gerir?aba=${aba}`;
/** Onde quem gere a organização acompanha o edital (o cartão "Federação" do clube ou da arena). */
const LINK_ORG = (e) => (e.kind === 'club' ? `/clubes/${e.org_id}/gerir?aba=pagina` : `/arenas/${e.org_id}/gerir?aba=federacao`);
const linkPublico = (fedId) => `/federacoes/${fedId}?aba=competicoes`;
const br = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? iso.split('-').reverse().join('/') : '');
const sigla = (fed) => texto(fed.acronym || fed.name, 20);
const historico = (doc, actor, ctx, action, extra = {}) => [...(doc.history || []), { action, by: actor.uid, at_ms: ctx.now, ...extra }].slice(-50);
const isConf = (fed) => Boolean(fed) && fed.confederation === true;

function exigeValido(r) {
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0] || 'Confira os campos.');
  return r.value;
}

function exigeMotivo(data) {
  const motivo = texto(data.reason, 300);
  if (motivo.length < 3) falha('invalid-argument', 'Diga o motivo.');
  return motivo;
}

const exigeGestao = (c) => { if (!P.canManageHosting(c.perms)) falha('permission-denied', 'Só a equipe de competições e a administração cuidam disto.'); };

async function contexto(ctx, actor, data, modulo) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  if (modulo && !(fed.modules && fed.modules[modulo] === true)) falha('failed-precondition', modulo === 'host_bids' ? 'Esta federação não tem o edital de sede ligado.' : 'Esta confederação não tem a Copa das Federações ligada.');
  if (modulo === 'federation_cup' && !isConf(fed)) falha('failed-precondition', 'A Copa das Federações é da confederação.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  return { fed, perms, hoje: m.isoDateBR(ctx.now) };
}

async function avisar(ctx, uids, msg) {
  const lista = [...new Set(uids.filter(Boolean))];
  for (let i = 0; i < lista.length; i += 400) {
    const batch = ctx.db.batch();
    lista.slice(i, i + 400).forEach((uid) => f.aviso(ctx, batch, uid, msg));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  return lista.length;
}

const equipe = async (ctx, fedId) => [...await f.staffIds(ctx, fedId, 'competitions'), ...await f.staffIds(ctx, fedId, 'admin')];

/** As estaduais com vínculo aprovado a esta confederação. */
async function filiadas(ctx, confId) {
  const snap = await ctx.db.collection(LINKS).where('conf_id', '==', confId).where('status', '==', 'approved').get();
  return snap.docs.map((d) => d.data().federation_id).filter(Boolean);
}

/* ======================================================= edital de sede == */

async function edital(ctx, c, bidId) {
  const snap = await ctx.db.collection(BIDS).doc(texto(bidId, 120)).get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', 'Edital não encontrado.');
  return { ref: snap.ref, b: { id: snap.id, ...snap.data() } };
}

async function inscricoes(ctx, bidId) {
  const snap = await ctx.db.collection(ENTRIES).where('bid_id', '==', bidId).get();
  return snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
}

async function bidSave(ctx, actor, data, c) {
  exigeGestao(c);
  const v = exigeValido(P.validateHostBid(data, c.hoje));
  if (data.bidId) {
    const { ref, b } = await edital(ctx, c, data.bidId);
    if (b.status !== BS.DRAFT) falha('failed-precondition', 'Publicado, o edital não muda: só os prazos podem ser estendidos, com motivo.');
    await ref.update({ ...v, updated_at_ms: ctx.now, history: historico(b, actor, ctx, 'edit') });
    await f.auditoria(ctx, actor, 'federation_host_bid_edit', { federation_id: c.fed.id, bid_id: b.id });
    return { ok: true, bidId: b.id };
  }
  const ref = ctx.db.collection(BIDS).doc();
  await ref.set({
    ...v, federation_id: c.fed.id, federation_name: texto(c.fed.name, 120), federation_acronym: sigla(c.fed), scope: isConf(c.fed) ? 'national' : 'state',
    status: BS.DRAFT, result: null, counts: { intents: 0, proposals: 0 }, warned_intent: false, created_by: actor.uid, created_at_ms: ctx.now, updated_at_ms: ctx.now,
    history: historico({}, actor, ctx, 'create'),
  });
  await f.auditoria(ctx, actor, 'federation_host_bid_create', { federation_id: c.fed.id, bid_id: ref.id });
  return { ok: true, bidId: ref.id };
}

/** Quem é avisado da publicação: os gestores das organizações filiadas (na confederação, as equipes das estaduais). */
async function avisarPublicacao(ctx, c, b) {
  const msg = {
    title: tx('Edital de sede: {evento}', { evento: b.event_name }),
    message: tx('A {sigla} recebe cartas de intenção até {data}. Clubes e arenas filiados podem se candidatar.', { sigla: sigla(c.fed), data: br(b.intent_until) }),
    link: linkPublico(c.fed.id),
  };
  if (isConf(c.fed)) {
    const ids = [];
    // eslint-disable-next-line no-await-in-loop
    for (const fedId of await filiadas(ctx, c.fed.id)) ids.push(...await equipe(ctx, fedId));
    return avisar(ctx, ids, msg);
  }
  const affs = await ctx.db.collection(AFF).where('federation_id', '==', c.fed.id).where('status', '==', 'approved').get();
  return avisar(ctx, affs.docs.map((d) => d.data().requested_by), msg);
}

async function bidPublish(ctx, actor, data, c) {
  exigeGestao(c);
  if (!f.publicada(c.fed)) falha('failed-precondition', 'Torne a federação pública antes de publicar o edital: os clubes de fora não conseguem vê-la.');
  const { ref, b } = await edital(ctx, c, data.bidId);
  if (b.status !== BS.DRAFT) falha('failed-precondition', 'Este edital já foi publicado.');
  exigeValido(P.validateHostBid(b, c.hoje));
  await ref.update({ status: BS.INTENT, published_at: c.hoje, updated_at_ms: ctx.now, history: historico(b, actor, ctx, 'publish') });
  const avisos = await avisarPublicacao(ctx, c, b);
  await f.auditoria(ctx, actor, 'federation_host_bid_publish', { federation_id: c.fed.id, bid_id: b.id, notices: avisos });
  return { ok: true, notices: avisos };
}

async function bidExtend(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, b } = await edital(ctx, c, data.bidId);
  if (![BS.INTENT, BS.PROPOSAL].includes(b.status)) falha('failed-precondition', 'Só se estende o prazo com o edital recebendo cartas ou propostas.');
  const v = exigeValido(P.validateHostExtend(b, data, c.hoje));
  await ref.update({ intent_until: v.intent_until, proposal_until: v.proposal_until, warned_intent: false, updated_at_ms: ctx.now, history: historico(b, actor, ctx, 'extend', { reason: v.reason, intent_until: v.intent_until, proposal_until: v.proposal_until }) });
  const vivos = (await inscricoes(ctx, b.id)).filter((e) => [ES.INTENT, ES.SHORTLISTED, ES.PROPOSAL].includes(e.stage));
  await avisar(ctx, vivos.map((e) => e.applicant_uid), {
    title: tx('Prazo estendido: edital de sede {evento}', { evento: b.event_name }),
    message: tx('Cartas até {carta}; propostas até {proposta}. Motivo: {motivo}', { carta: br(v.intent_until), proposta: br(v.proposal_until), motivo: v.reason }),
    link: linkPublico(c.fed.id),
  });
  await f.auditoria(ctx, actor, 'federation_host_bid_extend', { federation_id: c.fed.id, bid_id: b.id, reason: v.reason });
  return { ok: true };
}

/** A organização pode se candidatar? Filiada à federação (ou, na confederação, a uma estadual da rede). */
async function filiacaoDaOrg(ctx, c, kind, orgId) {
  if (!isConf(c.fed)) {
    const a = await ctx.db.collection(AFF).doc(`${c.fed.id}_${kind}_${orgId}`).get();
    return a.exists && a.data().status === 'approved' ? { ...a.data(), via: c.fed.id } : null;
  }
  const [rede, affs] = await Promise.all([filiadas(ctx, c.fed.id), ctx.db.collection(AFF).where('kind', '==', kind).where('org_id', '==', orgId).get()]);
  const a = affs.docs.map((d) => d.data()).find((x) => x.status === 'approved' && rede.includes(x.federation_id));
  return a ? { ...a, via: a.federation_id } : null;
}

async function exigeGestor(ctx, actor, kind, orgId) {
  if (!KINDS.includes(kind) || !(await gereOrg(ctx, kind, orgId, actor.uid))) falha('permission-denied', kind === 'club' ? 'Só quem administra o clube se candidata.' : 'Só quem gere a arena se candidata.');
}

async function entradaDaOrg(ctx, b, kind, orgId) {
  const ref = ctx.db.collection(ENTRIES).doc(P.hostEntryId(b.id, kind, orgId));
  const snap = await ref.get();
  return { ref, e: snap.exists ? { id: snap.id, ...snap.data() } : null };
}

async function contar(ctx, bidRef, bidId) {
  const lista = await inscricoes(ctx, bidId);
  const counts = {
    intents: lista.filter((e) => e.stage !== ES.WITHDRAWN).length,
    proposals: lista.filter((e) => [ES.PROPOSAL, ES.WINNER, ES.NOT_SELECTED].includes(e.stage)).length,
  };
  await bidRef.update({ counts });
  return counts;
}

async function entryIntent(ctx, actor, data, c) {
  if (!f.publicada(c.fed)) falha('failed-precondition', 'Esta federação ainda não é pública.');
  const kind = String(data.kind || '');
  const orgId = texto(data.orgId, 80);
  await exigeGestor(ctx, actor, kind, orgId);
  const { ref: bidRef, b } = await edital(ctx, c, data.bidId);
  if (!P.hostBidPhase(b, c.hoje).acceptsIntent) falha('failed-precondition', 'O edital não está recebendo cartas de intenção.');
  const aff = await filiacaoDaOrg(ctx, c, kind, orgId);
  if (!aff) falha('failed-precondition', isConf(c.fed) ? 'Só clube ou arena filiado a uma federação da rede se candidata.' : 'Só clube ou arena filiado a esta federação se candidata.');
  const v = exigeValido(P.validateHostIntent(data));
  const { ref, e } = await entradaDaOrg(ctx, b, kind, orgId);
  if (e && ![ES.INTENT, ES.WITHDRAWN].includes(e.stage)) falha('failed-precondition', 'A carta já foi avaliada.');
  const base = {
    bid_id: b.id, federation_id: c.fed.id, kind, org_id: orgId, via_federation_id: aff.via,
    org_name: texto(aff.org_name, 120), org_city: texto(aff.org_city, 80), org_state: texto(aff.org_state, 2),
    applicant_uid: actor.uid, intent: { text: v.text, at_ms: ctx.now }, stage: ES.INTENT, updated_at_ms: ctx.now,
  };
  if (e) await ref.update({ ...base, history: historico(e, actor, ctx, 'intent') });
  else await ref.set({ ...base, proposal: null, created_at_ms: ctx.now, history: historico({}, actor, ctx, 'intent') });
  await contar(ctx, bidRef, b.id);
  await avisar(ctx, (await equipe(ctx, c.fed.id)).filter((u) => u !== actor.uid), {
    title: tx('Carta de intenção: {org}', { org: base.org_name }),
    message: tx('{org} quer sediar {evento}. Veja na Central.', { org: base.org_name, evento: b.event_name }),
    link: linkGestao(c.fed.id, 'sedes'),
  });
  await f.auditoria(ctx, actor, 'federation_host_intent', { federation_id: c.fed.id, bid_id: b.id, entry_id: ref.id });
  return { ok: true, entryId: ref.id };
}

async function entryProposal(ctx, actor, data, c) {
  const kind = String(data.kind || '');
  const orgId = texto(data.orgId, 80);
  await exigeGestor(ctx, actor, kind, orgId);
  const { ref: bidRef, b } = await edital(ctx, c, data.bidId);
  if (!P.hostBidPhase(b, c.hoje).acceptsProposal) falha('failed-precondition', 'O edital não está recebendo propostas.');
  const { ref, e } = await entradaDaOrg(ctx, b, kind, orgId);
  if (!e || ![ES.SHORTLISTED, ES.PROPOSAL].includes(e.stage)) falha('failed-precondition', 'Só quem foi selecionado na fase das cartas manda a proposta.');
  const v = exigeValido(P.validateHostProposal(data, actor.uid));
  await ref.update({ proposal: { ...v, by: actor.uid, at_ms: ctx.now }, stage: ES.PROPOSAL, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'proposal') });
  await contar(ctx, bidRef, b.id);
  await f.auditoria(ctx, actor, 'federation_host_proposal', { federation_id: c.fed.id, bid_id: b.id, entry_id: ref.id, files: v.files.length });
  return { ok: true };
}

async function entryWithdraw(ctx, actor, data, c) {
  const kind = String(data.kind || '');
  const orgId = texto(data.orgId, 80);
  await exigeGestor(ctx, actor, kind, orgId);
  const { ref: bidRef, b } = await edital(ctx, c, data.bidId);
  if (![BS.INTENT, BS.PROPOSAL, BS.REVIEW].includes(b.status)) falha('failed-precondition', 'O edital já foi decidido.');
  const { ref, e } = await entradaDaOrg(ctx, b, kind, orgId);
  if (!e || [ES.WITHDRAWN, ES.NOT_SHORTLISTED].includes(e.stage)) falha('failed-precondition', 'Não há candidatura para retirar.');
  await ref.update({ stage: ES.WITHDRAWN, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'withdraw') });
  await contar(ctx, bidRef, b.id);
  await f.auditoria(ctx, actor, 'federation_host_withdraw', { federation_id: c.fed.id, bid_id: b.id, entry_id: ref.id });
  return { ok: true };
}

/** A equipe escolhe quem segue para a proposta (o resto é avisado de que não seguiu). */
async function bidShortlist(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, b } = await edital(ctx, c, data.bidId);
  if (b.status !== BS.INTENT) falha('failed-precondition', 'A seleção acontece na fase das cartas.');
  if (b.proposal_until < c.hoje) falha('failed-precondition', 'O prazo das propostas já passou: estenda antes de selecionar.');
  const escolhidos = new Set((Array.isArray(data.entryIds) ? data.entryIds : []).map((x) => texto(x, 200)));
  const cartas = (await inscricoes(ctx, b.id)).filter((e) => e.stage === ES.INTENT);
  if (!cartas.some((e) => escolhidos.has(e.id))) falha('invalid-argument', 'Escolha ao menos uma candidatura para seguir.');
  const batch = ctx.db.batch();
  cartas.forEach((e) => batch.update(e.ref, { stage: escolhidos.has(e.id) ? ES.SHORTLISTED : ES.NOT_SHORTLISTED, updated_at_ms: ctx.now, history: historico(e, actor, ctx, escolhidos.has(e.id) ? 'shortlist' : 'not_shortlisted') }));
  batch.update(ref, { status: BS.PROPOSAL, updated_at_ms: ctx.now, history: historico(b, actor, ctx, 'shortlist', { count: escolhidos.size }) });
  await batch.commit();
  /* eslint-disable no-await-in-loop */
  for (const e of cartas) {
    const sim = escolhidos.has(e.id);
    await avisar(ctx, [e.applicant_uid], sim
      ? { title: tx('{org} seguiu no edital de sede {evento}', { org: e.org_name, evento: b.event_name }), message: tx('Mande a proposta completa até {data}.', { data: br(b.proposal_until) }), link: LINK_ORG(e) }
      : { title: tx('{org} não seguiu no edital de sede {evento}', { org: e.org_name, evento: b.event_name }), message: tx('Obrigado pelo interesse. A {sigla} escolheu outras candidaturas para a fase das propostas.', { sigla: sigla(c.fed) }), link: LINK_ORG(e) });
  }
  /* eslint-enable no-await-in-loop */
  await f.auditoria(ctx, actor, 'federation_host_shortlist', { federation_id: c.fed.id, bid_id: b.id, shortlisted: [...escolhidos] });
  return { ok: true };
}

/** Fecha as propostas antes do prazo (todas chegaram) — a varredura fecha sozinha no prazo. */
async function bidToReview(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, b } = await edital(ctx, c, data.bidId);
  if (b.status !== BS.PROPOSAL) falha('failed-precondition', 'Só se fecha o edital na fase das propostas.');
  await ref.update({ status: BS.REVIEW, updated_at_ms: ctx.now, history: historico(b, actor, ctx, 'review') });
  await f.auditoria(ctx, actor, 'federation_host_review', { federation_id: c.fed.id, bid_id: b.id });
  return { ok: true };
}

async function bidScore(ctx, actor, data, c) {
  exigeGestao(c);
  const { b } = await edital(ctx, c, data.bidId);
  if (b.status !== BS.REVIEW) falha('failed-precondition', 'As notas são dadas com o edital em avaliação.');
  const snap = await ctx.db.collection(ENTRIES).doc(texto(data.entryId, 200)).get();
  if (!snap.exists || snap.data().bid_id !== b.id) falha('not-found', 'Proposta não encontrada.');
  const e = { id: snap.id, ...snap.data() };
  if (e.stage !== ES.PROPOSAL) falha('failed-precondition', 'Só proposta enviada recebe nota.');
  if (e.applicant_uid === actor.uid || await gereOrg(ctx, e.kind, e.org_id, actor.uid)) falha('permission-denied', 'Quem gere a organização não avalia a proposta dela.');
  const v = exigeValido(P.validateHostScores(b.criteria, data));
  await ctx.db.collection(SCORES).doc(P.hostScoreId(e.id, actor.uid)).set({
    federation_id: c.fed.id, bid_id: b.id, entry_id: e.id, evaluator_uid: actor.uid, evaluator_name: texto(actor.name, 80), ...v, total: P.weightedScore(b.criteria, v.scores), at_ms: ctx.now,
  });
  await f.auditoria(ctx, actor, 'federation_host_score', { federation_id: c.fed.id, bid_id: b.id, entry_id: e.id });
  return { ok: true };
}

async function bidResult(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, b } = await edital(ctx, c, data.bidId);
  if (b.status !== BS.REVIEW) falha('failed-precondition', 'O resultado sai com o edital em avaliação.');
  const lista = await inscricoes(ctx, b.id);
  const notas = (await ctx.db.collection(SCORES).where('bid_id', '==', b.id).get()).docs.map((d) => d.data());
  const ranking = P.hostRanking(b.criteria, lista, notas);
  if (!ranking.length) falha('failed-precondition', 'Nenhuma proposta para decidir. Cancele o edital, com motivo.');
  if (ranking.some((r) => !r.count)) falha('failed-precondition', 'Toda proposta precisa de ao menos uma nota antes do resultado.');
  const winnerId = texto(data.winnerEntryId, 200);
  if (!ranking.some((r) => r.entry_id === winnerId)) falha('invalid-argument', 'Escolha a proposta vencedora.');
  const motivo = texto(data.reason, 500);
  if (P.hostResultNeedsReason(ranking, winnerId) && motivo.length < 3) falha('invalid-argument', 'A escolhida não teve a maior nota: diga o motivo.');
  const vencedora = lista.find((e) => e.id === winnerId);
  const batch = ctx.db.batch();
  lista.filter((e) => e.stage === ES.PROPOSAL).forEach((e) => batch.update(e.ref, { stage: e.id === winnerId ? ES.WINNER : ES.NOT_SELECTED, updated_at_ms: ctx.now }));
  batch.update(ref, {
    status: BS.RESULT,
    result: { winner_entry_id: winnerId, winner_name: texto(vencedora.org_name, 120), winner_city: texto(vencedora.org_city, 80), ranking: P.hostPublicResult(ranking, winnerId), note: motivo, published_at: c.hoje },
    updated_at_ms: ctx.now, history: historico(b, actor, ctx, 'result', { winner: winnerId }),
  });
  await batch.commit();
  /* eslint-disable no-await-in-loop */
  for (const e of lista.filter((x) => x.stage === ES.PROPOSAL)) {
    const venceu = e.id === winnerId;
    await avisar(ctx, [e.applicant_uid], {
      title: venceu ? tx('{org} vai sediar {evento}', { org: e.org_name, evento: b.event_name }) : tx('Resultado do edital de sede {evento}', { evento: b.event_name }),
      message: venceu ? tx('Parabéns! A {sigla} escolheu a proposta. A equipe entra em contato para os próximos passos.', { sigla: sigla(c.fed) }) : tx('A sede escolhida foi {org}. Obrigado pela proposta.', { org: vencedora.org_name }),
      link: LINK_ORG(e),
    });
  }
  /* eslint-enable no-await-in-loop */
  await f.auditoria(ctx, actor, 'federation_host_result', { federation_id: c.fed.id, bid_id: b.id, winner: winnerId, reason: motivo });
  return { ok: true };
}

async function bidCancel(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, b } = await edital(ctx, c, data.bidId);
  if (![BS.INTENT, BS.PROPOSAL, BS.REVIEW].includes(b.status)) falha('failed-precondition', b.status === BS.DRAFT ? 'Rascunho não se cancela: apague.' : 'O edital já foi decidido.');
  const motivo = exigeMotivo(data);
  await ref.update({ status: BS.CANCELLED, cancel_reason: motivo, updated_at_ms: ctx.now, history: historico(b, actor, ctx, 'cancel', { reason: motivo }) });
  const vivos = (await inscricoes(ctx, b.id)).filter((e) => [ES.INTENT, ES.SHORTLISTED, ES.PROPOSAL].includes(e.stage));
  await avisar(ctx, vivos.map((e) => e.applicant_uid), { title: tx('Edital de sede cancelado: {evento}', { evento: b.event_name }), message: tx('Motivo: {motivo}', { motivo }), link: linkPublico(c.fed.id) });
  await f.auditoria(ctx, actor, 'federation_host_bid_cancel', { federation_id: c.fed.id, bid_id: b.id, reason: motivo });
  return { ok: true };
}

async function bidDelete(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, b } = await edital(ctx, c, data.bidId);
  if (b.status !== BS.DRAFT) falha('failed-precondition', 'Só o rascunho se apaga; publicado, cancele com motivo.');
  await ref.delete();
  await f.auditoria(ctx, actor, 'federation_host_bid_delete', { federation_id: c.fed.id, bid_id: b.id });
  return { ok: true };
}

/** O arquivo da proposta: a equipe e quem gere a organização (pelo servidor — a regra do Storage não consulta o banco). */
async function entryFile(ctx, actor, data, c) {
  const snap = await ctx.db.collection(ENTRIES).doc(texto(data.entryId, 200)).get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', 'Proposta não encontrada.');
  const e = snap.data();
  const gestao = P.canManageHosting(c.perms);
  if (!gestao && !(await gereOrg(ctx, e.kind, e.org_id, actor.uid))) falha('permission-denied', 'Você não pode abrir este arquivo.');
  const arq = ((e.proposal && e.proposal.files) || [])[Math.trunc(Number(data.index))];
  if (!arq || !P.ownFilePath(arq.path, e.proposal.by)) falha('not-found', 'Arquivo não encontrado.');
  if (!ctx.bucket) falha('unavailable', 'Arquivos indisponíveis no momento. Tente de novo.');
  const file = ctx.bucket.file(arq.path);
  const [meta] = await file.getMetadata().catch(() => [null]);
  if (!meta) falha('not-found', 'O arquivo não está mais no servidor.');
  if (Number(meta.size) > FILE_MAX) falha('failed-precondition', 'Arquivo grande demais para abrir por aqui.');
  const [bytes] = await file.download();
  if (gestao) await f.auditoria(ctx, actor, 'federation_host_file_view', { federation_id: c.fed.id, entry_id: snap.id });
  return { ok: true, name: arq.name, contentType: meta.contentType || 'application/octet-stream', base64: Buffer.from(bytes).toString('base64') };
}

/* ================================================== Copa das Federações == */

async function copa(ctx, confId, cupId) {
  const snap = await ctx.db.collection(CUPS).doc(texto(cupId, 120)).get();
  if (!snap.exists || (confId && snap.data().federation_id !== confId)) falha('not-found', 'Copa não encontrada.');
  return { ref: snap.ref, k: { id: snap.id, ...snap.data() } };
}

async function refazerPublico(ctx, cupRef, cup) {
  const snap = await ctx.db.collection(TEAMS).where('cup_id', '==', cup.id).get();
  const teams_public = P.cupTeamsPublic(cup, snap.docs.map((d) => d.data()).map((x) => ({ ...x, athletes: (x.athletes || []).map((a) => ({ ...a, key: rosterKey(a.member_id) })) })));
  await cupRef.update({ teams_public, counts: { approved: teams_public.length, teams: snap.docs.filter((d) => ![TS.WITHDRAWN].includes(d.data().status)).length } });
}

async function cupSave(ctx, actor, data, c) {
  exigeGestao(c);
  const v = exigeValido(P.validateCup(data, c.hoje));
  if (data.cupId) {
    const { ref, k } = await copa(ctx, c.fed.id, data.cupId);
    if (k.status !== CS.DRAFT) falha('failed-precondition', 'Aberta, a Copa não muda: só o prazo de inscrição pode ser estendido.');
    await ref.update({ ...v, updated_at_ms: ctx.now, history: historico(k, actor, ctx, 'edit') });
    return { ok: true, cupId: k.id };
  }
  const ref = ctx.db.collection(CUPS).doc();
  await ref.set({ ...v, federation_id: c.fed.id, federation_name: texto(c.fed.name, 120), federation_acronym: sigla(c.fed), status: CS.DRAFT, teams_public: [], counts: { approved: 0, teams: 0 }, created_by: actor.uid, created_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico({}, actor, ctx, 'create') });
  await f.auditoria(ctx, actor, 'federation_cup_create', { federation_id: c.fed.id, cup_id: ref.id });
  return { ok: true, cupId: ref.id };
}

async function cupPublish(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, k } = await copa(ctx, c.fed.id, data.cupId);
  if (k.status !== CS.DRAFT) falha('failed-precondition', 'Esta Copa já foi aberta.');
  exigeValido(P.validateCup(k, c.hoje));
  await ref.update({ status: CS.OPEN, opened_at: c.hoje, updated_at_ms: ctx.now, history: historico(k, actor, ctx, 'publish') });
  const ids = [];
  // eslint-disable-next-line no-await-in-loop
  for (const fedId of await filiadas(ctx, c.fed.id)) ids.push(...await equipe(ctx, fedId));
  const avisos = await avisar(ctx, ids, {
    title: tx('{conf} abriu a {copa}', { conf: sigla(c.fed), copa: k.title }),
    message: tx('Inscreva o elenco da federação até {data} em Confederação → Copa, na Central.', { data: br(k.entries_until) }),
    link: '/federacoes',
  });
  await f.auditoria(ctx, actor, 'federation_cup_publish', { federation_id: c.fed.id, cup_id: k.id, notices: avisos });
  return { ok: true, notices: avisos };
}

async function cupExtend(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, k } = await copa(ctx, c.fed.id, data.cupId);
  if (![CS.OPEN, CS.CLOSED].includes(k.status)) falha('failed-precondition', 'Só se estende o prazo da Copa aberta ou encerrada.');
  const nova = /^\d{4}-\d{2}-\d{2}$/.test(String(data.entries_until || '')) ? data.entries_until : '';
  if (!nova || nova <= k.entries_until || nova < c.hoje) falha('invalid-argument', 'O novo prazo vem depois do atual e não pode ser no passado.');
  if (nova >= k.starts_at) falha('invalid-argument', 'As inscrições fecham antes de a Copa começar.');
  const motivo = exigeMotivo(data);
  await ref.update({ entries_until: nova, status: CS.OPEN, updated_at_ms: ctx.now, history: historico(k, actor, ctx, 'extend', { reason: motivo, entries_until: nova }) });
  await f.auditoria(ctx, actor, 'federation_cup_extend', { federation_id: c.fed.id, cup_id: k.id, reason: motivo });
  return { ok: true };
}

async function cupCloseOrCancel(ctx, actor, data, c, cancelar) {
  exigeGestao(c);
  const { ref, k } = await copa(ctx, c.fed.id, data.cupId);
  if (cancelar ? ![CS.OPEN, CS.CLOSED].includes(k.status) : k.status !== CS.OPEN) falha('failed-precondition', cancelar ? 'Só se cancela a Copa aberta ou encerrada.' : 'Só se encerram as inscrições da Copa aberta.');
  const motivo = cancelar ? exigeMotivo(data) : '';
  await ref.update({ status: cancelar ? CS.CANCELLED : CS.CLOSED, ...(cancelar ? { cancel_reason: motivo } : {}), updated_at_ms: ctx.now, history: historico(k, actor, ctx, cancelar ? 'cancel' : 'close', motivo ? { reason: motivo } : {}) });
  if (cancelar) {
    const teams = (await ctx.db.collection(TEAMS).where('cup_id', '==', k.id).get()).docs.map((d) => d.data()).filter((x) => x.status !== TS.WITHDRAWN);
    const ids = [];
    // eslint-disable-next-line no-await-in-loop
    for (const x of teams) ids.push(...await equipe(ctx, x.federation_id), ...(x.status === TS.APPROVED ? (x.athletes || []).map((a) => a.uid) : []));
    await avisar(ctx, ids, { title: tx('{copa} foi cancelada', { copa: k.title }), message: tx('Motivo: {motivo}', { motivo }), link: '/federacoes' });
  }
  await f.auditoria(ctx, actor, cancelar ? 'federation_cup_cancel' : 'federation_cup_close', { federation_id: c.fed.id, cup_id: k.id, reason: motivo });
  return { ok: true };
}

async function cupDelete(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, k } = await copa(ctx, c.fed.id, data.cupId);
  if (k.status !== CS.DRAFT) falha('failed-precondition', 'Só o rascunho se apaga; aberta, cancele com motivo.');
  await ref.delete();
  await f.auditoria(ctx, actor, 'federation_cup_delete', { federation_id: c.fed.id, cup_id: k.id });
  return { ok: true };
}

async function timeDaCopa(ctx, cupId, fedId) {
  const ref = ctx.db.collection(TEAMS).doc(P.cupTeamId(cupId, fedId));
  const snap = await ref.get();
  return { ref, x: snap.exists ? { id: snap.id, ...snap.data() } : null };
}

/** A confederação decide o elenco: aprovar ou devolver com motivo. */
async function teamDecide(ctx, actor, data, c, action) {
  exigeGestao(c);
  const { ref: cupRef, k } = await copa(ctx, c.fed.id, data.cupId);
  if (![CS.OPEN, CS.CLOSED].includes(k.status)) falha('failed-precondition', 'A Copa não está recebendo elencos.');
  const { ref, x } = await timeDaCopa(ctx, k.id, texto(data.teamFederationId, 80));
  if (!x) falha('not-found', 'Elenco não encontrado.');
  const r = P.cupTeamTransition(x.status, action);
  if (r.error) falha('failed-precondition', r.error);
  const motivo = action === 'return' ? exigeMotivo(data) : '';
  await ref.update({ status: r.status, decision: { action, reason: motivo, by: actor.uid, at_ms: ctx.now }, updated_at_ms: ctx.now, history: historico(x, actor, ctx, action, motivo ? { reason: motivo } : {}) });
  await refazerPublico(ctx, cupRef, k);
  await avisar(ctx, await equipe(ctx, x.federation_id), action === 'approve'
    ? { title: tx('Elenco aprovado na {copa}', { copa: k.title }), message: tx('A {conf} aprovou o elenco da federação.', { conf: sigla(c.fed) }), link: linkGestao(x.federation_id, 'copa-inscricao') }
    : { title: tx('Elenco devolvido na {copa}', { copa: k.title }), message: tx('Ajuste e mande de novo. Motivo: {motivo}', { motivo }), link: linkGestao(x.federation_id, 'copa-inscricao') });
  if (action === 'approve') {
    await avisar(ctx, (x.athletes || []).map((a) => a.uid), { title: tx('Você está no elenco da {sigla} na {copa}', { sigla: x.acronym || x.federation_name, copa: k.title }), message: tx('{local} · a partir de {data}.', { local: k.location || k.title, data: br(k.starts_at) }), link: linkPublico(c.fed.id) });
  }
  await f.auditoria(ctx, actor, `federation_cup_team_${action}`, { federation_id: c.fed.id, cup_id: k.id, team_id: ref.id, reason: motivo });
  return { ok: true };
}

/** O lado da ESTADUAL: precisa do vínculo aprovado com a confederação dona da Copa. */
async function ladoEstadual(ctx, c, data) {
  if (!P.canManageHosting(c.perms)) falha('permission-denied', 'Só a equipe de competições e a administração inscrevem o elenco.');
  const { ref: cupRef, k } = await copa(ctx, null, data.cupId);
  const conf = await f.federacao(ctx, k.federation_id);
  if (!(conf.modules && conf.modules.federation_cup === true)) falha('failed-precondition', 'A confederação desligou a Copa das Federações.');
  const link = await ctx.db.collection(LINKS).doc(`${conf.id}_${c.fed.id}`).get();
  if (!link.exists || link.data().status !== 'approved') falha('failed-precondition', 'Só federação filiada à confederação inscreve elenco.');
  return { cupRef, k, conf };
}

async function teamSave(ctx, actor, data, c) {
  const { k } = await ladoEstadual(ctx, c, data);
  if (!P.cupAcceptsTeams(k, c.hoje)) falha('failed-precondition', 'As inscrições da Copa não estão abertas.');
  const v = exigeValido(P.validateCupTeam(k, data));
  const membros = await Promise.all([...new Set(v.athletes.map((a) => a.member_id))].map((id) => ctx.db.collection(f.C.members).doc(id).get()));
  const porId = new Map();
  membros.forEach((s) => {
    const d = s.exists ? s.data() : null;
    if (!d || d.federation_id !== c.fed.id || !d.user_id || m.membershipState(d, c.hoje, ctx.now).status !== 'active') falha('failed-precondition', 'Todo atleta do elenco precisa ser filiado em dia desta federação.');
    porId.set(s.id, { uid: d.user_id, name: texto(d.user_name, 120) });
  });
  const athletes = v.athletes.map((a) => ({ ...a, ...porId.get(a.member_id) }));
  const { ref, x } = await timeDaCopa(ctx, k.id, c.fed.id);
  const r = P.cupTeamTransition(x ? x.status : null, 'save');
  if (r.error) falha('failed-precondition', 'Elenco enviado não muda: espere a confederação ou retire.');
  const base = { cup_id: k.id, conf_id: k.federation_id, federation_id: c.fed.id, federation_name: texto(c.fed.name, 120), acronym: sigla(c.fed), athletes, athlete_uids: [...new Set(athletes.map((a) => a.uid))], status: r.status, updated_at_ms: ctx.now };
  if (x) await ref.update({ ...base, history: historico(x, actor, ctx, 'save') });
  else await ref.set({ ...base, decision: null, created_at_ms: ctx.now, history: historico({}, actor, ctx, 'save') });
  await f.auditoria(ctx, actor, 'federation_cup_team_save', { federation_id: c.fed.id, cup_id: k.id, athletes: athletes.length });
  return { ok: true };
}

async function teamSubmitOrWithdraw(ctx, actor, data, c, action) {
  const { cupRef, k, conf } = await ladoEstadual(ctx, c, data);
  if (action === 'submit' && !P.cupAcceptsTeams(k, c.hoje)) falha('failed-precondition', 'As inscrições da Copa não estão abertas.');
  if (action === 'withdraw' && [CS.CANCELLED].includes(k.status)) falha('failed-precondition', 'A Copa foi cancelada.');
  const { ref, x } = await timeDaCopa(ctx, k.id, c.fed.id);
  if (!x) falha('not-found', 'Monte o elenco antes.');
  const r = P.cupTeamTransition(x.status, action);
  if (r.error) falha('failed-precondition', r.error);
  await ref.update({ status: r.status, updated_at_ms: ctx.now, history: historico(x, actor, ctx, action) });
  if (action === 'submit') {
    await avisar(ctx, await equipe(ctx, conf.id), { title: tx('{sigla} mandou o elenco da {copa}', { sigla: sigla(c.fed), copa: k.title }), message: tx('Confira e aprove ou devolva na Central.'), link: linkGestao(conf.id, 'copa') });
  } else if (x.status === TS.APPROVED) await refazerPublico(ctx, cupRef, k);
  await f.auditoria(ctx, actor, `federation_cup_team_${action}`, { federation_id: c.fed.id, cup_id: k.id });
  return { ok: true };
}

/* ============================================================== callable == */

const ACOES = {
  bid_save: ['host_bids', bidSave],
  bid_publish: ['host_bids', bidPublish],
  bid_extend: ['host_bids', bidExtend],
  bid_shortlist: ['host_bids', bidShortlist],
  bid_review: ['host_bids', bidToReview],
  bid_score: ['host_bids', bidScore],
  bid_result: ['host_bids', bidResult],
  bid_cancel: ['host_bids', bidCancel],
  bid_delete: ['host_bids', bidDelete],
  entry_intent: ['host_bids', entryIntent],
  entry_proposal: ['host_bids', entryProposal],
  entry_withdraw: ['host_bids', entryWithdraw],
  entry_file: ['host_bids', entryFile],
  cup_save: ['federation_cup', cupSave],
  cup_publish: ['federation_cup', cupPublish],
  cup_extend: ['federation_cup', cupExtend],
  cup_close: ['federation_cup', (ctx, a, d, c) => cupCloseOrCancel(ctx, a, d, c, false)],
  cup_cancel: ['federation_cup', (ctx, a, d, c) => cupCloseOrCancel(ctx, a, d, c, true)],
  cup_delete: ['federation_cup', cupDelete],
  team_approve: ['federation_cup', (ctx, a, d, c) => teamDecide(ctx, a, d, c, 'approve')],
  team_return: ['federation_cup', (ctx, a, d, c) => teamDecide(ctx, a, d, c, 'return')],
  // O lado da estadual: o módulo que vale é o da confederação (conferido em `ladoEstadual`).
  team_save: [null, teamSave],
  team_submit: [null, (ctx, a, d, c) => teamSubmitOrWithdraw(ctx, a, d, c, 'submit')],
  team_withdraw: [null, (ctx, a, d, c) => teamSubmitOrWithdraw(ctx, a, d, c, 'withdraw')],
};

async function hosting(ctx, actor, data = {}) {
  const acao = ACOES[data.action];
  if (!acao) falha('invalid-argument', 'Ação desconhecida.');
  return acao[1](ctx, actor, data, await contexto(ctx, actor, data, acao[0]));
}

/* ============================================================= varredura == */

/**
 * Cartas no prazo vencido: avisa a equipe uma vez (é ela que escolhe quem
 * segue). Propostas no prazo vencido: o edital passa para a avaliação e a
 * equipe é avisada. Copa com o prazo vencido: inscrições encerradas.
 */
async function sweep(ctx) {
  if (!(await f.flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = m.isoDateBR(ctx.now);
  let avisos = 0;
  /* eslint-disable no-await-in-loop */
  for (const st of [BS.INTENT, BS.PROPOSAL]) {
    const snap = await ctx.db.collection(BIDS).where('status', '==', st).get();
    for (const d of snap.docs) {
      const b = { id: d.id, ...d.data() };
      const fase = P.hostBidPhase(b, hoje);
      if (fase.intentClosed && !b.warned_intent) {
        avisos += await avisar(ctx, await equipe(ctx, b.federation_id), { title: tx('Cartas encerradas: edital de sede {evento}', { evento: b.event_name }), message: tx('Escolha quem segue para a proposta na Central.'), link: linkGestao(b.federation_id, 'sedes') });
        await d.ref.update({ warned_intent: true });
      }
      if (fase.proposalClosed) {
        await d.ref.update({ status: BS.REVIEW, updated_at_ms: ctx.now, history: [...(b.history || []), { action: 'review', by: 'system', at_ms: ctx.now }].slice(-50) });
        avisos += await avisar(ctx, await equipe(ctx, b.federation_id), { title: tx('Propostas encerradas: edital de sede {evento}', { evento: b.event_name }), message: tx('Dê as notas e publique o resultado na Central.'), link: linkGestao(b.federation_id, 'sedes') });
      }
    }
  }
  const abertas = await ctx.db.collection(CUPS).where('status', '==', CS.OPEN).get();
  for (const d of abertas.docs) {
    const k = d.data();
    if (k.entries_until && k.entries_until < hoje) await d.ref.update({ status: CS.CLOSED, updated_at_ms: ctx.now, history: [...(k.history || []), { action: 'close', by: 'system', at_ms: ctx.now }].slice(-50) });
  }
  /* eslint-enable no-await-in-loop */
  if (ctx.logger) ctx.logger.info('Federações: editais de sede e Copa.', { avisos });
  return { notices: avisos };
}

module.exports = { hosting, sweep, BIDS, ENTRIES, SCORES, CUPS, TEAMS };
