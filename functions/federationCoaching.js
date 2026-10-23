/**
 * LICENÇA DE PROFESSOR (módulo `coach_licenses`) e PROTEÇÃO DE MENORES
 * (módulo `safeguarding`) — Bloco 4. Só o SERVIDOR grava
 * `federation_coach_licenses`, `federation_coach_badges` e
 * `federation_safeguarding` (a regra é `allow write: if false`): a licença
 * confere credenciais, horas de curso e a proteção de menores, que são dados
 * de outras coleções; o selo é público e só pode dizer o que vale; e a
 * certidão de antecedentes é dado sensível — só o responsável pela proteção
 * (permissão `safeguarding`) a confere, e o arquivo é APAGADO quando a
 * conferência é registrada (fica a data, a validade e quem conferiu).
 *
 * Callable `federationCoaching` (a ação diz o módulo):
 *  - licença, do PROFESSOR: `me` (situação da licença e da proteção nesta
 *    federação), `license_apply` (pedir ou pedir a renovação), `license_prefs`
 *    (o selo aparece ou não no perfil);
 *  - licença, da EQUIPE (`courses` ou `admin`): `license_rules`,
 *    `license_check`, `license_grant` (falta de credencial/horas só com motivo
 *    escrito; falta de proteção de menores nunca), `license_decline`,
 *    `license_suspend`, `license_reinstate`, `license_revoke`, `license_list`;
 *  - proteção, da PESSOA: `sg_submit` (a certidão, do Storage da própria pessoa);
 *  - proteção, do RESPONSÁVEL (`safeguarding`): `sg_rules`, `sg_verify`,
 *    `sg_revoke`, `sg_overview` (quem trabalha com menores e se está em dia).
 *
 * Também: `clearanceBlocker` (a escala de arbitragem e a chancela com diretor
 * credenciado perguntam), `refreshClearance` (depois de aprovar o curso de
 * proteção), `onReportCreated` (denúncia de proteção de menor avisa o
 * responsável na hora) e `sweep` (avisa a licença e a certidão que vencem,
 * tira do perfil o selo vencido).
 */
const P = require('./federationCoachingPolicy.js');
const f = require('./federations.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const LIC = 'federation_coach_licenses';
const BADGES = 'federation_coach_badges';
const SG = 'federation_safeguarding';
const LINK_PESSOA = '/perfil?secao=federacoes&ancora=federacoes-licenca';
const linkLicencas = (fed) => `/federacoes/${fed.id}/gerir?aba=licencas`;
const linkProtecao = (fed) => `/federacoes/${fed.id}/gerir?aba=protecao`;
const br = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) && iso !== P.SG_FOREVER ? iso.split('-').reverse().join('/') : '');
const sigla = (fed) => fed.acronym || fed.name || '';
const PATH_ARQUIVO = (uid) => new RegExp(`^federacao/${uid.replace(/[^A-Za-z0-9_-]/g, '')}/[A-Za-z0-9_-]+\\.(pdf|jpg|jpeg|png|webp)$`);
const MAX_BYTES = 5 * 1024 * 1024;

const ACOES = {
  me: 'any', license_apply: 'coach', license_prefs: 'coach',
  license_rules: 'coach', license_check: 'coach', license_grant: 'coach', license_decline: 'coach', license_suspend: 'coach', license_reinstate: 'coach', license_revoke: 'coach', license_list: 'coach',
  sg_submit: 'sg', sg_rules: 'sg', sg_verify: 'sg', sg_revoke: 'sg', sg_overview: 'sg', sg_file: 'sg',
};

