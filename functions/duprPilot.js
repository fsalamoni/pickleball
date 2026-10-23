/**
 * PILOTO DO DUPR (Painel admin → DUPR → Piloto). Só o admin da plataforma, e
 * partidas só no ambiente de teste (UAT).
 *
 * Um ambiente fechado: jogadores que existem só aqui (`dupr_pilot_players`) e
 * partidas de teste (`dupr_pilot_matches`) que vão ao DUPR de verdade. Não lê
 * nem escreve nenhuma outra coleção da plataforma (fora `audit_logs`): ranking,
 * perfis e telas dos usuários não enxergam o piloto. Não depende da flag
 * `dupr_official_sync` — o admin testa o envio sem mudar nada para ninguém.
 *
 * O jogador do piloto nasce com nome e, se quiser, o e-mail da conta de teste;
 * o ID DUPR entra depois (digitado e CONFERIDO no DUPR, ou gerado pelo convite
 * do DUPR quando a plataforma tiver a permissão `USER::INVITE`).
 */
const { DuprError } = require('./duprClient');
const { duprMatchEligibility, duprIdentifier, DUPR_ID_KIND, DUPR_MATCH_PROBLEM } = require('./duprPolicy');

const PLAYERS = 'dupr_pilot_players';
const MATCHES = 'dupr_pilot_matches';
const MAX_GAMES = 5;
const texto = (v) => String(v == null ? '' : v).trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

class PilotError extends Error {
  constructor(code, message) { super(message); this.name = 'PilotError'; this.code = code; }
}
const falha = (code, message) => { throw new PilotError(code, message); };

/** "4.125" → 4.125; vazio/NR → null. */
function nota(v) {
  const n = Number(String(v == null ? '' : v).replace(',', '.'));
  return Number.isFinite(n) && n >= 1 && n <= 8.5 ? Math.round(n * 1000) / 1000 : null;
}

/** O erro do DUPR, legível para o admin (sem credencial: o cliente nunca a põe na mensagem). */
function explica(err) {
  if (err instanceof PilotError) return err;
  if (err instanceof DuprError) {
    if (err.status === 404) return new PilotError('not-found', 'O DUPR não encontrou esse ID.');
    return new PilotError('failed-precondition', err.message);
  }
  return err;
}

const PROBLEMA = {
  [DUPR_MATCH_PROBLEM.NO_PLAYERS]: 'Escolha os jogadores dos dois lados.',
  [DUPR_MATCH_PROBLEM.UNEVEN_SIDES]: 'Os dois lados precisam ter o mesmo número de jogadores.',
  [DUPR_MATCH_PROBLEM.TOO_MANY_PLAYERS]: 'No máximo dois jogadores por lado.',
  [DUPR_MATCH_PROBLEM.REPEATED_PLAYER]: 'Um jogador não pode estar duas vezes na partida.',
  [DUPR_MATCH_PROBLEM.NO_SCORE]: 'Informe o placar.',
  [DUPR_MATCH_PROBLEM.TIED_GAME]: 'O DUPR não aceita game empatado.',
  [DUPR_MATCH_PROBLEM.WINNER_MISMATCH]: 'O placar não bate com o vencedor.',
};

/**
 * A partida no formato do DUPR (`ExternalMatchRequest`). `sideA`/`sideB` são
 * IDs DUPR; `games` é `[{ a, b }]`. Devolve `{ payload }` ou `{ problems }`.
 * É a MESMA montagem que o envio automático vai usar.
 */
