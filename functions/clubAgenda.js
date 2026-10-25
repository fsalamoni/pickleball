/**
 * AGENDA OFICIAL DO CLUBE-ASSOCIAÇÃO (Bloco D2b, flag `club_association`) —
 * competições, seletivas, cursos, assembleias, reuniões da diretoria e do
 * conselho, prazos, solenidades. Só o SERVIDOR grava `club_x/{clube}/events`
 * (a regra é `write: if false` para a espécie): o evento já divulgado não muda
 * de data nem some calado (motivo obrigatório e histórico), o tipo que cada
 * cargo pode marcar e o aviso aos associados não se garantem no navegador.
 *
 * É o desenho do calendário da federação (`federationAgenda.js`) sem copiar a
 * régua: tipos, validação, horário e arquivo ICS são os MESMOS
 * (`federationAgendaPolicy.js`); aqui mudam o endereço dos dados
 * (`club_x/{clube}/events`), quem pode (cargo do clube, `permsDe`) e quem é
 * avisado (os associados em dia). A convocação e o resultado das reuniões
 * (pauta, quórum, ata) são do Bloco F; aqui a assembleia ainda é um evento.
 *
 * Callable `clubAgenda` (`docs` ou `admin` em qualquer evento; `sports` só na
 * agenda esportiva; a administração do clube tem todas):
 *  - `save`: cria ou edita. Evento que já foi divulgado (público ou só
 *    associados) e muda de data, ou que estava adiado/cancelado, exige motivo e
 *    ganha uma linha no histórico (remarcado / reaberto);
 *  - `postpone`: adiado sem nova data (motivo);
 *  - `cancel`: cancelado (motivo) — continua na agenda, com a faixa;
 *  - `delete`: só o que nunca foi divulgado (só a equipe viu).
 * Remarcar, adiar, cancelar e reabrir avisam os associados em dia; marcar avisa
 * quando a equipe pede.
 *
 * Quem lê: o público só vê `pub` (evento público, com a associação aberta); o
 * membro do clube, `members`; "só a equipe" fica com quem cuida da agenda. As
 * duas marcas são mantidas aqui — a regra só lê.
 *
 * `feed`: a agenda ASSINÁVEL (ICS) — só os eventos públicos, servida por
 * `federationAgendaFeed` em `/api/agenda/clube/{clube}.ics`.
 */
