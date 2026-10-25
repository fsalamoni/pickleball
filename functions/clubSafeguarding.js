/**
 * PROTEÇÃO DE MENORES DO CLUBE-ASSOCIAÇÃO (Bloco E2b, flag `club_association`) — quem trabalha
 * com crianças e adolescentes no clube precisa estar em dia (compromisso de conduta aceito +
 * certidão de antecedentes conferida), e o associado menor de idade tem o responsável legal
 * registrado. Só o SERVIDOR grava `club_x/{clube}/safeguard` e `club_x/{clube}/minors` (a regra
 * é `write: if false` nas duas espécies; lê quem tem a permissão `discipline`).
 *
 * É a proteção de menores da federação (`federationCoaching.js`) com o clube no lugar dela: a
 * régua da certidão é a MESMA (`federationCoachingPolicy.js`); no clube o compromisso de conduta
 * (versão aceita) ocupa o lugar do curso, que o clube não tem. A certidão enviada espera em
 * `pending_background`; conferida a decisão, o arquivo é APAGADO (fica a data, a validade e
 * quem conferiu). O arquivo é dado sensível: só a própria pessoa e a disciplina o abrem (e abrir
 * é auditado).
 *
 * Callable `clubSafeguarding`:
 *  - da PESSOA: `me`, `pledge` (aceitar o compromisso), `sg_submit` (a certidão, do Storage dela),
 *    `guardian_save` (o menor registra o responsável);
 *  - da DISCIPLINA (`discipline`/`admin`): `sg_rules`, `sg_overview`, `sg_verify`, `sg_revoke`,
 *    `sg_designate` (incluir/tirar um treinador ou voluntário do quadro), `sg_file`,
 *    `minors_overview`, `guardian_save` de outra pessoa.
 *
 * A varredura (junto da diária da associação) avisa a certidão que vence em 30 dias (uma vez por
 * validade) e apaga o responsável de quem completou 18 anos (minimização).
 */
const P = require('./federationCoachingPolicy.js');
const S = require('./clubSafeguardingPolicy.js');
const CS = require('./clubStaffPolicy.js');
const a = require('./clubAssociation.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto, col } = a;
const SG = 'safeguard';
const MINORS = 'minors';
const MAX_BYTES = 5 * 1024 * 1024;
const PATH_ARQUIVO = (uid) => new RegExp(`^clube-protecao/${uid.replace(/[^A-Za-z0-9_-]/g, '')}/[A-Za-z0-9_-]+\\.(pdf|jpg|jpeg|png|webp)$`);
const linkProtecao = (club) => `/clubes/${club.id}/gerir?aba=protecao`;
const linkMinha = (club) => `/clubes/${club.id}?aba=associacao`;
const br = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) && iso !== P.SG_FOREVER ? iso.split('-').reverse().join('/') : '');

async function contexto(ctx, actor, data) {
  await a.exigeFlag(ctx);
  const club = await a.clube(ctx, data.clubId);
  if (!(club.association && club.association.enabled === true)) falha('failed-precondition', 'Este clube ainda não abriu a associação.');
  const perms = await a.permsDe(ctx, club.id, actor.uid);
  return { club, perms, hoje: P.isoDateBR(ctx.now), rules: S.normalizeRules(club.association.safeguarding_rules) };
}

const exigeProtecao = (c) => { if (!c.perms.includes('discipline') && !c.perms.includes('admin')) falha('permission-denied', 'Só a disciplina e a administração do clube cuidam da proteção de menores.'); };

async function ehMembro(ctx, club, uid) {
  const m = await ctx.db.collection('club_members').doc(`${club.id}_${uid}`).get();
  return m.exists;
}

async function exigeMembro(ctx, club, uid) {
  if (!(await ehMembro(ctx, club, uid))) falha('failed-precondition', 'Só quem é do clube envia isso.');
}

async function registro(ctx, club, uid) {
  const ref = col(ctx, club.id, SG).doc(texto(uid, 128));
  const snap = await ref.get();
  return { ref, rec: snap.exists ? { id: snap.id, ...snap.data() } : null };
}

/** A proteção de menores HOJE de uma pessoa neste clube. */
async function situacao(ctx, club, uid, c) {
  const { ref, rec } = await registro(ctx, club, uid);
  return { ref, rec, ...S.clearance({ record: rec, rules: c.rules, hoje: c.hoje }) };
}

/** Quem tem cargo na diretoria (mandato valendo) — entra no quadro de quem precisa estar em dia. */
async function cargos(ctx, club) {
  const snap = await col(ctx, club.id, 'staff').get();
  return new Map(snap.docs.filter((d) => CS.termActive(d.data(), ctx.now)).map((d) => [d.id, d.data()]));
}