function duprMatchPayload({ identifier, event, date, location, matchType, playType, sideA, sideB, games }) {
  const problems = [...duprMatchEligibility({ side_a: sideA, side_b: sideB, games }).problems];
  const jogos = (Array.isArray(games) ? games : []).map((g) => ({ a: Number(g && g.a), b: Number(g && g.b) }));
  if (jogos.length > MAX_GAMES) problems.push('too_many_games');
  if (jogos.some((g) => !Number.isInteger(g.a) || !Number.isInteger(g.b) || g.a < 0 || g.b < 0 || g.a > 99 || g.b > 99)) problems.push('bad_score');
  if (!identifier) problems.push('no_identifier');
  if (!DATA.test(texto(date))) problems.push('bad_date');
  if (problems.length) return { problems };
  const lado = (ids, chave) => {
    const t = { player1: ids[0] };
    if (ids[1]) t.player2 = ids[1];
    jogos.forEach((g, i) => { t[`game${i + 1}`] = g[chave]; });
    return t;
  };
  const payload = {
    identifier,
    event: texto(event) || 'PickleRush',
    matchDate: texto(date),
    format: sideA.length === 1 ? 'SINGLES' : 'DOUBLES',
    matchType: matchType === 'RALLY' ? 'RALLY' : 'SIDEOUT',
    matchSource: 'PARTNER',
    matchPlayType: playType === 'TOURNAMENT' ? 'TOURNAMENT' : 'RECREATIONAL',
    teamA: lado(sideA, 'a'),
    teamB: lado(sideB, 'b'),
  };
  if (texto(location)) payload.location = texto(location).slice(0, 120);
  return { payload };
}

async function auditoria(ctx, actor, action, details) {
  await ctx.db.collection('audit_logs').add({
    log_number: Number(`${ctx.now}${Math.floor(Math.random() * 900 + 100)}`),
    action, action_label: action, actor_id: actor.uid, actor_name: actor.name || actor.uid, actor_email: actor.email || '',
    tournament_id: null, user_id: null, details, created_at: ctx.Timestamp.fromMillis(ctx.now),
  });
}

/** Só o admin da plataforma entra no piloto. */
function exigeAdmin(actor) {
  if (!actor || !actor.isPlatformAdmin) falha('permission-denied', 'O piloto do DUPR é só para o admin da plataforma.');
}

/** Confere o ID no DUPR e devolve o que guardar (ID canônico, nome e ratings). */
async function conferirNoDupr(client, duprId) {
  const r = (await client.getUser(duprId)) || {};
  const u = r.result || {};
  const id = texto(u.id || u.duprId || duprId).toUpperCase();
  const ratings = u.ratings || {};
  return { dupr_id: id, dupr_name: texto(u.fullName), ratings: { singles: nota(ratings.singles), doubles: nota(ratings.doubles) } };
}

/** O DUPR recusou porque a conta ainda não autorizou a plataforma (login SSO). */
const semConsentimento = (err) => err instanceof DuprError && err.status === 403;

async function idEmUso(ctx, duprId, excetoId) {
  const snap = await ctx.db.collection(PLAYERS).where('dupr_id', '==', duprId).get();
  return snap.docs.some((d) => d.id !== excetoId);
}

/** Cria ou edita um jogador do piloto. O ID DUPR, se vier, é conferido no DUPR. */
async function savePlayer(ctx, actor, data, cliente) {
  exigeAdmin(actor);
  const name = texto(data.name).slice(0, 80);
  const email = texto(data.email).toLowerCase().slice(0, 120);
  const duprIdIn = texto(data.duprId).toUpperCase().replace(/\s+/g, '');
  if (name.length < 2) falha('invalid-argument', 'Dê um nome ao jogador do piloto.');
  if (email && !EMAIL.test(email)) falha('invalid-argument', 'Esse e-mail não parece válido.');
  if (duprIdIn && !/^[A-Z0-9]{3,20}$/.test(duprIdIn)) falha('invalid-argument', 'O ID DUPR tem só letras e números.');

  const col = ctx.db.collection(PLAYERS);
  const ref = texto(data.id) ? col.doc(texto(data.id)) : col.doc();
  const atual = texto(data.id) ? await ref.get() : null;
  if (atual && !atual.exists) falha('not-found', 'Esse jogador do piloto não existe mais.');
  const velho = atual ? atual.data() : {};

  let dupr = { dupr_id: null, dupr_name: '', ratings: null };
  let status = 'waiting';
  if (duprIdIn) {
    if (duprIdIn === velho.dupr_id) {
      dupr = { dupr_id: velho.dupr_id, dupr_name: velho.dupr_name || '', ratings: velho.ratings || null };
      status = velho.status === 'consent' ? 'consent' : 'ready';
    } else {
      try {
        dupr = await conferirNoDupr((await cliente()).client, duprIdIn);
        status = 'ready';
      } catch (err) {
        // O DUPR só mostra a conta depois que ela autoriza a plataforma pelo
        // login (SSO). Guarda o ID e espera a autorização.
        if (!semConsentimento(err)) throw explica(err);
        dupr = { dupr_id: duprIdIn, dupr_name: '', ratings: null };
        status = 'consent';
      }
    }
    if (await idEmUso(ctx, dupr.dupr_id, ref.id)) falha('already-exists', 'Esse ID DUPR já está em outro jogador do piloto.');
  }
  const doc = {
    name, email: email || null, ...dupr,
    status,
    checked_ms: dupr.dupr_id ? (dupr.dupr_id === velho.dupr_id ? velho.checked_ms || ctx.now : ctx.now) : null,
    created_at_ms: velho.created_at_ms || ctx.now, created_by: velho.created_by || actor.uid, updated_at_ms: ctx.now,
  };
  await ref.set(doc);
  await auditoria(ctx, actor, 'dupr_pilot_player_saved', { player_id: ref.id, dupr_id: doc.dupr_id });
  return { id: ref.id, ...doc };
}

