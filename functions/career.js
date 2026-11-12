/**
 * MINHA CARREIRA — a DUPLA confirma e comenta (flag `athlete_career`, docs/54 §6).
 *
 * `career_partner/{evento}__{dupla}` é escrita de TERCEIRO (o que a dupla diz
 * sobre o registro de outra pessoa): a regra é `allow write: if false` e tudo
 * passa por aqui.
 *
 * Chamada `career` (ações):
 *  - `invite`   o dono pede confirmação a quem citou como dupla (com conta);
 *  - `respond`  a dupla confirma ("Confirmo") ou recusa ("Não foi assim");
 *  - `feedback` a dupla deixa a visão dela (ponto forte, o que melhorar, um treino);
 *  - `decide`   o dono escolhe "Usar no meu treino" ou "Guardar";
 *  - `remove`   o dono apaga o pedido; a dupla retira a visão (ou desfaz a confirmação);
 *  - `report`   qualquer uma das duas denuncia;
 *  - `moderate` o admin decide a denúncia (com motivo, auditoria e aviso ao autor);
 *  - `queue`    o admin lista as denúncias abertas (a crítica nunca é lida pelo cliente fora das duas pontas);
 *  - `invite_link` / `invite_cancel` (PR 6) o dono gera ou cancela o link de
 *    uso único para a dupla SEM conta ("Convidar pelo WhatsApp");
 *  - `invite_peek` / `invite_accept` (PR 6) quem abriu o link vê de quem é e
 *    aceita: a conta preenche a dupla VAZIA (nunca troca uma conta) e o pedido
 *    de confirmação abre.
 *
 * Gatilho `eventWritten` (`careerEventWritten`, em `career_events/{id}`):
 *  - recalcula a IMPRESSÃO do que foi confirmado: mudou data, categoria ou
 *    colocação ⇒ "confirmar de novo" (`reconfirm`) e aviso; mudou só o nome ⇒
 *    só o resumo é atualizado;
 *  - a dupla que saiu do registro perde o pedido; o registro apagado leva os pedidos
 *    e o balanço do torneio (`training_debriefs/{uid}_externo_{evento}`);
 *  - "Pôr na minha carreira também": confere o `linked_event` e liga as duas fichas
 *    (`partner_event_id`); vínculo que não confere é desfeito.
 *
 * Travas: só quem foi citado confirma; menor de 18 (ou nascimento desconhecido)
 * não convida nem é convidado; a crítica fica entre as duas pessoas (e o admin,
 * só na denúncia). Nada daqui pontua (guarda `carreiraNaoPontua`).
 */
const crypto = require('node:crypto');
const P = require('./careerPolicy.js');
const V = require('./careerPublicPolicy.js');
const { tx, textoDoAviso, i18nDoAviso } = require('./avisoI18n.js');
const { FederationError } = require('./federations.js');

const EV = 'career_events';
const COL = 'career_partner';
/**
 * A denúncia mora FORA do pedido (`{pedido}__{owner|partner}`): o pedido é lido
 * pelas duas pontas, e quem foi denunciado não pode ler quem denunciou, o
 * motivo nem a nota. Só o servidor escreve; a regra deixa ler só quem denunciou.
 */
const REP = 'career_partner_reports';
const reportId = (docId, papel) => `${docId}__${papel}`;
const ABERTOS = [P.PARTNER_STATUS.INVITED, P.PARTNER_STATUS.RECONFIRM];

const falha = (code, msg) => { throw new FederationError(code, msg); };
const texto = (v, max = 300) => String(v == null ? '' : v).trim().slice(0, max);
const hojeBR = (now) => new Date(now - 3 * 3600000).toISOString().slice(0, 10);
const nomeDe = (u) => texto((u && (u.platform_name || u.full_name || u.display_name)) || 'Atleta', 80);

/* -------------------------------------------------------------- apoio -- */

async function flagLigada(ctx) {
  const snap = await ctx.db.collection('platform_settings').doc('global').get();
  return Boolean(snap.exists && snap.data().feature_flags && snap.data().feature_flags.athlete_career === true);
}

async function exigeFlag(ctx) {
  if (!(await flagLigada(ctx))) falha('failed-precondition', 'A Carreira não está ligada nesta plataforma.');
}