async function contexto(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  const mods = fed.modules || {};
  const modulo = ACOES[data.action];
  if (modulo === 'coach' && mods.coach_licenses !== true) falha('failed-precondition', 'Esta federação não tem a licença de professor ligada.');
  if (modulo === 'sg' && mods.safeguarding !== true) falha('failed-precondition', 'Esta federação não tem a proteção de menores ligada.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  return { fed, perms, hoje: P.isoDateBR(ctx.now), rules: P.normalizeCoachRules(fed.coach_rules), sgRules: P.normalizeSgRules(fed.safeguarding_rules) };
}

const exigeLicencas = (c) => { if (!c.perms.includes('courses') && !c.perms.includes('admin')) falha('permission-denied', 'Você não tem permissão para as licenças de professor desta federação.'); };
const exigeProtecao = (c) => { if (!c.perms.includes('safeguarding')) falha('permission-denied', 'Só o responsável pela proteção de menores vê e confere isso.'); };

async function perfil(ctx, uid) {
  const snap = await ctx.db.collection('users').doc(uid).get();
  if (!snap.exists) falha('not-found', 'Conta não encontrada.');
  const u = snap.data();
  return { name: texto(u.platform_name || u.full_name || u.display_name || 'Professor(a)', 120), photo_url: texto(u.photo_url || u.avatar_url, 500), city: texto(u.city, 80), state: texto(u.state, 2).toUpperCase() };
}

async function licenca(ctx, fed, uid) {
  const ref = ctx.db.collection(LIC).doc(`${fed.id}_${texto(uid, 128)}`);
  const snap = await ref.get();
  return { ref, lic: snap.exists ? { id: snap.id, ...snap.data() } : null };
}

async function registro(ctx, fed, uid) {
  const ref = ctx.db.collection(SG).doc(`${fed.id}_${texto(uid, 128)}`);
  const snap = await ref.get();
  return { ref, rec: snap.exists ? { id: snap.id, ...snap.data() } : null };
}

/* ----------------------------------------------------------- proteção -- */

/** A proteção de menores HOJE de uma pessoa nesta federação (lida do banco). */
async function situacao(ctx, fed, uid, hoje = P.isoDateBR(ctx.now)) {
  const [creds, { ref, rec }] = await Promise.all([
    ctx.db.collection(f.C.credentials).where('user_id', '==', uid).get(),
    registro(ctx, fed, uid),
  ]);
  const training = P.trainingUntil(creds.docs.map((d) => d.data()), fed.id, hoje);
  return { ref, rec, training, ...P.clearance({ training, record: rec, hoje }) };
}

/**
 * Grava a data até quando a pessoa está liberada (`safeguarding_until`) no
 * registro, na licença e no quadro de arbitragem desta federação — o que
 * existir. Nunca cria a licença nem o quadro.
 */
async function refreshClearance(ctx, fed, uid) {
  const s = await situacao(ctx, fed, uid);
  const alvos = [s.rec ? s.ref : null, ctx.db.collection(LIC).doc(`${fed.id}_${uid}`), ctx.db.collection('federation_referees').doc(`${fed.id}_${uid}`)].filter(Boolean);
  const snaps = await Promise.all(alvos.map((r) => r.get()));
  const batch = ctx.db.batch();
  let n = 0;
  snaps.forEach((snap, i) => {
    if (!snap.exists) return;
    const campo = alvos[i] === s.ref ? 'cleared_until' : 'safeguarding_until';
    if ((snap.data()[campo] || '') === s.until && (alvos[i] !== s.ref || (snap.data().training_until || '') === s.training)) return;
    batch.update(alvos[i], alvos[i] === s.ref ? { cleared_until: s.until, training_until: s.training, updated_at_ms: ctx.now } : { safeguarding_until: s.until });
    n += 1;
  });
  if (n) await batch.commit();
  return s.until;
}

const PAPEL = { coach: 'professor', referee: 'árbitro', director: 'diretor de torneio', staff: 'equipe', ambassador: 'embaixador' };

/** O que impede a pessoa de trabalhar com menores neste papel (`null` = nada). */
async function clearanceBlocker(ctx, fed, uid, role) {
  if (!P.sgRequired(fed, role)) return null;
  const s = await situacao(ctx, fed, uid);
  if (s.ok) return null;
  const falta = [!s.training.ok && 'o curso de proteção de menores válido', !s.background.valid && 'a certidão de antecedentes conferida'].filter(Boolean).join(' e ');
  return `A ${sigla(fed)} exige proteção de menores em dia para ${PAPEL[role] || role}: falta ${falta}.`;
}

/* -------------------------------------------------------------- selo -- */

/** Refaz o selo público do professor a partir das licenças dele (todas as federações). */
async function recomputeBadge(ctx, uid) {
  const hoje = P.isoDateBR(ctx.now);
  const lics = (await ctx.db.collection(LIC).where('user_id', '==', uid).get()).docs.map((d) => d.data());
  const feds = await Promise.all([...new Set(lics.map((l) => l.federation_id))].map((id) => ctx.db.collection(f.C.federations).doc(id).get()));
  const porId = new Map(feds.filter((s) => s.exists).map((s) => [s.id, { id: s.id, ...s.data() }]));
  const badges = lics.map((l) => {
    const fed = porId.get(l.federation_id);
    return fed && fed.modules && fed.modules.coach_licenses === true ? P.badgeOf(l, fed, hoje) : null;
  }).filter(Boolean).sort((a, b) => a.acronym.localeCompare(b.acronym, 'pt-BR'));
  const ref = ctx.db.collection(BADGES).doc(uid);
  if (!badges.length) { await ref.delete(); return []; }
  const quem = lics[0] || {};
  await ref.set({ user_id: uid, name: texto(quem.name, 120), photo_url: texto(quem.photo_url, 500), badges, federation_ids: badges.map((b) => b.federation_id), updated_at_ms: ctx.now });
  return badges;
}

/* ------------------------------------------------------------ licença -- */

/** As credenciais e as horas de curso aprovado da pessoa nesta federação. */
async function historico(ctx, fed, uid) {
  const [creds, enrs] = await Promise.all([
    ctx.db.collection(f.C.credentials).where('user_id', '==', uid).get(),
    ctx.db.collection(f.C.enrollments).where('user_id', '==', uid).get(),
  ]);
  const credentials = creds.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.federation_id === fed.id);
  const aprovadas = enrs.docs.map((d) => d.data()).filter((e) => e.federation_id === fed.id && e.status === 'passed');
  const cursos = await Promise.all([...new Set(aprovadas.map((e) => e.course_id))].map((id) => ctx.db.collection(f.C.courses).doc(id).get()));
  const horas = new Map(cursos.filter((s) => s.exists).map((s) => [s.id, Math.max(0, Math.trunc(Number(s.data().hours) || 0))]));
  const hourEntries = aprovadas.map((e) => ({ date: P.isoDateBR(Number(e.graded_at_ms) || ctx.now), hours: horas.get(e.course_id) || 0 }));
  return { credentials, hourEntries };
}

