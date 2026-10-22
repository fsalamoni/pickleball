/**
 * REGULARIDADE do filiado (Bloco 1 das próximas frentes) — o que só o
 * SERVIDOR faz. A filiação (`federation_members`) e as ocorrências
 * (`federation_incidents`) não aceitam escrita do navegador.
 *
 * Callable `federationRegularity`:
 *  - NÍVEL OFICIAL: `level_set` (equipe com `members` ou `competitions`),
 *    `level_review` (o dono pede revisão, com motivo) e `level_review_decide`
 *    (a equipe aceita — e define o nível — ou recusa, com motivo). O nível é
 *    um rótulo da escala da federação (`rules.levels`); cada mudança fica no
 *    histórico (`official_level_history`, as 20 últimas) e avisa o atleta;
 *  - CONSENTIMENTOS: `consents` (o dono — ou o responsável, ou quem gere a
 *    entidade — marca ou desmarca; cada mudança vai para `consents_log` com a
 *    hora do servidor, as 30 últimas);
 *  - OCORRÊNCIAS (módulo `insurance`): `incident_create` (o próprio atleta ou
 *    a equipe) e `incident_update` (a equipe: seguro acionado com o número do
 *    sinistro, encerrada, observação).
 *
 * `syncMemberDocs` (gatilho em `federation_documents_submitted` e varredura
 * diária): o resumo dos documentos exigidos pelo plano vai para a filiação
 * (`docs_state`) e, se a federação escolheu travar
 * (`rules.block_expired_docs`), `docs_block: true` impede a inscrição em
 * torneio chancelado "só para filiados" (regra `fedMemberOk`).
 *
 * `sweep` (na varredura diária): avisa o dono 30 dias antes, 7 dias antes e
 * no dia em que um documento aceito vence (uma vez cada,
 * `expiry_notified` no documento), e refaz o resumo de quem venceu.
 *
 * A conta pura é `federationRegularityPolicy.js` (cópia de
 * `src/modules/federations/domain/regularity.js`, com paridade).
 */
const R = require('./federationRegularityPolicy.js');
const m = require('./federationMembership.js');
const f = require('./federations.js');
const O = require('./federationOrgMembers.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const INCIDENTS = 'federation_incidents';
const LIVE = ['pending', 'awaiting_payment', 'active', 'expired', 'suspended'];
const LINK_MEU = '/perfil?secao=federacoes';
const linkPasta = (fedId, memberId) => `/federacoes/${fedId}/gerir?aba=filiados&pasta=${encodeURIComponent(memberId)}`;
const sigla = (fed) => fed.acronym || fed.name;
const br = (iso) => (R.isIsoDate(iso) ? iso.split('-').reverse().join('/') : '');
const ERRO = {
  level_unknown: 'Escolha um nível da escala da federação.',
  reason_short: 'Diga o motivo.',
  date_invalid: 'Informe a data.',
  date_future: 'A data não pode ser no futuro.',
  description_short: 'Conte o que aconteceu (mínimo 10 caracteres).',
};
const primeiroErro = (errors) => ERRO[Object.values(errors)[0]] || 'Confira os dados.';

async function contexto(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  return { fed, perms, hoje: m.isoDateBR(ctx.now) };
}

async function filiacao(ctx, fed, memberId) {
  const ref = ctx.db.collection(f.C.members).doc(texto(memberId, 120));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== fed.id) falha('not-found', 'Filiação não encontrada.');
  return { ref, member: { id: snap.id, ...snap.data() } };
}

/** É o dono da filiação? A própria pessoa, o responsável do dependente ou quem gere a entidade. */
async function ehDono(ctx, member, uid) {
  if (member.user_id === uid || member.guardian_uid === uid) return true;
  return O.isOrg(member) && O.gereOrg(ctx, member.org_kind, member.org_id, uid);
}

const exige = (c, ...perms) => { if (!perms.some((p) => c.perms.includes(p))) falha('permission-denied', 'Você não tem permissão para isso nesta federação.'); };

/* ------------------------------------------------------------ nível oficial -- */

