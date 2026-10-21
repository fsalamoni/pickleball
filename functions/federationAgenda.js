/**
 * CALENDÁRIO OFICIAL da federação (módulo `calendar`) — só o SERVIDOR grava
 * `federation_events` (a regra é `allow write: if false`). Por que aqui: o
 * evento já divulgado não muda de data nem some calado (motivo obrigatório e
 * histórico), o tipo que cada cargo pode marcar e o aviso a quem segue não se
 * garantem no navegador.
 *
 * Callable `federationAgenda` (permissão `docs` ou `admin` em qualquer
 * evento; `competitions` só na agenda esportiva):
 *  - `save`: cria ou edita. Evento que já foi divulgado (público ou só
 *    filiados) e muda de data, ou que estava adiado/cancelado, exige motivo e
 *    ganha uma linha no histórico (remarcado / reaberto);
 *  - `postpone`: adiado sem nova data (motivo);
 *  - `cancel`: cancelado (motivo) — continua na agenda, com a faixa;
 *  - `delete`: só o que nunca foi divulgado (só a equipe viu);
 *  - `convene` (reunião/assembleia): data da convocação, edital do acervo,
 *    quórum e pauta — só antes do resultado; mudar a de reunião divulgada
 *    pede motivo (histórico `agenda_changed`);
 *  - `record`: presença, chamada, quórum, resultado de cada item da pauta e
 *    os documentos (ata, lista de presença, registro de votação) — só depois
 *    de começar; corrigir pede motivo (histórico `record_corrected`).
 *    A régua das reuniões é `federationMeetingPolicy.js`.
 * Remarcar, adiar, cancelar e reabrir avisam quem SEGUE as publicações
 * oficiais (`federation_followers`) e pode ver o evento; marcar avisa quando
 * a equipe pede.
 *
 * `feed`: a agenda ASSINÁVEL (ICS) — só os eventos públicos e os torneios
 * chancelados, servida por `federationAgendaFeed` em `/api/agenda/{slug}.ics`.
 *
 * A conta pura (tipos, validação, ICS) é `federationAgendaPolicy.js`.
 */
