/**
 * DISCIPLINA E OUVIDORIA DO CLUBE-ASSOCIAÇÃO (Bloco E1, flag `club_association`) —
 * só o SERVIDOR grava `club_x/{clube}/cases` (sanções) e `club_x/{clube}/ombud`
 * (ouvidoria), e o EFEITO na filiação. É a disciplina da federação
 * (`federationDiscipline.js`) com o clube no lugar dela: as mesmas quatro
 * sanções, o mesmo recurso (uma vez só), o mesmo protocolo da ouvidoria.
 *
 *  - `apply` (cargo `discipline`): advertência; SUSPENSÃO (grava
 *    `aff.discipline_until_ms` — a conta de `membershipState` já a trata: a
 *    carteirinha mostra "Suspensa" e as vantagens e o voto param); MULTA (vira
 *    cobrança `origin: 'fine'`, quitada sem tocar na validade); EXCLUSÃO (encerra
 *    a FILIAÇÃO — a pessoa continua no clube, sem vantagens: decisão D3). A
 *    sanção começa no dia em que é aplicada (não há início futuro);
 *  - `appeal` (a própria pessoa, uma vez, enquanto em vigor) → `appealed`;
 *  - `decide_appeal` (cargo): `uphold` (fica) ou `overturn` (desfaz o efeito);
 *  - `end` (cargo): encerra antes do prazo (desfaz o efeito);
 *  - `report` (qualquer conta logada): abre uma manifestação na ouvidoria,
 *    anônima ou não. Anônima NÃO grava quem enviou; o protocolo é o id do
 *    documento. `report_status` devolve só o ESTADO a quem tem o protocolo (a
 *    identificada, só a quem enviou); `report_update` (cargo) muda o estado e
 *    anota — as anotações quem enviou não lê.
 *
 * O efeito na filiação é RECALCULADO de todas as suspensões em vigor
 * (`recalcularSuspensao`): desfazer uma não apaga a outra que ainda vale.
 */