const A = require('./federationAgendaPolicy.js');
const m = require('./federationMembership.js');
const a = require('./clubAssociation.js');
const P = require('./clubDocsPolicy.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto, col } = a;
const EVENTS = 'events';
const DOCS = 'docs';
const HOST = 'picklerush.web.app';
const DAY_MS = 86400000;
const FEED_PAST_DAYS = 365;
const LOTE = 400;

/** `sports` cuida só da agenda esportiva; `docs` e `admin` de qualquer evento. */
const podeTipo = (perms, kind) => perms.includes('admin') || perms.includes('docs') || (perms.includes('sports') && Boolean(A.KINDS[kind]) && A.KINDS[kind].group === 'sport');
const podeAgenda = (perms) => ['admin', 'docs', 'sports'].some((p) => perms.includes(p));

async function contexto(ctx, actor, data) {
  await a.exigeFlag(ctx);
  const club = await a.clube(ctx, data.clubId);
  if (!(club.association && club.association.enabled === true)) falha('failed-precondition', 'Este clube ainda não abriu a associação.');
  const perms = await a.permsDe(ctx, club.id, actor.uid);
  if (!podeAgenda(perms)) falha('permission-denied', 'Você não tem permissão para a agenda deste clube.');
  return { club, perms };
}

async function evento(ctx, club, eventId) {
  const ref = col(ctx, club.id, EVENTS).doc(texto(eventId, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().club_id !== club.id) falha('not-found', 'Evento não encontrado.');
  return { ref, ev: { id: snap.id, ...snap.data() } };
}

/** Os documentos ligados têm de ser atos PUBLICADOS deste clube; grava código, título e quem vê. */
async function docsLigados(ctx, club, lista) {
  const out = [];
  for (const { doc_id: id } of lista) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await col(ctx, club.id, DOCS).doc(id).get();
    const d = snap.exists ? snap.data() : null;
    if (!d || d.club_id !== club.id || d.status !== 'published') falha('failed-precondition', 'Um documento ligado não está publicado no acervo deste clube.');
    out.push({ doc_id: id, code: texto(d.code, 80), title: texto(d.title, 200), type: texto(d.type, 40), visibility: texto(d.visibility, 10) });
  }
  return out;
}

const exigeMotivo = (data, oQue) => {
  const reason = texto(data.reason, 500);
  if (reason.length < A.REASON_MIN) falha('invalid-argument', `Diga o motivo ${oQue} (mínimo ${A.REASON_MIN} caracteres): quem já viu a agenda precisa saber.`);
  return reason;
};

/** "05/11/2026, 19:30" (ou só a data no dia inteiro). */
const dataDoEvento = (ev) => {
  const [y, mo, d] = String(ev.date || '').split('-');
  return `${d}/${mo}/${y}${ev.all_day || !ev.start_time ? '' : `, ${ev.start_time}`}`;
};

const linkDoEvento = (club, id) => `/clubes/${encodeURIComponent(club.id)}?tab=agenda&evento=${encodeURIComponent(id)}`;

/** As marcas que a REGRA lê: o evento está sempre "publicado"; a visibilidade decide. */
const marcas = (visibility) => P.readFlags('published', visibility);

/** Os associados em dia, menos quem agiu (quem comunica não lê a lista de associados — dado pessoal). */
async function associadosEmDia(ctx, club, actor) {
  const hoje = m.isoDateBR(ctx.now);
  const ativos = await col(ctx, club.id, 'aff').where('status', '==', 'active').get();
  return [...new Set(ativos.docs.map((d) => d.data()).filter((x) => m.membershipState(x, hoje, ctx.now).status === 'active').map((x) => x.user_id).filter((u) => u && u !== actor.uid))];
}

async function avisar(ctx, actor, club, ev, kind, reason = '') {
  if (ev.visibility === 'staff') return 0;
  const params = { clube: a.sigla(club) || club.name, titulo: texto(ev.title, 140) };
  const titulos = {
    created: tx('{clube} marcou na agenda: {titulo}', params), rescheduled: tx('{clube} remarcou: {titulo}', params), reopened: tx('{clube} reabriu: {titulo}', params),
    postponed: tx('{clube} adiou: {titulo}', params), cancelled: tx('{clube} cancelou: {titulo}', params),
  };
  const data = dataDoEvento(ev);
  const message = kind === 'created' ? data
    : kind === 'rescheduled' || kind === 'reopened' ? tx('Nova data: {data}. Motivo: {motivo}', { data, motivo: texto(reason, 200) })
      : tx('Motivo: {motivo}', { motivo: texto(reason, 200) });
  const uids = await associadosEmDia(ctx, club, actor);
  const link = linkDoEvento(club, ev.id);
  for (let i = 0; i < uids.length; i += LOTE) {
    const batch = ctx.db.batch();
    uids.slice(i, i + LOTE).forEach((uid) => a.aviso(ctx, batch, uid, { title: titulos[kind], message, link }));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  return uids.length;
}

/* ---------------------------------------------------------------- ações -- */

async function save(ctx, actor, data, { club, perms }) {
  const r = A.validateEvent(data.event || {});
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]);
  const value = r.value;
  if (!podeTipo(perms, value.kind)) falha('permission-denied', 'Seu cargo marca só eventos da agenda esportiva.');
  const related = await docsLigados(ctx, club, value.related_docs);
  const ts = ctx.Timestamp.fromMillis(ctx.now);
  const visivel = value.visibility !== 'staff';
  const quem = texto(actor.name, 80);

  if (data.eventId) {
    const { ref, ev } = await evento(ctx, club, data.eventId);
    if (!podeTipo(perms, ev.kind)) falha('permission-denied', 'Seu cargo cuida só dos eventos da agenda esportiva.');
    const status = ev.status || A.STATUS.SCHEDULED;
    const mudouData = A.whenChanged(ev, value);
    let change = null;
    if (ev.ever_visible && (mudouData || status !== A.STATUS.SCHEDULED)) {
      const reason = exigeMotivo(data, 'da mudança');
      change = {
        kind: status === A.STATUS.CANCELLED ? 'reopened' : 'rescheduled', reason, at_ms: ctx.now, by_name: quem,
        from_date: ev.date || '', from_time: ev.all_day ? '' : (ev.start_time || ''), to_date: value.date, to_time: value.all_day ? '' : value.start_time,
      };
    }
    const reagenda = Boolean(change) || (!ev.ever_visible && mudouData);
    const history = change ? [...(Array.isArray(ev.history) ? ev.history : []), change].slice(-A.HISTORY_MAX) : (ev.history || []);
    await ref.update({
      ...value, related_docs: related, history, ever_visible: Boolean(ev.ever_visible) || visivel, ...marcas(value.visibility),
      ...(reagenda ? { status: A.STATUS.SCHEDULED, status_reason: '' } : {}),
      updated_at: ts, updated_at_ms: ctx.now, updated_by: actor.uid,
    });
    const atual = { ...value, id: ev.id };
    let avisados = 0;
    if (change) avisados = await avisar(ctx, actor, club, atual, change.kind, change.reason);
    else if (visivel && !ev.ever_visible && data.notify === true) avisados = await avisar(ctx, actor, club, atual, 'created');
    await a.auditoria(ctx, actor, 'club_event_save', { club_id: club.id, event_id: ev.id, change: change ? change.kind : null, members_notified: avisados });
    return { ok: true, eventId: ev.id, notified: avisados };
  }

  const ref = col(ctx, club.id, EVENTS).doc();
  await ref.set({
    club_id: club.id, ...value, related_docs: related, status: A.STATUS.SCHEDULED, status_reason: '', history: [], ever_visible: visivel, ...marcas(value.visibility),
    created_by: actor.uid, created_by_name: quem, created_at: ts, created_at_ms: ctx.now, updated_at: ts, updated_at_ms: ctx.now,
  });
  const avisados = visivel && data.notify === true ? await avisar(ctx, actor, club, { ...value, id: ref.id }, 'created') : 0;
  await a.auditoria(ctx, actor, 'club_event_save', { club_id: club.id, event_id: ref.id, created: true, members_notified: avisados });
  return { ok: true, eventId: ref.id, notified: avisados };
}