const A = require('./federationAgendaPolicy.js');
const M = require('./federationMeetingPolicy.js');
const f = require('./federations.js');
const { avisarSeguidores } = require('./federationAcervo.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const EVENTS = 'federation_events';
const DOCS = 'federation_docs';
const HOST = 'picklerush.web.app';
const DAY_MS = 86400000;
const FEED_PAST_DAYS = 365;

const podeTipo = (perms, kind) => perms.includes('admin') || perms.includes('docs') || (perms.includes('competitions') && A.KINDS[kind] && A.KINDS[kind].group === 'sport');
const podeAgenda = (perms) => ['admin', 'docs', 'competitions'].some((p) => perms.includes(p));

async function contexto(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  if (!(fed.modules && fed.modules.calendar === true)) falha('failed-precondition', 'Esta federação não tem o calendário oficial ligado.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  if (!podeAgenda(perms)) falha('permission-denied', 'Você não tem permissão para a agenda desta federação.');
  return { fed, perms };
}

async function evento(ctx, fed, eventId) {
  const ref = ctx.db.collection(EVENTS).doc(texto(eventId, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== fed.id) falha('not-found', 'Evento não encontrado.');
  return { ref, ev: { id: snap.id, ...snap.data() } };
}

/** Os documentos ligados têm de ser atos PUBLICADOS desta federação; grava código, título e quem vê. */
async function docsLigados(ctx, fed, lista) {
  const out = [];
  for (const { doc_id: id } of lista) {
    const snap = await ctx.db.collection(DOCS).doc(id).get();
    const d = snap.exists ? snap.data() : null;
    if (!d || d.federation_id !== fed.id || d.status !== 'published') falha('failed-precondition', 'Um documento ligado não está publicado no acervo desta federação.');
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
  const [y, m, d] = String(ev.date || '').split('-');
  return `${d}/${m}/${y}${ev.all_day || !ev.start_time ? '' : `, ${ev.start_time}`}`;
};

const linkDoEvento = (fed, id) => `/f/${encodeURIComponent(fed.slug || fed.id)}/agenda/${encodeURIComponent(id)}`;

function avisar(ctx, actor, fed, ev, kind, reason = '') {
  const params = { sigla: fed.acronym || fed.name, titulo: texto(ev.title, 140) };
  const titulos = {
    created: tx('{sigla} marcou na agenda: {titulo}', params), rescheduled: tx('{sigla} remarcou: {titulo}', params), reopened: tx('{sigla} reabriu: {titulo}', params),
    postponed: tx('{sigla} adiou: {titulo}', params), cancelled: tx('{sigla} cancelou: {titulo}', params),
    convened: tx('{sigla} convocou: {titulo}', params), agenda_changed: tx('{sigla} mudou a pauta: {titulo}', params),
    recorded: tx('{sigla} publicou o resultado: {titulo}', params), record_corrected: tx('{sigla} corrigiu o resultado: {titulo}', params),
  };
  const data = dataDoEvento(ev);
  const itens = (ev.meeting && ev.meeting.items ? ev.meeting.items.length : 0);
  const message = kind === 'created' ? data
    : kind === 'convened' ? tx('Reunião em {data}. Pauta com {n} itens.', { data, n: itens })
      : kind === 'recorded' ? tx('Reunião de {data}: presença, decisões e documentos.', { data })
        : kind === 'rescheduled' || kind === 'reopened' ? tx('Nova data: {data}. Motivo: {motivo}', { data, motivo: texto(reason, 200) })
          : tx('Motivo: {motivo}', { motivo: texto(reason, 200) });
  return avisarSeguidores(ctx, actor, fed, { visibility: ev.visibility, title: titulos[kind], message, link: linkDoEvento(fed, ev.id) });
}

/* ---------------------------------------------------------------- ações -- */

async function save(ctx, actor, data, { fed, perms }) {
  const r = A.validateEvent(data.event || {});
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]);
  const value = r.value;
  if (!podeTipo(perms, value.kind)) falha('permission-denied', 'Seu cargo marca só eventos da agenda esportiva.');
  const related = await docsLigados(ctx, fed, value.related_docs);
  const ts = ctx.Timestamp.fromMillis(ctx.now);
  const visivel = value.visibility !== 'staff';
  const quem = texto(actor.name, 80);

  if (data.eventId) {
    const { ref, ev } = await evento(ctx, fed, data.eventId);
    if (!podeTipo(perms, ev.kind)) falha('permission-denied', 'Seu cargo cuida só dos eventos da agenda esportiva.');
    const status = ev.status || A.STATUS.SCHEDULED;
    const mudouData = A.whenChanged(ev, value);
    const convocada = Boolean(ev.meeting && ev.meeting.convened_on);
    if (convocada && !A.KINDS[value.kind].meeting) falha('failed-precondition', 'Reunião já convocada não muda para um tipo que não é reunião.');
    if (convocada && value.date < ev.meeting.convened_on) falha('failed-precondition', 'A reunião não pode ser antes da convocação.');
    if (ev.meeting && ev.meeting.record && mudouData) falha('failed-precondition', 'Reunião com resultado registrado não muda de data.');
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
      ...value, related_docs: related, history, ever_visible: Boolean(ev.ever_visible) || visivel,
      ...(reagenda ? { status: A.STATUS.SCHEDULED, status_reason: '' } : {}),
      updated_at: ts, updated_at_ms: ctx.now, updated_by: actor.uid,
    });
    const atual = { ...value, id: ev.id };
    let avisados = 0;
    if (visivel && change) avisados = await avisar(ctx, actor, fed, atual, change.kind, change.reason);
    else if (visivel && !ev.ever_visible && data.notify === true) avisados = await avisar(ctx, actor, fed, atual, 'created');
    await f.auditoria(ctx, actor, 'federation_event_save', { federation_id: fed.id, event_id: ev.id, change: change ? change.kind : null, followers_notified: avisados });
    return { ok: true, eventId: ev.id, notified: avisados };
  }

  const ref = ctx.db.collection(EVENTS).doc();
  await ref.set({
    federation_id: fed.id, ...value, related_docs: related, status: A.STATUS.SCHEDULED, status_reason: '', history: [], ever_visible: visivel,
    created_by: actor.uid, created_by_name: quem, created_at: ts, created_at_ms: ctx.now, updated_at: ts, updated_at_ms: ctx.now,
  });
  const avisados = visivel && data.notify === true ? await avisar(ctx, actor, fed, { ...value, id: ref.id }, 'created') : 0;
  await f.auditoria(ctx, actor, 'federation_event_save', { federation_id: fed.id, event_id: ref.id, created: true, followers_notified: avisados });
  return { ok: true, eventId: ref.id, notified: avisados };
}

