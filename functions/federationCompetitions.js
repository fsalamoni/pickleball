/**
 * COMPETIÇÕES da federação no servidor (Bloco 2, `docs/50` §31).
 *
 * `onTournamentWritten` (gatilho em `tournaments/{id}`): o pedido de chancela
 * NOVO é conferido uma vez (`federation_sanction.checked_at_ms` =
 * `requested_at_ms`):
 *  - antecedência mínima (`rules.sanction_min_days`) e data de início — fora
 *    do prazo, o pedido é recusado sozinho, com o motivo;
 *  - diretor credenciado (`rules.sanction_requires_director`): o código da
 *    credencial (`director_code`) tem de ser de uma credencial ATIVA de
 *    diretor de torneio DESTA federação — senão, recusado;
 *  - taxa da categoria (`ranking_config.tiers[].sanction_fee_cents`): cria a
 *    cobrança Pix (`origin: 'sanction'`) para quem pediu.
 *  A equipe de competições/admin da própria federação não passa por prazo
 *  nem taxa (é o torneio da federação). Pedido retirado ou recusado cancela a
 *  taxa ainda aberta. Chancela aprovada cria o relatório do torneio
 *  (`federation_tournament_reports/{id}`) e avisa o diretor.
 *
 * `competition` (callable `federationCompetition`): o diretor (ou quem
 * organiza) grava o checklist antes do evento e o relatório depois; a equipe
 * de competições convida os melhores do ranking do ano para a final
 * (`federation_final_invites`), o atleta aceita ou recusa, e quem recusa, não
 * responde no prazo (varredura) ou é cancelado dá a vaga ao próximo.
 *
 * A conta pura é `federationCompetitionsPolicy.js` (cópia de
 * `src/modules/federations/domain/competitions.js`, com paridade).
 */
const P = require('./federationCompetitionsPolicy.js');
const m = require('./federationMembership.js');
const f = require('./federations.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const REPORTS = 'federation_tournament_reports';
const INVITES = 'federation_final_invites';
const DIA = 86400000;
const LINK_MEU = '/perfil?secao=federacoes';
const linkGestao = (tid) => `/torneios/${tid}/gerenciar`;
const LINK_CHANCELAS = (fedId) => `/federacoes/${fedId}/gerir?aba=chancelas`;
const sigla = (fed) => fed.acronym || fed.name || '';
const br = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? iso.split('-').reverse().join('/') : '');
const reais = (c) => `R$ ${(Math.trunc(Number(c) || 0) / 100).toFixed(2).replace('.', ',')}`;

/* ------------------------------------------------------ o pedido de chancela -- */

/** A credencial de diretor por trás do código digitado (ativa, desta federação), ou null. */
async function diretorPeloCodigo(ctx, fedId, codigo, hoje) {
  const code = P.normalizeDirectorCode(codigo);
  if (code.length < 6) return null;
  const idx = await ctx.db.collection(f.C.cardIndex).doc(code).get();
  if (!idx.exists || idx.data().kind !== 'credential' || idx.data().federation_id !== fedId) return null;
  const cred = await ctx.db.collection(f.C.credentials).doc(idx.data().credential_id).get();
  if (!cred.exists) return null;
  const c = cred.data();
  if (c.federation_id !== fedId || c.kind !== 'director' || c.status !== 'active' || (c.valid_until && c.valid_until < hoje)) return null;
  return { uid: c.user_id, name: texto(c.user_name, 120), credential_id: cred.id };
}

