/**
 * Gamificação V2 — as tarefas do SERVIDOR.
 *
 * O que mora aqui é o que o navegador não pode decidir:
 *
 *  · placar e prêmio dos desafios (`runChallengeStandings`);
 *  · duelos da semana — emparelhar e fechar (`runWeeklyDuels`);
 *  · reputação vinda das avaliações pós-jogo (`runReputation`);
 *  · sinais de integridade para o admin revisar (`runIntegrity`);
 *  · o resumo da semana por notificação (`runWeeklyDigest`);
 *  · o retrato diário para o painel de métricas (`runMetricsSnapshot`).
 *
 * Toda tarefa:
 *  · lê a configuração do admin (`platform_settings/gamification`) e respeita o
 *    módulo desligado — desligar no painel realmente para o servidor;
 *  · respeita a escolha de cada pessoa (`user_gamification_prefs`);
 *  · é IDEMPOTENTE: rodar de novo dá o mesmo resultado (ids determinísticos;
 *    prêmio e aviso são `create`, nunca duplicam);
 *  · tem teto de leitura — função agendada não pode virar conta cara;
 *  · nunca lança para o agendador: erro vira log e retorno, o próximo ciclo
 *    refaz tudo.
 *
 * A matemática pura está em `gamificationCore.js` (testada sem emulador).
 */
const { FieldValue } = require('firebase-admin/firestore');
const { normalizeMatches } = require('./platformRankings');
const { isEligible, FINISHED_STATUSES, toMillis } = require('./ranking');
const core = require('./gamificationCore');

const MAX_DOCS = 20000;
const BATCH = 400;

/* ------------------------------------------------------------ configuração -- */

const CFG_PADRAO = Object.freeze({
  modules: {},
  season: { prizeTop1: 1000, prizeTop10Percent: 500, prizeParticipation: 50, publicMinTier: 'Jogador' },
  duels: { winnerXp: 200, participationXp: 50, maxLevelGap: 1 },
  reviews: { minForPublicScore: 5, windowDays: 14 },
  antiFarm: { xpJumpPerDay: 5000, kudosRingMin: 5, unverifiedXpFactor: 3 },
  notifications: { weeklyReview: true, duels: true, challengeResults: true },
});

const num = (v, d, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

/** Espelha `normalizeGamificationConfig` do cliente — só o que o servidor usa. */
function normalizarConfig(bruto) {
  const s = bruto && typeof bruto === 'object' ? bruto : {};
  const d = CFG_PADRAO;
  const bool = (v, p) => (typeof v === 'boolean' ? v : p);
  return {
    modules: s.modules && typeof s.modules === 'object' ? s.modules : {},
    season: {
      prizeTop1: Math.round(num(s.season && s.season.prizeTop1, d.season.prizeTop1, 0, 5000)),
      prizeTop10Percent: Math.round(num(s.season && s.season.prizeTop10Percent, d.season.prizeTop10Percent, 0, 5000)),
      prizeParticipation: Math.round(num(s.season && s.season.prizeParticipation, d.season.prizeParticipation, 0, 1000)),
      publicMinTier: (s.season && typeof s.season.publicMinTier === 'string') ? s.season.publicMinTier : d.season.publicMinTier,
    },
    duels: {
      winnerXp: Math.round(num(s.duels && s.duels.winnerXp, d.duels.winnerXp, 0, 1000)),
      participationXp: Math.round(num(s.duels && s.duels.participationXp, d.duels.participationXp, 0, 500)),
      maxLevelGap: num(s.duels && s.duels.maxLevelGap, d.duels.maxLevelGap, 0.25, 3),
    },
    reviews: {
      minForPublicScore: Math.round(num(s.reviews && s.reviews.minForPublicScore, d.reviews.minForPublicScore, 3, 20)),
      windowDays: Math.round(num(s.reviews && s.reviews.windowDays, d.reviews.windowDays, 1, 60)),
    },
    antiFarm: {
      xpJumpPerDay: Math.round(num(s.antiFarm && s.antiFarm.xpJumpPerDay, d.antiFarm.xpJumpPerDay, 500, 50000)),
      kudosRingMin: Math.round(num(s.antiFarm && s.antiFarm.kudosRingMin, d.antiFarm.kudosRingMin, 3, 30)),
      unverifiedXpFactor: num(s.antiFarm && s.antiFarm.unverifiedXpFactor, d.antiFarm.unverifiedXpFactor, 1.5, 10),
    },
    notifications: {
      weeklyReview: bool(s.notifications && s.notifications.weeklyReview, true),
      duels: bool(s.notifications && s.notifications.duels, true),
      challengeResults: bool(s.notifications && s.notifications.challengeResults, true),
    },
  };
}

async function carregarConfig(db) {
  const snap = await db.collection('platform_settings').doc('gamification').get();
  return normalizarConfig(snap.exists ? snap.data() : null);
}

/** A flag mestra `gamification_v2` está ligada? Com ela desligada, NADA roda. */
async function gamificacaoLigada(db) {
  const snap = await db.collection('platform_settings').doc('global').get();
  const flags = snap.exists && snap.data() ? snap.data().feature_flags : null;
  return Boolean(flags && flags.gamification_v2 === true);
}

const moduloLigado = (cfg, id) => cfg.modules[id] !== false;

/* ---------------------------------------------------------------- utilitários */

function emFatias(lista, n) {
  const out = [];
  for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n));
  return out;
}