async function usuario(ctx, uid) {
  const snap = await ctx.db.collection('users').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

function aviso(ctx, batch, userId, { title, message, link }) {
  if (!userId) return;
  const i18n = i18nDoAviso({ title, message });
  const seguro = P.linkDeAviso(link);
  batch.set(ctx.db.collection('notifications').doc(), {
    user_id: userId, title: textoDoAviso(title), message: textoDoAviso(message), ...(i18n ? { i18n } : {}),
    type: 'career', ...(seguro ? { link: seguro } : {}), read: false, archived: false, origin: 'server',
    created_at: ctx.Timestamp.fromMillis(ctx.now),
  });
}

/** Auditoria sem o texto da visão (a crítica não sai do privado). */
function auditoria(ctx, batch, actor, action, details) {
  batch.set(ctx.db.collection('audit_logs').doc(), {
    log_number: Number(`${ctx.now}${Math.floor(Math.random() * 900 + 100)}`),
    action, action_label: action, actor_id: actor.uid, actor_name: actor.name || actor.uid, actor_email: actor.email || '',
    tournament_id: null, user_id: details.user_id || null, details, created_at: ctx.Timestamp.fromMillis(ctx.now),
  });
}

const linkDoPedido = (docId) => `/carreira?dupla=${encodeURIComponent(docId)}`;
const linkDoEvento = (eventId) => `/carreira?evento=${encodeURIComponent(eventId)}`;

/** Texto de um campo da ficha: só string/número (um mapa gravado por fora da tela vira vazio). */
const campo = (v, max) => (typeof v === 'string' || typeof v === 'number' ? texto(v, max) : '');

/**
 * As participações em que `uid` foi citado. A regra de `career_events` não
 * confere forma: ficha fora do que a tela grava (participações demais, rótulo
 * gigante que incharia a impressão) não cita ninguém — nada dela é copiado
 * para o pedido que a OUTRA pessoa lê.
 */
function citadas(ev, uid) {
  if (!ev || !Array.isArray(ev.entries) || ev.entries.length > V.MAX_ENTRIES) return [];
  const idx = P.citedEntryIndexes(ev, uid);
  return P.careerFingerprint(ev, idx).length > 1500 ? [] : idx;
}

/** O que a dupla vê do registro (ela não lê o documento do dono): datas, lugar e as categorias em que foi citada. */
function resumo(ev, indexes) {
  return {
    name: campo(ev.name, 120),
    start_date: campo(ev.start_date, 10),
    end_date: campo(ev.end_date, 10) || null,
    date_precision: ev.date_precision === 'year' ? 'year' : 'day',
    city: campo(ev.city, 80),
    state: campo(ev.state, 2),
    entries: indexes.map((i) => V.safeEntryFields(ev.entries[i])),
  };
}

const PEDIDO_SUMIU = 'Este pedido não existe mais.';

/**
 * Lê o pedido para `actor`. Inexistente e "não é seu" respondem IGUAL
 * (`not-found`): o id é evento + uid da dupla, e um código de erro diferente
 * diria a um terceiro quem foi citado naquele torneio. Só o admin lê o de outros.
 */
async function pedido(ctx, docId, actor) {
  const id = texto(docId, 400);
  if (!id || id.includes('/')) falha('invalid-argument', 'Pedido não informado.');
  const ref = ctx.db.collection(COL).doc(id);
  const snap = await ref.get();
  const d = snap.exists ? snap.data() : null;
  if (!d || !(actor.isPlatformAdmin || [d.owner_uid, d.partner_uid].includes(actor.uid))) falha('not-found', PEDIDO_SUMIU);
  return { ref, id, d };
}

/** Solta o vínculo do registro espelhado da dupla ("Pôr na minha carreira também"). */
async function soltarEspelho(ctx, batch, d) {
  if (!d || !d.partner_event_id) return;
  const esp = await ctx.db.collection(EV).doc(d.partner_event_id).get();
  if (esp.exists && esp.data().linked_event && esp.data().linked_event.id === d.event_id) batch.update(esp.ref, { linked_event: null });
}

/**
 * O pedido some e solta o vínculo do espelho. As DENÚNCIAS ficam: a aberta
 * segue na fila do admin (quem foi denunciado não a apaga tirando a dupla da
 * ficha) e a decidida é o que impede pedir de novo. Saem na exclusão de conta.
 */
async function apagarPedido(ctx, batch, ref, d) {
  batch.delete(ref);
  await soltarEspelho(ctx, batch, d);
}

async function denunciaAberta(ctx, docId, papel) {
  const r = await ctx.db.collection(REP).doc(reportId(docId, papel)).get();
  return r.exists && r.data().open === true;
}

/** Decisão da moderação que FICA valendo para o pedido (a denúncia decidida é a marca). */
const decisaoDe = (snap) => (snap.exists && snap.data().moderation && snap.data().moderation.decision) || null;
const EM_ANALISE = 'Este pedido está em análise pela moderação.';

/* Teto de pedidos por remetente: o aviso sai com texto dele, pelo servidor. */
const CONVITES_POR_DIA = 20;
const ABERTOS_POR_DUPLA = 3;
const DIA_MS = 86400000;

async function exigeAdulto(ctx, uid, msg) {
  const u = await usuario(ctx, uid);
  if (!u || !P.isAdult(u.birth_date, hojeBR(ctx.now))) falha('failed-precondition', msg);
  return u;
}

/* -------------------------------------------------------------- ações -- */

async function invite(ctx, actor, data) {
  await exigeFlag(ctx);
  const eventId = texto(data.eventId, 200);
  const partnerUid = texto(data.partnerUid, 128);
  if (!eventId || !partnerUid) falha('invalid-argument', 'Escolha o torneio e a dupla.');
  if (partnerUid === actor.uid) falha('invalid-argument', 'Você não pode pedir confirmação a si mesmo.');
  const evSnap = await ctx.db.collection(EV).doc(eventId).get();
  if (!evSnap.exists || evSnap.data().uid !== actor.uid) falha('permission-denied', 'Este torneio não é seu.');
  const ev = evSnap.data();
  if (!ev.start_date || ev.start_date > hojeBR(ctx.now) || ev.status === 'cancelled') falha('failed-precondition', 'Só dá para pedir confirmação de torneio já jogado.');
  const idx = citadas(ev, partnerUid);
  if (!idx.length) falha('failed-precondition', 'Esta pessoa não está como dupla neste torneio.');
  const eu = await exigeAdulto(ctx, actor.uid, 'Menores de 18 anos não pedem confirmação de dupla.');
  const dupla = await usuario(ctx, partnerUid);
  const id = P.partnerDocId(eventId, partnerUid);
  if (!dupla || !P.isAdult(dupla.birth_date, hojeBR(ctx.now))) {
    // Menor (ou nascimento desconhecido, ou conta que não existe): a MESMA resposta
    // do convite que saiu, sem gravar nem avisar — a resposta não pode virar uma
    // sonda de "esta conta é de menor". Fica só a auditoria.
    const b = ctx.db.batch();
    auditoria(ctx, b, actor, 'career_partner_invite_held', { doc_id: id, event_id: eventId, user_id: partnerUid });
    await b.commit();
    return { id, status: P.PARTNER_STATUS.INVITED };
  }

  const ref = ctx.db.collection(COL).doc(id);
  const atual = await ref.get();
  const fp = P.careerFingerprint(ev, idx);
  const antes = atual.exists ? atual.data() : null;
  if (antes && ABERTOS.includes(antes.status)) return { id, status: antes.status };
  if (antes && antes.status === P.PARTNER_STATUS.CONFIRMED && antes.fingerprint === fp) return { id, status: antes.status };
  if (antes && antes.status === P.PARTNER_STATUS.DECLINED && antes.fingerprint === fp) {
    falha('failed-precondition', 'A dupla já respondeu que não foi assim. Corrija o registro antes de pedir de novo.');
  }
  // A moderação retirou o pedido ("não jogamos juntos"): pedir de novo não desfaz a decisão.
  const rDupla = await ctx.db.collection(REP).doc(reportId(id, 'partner')).get();
  if (rDupla.exists && rDupla.data().moderation && rDupla.data().moderation.decision === 'remove_link') {
    falha('failed-precondition', 'A moderação retirou este pedido. Não dá para pedir de novo a esta pessoa neste torneio.');
  }
  // Teto por remetente, depois das respostas idempotentes (tocar de novo num pedido aberto
  // não é pedido novo). Conta o que foi ENVIADO (a auditoria fica quando o pedido é apagado;
  // sem isso, pedir, apagar e pedir de novo mandava avisos sem fim) e os abertos para a mesma pessoa.
  const [meusSnap, enviadosSnap] = await Promise.all([
    ctx.db.collection(COL).where('owner_uid', '==', actor.uid).get(),
    ctx.db.collection('audit_logs').where('actor_id', '==', actor.uid).where('action', '==', 'career_partner_invited').get(),
  ]);
  const meus = meusSnap.docs.map((x) => x.data());
  const recente = (ms) => Number(ms) > ctx.now - DIA_MS;
  const enviados = enviadosSnap.docs.filter((x) => recente((x.data().details || {}).at_ms)).length;
  if (Math.max(enviados, meus.filter((x) => recente(x.invited_at_ms)).length) >= CONVITES_POR_DIA
    || meus.filter((x) => x.partner_uid === partnerUid && ABERTOS.includes(x.status) && x.event_id !== eventId).length >= ABERTOS_POR_DUPLA) {
    falha('resource-exhausted', 'Você já pediu muitas confirmações. Espere as respostas antes de pedir de novo.');
  }
  const batch = ctx.db.batch();
  batch.set(ref, {
    owner_uid: actor.uid,
    partner_uid: partnerUid,
    event_id: eventId,
    owner_name: nomeDe(eu),
    partner_name: nomeDe(dupla),
    entry_indexes: idx,
    summary: resumo(ev, idx),
    status: P.PARTNER_STATUS.INVITED,
    fingerprint: fp,
    feedback: (antes && antes.feedback) || null,
    owner_decision: (antes && antes.owner_decision) || null,
    partner_event_id: (antes && antes.partner_event_id) || null,
    invited_at_ms: ctx.now,
    answered_at_ms: null,
    // Pedir de novo não reabre o aviso "a visão chegou" (ele sai uma vez por pedido).
    ...(antes && antes.feedback_notified_at_ms ? { feedback_notified_at_ms: antes.feedback_notified_at_ms } : {}),
  });
  aviso(ctx, batch, partnerUid, {
    title: tx('{nome} pediu sua confirmação', { nome: nomeDe(eu) }),
    message: tx('Confirme que vocês jogaram juntos: {torneio}.', { torneio: texto(ev.name, 120) }),
    link: linkDoPedido(id),
  });
  auditoria(ctx, batch, actor, 'career_partner_invited', { doc_id: id, event_id: eventId, user_id: partnerUid, at_ms: ctx.now });
  await batch.commit();
  return { id, status: P.PARTNER_STATUS.INVITED };
}

async function respond(ctx, actor, data) {
  await exigeFlag(ctx);
  const { ref, id, d } = await pedido(ctx, data.docId, actor);
  if (d.partner_uid !== actor.uid) falha('permission-denied', 'Só quem foi citado como dupla responde.');
  if (!ABERTOS.includes(d.status)) falha('failed-precondition', 'Este pedido já foi respondido.');
  const answer = data.answer === 'confirm' ? 'confirm' : data.answer === 'decline' ? 'decline' : '';
  if (!answer) falha('invalid-argument', 'Resposta inválida.');
  const evSnap = await ctx.db.collection(EV).doc(d.event_id).get();
  const ev = evSnap.exists ? evSnap.data() : null;
  const idx = ev && ev.uid === d.owner_uid ? citadas(ev, actor.uid) : [];
  const batch = ctx.db.batch();
  if (!ev || !idx.length) {
    // O registro mudou e a pessoa não está mais nele: o pedido não tem mais sentido.
    await apagarPedido(ctx, batch, ref, d);
    await batch.commit();
    falha('failed-precondition', 'O registro mudou e você não está mais como dupla nele.');
  }
  const fp = P.careerFingerprint(ev, idx);
  // A resposta vale para o que a pessoa VIU: a tela nova manda a impressão que leu,
  // e, se o registro mudou no meio, ela confere de novo. Tela antiga (sem o campo) segue como antes.
  if (typeof data.fingerprint === 'string' && data.fingerprint !== fp) {
    // Grava o estado de agora: sem isso, pedido aberto com impressão antiga recusaria para sempre.
    if (d.fingerprint !== fp) await ref.update({ fingerprint: fp, entry_indexes: idx, summary: resumo(ev, idx) });
    falha('failed-precondition', 'O registro mudou. Confira de novo antes de responder.');
  }
  if (answer === 'confirm') await exigeAdulto(ctx, actor.uid, 'Menores de 18 anos não confirmam dupla.');
  const status = answer === 'confirm' ? P.PARTNER_STATUS.CONFIRMED : P.PARTNER_STATUS.DECLINED;
  batch.update(ref, {
    status, fingerprint: fp, entry_indexes: idx, summary: resumo(ev, idx), answered_at_ms: ctx.now,
  });
  aviso(ctx, batch, d.owner_uid, {
    title: answer === 'confirm'
      ? tx('{nome} confirmou o torneio', { nome: d.partner_name || 'Sua dupla' })
      : tx('{nome} não confirmou o torneio', { nome: d.partner_name || 'Sua dupla' }),
    message: texto(ev.name, 120),
    link: linkDoEvento(d.event_id),
  });
  auditoria(ctx, batch, actor, answer === 'confirm' ? 'career_partner_confirmed' : 'career_partner_declined', { doc_id: id, event_id: d.event_id, user_id: d.owner_uid });
  await batch.commit();
  return { id, status };
}

async function feedback(ctx, actor, data) {
  await exigeFlag(ctx);
  const { ref, id, d } = await pedido(ctx, data.docId, actor);
  if (d.partner_uid !== actor.uid) falha('permission-denied', 'Só a dupla deixa a visão dela.');
  if (d.status !== P.PARTNER_STATUS.CONFIRMED) falha('failed-precondition', 'Confirme o torneio antes de deixar a sua visão.');
  if (d.feedback && d.owner_decision && d.owner_decision !== P.OWNER_DECISION.PENDING) {
    falha('failed-precondition', 'A sua dupla já decidiu sobre esta visão. Você pode retirá-la.');
  }
  const reps = await Promise.all(['owner', 'partner'].map((papel) => ctx.db.collection(REP).doc(reportId(id, papel)).get()));
  // Denúncia em análise: editar não pode tirar a visão da fila da moderação.
  if (reps[0].exists && reps[0].data().open === true) falha('failed-precondition', 'Esta visão está em análise pela moderação. Você pode retirá-la.');
  // A moderação retirou a visão: escrever de novo não desfaz a decisão.
  if (reps.some((r) => decisaoDe(r) === 'remove_feedback')) falha('failed-precondition', 'A moderação retirou a sua visão neste torneio.');
  await exigeAdulto(ctx, actor.uid, 'Menores de 18 anos não deixam visão de dupla.');
  const { valid, error, value } = P.normalizePartnerFeedback(data.feedback || {});
  if (!valid) falha('invalid-argument', error);
  const batch = ctx.db.batch();
  // O aviso "a visão chegou" sai UMA vez por pedido: retirar e mandar de novo não repete.
  const avisar = !d.feedback && !d.feedback_notified_at_ms;
  batch.update(ref, {
    feedback: { ...value, edited_at_ms: ctx.now }, owner_decision: P.OWNER_DECISION.PENDING,
    ...(avisar ? { feedback_notified_at_ms: ctx.now } : {}),
  });
  if (avisar) {
    aviso(ctx, batch, d.owner_uid, {
      title: tx('A visão da sua dupla chegou'),
      message: tx('{nome} comentou o {torneio}.', { nome: d.partner_name || 'Sua dupla', torneio: texto(d.summary && d.summary.name, 120) }),
      link: linkDoEvento(d.event_id),
    });
  }
  auditoria(ctx, batch, actor, 'career_partner_feedback', { doc_id: id, event_id: d.event_id, user_id: d.owner_uid, edited: Boolean(d.feedback) });
  await batch.commit();
  return { id };
}

async function decide(ctx, actor, data) {
  await exigeFlag(ctx);
  const { ref, id, d } = await pedido(ctx, data.docId, actor);
  if (d.owner_uid !== actor.uid) falha('permission-denied', 'Só quem registrou o torneio decide.');
  if (!d.feedback) falha('failed-precondition', 'Não há visão da dupla para decidir.');
  const decision = [P.OWNER_DECISION.USE, P.OWNER_DECISION.KEEP].includes(data.decision) ? data.decision : '';
  if (!decision) falha('invalid-argument', 'Escolha "Usar no meu treino" ou "Guardar".');
  const batch = ctx.db.batch();
  batch.update(ref, { owner_decision: decision, decided_at_ms: ctx.now });
  auditoria(ctx, batch, actor, 'career_partner_decided', { doc_id: id, event_id: d.event_id, decision });
  await batch.commit();
  return { id, decision };
}

/** O dono apaga o pedido inteiro; a dupla retira a visão — ou, sem visão, desfaz a confirmação. */
async function remove(ctx, actor, data) {
  const { ref, id, d } = await pedido(ctx, data.docId, actor);
  const batch = ctx.db.batch();
  if (d.owner_uid === actor.uid) {
    // Quem foi denunciado não tira o pedido da fila da moderação apagando-o.
    if (await denunciaAberta(ctx, id, 'partner')) falha('failed-precondition', EM_ANALISE);
    await apagarPedido(ctx, batch, ref, d);
    auditoria(ctx, batch, actor, 'career_partner_removed', { doc_id: id, event_id: d.event_id, by: 'owner' });
  } else if (d.partner_uid === actor.uid) {
    if (d.feedback) {
      batch.update(ref, { feedback: null, owner_decision: null });
      auditoria(ctx, batch, actor, 'career_partner_feedback_withdrawn', { doc_id: id, event_id: d.event_id });
    } else {
      // Só há o que desfazer depois de confirmar; pedido aberto ou recusado se responde.
      if (d.status !== P.PARTNER_STATUS.CONFIRMED) falha('failed-precondition', 'Não há confirmação para desfazer. Responda ao pedido.');
      if (await denunciaAberta(ctx, id, 'owner')) falha('failed-precondition', EM_ANALISE);
      // Desfazer NÃO é "não foi assim": o pedido some e quem registrou é avisado.
      await apagarPedido(ctx, batch, ref, d);
      aviso(ctx, batch, d.owner_uid, {
        title: tx('{nome} desfez a confirmação', { nome: d.partner_name || 'Sua dupla' }),
        message: texto(d.summary && d.summary.name, 120),
        link: linkDoEvento(d.event_id),
      });
      auditoria(ctx, batch, actor, 'career_partner_undone', { doc_id: id, event_id: d.event_id, user_id: d.owner_uid });
    }
  } else {
    falha('permission-denied', 'Este pedido não é seu.');
  }
  await batch.commit();
  return { id };
}

async function report(ctx, actor, data) {
  const { id, d } = await pedido(ctx, data.docId, actor);
  const papel = d.owner_uid === actor.uid ? 'owner' : d.partner_uid === actor.uid ? 'partner' : '';
  if (!papel) falha('permission-denied', 'Este pedido não é seu.');
  if (!P.PARTNER_REPORT_REASONS.includes(data.reason)) falha('invalid-argument', 'Escolha o motivo da denúncia.');
  const versao = (d.feedback && d.feedback.edited_at_ms) || 0;
  const repRef = ctx.db.collection(REP).doc(reportId(id, papel));
  const antes = await repRef.get();
  // Uma denúncia por lado: aberta, ou já decidida sobre ESTA mesma versão da visão, não abre outra.
  // A que guarda uma retirada da moderação também fica: reescrevê-la apagaria a marca da decisão.
  if (antes.exists && (antes.data().open === true || (antes.data().feedback_edited_at_ms === versao && (antes.data().invited_at_ms || 0) === (d.invited_at_ms || 0))
    || ['remove_feedback', 'remove_link'].includes(decisaoDe(antes)))) return { id, reported: true };
  const batch = ctx.db.batch();
  batch.set(repRef, {
    doc_id: id, event_id: d.event_id, owner_uid: d.owner_uid, partner_uid: d.partner_uid, reporter_uid: actor.uid, role: papel,
    reason: data.reason, note: texto(data.note, P.PARTNER_LIMITS.reason), feedback_edited_at_ms: versao, invited_at_ms: d.invited_at_ms || 0,
    open: true, created_at_ms: ctx.now, moderation: null,
    // Cópia mínima para a fila do admin seguir decidindo se o pedido sumir (registro apagado).
    owner_name: d.owner_name || '', partner_name: d.partner_name || '', event_name: campo(d.summary && d.summary.name, 120),
  });
  auditoria(ctx, batch, actor, 'career_partner_reported', { doc_id: id, event_id: d.event_id, reason: data.reason, by: papel });
  await batch.commit();
  return { id, reported: true };
}

const DECISOES = ['dismiss', 'remove_feedback', 'remove_link'];

async function moderate(ctx, actor, data) {
  if (!actor.isPlatformAdmin) falha('permission-denied', 'Só a administração da plataforma decide denúncias.');
  const id = texto(data.docId, 400);
  if (!id || id.includes('/')) falha('invalid-argument', 'Pedido não informado.');
  const ref = ctx.db.collection(COL).doc(id);
  const [snap, ...repSnaps] = await Promise.all([
    ref.get(), ...['owner', 'partner'].map((papel) => ctx.db.collection(REP).doc(reportId(id, papel)).get()),
  ]);
  const reps = repSnaps.filter((r) => r.exists && r.data().open === true);
  // O pedido pode ter sumido com a denúncia aberta (registro apagado): decide-se pela denúncia.
  const r0 = reps.length ? reps[0].data() : null;
  const d = snap.exists ? snap.data()
    : r0 ? { event_id: r0.event_id, owner_uid: r0.owner_uid, partner_uid: r0.partner_uid, summary: { name: r0.event_name || '' }, feedback: null } : null;
  if (!d) {
    // Segundo toque do admin (a fila da tela estava velha): o pedido já saiu e a denúncia
    // já foi decidida — devolve a decisão que vale, sem gravar nem avisar de novo.
    const decidida = repSnaps.map(decisaoDe).find(Boolean);
    if (decidida) return { id, decision: decidida, already: true };
    falha('not-found', PEDIDO_SUMIU);
  }
  const decision = DECISOES.includes(data.decision) ? data.decision : '';
  if (!decision) falha('invalid-argument', 'Decisão inválida.');
  const motivo = texto(data.reason, P.PARTNER_LIMITS.reason);
  if (motivo.length < 5) falha('invalid-argument', 'Escreva o motivo da decisão (pelo menos 5 letras).');
  if (decision === 'remove_feedback' && !d.feedback) falha('failed-precondition', 'Não há visão para retirar.');
  const torneio = texto(d.summary && d.summary.name, 120);
  // A decisão fica nas DENÚNCIAS (só o servidor e quem denunciou leem), nunca no
  // pedido que as duas pontas leem; o uid do admin vai só para a auditoria.
  const moderation = { decision, reason: motivo, at_ms: ctx.now };
  const reportReason = r0 ? r0.reason : null;
  const batch = ctx.db.batch();
  reps.forEach((r) => batch.update(r.ref, { open: false, moderation }));
  // A marca da decisão fica do lado de quem ela protege, mesmo sem denúncia aberta ali:
  // é ela que impede escrever a visão de novo (owner) ou pedir de novo (partner).
  const marcar = (papel) => {
    if (reps.some((r) => r.id === reportId(id, papel))) return;
    const antes = repSnaps[papel === 'owner' ? 0 : 1];
    batch.set(ctx.db.collection(REP).doc(reportId(id, papel)), {
      doc_id: id, event_id: d.event_id, owner_uid: d.owner_uid, partner_uid: d.partner_uid, reporter_uid: null, role: papel,
      reason: null, note: '', feedback_edited_at_ms: 0, created_at_ms: ctx.now,
      ...(antes.exists ? antes.data() : {}), open: false, moderation,
    });
  };
  if (decision === 'remove_feedback') {
    batch.update(ref, { feedback: null, owner_decision: null });
    marcar('owner');
    aviso(ctx, batch, d.partner_uid, {
      title: tx('Sua visão foi retirada pela moderação'),
      message: tx('{torneio}. Motivo: {motivo}', { torneio, motivo }),
      link: '/carreira',
    });
  } else if (decision === 'remove_link') {
    // O pedido some, mas a denúncia decidida fica: é ela que impede pedir de novo.
    if (snap.exists) batch.delete(ref);
    await soltarEspelho(ctx, batch, d);
    marcar('partner');
    aviso(ctx, batch, d.owner_uid, {
      title: tx('O pedido de confirmação foi retirado pela moderação'),
      message: tx('{torneio}. Motivo: {motivo}', { torneio, motivo }),
      link: linkDoEvento(d.event_id),
    });
  }
  auditoria(ctx, batch, actor, 'career_partner_moderated', {
    doc_id: id, event_id: d.event_id, decision, reason: motivo, report_reason: reportReason,
    user_id: decision === 'remove_link' ? d.owner_uid : d.partner_uid,
  });
  await batch.commit();
  return { id, decision };
}

/** As denúncias abertas, para a fila do admin (só o necessário para decidir). */
async function queue(ctx, actor) {
  if (!actor.isPlatformAdmin) falha('permission-denied', 'Só a administração da plataforma vê as denúncias.');
  const snap = await ctx.db.collection(REP).where('open', '==', true).limit(100).get();
  const porPedido = new Map();
  snap.docs.forEach((r) => { const x = r.data(); if (!porPedido.has(x.doc_id)) porPedido.set(x.doc_id, x); });
  const itens = await Promise.all([...porPedido.values()].map(async (r) => {
    const p = await ctx.db.collection(COL).doc(r.doc_id).get();
    // O pedido sumiu (registro apagado): a denúncia segue na fila, com o que ela mesma guardou.
    const d = p.exists ? p.data() : {
      owner_name: r.owner_name, partner_name: r.partner_name, summary: r.event_name ? { name: r.event_name } : null, status: 'removed',
    };
    return {
      id: r.doc_id,
      owner_name: d.owner_name || '',
      partner_name: d.partner_name || '',
      summary: d.summary || null,
      status: d.status,
      feedback: d.feedback || null,
      report_reason: r.reason || '',
      report_note: r.note || '',
      reported_by: r.role || '',
      reported_at_ms: r.created_at_ms || 0,
    };
  }));
  return { items: itens.filter(Boolean).sort((a, b) => a.reported_at_ms - b.reported_at_ms) };
}

/* ------------------------------------ dupla SEM conta: o convite (PR 6) -- */

/**
 * `career_partner_invites/{sha256(token)}`: o token NUNCA é guardado — o id é
 * o hash dele. Nenhum telefone: o WhatsApp é aberto no aparelho do dono, que
 * escolhe o contato. Uso único: aceito ou cancelado, o documento some.
 */
const INV = 'career_partner_invites';
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const tokenOk = (token) => typeof token === 'string' && new RegExp(P.INVITE_TOKEN_PATTERN).test(token);
/** A MESMA resposta para usado, vencido, cancelado, inexistente, menor e dupla já preenchida. */
const CONVITE_NEUTRO = 'Este convite não vale mais. Peça um link novo a quem convidou.';

/** O dono gera (ou troca) o link de convite de uma dupla digitada só com o nome. */
async function inviteLink(ctx, actor, data) {
  await exigeFlag(ctx);
  const eventId = texto(data.eventId, 200);
  const key = P.partnerNameKey(texto(data.partnerName, 120));
  if (!eventId || !key) falha('invalid-argument', 'Escolha o torneio e a dupla.');
  const evSnap = await ctx.db.collection(EV).doc(eventId).get();
  if (!evSnap.exists || evSnap.data().uid !== actor.uid) falha('permission-denied', 'Este torneio não é seu.');
  const ev = evSnap.data();
  if (!ev.start_date || ev.start_date > hojeBR(ctx.now) || ev.status === 'cancelled') falha('failed-precondition', 'Só dá para convidar a dupla de torneio já jogado.');
  const alvo = P.namedPartners(ev).find((p) => p.key === key);
  if (!alvo) falha('failed-precondition', 'Esta dupla não está mais só com o nome neste torneio (pode já ter entrado com a conta). Abra a ficha de novo.');
  const eu = await exigeAdulto(ctx, actor.uid, 'Menores de 18 anos não convidam a dupla.');
  // Um convite por (torneio, nome): gerar de novo derruba o link anterior.
  const antigos = await ctx.db.collection(INV).where('event_id', '==', eventId).get();
  const token = crypto.randomBytes(24).toString('base64url');
  const id = hashToken(token);
  const expires = ctx.now + P.INVITE_TTL_DAYS * DIA_MS;
  // Sai também o que já venceu neste torneio (guarda o nome de um terceiro sem conta).
  const doNome = antigos.docs.filter((d) => d.data().owner_uid === actor.uid
    && (d.data().name_key === key || !(Number(d.data().expires_at_ms) > ctx.now)));
  const batch = ctx.db.batch();
  doNome.forEach((d) => batch.delete(d.ref));
  batch.set(ctx.db.collection(INV).doc(id), {
    owner_uid: actor.uid,
    event_id: eventId,
    name_key: key,
    partner_name: texto(alvo.name, 80),
    owner_name: nomeDe(eu),
    event_name: texto(ev.name, 120),
    created_at_ms: ctx.now,
    expires_at_ms: expires,
  });
  auditoria(ctx, batch, actor, 'career_partner_link_created', { event_id: eventId, renewed: doNome.length > 0 });
  await batch.commit();
  return { id, token, expires_at_ms: expires };
}

/** O dono cancela: o link para de valer na hora. */
async function inviteCancel(ctx, actor, data) {
  const id = texto(data.id, 64);
  if (!/^[a-f0-9]{64}$/.test(id)) falha('invalid-argument', 'Convite inválido.');
  const ref = ctx.db.collection(INV).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { id };
  if (snap.data().owner_uid !== actor.uid) falha('permission-denied', 'Este convite não é seu.');
  const batch = ctx.db.batch();
  batch.delete(ref);
  auditoria(ctx, batch, actor, 'career_partner_link_cancelled', { event_id: snap.data().event_id });
  await batch.commit();
  return { id };
}

/**
 * O convite ainda vale para quem abriu? Devolve a dupla digitada a preencher,
 * ou `null` (o motivo nunca sai daqui: a resposta é a mesma para todos).
 */
function conviteVale(ctx, inv, ev, eu, rep) {
  if (!inv || !(Number(inv.expires_at_ms) > ctx.now)) return null;
  if (!ev || ev.uid !== inv.owner_uid || ev.status === 'cancelled') return null;
  // Como no `invite`: só torneio já jogado (a data pode ter mudado depois do link).
  if (!ev.start_date || ev.start_date > hojeBR(ctx.now)) return null;
  if (!eu || !P.isAdult(eu.birth_date, hojeBR(ctx.now))) return null;
  // A moderação retirou o pedido desta pessoa neste torneio: o link não o desfaz.
  if (rep && rep.exists && rep.data().moderation && rep.data().moderation.decision === 'remove_link') return null;
  // Só preenche o que está VAZIO: dupla que já tem conta não é trocada.
  return P.namedPartners(ev).find((p) => p.key === inv.name_key) || null;
}

/** Quem abriu o link vê de quem é o convite antes de aceitar (nada é gravado). */
async function invitePeek(ctx, actor, data) {
  await exigeFlag(ctx);
  if (!tokenOk(data.token)) return { valid: false };
  const inv = await ctx.db.collection(INV).doc(hashToken(data.token)).get();
  if (!inv.exists) return { valid: false };
  const d = inv.data();
  if (d.owner_uid === actor.uid) return { valid: false, own: true };
  const repRef = ctx.db.collection(REP).doc(reportId(P.partnerDocId(d.event_id, actor.uid), 'partner'));
  const [evSnap, eu, rep] = await Promise.all([ctx.db.collection(EV).doc(d.event_id).get(), usuario(ctx, actor.uid), repRef.get()]);
  const ev = evSnap.exists ? evSnap.data() : null;
  if (!conviteVale(ctx, d, ev, eu, rep)) return { valid: false };
  return {
    valid: true,
    owner_name: d.owner_name || '',
    partner_name: d.partner_name || '',
    event_name: texto(ev.name, 120),
    start_date: texto(ev.start_date, 10),
    date_precision: ev.date_precision === 'year' ? 'year' : 'day',
  };
}

/**
 * Quem abriu o link aceita: numa transação, confere o convite, preenche a
 * dupla VAZIA do registro com a conta, consome o convite e abre o pedido de
 * confirmação do PR 3 (a pessoa confirma em seguida, na tela de sempre).
 */
async function inviteAccept(ctx, actor, data) {
  await exigeFlag(ctx);
  if (!tokenOk(data.token)) falha('failed-precondition', CONVITE_NEUTRO);
  const invRef = ctx.db.collection(INV).doc(hashToken(data.token));
  return ctx.db.runTransaction(async (tr) => {
    const invSnap = await tr.get(invRef);
    if (!invSnap.exists) falha('failed-precondition', CONVITE_NEUTRO);
    const inv = invSnap.data();
    if (inv.owner_uid === actor.uid) falha('failed-precondition', 'Este convite é seu: mande o link para a sua dupla.');
    const evRef = ctx.db.collection(EV).doc(inv.event_id);
    const pedidoRef = ctx.db.collection(COL).doc(P.partnerDocId(inv.event_id, actor.uid));
    const [evSnap, euSnap, pedidoSnap, repSnap] = await Promise.all([
      tr.get(evRef), tr.get(ctx.db.collection('users').doc(actor.uid)), tr.get(pedidoRef),
      tr.get(ctx.db.collection(REP).doc(reportId(pedidoRef.id, 'partner'))),
    ]);
    const ev = evSnap.exists ? evSnap.data() : null;
    const eu = euSnap.exists ? euSnap.data() : null;
    const alvo = conviteVale(ctx, inv, ev, eu, repSnap);
    // Menor, vencido, dupla já preenchida, registro apagado: a mesma resposta, nada gravado.
    if (!alvo) falha('failed-precondition', CONVITE_NEUTRO);

    const entries = ev.entries.map((e, i) => (alvo.indexes.includes(i) ? { ...e, partner: { uid: actor.uid, name: e.partner.name } } : e));
    const novo = { ...ev, entries };
    const partnerUids = [...new Set([...(Array.isArray(ev.partner_uids) ? ev.partner_uids : []), actor.uid])];
    const idx = citadas(novo, actor.uid);
    // Ficha fora do que a tela grava: o convite não vale (nada dela vai para o pedido).
    if (!idx.length) falha('failed-precondition', CONVITE_NEUTRO);
    tr.update(evRef, { entries, partner_uids: partnerUids, updated_at_ms: ctx.now });
    tr.delete(invRef);
    if (!pedidoSnap.exists) {
      tr.set(pedidoRef, {
        owner_uid: inv.owner_uid,
        partner_uid: actor.uid,
        event_id: inv.event_id,
        owner_name: inv.owner_name || 'Atleta',
        partner_name: nomeDe(eu),
        entry_indexes: idx,
        summary: resumo(novo, idx),
        status: P.PARTNER_STATUS.INVITED,
        fingerprint: P.careerFingerprint(novo, idx),
        feedback: null,
        owner_decision: null,
        partner_event_id: null,
        invited_at_ms: ctx.now,
        answered_at_ms: null,
        via_link: true,
      });
    }
    aviso(ctx, tr, inv.owner_uid, {
      title: tx('{nome} aceitou o seu convite', { nome: nomeDe(eu) }),
      message: tx('A conta de {nome} entrou no {torneio} e agora pode confirmar o resultado.', { nome: nomeDe(eu), torneio: texto(ev.name, 120) }),
      link: linkDoEvento(inv.event_id),
    });
    auditoria(ctx, tr, actor, 'career_partner_link_accepted', { doc_id: pedidoRef.id, event_id: inv.event_id, user_id: inv.owner_uid });
    return { docId: pedidoRef.id };
  });
}

const ACOES = {
  invite, respond, feedback, decide, remove, report, moderate, queue,
  invite_link: inviteLink, invite_cancel: inviteCancel, invite_peek: invitePeek, invite_accept: inviteAccept,
};

async function career(ctx, actor, data = {}) {
  const fn = (Object.hasOwn(ACOES, data.action) ? ACOES[data.action] : undefined);
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  return fn(ctx, actor, data);
}

/* ------------------------------------------------------------ gatilho -- */

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const idOk = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200 && !v.includes('/');
const linkDe = (ev) => (ev && ev.linked_event && idOk(ev.linked_event.uid) && idOk(ev.linked_event.id) ? ev.linked_event : null);

/**
 * `career_events/{id}` mudou. Idempotente: só escreve o que mudou (a escrita
 * que desfaz um `linked_event` forjado dispara o gatilho de novo e termina aí).
 */
async function eventWritten(ctx, eventId, before) {
  const { db } = ctx;
  const batch = db.batch();
  let escritas = 0;
  // O gatilho pode chegar atrasado ou fora de ordem: vale o registro de AGORA, não o
  // `after` do evento (um `after` velho reabriria a confirmação ou apagaria um pedido novo).
  const [agora, pedidos] = await Promise.all([
    db.collection(EV).doc(eventId).get(), db.collection(COL).where('event_id', '==', eventId).get(),
  ]);
  const after = agora.exists ? agora.data() : null;

  if (!after) {
    pedidos.docs.forEach((doc) => { batch.delete(doc.ref); escritas += 1; });
    // A denúncia ABERTA e a DECIDIDA ficam (fila do admin; marca da decisão). Sai só o resto.
    const reps = await db.collection(REP).where('event_id', '==', eventId).get();
    reps.docs.filter((doc) => doc.data().open !== true && !doc.data().moderation)
      .forEach((doc) => { batch.delete(doc.ref); escritas += 1; });
    // Quem tinha posto este torneio na carreira dele também: o vínculo some dos dois lados.
    const espelhos = await db.collection(EV).where('linked_event.id', '==', eventId).get();
    espelhos.docs.forEach((doc) => { batch.update(doc.ref, { linked_event: null }); escritas += 1; });
    // Os convites pelo WhatsApp deste registro param de valer (PR 6).
    const convites = await db.collection(INV).where('event_id', '==', eventId).get();
    convites.docs.forEach((doc) => { batch.delete(doc.ref); escritas += 1; });
    // O balanço do torneio: a tela o apaga depois do registro, e a aba que fecha no
    // meio o deixava órfão (pesando no foco das semanas). Só o do próprio dono.
    const dono = before && typeof before.uid === 'string' ? before.uid : '';
    if (dono && eventId.startsWith(`${dono}_`)) {
      const bal = await db.collection('training_debriefs').doc(`${dono}_externo_${eventId}`).get();
      if (bal.exists && bal.data().uid === dono) { batch.delete(bal.ref); escritas += 1; }
    }
  } else {
    for (const doc of pedidos.docs) {
      const d = doc.data();
      const idx = d.owner_uid === after.uid ? citadas(after, d.partner_uid) : [];
      if (!idx.length) { await apagarPedido(ctx, batch, doc.ref, d); escritas += 1; continue; }
      const patch = {};
      const sm = resumo(after, idx);
      const fp = P.careerFingerprint(after, idx);
      if (!igual(sm, d.summary)) patch.summary = sm;
      if (!igual(idx, d.entry_indexes)) patch.entry_indexes = idx;
      // Pedido ainda aberto: a impressão acompanha o registro (é ela que a resposta confere).
      if (ABERTOS.includes(d.status) && fp !== d.fingerprint) patch.fingerprint = fp;
      if (d.status === P.PARTNER_STATUS.CONFIRMED && fp !== d.fingerprint) {
        patch.status = P.PARTNER_STATUS.RECONFIRM;
        patch.fingerprint = fp;
        aviso(ctx, batch, d.partner_uid, {
          title: tx('Confirme de novo: {torneio}', { torneio: sm.name }),
          message: tx('{nome} mudou a data, a categoria ou a colocação. Confira e confirme.', { nome: d.owner_name || 'Sua dupla' }),
          link: linkDoPedido(doc.id),
        });
        escritas += 1;
      }
      if (Object.keys(patch).length) { batch.update(doc.ref, patch); escritas += 1; }
    }
  }

  // "Pôr na minha carreira também": confere o vínculo e liga as duas fichas.
  const antesLink = linkDe(before);
  const depoisLink = linkDe(after);
  if (antesLink && before.uid && (!depoisLink || antesLink.id !== depoisLink.id)) {
    const velho = await db.collection(COL).doc(P.partnerDocId(antesLink.id, before.uid)).get();
    if (velho.exists && velho.data().partner_event_id === eventId) { batch.update(velho.ref, { partner_event_id: null }); escritas += 1; }
  }
  if (depoisLink && (!antesLink || antesLink.id !== depoisLink.id)) {
    const alvo = await db.collection(COL).doc(P.partnerDocId(depoisLink.id, after.uid)).get();
    const ok = alvo.exists && alvo.data().owner_uid === depoisLink.uid && alvo.data().partner_uid === after.uid
      && alvo.data().status === P.PARTNER_STATUS.CONFIRMED;
    if (ok) batch.update(alvo.ref, { partner_event_id: eventId });
    else batch.update(db.collection(EV).doc(eventId), { linked_event: null });
    escritas += 1;
  }

  if (escritas) await batch.commit();
  return { escritas };
}

/* ---------------------------------------------- lembretes do planejado -- */

const somaDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/**
 * Varredura diária (`careerReminders`): D-3 do prazo de inscrição de quem
 * ainda não marcou "Já me inscrevi", e D+1 do torneio PLANEJADO ("Como foi?").
 * Uma igualdade por consulta (zero índice); o resto em memória. Id do aviso
 * DETERMINÍSTICO: rodar de novo no mesmo dia não repete o aviso.
 */
const registrar = (ctx, msg, err) => { if (ctx.logger && ctx.logger.error) ctx.logger.error(msg, err); };

/** Convite pelo WhatsApp vencido some (guarda o nome de um terceiro sem conta). Vale com a flag desligada. */
async function limparConvitesVencidos(ctx) {
  try {
    // ponytail: 400 por dia; paginar se a fila de vencidos passar disso.
    const velhos = await ctx.db.collection(INV).where('expires_at_ms', '<', ctx.now).limit(400).get();
    if (!velhos.docs.length) return 0;
    const batch = ctx.db.batch();
    velhos.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    return velhos.docs.length;
  } catch (err) {
    registrar(ctx, 'careerReminders: convites vencidos', err);
    return 0;
  }
}

async function reminders(ctx) {
  const convites = await limparConvitesVencidos(ctx);
  if (!(await flagLigada(ctx))) return { avisos: 0, convites, desligada: true };
  const { db } = ctx;
  const hoje = hojeBR(ctx.now);
  // D+1 com 3 dias de folga: a varredura que falhou num dia alcança no seguinte
  // (o id determinístico não deixa repetir). O prazo fica no dia exato: o título diz "em 3 dias".
  const passados = [-1, -2, -3].map((n) => somaDias(hoje, n));
  const [prazo, fimOntem, inicioOntem] = await Promise.all([
    db.collection(EV).where('registration_deadline', '==', somaDias(hoje, 3)).get(),
    db.collection(EV).where('end_date', 'in', passados).get(),
    db.collection(EV).where('start_date', 'in', passados).get(),
  ]);
  // Id fora do que a tela gera não entra: o id do aviso derivado estouraria e derrubaria o lote inteiro.
  const planejado = (d, doc) => d.status === 'planned' && d.uid && doc.id.length <= 200 && !doc.id.includes('/');
  const fila = [];
  prazo.docs.forEach((doc) => {
    const d = doc.data();
    if (!planejado(d, doc) || d.registered === true) return;
    fila.push({
      id: `carreira_prazo_${doc.id}_${d.registration_deadline}`, uid: d.uid,
      title: tx('A inscrição fecha em 3 dias'),
      message: tx('{torneio}: se ainda vai jogar, garanta a inscrição.', { torneio: texto(d.name, 120) }),
      link: `/carreira?aba=proximos&evento=${encodeURIComponent(doc.id)}`,
    });
  });
  const vistos = new Set();
  [...fimOntem.docs, ...inicioOntem.docs.filter((doc) => !doc.data().end_date)].forEach((doc) => {
    const d = doc.data();
    // O plano de um torneio do PickleRush (`origin_ref: 'tor:…'`) não pergunta: vale o oficial.
    if (!planejado(d, doc) || vistos.has(doc.id) || String(d.origin_ref || '').startsWith('tor:')) return;
    vistos.add(doc.id);
    fila.push({
      id: `carreira_d1_${doc.id}`, uid: d.uid,
      title: tx('Como foi o {torneio}?', { torneio: texto(d.name, 120) }),
      message: d.focus_aspect
        ? tx('Conte o resultado e se o foco que você escolheu funcionou.')
        : tx('Conte o resultado: a carreira guarda o que você jogou.'),
      link: linkDoEvento(doc.id),
    });
  });
  let avisos = 0;
  for (let i = 0; i < fila.length; i += 200) {
    const lote = fila.slice(i, i + 200);
    // Uma leitura que falha pula só aquele aviso (a próxima varredura o alcança).
    const existe = await Promise.allSettled(lote.map((a) => db.collection('notifications').doc(a.id).get()));
    const batch = db.batch();
    let n = 0;
    lote.forEach((a, j) => {
      if (existe[j].status !== 'fulfilled' || existe[j].value.exists) return;
      const i18n = i18nDoAviso({ title: a.title, message: a.message });
      batch.set(db.collection('notifications').doc(a.id), {
        user_id: a.uid, title: textoDoAviso(a.title), message: textoDoAviso(a.message), ...(i18n ? { i18n } : {}),
        type: 'career', link: P.linkDeAviso(a.link), read: false, archived: false, origin: 'server',
        created_at: ctx.Timestamp.fromMillis(ctx.now),
      });
      n += 1;
    });
    // Um lote que falha não derruba os seguintes.
    try {
      if (n) await batch.commit();
      avisos += n;
    } catch (err) {
      registrar(ctx, 'careerReminders: lote de avisos', err);
    }
  }
  return { avisos, convites };
}

module.exports = { career, eventWritten, reminders, ACOES };