const resumoPendente = (rec) => (rec && rec.pending_background
  ? { issued_at: rec.pending_background.issued_at, valid_until: rec.pending_background.valid_until, submitted_at_ms: rec.pending_background.submitted_at_ms }
  : null);

/** Grava (ou cria) o registro da pessoa. `base` só vale na criação. */
async function gravarRegistro(ctx, club, uid, patch) {
  const { ref, rec } = await registro(ctx, club, uid);
  if (rec) { await ref.update({ ...patch, updated_at_ms: ctx.now }); return; }
  const p = await a.perfil(ctx, uid);
  await ref.set({ club_id: club.id, user_id: uid, name: p.nome, photo_url: p.foto, designated: false, designated_label: '', created_at_ms: ctx.now, ...patch, updated_at_ms: ctx.now });
}

/** Mantém `cleared_until` (a data até quando está liberada) no registro. */
async function refreshClearance(ctx, club, uid, c) {
  const s = await situacao(ctx, club, uid, c);
  if (s.rec && (s.rec.cleared_until || '') !== s.until) await s.ref.update({ cleared_until: s.until, updated_at_ms: ctx.now });
  return s.until;
}

/* ----------------------------------------------------------------- pessoa -- */

async function me(ctx, actor, data, c) {
  const { club, rules, hoje } = c;
  const [s, cargo, perfil, menor, membro] = await Promise.all([
    situacao(ctx, club, actor.uid, c),
    col(ctx, club.id, 'staff').doc(actor.uid).get(),
    a.perfil(ctx, actor.uid),
    col(ctx, club.id, MINORS).doc(actor.uid).get(),
    ehMembro(ctx, club, actor.uid),
  ]);
  const r = s.rec || {};
  const staff = cargo.exists && CS.termActive(cargo.data(), ctx.now);
  const minor = S.isMinor(perfil.nascimento, hoje);
  return {
    ok: true, member: membro, rules, pledge: s.pledge, ok_state: s.ok, until: s.until, background: s.background,
    pending: resumoPendente(s.rec), last_rejection: r.last_rejection ? { reason: r.last_rejection.reason, at_ms: r.last_rejection.at_ms } : null,
    revoked_reason: r.background && r.background.status === 'revoked' ? r.background.revoked_reason || '' : '',
    required: S.requiredFor({ staff, designated: r.designated === true, rules }), staff, designated: r.designated === true ? { label: r.designated_label || '' } : null,
    minor: { is_minor: minor, age: S.ageOn(perfil.nascimento, hoje), guardian: minor && menor.exists ? menor.data().guardian || null : null },
  };
}

async function pledge(ctx, actor, data, c) {
  await exigeMembro(ctx, c.club, actor.uid);
  await gravarRegistro(ctx, c.club, actor.uid, { pledge_version: c.rules.pledge_version, pledged_at_ms: ctx.now });
  await a.auditoria(ctx, actor, 'club_safeguarding_pledge', { club_id: c.club.id, user_id: actor.uid, version: c.rules.pledge_version });
  return { ok: true };
}

async function sgSubmit(ctx, actor, data, c) {
  const { club, hoje, rules } = c;
  await exigeMembro(ctx, club, actor.uid);
  const issued = texto(data.issuedAt, 10);
  const v = P.validateBackgroundSubmit({ issued_at: issued, hoje, rules });
  if (!v.ok) falha('invalid-argument', Object.values(v.errors)[0]);
  const path = texto(data.filePath, 200);
  if (!PATH_ARQUIVO(actor.uid).test(path)) falha('invalid-argument', 'Envie a certidão pela tela (PDF ou foto, até 5 MB).');
  const { rec } = await registro(ctx, club, actor.uid);
  const antigo = rec && rec.pending_background && rec.pending_background.file_path;
  const nome = rec ? rec.name : (await a.perfil(ctx, actor.uid)).nome;
  await gravarRegistro(ctx, club, actor.uid, { pending_background: { issued_at: issued, valid_until: P.backgroundDefaultUntil(issued, rules), file_path: path, submitted_at_ms: ctx.now } });
  const batch = ctx.db.batch();
  (await a.quemTem(ctx, club.id, 'discipline')).filter((u) => u !== actor.uid).forEach((u) => a.aviso(ctx, batch, u, {
    title: tx('Certidão de antecedentes para conferir'),
    message: tx('{nome} enviou a certidão no {clube}. Confira em Proteção de menores.', { nome, clube: club.name }),
    link: linkProtecao(club),
  }));
  await batch.commit();
  if (antigo && antigo !== path && ctx.bucket) await ctx.bucket.file(antigo).delete().catch(() => null);
  await a.auditoria(ctx, actor, 'club_safeguarding_submit', { club_id: club.id, user_id: actor.uid });
  return { ok: true };
}

