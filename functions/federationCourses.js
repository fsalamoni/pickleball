/**
 * CURSOS E CREDENCIAIS (PR 3, módulo `courses`) — o que só o SERVIDOR grava:
 * a inscrição (`federation_course_enrollments/{curso}_{uid}`), a vaga
 * (`enrolled_count` do curso), a cobrança do curso e a CREDENCIAL
 * (`federation_credentials`) que a aprovação emite, com código no MESMO
 * índice da carteirinha (`federation_card_index`, `kind: 'credential'`) para a
 * verificação pública. O curso em si (criar, abrir, fechar) a equipe grava
 * pelo cliente — a regra confere.
 *
 *  - `enroll` (a pessoa): curso aberto, com vaga, do módulo ligado; se exige
 *    filiação, filiação ATIVA nesta federação; preço de filiado para quem é;
 *    pago → `awaiting_payment` + cobrança `origin: 'course'` (o financeiro
 *    confirma em `chargeConfirm`); grátis → `confirmed`.
 *  - `cancel` (a pessoa): antes do curso começar; devolve a vaga e cancela a cobrança.
 *  - `pass` / `fail` (equipe `courses`): `confirmed` → resultado; aprovado em
 *    curso que emite credencial ganha a credencial (validade =
 *    `credential_months`), avisada à pessoa.
 */
const f = require('./federations.js');
const m = require('./federationMembership.js');
const { tx } = require('./avisoI18n.js');

async function curso(ctx, courseId) {
  const snap = await ctx.db.collection(f.C.courses).doc(f.texto(courseId, 80)).get();
  if (!snap.exists) f.falha('not-found', 'Curso não encontrado.');
  return { ref: snap.ref, course: { id: snap.id, ...snap.data() } };
}

/**
 * A equipe cancela o CURSO inteiro, com motivo: cada inscrição viva vira
 * cancelada, a cobrança ainda aberta (ou informada) é cancelada e cada
 * inscrito é avisado — quem já pagou é lembrado de que a devolução é com a
 * federação (o Pix foi direto para ela). Antes o curso só mudava de situação
 * pelo cliente, e os inscritos não ficavam sabendo.
 */
async function cancelarCurso(ctx, actor, data, { courseRef, c, fed }) {
  await f.exigePerm(ctx, fed.id, actor, 'courses');
  const motivo = f.texto(data.reason, 300);
  if (motivo.length < 3) f.falha('invalid-argument', 'Diga o motivo do cancelamento: ele vai no aviso aos inscritos.');
  if (['cancelled', 'done'].includes(c.status)) f.falha('failed-precondition', 'Este curso já está encerrado.');
  const inscricoes = (await ctx.db.collection(f.C.enrollments).where('course_id', '==', c.id).get()).docs
    .filter((d) => ['awaiting_payment', 'confirmed'].includes(d.data().status));
  const cobrancas = (await ctx.db.collection(f.C.charges).where('course_id', '==', c.id).get()).docs
    .filter((d) => ['open', 'declared'].includes(d.data().status));
  // Lotes de até 400 escritas (o teto do Firestore é 500).
  let batch = ctx.db.batch();
  let ops = 0;
  const conta = async (n) => { ops += n; if (ops >= 400) { await batch.commit(); batch = ctx.db.batch(); ops = 0; } };
  batch.update(courseRef, { status: 'cancelled', cancelled_reason: motivo, cancelled_at_ms: ctx.now, cancelled_by: actor.uid, updated_at_ms: ctx.now });
  await conta(1);
  for (const d of cobrancas) { batch.update(d.ref, { status: 'cancelled', cancelled_at_ms: ctx.now, cancel_note: motivo }); await conta(1); }
  for (const d of inscricoes) {
    const e = d.data();
    batch.update(d.ref, { status: 'cancelled', cancelled_at_ms: ctx.now, cancelled_reason: motivo, updated_at_ms: ctx.now });
    const pagou = e.status === 'confirmed' && Number(e.amount_cents) > 0;
    f.aviso(ctx, batch, e.user_id, {
      title: tx('Curso {curso} cancelado', { curso: c.name }),
      message: pagou
        ? tx('A {sigla} cancelou o curso. Motivo: {motivo}. Você já tinha pago: a devolução é com a federação, fale com ela.', { sigla: fed.acronym, motivo })
        : tx('A {sigla} cancelou o curso. Motivo: {motivo}.', { sigla: fed.acronym, motivo }),
      link: '/perfil?secao=federacoes',
    });
    await conta(2);
  }
  if (ops > 0) await batch.commit();
  await f.auditoria(ctx, actor, 'federation_course_cancel', { federation_id: fed.id, course_id: c.id, reason: motivo, enrollments: inscricoes.length, charges: cobrancas.length });
  return { ok: true, enrollments: inscricoes.length, charges: cobrancas.length };
}

