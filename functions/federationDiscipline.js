/**
 * DISCIPLINA (PR 3, módulo `discipline`) — só o SERVIDOR grava `federation_sanctions`
 * e o EFEITO na filiação (D11: só a pessoa e a federação veem).
 *
 *  - `apply` (equipe `discipline`): advertência; SUSPENSÃO (grava
 *    `discipline_until_ms` na filiação — a regra da auto-inscrição em torneio
 *    "só filiados" lê esse campo, e a carteirinha mostra "Suspensa"); MULTA
 *    (vira cobrança `origin: 'fine'`, quitada em `chargeConfirm`); EXCLUSÃO
 *    (encerra a filiação).
 *  - `appeal` (a pessoa, uma vez, enquanto em vigor) → `appealed`; a equipe é avisada.
 *  - `decide_appeal` (equipe): `uphold` (fica) ou `overturn` (desfaz o efeito).
 *  - `end` (equipe): encerra antes do prazo (desfaz o efeito).
 *  - `sweep` (diária): a suspensão com `starts_at` no FUTURO entra em vigor no dia.
 * A ouvidoria (`federation_reports`) é gravada pelo cliente — a regra confere.
 *
 * Revisão 2026-10-21 — o efeito na filiação é RECALCULADO a partir de todas as
 * suspensões em vigor (`recalcularSuspensao`): desfazer uma não apaga a outra
 * que ainda vale; a suspensão futura só vale a partir de `starts_at`; desfazer
 * uma exclusão devolve a filiação COM código novo de carteirinha; sanção só em
 * filiação viva; o recurso só é decidido com `uphold` ou `overturn`.
 */
const f = require('./federations.js');
const m = require('./federationMembership.js');
const { tx } = require('./avisoI18n.js');

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ['warning', 'suspension', 'fine', 'exclusion'];

async function sancao(ctx, id) {
  const snap = await ctx.db.collection(f.C.sanctions).doc(f.texto(id, 80)).get();
  if (!snap.exists) f.falha('not-found', 'Sanção não encontrada.');
  return { ref: snap.ref, s: { id: snap.id, ...snap.data() } };
}

const EM_VIGOR = ['active', 'upheld'];

/**
 * O efeito das suspensões na filiação, recalculado do zero: o MAIOR fim entre
 * as suspensões em vigor (ativas ou mantidas em recurso) que JÁ começaram.
 * `ignorar` é a sanção que está sendo desfeita; `incluir` é a que está nascendo
 * (ainda não gravada). Sobreposição resolvida aqui, não em quem chama.
 */
async function recalcularSuspensao(ctx, memberId, hoje, { ignorar = null, incluir = null } = {}) {
  const snap = await ctx.db.collection(f.C.sanctions).where('member_id', '==', memberId).get();
  const vigentes = snap.docs.map((x) => ({ id: x.id, ...x.data() })).filter((x) => x.kind === 'suspension' && EM_VIGOR.includes(x.status) && x.id !== ignorar);
  if (incluir) vigentes.push(incluir);
  let until = 0;
  let quem = null;
  vigentes.filter((x) => String(x.starts_at || '') <= hoje).forEach((x) => {
    const fim = m.endOfDayBrMs(x.ends_at);
    if (fim > until) { until = fim; quem = x.id; }
  });
  return { discipline_until_ms: until, discipline_sanction_id: quem };
}