/** Busca de novo nome e ratings no DUPR (o rating muda depois das partidas). */
async function refreshPlayer(ctx, actor, data, cliente) {
  exigeAdmin(actor);
  const ref = ctx.db.collection(PLAYERS).doc(texto(data.id));
  const snap = await ref.get();
  if (!snap.exists || !snap.data().dupr_id) falha('failed-precondition', 'Esse jogador ainda não tem ID DUPR.');
  let dupr;
  try {
    dupr = await conferirNoDupr((await cliente()).client, snap.data().dupr_id);
  } catch (err) {
    if (semConsentimento(err)) falha('failed-precondition', 'Essa conta ainda não autorizou a plataforma no DUPR. Use "Autorizar pelo login do DUPR".');
    throw explica(err);
  }
  await ref.update({ dupr_name: dupr.dupr_name, ratings: dupr.ratings, status: 'ready', checked_ms: ctx.now, updated_at_ms: ctx.now });
  return { id: ref.id, ...snap.data(), ...dupr, status: 'ready', checked_ms: ctx.now };
}

/** O endereço do login do DUPR (SSO), para autorizar as contas de teste. */
async function ssoConfig(ctx, actor, data, cliente) {
  exigeAdmin(actor);
  const { client, secrets } = await cliente();
  return { ssoUrl: client.ssoUrl(), env: texto(secrets.env).toLowerCase() === 'prod' ? 'prod' : 'uat' };
}

/**
 * Autoriza a conta de teste: o admin entra no DUPR (iframe) COM A CONTA DO
 * JOGADOR e o login devolve um token dela. O servidor pergunta ao DUPR quem é
 * (o ID vem do DUPR, não da tela) e, com a autorização dada, confere o
 * cadastro. O token não é guardado: o piloto só precisa do consentimento.
 */
async function ssoPlayer(ctx, actor, data, cliente) {
  exigeAdmin(actor);
  const accessToken = texto(data.accessToken);
  if (!accessToken || accessToken.length > 4096) falha('invalid-argument', 'Não recebi o login do DUPR. Tente de novo.');
  const ref = ctx.db.collection(PLAYERS).doc(texto(data.id));
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Esse jogador do piloto não existe mais.');
  const p = snap.data();
  const { client } = await cliente();
  let quem;
  try {
    const info = await client.basicUserInfo(accessToken);
    quem = info && Array.isArray(info.results) ? info.results[0] : null;
  } catch (err) { throw explica(err); }
  const duprId = texto(quem && quem.duprId).toUpperCase();
  if (!duprId) falha('permission-denied', 'O DUPR não confirmou a conta que entrou.');
  if (p.dupr_id && p.dupr_id !== duprId) {
    falha('failed-precondition', `Entrou a conta DUPR ${duprId}, mas este jogador é ${p.dupr_id}. Saia da conta no quadro do DUPR e entre com a conta certa.`);
  }
  if (await idEmUso(ctx, duprId, ref.id)) falha('already-exists', `A conta DUPR ${duprId} já está em outro jogador do piloto.`);
  let dupr = { dupr_id: duprId, dupr_name: texto(quem.fullName), ratings: p.ratings || null };
  try { dupr = await conferirNoDupr(client, duprId); } catch { /* autorizado agora; os ratings vêm no "Atualizar" */ }
  await ref.update({ ...dupr, status: 'ready', consent_ms: ctx.now, checked_ms: ctx.now, updated_at_ms: ctx.now });
  await auditoria(ctx, actor, 'dupr_pilot_player_authorized', { player_id: ref.id, dupr_id: duprId });
  return { id: ref.id, ...p, ...dupr, status: 'ready' };
}