async function requisitos(ctx, fed, uid, levelId, rules, hoje) {
  const [{ credentials, hourEntries }, s] = await Promise.all([historico(ctx, fed, uid), situacao(ctx, fed, uid, hoje)]);
  return P.licenseRequirements({ rules, levelId, credentials, hourEntries, safeguarding: { required: P.sgRequired(fed, 'coach'), until: s.until }, hoje });
}

const evento = (ctx, actor, kind, extra = {}) => ({ kind, at_ms: ctx.now, by: actor.uid, ...extra });
const comHistorico = (lic, ev) => [...(Array.isArray(lic && lic.history) ? lic.history : []), ev].slice(-30);

async function avisarEquipe(ctx, batch, fed, perm, msg, menos) {
  (await f.staffIds(ctx, fed.id, perm)).filter((u) => u !== menos).forEach((u) => f.aviso(ctx, batch, u, msg));
}

async function me(ctx, actor, data, c) {
  const { fed, hoje, rules } = c;
  const mods = fed.modules || {};
  const out = { ok: true, coach_licenses: mods.coach_licenses === true, safeguarding: mods.safeguarding === true };
  const s = await situacao(ctx, fed, actor.uid, hoje);
  if (out.coach_licenses) {
    const [{ lic }, { credentials, hourEntries }] = await Promise.all([licenca(ctx, fed, actor.uid), historico(ctx, fed, actor.uid)]);
    const sg = { required: P.sgRequired(fed, 'coach'), until: s.until };
    out.license = lic;
    out.levels = rules.levels.map((l) => ({ ...l, requirements: P.licenseRequirements({ rules, levelId: l.id, credentials, hourEntries, safeguarding: sg, hoje }) }));
  }
  if (out.safeguarding) {
    // Só o que a pessoa precisa: datas e motivo; nem o caminho do arquivo nem quem conferiu.
    const r = s.rec || {};
    const pend = r.pending_background;
    out.sg = {
      rules: c.sgRules, training_until: s.training, ok: s.ok, until: s.until, background: s.background,
      pending: pend ? { issued_at: pend.issued_at, valid_until: pend.valid_until, submitted_at_ms: pend.submitted_at_ms } : null,
      last_rejection: r.last_rejection ? { reason: r.last_rejection.reason, at_ms: r.last_rejection.at_ms } : null,
      revoked_reason: r.background && r.background.status === 'revoked' ? r.background.revoked_reason || '' : '',
    };
  }
  return out;
}

async function exigeAcesso(ctx, actor, c) {
  if (f.publicada(c.fed) || c.perms.length) return;
  const ms = await ctx.db.collection(f.C.members).doc(`${c.fed.id}_${actor.uid}`).get();
  if (!(ms.exists && ms.data().status === 'active')) falha('failed-precondition', 'Esta federação ainda não está aberta ao público.');
}

async function licenseApply(ctx, actor, data, c) {
  const { fed, rules, hoje } = c;
  await exigeAcesso(ctx, actor, c);
  const level = P.coachLevel(rules, texto(data.level, 20));
  if (!level) falha('invalid-argument', 'Escolha o nível da licença.');
  const { ref, lic } = await licenca(ctx, fed, actor.uid);
  const st = P.licenseState(lic, hoje);
  if (lic && lic.status === 'pending') falha('already-exists', 'Seu pedido de licença já está em análise.');
  if (lic && ['suspended', 'revoked'].includes(lic.status)) falha('failed-precondition', 'Sua licença está suspensa ou cassada: fale com a federação.');
  if (!st.canApply) falha('failed-precondition', 'Seu pedido de renovação já está em análise.');
  const note = texto(data.note, P.LICENSE_LIMITS.NOTE_MAX);
  const renovar = st.valid;
  const batch = ctx.db.batch();
  if (renovar) {
    batch.update(ref, { renewal_requested_at_ms: ctx.now, requested_level: level.id, requested_level_label: level.label, request_note: note, updated_at_ms: ctx.now, history: comHistorico(lic, evento(ctx, actor, 'renewal_requested', { level: level.id })) });
  } else {
    const p = await perfil(ctx, actor.uid);
    batch.set(ref, {
      federation_id: fed.id, federation_acronym: fed.acronym || '', federation_name: fed.name || '', user_id: actor.uid, ...p,
      status: 'pending', level: level.id, level_label: level.label, requested_level: level.id, requested_level_label: level.label, request_note: note,
      requested_at_ms: ctx.now, renewal_requested_at_ms: null, valid_until: lic ? lic.valid_until || '' : '', public_listing: lic ? lic.public_listing !== false : true,
      granted_at_ms: lic ? lic.granted_at_ms || null : null, waiver: null, decision_reason: '', safeguarding_until: '',
      history: comHistorico(lic, evento(ctx, actor, 'requested', { level: level.id })), created_at_ms: lic ? lic.created_at_ms || ctx.now : ctx.now, updated_at_ms: ctx.now,
    });
  }
  await avisarEquipe(ctx, batch, fed, 'courses', {
    title: renovar ? tx('Pedido de renovação de licença: {nome}', { nome: texto(lic.name, 120) }) : tx('Novo pedido de licença de professor'),
    message: tx('{nivel} na {sigla}. Confira os requisitos em Professores → Licenças.', { nivel: level.label, sigla: sigla(fed) }),
    link: linkLicencas(fed),
  }, actor.uid);
  await batch.commit();
  await refreshClearance(ctx, fed, actor.uid);
  await f.auditoria(ctx, actor, renovar ? 'federation_coach_license_renewal_request' : 'federation_coach_license_request', { federation_id: fed.id, user_id: actor.uid, level: level.id });
  return { ok: true, renewal: renovar };
}