const vagasRestam = (c) => { const total = Math.trunc(Number(c.seats) || 0); return total <= 0 ? null : Math.max(0, total - (Math.trunc(Number(c.enrolled_count) || 0))); };

async function course(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) f.falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const acao = f.texto(data.action, 20);
  const { ref: courseRef, course: c } = await curso(ctx, data.courseId);
  const fed = await f.federacao(ctx, c.federation_id);
  if (!(fed.modules && fed.modules.courses === true)) f.falha('failed-precondition', 'Esta federação não tem o módulo de cursos ligado.');
  const hoje = m.isoDateBR(ctx.now);
  if (acao === 'cancel_course') return cancelarCurso(ctx, actor, data, { courseRef, c, fed });
  const propria = ['enroll', 'cancel'].includes(acao);
  const uid = propria ? actor.uid : f.texto(data.userId, 128);
  if (!uid) f.falha('invalid-argument', 'Diga de quem é a inscrição.');
  if (!propria) await f.exigePerm(ctx, fed.id, actor, 'courses');
  const enrRef = ctx.db.collection(f.C.enrollments).doc(`${c.id}_${uid}`);
  const enrSnap = await enrRef.get();
  const enr = enrSnap.exists ? { id: enrSnap.id, ...enrSnap.data() } : null;

  if (acao === 'enroll') {
    if (c.status !== 'open' || (c.ends_at && String(c.ends_at) < hoje)) f.falha('failed-precondition', 'As inscrições deste curso não estão abertas.');
    if (enr && enr.status !== 'cancelled') f.falha('already-exists', 'Você já está inscrito neste curso.');
    const ms = await ctx.db.collection(f.C.members).doc(`${fed.id}_${uid}`).get();
    const filiado = ms.exists && m.membershipState(ms.data(), hoje, ctx.now).status === 'active';
    if (c.requires_membership === true && !filiado) f.falha('failed-precondition', 'Este curso é só para filiados em dia nesta federação.');
    const cheio = Math.max(0, Math.trunc(Number(c.price_cents) || 0));
    const deFiliado = Math.max(0, Math.trunc(Number(c.member_price_cents == null ? cheio : c.member_price_cents) || 0));
    const valor = filiado ? Math.min(cheio, deFiliado) : cheio;
    const perfil = await ctx.db.collection('users').doc(uid).get();
    const u = perfil.exists ? perfil.data() : {};
    const doc = {
      federation_id: fed.id, course_id: c.id, course_name: c.name, user_id: uid, user_name: f.texto(u.platform_name || u.full_name || u.display_name || 'Atleta', 120),
      photo_url: f.texto(u.photo_url || u.avatar_url, 500), status: valor > 0 ? 'awaiting_payment' : 'confirmed', amount_cents: valor, is_member: filiado,
      created_at_ms: ctx.now, updated_at_ms: ctx.now,
    };
    let chargeId = null;
    await ctx.db.runTransaction(async (tr) => {
      const agora = await tr.get(courseRef);
      const atual = agora.data() || {};
      const restam = vagasRestam(atual);
      if (restam != null && restam <= 0) f.falha('failed-precondition', 'O curso está lotado.');
      tr.set(enrRef, doc);
      tr.update(courseRef, { enrolled_count: (Math.trunc(Number(atual.enrolled_count) || 0)) + 1 });
      if (valor > 0) {
        const charge = f.novaCobranca(ctx, tr, { fed, member: { user_id: uid, user_name: doc.user_name }, memberId: ms.exists ? ms.id : null, plan: null, origin: 'course', hoje, amount: valor, extra: { plan_name: c.name, enrollment_id: enrRef.id, course_id: c.id } });
        chargeId = charge.id;
      }
    });
    await f.auditoria(ctx, actor, 'federation_course_enroll', { federation_id: fed.id, course_id: c.id, user_id: uid, amount_cents: valor });
    return { ok: true, enrollmentId: enrRef.id, chargeId, status: doc.status };
  }

  if (!enr) f.falha('not-found', 'Inscrição não encontrada.');

  if (acao === 'cancel') {
    if (!['awaiting_payment', 'confirmed'].includes(enr.status)) f.falha('failed-precondition', 'Esta inscrição não pode mais ser cancelada.');
    if (c.starts_at && String(c.starts_at) < hoje) f.falha('failed-precondition', 'O curso já começou.');
    const batch = ctx.db.batch();
    batch.update(enrRef, { status: 'cancelled', cancelled_at_ms: ctx.now, updated_at_ms: ctx.now });
    batch.update(courseRef, { enrolled_count: ctx.FieldValue.increment(-1) });
    const abertas = await ctx.db.collection(f.C.charges).where('enrollment_id', '==', enrRef.id).get();
    abertas.docs.filter((d) => ['open', 'declared'].includes(d.data().status)).forEach((d) => batch.update(d.ref, { status: 'cancelled', cancelled_at_ms: ctx.now }));
    await batch.commit();
    return { ok: true };
  }

  if (acao === 'pass' || acao === 'fail') {
    if (enr.status !== 'confirmed') f.falha('failed-precondition', 'Só inscrição confirmada recebe resultado.');
    const batch = ctx.db.batch();
    batch.update(enrRef, { status: acao === 'pass' ? 'passed' : 'failed', graded_by: actor.uid, graded_at_ms: ctx.now, grade_note: f.texto(data.note, 300), updated_at_ms: ctx.now });
    let credentialId = null;
    if (acao === 'pass' && c.issues_credential === true) {
      const code = f.novoCodigo();
      const credRef = ctx.db.collection(f.C.credentials).doc(`${c.id}_${uid}`);
      credentialId = credRef.id;
      const meses = Math.trunc(Number(c.credential_months) || 0);
      batch.set(credRef, {
        federation_id: fed.id, federation_acronym: fed.acronym || '', user_id: uid, user_name: enr.user_name || '', photo_url: enr.photo_url || '',
        kind: c.kind || 'clinic', level: f.texto(c.level, 60), course_id: c.id, course_name: c.name, hours: Math.max(0, Math.trunc(Number(c.hours) || 0)),
        issued_at: hoje, valid_until: meses > 0 ? m.addMonthsISO(hoje, meses) : '', status: 'active', public: false, public_photo: true, code,
        issued_by: actor.uid, created_at_ms: ctx.now, updated_at_ms: ctx.now,
      });
      batch.set(ctx.db.collection(f.C.cardIndex).doc(code), { kind: 'credential', credential_id: credRef.id, federation_id: fed.id, created_at_ms: ctx.now });
      f.aviso(ctx, batch, uid, { title: tx('Você foi aprovado no curso {curso}', { curso: c.name }), message: tx('A credencial da {sigla} está na sua Minha área → Federações, com código verificável. Você escolhe se ela aparece no diretório público.', { sigla: fed.acronym }), link: '/perfil?secao=federacoes' });
    } else {
      f.aviso(ctx, batch, uid, acao === 'pass'
        ? { title: tx('Você concluiu o curso {curso}', { curso: c.name }), message: tx('A {sigla} registrou sua aprovação.', { sigla: fed.acronym }), link: '/perfil?secao=federacoes' }
        : { title: tx('Resultado do curso {curso}', { curso: c.name }), message: tx('A {sigla} registrou que você não foi aprovado desta vez.', { sigla: fed.acronym }), link: '/perfil?secao=federacoes' });
    }
    await batch.commit();
    // Curso de proteção de menores aprovado: a liberação (curso + certidão) da pessoa é refeita na hora.
    if (acao === 'pass' && c.kind === 'safeguarding') await require('./federationCoaching.js').refreshClearance(ctx, fed, uid);
    await f.auditoria(ctx, actor, `federation_course_${acao}`, { federation_id: fed.id, course_id: c.id, user_id: uid, credential_id: credentialId });
    return { ok: true, credentialId };
  }
  return f.falha('invalid-argument', 'Ação desconhecida.');
}

module.exports = { course };
