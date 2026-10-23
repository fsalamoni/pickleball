/**
 * ENVIO AUTOMÁTICO DE PARTIDAS AO DUPR — o livro `dupr_submissions` e a
 * varredura que o mantém (`duprSubmitWorker`, a cada 15 min, e "Processar
 * agora" no Painel admin → DUPR → Envios).
 *
 * Só roda com a flag `dupr_official_sync` ligada E a política (Funcionalidades
 * → DUPR) fora de "Desligado". Lê as MESMAS partidas decididas do ranking
 * (`tournament_matches` + `club_event_games`, o espelho dos dias de jogo
 * publicados e dos confrontos de equipe), decide cada uma pela política
 * (`duprPolicy.js`) e grava, por partida, um documento
 * `dupr_submissions/{identifier}`:
 *
 *   retida (falta conta/ID DUPR/assinatura) → na fila (carência) → enviada
 *   aguardando aprovação (modo manual) → na fila
 *   enviada → atualizada (placar mudou) | excluída (partida anulada/despublicada)
 *   falhou → nova tentativa com espera crescente (até 6), depois só o admin
 *
 * O `identifier` (`pr:tm:<id>` / `pr:gd:<id>`) é único: reenviar não duplica.
 * Partida já enviada não sai do DUPR por mudança de política nem por alguém
 * desconectar a conta — só quando ela deixa de existir como resultado (placar
 * apagado, dia despublicado, torneio cancelado/arquivado/privado) ou quando o
 * admin a apaga ("Apagar no DUPR", que também impede o reenvio).
 *
 * Torneio chancelado por federação fica de fora: quem envia é a federação
 * (planilha DUPR) — um remetente por partida. No piloto da política
 * (`audience: admins`) só entram partidas com algum admin da plataforma.
 */
const crypto = require('crypto');
const { DuprError } = require('./duprClient');
const {
  DUPR_MODE, DUPR_AUDIENCE, DUPR_ID_KIND, normalizeDuprPolicy, duprBucket, duprSubmissionDecision,
  duprMatchEligibility, duprReadiness, duprIdentifier,
} = require('./duprPolicy');
const { duprMatchPayload } = require('./duprPilot');
const { isEligible } = require('./ranking');

const COL = 'dupr_submissions';
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const MAX_TRIES = 6;
const MAX_CALLS = 60; // chamadas ao DUPR por passada; o resto fica na fila para a próxima
// ponytail: só partidas decididas nos últimos 30 dias ENTRAM no livro (as que já
// estão nele seguem acompanhadas). Histórico antigo vai pela exportação CSV.
const JANELA_NOVAS = 30 * DAY;
const FINISHED = ['finished', 'walkover'];

const STATUS = Object.freeze({
  HELD: 'held', APPROVAL: 'awaiting_approval', QUEUED: 'queued', SENT: 'sent', FAILED: 'failed', DELETED: 'deleted',
});

const texto = (v) => String(v == null ? '' : v).trim();

function toMillis(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  return 0;
}