/** O responsável do menor: o próprio menor registra; a disciplina e a secretaria registram por ele. */
async function guardianSave(ctx, actor, data, c) {
  const { club, hoje, perms } = c;
  const uid = texto(data.userId || actor.uid, 128);
  const proprio = uid === actor.uid;
  if (!proprio && !['admin', 'discipline', 'members'].some((p) => perms.includes(p))) falha('permission-denied', 'Você não registra o responsável de outra pessoa.');
  await exigeMembro(ctx, club, uid);
  const p = await a.perfil(ctx, uid);
  if (!p.nascimento) falha('failed-precondition', 'O cadastro não tem a data de nascimento: sem ela não dá para saber se é menor de idade.');
  if (!S.isMinor(p.nascimento, hoje)) falha('failed-precondition', 'O responsável legal só é registrado para menores de 18 anos.');
  const v = S.validateGuardian(data.guardian || {});
  if (!v.ok) falha('invalid-argument', Object.values(v.errors)[0]);
  const ref = col(ctx, club.id, MINORS).doc(uid);
  const antes = await ref.get();
  await ref.set({
    club_id: club.id, user_id: uid, user_name: p.nome, guardian: v.value, registered_by: actor.uid,
    created_at_ms: antes.exists ? antes.data().created_at_ms || ctx.now : ctx.now, updated_at_ms: ctx.now,
  });
  await a.auditoria(ctx, actor, 'club_minor_guardian_save', { club_id: club.id, user_id: uid, consent: v.value.consent });
  return { ok: true };
}

/** O arquivo da certidão em conferência: só a própria pessoa e a disciplina abrem; abrir é auditado. */
async function backgroundFile(ctx, actor, data, c) {
  const uid = texto(data.userId || actor.uid, 128);
  const dono = uid === actor.uid;
  if (!dono) exigeProtecao(c);
  const { rec } = await registro(ctx, c.club, uid);
  const path = rec && rec.pending_background && rec.pending_background.file_path;
  if (!path) falha('not-found', 'Não há certidão em conferência.');
  if (!PATH_ARQUIVO(uid).test(path)) falha('failed-precondition', 'Caminho do arquivo inválido.');
  if (!ctx.bucket) falha('unavailable', 'Arquivos indisponíveis no momento.');
  const file = ctx.bucket.file(path);
  const [meta] = await file.getMetadata().catch(() => [null]);
  if (!meta) falha('not-found', 'O arquivo não está mais no servidor.');
  if (Number(meta.size) > MAX_BYTES) falha('failed-precondition', 'Arquivo maior que o permitido.');
  const [bytes] = await file.download();
  if (!dono) await a.auditoria(ctx, actor, 'club_safeguarding_file_view', { club_id: c.club.id, user_id: uid });
  return { ok: true, contentType: meta.contentType || 'application/octet-stream', base64: Buffer.from(bytes).toString('base64') };
}

/* -------------------------------------------------------------- disciplina -- */