/** O patch de uma mudança de nível (com o histórico) — usado pela equipe e pela revisão aceita. */
function patchDoNivel(ctx, actor, member, { label, reason, origin }) {
  const antes = member.official_level || null;
  const entrada = { label, previous: antes ? antes.label : null, reason, by: actor.uid, by_name: texto(actor.name, 120), at_ms: ctx.now, origin };
  return {
    official_level: { label, reason, set_by: actor.uid, set_by_name: texto(actor.name, 120), set_at_ms: ctx.now },
    official_level_history: [entrada, ...(Array.isArray(member.official_level_history) ? member.official_level_history : [])].slice(0, R.LEVEL_HISTORY_MAX),
    updated_at: ctx.Timestamp.fromMillis(ctx.now),
  };
}

async function definirNivel(ctx, actor, data, c, origin) {
  exige(c, 'members', 'competitions');
  const { ref, member } = await filiacao(ctx, c.fed, data.memberId);
  if (O.isOrg(member)) falha('failed-precondition', 'Clube e arena não têm nível de atleta.');
  const r = R.validateLevelInput(data, c.fed.rules && c.fed.rules.levels);
  if (!r.ok) falha('invalid-argument', primeiroErro(r.errors));
  const patch = patchDoNivel(ctx, actor, member, { ...r.value, origin });
  if (origin === 'review') patch.level_review = { ...(member.level_review || {}), status: 'accepted', decided_by: actor.uid, decided_at_ms: ctx.now, decided_reason: r.value.reason };
  const batch = ctx.db.batch();
  batch.update(ref, patch);
  const destino = f.destinatario(member);
  if (destino) {
    f.aviso(ctx, batch, destino, {
      title: tx('Nível oficial na {sigla}: {nivel}', { sigla: sigla(c.fed), nivel: r.value.label }),
      message: origin === 'review'
        ? tx('A federação aceitou o pedido de revisão de {nome}. Motivo: {motivo}', { nome: member.user_name, motivo: r.value.reason })
        : tx('A federação definiu o nível oficial de {nome}. Motivo: {motivo}', { nome: member.user_name, motivo: r.value.reason }),
      link: LINK_MEU,
    });
  }
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_level_set', { federation_id: c.fed.id, member_id: member.id, user_id: member.user_id || null, label: r.value.label, previous: member.official_level ? member.official_level.label : null, origin });
  return { ok: true, label: r.value.label };
}

