/**
 * VANTAGENS E COMUNICADOS DO CLUBE-ASSOCIAÇÃO (Bloco C) — o que só o SERVIDOR faz.
 *
 * A vitrine das vantagens, os comunicados e os patrocinadores a equipe de
 * comunicação (`comms`) grava pelo navegador (a regra confere). Aqui ficam
 * duas coisas que o navegador não pode:
 *
 *  - `benefits` (qualquer pessoa logada): o que SÓ o associado em dia vê — o
 *    "como usar" e o código de cada vantagem (`club_x/{clube}/bsec/{id}`, que
 *    ninguém lê direto). Devolve as vantagens no ar que valem para o plano da
 *    pessoa, já com o segredo; quem não está em dia (sem filiação, pendente,
 *    vencida, suspensa) recebe `eligible: false` e nada do segredo — a
 *    vitrine pública ela lê direto;
 *  - `news_notify` (equipe `comms`/`admin`): o AVISO do comunicado publicado
 *    aos associados em dia (sino, e-mail, push pelas regras de `messaging`),
 *    uma vez só (`notified_at`), porque a comunicação não lê a lista de
 *    associados (dado pessoal).
 */
const m = require('./federationMembership.js');
const { tx } = require('./avisoI18n.js');
const a = require('./clubAssociation.js');

const { falha, texto, col } = a;
const LOTE = 400;
const BENEFICIOS_MAX = 100;

const BR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

/** A pessoa está em dia (filiação ativa hoje)? Mesma conta do cliente (`membershipState`). */
async function emDia(ctx, clubId, uid, hoje) {
  const snap = await col(ctx, clubId, 'aff').doc(uid).get();
  if (!snap.exists) return { ok: false, aff: null };
  const aff = snap.data();
  return { ok: m.membershipState(aff, hoje, ctx.now).status === 'active', aff };
}

const planoServe = (b, planId) => !Array.isArray(b.plan_ids) || b.plan_ids.length === 0 || b.plan_ids.includes(planId);
const noAr = (b, hoje) => b.active !== false && !(b.valid_until && b.valid_until < hoje);

async function vantagens(ctx, actor, data) {
  await a.exigeFlag(ctx);
  const club = await a.clube(ctx, data.clubId);
  if (club.association?.enabled !== true) return { eligible: false, items: [] };
  const hoje = m.isoDateBR(ctx.now);
  const { ok, aff } = await emDia(ctx, club.id, actor.uid, hoje);
  if (!ok) return { eligible: false, items: [] };
  const snap = await col(ctx, club.id, 'benefits').get();
  const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => noAr(b, hoje) && planoServe(b, aff.plan_id)).slice(0, BENEFICIOS_MAX);
  const segredos = await Promise.all(lista.map(async (b) => {
    if (b.has_secret !== true) return {};
    const s = await col(ctx, club.id, 'bsec').doc(b.id).get();
    return s.exists ? { how_to: texto(s.data().how_to, 800), code: texto(s.data().code, 40) } : {};
  }));
  return { eligible: true, items: lista.map((b, i) => ({ ...b, ...segredos[i] })) };
}

async function avisarComunicado(ctx, actor, data) {
  await a.exigeFlag(ctx);
  const club = await a.clube(ctx, data.clubId);
  await a.exigePerm(ctx, club.id, actor, 'comms');
  const ref = col(ctx, club.id, 'news').doc(texto(data.newsId, 80));
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Comunicado não encontrado.');
  const news = { id: snap.id, ...snap.data() };
  if (news.status !== 'published') falha('failed-precondition', 'Publique o comunicado antes de avisar os associados.');
  if (news.notified_at) falha('failed-precondition', 'Os associados já foram avisados deste comunicado.');
  const hoje = m.isoDateBR(ctx.now);
  const ativos = await col(ctx, club.id, 'aff').where('status', '==', 'active').get();
  const uids = [...new Set(ativos.docs.map((d) => d.data()).filter((x) => m.membershipState(x, hoje, ctx.now).status === 'active').map((x) => x.user_id).filter(Boolean))];
  const title = tx('{clube}: {titulo}', { clube: a.sigla(club) || club.name, titulo: texto(news.title, 140) });
  const message = texto(news.summary, 300) || texto(news.body, 300);
  const link = `/clubes/${club.id}?tab=comunicados&noticia=${encodeURIComponent(news.id)}`;
  for (let i = 0; i < uids.length; i += LOTE) {
    const batch = ctx.db.batch();
    uids.slice(i, i + LOTE).forEach((uid) => a.aviso(ctx, batch, uid, { title, message, link }));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  await ref.update({ notified_at: ctx.Timestamp.fromMillis(ctx.now), notified_count: uids.length, notified_by: actor.uid });
  await a.auditoria(ctx, actor, 'club_news_notify', { club_id: club.id, news_id: news.id, count: uids.length, on: BR(hoje) });
  return { ok: true, count: uids.length };
}

/** O callable `clubContent`: `benefits` e `news_notify`. */
async function content(ctx, actor, data) {
  const acao = texto(data.action, 30);
  if (acao === 'benefits') return vantagens(ctx, actor, data);
  if (acao === 'news_notify') return avisarComunicado(ctx, actor, data);
  return falha('invalid-argument', 'Ação desconhecida.');
}

module.exports = { content, vantagens, avisarComunicado };