async function sgRules(ctx, actor, data, c) {
  exigeProtecao(c);
  const r = S.validateRules(data.rules || {});
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]);
  // Subir a versão do compromisso pede novo aceite de todos; só sobe, nunca desce.
  const value = { ...r.value, pledge_version: Math.max(c.rules.pledge_version, r.value.pledge_version) };
  await ctx.db.collection('clubs').doc(c.club.id).update({ 'association.safeguarding_rules': value, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  const { pledge_text: _texto, ...resumo } = value;
  await a.auditoria(ctx, actor, 'club_safeguarding_rules', { club_id: c.club.id, ...resumo });
  return { ok: true, rules: value };
}

async function sgVerify(ctx, actor, data, c) {
  exigeProtecao(c);
  const { club, hoje } = c;
  const uid = texto(data.userId, 128);
  if (uid === actor.uid) falha('permission-denied', 'Você não confere a sua própria certidão: outra pessoa da disciplina confere.');
  const { ref, rec } = await registro(ctx, club, uid);
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
  a.aviso(ctx, batch, uid, valida
    ? { title: tx('Sua certidão de antecedentes foi conferida pelo {clube}', { clube: club.name }), message: tx('Vale até {data}. O arquivo foi apagado; o clube guarda só a conferência.', { data: br(until) }), link: linkMinha(club) }
    : { title: tx('Sua certidão de antecedentes não foi aceita pelo {clube}', { clube: club.name }), message: tx('Motivo: {motivo}. Envie outra em Minha filiação.', { motivo }), link: linkMinha(club) });
  await batch.commit();
  // Minimização: decidida a conferência, o arquivo sai do Storage.
  if (ctx.bucket && pend.file_path) await ctx.bucket.file(pend.file_path).delete().catch(() => null);
  await refreshClearance(ctx, club, uid, c);
  await a.auditoria(ctx, actor, 'club_safeguarding_verify', { club_id: club.id, user_id: uid, decision: data.decision, valid_until: valida ? until : null });
  return { ok: true };
}

async function sgRevoke(ctx, actor, data, c) {
  exigeProtecao(c);
  const { club } = c;
  const uid = texto(data.userId, 128);
  const { ref, rec } = await registro(ctx, club, uid);
  if (!(rec && rec.background && rec.background.status === 'valid')) falha('failed-precondition', 'Não há certidão conferida para revogar.');
  const motivo = texto(data.reason, P.SG_LIMITS.NOTE_MAX);
  if (motivo.length < P.SG_LIMITS.REASON_MIN) falha('invalid-argument', 'Diga o motivo da revogação.');
  const batch = ctx.db.batch();
  batch.update(ref, { background: { ...rec.background, status: 'revoked', revoked_reason: motivo, revoked_by: actor.uid, revoked_at_ms: ctx.now }, updated_at_ms: ctx.now });
  a.aviso(ctx, batch, uid, { title: tx('O {clube} revogou a conferência da sua certidão', { clube: club.name }), message: tx('Motivo: {motivo}. Até enviar uma nova certidão, você não pode trabalhar com menores pelo clube.', { motivo }), link: linkMinha(club) });
  await batch.commit();
  await refreshClearance(ctx, club, uid, c);
  await a.auditoria(ctx, actor, 'club_safeguarding_revoke', { club_id: club.id, user_id: uid, reason: motivo });
  return { ok: true };
}

/** Inclui (ou tira) do quadro um treinador, monitor ou voluntário que não tem cargo na diretoria. */
async function sgDesignate(ctx, actor, data, c) {
  exigeProtecao(c);
  const { club } = c;
  const uid = texto(data.userId, 128);
  if (!uid) falha('invalid-argument', 'Escolha a pessoa.');
  await exigeMembro(ctx, club, uid);
  const incluir = data.designated !== false;
  const label = incluir ? texto(data.label, S.LABEL_MAX) || 'Voluntário' : '';
  await gravarRegistro(ctx, club, uid, { designated: incluir, designated_label: label, designated_by: actor.uid });
  if (incluir && uid !== actor.uid) {
    const batch = ctx.db.batch();
    a.aviso(ctx, batch, uid, {
      title: tx('Você foi incluído na proteção de menores do {clube}', { clube: club.name }),
      message: tx('Para trabalhar com menores, aceite o compromisso e envie a certidão de antecedentes em Minha filiação.'),
      link: linkMinha(club),
    });
    await batch.commit();
  }
  await a.auditoria(ctx, actor, incluir ? 'club_safeguarding_designate' : 'club_safeguarding_undesignate', { club_id: club.id, user_id: uid, label });
  return { ok: true };
}

/** Quem trabalha com menores neste clube e se está em dia. */
async function sgOverview(ctx, actor, data, c) {
  exigeProtecao(c);
  const { club, rules, hoje } = c;
  const [recs, staff] = await Promise.all([col(ctx, club.id, SG).get(), cargos(ctx, club)]);
  const porUid = new Map(recs.docs.map((d) => [d.id, d.data()]));
  const ids = new Set([...staff.keys(), ...porUid.keys()]);
  const nomes = await Promise.all([...ids].filter((u) => !(porUid.get(u) && porUid.get(u).name)).map(async (u) => [u, await a.perfil(ctx, u)]));
  const perfis = new Map(nomes);
  const rows = [...ids].map((uid) => {
    const rec = porUid.get(uid) || null;
    const cl = S.clearance({ record: rec, rules, hoje });
    const roles = [...(staff.has(uid) ? ['staff'] : []), ...(rec && rec.designated ? ['designated'] : [])];
    const pf = perfis.get(uid);
    return {
      user_id: uid, name: (rec && rec.name) || (pf && pf.nome) || '', photo_url: (rec && rec.photo_url) || (pf && pf.foto) || '',
      roles, label: rec && rec.designated ? rec.designated_label || '' : '', required: S.requiredFor({ staff: staff.has(uid), designated: Boolean(rec && rec.designated), rules }),
      pledge_ok: cl.pledge.ok, background: cl.background, pending: resumoPendente(rec),
      last_rejection: rec && rec.last_rejection ? { reason: rec.last_rejection.reason, at_ms: rec.last_rejection.at_ms } : null, ok: cl.ok, until: cl.until,
    };
  });
  return { ok: true, rules, rows };
}

/** Os associados menores de idade e o responsável de cada um (só a disciplina vê). */
async function minorsOverview(ctx, actor, data, c) {
  exigeProtecao(c);
  const { club, hoje } = c;
  const [affs, menores] = await Promise.all([col(ctx, club.id, 'aff').get(), col(ctx, club.id, MINORS).get()]);
  const guardians = new Map(menores.docs.map((d) => [d.id, d.data()]));
  const vivos = affs.docs.map((d) => d.data()).filter((x) => a.LIVE.includes(x.status) && x.user_id);
  const linhas = await Promise.all(vivos.map(async (x) => {
    const p = await a.perfil(ctx, x.user_id);
    if (!S.isMinor(p.nascimento, hoje)) return null;
    const g = guardians.get(x.user_id);
    return { user_id: x.user_id, name: x.user_name || p.nome, photo_url: x.photo_url || p.foto, age: S.ageOn(p.nascimento, hoje), guardian: g ? g.guardian || null : null, updated_at_ms: g ? g.updated_at_ms || null : null };
  }));
  return { ok: true, rows: linhas.filter(Boolean) };
}

const ROTAS = {
  me, pledge, sg_submit: sgSubmit, guardian_save: guardianSave, sg_file: backgroundFile,
  sg_rules: sgRules, sg_verify: sgVerify, sg_revoke: sgRevoke, sg_designate: sgDesignate, sg_overview: sgOverview, minors_overview: minorsOverview,
};

async function safeguarding(ctx, actor, data = {}) {
  const fn = ROTAS[data.action];
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  const c = await contexto(ctx, actor, data);
  return fn(ctx, actor, data, c);
}

/* -------------------------------------------------------------- varredura -- */

/**
 * Diária: avisa a certidão que vence em 30 dias (uma vez por validade), refaz a data de
 * liberação e apaga o responsável de quem completou 18 anos.
 */
async function sweep(ctx) {
  if (!(await a.flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = P.isoDateBR(ctx.now);
  const conta = { warned: 0, refreshed: 0, minors_cleared: 0 };
  const clubes = await ctx.db.collection('clubs').where('association.enabled', '==', true).get();
  for (const cd of clubes.docs) {
    const club = { id: cd.id, ...cd.data() };
    const c = { club, hoje, rules: S.normalizeRules(club.association.safeguarding_rules) };
    // eslint-disable-next-line no-await-in-loop
    const recs = await col(ctx, club.id, SG).get();
    for (const d of recs.docs) {
      const r = d.data();
      const b = r.background;
      if (b && b.status === 'valid' && P.expiresSoon(b.valid_until, hoje) && b.expiry_warned_for !== b.valid_until) {
        const batch = ctx.db.batch();
        batch.update(d.ref, { 'background.expiry_warned_for': b.valid_until });
        a.aviso(ctx, batch, r.user_id, { title: tx('Sua certidão de antecedentes vence em {data}', { data: br(b.valid_until) }), message: tx('Envie a nova certidão ao {clube} em Minha filiação para continuar trabalhando com menores.', { clube: club.name }), link: linkMinha(club) });
        // eslint-disable-next-line no-await-in-loop
        await batch.commit();
        conta.warned += 1;
      }
      // eslint-disable-next-line no-await-in-loop
      const depois = await refreshClearance(ctx, club, r.user_id, c);
      if ((r.cleared_until || '') !== depois) conta.refreshed += 1;
    }
    // eslint-disable-next-line no-await-in-loop
    const menores = await col(ctx, club.id, MINORS).get();
    for (const m of menores.docs) {
      // eslint-disable-next-line no-await-in-loop
      const p = await a.perfil(ctx, m.id);
      if (p.nascimento && !S.isMinor(p.nascimento, hoje)) {
        // eslint-disable-next-line no-await-in-loop
        await m.ref.delete();
        conta.minors_cleared += 1;
      }
    }
  }
  if (ctx.logger) ctx.logger.info('Clubes: proteção de menores.', conta);
  return conta;
}

module.exports = { safeguarding, sweep, SG, MINORS, situacao };