/** Lê vários documentos por id, em fatias (getAll aceita muitos, mas com folga). */
async function lerPorIds(db, colecao, ids) {
  const unicos = [...new Set(ids.filter(Boolean))];
  const mapa = new Map();
  for (const fatia of emFatias(unicos, 100)) {
    // eslint-disable-next-line no-await-in-loop
    const docs = await db.getAll(...fatia.map((id) => db.collection(colecao).doc(id)));
    docs.forEach((d) => { if (d.exists) mapa.set(d.id, d.data()); });
  }
  return mapa;
}

async function lerColecao(db, colecao, consulta = (q) => q) {
  const snap = await consulta(db.collection(colecao)).limit(MAX_DOCS).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Aviso na central de notificações. `create`: o mesmo id nunca duplica. */
async function avisar(db, id, { userId, title, message, link, type = 'gamification' }) {
  try {
    await db.collection('notifications').doc(id).create({
      user_id: userId, title, message, type, link: link || null, data: null,
      actor_id: null, actor_name: null, read: false, read_at: null,
      created_at: FieldValue.serverTimestamp(), created_at_ms: Date.now(),
    });
    return true;
  } catch (err) {
    if (err && (err.code === 6 || /already exists/i.test(String(err.message)))) return false;
    throw err;
  }
}

/** Concede XP. `create`: a mesma concessão nunca vale duas vezes. */
async function conceder(db, { uid, kind, ref, xp, label }) {
  if (!uid || !(xp > 0)) return false;
  const id = `${uid}_${kind}_${String(ref).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 80)}`;
  try {
    await db.collection('user_xp_grants').doc(id).create({
      uid, kind, xp: Math.round(xp), label: String(label || '').slice(0, 120), refId: String(ref).slice(0, 120),
      at: Date.now(), serverAt: FieldValue.serverTimestamp(), schemaVersion: 1,
    });
    return true;
  } catch (err) {
    if (err && (err.code === 6 || /already exists/i.test(String(err.message)))) return false;
    throw err;
  }
}

/** Quem pediu para NÃO receber algo (prefs) ou foi excluído (moderação). */
async function lerPrefs(db, uids) {
  return lerPorIds(db, 'user_gamification_prefs', uids);
}

/* ---------------------------------------------------------------- os jogos --- */

/** Os jogos normalizados da plataforma — a MESMA leitura do ranking. */
async function carregarJogos(db) {
  const [tm, ceg, regs, torneios] = await Promise.all([
    db.collection('tournament_matches').where('status', 'in', FINISHED_STATUSES).get(),
    db.collection('club_event_games').where('status', '==', 'finished').get(),
    db.collection('tournament_registrations').get(),
    db.collection('tournaments').get(),
  ]);
  const regById = new Map(regs.docs.map((d) => [d.id, d.data()]));
  const elegiveis = new Set(torneios.docs.map((d) => ({ id: d.id, ...d.data() })).filter(isEligible).map((t) => t.id));
  return normalizeMatches({
    tournamentMatches: tm.docs.map((d) => d.data()),
    clubEventMatches: ceg.docs.map((d) => d.data()),
    regById,
    eligibleTournamentIds: elegiveis,
  });
}

/* ================================================================ DESAFIOS == */

/** A pessoa pode competir neste desafio? (a regra não vê o público; o servidor, sim) */
function elegivelParaDesafio(def, uid, ctx) {
  const perfil = ctx.perfis.get(uid);
  if (!perfil) return false;
  if (def.regionState && perfil.state !== def.regionState) return false;
  if (def.issuerType === 'club') return ctx.membrosDoClube.has(uid);
  if (def.issuerType === 'coach') return ctx.alunosDoProfessor.has(uid);
  return true;
}

async function processarDesafio(db, def, { agora, jogosPorUid, cfg, logger }) {
  const entradas = await lerColecao(db, 'challenge_entries', (q) => q.where('challengeId', '==', def.id));
  const janela = { startMs: Number(def.startsAt), endMs: Number(def.endsAt) };
  const terminou = agora >= janela.endMs;

  const ctx = { perfis: new Map(), membrosDoClube: new Set(), alunosDoProfessor: new Set() };
  const uidsAtletas = def.subject === 'club' ? [] : entradas.map((e) => e.subjectId);
  const perfis = await lerPorIds(db, 'athlete_profiles', uidsAtletas);
  ctx.perfis = perfis;
  if (def.issuerType === 'club' && def.subject !== 'club') {
    (await lerColecao(db, 'club_members', (q) => q.where('club_id', '==', def.issuerId)))
      .forEach((m) => ctx.membrosDoClube.add(m.user_id));
  }
  if (def.issuerType === 'coach') {
    // Vínculo encerrado não conta como aluno do professor (o sem status, antigo, conta).
    (await lerColecao(db, 'coach_students', (q) => q.where('coach_id', '==', def.issuerId)))
      .filter((s) => s.status !== 'ended')
      .forEach((s) => ctx.alunosDoProfessor.add(s.student_id));
  }

  let reservas = [];
  let aulas = [];
  if (def.metric === 'arena_bookings') {
    reservas = (await lerColecao(db, 'arena_bookings', (q) => q.where('arena_id', '==', def.issuerId)))
      .filter((b) => ['confirmed', 'completed'].includes(b.status) && b.no_show !== true);
  }
  if (def.metric === 'coach_lessons') {
    aulas = (await lerColecao(db, 'coach_lessons', (q) => q.where('coach_id', '==', def.issuerId)))
      .filter((l) => l.status === 'completed');
  }
  const dataReserva = (b) => {
    const s = Array.isArray(b.slots) ? b.slots.find((x) => x && x.date) : null;
    const ms = s ? Date.parse(`${s.date}T15:00:00Z`) : toMillis(b.created_at);
    return Number.isFinite(ms) ? ms : NaN;
  };

  // membros de cada clube concorrente (desafio ENTRE clubes)
  const membrosPorClube = new Map();
  if (def.subject === 'club') {
    const ids = entradas.map((e) => e.subjectId);
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      const ms = await lerColecao(db, 'club_members', (q) => q.where('club_id', '==', id));
      membrosPorClube.set(id, ms.map((m) => m.user_id));
    }
  }

  const valorDe = (e) => {
    if (def.subject === 'club') {
      return (membrosPorClube.get(e.subjectId) || []).reduce(
        (s, uid) => s + core.metricValue(def.metric, { games: jogosPorUid.get(uid) || [], ...janela }), 0,
      );
    }
    const uid = e.subjectId;
    return core.metricValue(def.metric, {
      games: jogosPorUid.get(uid) || [],
      bookingDates: reservas.filter((b) => b.athlete_id === uid).map(dataReserva),
      lessonDates: aulas.filter((l) => l.student_id === uid).map((l) => toMillis(l.updated_at) || toMillis(l.created_at)),
      ...janela,
    });
  };

  const calculadas = entradas.map((e) => ({
    ...e,
    value: valorDe(e),
    eligible: def.subject === 'club' ? true : elegivelParaDesafio(def, e.subjectId, ctx),
  }));
  const ranqueadas = core.rankEntries(calculadas);
  const posicao = new Map(ranqueadas.map((e) => [e.subjectId, e.position]));

  let premiados = 0;
  for (const fatia of emFatias(calculadas, BATCH)) {
    const batch = db.batch();
    fatia.forEach((e) => {
      const pos = posicao.get(e.subjectId) || null;
      const prem = terminou && pos ? (def.prizes || []).find((p) => p.place === pos) : null;
      batch.update(db.collection('challenge_entries').doc(e.id), {
        value: e.value, eligible: e.eligible, position: pos,
        finalized: terminou, prizeXp: prem && def.subject !== 'club' && def.issuerType === 'platform' ? (prem.xp || 0) : 0,
        updatedAt: Date.now(),
      });
    });
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }

  if (terminou) {
    for (const e of ranqueadas) {
      const prem = (def.prizes || []).find((p) => p.place === e.position);
      if (!prem || def.subject === 'club') continue;
      // XP de prêmio só nasce de desafio da PLATAFORMA: a regra do banco não
      // consegue olhar dentro da lista de prêmios, então quem garante é aqui —
      // senão uma arena ou um clube prometeria XP a quem quisesse.
      if (prem.xp > 0 && def.issuerType === 'platform') {
        // eslint-disable-next-line no-await-in-loop
        const novo = await conceder(db, { uid: e.subjectId, kind: 'challenge', ref: def.id, xp: prem.xp, label: `${def.title} — ${e.position}º lugar` });
        if (novo) premiados += 1;
      }
    }
    // Aviso do resultado, respeitando a escolha de cada pessoa.
    if (cfg.notifications.challengeResults && def.subject !== 'club') {
      const prefs = await lerPrefs(db, ranqueadas.map((e) => e.subjectId));
      for (const e of ranqueadas) {
        const p = prefs.get(e.subjectId);
        if (p && p.notifications && p.notifications.challengeResults === false) continue;
        const prem = (def.prizes || []).find((x) => x.place === e.position);
        // eslint-disable-next-line no-await-in-loop
        await avisar(db, `chres_${def.id}_${e.subjectId}`, {
          userId: e.subjectId,
          title: `Resultado: ${def.title}`,
          message: `Você terminou em ${e.position}º de ${ranqueadas.length}${prem && prem.label ? ` — ${prem.label}` : ''}.`,
          link: `/gamification?aba=desafios&desafio=${encodeURIComponent(def.id)}`,
        });
      }
    }
    await db.collection('gamification_challenges').doc(def.id).update({
      status: 'finished', finalizedAt: Date.now(), participants: ranqueadas.length,
    });
  }
  logger.info(`Desafio ${def.id}: ${calculadas.length} entradas, ${terminou ? 'encerrado' : 'em andamento'}, ${premiados} prêmios.`);
  return { entries: calculadas.length, finalized: terminou, prizes: premiados };
}

