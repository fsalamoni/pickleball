/**
 * NOTÍCIAS E AVISOS (PR 4, módulo `news`) — o que só o SERVIDOR faz: o AVISO
 * da notícia aos filiados ATIVOS (sino, e-mail, push pelas regras de
 * `messaging`). A notícia em si a equipe de comunicação grava pelo cliente;
 * a regra confere. Por que aqui: a comunicação NÃO lê a lista de filiados
 * (dado pessoal), e o aviso é um só — `notified_at` impede repetição.
 *
 *  - `notify` (equipe `comms`/`admin`): notícia PUBLICADA e ainda não
 *    avisada → um aviso por conta (dependente avisa o responsável), lotes de
 *    400, e a notícia recebe `notified_at`/`notified_count`.
 */
const f = require('./federations.js');
const { tx } = require('./avisoI18n.js');

const C_NEWS = 'federation_news';
const LOTE = 400;

async function notify(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) f.falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const ref = ctx.db.collection(C_NEWS).doc(f.texto(data.newsId, 80));
  const snap = await ref.get();
  if (!snap.exists) f.falha('not-found', 'Notícia não encontrada.');
  const news = { id: snap.id, ...snap.data() };
  const fed = await f.federacao(ctx, news.federation_id);
  if (!(fed.modules && fed.modules.news === true)) f.falha('failed-precondition', 'Esta federação não tem o módulo de notícias ligado.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  if (!perms.includes('comms') && !perms.includes('admin')) f.falha('permission-denied', 'Você não tem permissão para isso nesta federação.');
  if (news.status !== 'published') f.falha('failed-precondition', 'Publique a notícia antes de avisar os filiados.');
  if (news.notified_at) f.falha('failed-precondition', 'Os filiados já foram avisados desta notícia.');

  const membros = await ctx.db.collection(f.C.members).where('federation_id', '==', fed.id).where('status', '==', 'active').get();
  const uids = [...new Set(membros.docs.map((d) => d.data()).map((m) => m.user_id || m.guardian_uid).filter(Boolean))];
  const link = `/federacoes/${fed.id}?noticia=${encodeURIComponent(news.id)}`;
  const title = tx('{sigla}: {titulo}', { sigla: fed.acronym || fed.name, titulo: f.texto(news.title, 140) });
  const message = f.texto(news.summary, 300) || f.texto(news.body, 300);
  for (let i = 0; i < uids.length; i += LOTE) {
    const batch = ctx.db.batch();
    uids.slice(i, i + LOTE).forEach((uid) => f.aviso(ctx, batch, uid, { title, message, link }));
    await batch.commit();
  }
  await ref.update({ notified_at: ctx.Timestamp.fromMillis(ctx.now), notified_count: uids.length, notified_by: actor.uid });
  await f.auditoria(ctx, actor, 'federation_news_notify', { federation_id: fed.id, news_id: news.id, count: uids.length });
  return { ok: true, count: uids.length };
}

module.exports = { notify, C_NEWS };