/** Adiar (sem nova data) ou cancelar: motivo, histórico e aviso. O evento continua na agenda. */
async function mudarSituacao(ctx, actor, data, { fed, perms }, kind) {
  const { ref, ev } = await evento(ctx, fed, data.eventId);
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
  const avisados = ev.visibility !== 'staff' ? await avisar(ctx, actor, fed, ev, kind, reason) : 0;
  await f.auditoria(ctx, actor, `federation_event_${kind === 'postponed' ? 'postpone' : 'cancel'}`, { federation_id: fed.id, event_id: ev.id, reason, followers_notified: avisados });
  return { ok: true, notified: avisados };
}

async function remove(ctx, actor, data, { fed, perms }) {
  const { ref, ev } = await evento(ctx, fed, data.eventId);
  if (!podeTipo(perms, ev.kind)) falha('permission-denied', 'Seu cargo cuida só dos eventos da agenda esportiva.');
  if (ev.ever_visible) falha('failed-precondition', 'Evento já divulgado não se apaga: cancele, com o motivo.');
  await ref.delete();
  await f.auditoria(ctx, actor, 'federation_event_delete', { federation_id: fed.id, event_id: ev.id });
  return { ok: true };
}

/* --------------------------------------------- reuniões e assembleias -- */

/** Documento do acervo ligado à reunião: publicado, desta federação e (com lista) do tipo certo. Copia código, título, tipo e quem lê. */
async function docDaReuniao(ctx, fed, id, tipos, oQue) {
  if (!id) return null;
  const snap = await ctx.db.collection(DOCS).doc(id).get();
  const d = snap.exists ? snap.data() : null;
  if (!d || d.federation_id !== fed.id || d.status !== 'published') falha('failed-precondition', `${oQue}: o documento precisa estar publicado no acervo desta federação.`);
  if (tipos && !tipos.includes(d.type)) falha('failed-precondition', `${oQue}: este tipo de documento não serve aqui.`);
  return { doc_id: id, code: texto(d.code, 80), title: texto(d.title, 200), type: texto(d.type, 40), visibility: texto(d.visibility, 10) };
}

async function reuniao(ctx, fed, perms, eventId) {
  const r = await evento(ctx, fed, eventId);
  if (!podeTipo(perms, r.ev.kind)) falha('permission-denied', 'Seu cargo cuida só dos eventos da agenda esportiva.');
  if (!(A.KINDS[r.ev.kind] && A.KINDS[r.ev.kind].meeting)) falha('failed-precondition', 'Só reunião e assembleia têm convocação e resultado.');
  return r;
}

const entradaHistorico = (ctx, actor, kind, reason) => ({ kind, reason, at_ms: ctx.now, by_name: texto(actor.name, 80), from_date: '', from_time: '', to_date: '', to_time: '' });

/**
 * Convocar (ou mudar a convocação): data, edital, quórum e pauta. Só antes
 * do resultado; mudar a de uma reunião já divulgada pede motivo, entra no
 * histórico e avisa quem segue.
 */