/**
 * Recalcula o placar de todo desafio ativo e fecha os que terminaram.
 */
async function runChallengeStandings(db, { now = Date.now(), logger = console } = {}) {
  if (!(await gamificacaoLigada(db))) return { skipped: 'flag_desligada' };
  const cfg = await carregarConfig(db);
  if (!moduloLigado(cfg, 'challenges')) return { skipped: 'modulo_desligado' };
  const defs = await lerColecao(db, 'gamification_challenges', (q) => q.where('status', '==', 'active'));
  const vivos = defs.filter((d) => Number(d.startsAt) <= now);
  if (vivos.length === 0) return { processed: 0 };
  const jogosPorUid = core.gamesByUid(await carregarJogos(db));
  let processed = 0;
  for (const def of vivos) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await processarDesafio(db, def, { agora: now, jogosPorUid, cfg, logger });
      processed += 1;
    } catch (err) {
      logger.error(`Desafio ${def.id} falhou.`, err);
    }
  }
  return { processed };
}

/* ================================================================== DUELOS == */

const nivelDe = (linha) => {
  const n = Number(linha && linha.doubles_rating);
  return Number.isFinite(n) && n >= 2 && n <= 8 ? n : null;
};

async function fecharDuelos(db, semana, { cfg, jogosPorUid, agora, logger }) {
  const abertos = (await lerColecao(db, 'duels', (q) => q.where('week', '==', semana)))
    .filter((d) => d.status === 'active');
  if (abertos.length === 0) return 0;
  const janela = core.weekWindow(semana);
  const prefs = await lerPrefs(db, abertos.flatMap((d) => [d.uidA, d.uidB]));
  const quer = (uid) => !(prefs.get(uid) && prefs.get(uid).notifications && prefs.get(uid).notifications.duels === false);
  let fechados = 0;
  for (const d of abertos) {
    const medir = (uid) => {
      const lista = (jogosPorUid.get(uid) || []).filter((g) => g.at >= janela.startMs && g.at < janela.endMs);
      return { uid, games: lista.length, wins: lista.filter((g) => g.won).length };
    };
    const a = medir(d.uidA);
    const b = medir(d.uidB);
    const r = core.duelOutcome(a, b);
    for (const [lado, outro, quem] of [[a, b, 'a'], [b, a, 'b']]) {
      if (lado.games === 0) continue;
      const venceu = r.winner === lado.uid;
      const xp = venceu ? cfg.duels.winnerXp : cfg.duels.participationXp;
      // eslint-disable-next-line no-await-in-loop
      await conceder(db, { uid: lado.uid, kind: 'duel', ref: `${semana}_${d.id}`, xp, label: venceu ? 'Duelo da semana — vitória' : 'Duelo da semana' });
      if (cfg.notifications.duels && quer(lado.uid)) {
        const msg = r.outcome === 'tie' ? 'Empate no duelo da semana.' : venceu ? 'Você venceu o duelo da semana!' : 'O duelo da semana ficou com o adversário. Revanche na próxima!';
        // eslint-disable-next-line no-await-in-loop
        await avisar(db, `duelres_${d.id}_${quem}`, {
          userId: lado.uid, title: 'Duelo da semana', message: `${msg} (${lado.wins} × ${outro.wins} vitórias)`, link: '/gamification?aba=duelo',
        });
      }
    }
    // Fecha DEPOIS do XP: se a função cair no meio, o duelo segue `active` e a
    // próxima passada conclui (o XP e o aviso têm id fixo, não duplicam).
    // eslint-disable-next-line no-await-in-loop
    await db.collection('duels').doc(d.id).update({
      status: 'finished', outcome: r.outcome, winner: r.winner,
      resultA: { games: a.games, wins: a.wins }, resultB: { games: b.games, wins: b.wins },
      finishedAt: agora,
    });
    fechados += 1;
  }
  logger.info(`Duelos ${semana}: ${fechados} fechados.`);
  return fechados;
}