async function conferirPedido(ctx, tid, t) {
  const s = t.federation_sanction;
  const fedSnap = await ctx.db.collection(f.C.federations).doc(t.federation_id).get();
  if (!fedSnap.exists) return { skipped: 'federation' };
  const fed = { id: fedSnap.id, ...fedSnap.data() };
  const hoje = m.isoDateBR(ctx.now);
  const quem = s.requested_by;
  const perms = quem ? await f.staffPerms(ctx, fed.id, { uid: quem }) : [];
  const equipe = perms.includes('competitions') || perms.includes('admin');
  const rules = fed.rules || {};
  let recusa = '';
  let diretor = null;
  let timing = null;
  if (!equipe) {
    timing = P.sanctionTiming(rules, t.starts_at, hoje);
    if (timing.no_date) recusa = `A ${sigla(fed)} pede ${timing.min_days} dias de antecedência: marque a data de início do torneio e peça de novo.`;
    else if (timing.late) recusa = `A ${sigla(fed)} pede a chancela com pelo menos ${timing.min_days} dias de antecedência; o torneio começa em ${Math.max(0, timing.days_ahead)} dias.`;
  }
  if (!recusa && s.director_code) diretor = await diretorPeloCodigo(ctx, fed.id, s.director_code, hoje);
  if (!recusa && !equipe && rules.sanction_requires_director === true && !diretor) {
    recusa = `A ${sigla(fed)} exige um diretor de torneio credenciado: informe o código de uma credencial de diretor ativa da federação e peça de novo.`;
  }
  const fee = !recusa && !equipe ? P.tierFeeCents(fed, s.tier) : 0;
  // A taxa que já existe vale se cobre ESTE pedido: paga com valor suficiente, ou aberta com o mesmo
  // valor. Aberta com outro valor (o pedido mudou de categoria) é cancelada e sai uma nova.
  let cobrancaAberta = null;
  let obsoletas = [];
  if (!recusa) {
    const ja = await ctx.db.collection(f.C.charges).where('tournament_id', '==', tid).get();
    const daqui = ja.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() })).filter((c) => c.origin === 'sanction' && c.federation_id === fed.id);
    cobrancaAberta = fee > 0 ? daqui.find((c) => (c.status === 'paid' && c.amount_cents >= fee) || (['open', 'declared'].includes(c.status) && c.amount_cents === fee)) || null : null;
    obsoletas = daqui.filter((c) => ['open', 'declared'].includes(c.status) && (!cobrancaAberta || c.id !== cobrancaAberta.id));
  }

  const ref = ctx.db.collection('tournaments').doc(tid);
  const out = await ctx.db.runTransaction(async (tr) => {
    const atual = await tr.get(ref);
    const a = atual.exists ? atual.data() : null;
    const sa = a && a.federation_sanction;
    // Mudou no meio (aprovado, retirado, pedido de novo): este não é mais o pedido conferido.
    if (!a || a.federation_id !== fed.id || !sa || sa.status !== 'pending' || sa.requested_at_ms !== s.requested_at_ms) return { skipped: 'changed' };
    if (recusa) {
      tr.update(ref, {
        'federation_sanction.status': 'rejected', 'federation_sanction.reason': recusa, 'federation_sanction.decided_by': 'system',
        'federation_sanction.decided_at_ms': ctx.now, 'federation_sanction.checked_at_ms': s.requested_at_ms, updated_at: ctx.Timestamp.fromMillis(ctx.now),
      });
      return { rejected: true };
    }
    const patch = {
      'federation_sanction.checked_at_ms': s.requested_at_ms,
      'federation_sanction.director_uid': diretor ? diretor.uid : quem || null,
      'federation_sanction.director_name': diretor ? diretor.name : texto(s.requested_by_name, 120),
      'federation_sanction.director_credential_id': diretor ? diretor.credential_id : null,
      'federation_sanction.director_verified': Boolean(diretor),
      'federation_sanction.fee_cents': fee,
      updated_at: ctx.Timestamp.fromMillis(ctx.now),
    };
    if (timing) patch['federation_sanction.days_ahead'] = timing.days_ahead;
    obsoletas.forEach((c) => tr.update(c.ref, { status: 'cancelled', cancelled_at_ms: ctx.now, cancelled_by: 'system', cancel_note: 'Pedido de chancela refeito.' }));
    let charge = cobrancaAberta;
    if (charge && charge.status === 'paid') patch['federation_sanction.fee_paid_at_ms'] = charge.paid_at_ms || ctx.now;
    if (fee > 0 && !charge) {
      charge = f.novaCobranca(ctx, tr, {
        fed, member: { user_id: quem, user_name: texto(s.requested_by_name, 120) }, memberId: null, plan: null, origin: 'sanction', hoje, amount: fee,
        extra: { plan_name: `Chancela · ${texto(t.name, 100)}`, tournament_id: tid, tier: s.tier || null },
      });
    }
    if (charge) patch['federation_sanction.fee_charge_id'] = charge.id;
    tr.update(ref, patch);
    return { checked: true, charge: charge && !cobrancaAberta ? charge : null };
  });

  if (out.rejected || out.charge) {
    const batch = ctx.db.batch();
    if (out.rejected && quem) {
      f.aviso(ctx, batch, quem, { title: tx('Chancela da {sigla} recusada', { sigla: sigla(fed) }), message: tx('Motivo: {motivo}', { motivo: recusa }), link: linkGestao(tid) });
    }
    if (out.charge && quem) {
      f.aviso(ctx, batch, quem, { title: tx('Taxa de chancela da {sigla}: {valor}', { sigla: sigla(fed), valor: reais(fee) }), message: tx('Pague pelo Pix na gestão do torneio (Geral → Federação). A federação analisa o pedido depois do pagamento.'), link: linkGestao(tid) });
    }
    await batch.commit();
    await f.auditoria(ctx, { uid: 'system', name: 'Servidor' }, out.rejected ? 'tournament_sanction_auto_reject' : 'tournament_sanction_fee', { federation_id: fed.id, tournament_id: tid, reason: recusa || null, fee_cents: fee || 0, charge_id: out.charge ? out.charge.id : null });
  }
  return out;
}

