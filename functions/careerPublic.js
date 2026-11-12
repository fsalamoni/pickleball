/**
 * MINHA CARREIRA — a VITRINE pública (PR 7, docs/54 §2.8, docs/20…/21).
 *
 * `career_public/{eventoId}` é uma CÓPIA ESCOLHIDA de um torneio de fora,
 * legível por qualquer pessoa e gravada SÓ por aqui (a regra é `write: if
 * false`). As fotos escolhidas são COPIADAS de `carreira/{uid}/` (privada) para
 * `carreira-publica/{uid}/` (leitura pública, escrita só do servidor), sem EXIF.
 *
 * Ações da chamada `career` (o `index.js` despacha para cá as ações abaixo; as
 * da dupla seguem em `career.js`):
 *  - `publish`        o dono põe (ou atualiza) um torneio na vitrine;
 *  - `unpublish`      o dono tira — vale com a flag desligada (LGPD);
 *  - `public_consent` a DUPLA diz se o nome (e a foto) dela pode aparecer na
 *                     vitrine de quem registrou; o "não" vale sempre.
 *
 * Gatilhos: o evento mudou (`careerEventWritten`) ou o pedido da dupla mudou
 * (`careerPartnerWritten`) ⇒ `rebuild`: o selo e as duplas são recalculados;
 * evento apagado, deixado de jogar ou dono que não é maior ⇒ a vitrine e as
 * fotos públicas saem.
 *
 * Travas: menor de 18 (ou nascimento desconhecido) não publica — a MESMA
 * resposta, sem gravar nada; foto de pasta que não é a do chamador é recusada;
 * só os campos de `showcaseItem` saem (nunca anotação, balanço ou a visão da
 * dupla). Nada daqui pontua (guarda `carreiraNaoPontua`).
 */
const crypto = require('crypto');
const P = require('./careerPolicy.js');
const V = require('./careerPublicPolicy.js');
const { tx, textoDoAviso, i18nDoAviso } = require('./avisoI18n.js');
const { FederationError } = require('./federations.js');

const EV = 'career_events';
const COL = 'career_public';
const PARTNER = 'career_partner';
const TIPOS = /^image\/(webp|jpeg|png)$/;
const FOTO_MAX = 3 * 1024 * 1024;

const falha = (code, msg) => { throw new FederationError(code, msg); };
const texto = (v, max = 300) => String(v == null ? '' : v).trim().slice(0, max);
const hojeBR = (now) => new Date(now - 3 * 3600000).toISOString().slice(0, 10);
const nomeDe = (u) => texto((u && (u.platform_name || u.full_name || u.display_name)) || 'Atleta', 80);
const igual = (a, b) => V.stableJson(a) === V.stableJson(b);

async function flagLigada(ctx) {
  const snap = await ctx.db.collection('platform_settings').doc('global').get();
  return Boolean(snap.exists && snap.data().feature_flags && snap.data().feature_flags.athlete_career === true);
}