/**
 * Segunda de manhã: fecha os duelos da semana que passou e emparelha os da
 * semana que começa.
 */
async function runWeeklyDuels(db, { now = Date.now(), logger = console } = {}) {
  if (!(await gamificacaoLigada(db))) return { skipped: 'flag_desligada' };
  const cfg = await carregarConfig(db);
  if (!moduloLigado(cfg, 'duels')) return { skipped: 'modulo_desligado' };

  const semana = core.weekKey(now);
  const passada = core.addDays(semana, -7);
  const jogosPorUid = core.gamesByUid(await carregarJogos(db));
  const fechados = await fecharDuelos(db, passada, { cfg, jogosPorUid, agora: now, logger });

  const existentes = await lerColecao(db, 'duels', (q) => q.where('week', '==', semana));
  if (existentes.length > 0) return { closed: fechados, created: 0, reason: 'semana_ja_emparelhada' };

  // Candidatos: jogaram nos últimos 30 dias, têm nível 2.0–8.0 e aceitam duelo.
  const recentes = [...jogosPorUid.entries()]
    .filter(([, lista]) => lista.some((g) => g.at >= now - 30 * core.DAY_MS))
    .map(([uid]) => uid);
  const [niveis, prefs, moder] = await Promise.all([
    lerPorIds(db, 'player_skill_ratings', recentes),
    lerPrefs(db, recentes),
    lerPorIds(db, 'gamification_moderation', recentes),
  ]);
  const candidatos = recentes
    .filter((uid) => !(prefs.get(uid) && prefs.get(uid).social && prefs.get(uid).social.acceptDuels === false))
    .filter((uid) => !(moder.get(uid) && moder.get(uid).excluded === true))
    .map((uid) => ({ uid, level: nivelDe(niveis.get(uid)), state: (niveis.get(uid) || {}).state || null }))
    .filter((c) => c.level != null);

  const anteriores = new Set((await lerColecao(db, 'duels', (q) => q.where('week', '==', passada)))
    .map((d) => [d.uidA, d.uidB].sort().join('|')));
  const pares = core.pairDuels(candidatos, { maxLevelGap: cfg.duels.maxLevelGap, jaPareados: anteriores });

  const janela = core.weekWindow(semana);
  let criados = 0;
  for (const par of pares) {
    const [uidA, uidB] = [par.a, par.b].sort();
    const id = core.duelId(semana, uidA, uidB);
    const nome = (u) => String((niveis.get(u) || {}).platform_name || 'Atleta').slice(0, 60);
    try {
      // eslint-disable-next-line no-await-in-loop
      await db.collection('duels').doc(id).create({
        week: semana, uidA, uidB, nameA: nome(uidA), nameB: nome(uidB),
        levelA: nivelDe(niveis.get(uidA)), levelB: nivelDe(niveis.get(uidB)),
        status: 'active', startsAt: janela.startMs, endsAt: janela.endMs,
        createdAt: now, schemaVersion: 1,
      });
      criados += 1;
    } catch (err) {
      if (!(err && (err.code === 6 || /already exists/i.test(String(err.message))))) throw err;
      continue;
    }
    if (cfg.notifications.duels) {
      for (const [uid, outro] of [[uidA, nome(uidB)], [uidB, nome(uidA)]]) {
        const p = prefs.get(uid);
        if (p && p.notifications && p.notifications.duels === false) continue;
        // eslint-disable-next-line no-await-in-loop
        await avisar(db, `duelnew_${id}_${uid}`, {
          userId: uid, title: 'Duelo da semana', message: `Você foi emparelhado com ${outro}. Quem vencer mais jogos até domingo leva.`, link: '/gamification?aba=duelo',
        });
      }
    }
  }
  logger.info(`Duelos ${semana}: ${criados} criados de ${candidatos.length} candidatos.`);
  return { closed: fechados, created: criados };
}

