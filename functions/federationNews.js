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
 *  - `publishDue` (varredura a cada 15 min, `federationNewsPublish`): a
 *    notícia AGENDADA (`status: 'scheduled'`, `publish_at_ms`) cuja hora
 *    chegou vira publicada, com a data de Brasília daquele instante; com
 *    `notify_on_publish` o aviso sai junto (o mesmo, uma vez só). Federação
 *    sem o módulo de notícias fica esperando — religado, publica.
 */
const f = require('./federations.js');
const { isoDateBR } = require('./federationMembership.js');
const { tx } = require('./avisoI18n.js');

const C_NEWS = 'federation_news';
const LOTE = 400;
const SISTEMA = { uid: 'system', name: 'Agendamento de notícias' };

/** O aviso em si, para quem a federação tem como filiado ativo. Devolve quantos. */
async function avisar(ctx, fed, news, actor) {
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
  await ctx.db.collection(C_NEWS).doc(news.id).update({ notified_at: ctx.Timestamp.fromMillis(ctx.now), notified_count: uids.length, notified_by: actor.uid });
  await f.auditoria(ctx, actor, 'federation_news_notify', { federation_id: fed.id, news_id: news.id, count: uids.length });
  return uids.length;
}

async function notify(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) f.falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const snap = await ctx.db.collection(C_NEWS).doc(f.texto(data.newsId, 80)).get();
  if (!snap.exists) f.falha('not-found', 'Notícia não encontrada.');
  const news = { id: snap.id, ...snap.data() };
  const fed = await f.federacao(ctx, news.federation_id);
  if (!(fed.modules && fed.modules.news === true)) f.falha('failed-precondition', 'Esta federação não tem o módulo de notícias ligado.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  if (!perms.includes('comms') && !perms.includes('admin')) f.falha('permission-denied', 'Você não tem permissão para isso nesta federação.');
  if (news.status !== 'published') f.falha('failed-precondition', 'Publique a notícia antes de avisar os filiados.');
  if (news.notified_at) f.falha('failed-precondition', 'Os filiados já foram avisados desta notícia.');
  const count = await avisar(ctx, fed, news, actor);
  return { ok: true, count };
}

async function publishDue(ctx) {
  if (!(await f.flagLigada(ctx))) return { published: 0 };
  const snap = await ctx.db.collection(C_NEWS).where('status', '==', 'scheduled').get();
  const vencidas = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((n) => Number(n.publish_at_ms) > 0 && Number(n.publish_at_ms) <= ctx.now);
  let published = 0;
  for (const news of vencidas) {
    try {
      const fed = await f.federacao(ctx, news.federation_id);
      if (!(fed.modules && fed.modules.news === true)) continue;
      await ctx.db.collection(C_NEWS).doc(news.id).update({
        status: 'published', published_at: isoDateBR(Number(news.publish_at_ms)),
        scheduled_published_at: ctx.Timestamp.fromMillis(ctx.now), updated_at: ctx.Timestamp.fromMillis(ctx.now),
      });
      published += 1;
      await f.auditoria(ctx, SISTEMA, 'federation_news_scheduled_publish', { federation_id: fed.id, news_id: news.id });
      if (news.notify_on_publish === true && !news.notified_at) await avisar(ctx, fed, news, SISTEMA);
    } catch (err) {
      if (ctx.logger) ctx.logger.warn('publishDue: notícia não publicada', { newsId: news.id, err: String(err && err.message) });
    }
  }
  return { published };
}

module.exports = { notify, publishDue, C_NEWS };