async function convene(ctx, actor, data, { fed, perms }) {
  const { ref, ev } = await reuniao(ctx, fed, perms, data.eventId);
  const status = ev.status || A.STATUS.SCHEDULED;
  if (status === A.STATUS.CANCELLED) falha('failed-precondition', 'Reunião cancelada não se convoca.');
  if (status === A.STATUS.POSTPONED) falha('failed-precondition', 'Marque a nova data da reunião antes de convocar.');
  if (ev.meeting && ev.meeting.record) falha('failed-precondition', 'Reunião com resultado registrado não muda a convocação.');
  const r = M.validateConvocation(data.convocation || {}, { eventDate: ev.date, nowMs: ctx.now });
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]);
  const edital = await docDaReuniao(ctx, fed, r.value.edital_doc_id, M.MEETING_DOC_TYPES.edital, 'O edital');
  const ja = Boolean(ev.meeting && ev.meeting.convened_on);
  const change = ja && ev.ever_visible ? entradaHistorico(ctx, actor, 'agenda_changed', exigeMotivo(data, 'da mudança na convocação')) : null;
  const { edital_doc_id: _e, ...resto } = r.value;
  const meeting = { ...resto, edital, convened_at_ms: ja ? (ev.meeting.convened_at_ms || ctx.now) : ctx.now, record: null };
  const history = change ? [...(Array.isArray(ev.history) ? ev.history : []), change].slice(-A.HISTORY_MAX) : (ev.history || []);
  await ref.update({ meeting, history, updated_at: ctx.Timestamp.fromMillis(ctx.now), updated_at_ms: ctx.now, updated_by: actor.uid });
  const atual = { ...ev, meeting };
  let avisados = 0;
  if (ev.visibility !== 'staff' && change) avisados = await avisar(ctx, actor, fed, atual, 'agenda_changed', change.reason);
  else if (ev.visibility !== 'staff' && !ja && data.notify === true) avisados = await avisar(ctx, actor, fed, atual, 'convened');
  await f.auditoria(ctx, actor, 'federation_event_convene', { federation_id: fed.id, event_id: ev.id, items: meeting.items.length, change: change ? change.kind : null, followers_notified: avisados });
  return { ok: true, notified: avisados };
}

/**
 * Registrar (ou corrigir) o resultado: presença, chamada, quórum, o que se
 * decidiu em cada item e os documentos (ata, lista de presença, registro de
 * votação, o ato de cada item). Só depois de a reunião começar; corrigir o
 * de uma reunião divulgada pede motivo e entra no histórico.
 */