async function removePlayer(ctx, actor, data) {
  exigeAdmin(actor);
  const ref = ctx.db.collection(PLAYERS).doc(texto(data.id));
  if (!(await ref.get()).exists) return { removed: false };
  await ref.delete();
  await auditoria(ctx, actor, 'dupr_pilot_player_removed', { player_id: ref.id });
  return { removed: true };
}

/**
 * Pede ao DUPR que crie a conta (pré-gera o ID) com o e-mail do jogador. O DUPR
 * só libera isso a parceiros com `USER::INVITE`; sem ela, responde 403 e a
 * conta de teste é criada à mão no DUPR, com o mesmo e-mail.
 */
async function invitePlayer(ctx, actor, data, cliente) {
  exigeAdmin(actor);
  const ref = ctx.db.collection(PLAYERS).doc(texto(data.id));
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Esse jogador do piloto não existe mais.');
  const p = snap.data();
  if (p.dupr_id) falha('failed-precondition', 'Esse jogador já tem ID DUPR.');
  if (!p.email) falha('failed-precondition', 'Informe o e-mail do jogador antes de criar a conta no DUPR.');
  const { client } = await cliente();
  let r;
  try {
    r = await client.inviteUser({ fullName: p.name, email: p.email, isoCode: 'BR', identifier: `pr:pl:${ref.id}` });
  } catch (err) {
    if (err instanceof DuprError && err.status === 403) {
      falha('permission-denied', 'O DUPR ainda não liberou a criação de contas para esta plataforma (permissão USER::INVITE). Crie a conta de teste no site do DUPR com esse e-mail e depois informe o ID aqui.');
    }
    throw explica(err);
  }
  const novoId = texto(r && (r.duprId || (r.result && r.result.duprId))).toUpperCase();
  if (!novoId) falha('failed-precondition', 'O DUPR não devolveu o ID da conta criada.');
  let dupr = { dupr_id: novoId, dupr_name: p.name, ratings: { singles: null, doubles: null } };
  try { dupr = await conferirNoDupr(client, novoId); } catch { /* conta recém-criada: fica o que o convite deu */ }
  await ref.update({ ...dupr, status: 'ready', invited_ms: ctx.now, checked_ms: ctx.now, updated_at_ms: ctx.now });
  await auditoria(ctx, actor, 'dupr_pilot_player_invited', { player_id: ref.id, dupr_id: dupr.dupr_id });
  return { id: ref.id, ...p, ...dupr, status: 'ready' };
}

/**
 * Envia uma partida de teste ao DUPR. Só no UAT: em produção, partida de
 * jogador que não conectou a conta fere o contrato, então o piloto não envia.
 */