/** Desfaz o efeito de uma sanção na filiação (recurso aceito, encerramento antecipado). */
async function desfazerEfeito(ctx, batch, s, hoje) {
  const memberRef = ctx.db.collection(f.C.members).doc(s.member_id);
  const ms = await memberRef.get();
  if (!ms.exists) return;
  const member = ms.data();
  if (s.kind === 'suspension') {
    const efeito = await recalcularSuspensao(ctx, s.member_id, hoje, { ignorar: s.id });
    batch.update(memberRef, { ...efeito, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  }
  if (s.kind === 'exclusion' && member.status === 'cancelled' && member.excluded_by_sanction_id === s.id) {
    // A filiação volta COM código novo: o antigo saiu do índice ao excluir, e sem código a carteirinha não verifica.
    const code = f.novoCodigo();
    batch.set(ctx.db.collection(f.C.cardIndex).doc(code), { member_id: s.member_id, federation_id: s.federation_id, created_at_ms: ctx.now });
    batch.update(memberRef, { status: member.status_before_exclusion || 'expired', excluded_by_sanction_id: null, card_code: code, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  }
  if (s.kind === 'fine') {
    const abertas = await ctx.db.collection(f.C.charges).where('sanction_id', '==', s.id).get();
    abertas.docs.filter((d) => ['open', 'declared'].includes(d.data().status)).forEach((d) => batch.update(d.ref, { status: 'cancelled', cancelled_at_ms: ctx.now }));
  }
}

async function discipline(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) f.falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const acao = f.texto(data.action, 20);
  const hoje = m.isoDateBR(ctx.now);

  if (acao === 'apply') {
    const fed = await f.federacao(ctx, data.federationId);
    if (!(fed.modules && fed.modules.discipline === true)) f.falha('failed-precondition', 'Esta federação não tem o módulo de disciplina ligado.');
    await f.exigePerm(ctx, fed.id, actor, 'discipline');
    const kind = f.texto(data.kind, 20);
    if (!KINDS.includes(kind)) f.falha('invalid-argument', 'Escolha o tipo da sanção.');
    const reason = f.texto(data.reason, 1000);
    if (reason.length < 10) f.falha('invalid-argument', 'Descreva o motivo (mínimo 10 caracteres).');
    const starts_at = f.texto(data.starts_at, 10) || hoje;
    const ends_at = kind === 'suspension' ? f.texto(data.ends_at, 10) : '';
    if (!ISO.test(starts_at) || (kind === 'suspension' && (!ISO.test(ends_at) || ends_at < starts_at))) f.falha('invalid-argument', 'Datas da sanção inválidas.');
    const fine_cents = kind === 'fine' ? Math.trunc(Number(data.fine_cents) || 0) : 0;
    if (kind === 'fine' && fine_cents <= 0) f.falha('invalid-argument', 'Informe o valor da multa.');
    const memberId = f.texto(data.memberId, 120) || `${fed.id}_${f.texto(data.userId, 128)}`;
    const memberRef = ctx.db.collection(f.C.members).doc(memberId);
    const ms = await memberRef.get();
    if (!ms.exists || ms.data().federation_id !== fed.id) f.falha('not-found', 'Filiação não encontrada.');
    const member = { id: ms.id, ...ms.data() };
    if (!f.LIVE.includes(member.status)) f.falha('failed-precondition', 'Esta filiação já está encerrada — não cabe sanção.');
    const ref = ctx.db.collection(f.C.sanctions).doc();
    const batch = ctx.db.batch();
    const doc = {
      federation_id: fed.id, federation_acronym: fed.acronym || '', member_id: member.id, user_id: member.user_id || null, guardian_uid: member.guardian_uid || null, user_name: member.user_name || '',
      kind, reason, starts_at, ends_at, fine_cents, tournament_id: f.texto(data.tournament_id, 80) || null, tournament_name: f.texto(data.tournament_name, 120),
      status: 'active', applied_by: actor.uid, created_at_ms: ctx.now, updated_at_ms: ctx.now, appeal: null,
      // Suspensão: quando o efeito entrou na filiação (a futura entra pela varredura do dia).
      applied_at_ms: kind === 'suspension' && starts_at <= hoje ? ctx.now : null,
    };
    batch.set(ref, doc);
    let chargeId = null;
    if (kind === 'suspension' && starts_at <= hoje) {
      const efeito = await recalcularSuspensao(ctx, member.id, hoje, { incluir: { id: ref.id, ...doc } });
      batch.update(memberRef, { ...efeito, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
    }
    if (kind === 'exclusion') {
      f.encerrarFiliacao(ctx, batch, memberRef, member, { status: 'cancelled', cancelled_at_ms: ctx.now, cancelled_by: actor.uid, excluded_by_sanction_id: ref.id, status_before_exclusion: member.status });
      const abertas = await ctx.db.collection(f.C.charges).where('member_id', '==', member.id).get();
      abertas.docs.filter((d) => ['open', 'declared'].includes(d.data().status)).forEach((d) => batch.update(d.ref, { status: 'cancelled', cancelled_at_ms: ctx.now }));
    }
    if (kind === 'fine') {
      const charge = f.novaCobranca(ctx, batch, { fed, member, memberId: member.id, plan: null, origin: 'fine', hoje, amount: fine_cents, extra: { plan_name: 'Multa disciplinar', sanction_id: ref.id } });
      chargeId = charge.id;
    }
    const titulos = { warning: tx('Advertência da {sigla}', { sigla: fed.acronym }), suspension: tx('Suspensão disciplinar na {sigla}', { sigla: fed.acronym }), fine: tx('Multa disciplinar na {sigla}', { sigla: fed.acronym }), exclusion: tx('Exclusão da {sigla}', { sigla: fed.acronym }) };
    const mensagens = {
      warning: tx('Motivo: {motivo}. Você pode recorrer uma vez pela Minha área → Federações.', { motivo: reason }),
      suspension: tx('Motivo: {motivo}. Até {fim} você não se inscreve em torneios chancelados e a carteirinha mostra "Suspensa". Cabe um recurso.', { motivo: reason, fim: ends_at }),
      fine: tx('Motivo: {motivo}. A cobrança está na Minha área → Federações. Cabe um recurso.', { motivo: reason }),
      exclusion: tx('Motivo: {motivo}. A filiação foi encerrada. Cabe um recurso.', { motivo: reason }),
    };
    f.aviso(ctx, batch, f.destinatario(member), { title: titulos[kind], message: mensagens[kind], link: '/perfil?secao=federacoes' });
    await batch.commit();
    await f.auditoria(ctx, actor, `federation_discipline_${kind}`, { federation_id: fed.id, member_id: member.id, user_id: member.user_id, sanction_id: ref.id, reason });
    return { ok: true, sanctionId: ref.id, chargeId };
  }

  const { ref, s } = await sancao(ctx, data.sanctionId);
  const fed = await f.federacao(ctx, s.federation_id);

  if (acao === 'appeal') {
    if (s.user_id !== actor.uid && s.guardian_uid !== actor.uid) f.falha('permission-denied', 'Esta sanção não é sua.');
    if (s.status !== 'active' || s.appeal) f.falha('failed-precondition', 'Esta sanção não aceita mais recurso.');
    const text = f.texto(data.text, 2000);
    if (text.length < 20) f.falha('invalid-argument', 'Escreva o recurso (mínimo 20 caracteres).');
    const batch = ctx.db.batch();
    batch.update(ref, { status: 'appealed', appeal: { text, by: actor.uid, at_ms: ctx.now }, updated_at_ms: ctx.now });
    (await f.staffIds(ctx, fed.id, 'discipline')).forEach((sid) => f.aviso(ctx, batch, sid, { title: tx('Recurso de sanção na {sigla}', { sigla: fed.acronym }), message: tx('{nome} recorreu. Decida em Disciplina → Sanções.', { nome: s.user_name }), link: `/federacoes/${fed.id}/gerir?aba=sancoes` }));
    await batch.commit();
    return { ok: true };
  }

  await f.exigePerm(ctx, fed.id, actor, 'discipline');
  const note = f.texto(data.note, 1000);
  if (acao === 'decide_appeal') {
    if (s.status !== 'appealed') f.falha('failed-precondition', 'Não há recurso pendente nesta sanção.');
    const decision = f.texto(data.decision, 20);
    if (!['uphold', 'overturn'].includes(decision)) f.falha('invalid-argument', 'Decida o recurso: manter (uphold) ou anular (overturn).');
    const mantem = decision === 'uphold';
    const batch = ctx.db.batch();
    batch.update(ref, { status: mantem ? 'upheld' : 'overturned', appeal_decision: { upheld: mantem, note, by: actor.uid, at_ms: ctx.now }, updated_at_ms: ctx.now });
    if (!mantem) await desfazerEfeito(ctx, batch, s, hoje);
    f.aviso(ctx, batch, f.destinatario(s), mantem
      ? { title: tx('Recurso negado — {sigla}', { sigla: fed.acronym }), message: note ? tx('A sanção foi mantida. {nota}', { nota: note }) : tx('A sanção foi mantida.'), link: '/perfil?secao=federacoes' }
      : { title: tx('Recurso aceito — {sigla}', { sigla: fed.acronym }), message: note ? tx('A sanção foi anulada. {nota}', { nota: note }) : tx('A sanção foi anulada.'), link: '/perfil?secao=federacoes' });
    await batch.commit();
    await f.auditoria(ctx, actor, mantem ? 'federation_discipline_uphold' : 'federation_discipline_overturn', { federation_id: fed.id, sanction_id: s.id, user_id: s.user_id, note });
    return { ok: true };
  }
  if (acao === 'end') {
    if (!['active', 'upheld'].includes(s.status)) f.falha('failed-precondition', 'Esta sanção já não está em vigor.');
    const batch = ctx.db.batch();
    batch.update(ref, { status: 'ended', ended_by: actor.uid, ended_at_ms: ctx.now, end_note: note, updated_at_ms: ctx.now });
    await desfazerEfeito(ctx, batch, s, hoje);
    f.aviso(ctx, batch, f.destinatario(s), { title: tx('Sanção encerrada — {sigla}', { sigla: fed.acronym }), message: tx('A federação encerrou a sanção antes do prazo.'), link: '/perfil?secao=federacoes' });
    await batch.commit();
    await f.auditoria(ctx, actor, 'federation_discipline_end', { federation_id: fed.id, sanction_id: s.id, user_id: s.user_id, note });
    return { ok: true };
  }
  return f.falha('invalid-argument', 'Ação desconhecida.');
}

/** Varredura diária: a suspensão marcada para começar no futuro entra em vigor no dia. */
async function sweep(ctx) {
  if (!(await f.flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = m.isoDateBR(ctx.now);
  const snap = await ctx.db.collection(f.C.sanctions).where('kind', '==', 'suspension').where('applied_at_ms', '==', null).get();
  const pendentes = snap.docs.map((x) => ({ id: x.id, ...x.data() })).filter((x) => EM_VIGOR.includes(x.status) && String(x.starts_at || '') <= hoje);
  let aplicadas = 0;
  for (const s of pendentes) {
    // eslint-disable-next-line no-await-in-loop
    const efeito = await recalcularSuspensao(ctx, s.member_id, hoje);
    const batch = ctx.db.batch();
    batch.update(ctx.db.collection(f.C.members).doc(s.member_id), { ...efeito, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
    batch.update(ctx.db.collection(f.C.sanctions).doc(s.id), { applied_at_ms: ctx.now, updated_at_ms: ctx.now });
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
    aplicadas += 1;
  }
  return { aplicadas };
}

module.exports = { discipline, sweep, recalcularSuspensao };