/** `YYYY-MM-DD` no fuso de Brasília (a data em que se jogou, para o DUPR). */
function dataSP(ms) {
  if (!ms) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

function jogos(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((g) => ({ a: Number(g && g.a), b: Number(g && g.b) }))
    .filter((g) => Number.isFinite(g.a) && Number.isFinite(g.b))
    .map((g) => ({ a: Math.trunc(g.a), b: Math.trunc(g.b) }));
}

function local(...partes) {
  return partes.map(texto).filter(Boolean).join(', ');
}

function ladoDaInscricao(ids, regById) {
  const uids = [];
  let completo = true;
  (ids || []).forEach((rid) => {
    const r = regById.get(rid);
    if (!r) { completo = false; return; }
    const quem = r.format === 'doubles' ? [r.player_a_user_id, r.player_b_user_id] : [r.player_a_user_id];
    quem.forEach((u) => { if (u) uids.push(u); else completo = false; });
  });
  return { uids, completo: completo && uids.length > 0 };
}

const federacaoEnvia = (t) => Boolean(t && t.federation_id && t.federation_sanction && t.federation_sanction.status === 'approved');
const escolha = (v) => (typeof v === 'boolean' ? v : null);

/**
 * As partidas decididas que PODEM ir ao DUPR (puro). Partida sem resultado,
 * W.O., de torneio fora do ranking ou chancelado não vira candidata. Cada uma
 * sai com o que a política e o envio precisam.
 */
function buildCandidates({ tournamentMatches = [], clubEventMatches = [], regById = new Map(), tournamentById = new Map(), modalityById = new Map(), gameDayById = new Map() }) {
  const out = [];
  tournamentMatches.forEach((m) => {
    if (m.team_confrontation || m.status === 'walkover') return;
    if (m.winner_side !== 'a' && m.winner_side !== 'b') return;
    const t = tournamentById.get(m.tournament_id);
    if (!isEligible(t) || federacaoEnvia(t)) return;
    const a = ladoDaInscricao(m.side_a_ids, regById);
    const b = ladoDaInscricao(m.side_b_ids, regById);
    const mod = modalityById.get(m.modality_id) || {};
    const stage = (Array.isArray(mod.stages) ? mod.stages : [])[Number(m.stage_index) || 0] || {};
    const at = toMillis(m.result_recorded_at) || toMillis(m.updated_at) || toMillis(m.created_at);
    out.push({
      identifier: duprIdentifier(DUPR_ID_KIND.TOURNAMENT_MATCH, m.id),
      ref: `tournament_matches/${m.id}`,
      origin: 'tournament',
      bucket: duprBucket({ origin: 'tournament', stageType: stage.type }),
      creatorChoice: escolha(mod.dupr_submit),
      sideA: a.uids, sideB: b.uids, semConta: !a.completo || !b.completo,
      games: jogos(m.games), winner: m.winner_side,
      at, date: dataSP(at), event: texto(t.name) || 'Torneio', bracket: texto(mod.name),
      location: local(t.venue || t.location, t.city, t.state), playType: 'TOURNAMENT', grace: true,
      tournament_id: m.tournament_id, modality_id: m.modality_id || null, game_day_id: null,
      organizer_uid: t.created_by || null,
    });
  });
  clubEventMatches.forEach((m) => {
    if (m.winner_side !== 'a' && m.winner_side !== 'b') return;
    const a = Array.isArray(m.side_a_ids) ? m.side_a_ids : [];
    const b = Array.isArray(m.side_b_ids) ? m.side_b_ids : [];
    let games = jogos(m.games);
    if (!games.length) games = jogos(m.set_scores);
    if (!games.length && (Number(m.score_a) || Number(m.score_b))) games = [{ a: Math.trunc(Number(m.score_a) || 0), b: Math.trunc(Number(m.score_b) || 0) }];
    const base = {
      identifier: duprIdentifier(DUPR_ID_KIND.GAME_DAY_GAME, m.id),
      ref: `club_event_games/${m.id}`,
      sideA: a.filter(Boolean), sideB: b.filter(Boolean),
      semConta: a.length === 0 || b.length === 0 || a.some((u) => !u) || b.some((u) => !u),
      games, winner: m.winner_side, game_day_id: null, modality_id: null, bracket: '',
    };
    const recorded = toMillis(m.result_recorded_at) || toMillis(m.created_at);
    if (m.source === 'team_confrontation') {
      const t = tournamentById.get(m.tournament_id);
      if (!isEligible(t) || federacaoEnvia(t)) return;
      out.push({
        ...base, origin: 'tournament', bucket: duprBucket({ origin: 'tournament', teamConfrontation: true }), creatorChoice: null,
        at: recorded, date: dataSP(recorded), event: texto(t.name) || 'Torneio por equipes',
        location: local(t.venue || t.location, t.city, t.state), playType: 'TOURNAMENT', grace: true,
        tournament_id: m.tournament_id, organizer_uid: t.created_by || null,
      });
      return;
    }
    const gd = m.source === 'athlete_game_day' ? gameDayById.get(m.event_id) || null : null;
    const dia = gd && /^\d{4}-\d{2}-\d{2}$/.test(texto(gd.date)) ? texto(gd.date) : dataSP(recorded);
    out.push({
      ...base, origin: gd ? 'game_day' : 'club_event',
      bucket: duprBucket({ origin: 'game_day', gameDayFormat: gd ? gd.format : null }),
      creatorChoice: escolha(gd && gd.dupr_submit),
      at: recorded, date: dia, event: texto(gd ? gd.title : m.event_title) || 'Dia de jogo',
      location: gd ? local(gd.location, gd.city, gd.state) : '', playType: 'RECREATIONAL', grace: false,
      tournament_id: null, game_day_id: gd ? m.event_id : null, organizer_uid: gd ? gd.created_by || null : null,
    });
  });
  return out.filter((c) => c.identifier);
}

/** Motivos em que a partida é válida mas não vai por ESCOLHA (política ou quem criou). */
const POR_ESCOLHA = ['policy_off', 'excluded_by_rule', 'creator_off', 'default_off', 'play_no_score'];

function hashDe(payload) {
  return crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

/**
 * O que a partida pede AGORA (puro): `skip` (não vai, ou não é válida),
 * `held` (falta conta/ID/assinatura) ou `ready` (com o corpo pronto).
 */
function planEntry(c, links, policy) {
  const decision = duprSubmissionDecision({ bucket: c.bucket, creatorChoice: c.creatorChoice }, policy);
  if (!decision.submit) return { kind: 'skip', reason: decision.reason, decision };
  if (!c.semConta) {
    const valida = duprMatchEligibility({ side_a: c.sideA, side_b: c.sideB, games: c.games, winner: c.winner });
    if (!valida.ok) return { kind: 'skip', reason: valida.problems[0], decision };
  }
  const uids = [...c.sideA, ...c.sideB];
  const pronto = duprReadiness(uids, links);
  if (c.semConta || !pronto.ok) {
    return { kind: 'held', decision, problems: [...(c.semConta ? ['guest'] : []), ...(pronto.missing.length ? ['no_dupr'] : []), ...(pronto.noEntitlement.length ? ['no_entitlement'] : [])], missing: pronto.missing, noEntitlement: pronto.noEntitlement };
  }
  const id = (u) => links[u].dupr_id;
  const r = duprMatchPayload({
    identifier: c.identifier, event: c.event, date: c.date, location: c.location,
    playType: c.playType, sideA: c.sideA.map(id), sideB: c.sideB.map(id), games: c.games,
  });
  if (r.problems) return { kind: 'skip', reason: r.problems[0], decision };
  if (c.bracket) r.payload.bracket = c.bracket.slice(0, 80);
  return { kind: 'ready', decision, payload: r.payload, hash: hashDe(r.payload) };
}

/**
 * A próxima situação de UMA partida (puro). `entry` nulo = a partida não
 * existe mais como resultado válido. Devolve `{ doc, action }`: `doc` nulo
 * apaga a linha do livro, `undefined` deixa como está; `action` é a chamada
 * ao DUPR que a transição exige (`create` | `update` | `delete` | `none`).
 */
function reconcile(existing, c, entry, { now, graceMs }) {
  const ex = existing || null;
  // Está no DUPR: enviada, ou falhou numa ATUALIZAÇÃO (o match_code existe).
  const enviada = Boolean(ex && ex.match_code && ex.status !== STATUS.DELETED);
  if (ex && ex.blocked) return { doc: undefined, action: 'none' };
  if (!c || !entry || (entry.kind === 'skip' && !POR_ESCOLHA.includes(entry.reason))) {
    // Sem resultado válido: o que foi ao DUPR sai de lá; o resto sai do livro.
    if (enviada) return { doc: { ...ex, status: STATUS.DELETED, reason: 'match_removed', updated_at_ms: now }, action: 'delete' };
    if (ex && ex.status !== STATUS.DELETED) return { doc: null, action: 'none' };
    return { doc: undefined, action: 'none' };
  }
  const base = {
    identifier: c.identifier, ref: c.ref, origin: c.origin, bucket: c.bucket, event: c.event, date: c.date,
    tournament_id: c.tournament_id || null, modality_id: c.modality_id || null, game_day_id: c.game_day_id || null,
    organizer_uid: c.organizer_uid || null, uids: [...c.sideA, ...c.sideB], side_a: c.sideA, side_b: c.sideB,
    games: c.games, decision: entry.decision.reason,
  };
  if (entry.kind === 'skip') {
    // A política (ou quem criou) tirou: o já enviado fica; o resto sai do livro.
    if (enviada) return { doc: undefined, action: 'none' };
    return { doc: ex ? null : undefined, action: 'none' };
  }
  if (entry.kind === 'held') {
    if (enviada) return { doc: undefined, action: 'none' };
    return {
      doc: { ...base, status: STATUS.HELD, problems: entry.problems, missing_uids: entry.missing, no_entitlement_uids: entry.noEntitlement, created_at_ms: (ex && ex.created_at_ms) || now, updated_at_ms: now },
      action: 'none',
    };
  }
  const pronto = { ...base, payload_hash: entry.hash, problems: [], missing_uids: [], no_entitlement_uids: [], created_at_ms: (ex && ex.created_at_ms) || now, updated_at_ms: now };
  if (ex && ex.status === STATUS.FAILED) {
    const mudou = ex.payload_hash !== entry.hash;
    // Placar corrigido depois da falha: tenta de novo já, com o corpo novo.
    if (mudou || (ex.next_try_ms && ex.next_try_ms <= now)) {
      const doc = { ...ex, ...pronto, status: STATUS.FAILED, ...(mudou ? { attempts: 0 } : {}) };
      return { doc, action: enviada ? 'update' : 'create', payload: entry.payload };
    }
    return { doc: undefined, action: 'none' };
  }
  if (enviada) {
    if (ex.sent_hash === entry.hash) return { doc: undefined, action: 'none' };
    return { doc: { ...ex, ...pronto, status: STATUS.SENT }, action: 'update', payload: entry.payload };
  }
  // Daqui para baixo a partida não está no DUPR (nova, retida ou apagada ao ser anulada).
  const limpa = { ...(ex || {}), ...pronto, match_code: null, sent_hash: null };
  if (entry.decision.needsApproval && !(ex && ex.approved)) {
    if (ex && ex.status === STATUS.APPROVAL && ex.payload_hash === entry.hash) return { doc: undefined, action: 'none' };
    return { doc: { ...limpa, status: STATUS.APPROVAL, approved: false }, action: 'none' };
  }
  // Na fila: a carência recomeça quando o placar muda.
  const due = ex && ex.status === STATUS.QUEUED && ex.payload_hash === entry.hash && ex.due_at_ms
    ? ex.due_at_ms : now + (c.grace ? graceMs : 0);
  if (due <= now) return { doc: { ...limpa, status: STATUS.QUEUED, due_at_ms: due }, action: 'create', payload: entry.payload };
  if (ex && ex.status === STATUS.QUEUED && ex.due_at_ms === due) return { doc: undefined, action: 'none' };
  return { doc: { ...limpa, status: STATUS.QUEUED, due_at_ms: due, approved: Boolean(ex && ex.approved) }, action: 'none' };
}

/** Resultado de uma chamada ao DUPR aplicado ao documento (puro). */
function applyResult(doc, action, result, { now }) {
  if (result.ok) {
    if (action === 'delete') return { ...doc, status: STATUS.DELETED, deleted_at_ms: now, updated_at_ms: now };
    return {
      ...doc, status: STATUS.SENT, match_code: result.matchCode || doc.match_code || null, sent_hash: doc.payload_hash,
      sent_at_ms: doc.sent_at_ms || now, last_sent_ms: now, attempts: 0, last_error: null, next_try_ms: null, updated_at_ms: now,
    };
  }
  const tentativas = (Number(doc.attempts) || 0) + 1;
  const transitorio = !result.status || result.status >= 500 || result.status === 429;
  const outra = transitorio && tentativas < MAX_TRIES;
  if (action === 'delete') {
    // Não conseguiu tirar do DUPR: segue enviada e tenta de novo na próxima passada.
    return { ...doc, status: STATUS.SENT, delete_error: result.message, updated_at_ms: now };
  }
  return {
    ...doc, status: STATUS.FAILED, attempts: tentativas, last_error: result.message,
    next_try_ms: outra ? now + Math.min(DAY, 15 * MIN * 2 ** (tentativas - 1)) : null, updated_at_ms: now,
  };
}

async function chamar(client, action, doc, payload) {
  try {
    let r;
    if (action === 'create') r = await client.createMatch(payload);
    else if (action === 'update') r = await client.updateMatch({ ...payload, matchId: Number(doc.match_code) });
    else r = await client.deleteMatch(doc.identifier, String(doc.match_code));
    const res = (r && r.result) || {};
    return { ok: true, matchCode: res.matchCode ? String(res.matchCode) : null };
  } catch (err) {
    if (err instanceof DuprError) return { ok: false, status: err.status || 0, message: err.message.slice(0, 300) };
    throw err;
  }
}

async function lerPorId(db, col, ids) {
  const out = new Map();
  const lista = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < lista.length; i += 300) {
    const refs = lista.slice(i, i + 300).map((id) => db.collection(col).doc(id));
    if (!refs.length) continue;
    (await db.getAll(...refs)).forEach((s) => { if (s.exists) out.set(s.id, { id: s.id, ...s.data() }); });
  }
  return out;
}

async function flagLigada(db) {
  const g = await db.collection('platform_settings').doc('global').get();
  const f = g.exists ? (g.data().feature_flags || {}) : {};
  return f.dupr_official_sync === true;
}

const ESTADO = ['platform_settings', 'dupr_submissions'];
const LEASE_MS = 10 * MIN;

/**
 * Uma passada do livro. `getClient` só é chamado se houver algo a enviar.
 * Duas passadas ao mesmo tempo (a agendada e o "Processar agora") enviariam a
 * mesma partida duas vezes: um lease em `platform_settings/dupr_submissions`
 * deixa só uma rodar.
 * @returns {Promise<object>} resumo (contagens por situação e por ação)
 */
async function runSubmissions(ctx, getClient, { force = false } = {}) {
  const { db, now } = ctx;
  const [ligada, polSnap] = await Promise.all([flagLigada(db), db.collection('platform_settings').doc('dupr_policy').get()]);
  const policy = normalizeDuprPolicy(polSnap.exists ? polSnap.data() : null);
  if (!ligada || policy.mode === DUPR_MODE.OFF) return { skipped: ligada ? 'policy_off' : 'flag_off' };
  const estado = db.collection(ESTADO[0]).doc(ESTADO[1]);
  const pegou = await db.runTransaction(async (tx) => {
    const s = await tx.get(estado);
    if (s.exists && Number(s.data().lease_until_ms) > now) return false;
    tx.set(estado, { lease_until_ms: now + LEASE_MS }, { merge: true });
    return true;
  });
  if (!pegou) return { skipped: 'running' };
  try {
    return await passada(ctx, getClient, policy, force);
  } finally {
    await estado.set({ lease_until_ms: 0 }, { merge: true });
  }
}

async function passada(ctx, getClient, policy, force) {
  const { db, now } = ctx;
  const [tmSnap, cegSnap, tSnap, livroSnap, linksSnap] = await Promise.all([
    db.collection('tournament_matches').where('status', 'in', FINISHED).get(),
    db.collection('club_event_games').where('status', '==', 'finished').get(),
    db.collection('tournaments').get(),
    db.collection(COL).get(),
    db.collection('dupr_links').get(),
  ]);
  const tournamentById = new Map(tSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const tms = tmSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => isEligible(tournamentById.get(m.tournament_id)));
  const cegs = cegSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const [regById, modalityById, gameDayById] = await Promise.all([
    lerPorId(db, 'tournament_registrations', tms.flatMap((m) => [...(m.side_a_ids || []), ...(m.side_b_ids || [])])),
    lerPorId(db, 'tournament_modalities', tms.map((m) => m.modality_id)),
    lerPorId(db, 'game_days', cegs.filter((m) => m.source === 'athlete_game_day').map((m) => m.event_id)),
  ]);
  let candidatos = buildCandidates({ tournamentMatches: tms, clubEventMatches: cegs, regById, tournamentById, modalityById, gameDayById });

  if (policy.audience === DUPR_AUDIENCE.ADMINS) {
    const adm = await db.collection('users').where('role', '==', 'platform_admin').get();
    const admins = new Set(adm.docs.map((d) => d.id));
    candidatos = candidatos.filter((c) => [...c.sideA, ...c.sideB].some((u) => admins.has(u)));
  }

  const links = {};
  linksSnap.docs.forEach((d) => { links[d.id] = d.data(); });
  const livro = new Map(livroSnap.docs.map((d) => [d.id, d.data()]));
  const porId = new Map(candidatos.map((c) => [c.identifier, c]));
  const graceMs = policy.grace_minutes * MIN;

  const resumo = { candidates: candidatos.length, created: 0, updated: 0, deleted: 0, failed: 0, dropped: 0, deferred: 0 };
  const escritas = [];
  const chamadas = [];
  const ids = new Set([...porId.keys(), ...livro.keys()]);
  ids.forEach((id) => {
    const c = porId.get(id) || null;
    const ex = livro.get(id) || null;
    // Partida nova antiga demais não entra (a que já está no livro segue).
    if (c && !ex && c.at && now - c.at > JANELA_NOVAS) return;
    const entry = c ? planEntry(c, links, policy) : null;
    const r = reconcile(ex, c, entry, { now, graceMs });
    if (r.action !== 'none') chamadas.push({ id, doc: r.doc, action: r.action, payload: r.payload });
    else if (r.doc === null) { escritas.push({ id, doc: null }); resumo.dropped += 1; }
    else if (r.doc) escritas.push({ id, doc: r.doc });
  });

  if (chamadas.length) {
    const { client } = await getClient();
    for (let i = 0; i < chamadas.length; i += 1) {
      const ch = chamadas[i];
      if (i >= MAX_CALLS) { resumo.deferred += 1; if (ch.action !== 'delete') escritas.push({ id: ch.id, doc: ch.doc }); continue; }
      const res = await chamar(client, ch.action, ch.doc, ch.payload);
      const doc = applyResult(ch.doc, ch.action, res, { now });
      escritas.push({ id: ch.id, doc, audit: { action: `dupr_submission_${res.ok ? { create: 'sent', update: 'updated', delete: 'deleted' }[ch.action] : 'failed'}`, op: ch.action, error: res.ok ? null : res.message } });
      if (!res.ok) resumo.failed += 1;
      else if (ch.action === 'create') resumo.created += 1;
      else if (ch.action === 'update') resumo.updated += 1;
      else resumo.deleted += 1;
    }
  }
  // Contagem do livro como fica depois da passada.
  const final = new Map(livro);
  escritas.forEach((e) => { if (e.doc === null) final.delete(e.id); else final.set(e.id, e.doc); });
  resumo.by_status = {};
  final.forEach((d) => { resumo.by_status[d.status] = (resumo.by_status[d.status] || 0) + 1; });

  for (let i = 0; i < escritas.length; i += 200) {
    const batch = db.batch();
    escritas.slice(i, i + 200).forEach((e) => {
      const ref = db.collection(COL).doc(e.id);
      if (e.doc === null) batch.delete(ref);
      else batch.set(ref, e.doc);
      if (e.audit) {
        batch.set(db.collection('audit_logs').doc(), {
          log_number: Number(`${now}${Math.floor(Math.random() * 900 + 100)}`),
          action: e.audit.action, action_label: e.audit.action, actor_id: 'system', actor_name: 'Envio ao DUPR', actor_email: '',
          tournament_id: e.doc.tournament_id || null, user_id: null,
          details: { identifier: e.id, op: e.audit.op, match_code: e.doc.match_code || null, error: e.audit.error, forced: force },
          created_at: ctx.Timestamp.fromMillis(now),
        });
      }
    });
    await batch.commit();
  }
  await db.collection('platform_settings').doc('dupr_submissions').set({ last_run_ms: now, last_result: resumo }, { merge: true });
  return resumo;
}

class SubmissionError extends Error {
  constructor(code, message) { super(message); this.name = 'SubmissionError'; this.code = code; }
}
const falha = (code, message) => { throw new SubmissionError(code, message); };
function exigeAdmin(actor) {
  if (!actor || !actor.isPlatformAdmin) falha('permission-denied', 'Só o admin da plataforma mexe nos envios ao DUPR.');
}

async function lerLinha(ctx, data) {
  const id = texto(data.identifier);
  if (!/^pr:(tm|gd):[A-Za-z0-9_-]{1,80}$/.test(id)) falha('invalid-argument', 'Partida inválida.');
  const ref = ctx.db.collection(COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Essa partida não está na fila do DUPR.');
  return { ref, doc: snap.data() };
}

async function auditar(ctx, actor, action, details) {
  await ctx.db.collection('audit_logs').add({
    log_number: Number(`${ctx.now}${Math.floor(Math.random() * 900 + 100)}`),
    action, action_label: action, actor_id: actor.uid, actor_name: actor.name || actor.uid, actor_email: actor.email || '',
    tournament_id: null, user_id: null, details, created_at: ctx.Timestamp.fromMillis(ctx.now),
  });
}

/** Admin: processar agora (a mesma passada da varredura). */
async function runNow(ctx, actor, data, getClient) {
  exigeAdmin(actor);
  return runSubmissions(ctx, getClient, { force: true });
}

/** Admin (modo manual): aprova o envio; vai na próxima passada, sem carência. */
async function approve(ctx, actor, data) {
  exigeAdmin(actor);
  const { ref, doc } = await lerLinha(ctx, data);
  if (doc.status !== STATUS.APPROVAL) falha('failed-precondition', 'Essa partida não está aguardando aprovação.');
  await ref.update({ status: STATUS.QUEUED, approved: true, approved_by: actor.uid, due_at_ms: ctx.now, updated_at_ms: ctx.now });
  await auditar(ctx, actor, 'dupr_submission_approved', { identifier: doc.identifier });
  return { ok: true };
}

/** Admin: tenta de novo uma que falhou (já na próxima passada). */
async function retry(ctx, actor, data) {
  exigeAdmin(actor);
  const { ref, doc } = await lerLinha(ctx, data);
  if (doc.status !== STATUS.FAILED) falha('failed-precondition', 'Só dá para tentar de novo uma partida que falhou.');
  await ref.update({ attempts: 0, next_try_ms: ctx.now, updated_at_ms: ctx.now });
  await auditar(ctx, actor, 'dupr_submission_retry', { identifier: doc.identifier });
  return { ok: true };
}

/**
 * Admin: apaga no DUPR (se já foi) e TRAVA a partida — a varredura não a
 * reenvia. `unblock` destrava (ela volta a ser decidida pela política).
 */
async function remove(ctx, actor, data, getClient) {
  exigeAdmin(actor);
  const { ref, doc } = await lerLinha(ctx, data);
  const motivo = texto(data.reason).slice(0, 300);
  if (motivo.length < 5) falha('invalid-argument', 'Diga o motivo (pelo menos 5 letras).');
  if (doc.status === STATUS.SENT && doc.match_code) {
    const res = await chamar((await getClient()).client, 'delete', doc);
    if (!res.ok) falha('unavailable', `O DUPR não apagou: ${res.message}`);
  }
  await ref.set({ ...doc, status: STATUS.DELETED, blocked: true, blocked_by: actor.uid, blocked_reason: motivo, deleted_at_ms: ctx.now, updated_at_ms: ctx.now });
  await auditar(ctx, actor, 'dupr_submission_removed', { identifier: doc.identifier, match_code: doc.match_code || null, reason: motivo });
  return { ok: true };
}

async function unblock(ctx, actor, data) {
  exigeAdmin(actor);
  const { ref, doc } = await lerLinha(ctx, data);
  if (!doc.blocked) falha('failed-precondition', 'Essa partida não está travada.');
  await ref.delete();
  await auditar(ctx, actor, 'dupr_submission_unblocked', { identifier: doc.identifier });
  return { ok: true };
}

module.exports = {
  COL, STATUS, MAX_TRIES, MAX_CALLS, JANELA_NOVAS, SubmissionError,
  buildCandidates, planEntry, reconcile, applyResult, runSubmissions,
  runNow, approve, retry, remove, unblock, dataSP,
};