async function sendMatch(ctx, actor, data, cliente) {
  exigeAdmin(actor);
  const { client, secrets } = await cliente();
  if (texto(secrets.env).toLowerCase() === 'prod') falha('failed-precondition', 'O piloto só envia partidas no ambiente de teste (UAT).');

  const ladoA = (Array.isArray(data.sideA) ? data.sideA : []).map(texto).filter(Boolean);
  const ladoB = (Array.isArray(data.sideB) ? data.sideB : []).map(texto).filter(Boolean);
  if (ladoA.length === 0 || ladoB.length === 0 || ladoA.length > 2 || ladoB.length > 2) falha('invalid-argument', PROBLEMA[DUPR_MATCH_PROBLEM.NO_PLAYERS]);
  const snaps = await Promise.all([...ladoA, ...ladoB].map((id) => ctx.db.collection(PLAYERS).doc(id).get()));
  const jogadores = Object.fromEntries(snaps.map((s) => [s.id, s.exists ? s.data() : null]));
  const semId = snaps.filter((s) => !s.exists || !s.data().dupr_id);
  if (semId.length) falha('failed-precondition', `Sem ID DUPR: ${semId.map((s) => (s.exists ? s.data().name : s.id)).join(', ')}.`);
  const semAutorizar = snaps.filter((s) => s.data().status === 'consent');
  if (semAutorizar.length) falha('failed-precondition', `Falta autorizar no DUPR: ${semAutorizar.map((s) => s.data().name).join(', ')}.`);
  // UTC está à frente de Brasília: comparar com o "hoje" de lá nunca recusa o hoje daqui.
  if (texto(data.date) > new Date(ctx.now).toISOString().slice(0, 10)) falha('invalid-argument', 'A data não pode ser no futuro.');

  const ref = ctx.db.collection(MATCHES).doc();
  const identifier = duprIdentifier(DUPR_ID_KIND.PILOT, ref.id);
  const { payload, problems } = duprMatchPayload({
    identifier, event: data.event, date: data.date, location: data.location, matchType: data.matchType, playType: data.playType,
    sideA: ladoA.map((id) => jogadores[id].dupr_id), sideB: ladoB.map((id) => jogadores[id].dupr_id), games: data.games,
  });
  if (problems) {
    const msg = problems.map((p) => PROBLEMA[p]).filter(Boolean)[0] || 'Confira o placar (até 5 games, números de 0 a 99) e a data.';
    falha('invalid-argument', msg);
  }

  const base = {
    identifier, payload,
    side_a: ladoA.map((id) => ({ player_id: id, name: jogadores[id].name, dupr_id: jogadores[id].dupr_id })),
    side_b: ladoB.map((id) => ({ player_id: id, name: jogadores[id].name, dupr_id: jogadores[id].dupr_id })),
    env: 'uat', created_at_ms: ctx.now, created_by: actor.uid,
  };
  try {
    const r = await client.createMatch(payload);
    const res = (r && r.result) || {};
    const doc = { ...base, status: 'sent', match_code: texto(res.matchCode) || null, sent_at_ms: ctx.now, error: null };
    await ref.set(doc);
    await auditoria(ctx, actor, 'dupr_pilot_match_sent', { match_id: ref.id, identifier, match_code: doc.match_code });
    return { id: ref.id, ...doc };
  } catch (err) {
    const msg = err instanceof DuprError ? err.message : 'Falha inesperada ao enviar.';
    await ref.set({ ...base, status: 'failed', match_code: null, error: msg.slice(0, 500) });
    if (!(err instanceof DuprError)) ctx.logger.error('dupr piloto: envio falhou', err);
    return { id: ref.id, status: 'failed', error: msg };
  }
}

/** Apaga no DUPR uma partida de teste já enviada (fica o registro, como "apagada"). */
async function deleteMatch(ctx, actor, data, cliente) {
  exigeAdmin(actor);
  const ref = ctx.db.collection(MATCHES).doc(texto(data.id));
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Essa partida de teste não existe mais.');
  const m = snap.data();
  if (m.status !== 'sent' || !m.match_code) {
    // Nunca chegou ao DUPR: some daqui e pronto.
    await ref.delete();
    return { deleted: true, remote: false };
  }
  const { client } = await cliente();
  try { await client.deleteMatch(m.identifier, m.match_code); } catch (err) { throw explica(err); }
  await ref.update({ status: 'deleted', deleted_at_ms: ctx.now });
  await auditoria(ctx, actor, 'dupr_pilot_match_deleted', { match_id: ref.id, identifier: m.identifier });
  return { deleted: true, remote: true };
}

module.exports = {
  PilotError, duprMatchPayload, savePlayer, refreshPlayer, removePlayer, invitePlayer, sendMatch, deleteMatch,
  ssoConfig, ssoPlayer,
};