/* ============================================================== REPUTAÇÃO === */

/**
 * Confere que cada avaliação é de quem JOGOU a partida e agrega o que cada
 * pessoa recebeu. A chave do jogo diz de onde ele veio:
 *  `gd:<id do espelho em club_event_games>` · `tm:<id da partida de torneio>`.
 */
async function verificarAvaliacoes(db, avaliacoes) {
  const gd = avaliacoes.filter((r) => String(r.matchKey).startsWith('gd:'));
  const tm = avaliacoes.filter((r) => String(r.matchKey).startsWith('tm:'));
  const jogosGd = await lerPorIds(db, 'club_event_games', gd.map((r) => r.matchKey.slice(3)));
  const partidas = await lerPorIds(db, 'tournament_matches', tm.map((r) => r.matchKey.slice(3)));
  const regIds = [...partidas.values()].flatMap((m) => [...(m.side_a_ids || []), ...(m.side_b_ids || [])]);
  const regs = await lerPorIds(db, 'tournament_registrations', regIds);
  const uidsDaPartida = (m) => {
    const out = new Set();
    [...(m.side_a_ids || []), ...(m.side_b_ids || [])].forEach((rid) => {
      const r = regs.get(rid);
      if (!r) return;
      [r.player_a_user_id, r.player_b_user_id, r.user_id].forEach((u) => { if (u) out.add(u); });
    });
    return out;
  };
  const decidida = (m) => m && (m.winner_side === 'a' || m.winner_side === 'b');
  return avaliacoes.filter((r) => {
    if (r.matchKey.startsWith('gd:')) {
      const j = jogosGd.get(r.matchKey.slice(3));
      if (!decidida(j)) return false;
      const jogadores = new Set([...(j.side_a_ids || []), ...(j.side_b_ids || [])]);
      return jogadores.has(r.fromUid) && jogadores.has(r.toUid);
    }
    const m = partidas.get(r.matchKey.slice(3));
    if (!decidida(m)) return false;
    const jogadores = uidsDaPartida(m);
    return jogadores.has(r.fromUid) && jogadores.has(r.toUid);
  });
}