const m = require('./federationMembership.js');
const a = require('./clubAssociation.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto, col } = a;
const CASES = 'cases';
const OMBUD = 'ombud';
const KINDS = ['warning', 'suspension', 'fine', 'exclusion'];
const EM_VIGOR = ['active', 'upheld'];
const REPORT_KINDS = ['conduct', 'referee', 'organization', 'other', 'minor_protection'];
const REPORT_STATUS = ['open', 'in_review', 'closed'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const REASON_MIN = 10;
const APPEAL_MIN = 20;
const REPORT_MIN = 20;
const REPORT_MAX = 2000;

async function contexto(ctx, data) {
  await a.exigeFlag(ctx);
  const club = await a.clube(ctx, data.clubId);
  if (!(club.association && club.association.enabled === true)) falha('failed-precondition', 'Este clube ainda não abriu a associação.');
  return club;
}

async function sancao(ctx, club, id) {
  const snap = await col(ctx, club.id, CASES).doc(texto(id, 80)).get();
  if (!snap.exists) falha('not-found', 'Sanção não encontrada.');
  return { ref: snap.ref, s: { id: snap.id, ...snap.data() } };
}

/**
 * O efeito das suspensões na filiação, recalculado do zero: o MAIOR fim entre as
 * suspensões em vigor. `ignorar` é a que está sendo desfeita; `incluir`, a que
 * está nascendo (ainda não gravada).
 */
async function recalcularSuspensao(ctx, club, uid, { ignorar = null, incluir = null } = {}) {
  const snap = await col(ctx, club.id, CASES).where('user_id', '==', uid).get();
  const vigentes = snap.docs.map((x) => ({ id: x.id, ...x.data() })).filter((x) => x.kind === 'suspension' && EM_VIGOR.includes(x.status) && x.id !== ignorar);
  if (incluir) vigentes.push(incluir);
  let until = 0;
  let quem = null;
  vigentes.forEach((x) => {
    const fim = m.endOfDayBrMs(x.ends_at);
    if (fim > until) { until = fim; quem = x.id; }
  });
  return { discipline_until_ms: until, discipline_sanction_id: quem };
}

/** Desfaz o efeito de uma sanção na filiação (recurso aceito, encerramento antecipado). */
async function desfazerEfeito(ctx, club, batch, s) {
  const aref = col(ctx, club.id, 'aff').doc(s.user_id);
  const snap = await aref.get();
  if (snap.exists) {
    const aff = snap.data();
    if (s.kind === 'suspension') {
      const efeito = await recalcularSuspensao(ctx, club, s.user_id, { ignorar: s.id });
      batch.update(aref, { ...efeito, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
    }
    if (s.kind === 'exclusion' && aff.status === 'cancelled' && aff.excluded_by_sanction_id === s.id) {
      // A filiação volta COM código novo: o antigo saiu do índice ao excluir, e sem código a carteirinha não verifica.
      const code = a.novoCodigo();
      batch.set(ctx.db.collection(a.INDEX).doc(code), { club_id: club.id, user_id: s.user_id, created_at_ms: ctx.now });
      batch.update(aref, { status: aff.status_before_exclusion || 'expired', excluded_by_sanction_id: null, card_code: code, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
    }
  }
  if (s.kind === 'fine') {
    const abertas = await col(ctx, club.id, 'charges').where('sanction_id', '==', s.id).get();
    abertas.docs.filter((d) => ['open', 'declared'].includes(d.data().status)).forEach((d) => batch.update(d.ref, { status: 'cancelled', cancelled_at_ms: ctx.now }));
  }
}

const linkMinha = (club) => `/clubes/${club.id}?tab=associacao`;

async function aplicar(ctx, actor, data, club) {
  await a.exigePerm(ctx, club.id, actor, 'discipline');
  const hoje = m.isoDateBR(ctx.now);
  const kind = texto(data.kind, 20);
  if (!KINDS.includes(kind)) falha('invalid-argument', 'Escolha o tipo da sanção.');
  const reason = texto(data.reason, 1000);
  if (reason.length < REASON_MIN) falha('invalid-argument', 'Descreva o motivo (mínimo 10 caracteres).');
  const ends_at = kind === 'suspension' ? texto(data.ends_at, 10) : '';
  if (kind === 'suspension' && (!ISO.test(ends_at) || ends_at < hoje)) falha('invalid-argument', 'A suspensão precisa de uma data de fim a partir de hoje.');
  const fine_cents = kind === 'fine' ? Math.trunc(Number(data.fine_cents) || 0) : 0;
  if (kind === 'fine' && (fine_cents <= 0 || fine_cents > 100000000)) falha('invalid-argument', 'Informe o valor da multa.');
  const uid = texto(data.userId, 128);
  if (!uid) falha('invalid-argument', 'Escolha a pessoa.');
  const aref = col(ctx, club.id, 'aff').doc(uid);
  const asnap = await aref.get();
  if (!asnap.exists) falha('not-found', 'Filiação não encontrada.');
  const aff = { id: asnap.id, ...asnap.data() };
  if (!a.LIVE.includes(aff.status)) falha('failed-precondition', 'Esta filiação já está encerrada — não cabe sanção.');
  if (uid === actor.uid) falha('failed-precondition', 'Ninguém aplica sanção a si mesmo.');

  const ref = col(ctx, club.id, CASES).doc();
  const batch = ctx.db.batch();
  const doc = {
    club_id: club.id, club_name: club.name || '', member_id: uid, user_id: uid, user_name: aff.user_name || '', kind, reason, starts_at: hoje, ends_at, fine_cents,
    tournament_id: null, tournament_name: texto(data.tournament_name, 120),
    status: 'active', applied_by: actor.uid, created_at_ms: ctx.now, updated_at_ms: ctx.now, appeal: null,
  };
  batch.set(ref, doc);
  let chargeId = null;
  if (kind === 'suspension') {
    const efeito = await recalcularSuspensao(ctx, club, uid, { incluir: { id: ref.id, ...doc } });
    batch.update(aref, { ...efeito, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  }
  if (kind === 'exclusion') {
    a.encerrar(ctx, batch, aref, aff, { status: 'cancelled', cancelled_at_ms: ctx.now, cancelled_by: actor.uid, excluded_by_sanction_id: ref.id, status_before_exclusion: aff.status });
    const abertas = await col(ctx, club.id, 'charges').where('user_id', '==', uid).get();
    abertas.docs.filter((d) => ['open', 'declared'].includes(d.data().status)).forEach((d) => batch.update(d.ref, { status: 'cancelled', cancelled_at_ms: ctx.now }));
  }
  if (kind === 'fine') {
    const c = await a.novaCobranca(ctx, batch, { club, aff, plan: { id: '', name: 'Multa disciplinar' }, origin: 'fine', hoje, amount: fine_cents, extra: { sanction_id: ref.id } });
    chargeId = c.id;
  }
  const titulos = {
    warning: tx('Advertência do {clube}', { clube: club.name }),
    suspension: tx('Suspensão disciplinar no {clube}', { clube: club.name }),
    fine: tx('Multa disciplinar no {clube}', { clube: club.name }),
    exclusion: tx('Exclusão do quadro de associados do {clube}', { clube: club.name }),
  };
  const mensagens = {
    warning: tx('Motivo: {motivo}. Você pode recorrer uma vez pela página do clube.', { motivo: reason }),
    suspension: tx('Motivo: {motivo}. Até {fim} a carteirinha mostra "Suspensa" e as vantagens e o voto ficam suspensos. Cabe um recurso.', { motivo: reason, fim: ends_at }),
    fine: tx('Motivo: {motivo}. A cobrança está na página do clube. Cabe um recurso.', { motivo: reason }),
    exclusion: tx('Motivo: {motivo}. Sua filiação foi encerrada; você continua no clube, sem as vantagens de associado. Cabe um recurso.', { motivo: reason }),
  };
  a.aviso(ctx, batch, uid, { title: titulos[kind], message: mensagens[kind], link: linkMinha(club) });
  await batch.commit();
  await a.auditoria(ctx, actor, `club_discipline_${kind}`, { club_id: club.id, user_id: uid, sanction_id: ref.id, reason });
  return { ok: true, sanctionId: ref.id, chargeId };
}

async function sobreSancao(ctx, actor, data, club, acao) {
  const { ref, s } = await sancao(ctx, club, data.sanctionId);

  if (acao === 'appeal') {
    if (s.user_id !== actor.uid) falha('permission-denied', 'Esta sanção não é sua.');
    if (s.status !== 'active' || s.appeal) falha('failed-precondition', 'Esta sanção não aceita mais recurso.');
    const text = texto(data.text, 2000);
    if (text.length < APPEAL_MIN) falha('invalid-argument', 'Escreva o recurso (mínimo 20 caracteres).');
    const batch = ctx.db.batch();
    batch.update(ref, { status: 'appealed', appeal: { text, by: actor.uid, at_ms: ctx.now }, updated_at_ms: ctx.now });
    (await a.quemTem(ctx, club.id, 'discipline')).forEach((sid) => a.aviso(ctx, batch, sid, {
      title: tx('Recurso de sanção no {clube}', { clube: club.name }),
      message: tx('{nome} recorreu. Decida em Disciplina → Sanções.', { nome: s.user_name }),
      link: `/clubes/${club.id}/gerir?aba=sancoes`,
    }));
    await batch.commit();
    return { ok: true };
  }

  await a.exigePerm(ctx, club.id, actor, 'discipline');
  const note = texto(data.note, 1000);

  if (acao === 'decide_appeal') {
    if (s.status !== 'appealed') falha('failed-precondition', 'Não há recurso pendente nesta sanção.');
    const decision = texto(data.decision, 20);
    if (!['uphold', 'overturn'].includes(decision)) falha('invalid-argument', 'Decida o recurso: manter (uphold) ou anular (overturn).');
    const mantem = decision === 'uphold';
    const batch = ctx.db.batch();
    batch.update(ref, { status: mantem ? 'upheld' : 'overturned', appeal_decision: { upheld: mantem, note, by: actor.uid, at_ms: ctx.now }, updated_at_ms: ctx.now });
    if (!mantem) await desfazerEfeito(ctx, club, batch, s);
    a.aviso(ctx, batch, s.user_id, mantem
      ? { title: tx('Recurso negado — {clube}', { clube: club.name }), message: note ? tx('A sanção foi mantida. {nota}', { nota: note }) : tx('A sanção foi mantida.'), link: linkMinha(club) }
      : { title: tx('Recurso aceito — {clube}', { clube: club.name }), message: note ? tx('A sanção foi anulada. {nota}', { nota: note }) : tx('A sanção foi anulada.'), link: linkMinha(club) });
    await batch.commit();
    await a.auditoria(ctx, actor, mantem ? 'club_discipline_uphold' : 'club_discipline_overturn', { club_id: club.id, sanction_id: s.id, user_id: s.user_id, note });
    return { ok: true };
  }

  if (acao === 'end') {
    if (!EM_VIGOR.includes(s.status)) falha('failed-precondition', 'Esta sanção já não está em vigor.');
    const batch = ctx.db.batch();
    batch.update(ref, { status: 'ended', ended_by: actor.uid, ended_at_ms: ctx.now, end_note: note, updated_at_ms: ctx.now });
    await desfazerEfeito(ctx, club, batch, s);
    a.aviso(ctx, batch, s.user_id, { title: tx('Sanção encerrada — {clube}', { clube: club.name }), message: tx('O clube encerrou a sanção antes do prazo.'), link: linkMinha(club) });
    await batch.commit();
    await a.auditoria(ctx, actor, 'club_discipline_end', { club_id: club.id, sanction_id: s.id, user_id: s.user_id, note });
    return { ok: true };
  }
  return falha('invalid-argument', 'Ação desconhecida.');
}

/* --------------------------------------------------------------- ouvidoria -- */

async function abrirManifestacao(ctx, actor, data, club) {
  if (!a.aberta(club)) falha('failed-precondition', 'Este clube não está recebendo manifestações agora.');
  const kind = REPORT_KINDS.includes(data.kind) ? data.kind : 'other';
  const body = texto(data.body, REPORT_MAX);
  if (body.length < REPORT_MIN) falha('invalid-argument', 'Conte o que aconteceu (mínimo 20 caracteres).');
  const anonymous = data.anonymous === true;
  // O id É o protocolo (10 letras e números, sempre maiúsculos): quem digita o protocolo acha o documento.
  const ref = col(ctx, club.id, OMBUD).doc(a.novoCodigo());
  const batch = ctx.db.batch();
  // Anônima: nem o servidor guarda quem enviou. A identificada guarda, para só quem enviou acompanhar.
  batch.set(ref, {
    club_id: club.id, kind, body, tournament_name: texto(data.tournament_name, 120), anonymous, reporter_uid: anonymous ? null : actor.uid,
    status: 'open', notes: '', created_at_ms: ctx.now, updated_at_ms: ctx.now,
  });
  // Proteção de criança ou adolescente é prioridade: o aviso diz isso (o texto da denúncia nunca vai no aviso).
  const protecao = kind === 'minor_protection';
  (await a.quemTem(ctx, club.id, 'discipline')).forEach((sid) => a.aviso(ctx, batch, sid, {
    title: protecao ? tx('Denúncia de proteção de menor no {clube}', { clube: club.name }) : tx('Nova manifestação na ouvidoria do {clube}', { clube: club.name }),
    message: protecao ? tx('Prioridade: abra e trate em Disciplina → Ouvidoria. O conteúdo fica só lá.') : tx('Chegou uma manifestação. Veja em Disciplina → Ouvidoria.'),
    link: `/clubes/${club.id}/gerir?aba=ouvidoria`,
  }));
  await batch.commit();
  return { ok: true, reportId: ref.id, anonymous };
}

async function estadoDaManifestacao(ctx, actor, data, club) {
  const snap = await col(ctx, club.id, OMBUD).doc(texto(data.reportId, 80)).get();
  // Inexistente e alheia dizem o mesmo: protocolo não encontrado (não se confirma que existe).
  if (!snap.exists) falha('not-found', 'Protocolo não encontrado.');
  const r = snap.data();
  if (!r.anonymous && r.reporter_uid !== actor.uid) falha('not-found', 'Protocolo não encontrado.');
  return { ok: true, report: { id: snap.id, status: r.status, kind: r.kind, created_at_ms: r.created_at_ms, anonymous: r.anonymous === true } };
}

async function tratarManifestacao(ctx, actor, data, club) {
  await a.exigePerm(ctx, club.id, actor, 'discipline');
  const ref = col(ctx, club.id, OMBUD).doc(texto(data.reportId, 80));
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Manifestação não encontrada.');
  const r = snap.data();
  if (r.status === 'closed') falha('failed-precondition', 'Manifestação concluída não volta a ser editada.');
  const patch = { updated_at_ms: ctx.now, handled_by: actor.uid };
  if (data.status != null) {
    if (!REPORT_STATUS.includes(data.status)) falha('invalid-argument', 'Estado inválido.');
    patch.status = data.status;
  }
  if (typeof data.notes === 'string') patch.notes = texto(data.notes, 2000);
  await ref.update(patch);
  await a.auditoria(ctx, actor, 'club_report_update', { club_id: club.id, report_id: snap.id, status: patch.status || r.status });
  return { ok: true };
}

async function discipline(ctx, actor, data) {
  const club = await contexto(ctx, data);
  const acao = texto(data.action, 20);
  if (acao === 'apply') return aplicar(ctx, actor, data, club);
  if (['appeal', 'decide_appeal', 'end'].includes(acao)) return sobreSancao(ctx, actor, data, club, acao);
  if (acao === 'report') return abrirManifestacao(ctx, actor, data, club);
  if (acao === 'report_status') return estadoDaManifestacao(ctx, actor, data, club);
  if (acao === 'report_update') return tratarManifestacao(ctx, actor, data, club);
  return falha('invalid-argument', 'Ação desconhecida.');
}

module.exports = { discipline, recalcularSuspensao, KINDS, REPORT_KINDS, CASES, OMBUD };