/** Taxa ainda aberta de um pedido que saiu (retirado, recusado, outra federação) é cancelada. */
async function cancelarTaxa(ctx, fedId, tid, motivo) {
  const snap = await ctx.db.collection(f.C.charges).where('tournament_id', '==', tid).get();
  const abertas = snap.docs.filter((d) => d.data().origin === 'sanction' && d.data().federation_id === fedId && ['open', 'declared'].includes(d.data().status));
  if (!abertas.length) return 0;
  const batch = ctx.db.batch();
  abertas.forEach((d) => batch.update(d.ref, { status: 'cancelled', cancelled_at_ms: ctx.now, cancelled_by: 'system', cancel_note: motivo }));
  await batch.commit();
  return abertas.length;
}

/** Chancela aprovada: o relatório do torneio nasce (diretor e organizador o leem) e o diretor é avisado. */
async function abrirRelatorio(ctx, tid, t) {
  const ref = ctx.db.collection(REPORTS).doc(tid);
  const s = t.federation_sanction || {};
  const snap = await ref.get();
  const base = {
    federation_id: t.federation_id, tournament_id: tid, tournament_name: texto(t.name, 120), starts_at: String(t.starts_at || '').slice(0, 10), ends_at: String(t.ends_at || '').slice(0, 10),
    director_uid: s.director_uid || s.requested_by || t.creator_uid || null, director_name: texto(s.director_name, 120), director_verified: s.director_verified === true,
    organizer_uid: s.requested_by || t.creator_uid || null, updated_at_ms: ctx.now,
  };
  if (snap.exists) {
    await ref.update(base);
    return { created: false };
  }
  const batch = ctx.db.batch();
  batch.set(ref, { ...base, checklist: null, report: null, final: null, created_at_ms: ctx.now });
  if (base.director_uid && base.director_uid !== base.organizer_uid) {
    f.aviso(ctx, batch, base.director_uid, {
      title: tx('Você é o diretor do torneio {torneio}', { torneio: base.tournament_name }),
      message: tx('Antes do evento, faça o checklist; depois, entregue o relatório. Está em Minha área → Federações.'),
      link: LINK_MEU,
    });
  }
  await batch.commit();
  return { created: true };
}