async function usuario(ctx, uid) {
  const snap = await ctx.db.collection('users').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

const adulto = (u, ctx) => Boolean(u) && P.isAdult(u.birth_date, hojeBR(ctx.now));

/** Torneio já jogado (não planejado, não cancelado, não o plano de um torneio daqui) — a mesma pergunta da tela. */
const jogado = (ev, ctx) => V.canShowcaseEvent(ev, hojeBR(ctx.now));

function auditoria(ctx, batch, actor, action, details) {
  batch.set(ctx.db.collection('audit_logs').doc(), {
    log_number: Number(`${ctx.now}${Math.floor(Math.random() * 900 + 100)}`),
    action, action_label: action, actor_id: actor.uid, actor_name: actor.name || actor.uid, actor_email: actor.email || '',
    tournament_id: null, user_id: details.user_id || null, details, created_at: ctx.Timestamp.fromMillis(ctx.now),
  });
}

function aviso(ctx, batch, userId, { title, message, link }) {
  const i18n = i18nDoAviso({ title, message });
  const seguro = P.linkDeAviso(link);
  batch.set(ctx.db.collection('notifications').doc(), {
    user_id: userId, title: textoDoAviso(title), message: textoDoAviso(message), ...(i18n ? { i18n } : {}),
    type: 'career', ...(seguro ? { link: seguro } : {}), read: false, archived: false, origin: 'server',
    created_at: ctx.Timestamp.fromMillis(ctx.now),
  });
}

/* ------------------------------------------------------------ o selo -- */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const diasEntre = (a, b) => Math.round(Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000);

/**
 * O torneio da plataforma ligado ("É este") vale como oficial só se o servidor
 * conferir que a pessoa JOGOU nele: inscrição que não foi cancelada nem
 * desistência (a régua de `is_player` da tela) e, quando o torneio tem data
 * legível, a até 3 dias da registrada (a régua do "É este?").
 * Devolve o documento do torneio (o nome e o lugar OFICIAIS vão à vitrine no
 * lugar dos digitados) ou `null`.
 */
async function oficial(ctx, ev) {
  const id = typeof ev.platform_tournament_id === 'string' ? texto(ev.platform_tournament_id, 200) : '';
  if (!id || id.includes('/') || ev.date_precision === 'year') return null;
  const snap = await ctx.db.collection('tournaments').doc(id).get();
  const t = snap.exists ? snap.data() : null;
  if (!t || t.status === 'draft' || t.visibility === 'private') return null;
  const dia = [t.starts_at, t.start_date].map((v) => (typeof v === 'string' ? v.slice(0, 10) : '')).find((v) => ISO.test(v));
  if (dia && ISO.test(String(ev.start_date || '')) && diasEntre(dia, ev.start_date) > 3) return null;
  const regs = await ctx.db.collection('tournament_registrations').where('tournament_id', '==', id).get();
  const jogou = regs.docs.some((r) => !V.INACTIVE_REGISTRATION.includes(r.data().status)
    && [r.data().player_a_user_id, r.data().player_b_user_id].includes(ev.uid));
  return jogou ? t : null;
}

/** As duplas que aparecem com nome: `{ uid: { name, photo_url } }` (confirmadas, maiores, com o "sim" delas). */
async function duplasComNome(ctx, ev, pedidos) {
  const candidatos = [...new Set(pedidos.filter((d) => d.public_ok_partner === true).map((d) => d.partner_uid))];
  const perfis = new Map(await Promise.all(candidatos.map(async (u) => [u, await usuario(ctx, u)])));
  const adultos = new Set(candidatos.filter((u) => adulto(perfis.get(u), ctx)));
  const ok = V.consentingPartners(ev, pedidos, adultos);
  const out = {};
  Object.keys(ok).forEach((u) => { const p = perfis.get(u); out[u] = { name: nomeDe(p), photo_url: (p && p.photo_url) || null }; });
  return out;
}

/* ------------------------------------------------------------ fotos -- */

const urlPublica = (bucket, path, token) => `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

/** Copia UMA foto da pasta privada do dono para a pública, sem metadado. */
async function copiarFoto(ctx, uid, eventId, src) {
  if (!ctx.bucket) falha('unavailable', 'Arquivos indisponíveis no momento. Tente de novo.');
  const origem = ctx.bucket.file(src);
  const [meta] = await origem.getMetadata().catch(() => [null]);
  if (!meta) falha('failed-precondition', 'Uma foto não está mais na sua ficha. Envie de novo.');
  const contentType = String(meta.contentType || '');
  const size = Number(meta.size) || 0;
  if (!TIPOS.test(contentType) || !(size > 0) || size >= FOTO_MAX) falha('failed-precondition', 'A foto precisa ser JPG, PNG ou WebP abaixo de 3 MB.');
  const [buf] = await origem.download();
  const limpo = V.cleanPhotoBytes(buf, contentType);
  if (!limpo) falha('failed-precondition', 'Esta foto tem dados escondidos (como a localização). Tire-a da ficha e envie de novo pela tela.');
  const token = crypto.randomUUID();
  const dest = V.publicPhotoPath(uid, eventId, src, token.slice(0, 8));
  await ctx.bucket.file(dest).save(Buffer.from(limpo), {
    resumable: false, contentType,
    metadata: { contentType, cacheControl: 'private, max-age=300', metadata: { firebaseStorageDownloadTokens: token } },
  });
  return { path: dest, url: urlPublica(ctx.bucket, dest, token) };
}

const registrar = (ctx, msg, err) => { if (ctx.logger && ctx.logger.error) ctx.logger.error(msg, err); };

/** Apaga cópias avulsas (a que sobrou de uma montagem, a foto que saiu da ficha). A falha é registrada, nunca engolida. */
const apagarFotos = (ctx, fotos) => Promise.all((fotos || []).map((f) => (ctx.bucket && f && f.path
  ? ctx.bucket.file(f.path).delete().catch((err) => registrar(ctx, `careerPublic: foto pública não apagada (${f.path}).`, err)) : null)));

/**
 * O torneio SAIU da vitrine: apaga TODA cópia pública dele, pelo prefixo — também
 * a que ficou de uma tentativa anterior que falhou (o documento já não aponta
 * para ela, e o link com token continuaria abrindo). Sem Storage ou com erro, a
 * falha sobe: quem chamou tenta de novo.
 */
async function apagarFotosDoEvento(ctx, uid, eventId) {
  try {
    if (!ctx.bucket) throw new Error('Storage indisponível');
    await ctx.bucket.deleteFiles({ prefix: `carreira-publica/${uid}/${eventId}__` });
  } catch (err) {
    registrar(ctx, `careerPublic: fotos públicas de ${eventId} não apagadas.`, err);
    falha('unavailable', 'O torneio saiu da vitrine, mas as fotos ainda não foram apagadas. Tente de novo em instantes.');
  }
}

/* --------------------------------------------------------- montagem -- */

/**
 * Monta (ou desmonta) a vitrine de `eventId`.
 * `escolha`: os caminhos PRIVADOS das fotos escolhidas agora (publicar); sem ela,
 * mantém as que já estavam e ainda existem na ficha (gatilho).
 * @returns {Promise<'removed'|'written'|'unchanged'|'absent'>}
 */
async function rebuild(ctx, eventId, { escolha = null } = {}, tentativa = 0) {
  const ref = ctx.db.collection(COL).doc(eventId);
  const [atualSnap, evSnap] = await Promise.all([ref.get(), ctx.db.collection(EV).doc(eventId).get()]);
  const atual = atualSnap.exists ? atualSnap.data() : null;
  if (!atual && !escolha) return 'absent';
  const ev = evSnap.exists ? { id: eventId, ...evSnap.data() } : null;
  const dono = ev ? await usuario(ctx, ev.uid) : null;
  if (!ev || !jogado(ev, ctx) || !adulto(dono, ctx)) {
    if (!atual) return 'absent';
    // O documento primeiro (esconder vale mais); a falha ao apagar as fotos sobe e o gatilho a registra.
    await ref.delete();
    if (ctx.bucket || (atual.photos || []).length) await apagarFotosDoEvento(ctx, atual.uid, eventId);
    return 'removed';
  }

  // Fotos: só as que estão na ficha AGORA, da pasta do dono e com descrição.
  const naFicha = new Map((Array.isArray(ev.photos) ? ev.photos : []).filter((p) => p && String(p.path || '').startsWith(`carreira/${ev.uid}/`) && texto(p.alt))
    .map((p) => [p.path, p]));
  const antes = new Map((atual?.photos || []).map((f) => [V.sourceOfPublicPhoto(ev.uid, f.path), f]));
  const fontes = (escolha || [...antes.keys()]).filter((src) => naFicha.has(src)).slice(0, V.SHOWCASE_LIMITS.photos);
  const fotos = [];
  const novas = [];
  try {
    for (const src of fontes) {
      const ja = antes.get(src);
      // eslint-disable-next-line no-await-in-loop
      const copia = ja ? { path: ja.path, url: ja.url } : await copiarFoto(ctx, ev.uid, eventId, src);
      if (!ja) novas.push(copia);
      const k = naFicha.get(src).kind;
      fotos.push({ ...copia, kind: typeof k === 'string' && k.length <= 24 ? k : 'other', alt: texto(naFicha.get(src).alt, 140) });
    }
  } catch (err) {
    await apagarFotos(ctx, novas); // nada de cópia pública órfã
    throw err;
  }
  const saem = [...antes.entries()].filter(([src]) => !fontes.includes(src)).map(([, f]) => f);

  const pedidoDocs = (await ctx.db.collection(PARTNER).where('event_id', '==', eventId).get()).docs
    .filter((d) => d.data().owner_uid === ev.uid);
  const pedidos = pedidoDocs.map((d) => d.data());
  // A ficha é SANEADA antes de virar pública (a regra do evento não confere tipo
  // nem tamanho); o selo e as impressões seguem sobre a ficha como foi gravada.
  const torneio = await oficial(ctx, ev);
  const publica = V.safeShowcaseEvent(ev);
  if (torneio) {
    // Sob o selo Oficial vão o nome e o lugar do torneio DA PLATAFORMA, não os digitados.
    ['name', 'city', 'state'].forEach((k) => { if (typeof torneio[k] === 'string' && torneio[k].trim()) publica[k] = texto(torneio[k], k === 'state' ? 2 : 120); });
  }
  const item = V.showcaseItem(publica, {
    seal: V.showcaseSeal(ev, pedidos, Boolean(torneio)),
    partners: await duplasComNome(ctx, ev, pedidos),
    photos: fotos,
  });
  const { published_at_ms: pub, updated_at_ms: _u, ...semData } = atual || {};
  let resultado = 'unchanged';
  if (!atual || !igual(semData, item) || saem.length) {
    // Outra montagem gravou no meio (publicar + gatilho ao mesmo tempo): desfaz as
    // cópias DESTA e recomeça sobre o que está lá. ponytail: confere e grava sem
    // transação — a janela que sobra é de milissegundos; transação se aparecer conflito real.
    const agora = await ref.get();
    const versao = (s) => (s.exists ? s.data().updated_at_ms || 0 : null);
    if (versao(agora) !== (atual ? atual.updated_at_ms || 0 : null)) {
      await apagarFotos(ctx, novas);
      if (tentativa < 2) return rebuild(ctx, eventId, { escolha }, tentativa + 1);
      falha('aborted', 'A vitrine mudou ao mesmo tempo. Tente de novo.');
    }
    try {
      await ref.set({ ...item, published_at_ms: pub || ctx.now, updated_at_ms: ctx.now });
    } catch (err) {
      await apagarFotos(ctx, novas);
      throw err;
    }
    await apagarFotos(ctx, saem);
    resultado = 'written';
  }
  await perguntarDuplas(ctx, ev, pedidoDocs);
  return resultado;
}

/**
 * A dupla CONFIRMADA de um torneio na vitrine é perguntada UMA vez se o nome
 * pode aparecer (também quem confirmou depois de publicado). Quem tinha
 * permitido e viu o torneio mudar de nome, cidade, data ou resultado perde o
 * "sim" (o nome sai) e é perguntada de novo — o "sim" vale para o que ela viu.
 */
async function perguntarDuplas(ctx, ev, pedidoDocs) {
  const batch = ctx.db.batch();
  let n = 0;
  pedidoDocs.forEach((doc) => {
    const d = doc.data();
    if (d.status !== P.PARTNER_STATUS.CONFIRMED) return;
    const velho = d.public_ok_partner === true && d.public_fp !== V.consentFingerprint(ev, d.partner_uid);
    if (!velho && (d.public_ok_partner !== undefined || d.public_asked_at_ms)) return;
    batch.update(doc.ref, velho ? { public_ok_partner: null, public_fp: null, public_asked_at_ms: ctx.now } : { public_asked_at_ms: ctx.now });
    aviso(ctx, batch, d.partner_uid, {
      title: velho
        ? tx('{nome} mudou o torneio que você permitiu mostrar', { nome: d.owner_name || 'Sua dupla' })
        : tx('{nome} quer mostrar o torneio com você no perfil', { nome: d.owner_name || 'Sua dupla' }),
      message: tx('{torneio}: o seu nome só aparece se você permitir.', { torneio: texto(ev.name, 120) }),
      link: `/carreira?dupla=${encodeURIComponent(doc.id)}`,
    });
    n += 1;
  });
  if (n) await batch.commit();
}

/* ------------------------------------------------------------- ações -- */

async function publish(ctx, actor, data) {
  if (!(await flagLigada(ctx))) falha('failed-precondition', 'A Carreira não está ligada nesta plataforma.');
  const eventId = texto(data.eventId, 200);
  if (!eventId) falha('invalid-argument', 'Escolha o torneio.');
  const evSnap = await ctx.db.collection(EV).doc(eventId).get();
  if (!evSnap.exists || evSnap.data().uid !== actor.uid) falha('permission-denied', 'Este torneio não é seu.');
  const ev = { id: eventId, ...evSnap.data() };
  const fotos = Array.isArray(data.photos) ? [...new Set(data.photos.map((p) => texto(p, 300)))] : [];
  // Caminho de foto que não é da pasta de quem chama: recusado (nunca se copia o arquivo de outra pessoa).
  if (fotos.some((p) => !p.startsWith(`carreira/${actor.uid}/`) || p.includes('..'))) falha('permission-denied', 'Só as fotos que você enviou para a sua carreira vão à vitrine.');
  const resposta = { id: eventId, published: true };
  // Menor de 18 (ou nascimento desconhecido): a MESMA resposta, sem gravar nada.
  if (!adulto(await usuario(ctx, actor.uid), ctx)) return resposta;
  if (!jogado(ev, ctx)) falha('failed-precondition', 'Só torneio já jogado vai à vitrine.');
  const naFicha = new Map((Array.isArray(ev.photos) ? ev.photos : []).filter(Boolean).map((p) => [p.path, p]));
  if (fotos.some((p) => !naFicha.has(p))) falha('failed-precondition', 'Uma foto não está mais na ficha. Salve a ficha e tente de novo.');
  if (fotos.some((p) => !texto(naFicha.get(p).alt))) falha('failed-precondition', 'Escreva o que aparece em cada foto antes de mostrá-la.');
  const outros = (await ctx.db.collection(COL).where('uid', '==', actor.uid).get()).docs.filter((d) => d.id !== eventId);
  if (outros.length >= V.SHOWCASE_LIMITS.items) falha('failed-precondition', `A vitrine mostra até ${V.SHOWCASE_LIMITS.items} torneios. Tire um antes de pôr outro.`);
  const fotosFora = outros.reduce((n, d) => n + ((d.data().photos || []).length), 0);
  if (fotosFora + fotos.length > V.SHOWCASE_LIMITS.photos) falha('failed-precondition', `A vitrine mostra até ${V.SHOWCASE_LIMITS.photos} fotos ao todo.`);

  // A montagem também pergunta à dupla confirmada (uma vez) se o nome pode aparecer.
  await rebuild(ctx, eventId, { escolha: fotos });

  const batch = ctx.db.batch();
  auditoria(ctx, batch, actor, 'career_public_published', { event_id: eventId, photos: fotos.length });
  await batch.commit();
  return resposta;
}

/** Tirar da vitrine vale SEMPRE (com a flag desligada também): é o dado da pessoa. */
async function unpublish(ctx, actor, data) {
  const eventId = texto(data.eventId, 200);
  if (!eventId.startsWith(`${actor.uid}_`)) falha('permission-denied', 'Este torneio não é seu.');
  const ref = ctx.db.collection(COL).doc(eventId);
  const snap = await ref.get();
  if (snap.exists && snap.data().uid !== actor.uid) falha('permission-denied', 'Este torneio não é seu.');
  if (snap.exists) {
    // Some da vitrine na hora; a auditoria vai junto, antes de mexer nos arquivos.
    const batch = ctx.db.batch();
    batch.delete(ref);
    auditoria(ctx, batch, actor, 'career_public_unpublished', { event_id: eventId });
    await batch.commit();
  }
  // SEMPRE, com documento ou sem: a segunda tentativa limpa o que a primeira deixou.
  await apagarFotosDoEvento(ctx, actor.uid, eventId);
  return { id: eventId, published: false };
}

/** A DUPLA permite (ou não) o próprio nome na vitrine de quem registrou. Retirar vale sempre. */
async function publicConsent(ctx, actor, data) {
  const docId = texto(data.docId, 400);
  const ref = ctx.db.collection(PARTNER).doc(docId);
  const snap = docId ? await ref.get() : null;
  const d = snap && snap.exists ? snap.data() : null;
  // Inexistente e "não é seu" respondem IGUAL: o código do erro não pode dizer a
  // um terceiro quem foi citado como dupla (o id do pedido é evento + uid).
  if (!d || ![d.owner_uid, d.partner_uid].includes(actor.uid)) falha('not-found', 'Este pedido não existe mais.');
  if (d.partner_uid !== actor.uid) falha('permission-denied', 'Só a dupla decide sobre o próprio nome.');
  const ok = data.ok === true;
  if (ok) {
    if (!(await flagLigada(ctx))) falha('failed-precondition', 'A Carreira não está ligada nesta plataforma.');
    if (d.status !== P.PARTNER_STATUS.CONFIRMED) falha('failed-precondition', 'Confirme o torneio antes de permitir o seu nome.');
    if (!adulto(await usuario(ctx, actor.uid), ctx)) falha('failed-precondition', 'Menores de 18 anos não aparecem na vitrine de outra pessoa.');
  }
  // O "sim" vale para o torneio como ele está AGORA (nome, cidade, datas, resultado): a impressão vai junto.
  let fp = null;
  if (ok) {
    const evSnap = await ctx.db.collection(EV).doc(texto(d.event_id, 200)).get();
    if (!evSnap.exists) falha('not-found', 'Este torneio não existe mais.');
    fp = V.consentFingerprint({ id: evSnap.id, ...evSnap.data() }, actor.uid);
    // Ficha fora do que a tela grava (texto gigante): a impressão não vai para o pedido que os dois leem.
    if (fp.length > 2000) falha('failed-precondition', 'Este registro não pode ir à vitrine como está. Peça a quem registrou para salvá-lo de novo.');
  }
  const batch = ctx.db.batch();
  batch.update(ref, { public_ok_partner: ok, public_ok_at_ms: ctx.now, public_fp: fp });
  auditoria(ctx, batch, actor, ok ? 'career_public_partner_allowed' : 'career_public_partner_revoked', { doc_id: docId, event_id: d.event_id, user_id: d.owner_uid });
  await batch.commit();
  await rebuild(ctx, d.event_id);
  return { id: docId, ok };
}

const ACOES = { publish, unpublish, public_consent: publicConsent };

async function careerPublic(ctx, actor, data = {}) {
  const fn = (Object.hasOwn(ACOES, data.action) ? ACOES[data.action] : undefined);
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  return fn(ctx, actor, data);
}

/** Gatilho do evento: só mexe em quem tem vitrine (o `rebuild` sai cedo sem ela). */
const onEvent = (ctx, eventId) => rebuild(ctx, eventId);
/** Gatilho do pedido da dupla: confirmação, "não", consentimento ou pedido apagado mudam a vitrine. */
const onPartner = (ctx, before, after) => {
  const eventId = (after && after.event_id) || (before && before.event_id);
  return eventId ? rebuild(ctx, eventId) : 'absent';
};

module.exports = { careerPublic, rebuild, onEvent, onPartner, ACOES };