async function runReputation(db, { logger = console } = {}) {
  if (!(await gamificacaoLigada(db))) return { skipped: 'flag_desligada' };
  const cfg = await carregarConfig(db);
  if (!moduloLigado(cfg, 'match_reviews')) return { skipped: 'modulo_desligado' };
  const todas = await lerColecao(db, 'match_reviews');
  if (todas.length === 0) return { reviews: 0 };
  const validas = await verificarAvaliacoes(db, todas.filter((r) => r.matchKey && r.fromUid && r.toUid && r.fromUid !== r.toUid));

  const prefs = await lerPrefs(db, validas.map((r) => r.toUid));
  const porAlvo = new Map();
  validas.forEach((r) => {
    if (prefs.get(r.toUid) && prefs.get(r.toUid).social && prefs.get(r.toUid).social.acceptReviews === false) return;
    if (!porAlvo.has(r.toUid)) porAlvo.set(r.toUid, []);
    porAlvo.get(r.toUid).push(r);
  });

  let gravados = 0;
  for (const fatia of emFatias([...porAlvo.entries()], 200)) {
    const batch = db.batch();
    fatia.forEach(([uid, lista]) => {
      const agg = core.aggregateReputation(lista, { minForPublicScore: cfg.reviews.minForPublicScore });
      // O que é PÚBLICO: nota (com amostra), estrelas máximas e elogios. As
      // categorias de problema ficam no documento privado — só o avaliado e o admin.
      batch.set(db.collection('user_reputation').doc(uid), {
        uid, count: agg.count, average: agg.average, publicScore: agg.publicScore,
        fiveStarCount: agg.fiveStarCount, topTags: agg.topTags, updatedAt: Date.now(), schemaVersion: 1,
      });
      const issues = {};
      lista.forEach((r) => (r.issues || []).forEach((i) => { issues[i] = (issues[i] || 0) + 1; }));
      batch.set(db.collection('user_reputation_private').doc(uid), {
        uid, issues, count: agg.count, updatedAt: Date.now(), schemaVersion: 1,
      });
      gravados += 1;
    });
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  logger.info(`Reputação: ${todas.length} avaliações, ${validas.length} válidas, ${gravados} pessoas.`);
  return { reviews: todas.length, valid: validas.length, people: gravados };
}

/* ============================================================= INTEGRIDADE === */

async function abrirFlag(db, id, dados) {
  const ref = db.collection('gamification_flags').doc(id);
  const atual = await ref.get();
  // Revisado ou dispensado pelo admin: não reabre. O id carrega a janela
  // (semana/dia), então um problema NOVO volta a aparecer.
  if (atual.exists) return false;
  await ref.create({ ...dados, status: 'open', createdAt: Date.now(), schemaVersion: 1 });
  return true;
}

async function runIntegrity(db, { now = Date.now(), logger = console } = {}) {
  if (!(await gamificacaoLigada(db))) return { skipped: 'flag_desligada' };
  const cfg = await carregarConfig(db);
  const jogosPorUid = core.gamesByUid(await carregarJogos(db));
  const progs = await lerColecao(db, 'user_progression_v2', (q) => q.orderBy('xpTotal', 'desc'));
  const anteriores = await lerPorIds(db, 'gamification_integrity', progs.map((p) => p.uid || p.id));
  const dia = core.brDay(now);
  let abertas = 0;

  for (const p of progs) {
    const uid = p.uid || p.id;
    const lista = jogosPorUid.get(uid) || [];
    const verificado = { games: lista.length, wins: lista.filter((g) => g.won).length };
    const ant = anteriores.get(uid);
    const grants = Number(p.grantsXp) || 0;
    const sinais = core.integritySignals({
      xpTotal: Number(p.xpTotal) || 0, grantsXp: grants, verified: verificado,
      previous: ant ? { xp: Number(ant.xp) || 0, at: Number(ant.at) || 0 } : null, now,
    }, cfg.antiFarm);
    for (const s of sinais) {
      // xp_unverified é estado (um por pessoa); o salto, evento (um por dia).
      const id = s.type === 'xp_jump' ? `${s.type}_${uid}_${dia}` : `${s.type}_${uid}`;
      // eslint-disable-next-line no-await-in-loop
      if (await abrirFlag(db, id, { type: s.type, severity: s.severity, subjectUid: uid, detail: s.detail })) abertas += 1;
    }
  }
  // Fotografia para a próxima comparação (um documento por pessoa, em lotes).
  for (const fatia of emFatias(progs, BATCH)) {
    const batch = db.batch();
    fatia.forEach((p) => batch.set(db.collection('gamification_integrity').doc(p.uid || p.id), { xp: Number(p.xpTotal) || 0, at: now }));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }

  // Anéis de kudos (últimos 7 dias).
  const kudos = await lerColecao(db, 'user_kudos', (q) => q.where('createdAt', '>=', now - 7 * core.DAY_MS));
  for (const r of core.kudosRings(kudos, cfg.antiFarm.kudosRingMin)) {
    const chave = [r.a, r.b].sort().join('_');
    // eslint-disable-next-line no-await-in-loop
    if (await abrirFlag(db, `kudos_ring_${chave}_${core.weekKey(now)}`, { type: 'kudos_ring', severity: 'medium', subjectUid: r.a, otherUid: r.b, detail: { ab: r.ab, ba: r.ba } })) abertas += 1;
  }

  // Avaliações de vingança (últimos 30 dias).
  const reviews = await lerColecao(db, 'match_reviews', (q) => q.where('createdAt', '>=', now - 30 * core.DAY_MS));
  for (const r of core.suspiciousReviewPairs(reviews)) {
    const chave = [r.a, r.b].sort().join('_');
    // eslint-disable-next-line no-await-in-loop
    if (await abrirFlag(db, `review_retaliation_${chave}_${String(r.matchKey).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 60)}`, { type: 'review_retaliation', severity: 'medium', subjectUid: r.a, otherUid: r.b, detail: { matchKey: r.matchKey } })) abertas += 1;
  }
  logger.info(`Integridade: ${progs.length} atletas, ${abertas} sinais novos.`);
  return { athletes: progs.length, flags: abertas };
}

/* ===================================================== RESUMO DA SEMANA ==== */

async function runWeeklyDigest(db, { now = Date.now(), logger = console } = {}) {
  if (!(await gamificacaoLigada(db))) return { skipped: 'flag_desligada' };
  const cfg = await carregarConfig(db);
  if (!moduloLigado(cfg, 'weekly_review') || !cfg.notifications.weeklyReview) return { skipped: 'desligado' };
  const semana = core.weekKey(now);
  const passada = core.addDays(semana, -7);
  const janela = core.weekWindow(passada);
  const jogosPorUid = core.gamesByUid(await carregarJogos(db));
  const ativos = [...jogosPorUid.entries()]
    .filter(([, lista]) => lista.some((g) => g.at >= now - 30 * core.DAY_MS))
    .map(([uid]) => uid);
  const prefs = await lerPrefs(db, ativos);
  let enviados = 0;
  for (const uid of ativos) {
    const p = prefs.get(uid);
    if (p && p.notifications && p.notifications.weeklyReview === false) continue;
    const lista = (jogosPorUid.get(uid) || []).filter((g) => g.at >= janela.startMs && g.at < janela.endMs);
    if (lista.length === 0) continue; // semana sem jogo: sem aviso (não cobramos)
    const vit = lista.filter((g) => g.won).length;
    // eslint-disable-next-line no-await-in-loop
    const ok = await avisar(db, `weekly_${uid}_${passada}`, {
      userId: uid,
      title: 'Sua semana em revisão',
      message: `${lista.length} ${lista.length === 1 ? 'jogo' : 'jogos'} e ${vit} ${vit === 1 ? 'vitória' : 'vitórias'} na semana. Veja o resumo completo.`,
      link: '/gamification/revisao',
    });
    if (ok) enviados += 1;
  }
  logger.info(`Resumo da semana ${passada}: ${enviados} avisos.`);
  return { sent: enviados };
}

/* ============================================================== MÉTRICAS === */

async function contar(db, colecao, consulta = (q) => q) {
  const snap = await consulta(db.collection(colecao)).count().get();
  return snap.data().count;
}

/**
 * Os ids dos "primeiros passos" — o MESMO catálogo do cliente
 * (`src/modules/progression/domain/onboarding.js`); há teste de paridade.
 * O id é contrato: está gravado em `user_gamification_prefs.onboarding.done`.
 */
const ONBOARDING_STEP_IDS = Object.freeze(['level', 'photo', 'profile', 'ranking', 'follow', 'club', 'watch', 'tournament', 'share']);

/**
 * O funil dos primeiros passos: quantas pessoas concluíram cada etapa e quantas
 * dispensaram o roteiro. Etapa detectada é GRAVADA com a data em
 * `onboarding.done.<id>`, então contar é uma consulta de agregação por etapa
 * (índice de campo único, automático — nenhum índice novo).
 */
async function funilDosPrimeirosPassos(db) {
  const [dispensaram, ...porEtapa] = await Promise.all([
    contar(db, 'user_gamification_prefs', (q) => q.where('onboarding.dismissed', '==', true)),
    ...ONBOARDING_STEP_IDS.map((id) => contar(db, 'user_gamification_prefs', (q) => q.where(`onboarding.done.${id}`, '>', 0))),
  ]);
  return { dismissed: dispensaram, steps: Object.fromEntries(ONBOARDING_STEP_IDS.map((id, i) => [id, porEtapa[i]])) };
}

async function runMetricsSnapshot(db, { now = Date.now(), logger = console } = {}) {
  if (!(await gamificacaoLigada(db))) return { skipped: 'flag_desligada' };
  const dia = core.brDay(now);
  const sete = now - 7 * core.DAY_MS;
  const trinta = now - 30 * core.DAY_MS;
  const [
    atletas, ativos7, ativos30, convites, convitesAtivados, kudos7, reviews7, cartas7,
    desafiosAtivos, duelosAtivos, pedidosRecompensa, flagsAbertas, prefsDocs,
  ] = await Promise.all([
    contar(db, 'user_progression_v2'),
    contar(db, 'user_progression_v2', (q) => q.where('updatedAt', '>=', sete)),
    contar(db, 'user_progression_v2', (q) => q.where('updatedAt', '>=', trinta)),
    contar(db, 'user_referrals'),
    contar(db, 'user_referrals', (q) => q.where('activatedAt', '>', 0)),
    contar(db, 'user_kudos', (q) => q.where('createdAt', '>=', sete)),
    contar(db, 'match_reviews', (q) => q.where('createdAt', '>=', sete)),
    contar(db, 'partner_letters', (q) => q.where('createdAt', '>=', sete)),
    contar(db, 'gamification_challenges', (q) => q.where('status', '==', 'active')),
    contar(db, 'duels', (q) => q.where('status', '==', 'active')),
    contar(db, 'reward_claims', (q) => q.where('status', '==', 'requested')),
    contar(db, 'gamification_flags', (q) => q.where('status', '==', 'open')),
    contar(db, 'user_gamification_prefs'),
  ]);
  const linha = {
    day: dia, at: now, athletes: atletas, active7: ativos7, active30: ativos30,
    referrals: convites, referralsActivated: convitesAtivados,
    kudos7, reviews7, letters7: cartas7, challengesActive: desafiosAtivos, duelsActive: duelosAtivos,
    rewardClaimsOpen: pedidosRecompensa, flagsOpen: flagsAbertas, prefsDocs, schemaVersion: 1,
  };
  // O funil é um campo ADITIVO do retrato; se a contagem falhar, o retrato
  // do dia sai sem ele (a tela diz que ainda não mediu) em vez de não sair.
  try {
    linha.onboarding = await funilDosPrimeirosPassos(db);
  } catch (e) {
    logger.warn('Funil dos primeiros passos não medido.', e && e.message);
  }
  await db.collection('gamification_metrics').doc(dia).set(linha);
  logger.info('Métricas da gamificação gravadas.', linha);
  return linha;
}

module.exports = {
  normalizarConfig, carregarConfig, gamificacaoLigada, moduloLigado,
  runChallengeStandings, runWeeklyDuels, runReputation, runIntegrity, runWeeklyDigest, runMetricsSnapshot,
  ONBOARDING_STEP_IDS, conceder, avisar, carregarJogos, lerPorIds, lerColecao, lerPrefs,
  elegivelParaDesafio, verificarAvaliacoes,
};