async function onTournamentWritten(ctx, antes, depois, tid) {
  const sA = antes && antes.federation_id ? antes.federation_sanction || null : null;
  const sD = depois && depois.federation_id ? depois.federation_sanction || null : null;
  if (!(await f.flagLigada(ctx))) return { skipped: 'flag' };
  if (sD && sD.status === 'pending' && sD.requested_at_ms && sD.checked_at_ms !== sD.requested_at_ms) await conferirPedido(ctx, tid, depois);
  if (sD && sD.status === 'approved' && (!sA || sA.status !== 'approved' || sA.director_uid !== sD.director_uid)) await abrirRelatorio(ctx, tid, depois);
  const fedA = antes && antes.federation_id;
  const saiu = sA && sA.status === 'pending' && (!sD || ['rejected', 'revoked'].includes(sD.status) || (depois && depois.federation_id !== fedA));
  if (saiu) await cancelarTaxa(ctx, fedA, tid, sD && sD.reason ? texto(sD.reason, 300) : 'Pedido de chancela retirado.');
  return { ok: true };
}

/* ------------------------------------------------------------- o callable -- */

async function contexto(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  return { fed, perms, hoje: m.isoDateBR(ctx.now), equipe: perms.includes('competitions') || perms.includes('admin') };
}

async function relatorio(ctx, c, tid) {
  const ref = ctx.db.collection(REPORTS).doc(texto(tid, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', 'Este torneio não tem relatório de chancela.');
  return { ref, rep: { id: snap.id, ...snap.data() } };
}

const podeRelatar = (c, rep, uid) => c.equipe || rep.director_uid === uid || rep.organizer_uid === uid;

async function gravarChecklist(ctx, actor, data, c) {
  const { ref, rep } = await relatorio(ctx, c, data.tournamentId);
  if (!podeRelatar(c, rep, actor.uid)) falha('permission-denied', 'Só o diretor ou quem organiza faz o checklist.');
  const v = P.validateChecklist(data);
  await ref.update({ checklist: { ...v, by: actor.uid, by_name: texto(actor.name, 120), at_ms: ctx.now }, updated_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_tournament_checklist', { federation_id: c.fed.id, tournament_id: rep.id, complete: v.complete });
  return { ok: true, complete: v.complete };
}

async function gravarRelatorio(ctx, actor, data, c) {
  const { ref, rep } = await relatorio(ctx, c, data.tournamentId);
  if (!podeRelatar(c, rep, actor.uid)) falha('permission-denied', 'Só o diretor ou quem organiza entrega o relatório.');
  if (rep.starts_at && c.hoje < rep.starts_at) falha('failed-precondition', 'O relatório é entregue a partir do início do torneio.');
  const r = P.validateEventReport(data);
  if (!r.ok) falha('invalid-argument', 'Descreva as lesões e as reclamações que você contou.');
  const anterior = rep.report || null;
  const batch = ctx.db.batch();
  batch.update(ref, { report: { ...r.value, by: actor.uid, by_name: texto(actor.name, 120), submitted_at_ms: ctx.now, revisions: anterior ? (anterior.revisions || 0) + 1 : 0 }, updated_at_ms: ctx.now });
  if (!anterior) {
    const equipe = await f.staffIds(ctx, c.fed.id, 'competitions');
    equipe.filter((uid) => uid !== actor.uid).forEach((uid) => f.aviso(ctx, batch, uid, {
      title: tx('Relatório do torneio {torneio}', { torneio: rep.tournament_name }),
      message: tx('O diretor entregou o relatório: {wo} W.O., {lesoes} lesões, {reclamacoes} reclamações.', { wo: r.value.walkovers, lesoes: r.value.injuries, reclamacoes: r.value.complaints }),
      link: LINK_CHANCELAS(c.fed.id),
    }));
  }
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_tournament_report', { federation_id: c.fed.id, tournament_id: rep.id, injuries: r.value.injuries, complaints: r.value.complaints });
  return { ok: true };
}

/* ------------------------------------------------------- final do circuito -- */

/** Cria os convites que faltam, com as opções guardadas no relatório. Devolve quantos. */
async function convidar(ctx, fed, rep, opcoes, actor) {
  const o = P.normalizeFinalOptions(opcoes);
  if (!o.season) falha('invalid-argument', 'Escolha o ano do ranking.');
  const [rank, existentes] = await Promise.all([
    ctx.db.collection('federation_rankings').doc(`${fed.id}_${o.season}`).get(),
    ctx.db.collection(INVITES).where('tournament_id', '==', rep.id).get(),
  ]);
  const categorias = rank.exists ? rank.data().categories || [] : [];
  const atuais = existentes.docs.map((d) => d.data());
  const novos = P.finalInvitesToSend(categorias, atuais, o);
  if (!novos.length) return 0;
  const batch = ctx.db.batch();
  const expira = ctx.now + o.accept_days * DIA;
  novos.forEach((n) => {
    batch.set(ctx.db.collection(INVITES).doc(P.finalInviteDocId(rep.id, n.category_key, n.user_id)), {
      ...n, federation_id: fed.id, federation_acronym: fed.acronym || '', tournament_id: rep.id, tournament_name: rep.tournament_name, starts_at: rep.starts_at || '',
      season: o.season, status: P.FINAL_INVITE_STATUS.INVITED, expires_at_ms: expira, invited_by: actor.uid, created_at_ms: ctx.now, updated_at_ms: ctx.now,
    });
    f.aviso(ctx, batch, n.user_id, {
      title: tx('Convite para a final {torneio}', { torneio: rep.tournament_name }),
      message: n.substitute
        ? tx('Abriu uma vaga e você foi chamado pelo ranking {ano} da {sigla}. Responda até {data} em Minha área → Federações.', { ano: o.season, sigla: sigla(fed), data: br(m.isoDateBR(expira)) })
        : tx('Você está entre os melhores do ranking {ano} da {sigla}. Responda até {data} em Minha área → Federações.', { ano: o.season, sigla: sigla(fed), data: br(m.isoDateBR(expira)) }),
      link: LINK_MEU,
    });
  });
  await batch.commit();
  return novos.length;
}

async function enviarConvites(ctx, actor, data, c) {
  if (!c.equipe) falha('permission-denied', 'Só a equipe de competições convida para a final.');
  const t = await ctx.db.collection('tournaments').doc(texto(data.tournamentId, 80)).get();
  if (!t.exists || t.data().federation_id !== c.fed.id || (t.data().federation_sanction || {}).status !== 'approved') falha('failed-precondition', 'A final precisa ser um torneio chancelado por esta federação.');
  const { ref, rep } = await relatorio(ctx, c, t.id);
  const o = P.normalizeFinalOptions(data);
  const n = await convidar(ctx, c.fed, rep, o, actor);
  await ref.update({ final: { ...o, sent_by: actor.uid, sent_at_ms: (rep.final && rep.final.sent_at_ms) || ctx.now, updated_at_ms: ctx.now }, updated_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_final_invites', { federation_id: c.fed.id, tournament_id: rep.id, season: o.season, per_category: o.per_category, invited: n });
  return { ok: true, invited: n };
}

/** Uma vaga abriu: chama o próximo do ranking, com as opções guardadas. */
async function chamarSuplentes(ctx, fedId, tid, actor) {
  const [fedSnap, repSnap] = await Promise.all([ctx.db.collection(f.C.federations).doc(fedId).get(), ctx.db.collection(REPORTS).doc(tid).get()]);
  if (!fedSnap.exists || !repSnap.exists || !repSnap.data().final) return 0;
  const rep = { id: repSnap.id, ...repSnap.data() };
  if (rep.starts_at && m.isoDateBR(ctx.now) >= rep.starts_at) return 0; // começou: não chama mais ninguém
  return convidar(ctx, { id: fedSnap.id, ...fedSnap.data() }, rep, rep.final, actor);
}

async function responderConvite(ctx, actor, data, c) {
  const ref = ctx.db.collection(INVITES).doc(texto(data.inviteId, 200));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', 'Convite não encontrado.');
  const inv = snap.data();
  if (inv.user_id !== actor.uid) falha('permission-denied', 'Este convite não é seu.');
  if (inv.status !== P.FINAL_INVITE_STATUS.INVITED) falha('failed-precondition', 'Este convite já foi respondido.');
  if (Number(inv.expires_at_ms) <= ctx.now) falha('failed-precondition', 'O prazo para responder venceu.');
  const aceitou = data.accept === true;
  await ref.update({ status: aceitou ? P.FINAL_INVITE_STATUS.ACCEPTED : P.FINAL_INVITE_STATUS.DECLINED, answered_at_ms: ctx.now, updated_at_ms: ctx.now });
  await f.auditoria(ctx, actor, aceitou ? 'federation_final_accept' : 'federation_final_decline', { federation_id: c.fed.id, tournament_id: inv.tournament_id, category_key: inv.category_key });
  const chamados = aceitou ? 0 : await chamarSuplentes(ctx, c.fed.id, inv.tournament_id, { uid: 'system' });
  return { ok: true, substitutes: chamados };
}

async function cancelarConvite(ctx, actor, data, c) {
  if (!c.equipe) falha('permission-denied', 'Só a equipe de competições cancela convite.');
  const ref = ctx.db.collection(INVITES).doc(texto(data.inviteId, 200));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', 'Convite não encontrado.');
  const inv = snap.data();
  if (![P.FINAL_INVITE_STATUS.INVITED, P.FINAL_INVITE_STATUS.ACCEPTED].includes(inv.status)) falha('failed-precondition', 'Este convite já está fechado.');
  const motivo = texto(data.reason, 300);
  if (motivo.length < 3) falha('invalid-argument', 'Diga o motivo.');
  const batch = ctx.db.batch();
  batch.update(ref, { status: P.FINAL_INVITE_STATUS.CANCELLED, cancel_reason: motivo, cancelled_by: actor.uid, updated_at_ms: ctx.now });
  f.aviso(ctx, batch, inv.user_id, { title: tx('Convite para a final {torneio} cancelado', { torneio: inv.tournament_name }), message: tx('Motivo: {motivo}', { motivo }), link: LINK_MEU });
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_final_cancel', { federation_id: c.fed.id, tournament_id: inv.tournament_id, user_id: inv.user_id, reason: motivo });
  const chamados = await chamarSuplentes(ctx, c.fed.id, inv.tournament_id, actor);
  return { ok: true, substitutes: chamados };
}

const ACOES = {
  checklist: gravarChecklist,
  report: gravarRelatorio,
  final_send: enviarConvites,
  final_answer: responderConvite,
  final_cancel: cancelarConvite,
};

async function competition(ctx, actor, data = {}) {
  const fn = ACOES[data.action];
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  return fn(ctx, actor, data, await contexto(ctx, actor, data));
}

/* --------------------------------------------------------------- varredura -- */

/** Convite sem resposta no prazo vence e a vaga vai para o próximo do ranking. */
async function sweep(ctx) {
  if (!(await f.flagLigada(ctx))) return { skipped: 'flag' };
  const snap = await ctx.db.collection(INVITES).where('status', '==', P.FINAL_INVITE_STATUS.INVITED).get();
  const vencidos = snap.docs.filter((d) => Number(d.data().expires_at_ms) <= ctx.now);
  if (!vencidos.length) return { expired: 0, substitutes: 0 };
  const torneios = new Map();
  const batch = ctx.db.batch();
  vencidos.forEach((d) => {
    batch.update(d.ref, { status: P.FINAL_INVITE_STATUS.EXPIRED, updated_at_ms: ctx.now });
    torneios.set(d.data().tournament_id, d.data().federation_id);
  });
  await batch.commit();
  let chamados = 0;
  for (const [tid, fedId] of torneios) {
    // eslint-disable-next-line no-await-in-loop
    chamados += await chamarSuplentes(ctx, fedId, tid, { uid: 'system' });
  }
  if (ctx.logger) ctx.logger.info('Federações: convites da final.', { vencidos: vencidos.length, suplentes: chamados });
  return { expired: vencidos.length, substitutes: chamados };
}

module.exports = { competition, onTournamentWritten, sweep, REPORTS, INVITES };