/** Adiar (sem nova data) ou cancelar: motivo, histórico e aviso. O evento continua na agenda. */
async function mudarSituacao(ctx, actor, data, { club, perms }, kind) {
  const { ref, ev } = await evento(ctx, club, data.eventId);
  if (!podeTipo(perms, ev.kind)) falha('permission-denied', 'Seu cargo cuida só dos eventos da agenda esportiva.');
  const status = ev.status || A.STATUS.SCHEDULED;
  if (kind === 'postponed') {
    if (status !== A.STATUS.SCHEDULED) falha('failed-precondition', 'Só um evento confirmado é adiado.');
    if ((Number(ev.ends_at_ms) || 0) <= ctx.now) falha('failed-precondition', 'Este evento já aconteceu.');
  } else if (status === A.STATUS.CANCELLED) falha('failed-precondition', 'Este evento já está cancelado.');
  const reason = exigeMotivo(data, kind === 'postponed' ? 'do adiamento' : 'do cancelamento');
  const entrada = { kind, reason, at_ms: ctx.now, by_name: texto(actor.name, 80), from_date: ev.date || '', from_time: ev.all_day ? '' : (ev.start_time || ''), to_date: '', to_time: '' };
  const history = [...(Array.isArray(ev.history) ? ev.history : []), entrada].slice(-A.HISTORY_MAX);
  await ref.update({ status: kind === 'postponed' ? A.STATUS.POSTPONED : A.STATUS.CANCELLED, status_reason: reason, history, updated_at_ms: ctx.now, updated_by: actor.uid });
  const avisados = await avisar(ctx, actor, club, ev, kind, reason);
  await a.auditoria(ctx, actor, `club_event_${kind === 'postponed' ? 'postpone' : 'cancel'}`, { club_id: club.id, event_id: ev.id, reason, members_notified: avisados });
  return { ok: true, notified: avisados };
}

async function remove(ctx, actor, data, { club, perms }) {
  const { ref, ev } = await evento(ctx, club, data.eventId);
  if (!podeTipo(perms, ev.kind)) falha('permission-denied', 'Seu cargo cuida só dos eventos da agenda esportiva.');
  if (ev.ever_visible) falha('failed-precondition', 'Evento já divulgado não se apaga: cancele, com o motivo.');
  await ref.delete();
  await a.auditoria(ctx, actor, 'club_event_delete', { club_id: club.id, event_id: ev.id });
  return { ok: true };
}

const ACOES = {
  save,
  postpone: (ctx, actor, data, c) => mudarSituacao(ctx, actor, data, c, 'postponed'),
  cancel: (ctx, actor, data, c) => mudarSituacao(ctx, actor, data, c, 'cancelled'),
  delete: remove,
};

async function agenda(ctx, actor, data = {}) {
  const fn = ACOES[data.action];
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  const c = await contexto(ctx, actor, data);
  return fn(ctx, actor, data, c);
}

/* ----------------------------------------------------- agenda assinável -- */

/**
 * O ICS público do clube: eventos públicos do último ano para a frente. `null`
 * quando não há o que servir (flag desligada, clube inexistente ou com a
 * associação fechada ao público).
 */
async function feed(ctx, chave) {
  const k = String(chave || '').slice(0, 80);
  if (!/^[A-Za-z0-9_-]+$/.test(k) || !(await a.flagLigada(ctx))) return null;
  const snap = await ctx.db.collection('clubs').doc(k).get();
  const club = snap.exists ? { id: snap.id, ...snap.data() } : null;
  // A agenda assinável é pública: o clube com a associação fechada ao público não tem.
  if (!a.aberta(club)) return null;
  const desde = ctx.now - FEED_PAST_DAYS * DAY_MS;
  const evs = (await col(ctx, club.id, EVENTS).where('pub', '==', true).get())
    .docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => (Number(e.ends_at_ms) || 0) >= desde)
    .sort((x, y) => (Number(x.starts_at_ms) || 0) - (Number(y.starts_at_ms) || 0));
  return A.buildIcs(evs, {
    name: `${a.sigla(club) || club.name} — Agenda oficial`, host: HOST, stampMs: ctx.now,
    urlOf: (ev) => `https://${HOST}/c/${encodeURIComponent(club.id)}?evento=${encodeURIComponent(ev.id)}`,
  });
}

module.exports = { agenda, feed, podeTipo, EVENTS };
