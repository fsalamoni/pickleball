/**
 * SECRETARIA da federação (PR 3): o que só o SERVIDOR faz por ela.
 *
 *  - `importMembers`: a federação que já existia fora da plataforma traz a
 *    lista (nome, e-mail, número, validade) — até 500 linhas. Quem TEM conta
 *    com aquele e-mail vira filiado ATIVO no plano escolhido (número da lista
 *    ou sequencial; validade da lista ou do plano), numa transação por pessoa;
 *    quem já tem filiação viva é pulado; quem não tem conta fica em
 *    `federation_imports` (a secretaria convida por fora). Nenhum e-mail vai
 *    para a filiação.
 *  - `document`: a secretaria LÊ um documento enviado (`federacao/{uid}/…`
 *    no Storage): a regra do Storage só deixa o dono ler a própria pasta e não
 *    consulta o banco `pickleball`, então o arquivo chega por aqui, em base64,
 *    só para quem tem `members`/`admin` na federação do documento.
 */
const f = require('./federations.js');
const m = require('./federationMembership.js');
const { tx } = require('./avisoI18n.js');

const MAX_ROWS = 500;
const MAX_DOC_BYTES = 5 * 1024 * 1024;
const lc = (v) => String(v == null ? '' : v).trim().toLowerCase();
const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function contaPorEmail(ctx, email) {
  const q = await ctx.db.collection('users').where('email', '==', email).limit(1).get();
  if (!q.empty) return q.docs[0];
  if (email !== email.toLowerCase()) return null;
  const q2 = await ctx.db.collection('users').where('email_lc', '==', email).limit(1).get();
  return q2.empty ? null : q2.docs[0];
}

async function importMembers(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) f.falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  await f.exigePerm(ctx, fed.id, actor, 'members');
  const p = await f.plano(ctx, fed.id, data.planId);
  const rows = Array.isArray(data.rows) ? data.rows.slice(0, MAX_ROWS) : [];
  if (!rows.length) f.falha('invalid-argument', 'A lista está vazia.');
  const hoje = m.isoDateBR(ctx.now);
  const importados = [];
  const pulados = [];
  const pendentes = [];
  const vistos = new Set();
  for (const raw of rows) {
    const email = lc(raw && raw.email);
    const name = f.texto(raw && raw.name, 120);
    const member_number = f.texto(raw && raw.member_number, 40);
    const valid_until = ISO.test(String(raw && raw.valid_until || '')) ? String(raw.valid_until) : '';
    if (!email || !email.includes('@') || vistos.has(email)) { pulados.push({ email, reason: 'E-mail inválido ou repetido' }); continue; }
    vistos.add(email);
    // eslint-disable-next-line no-await-in-loop
    const conta = await contaPorEmail(ctx, email);
    if (!conta) { pendentes.push({ email, name, member_number, valid_until }); continue; }
    const uid = conta.id;
    const u = conta.data() || {};
    const memberRef = ctx.db.collection(f.C.members).doc(`${fed.id}_${uid}`);
    // eslint-disable-next-line no-await-in-loop
    const atual = await memberRef.get();
    if (atual.exists && f.LIVE.includes(atual.data().status)) { pulados.push({ email, reason: 'Já tem filiação nesta federação' }); continue; }
    const doc = {
      federation_id: fed.id, federation_name: fed.name, federation_acronym: fed.acronym || '', user_id: uid, user_name: f.texto(u.platform_name || u.full_name || u.display_name || name || 'Atleta', 120),
      photo_url: f.texto(u.photo_url || u.avatar_url, 500), guardian_uid: null, is_minor: false, person_type: p.person_type || 'athlete', tier: p.tier || 'federated',
      plan_id: p.id, plan_name: p.name, billing: p.billing || 'annual', status: 'pending', public_badge: true, show_in_directory: false, public_photo: true,
      represented_club_id: null, note: '', imported: true, imported_by: actor.uid, imported_at_ms: ctx.now,
      requested_at: ctx.Timestamp.fromMillis(ctx.now), requested_at_ms: ctx.now, updated_at: ctx.Timestamp.fromMillis(ctx.now),
      member_number: member_number || (atual.exists && atual.data().member_number) || null, card_code: null, valid_from: null, valid_until: null, expiry_notified: {},
    };
    // eslint-disable-next-line no-await-in-loop
    await ctx.db.runTransaction(async (tr) => {
      tr.set(memberRef, doc);
      await f.ativar(ctx, tr, { fed, memberRef, member: doc, plan: p, hoje });
      if (valid_until) tr.update(memberRef, { valid_until });
    });
    importados.push({ email, uid });
  }
  const batch = ctx.db.batch();
  const impRef = ctx.db.collection(f.C.imports).doc();
  batch.set(impRef, { federation_id: fed.id, plan_id: p.id, plan_name: p.name, by: actor.uid, created_at_ms: ctx.now, imported_count: importados.length, skipped: pulados, pending: pendentes, total_rows: rows.length });
  importados.forEach(({ uid }) => f.aviso(ctx, batch, uid, { title: tx('Você foi filiado à {sigla}', { sigla: fed.acronym }), message: tx('A federação importou seu cadastro. A carteirinha digital está na Minha área → Federações; confira os dados e as preferências de privacidade.'), link: '/perfil?secao=federacoes' }));
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_members_import', { federation_id: fed.id, plan_id: p.id, imported: importados.length, skipped: pulados.length, pending: pendentes.length, import_id: impRef.id });
  return { ok: true, importId: impRef.id, imported: importados.length, skipped: pulados, pending: pendentes.length };
}

async function document(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) f.falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const snap = await ctx.db.collection(f.C.documents).doc(f.texto(data.documentId, 80)).get();
  if (!snap.exists) f.falha('not-found', 'Documento não encontrado.');
  const d = snap.data();
  const dono = d.user_id === actor.uid;
  if (!dono) {
    const perms = await f.staffPerms(ctx, d.federation_id, actor);
    if (!perms.includes('members') && !perms.includes('admin')) f.falha('permission-denied', 'Só a secretaria vê os documentos dos filiados.');
  }
  if (!ctx.bucket) f.falha('unavailable', 'Arquivos indisponíveis no momento.');
  const path = String(d.storage_path || '');
  if (!/^federacao\/[^/]+\/[A-Za-z0-9_-]+\.[a-z]{3,4}$/.test(path)) f.falha('failed-precondition', 'Caminho do documento inválido.');
  const file = ctx.bucket.file(path);
  const [meta] = await file.getMetadata().catch(() => [null]);
  if (!meta) f.falha('not-found', 'O arquivo não está mais no servidor.');
  if (Number(meta.size) > MAX_DOC_BYTES) f.falha('failed-precondition', 'Arquivo maior que o permitido.');
  const [bytes] = await file.download();
  if (!dono) await f.auditoria(ctx, actor, 'federation_document_view', { federation_id: d.federation_id, document_id: snap.id, user_id: d.user_id, kind: d.kind });
  return { ok: true, contentType: meta.contentType || 'application/octet-stream', base64: Buffer.from(bytes).toString('base64'), kind: d.kind, status: d.status };
}

module.exports = { importMembers, document, MAX_ROWS };
