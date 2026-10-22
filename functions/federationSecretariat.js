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
      const ativo = await f.ativar(ctx, tr, { fed, memberRef, member: doc, plan: p, hoje, novo: true });
      if (valid_until && valid_until !== ativo.valid_until) tr.update(memberRef, { valid_until });
    });
    importados.push({ email, uid });
  }
  const batch = ctx.db.batch();
  const impRef = ctx.db.collection(f.C.imports).doc();
  // `pending_emails`: a consulta `array-contains` da conta que nasce (`onUserCreated`) — sem índice.
  batch.set(impRef, { federation_id: fed.id, plan_id: p.id, plan_name: p.name, by: actor.uid, created_at_ms: ctx.now, imported_count: importados.length, skipped: pulados, pending: pendentes, pending_emails: pendentes.map((x) => x.email), invited_emails: [], total_rows: rows.length });
  importados.forEach(({ uid }) => f.aviso(ctx, batch, uid, { title: tx('Você foi filiado à {sigla}', { sigla: fed.acronym }), message: tx('A federação importou seu cadastro. A carteirinha digital está na Minha área → Federações; confira os dados e as preferências de privacidade.'), link: '/perfil?secao=federacoes' }));
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_members_import', { federation_id: fed.id, plan_id: p.id, imported: importados.length, skipped: pulados.length, pending: pendentes.length, import_id: impRef.id });
  return { ok: true, importId: impRef.id, imported: importados.length, skipped: pulados, pending: pendentes.length };
}

const IMPORT_INVITE_DAYS = 90;
const SISTEMA = { uid: 'system', name: 'Importação de filiados' };

/**
 * A conta NASCEU (gatilho em `users/{uid}`): quem estava numa importação sem
 * conta, com este e-mail, recebe o CONVITE da federação no plano da
 * importação — nunca a filiação direta (ninguém vira filiado sem aceitar).
 * O convite leva o número e a validade da lista; aceito, a filiação entra
 * ATIVA sem cobrança (a pessoa já era filiada fora da plataforma), como na
 * importação de quem já tinha conta (`pedirFiliacao`, `source: 'import'`).
 * Federação oculta, plano desativado ou filiação viva: não convida, e o
 * e-mail segue pendente na importação.
 */
async function onUserCreated(ctx, uid, user) {
  if (!uid || !(await f.flagLigada(ctx))) return { invited: 0 };
  const email = lc(user && user.email);
  if (!email || !email.includes('@')) return { invited: 0 };
  const imps = await ctx.db.collection(f.C.imports).where('pending_emails', 'array-contains', email).get();
  let invited = 0;
  for (const d of imps.docs) {
    const imp = { id: d.id, ...d.data() };
    try {
      // eslint-disable-next-line no-await-in-loop
      const fed = await f.federacao(ctx, imp.federation_id);
      if (!f.publicada(fed)) continue;
      // eslint-disable-next-line no-await-in-loop
      const p = await f.plano(ctx, fed.id, imp.plan_id);
      if (p.active === false) continue;
      const invRef = ctx.db.collection(f.C.invites).doc(`${fed.id}_${uid}`);
      // eslint-disable-next-line no-await-in-loop
      const [mem, inv] = await Promise.all([ctx.db.collection(f.C.members).doc(`${fed.id}_${uid}`).get(), invRef.get()]);
      if (mem.exists && f.LIVE.includes(mem.data().status)) continue;
      if (inv.exists && inv.data().status === 'pending' && Number(inv.data().expires_at_ms) > ctx.now) continue;
      const linha = (imp.pending || []).find((x) => lc(x.email) === email) || {};
      const agora = ctx.Timestamp.fromMillis(ctx.now);
      const batch = ctx.db.batch();
      batch.set(invRef, {
        federation_id: fed.id, federation_name: fed.name, federation_acronym: fed.acronym || '', user_id: uid,
        user_name: f.texto(user.platform_name || user.full_name || linha.name || 'Atleta', 120), photo_url: f.texto(user.photo_url, 500),
        plan_id: p.id, plan_name: p.name, note: '', status: 'pending', invited_by: imp.by || 'system',
        source: 'import', import_id: imp.id, member_number: f.texto(linha.member_number, 40) || null, valid_until: ISO.test(String(linha.valid_until || '')) ? linha.valid_until : null,
        created_at_ms: ctx.now, expires_at_ms: ctx.now + IMPORT_INVITE_DAYS * 86400000, updated_at: agora,
      });
      batch.update(d.ref, {
        pending_emails: (imp.pending_emails || []).filter((x) => x !== email),
        invited_emails: [...new Set([...(imp.invited_emails || []), email])],
      });
      f.aviso(ctx, batch, uid, {
        title: tx('A {sigla} já tinha você na lista de filiados', { sigla: fed.acronym || fed.name }),
        message: tx('Confirme a filiação no plano {plano}: ela entra ativa, sem cobrança, com os dados da lista. O convite vale 90 dias.', { plano: p.name }),
        link: `/federacoes/${fed.id}/filiar`,
      });
      // eslint-disable-next-line no-await-in-loop
      await batch.commit();
      // eslint-disable-next-line no-await-in-loop
      await f.auditoria(ctx, SISTEMA, 'federation_import_invite', { federation_id: fed.id, import_id: imp.id, user_id: uid });
      invited += 1;
    } catch (err) {
      if (ctx.logger) ctx.logger.warn('onUserCreated: convite da importação não criado', { importId: imp.id, err: String(err && err.message) });
    }
  }
  return { invited };
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

module.exports = { importMembers, onUserCreated, document, MAX_ROWS };