async function pedirRevisao(ctx, actor, data, c) {
  const { ref, member } = await filiacao(ctx, c.fed, data.memberId);
  if (!(await ehDono(ctx, member, actor.uid))) falha('permission-denied', 'Esta filiação não é sua.');
  if (!['active', 'expired'].includes(member.status)) falha('failed-precondition', 'Só quem já é filiado pede revisão do nível.');
  if (member.level_review && member.level_review.status === 'pending') falha('failed-precondition', 'Já há um pedido de revisão esperando a federação.');
  const r = R.validateLevelReview(data);
  if (!r.ok) falha('invalid-argument', 'Conte por que o nível deve mudar (mínimo 10 caracteres).');
  const escala = R.normalizeLevels(c.fed.rules && c.fed.rules.levels);
  const wanted = escala.includes(r.value.wanted) ? r.value.wanted : null;
  const batch = ctx.db.batch();
  batch.update(ref, { level_review: { status: 'pending', reason: r.value.reason, wanted, current: member.official_level ? member.official_level.label : null, requested_by: actor.uid, requested_at_ms: ctx.now }, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  const equipe = [...new Set([...(await f.staffIds(ctx, c.fed.id, 'competitions')), ...(await f.staffIds(ctx, c.fed.id, 'members'))])];
  equipe.forEach((uid) => f.aviso(ctx, batch, uid, {
    title: tx('Pedido de revisão de nível na {sigla}', { sigla: sigla(c.fed) }),
    message: tx('{nome} pediu revisão do nível oficial. Analise na pasta do filiado.', { nome: member.user_name }),
    link: linkPasta(c.fed.id, member.id),
  }));
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_level_review_request', { federation_id: c.fed.id, member_id: member.id, user_id: member.user_id || null, wanted });
  return { ok: true };
}

async function decidirRevisao(ctx, actor, data, c) {
  exige(c, 'members', 'competitions');
  if (data.decision === 'accept') return definirNivel(ctx, actor, data, c, 'review');
  const { ref, member } = await filiacao(ctx, c.fed, data.memberId);
  if (!member.level_review || member.level_review.status !== 'pending') falha('failed-precondition', 'Não há pedido de revisão esperando.');
  const reason = texto(data.reason, 300);
  if (reason.length < 3) falha('invalid-argument', 'Diga o motivo da recusa.');
  const batch = ctx.db.batch();
  batch.update(ref, { level_review: { ...member.level_review, status: 'rejected', decided_by: actor.uid, decided_at_ms: ctx.now, decided_reason: reason }, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  const destino = f.destinatario(member);
  if (destino) f.aviso(ctx, batch, destino, { title: tx('Revisão de nível na {sigla}: mantido', { sigla: sigla(c.fed) }), message: tx('A federação manteve o nível de {nome}. Motivo: {motivo}', { nome: member.user_name, motivo: reason }), link: LINK_MEU });
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_level_review_reject', { federation_id: c.fed.id, member_id: member.id, user_id: member.user_id || null });
  return { ok: true };
}

/* ---------------------------------------------------------- consentimentos -- */

async function consentimentos(ctx, actor, data, c) {
  const { ref, member } = await filiacao(ctx, c.fed, data.memberId);
  if (!(await ehDono(ctx, member, actor.uid))) falha('permission-denied', 'Esta filiação não é sua.');
  if (!LIVE.includes(member.status)) falha('failed-precondition', 'Esta filiação foi encerrada.');
  const r = R.consentsPatch(c.fed, member, data.consents, actor.uid, ctx.now);
  if (!r) return { ok: true, changed: 0 };
  const { changed, ...patch } = r;
  await ref.update({ ...patch, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  await f.auditoria(ctx, actor, 'federation_consents_update', { federation_id: c.fed.id, member_id: member.id, user_id: member.user_id || null, consents: Object.fromEntries(Object.entries(patch.consents).map(([k, v]) => [k, v.granted])) });
  return { ok: true, changed };
}

/* -------------------------------------------------------------- ocorrências -- */

async function registrarOcorrencia(ctx, actor, data, c) {
  if (!(c.fed.modules && c.fed.modules.insurance === true)) falha('failed-precondition', 'Esta federação não tem o módulo de seguro e ocorrências ligado.');
  const { member } = await filiacao(ctx, c.fed, data.memberId);
  if (O.isOrg(member)) falha('failed-precondition', 'A ocorrência é de uma pessoa filiada.');
  const equipe = ['members', 'competitions'].some((p) => c.perms.includes(p));
  const dono = await ehDono(ctx, member, actor.uid);
  if (!equipe && !dono) falha('permission-denied', 'Você não pode registrar ocorrência para esta filiação.');
  const r = R.validateIncident(data, c.hoje);
  if (!r.ok) falha('invalid-argument', primeiroErro(r.errors));
  const ins = c.fed.insurance || null;
  const memberActive = m.membershipState(member, c.hoje, ctx.now).status === 'active';
  const ref = ctx.db.collection(INCIDENTS).doc();
  const doc = {
    federation_id: c.fed.id, member_id: member.id, user_id: member.user_id || null, guardian_uid: member.guardian_uid || null,
    athlete_name: member.user_name || '', member_number: member.member_number || null, ...r.value,
    insured: R.memberInsured(member, c.fed, r.value.date, memberActive),
    insurance_snapshot: ins ? { insurer: texto(ins.insurer, 80), policy: texto(ins.policy, 40), phone: texto(ins.phone, 30) } : null,
    status: 'open', claim_number: '', reported_by: actor.uid, reported_by_name: texto(actor.name, 120), reported_role: equipe && !dono ? 'staff' : 'athlete',
    history: [{ status: 'open', note: '', by: actor.uid, by_name: texto(actor.name, 120), at_ms: ctx.now }],
    created_at: ctx.Timestamp.fromMillis(ctx.now), created_at_ms: ctx.now, updated_at_ms: ctx.now,
  };
  const batch = ctx.db.batch();
  batch.set(ref, doc);
  if (doc.reported_role === 'athlete') {
    const quem = [...new Set([...(await f.staffIds(ctx, c.fed.id, 'members')), ...(await f.staffIds(ctx, c.fed.id, 'competitions'))])];
    quem.forEach((uid) => f.aviso(ctx, batch, uid, {
      title: tx('Ocorrência registrada na {sigla}', { sigla: sigla(c.fed) }),
      message: tx('{nome} registrou uma ocorrência em {data}. Veja em Filiados → Seguro e ocorrências.', { nome: doc.athlete_name, data: br(doc.date) }),
      link: `/federacoes/${c.fed.id}/gerir?aba=ocorrencias`,
    }));
  } else {
    const destino = f.destinatario(member);
    if (destino) f.aviso(ctx, batch, destino, { title: tx('A {sigla} registrou uma ocorrência sua', { sigla: sigla(c.fed) }), message: tx('Ocorrência de {data}. Acompanhe em Minha filiação.', { data: br(doc.date) }), link: LINK_MEU });
  }
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_incident_create', { federation_id: c.fed.id, member_id: member.id, user_id: member.user_id || null, incident_id: ref.id, kind: doc.kind });
  return { ok: true, id: ref.id };
}

async function atualizarOcorrencia(ctx, actor, data, c) {
  exige(c, 'members', 'competitions');
  const ref = ctx.db.collection(INCIDENTS).doc(texto(data.incidentId, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', 'Ocorrência não encontrada.');
  const inc = snap.data();
  const status = R.INCIDENT_STATUSES.includes(data.status) ? data.status : inc.status;
  const claim = data.claimNumber != null ? texto(data.claimNumber, 40) : inc.claim_number || '';
  const note = texto(data.note, 500);
  if (status === 'claim' && !claim) falha('invalid-argument', 'Informe o número do sinistro.');
  if (status === inc.status && claim === (inc.claim_number || '') && !note) return { ok: true, changed: false };
  const batch = ctx.db.batch();
  batch.update(ref, {
    status, claim_number: claim, updated_at_ms: ctx.now,
    history: [...(inc.history || []), { status, note, claim_number: claim, by: actor.uid, by_name: texto(actor.name, 120), at_ms: ctx.now }].slice(-50),
  });
  const destino = inc.guardian_uid || inc.user_id;
  if (destino && status !== inc.status) {
    f.aviso(ctx, batch, destino, {
      title: status === 'claim' ? tx('Seguro acionado pela {sigla}', { sigla: sigla(c.fed) }) : tx('Ocorrência encerrada pela {sigla}', { sigla: sigla(c.fed) }),
      message: status === 'claim' ? tx('Número do sinistro: {n}.', { n: claim }) : (note || tx('A ocorrência de {data} foi encerrada.', { data: br(inc.date) })),
      link: LINK_MEU,
    });
  }
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_incident_update', { federation_id: c.fed.id, incident_id: ref.id, status, user_id: inc.user_id || null });
  return { ok: true, changed: true };
}

const ACOES = {
  level_set: (ctx, a, d, c) => definirNivel(ctx, a, d, c, 'staff'),
  level_review: pedirRevisao,
  level_review_decide: decidirRevisao,
  consents: consentimentos,
  incident_create: registrarOcorrencia,
  incident_update: atualizarOcorrencia,
};

async function regularity(ctx, actor, data = {}) {
  const fn = ACOES[data.action];
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  return fn(ctx, actor, data, await contexto(ctx, actor, data));
}

/* -------------------------------------------- documentos: resumo e varredura -- */

/** Refaz o resumo dos documentos de UMA filiação e a trava; só grava se mudou. */
async function syncMemberDocs(ctx, memberId, { fed = null, hoje = m.isoDateBR(ctx.now) } = {}) {
  if (!memberId) return null;
  const ref = ctx.db.collection(f.C.members).doc(String(memberId));
  const snap = await ref.get();
  if (!snap.exists) return null;
  const member = snap.data();
  const [planSnap, fedDoc, docsSnap] = await Promise.all([
    member.plan_id ? ctx.db.collection(f.C.plans).doc(member.plan_id).get() : null,
    fed || ctx.db.collection(f.C.federations).doc(member.federation_id).get().then((s) => (s.exists ? s.data() : {})),
    ctx.db.collection(f.C.documents).where('member_id', '==', snap.id).get(),
  ]);
  const plan = planSnap && planSnap.exists ? planSnap.data() : null;
  const docs = docsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const summary = R.docsSummary(R.requiredDocsStatus(plan, docs, hoje));
  const block = R.docsBlock(fedDoc && fedDoc.rules, summary);
  const atual = member.docs_state || {};
  const igual = ['state', 'next_expiry', 'expired', 'expiring', 'missing', 'pending'].every((k) => (atual[k] ?? null) === (summary[k] ?? null)) && Boolean(member.docs_block) === block;
  if (!igual) await ref.update({ docs_state: { ...summary, updated_at_ms: ctx.now }, docs_block: block });
  return { summary, block, changed: !igual };
}

/** Gatilho: documento enviado, aceito, recusado ou apagado → o resumo da filiação dele. */
async function onDocumentWritten(ctx, antes, depois) {
  const ids = [...new Set([antes && antes.member_id, depois && depois.member_id].filter(Boolean))];
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    await syncMemberDocs(ctx, id);
  }
}

/**
 * Varredura diária: documento aceito que vence em 30 dias, em 7 dias ou hoje
 * avisa quem enviou (uma vez cada); o que venceu refaz o resumo da filiação.
 * Só os aceitos com validade nos próximos 30 dias ou vencidos nos últimos 7
 * (varredura parada uns dias ainda pega).
 */
async function sweep(ctx) {
  if (!(await f.flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = m.isoDateBR(ctx.now);
  const ate = m.addMonthsISO(hoje, 1);
  const desde = (() => { const d = new Date(`${hoje}T12:00:00`); d.setDate(d.getDate() - 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const snap = await ctx.db.collection(f.C.documents).where('valid_until', '>=', desde).where('valid_until', '<=', ate).get();
  const feds = {};
  const fedDe = async (id) => {
    if (!feds[id]) { const s = await ctx.db.collection(f.C.federations).doc(id).get(); feds[id] = s.exists ? s.data() : {}; }
    return feds[id];
  };
  let batch = ctx.db.batch();
  let n = 0;
  let avisos = 0;
  const refazer = new Set();
  const flush = async () => { if (n) { await batch.commit(); batch = ctx.db.batch(); n = 0; } };
  for (const d of snap.docs) {
    const doc = d.data();
    if (doc.status !== 'approved' || !doc.valid_until) continue;
    const dias = m.daysBetween(hoje, doc.valid_until);
    if (dias < 0) {
      if (!doc.expired_applied) { refazer.add(doc.member_id); batch.update(d.ref, { expired_applied: true }); n += 1; }
      continue;
    }
    const feitos = doc.expiry_notified || {};
    const marcos = R.DOC_EXPIRY_NOTICE_DAYS.filter((x) => dias <= x && !feitos[String(x)]);
    if (!marcos.length) continue;
    if (dias <= R.DOC_EXPIRY_WARN_DAYS) refazer.add(doc.member_id);
    // eslint-disable-next-line no-await-in-loop
    const fed = await fedDe(doc.federation_id);
    const nome = doc.label || ({ identidade: 'Documento de identidade', atestado: 'Atestado médico', comprovante_residencia: 'Comprovante de residência', autorizacao_responsavel: 'Autorização do responsável' })[doc.kind] || 'Documento';
    if (doc.user_id) {
      f.aviso(ctx, batch, doc.user_id, {
        title: dias === 0 ? tx('{doc} vence hoje na {sigla}', { doc: tx(nome), sigla: fed.acronym || fed.name || '' }) : tx('{doc} vence em {dias} dias na {sigla}', { doc: tx(nome), dias, sigla: fed.acronym || fed.name || '' }),
        message: tx('Envie o documento atualizado pela página da federação, na aba Minha filiação, para continuar em dia.'),
        link: LINK_MEU,
      });
      avisos += 1;
    }
    const notified = { ...feitos };
    marcos.forEach((x) => { notified[String(x)] = true; });
    batch.update(d.ref, { expiry_notified: notified });
    n += 2;
    // eslint-disable-next-line no-await-in-loop
    if (n >= 400) await flush();
  }
  await flush();
  for (const id of refazer) {
    // eslint-disable-next-line no-await-in-loop
    await syncMemberDocs(ctx, id, { hoje });
  }
  if (ctx.logger) ctx.logger.info('Federações: validade dos documentos.', { avisos, resumos: refazer.size });
  return { avisos, resumos: refazer.size };
}

module.exports = { regularity, syncMemberDocs, onDocumentWritten, sweep, INCIDENTS };