async function record(ctx, actor, data, { fed, perms }) {
  const { ref, ev } = await reuniao(ctx, fed, perms, data.eventId);
  if (!(ev.meeting && ev.meeting.convened_on)) falha('failed-precondition', 'Convoque a reunião (com a pauta) antes de registrar o resultado.');
  if ((ev.status || A.STATUS.SCHEDULED) !== A.STATUS.SCHEDULED) falha('failed-precondition', 'Reunião adiada ou cancelada não tem resultado.');
  if ((Number(ev.starts_at_ms) || 0) > ctx.now) falha('failed-precondition', 'A reunião ainda não começou.');
  const r = M.validateRecord(data.record || {}, ev.meeting.items || []);
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]);
  const v = r.value;
  const items = [];
  for (const it of v.items) {
    const { doc_id: id, ...resto } = it;
    items.push({ ...resto, doc: await docDaReuniao(ctx, fed, id, null, 'O ato do item') });
  }
  const ja = Boolean(ev.meeting.record);
  const change = ja && ev.ever_visible ? entradaHistorico(ctx, actor, 'record_corrected', exigeMotivo(data, 'da correção do resultado')) : null;
  const rec = {
    call: v.call, opened_at: v.opened_at, quorum_reached: v.quorum_reached, present: v.present, eligible: v.eligible, notes: v.notes, items,
    minutes: await docDaReuniao(ctx, fed, v.minutes_doc_id, M.MEETING_DOC_TYPES.minutes, 'A ata'),
    attendance: await docDaReuniao(ctx, fed, v.attendance_doc_id, M.MEETING_DOC_TYPES.attendance, 'A lista de presença'),
    votes: await docDaReuniao(ctx, fed, v.votes_doc_id, M.MEETING_DOC_TYPES.votes, 'O registro de votação'),
    recorded_at_ms: ja ? (ev.meeting.record.recorded_at_ms || ctx.now) : ctx.now, recorded_by_name: texto(actor.name, 80), updated_at_ms: ctx.now,
  };
  const meeting = { ...ev.meeting, record: rec };
  const history = change ? [...(Array.isArray(ev.history) ? ev.history : []), change].slice(-A.HISTORY_MAX) : (ev.history || []);
  await ref.update({ meeting, history, updated_at: ctx.Timestamp.fromMillis(ctx.now), updated_at_ms: ctx.now, updated_by: actor.uid });
  const atual = { ...ev, meeting };
  const aviso = change ? 'record_corrected' : (ja ? null : 'recorded');
  const avisados = ev.visibility !== 'staff' && aviso ? await avisar(ctx, actor, fed, atual, aviso, change ? change.reason : '') : 0;
  await f.auditoria(ctx, actor, 'federation_event_record', { federation_id: fed.id, event_id: ev.id, quorum_reached: rec.quorum_reached, change: change ? change.kind : null, followers_notified: avisados });
  return { ok: true, notified: avisados };
}

const ACOES = {
  save,
  convene,
  record,
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
 * O ICS público da federação (pelo id ou pelo endereço `slug`): eventos
 * públicos do último ano para a frente e os torneios chancelados. `null`
 * quando não há o que servir (flag desligada, federação inexistente, não
 * aprovada ou sem o calendário ligado).
 */
async function feed(ctx, chave) {
  const k = String(chave || '').slice(0, 80);
  if (!/^[A-Za-z0-9_-]+$/.test(k) || !(await f.flagLigada(ctx))) return null;
  let fed = null;
  const porId = await ctx.db.collection(f.C.federations).doc(k).get();
  if (porId.exists) fed = { id: porId.id, ...porId.data() };
  else {
    const q = await ctx.db.collection(f.C.federations).where('slug', '==', k).where('status', '==', 'approved').limit(1).get();
    if (!q.empty) fed = { id: q.docs[0].id, ...q.docs[0].data() };
  }
  if (!fed || fed.status !== 'approved' || !(fed.modules && fed.modules.calendar === true)) return null;
  const desde = ctx.now - FEED_PAST_DAYS * DAY_MS;
  const evs = (await ctx.db.collection(EVENTS).where('federation_id', '==', fed.id).where('visibility', '==', 'public').get())
    .docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => (Number(e.ends_at_ms) || 0) >= desde);
  let torneios = [];
  if (fed.modules.tournaments === true) {
    torneios = (await ctx.db.collection('tournaments').where('federation_id', '==', fed.id).get())
      .docs.map((d) => A.tournamentAgendaItem({ id: d.id, ...d.data() })).filter((e) => e && e.ends_at_ms >= desde);
  }
  const slug = encodeURIComponent(fed.slug || fed.id);
  const itens = [...evs, ...torneios].sort((a, b) => (Number(a.starts_at_ms) || 0) - (Number(b.starts_at_ms) || 0));
  return A.buildIcs(itens, {
    name: `${fed.acronym || fed.name} — Agenda oficial`, host: HOST, stampMs: ctx.now,
    urlOf: (ev) => (ev.derived ? `https://${HOST}/torneios/${encodeURIComponent(ev.tournament_id)}` : `https://${HOST}/f/${slug}/agenda/${encodeURIComponent(ev.id)}`),
  });
}

module.exports = { agenda, feed, EVENTS };