async function licensePrefs(ctx, actor, data, c) {
  const { ref, lic } = await licenca(ctx, c.fed, actor.uid);
  if (!lic) falha('not-found', 'Você não tem licença nesta federação.');
  if (typeof data.publicListing !== 'boolean') falha('invalid-argument', 'Diga se o selo aparece no seu perfil.');
  await ref.update({ public_listing: data.publicListing, updated_at_ms: ctx.now });
  await recomputeBadge(ctx, actor.uid);
  return { ok: true };
}

async function licenseRules(ctx, actor, data, c) {
  exigeLicencas(c);
  const r = P.validateCoachRules(data.rules || {});
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]);
  await ctx.db.collection(f.C.federations).doc(c.fed.id).update({ coach_rules: r.value, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  await f.auditoria(ctx, actor, 'federation_coach_rules', { federation_id: c.fed.id, levels: r.value.levels.length });
  return { ok: true, rules: r.value };
}

async function licenseCheck(ctx, actor, data, c) {
  exigeLicencas(c);
  const uid = texto(data.userId, 128);
  if (!uid) falha('invalid-argument', 'Escolha a pessoa.');
  return { ok: true, requirements: await requisitos(ctx, c.fed, uid, texto(data.level, 20), c.rules, c.hoje) };
}

async function licenseList(ctx, actor, data, c) {
  exigeLicencas(c);
  const lics = (await ctx.db.collection(LIC).where('federation_id', '==', c.fed.id).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  return { ok: true, licenses: lics };
}

async function licenseGrant(ctx, actor, data, c) {
  exigeLicencas(c);
  const { fed, rules, hoje } = c;
  const uid = texto(data.userId, 128);
  if (!uid) falha('invalid-argument', 'Escolha a pessoa.');
  if (uid === actor.uid) falha('permission-denied', 'Você não concede a sua própria licença: outra pessoa da equipe confere.');
  const { ref, lic } = await licenca(ctx, fed, uid);
  if (lic && ['suspended', 'revoked'].includes(lic.status)) falha('failed-precondition', 'Licença suspensa ou cassada: reative antes.');
  const st = P.licenseState(lic, hoje);
  if (st.valid && !st.renewing && !data.level) falha('failed-precondition', 'A licença está em dia e sem pedido de renovação.');
  const level = P.coachLevel(rules, texto(data.level || (lic && (lic.requested_level || lic.level)), 20));
  if (!level) falha('invalid-argument', 'Escolha o nível da licença.');
  const req = await requisitos(ctx, fed, uid, level.id, rules, hoje);
  if (req.missing.includes(P.LICENSE_REQ.SAFEGUARDING)) falha('failed-precondition', 'Falta a proteção de menores em dia (curso e certidão): isso não se dispensa.');
  const motivo = texto(data.waiverReason, P.LICENSE_LIMITS.REASON_MAX);
  if (req.waivable.length && motivo.length < P.LICENSE_LIMITS.WAIVER_MIN) falha('failed-precondition', 'Faltam requisitos: escreva o motivo da dispensa (pelo menos 10 letras) para conceder assim mesmo.');
  const validUntil = P.nextValidUntil(lic, level, hoje);
  const p = lic ? { name: lic.name, photo_url: lic.photo_url || '', city: lic.city || '', state: lic.state || '' } : await perfil(ctx, uid);
  const waiver = req.waivable.length ? { missing: req.waivable, reason: motivo, by: actor.uid, at_ms: ctx.now } : null;
  const batch = ctx.db.batch();
  batch.set(ref, {
    federation_id: fed.id, federation_acronym: fed.acronym || '', federation_name: fed.name || '', user_id: uid, ...p,
    status: 'active', level: level.id, level_label: level.label, valid_until: validUntil, granted_at_ms: lic && st.valid ? lic.granted_at_ms || ctx.now : ctx.now,
    renewed_at_ms: st.valid ? ctx.now : null, granted_by: actor.uid, requested_level: null, requested_level_label: null, renewal_requested_at_ms: null,
    public_listing: lic ? lic.public_listing !== false : true, waiver, decision_reason: '', expiry_warned_for: '', badge_expired_for: '',
    history: comHistorico(lic, evento(ctx, actor, st.valid ? 'renewed' : 'granted', { level: level.id, valid_until: validUntil, waived: req.waivable })),
    created_at_ms: lic ? lic.created_at_ms || ctx.now : ctx.now, updated_at_ms: ctx.now,
  }, { merge: true });
  f.aviso(ctx, batch, uid, {
    title: st.valid ? tx('Sua licença de professor da {sigla} foi renovada', { sigla: sigla(fed) }) : tx('Você é professor licenciado pela {sigla}', { sigla: sigla(fed) }),
    message: tx('{nivel}, válida até {data}. O selo aparece no seu perfil de professor; você escolhe em Minha área → Federações.', { nivel: level.label, data: br(validUntil) }),
    link: LINK_PESSOA,
  });
  await batch.commit();
  await refreshClearance(ctx, fed, uid);
  await recomputeBadge(ctx, uid);
  await f.auditoria(ctx, actor, st.valid ? 'federation_coach_license_renew' : 'federation_coach_license_grant', { federation_id: fed.id, user_id: uid, level: level.id, valid_until: validUntil, waived: req.waivable, waiver_reason: motivo || null });
  return { ok: true, valid_until: validUntil, waived: req.waivable };
}

// Os textos do aviso são `tx` literais para o catálogo do push os achar.
const DECISOES = {
  license_decline: { de: ['pending', 'renewing'], kind: 'declined', aviso: (s, m) => [tx('Pedido de licença recusado pela {sigla}', { sigla: s }), tx('Motivo: {motivo}', { motivo: m })] },
  license_suspend: { de: ['active'], para: 'suspended', kind: 'suspended', aviso: (s, m) => [tx('Sua licença de professor da {sigla} foi suspensa', { sigla: s }), tx('Motivo: {motivo}. O selo saiu do seu perfil.', { motivo: m })] },
  license_reinstate: { de: ['suspended'], para: 'active', kind: 'reinstated', semMotivo: true, aviso: (s) => [tx('Sua licença de professor da {sigla} foi reativada', { sigla: s }), tx('O selo voltou ao seu perfil enquanto a licença valer.')] },
  license_revoke: { de: ['active', 'suspended', 'pending'], para: 'revoked', kind: 'revoked', aviso: (s, m) => [tx('Sua licença de professor da {sigla} foi cassada', { sigla: s }), tx('Motivo: {motivo}.', { motivo: m })] },
};

async function licenseDecide(ctx, actor, data, c) {
  exigeLicencas(c);
  const d = DECISOES[data.action];
  const { fed, hoje } = c;
  const uid = texto(data.userId, 128);
  const { ref, lic } = await licenca(ctx, fed, uid);
  if (!lic) falha('not-found', 'Licença não encontrada.');
  const renovando = P.licenseState(lic, hoje).renewing;
  const de = renovando && data.action === 'license_decline' ? 'renewing' : lic.status;
  if (!d.de.includes(de)) falha('failed-precondition', 'A licença não está numa situação que permita isso.');
  const motivo = texto(data.reason, P.LICENSE_LIMITS.REASON_MAX);
  if (!d.semMotivo && motivo.length < 3) falha('invalid-argument', 'Diga o motivo: ele vai no aviso ao professor.');
  const patch = { updated_at_ms: ctx.now, decision_reason: motivo, history: comHistorico(lic, evento(ctx, actor, d.kind, { reason: motivo })) };
  if (de === 'renewing') Object.assign(patch, { renewal_requested_at_ms: null, requested_level: null, requested_level_label: null });
  else if (d.para) patch.status = d.para;
  else patch.status = 'declined';
  const batch = ctx.db.batch();
  batch.update(ref, patch);
  const [title, message] = d.aviso(sigla(fed), motivo);
  f.aviso(ctx, batch, uid, { title, message, link: LINK_PESSOA });
  await batch.commit();
  await recomputeBadge(ctx, uid);
  await f.auditoria(ctx, actor, `federation_coach_${data.action}`, { federation_id: fed.id, user_id: uid, reason: motivo || null, renewal: de === 'renewing' });
  return { ok: true };
}

/* ------------------------------------------------------ certidão (pessoa) -- */

async function sgSubmit(ctx, actor, data, c) {
  const { fed, hoje, sgRules } = c;
  await exigeAcesso(ctx, actor, c);
  const issued = texto(data.issuedAt, 10);
  const v = P.validateBackgroundSubmit({ issued_at: issued, hoje, rules: sgRules });
  if (!v.ok) falha('invalid-argument', Object.values(v.errors)[0]);
  const path = texto(data.filePath, 200);
  if (!PATH_ARQUIVO(actor.uid).test(path)) falha('invalid-argument', 'Envie a certidão pela tela (PDF ou foto, até 5 MB).');
  const { ref, rec } = await registro(ctx, fed, actor.uid);
  const antigo = rec && rec.pending_background && rec.pending_background.file_path;
  const p = rec ? { name: rec.name, photo_url: rec.photo_url || '' } : await perfil(ctx, actor.uid);
  const batch = ctx.db.batch();
  batch.set(ref, {
    federation_id: fed.id, federation_acronym: fed.acronym || '', user_id: actor.uid, name: p.name, photo_url: p.photo_url || '',
    pending_background: { issued_at: issued, valid_until: P.backgroundDefaultUntil(issued, sgRules), file_path: path, submitted_at_ms: ctx.now },
    created_at_ms: rec ? rec.created_at_ms || ctx.now : ctx.now, updated_at_ms: ctx.now,
  }, { merge: true });
  await avisarEquipe(ctx, batch, fed, 'safeguarding', {
    title: tx('Certidão de antecedentes para conferir'),
    message: tx('{nome} enviou a certidão na {sigla}. Confira em Proteção de menores.', { nome: p.name, sigla: sigla(fed) }),
    link: linkProtecao(fed),
  }, actor.uid);
  await batch.commit();
  if (antigo && antigo !== path && ctx.bucket) await ctx.bucket.file(antigo).delete().catch(() => null);
  await f.auditoria(ctx, actor, 'federation_safeguarding_submit', { federation_id: fed.id, user_id: actor.uid });
  return { ok: true };
}

/* ------------------------------------------------- responsável pela proteção -- */

async function sgRules(ctx, actor, data, c) {
  exigeProtecao(c);
  const r = P.validateSgRules(data.rules || {});
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]);
  await ctx.db.collection(f.C.federations).doc(c.fed.id).update({ safeguarding_rules: r.value, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  await f.auditoria(ctx, actor, 'federation_safeguarding_rules', { federation_id: c.fed.id, ...r.value });
  return { ok: true, rules: r.value };
}

async function sgVerify(ctx, actor, data, c) {
  exigeProtecao(c);
  const { fed, hoje } = c;
  const uid = texto(data.userId, 128);
  if (uid === actor.uid) falha('permission-denied', 'Você não confere a sua própria certidão: outra pessoa responsável confere.');
  const { ref, rec } = await registro(ctx, fed, uid);
  const pend = rec && rec.pending_background;
  if (!pend) falha('failed-precondition', 'Não há certidão esperando conferência.');
  const valida = data.decision === 'valid';
  if (!valida && data.decision !== 'rejected') falha('invalid-argument', 'Escolha: conferida ou não aceita.');
  const motivo = texto(data.reason, P.SG_LIMITS.NOTE_MAX);
  if (!valida && motivo.length < P.SG_LIMITS.REASON_MIN) falha('invalid-argument', 'Diga por que a certidão não foi aceita: o motivo vai para a pessoa.');
  let until = pend.valid_until;
  if (valida && data.validUntil) {
    until = texto(data.validUntil, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || until < hoje) falha('invalid-argument', 'A validade da certidão tem de ser hoje ou depois.');
  }
  if (valida && until < hoje) falha('failed-precondition', 'Esta certidão já venceu: peça uma nova.');
  const patch = { pending_background: ctx.FieldValue.delete(), updated_at_ms: ctx.now };
  if (valida) patch.background = { status: 'valid', issued_at: pend.issued_at, valid_until: until, verified_by: actor.uid, verified_at_ms: ctx.now, expiry_warned_for: '' };
  else patch.last_rejection = { reason: motivo, at_ms: ctx.now, by: actor.uid };
  const batch = ctx.db.batch();
  batch.update(ref, patch);
  f.aviso(ctx, batch, uid, valida
    ? { title: tx('Sua certidão de antecedentes foi conferida pela {sigla}', { sigla: sigla(fed) }), message: tx('Vale até {data}. O arquivo foi apagado; a federação guarda só a conferência.', { data: br(until) }), link: LINK_PESSOA }
    : { title: tx('Sua certidão de antecedentes não foi aceita pela {sigla}', { sigla: sigla(fed) }), message: tx('Motivo: {motivo}. Envie outra em Minha área → Federações.', { motivo }), link: LINK_PESSOA });
  await batch.commit();
  // Minimização: decidida a conferência, o arquivo sai do Storage.
  if (ctx.bucket && pend.file_path) await ctx.bucket.file(pend.file_path).delete().catch(() => null);
  await refreshClearance(ctx, fed, uid);
  await f.auditoria(ctx, actor, 'federation_safeguarding_verify', { federation_id: fed.id, user_id: uid, decision: data.decision, valid_until: valida ? until : null });
  return { ok: true };
}

async function sgRevoke(ctx, actor, data, c) {
  exigeProtecao(c);
  const { fed } = c;
  const uid = texto(data.userId, 128);
  const { ref, rec } = await registro(ctx, fed, uid);
  if (!(rec && rec.background && rec.background.status === 'valid')) falha('failed-precondition', 'Não há certidão conferida para revogar.');
  const motivo = texto(data.reason, P.SG_LIMITS.NOTE_MAX);
  if (motivo.length < P.SG_LIMITS.REASON_MIN) falha('invalid-argument', 'Diga o motivo da revogação.');
  const batch = ctx.db.batch();
  batch.update(ref, { background: { ...rec.background, status: 'revoked', revoked_reason: motivo, revoked_by: actor.uid, revoked_at_ms: ctx.now }, updated_at_ms: ctx.now });
  f.aviso(ctx, batch, uid, { title: tx('A {sigla} revogou a conferência da sua certidão', { sigla: sigla(fed) }), message: tx('Motivo: {motivo}. Até enviar uma nova certidão, você não pode trabalhar com menores pela federação.', { motivo }), link: LINK_PESSOA });
  await batch.commit();
  await refreshClearance(ctx, fed, uid);
  await f.auditoria(ctx, actor, 'federation_safeguarding_revoke', { federation_id: fed.id, user_id: uid, reason: motivo });
  return { ok: true };
}

/** O arquivo da certidão em conferência: só o responsável (e a própria pessoa) abre; ver é auditado. */
async function backgroundFile(ctx, actor, data, c) {
  const uid = texto(data.userId || actor.uid, 128);
  const dono = uid === actor.uid;
  if (!dono) exigeProtecao(c);
  const { rec } = await registro(ctx, c.fed, uid);
  const path = rec && rec.pending_background && rec.pending_background.file_path;
  if (!path) falha('not-found', 'Não há certidão em conferência.');
  if (!PATH_ARQUIVO(uid).test(path)) falha('failed-precondition', 'Caminho do arquivo inválido.');
  if (!ctx.bucket) falha('unavailable', 'Arquivos indisponíveis no momento.');
  const file = ctx.bucket.file(path);
  const [meta] = await file.getMetadata().catch(() => [null]);
  if (!meta) falha('not-found', 'O arquivo não está mais no servidor.');
  if (Number(meta.size) > MAX_BYTES) falha('failed-precondition', 'Arquivo maior que o permitido.');
  const [bytes] = await file.download();
  if (!dono) await f.auditoria(ctx, actor, 'federation_safeguarding_file_view', { federation_id: c.fed.id, user_id: uid });
  return { ok: true, contentType: meta.contentType || 'application/octet-stream', base64: Buffer.from(bytes).toString('base64') };
}

/** Quem trabalha com menores nesta federação e se está em dia. */
async function sgOverview(ctx, actor, data, c) {
  exigeProtecao(c);
  const { fed, hoje, sgRules: regra } = c;
  const daFed = (col) => ctx.db.collection(col).where('federation_id', '==', fed.id).get();
  const mods = fed.modules || {};
  const [lics, refs, creds, staff, recs, ambs] = await Promise.all([daFed(LIC), daFed('federation_referees'), daFed(f.C.credentials), daFed(f.C.staff), daFed(SG), mods.ambassadors === true ? daFed('federation_ambassadors') : null]);
  const pessoas = new Map();
  const add = (uid, role, name, photo) => {
    if (!uid) return;
    if (!pessoas.has(uid)) pessoas.set(uid, { user_id: uid, name: '', photo_url: '', roles: [] });
    const p = pessoas.get(uid);
    if (role && !p.roles.includes(role)) p.roles.push(role);
    if (!p.name && name) p.name = texto(name, 120);
    if (!p.photo_url && photo) p.photo_url = texto(photo, 500);
  };
  if (mods.coach_licenses === true) lics.docs.map((d) => d.data()).filter((l) => ['pending', 'active'].includes(l.status)).forEach((l) => add(l.user_id, 'coach', l.name, l.photo_url));
  refs.docs.map((d) => d.data()).filter((r) => r.status === 'active').forEach((r) => {
    add(r.user_id, 'referee', r.name, r.photo_url);
    if (Array.isArray(r.functions) && r.functions.includes('tournament_director')) add(r.user_id, 'director', r.name, r.photo_url);
  });
  const credList = creds.docs.map((d) => d.data());
  credList.filter((x) => x.kind === 'director' && P.credentialValid(x, hoje)).forEach((x) => add(x.user_id, 'director', x.user_name, x.photo_url));
  // Embaixadores (rodada 3, Bloco 3): candidatos e nomeados entram no quadro de quem trabalha com menores.
  if (ambs) ambs.docs.map((d) => d.data()).filter((a) => ['applied', 'appointed'].includes(a.status)).forEach((a) => add(a.user_id, 'ambassador', a.user_name, a.photo_url));
  if (regra.required_for.includes('staff')) staff.docs.map((d) => d.data()).forEach((s) => add(s.user_id, 'staff', s.user_name, s.photo_url));
  const porUid = new Map(recs.docs.map((d) => [d.data().user_id, d.data()]));
  porUid.forEach((r, uid) => add(uid, null, r.name, r.photo_url));
  const credsDe = new Map();
  credList.forEach((x) => { if (!credsDe.has(x.user_id)) credsDe.set(x.user_id, []); credsDe.get(x.user_id).push(x); });
  const rows = [...pessoas.values()].map((p) => {
    const rec = porUid.get(p.user_id) || null;
    const training = P.trainingUntil(credsDe.get(p.user_id) || [], fed.id, hoje);
    const cl = P.clearance({ training, record: rec, hoje });
    const pend = rec && rec.pending_background;
    return {
      ...p, required: p.roles.some((r) => regra.required_for.includes(r)), training_until: cl.training.until, training_ok: cl.training.ok,
      background: cl.background, pending: pend ? { issued_at: pend.issued_at, valid_until: pend.valid_until, submitted_at_ms: pend.submitted_at_ms } : null,
      last_rejection: rec && rec.last_rejection ? { reason: rec.last_rejection.reason, at_ms: rec.last_rejection.at_ms } : null, ok: cl.ok, until: cl.until,
    };
  });
  return { ok: true, rules: regra, rows };
}

const ROTAS = {
  me, license_apply: licenseApply, license_prefs: licensePrefs, license_rules: licenseRules, license_check: licenseCheck, license_list: licenseList, license_grant: licenseGrant,
  license_decline: licenseDecide, license_suspend: licenseDecide, license_reinstate: licenseDecide, license_revoke: licenseDecide,
  sg_submit: sgSubmit, sg_rules: sgRules, sg_verify: sgVerify, sg_revoke: sgRevoke, sg_overview: sgOverview, sg_file: backgroundFile,
};

async function coaching(ctx, actor, data = {}) {
  const fn = ROTAS[data.action];
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  const c = await contexto(ctx, actor, data);
  return fn(ctx, actor, data, c);
}

/* -------------------------------------------------------- denúncia -- */

/** Denúncia de proteção de menor: avisa na hora quem é responsável (o texto não vai no aviso). */
async function onReportCreated(ctx, report) {
  if (!report || report.kind !== 'minor_protection' || !report.federation_id) return { skipped: true };
  if (!(await f.flagLigada(ctx))) return { skipped: 'flag' };
  const snap = await ctx.db.collection(f.C.federations).doc(report.federation_id).get();
  if (!snap.exists) return { skipped: 'federation' };
  const fed = { id: snap.id, ...snap.data() };
  const uids = await f.staffIds(ctx, fed.id, 'safeguarding');
  if (!uids.length) return { notified: 0 };
  const batch = ctx.db.batch();
  uids.forEach((u) => f.aviso(ctx, batch, u, {
    title: tx('Denúncia de proteção de menor na {sigla}', { sigla: sigla(fed) }),
    message: tx('Prioridade: abra e trate em Proteção de menores → Denúncias. O conteúdo fica só lá.'),
    link: `/federacoes/${fed.id}/gerir?aba=protecao-denuncias`,
  }));
  await batch.commit();
  return { notified: uids.length };
}

/* -------------------------------------------------------------- sweep -- */

/**
 * Diária: avisa a licença que vence em 30 dias e a que venceu (uma vez por
 * validade), tira do perfil o selo vencido, avisa a certidão que vence e
 * refaz a data de liberação de todo registro.
 * ponytail: lê todas as licenças ativas e todos os registros de proteção;
 * por federação com índice se o volume crescer.
 */
async function sweep(ctx) {
  if (!(await f.flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = P.isoDateBR(ctx.now);
  const feds = {};
  const fedDe = async (id) => {
    if (!(id in feds)) { const s = await ctx.db.collection(f.C.federations).doc(id).get(); feds[id] = s.exists ? { id: s.id, ...s.data() } : null; }
    return feds[id];
  };
  const conta = { warned: 0, expired: 0, sg_warned: 0, refreshed: 0 };
  const ativas = await ctx.db.collection(LIC).where('status', '==', 'active').get();
  const selos = new Set();
  for (const d of ativas.docs) {
    const l = d.data();
    // eslint-disable-next-line no-await-in-loop
    const fed = await fedDe(l.federation_id);
    if (!fed || !(fed.modules && fed.modules.coach_licenses === true)) continue;
    const st = P.licenseState(l, hoje);
    const batch = ctx.db.batch();
    if (st.status === 'expired' && l.badge_expired_for !== l.valid_until) {
      batch.update(d.ref, { badge_expired_for: l.valid_until });
      f.aviso(ctx, batch, l.user_id, { title: tx('Sua licença de professor da {sigla} venceu', { sigla: sigla(fed) }), message: tx('O selo saiu do seu perfil. Peça a renovação em Minha área → Federações.'), link: LINK_PESSOA });
      selos.add(l.user_id);
      conta.expired += 1;
    } else if (st.expiring && !st.renewing && l.expiry_warned_for !== l.valid_until) {
      batch.update(d.ref, { expiry_warned_for: l.valid_until });
      f.aviso(ctx, batch, l.user_id, { title: tx('Sua licença de professor da {sigla} vence em {data}', { sigla: sigla(fed), data: br(l.valid_until) }), message: tx('Peça a renovação em Minha área → Federações; confira antes as horas de atualização e a proteção de menores.'), link: LINK_PESSOA });
      conta.warned += 1;
    } else continue;
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  const recs = await ctx.db.collection(SG).get();
  for (const d of recs.docs) {
    const r = d.data();
    // eslint-disable-next-line no-await-in-loop
    const fed = await fedDe(r.federation_id);
    if (!fed || !(fed.modules && fed.modules.safeguarding === true)) continue;
    const b = r.background;
    if (b && b.status === 'valid' && P.expiresSoon(b.valid_until, hoje) && b.expiry_warned_for !== b.valid_until) {
      const batch = ctx.db.batch();
      batch.update(d.ref, { 'background.expiry_warned_for': b.valid_until });
      f.aviso(ctx, batch, r.user_id, { title: tx('Sua certidão de antecedentes vence em {data}', { data: br(b.valid_until) }), message: tx('Envie a nova certidão à {sigla} em Minha área → Federações para continuar trabalhando com menores.', { sigla: sigla(fed) }), link: LINK_PESSOA });
      // eslint-disable-next-line no-await-in-loop
      await batch.commit();
      conta.sg_warned += 1;
    }
    const antes = r.cleared_until || '';
    // eslint-disable-next-line no-await-in-loop
    const depois = await refreshClearance(ctx, fed, r.user_id);
    if (antes !== depois) { conta.refreshed += 1; selos.add(r.user_id); }
  }
  for (const uid of selos) {
    // eslint-disable-next-line no-await-in-loop
    await recomputeBadge(ctx, uid);
  }
  if (ctx.logger) ctx.logger.info('Licenças e proteção de menores: varredura diária.', conta);
  return conta;
}

module.exports = { coaching, onReportCreated, sweep, refreshClearance, clearanceBlocker, recomputeBadge, LIC, BADGES, SG };
