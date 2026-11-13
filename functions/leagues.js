/**
 * LIGAS — toda escrita da liga passa por aqui (docs/57-LIGAS.md).
 *
 * A liga é um módulo PRÓPRIO, ao lado do torneio: a árvore `leagues/{liga}`
 * (com `divisions`, `entries` e `matches`) só é lida pelo cliente — a regra é
 * uma linha de leitura e nenhuma escrita. Assim cada coisa que a tela pede é
 * conferida aqui: a flag do grupo de quem cria, se a pessoa responde pelo
 * clube/arena/federação/perfil de professor, a janela de inscrição, a faixa de
 * DUPR da divisão e se quem lança o placar organiza a liga.
 *
 * Chamada `leagues` (ações): `create`, `update`, `status`, `division_save`,
 * `division_remove`, `register`, `withdraw`, `entry_add`, `schedule`,
 * `result`, `staff` e, nas escadas, `session` (a próxima sessão).
 */
const P = require('./leaguePolicy.js');
const LD = require('./leagueLadder.js');
const { tx, textoDoAviso, i18nDoAviso } = require('./avisoI18n.js');
const { FederationError, staffPerms } = require('./federations.js');

const COL = 'leagues';
const MAX_DIVISIONS = 12;
const MAX_ENTRIES = 32;
const MAX_ADMINS = 10;
const LOTE = 400;

const falha = (code, msg) => { throw new FederationError(code, msg); };
const texto = (v, max = 300) => String(v == null ? '' : v).trim().slice(0, max);
const nomeDe = (u) => texto((u && (u.platform_name || u.full_name || u.display_name)) || 'Atleta', 80);
const ref = (ctx, id) => ctx.db.collection(COL).doc(id);
const sub = (ctx, id, nome) => ref(ctx, id).collection(nome);
const ts = (ctx) => ctx.Timestamp.fromMillis(ctx.now);

/* -------------------------------------------------------------- apoio -- */

async function flags(ctx) {
  const snap = await ctx.db.collection('platform_settings').doc('global').get();
  return (snap.exists && snap.data().feature_flags) || {};
}

async function usuario(ctx, uid) {
  const snap = await ctx.db.collection('users').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

/** DUPR do perfil (2,000–8,000) ou `null`. */
function duprDe(u) {
  const n = Number(u && u.dupr_rating);
  return Number.isFinite(n) && n >= 2 && n <= 8 ? Math.round(n * 1000) / 1000 : null;
}

/** A categoria em que joga (masculina/feminina); "outro" não vira palpite. */
function generoDe(u) {
  const g = (u && (u.competition_gender || u.gender)) || '';
  if (/^(male|masculin)/i.test(g)) return 'male';
  if (/^(female|feminin)/i.test(g)) return 'female';
  return null;
}

/** O atleta como a inscrição o guarda: conta e nome público (nenhum contato). */
async function atleta(ctx, uid) {
  const u = await usuario(ctx, uid);
  if (!u) falha('not-found', 'Não encontramos a conta de um dos atletas.');
  return { uid, name: nomeDe(u), dupr: duprDe(u), gender: generoDe(u) };
}

function aviso(ctx, batch, userId, { title, message, link }) {
  if (!userId) return;
  const i18n = i18nDoAviso({ title, message });
  batch.set(ctx.db.collection('notifications').doc(), {
    user_id: userId, title: textoDoAviso(title), message: textoDoAviso(message), ...(i18n ? { i18n } : {}),
    type: 'league', link, read: false, archived: false, origin: 'server', created_at: ts(ctx),
  });
}

function auditoria(ctx, batch, actor, action, details) {
  batch.set(ctx.db.collection('audit_logs').doc(), {
    log_number: Number(`${ctx.now}${Math.floor(Math.random() * 900 + 100)}`),
    action, action_label: action, actor_id: actor.uid, actor_name: actor.name || actor.uid, actor_email: actor.email || '',
    tournament_id: null, details, created_at: ts(ctx),
  });
}

/** Responde pelo organizador? (o admin da plataforma sempre). */
async function respondePor(ctx, actor, type, id) {
  if (actor.isPlatformAdmin) return true;
  if (type === 'athlete') return id === actor.uid;
  if (type === 'coach') return id === actor.uid && (await ctx.db.collection('coaches').doc(id).get()).exists;
  if (type === 'club') {
    const s = await ctx.db.collection('club_members').doc(`${id}_${actor.uid}`).get();
    return s.exists && s.data().role === 'admin';
  }
  if (type === 'arena') return (await ctx.db.collection('arena_managers').doc(`${id}_${actor.uid}`).get()).exists;
  if (type === 'federation') return (await staffPerms(ctx, id, actor)).includes('competitions');
  return false;
}

/** O nome que a liga mostra do organizador (copiado do documento dele). */
async function nomeDoOrganizador(ctx, actor, type, id) {
  if (type === 'athlete' || type === 'coach') return nomeDe(await usuario(ctx, id));
  const col = { club: 'clubs', arena: 'arenas', federation: 'federations' }[type];
  const s = await ctx.db.collection(col).doc(id).get();
  if (!s.exists) falha('not-found', 'Não encontramos quem organiza.');
  return texto(s.data().name, 120);
}

async function liga(ctx, id) {
  if (typeof id !== 'string' || !id) falha('invalid-argument', 'Liga não informada.');
  const s = await ref(ctx, id).get();
  if (!s.exists) falha('not-found', 'Liga não encontrada.');
  return { id: s.id, ...s.data() };
}

/** Organiza a liga: está na lista, responde pelo organizador ou é admin da plataforma. */
async function podeGerir(ctx, actor, lg) {
  if (actor.isPlatformAdmin) return true;
  if ((lg.admins || []).includes(actor.uid)) return true;
  const org = lg.organizer || {};
  if (org.type === 'athlete' || org.type === 'coach') return false;
  return respondePor(ctx, actor, org.type, org.id);
}

async function exigeGerir(ctx, actor, lg) {
  if (!(await podeGerir(ctx, actor, lg))) falha('permission-denied', 'Só quem organiza a liga pode fazer isso.');
}

function divisaoDe(raw, ordem) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const name = texto(d.name, 60);
  if (!name) falha('invalid-argument', 'Dê um nome a cada divisão.');
  const max = Math.floor(Number(d.max_entries)) || 0;
  return {
    name,
    order: Number.isFinite(Number(d.order)) ? Number(d.order) : ordem,
    gender: P.GENDERS.includes(d.gender) ? d.gender : 'open',
    rule: P.normalizeDivisionRule(d.rule),
    max_entries: max >= 2 && max <= MAX_ENTRIES ? max : 0,
  };
}

function pontosDe(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const int = (v, padrao) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 && n <= 10 ? n : padrao;
  };
  return {
    mode: r.mode === 'win_pct' ? 'win_pct' : 'points', win: int(r.win, 3), loss: int(r.loss, 1), wo_loss: int(r.wo_loss, 0),
    // A ordem de desempate do torneio, escolhida pela organização ([] = a padrão da liga).
    tiebreak_order: P.tiebreakOrder(r.tiebreak_order),
  };
}

/** Campos da liga que a organização edita (lista fechada). */
function camposDaLiga(d) {
  const out = {};
  if ('name' in d) {
    out.name = texto(d.name, 100);
    if (out.name.length < 3) falha('invalid-argument', 'O nome da liga precisa de pelo menos 3 letras.');
  }
  if ('description' in d) out.description = texto(d.description, 2000);
  if ('city' in d) out.city = texto(d.city, 80);
  if ('state' in d) out.state = texto(d.state, 2).toUpperCase();
  if ('location' in d) out.location = texto(d.location, 160);
  if ('season' in d) out.season = P.normalizeSeason(d.season);
  if ('standings' in d) out.standings = pontosDe(d.standings);
  if ('visibility' in d) out.visibility = d.visibility === 'unlisted' ? 'unlisted' : 'public';
  if ('self_registration' in d) out.self_registration = d.self_registration !== false;
  return out;
}

async function membros(ctx, id, lg, extra = []) {
  const entries = await sub(ctx, id, 'entries').where('status', '==', 'active').get();
  const uids = new Set([...(lg.admins || []), ...extra]);
  entries.docs.forEach((e) => (e.data().player_uids || []).forEach((u) => u && uids.add(u)));
  return { member_uids: [...uids], entries_count: entries.size };
}

/* ------------------------------------------------------------- ações -- */

async function create(ctx, actor, data) {
  const fl = await flags(ctx);
  const org = data.organizer || {};
  const flag = P.ORGANIZER_FLAG[org.type];
  if (!flag) falha('invalid-argument', 'Escolha em nome de quem a liga é criada.');
  if (!actor.isPlatformAdmin && fl[flag] !== true) falha('failed-precondition', 'A criação de ligas não está liberada para este grupo.');
  const orgId = org.type === 'athlete' ? actor.uid : texto(org.id, 128);
  if (!orgId || !(await respondePor(ctx, actor, org.type, orgId))) falha('permission-denied', 'Você não responde por quem organiza.');
  const fmt = P.FORMATS[data.format];
  if (!fmt || !fmt.available) falha('invalid-argument', 'Formato de liga indisponível.');
  const divisoes = (Array.isArray(data.divisions) ? data.divisions : []).map(divisaoDe);
  if (!divisoes.length) falha('invalid-argument', 'A liga precisa de pelo menos uma divisão.');
  if (divisoes.length > MAX_DIVISIONS) falha('invalid-argument', `No máximo ${MAX_DIVISIONS} divisões.`);
  const campos = camposDaLiga({ standings: {}, season: {}, visibility: 'public', self_registration: true, ...data });
  if (!campos.name) falha('invalid-argument', 'Dê um nome à liga.');
  const leagueRef = ctx.db.collection(COL).doc();
  const batch = ctx.db.batch();
  batch.set(leagueRef, {
    ...campos,
    format: data.format,
    entry_type: fmt.entry,
    organizer: { type: org.type, id: orgId, name: await nomeDoOrganizador(ctx, actor, org.type, orgId) },
    status: 'draft',
    admins: [actor.uid],
    member_uids: [actor.uid],
    ever_uids: [actor.uid],
    entries_count: 0,
    creator_uid: actor.uid,
    created_at: ts(ctx), updated_at: ts(ctx),
  });
  divisoes.forEach((d, i) => batch.set(leagueRef.collection('divisions').doc(), { ...d, order: i, created_at: ts(ctx) }));
  auditoria(ctx, batch, actor, 'league_created', { league_id: leagueRef.id, organizer: org.type, format: data.format });
  await batch.commit();
  return { leagueId: leagueRef.id };
}

async function update(ctx, actor, data) {
  const lg = await liga(ctx, data.leagueId);
  await exigeGerir(ctx, actor, lg);
  const campos = camposDaLiga(data.patch && typeof data.patch === 'object' ? data.patch : {});
  if (!Object.keys(campos).length) return { ok: true };
  await ref(ctx, lg.id).update({ ...campos, updated_at: ts(ctx) });
  return { ok: true };
}

async function status(ctx, actor, data) {
  const lg = await liga(ctx, data.leagueId);
  await exigeGerir(ctx, actor, lg);
  if (!P.canMoveStatus(lg.status, data.to)) falha('failed-precondition', 'Esta mudança de situação não é possível agora.');
  if (data.to === 'draft' && lg.entries_count > 0) falha('failed-precondition', 'A liga já tem inscritos: ela não volta a rascunho.');
  const batch = ctx.db.batch();
  batch.update(ref(ctx, lg.id), { status: data.to, updated_at: ts(ctx) });
  auditoria(ctx, batch, actor, 'league_status', { league_id: lg.id, from: lg.status, to: data.to });
  await batch.commit();
  return { ok: true };
}

async function divisionSave(ctx, actor, data) {
  const lg = await liga(ctx, data.leagueId);
  await exigeGerir(ctx, actor, lg);
  const col = sub(ctx, lg.id, 'divisions');
  if (data.divisionId) {
    const s = await col.doc(data.divisionId).get();
    if (!s.exists) falha('not-found', 'Divisão não encontrada.');
    await col.doc(data.divisionId).update({ ...divisaoDe(data.division, s.data().order), updated_at: ts(ctx) });
    return { divisionId: data.divisionId };
  }
  const todas = await col.get();
  if (todas.size >= MAX_DIVISIONS) falha('failed-precondition', `No máximo ${MAX_DIVISIONS} divisões.`);
  const nova = col.doc();
  await nova.set({ ...divisaoDe(data.division, todas.size), order: todas.size, created_at: ts(ctx) });
  return { divisionId: nova.id };
}

async function divisionRemove(ctx, actor, data) {
  const lg = await liga(ctx, data.leagueId);
  await exigeGerir(ctx, actor, lg);
  const [entries, jogos] = await Promise.all([
    sub(ctx, lg.id, 'entries').where('division_id', '==', data.divisionId).limit(1).get(),
    sub(ctx, lg.id, 'matches').where('division_id', '==', data.divisionId).limit(1).get(),
  ]);
  if (!entries.empty || !jogos.empty) falha('failed-precondition', 'A divisão tem inscritos ou jogos: ela não pode sair.');
  await sub(ctx, lg.id, 'divisions').doc(data.divisionId).delete();
  return { ok: true };
}

const MOTIVO = {
  below: 'O DUPR está abaixo da faixa da divisão.',
  above: 'O DUPR está acima da faixa da divisão.',
  missing_dupr: 'Esta divisão exige DUPR de todos os atletas.',
  over_cap: 'A soma do DUPR passa do teto da divisão.',
  over_individual_cap: 'Um atleta passa do teto individual da divisão.',
  gender: 'A categoria dos atletas não combina com a divisão.',
  gender_unknown: 'Falta a categoria (masculina ou feminina) no perfil de um atleta.',
  team_size: 'A equipe não tem o número de atletas do formato.',
  team_mix: 'A equipe precisa de 2 homens e 2 mulheres.',
  team_same: 'Todos os atletas da equipe precisam ser da mesma categoria.',
};

/**
 * Grava a inscrição depois de conferir vaga, repetição e faixa da divisão.
 * ponytail: a vaga é conferida fora de transação; duas inscrições no mesmo
 * instante podem passar do limite por uma. Transação se isso aparecer.
 */
async function gravarInscricao(ctx, actor, lg, data, players, { override = false, by = 'self' } = {}) {
  const div = await sub(ctx, lg.id, 'divisions').doc(texto(data.divisionId, 128)).get();
  if (!div.exists) falha('not-found', 'Divisão não encontrada.');
  const ativos = await sub(ctx, lg.id, 'entries').where('division_id', '==', div.id).where('status', '==', 'active').get();
  const max = div.data().max_entries || MAX_ENTRIES;
  if (ativos.size >= max) falha('resource-exhausted', 'A divisão está completa.');
  const jaEstao = new Set(ativos.docs.flatMap((e) => e.data().player_uids || []));
  const repetido = players.find((p) => p.uid && jaEstao.has(p.uid));
  if (repetido) falha('already-exists', `${repetido.name} já está inscrito nesta divisão.`);
  const elig = P.divisionEligibility(div.data(), players);
  if (!elig.ok && !override) falha('failed-precondition', MOTIVO[elig.reason] || 'Esta inscrição não cabe na divisão.');
  // Equipe: 2 homens e 2 mulheres (MiLP), todos da mesma categoria (v4) ou livre.
  // Como a regra da divisão, a organização inscreve fora dela e fica exceção.
  const montagem = P.teamCompositionError(lg.format, players);
  if (montagem && !override) falha('failed-precondition', MOTIVO[montagem]);
  const uids = players.map((p) => p.uid).filter(Boolean);
  if (new Set(uids).size !== uids.length) falha('invalid-argument', 'O mesmo atleta aparece duas vezes.');
  const entryRef = sub(ctx, lg.id, 'entries').doc();
  const nome = texto(data.name, 60) || players.map((p) => p.name.split(' ')[0]).join(' / ');
  const batch = ctx.db.batch();
  batch.set(entryRef, {
    division_id: div.id, name: nome, auto_name: !texto(data.name, 60), players, player_uids: uids, status: 'active',
    eligibility: { value: elig.value, unrated: elig.unrated, override: !elig.ok || Boolean(montagem) },
    created_by: actor.uid, added_by: by, created_at: ts(ctx),
  });
  const m = await membros(ctx, lg.id, lg, uids);
  // `ever_uids`: todo atleta que já passou pela liga (a exclusão de conta acha
  // a liga por ele mesmo depois de a pessoa desistir).
  const ever = [...new Set([...(lg.ever_uids || []), ...uids])];
  batch.update(ref(ctx, lg.id), { member_uids: m.member_uids, ever_uids: ever, entries_count: m.entries_count + 1, updated_at: ts(ctx) });
  const link = `/ligas/${lg.id}`;
  players.filter((p) => p.uid && p.uid !== actor.uid).forEach((p) => aviso(ctx, batch, p.uid, {
    title: tx('Você entrou numa liga'),
    message: tx('Você foi inscrito na liga {liga}, divisão {divisao}.', { liga: lg.name, divisao: div.data().name }),
    link,
  }));
  await batch.commit();
  return { entryId: entryRef.id };
}

async function register(ctx, actor, data) {
  const lg = await liga(ctx, data.leagueId);
  if (lg.status !== 'open') falha('failed-precondition', 'As inscrições desta liga não estão abertas.');
  if (lg.self_registration === false) falha('failed-precondition', 'Nesta liga, quem inscreve é a organização.');
  const fmt = P.FORMATS[lg.format] || {};
  const uids = [actor.uid];
  if (fmt.entry === 'team') {
    // A equipe: quem inscreve + os companheiros (o formato diz quantos).
    const outros = [...new Set((Array.isArray(data.teammateUids) ? data.teammateUids : []).map((u) => texto(u, 128)))]
      .filter((u) => u && u !== actor.uid);
    if (outros.length !== fmt.players - 1) falha('invalid-argument', `Escolha ${fmt.players - 1} companheiros de equipe.`);
    uids.push(...outros);
  } else if (fmt.players === 2) {
    const parceiro = texto(data.partnerUid, 128);
    if (!parceiro || parceiro === actor.uid) falha('invalid-argument', 'Escolha a sua dupla.');
    uids.push(parceiro);
  }
  const players = await Promise.all(uids.map((u) => atleta(ctx, u)));
  return gravarInscricao(ctx, actor, lg, data, players);
}

async function entryAdd(ctx, actor, data) {
  const lg = await liga(ctx, data.leagueId);
  await exigeGerir(ctx, actor, lg);
  if (['finished', 'cancelled'].includes(lg.status)) falha('failed-precondition', 'A liga está encerrada.');
  const fmt = P.FORMATS[lg.format] || {};
  const brutos = Array.isArray(data.players) ? data.players.slice(0, fmt.players || 1) : [];
  if (brutos.length !== fmt.players) falha('invalid-argument', `Informe ${fmt.players} atleta(s).`);
  const players = await Promise.all(brutos.map(async (p) => {
    if (p && p.uid) return atleta(ctx, texto(p.uid, 128));
    const name = texto(p && p.name, 80);
    if (!name) falha('invalid-argument', 'Informe o nome de quem não tem conta.');
    return { uid: null, name, dupr: null, gender: null };
  }));
  // Como no torneio: a organização inscreve mesmo fora da regra da divisão, e a
  // inscrição fica marcada como exceção (`eligibility.override`).
  return gravarInscricao(ctx, actor, lg, data, players, { override: true, by: 'organizer' });
}

async function withdraw(ctx, actor, data) {
  const lg = await liga(ctx, data.leagueId);
  const e = await sub(ctx, lg.id, 'entries').doc(texto(data.entryId, 128)).get();
  if (!e.exists) falha('not-found', 'Inscrição não encontrada.');
  if (e.data().status !== 'active') falha('failed-precondition', 'Esta inscrição já saiu da liga.');
  const minha = (e.data().player_uids || []).includes(actor.uid);
  if (!minha) await exigeGerir(ctx, actor, lg);
  const jogos = await sub(ctx, lg.id, 'matches').where('division_id', '==', e.data().division_id).get();
  const temJogo = jogos.docs.some((j) => {
    const m = j.data();
    return m.side_a === e.id || m.side_b === e.id || [...(m.team_a || []), ...(m.team_b || [])].includes(e.id);
  });
  const batch = ctx.db.batch();
  // Sem jogo marcado, a inscrição sai; com jogo, ela fica como desistência
  // (os placares já lançados continuam valendo para os adversários).
  if (temJogo) batch.update(e.ref, { status: 'withdrawn', withdrawn_at: ts(ctx), withdrawn_by: actor.uid });
  else batch.delete(e.ref);
  const m = await membros(ctx, lg.id, lg);
  const fora = new Set(e.data().player_uids || []);
  const restantes = m.member_uids.filter((u) => !fora.has(u) || (lg.admins || []).includes(u));
  batch.update(ref(ctx, lg.id), { member_uids: restantes, entries_count: Math.max(0, m.entries_count - 1), updated_at: ts(ctx) });
  await batch.commit();
  return { ok: true, kept: temJogo };
}

async function schedule(ctx, actor, data) {
  const lg = await liga(ctx, data.leagueId);
  await exigeGerir(ctx, actor, lg);
  if (['finished', 'cancelled', 'draft'].includes(lg.status)) falha('failed-precondition', 'Abra a liga antes de gerar as rodadas.');
  if (LD.isLadderFormat(lg.format)) falha('failed-precondition', 'Na escada, os jogos saem sessão a sessão.');
  const divisionId = texto(data.divisionId, 128);
  const [entries, jogos] = await Promise.all([
    sub(ctx, lg.id, 'entries').where('division_id', '==', divisionId).where('status', '==', 'active').get(),
    sub(ctx, lg.id, 'matches').where('division_id', '==', divisionId).get(),
  ]);
  if (jogos.docs.some((j) => j.data().status === 'done')) {
    falha('failed-precondition', 'A divisão já tem placar lançado: as rodadas não são geradas de novo.');
  }
  if (entries.size < 2) falha('failed-precondition', 'A divisão precisa de pelo menos 2 inscritos.');
  // Ordem estável (a da inscrição) para o sorteio ser reproduzível.
  const ids = entries.docs.slice().sort((a, b) => (a.data().created_at?.toMillis?.() || 0) - (b.data().created_at?.toMillis?.() || 0)).map((d) => d.id);
  const season = P.normalizeSeason(lg.season);
  const novos = P.roundRobin(ids, season.legs);
  const escritas = [
    ...jogos.docs.map((j) => (b) => b.delete(j.ref)),
    ...novos.map((m) => (b) => b.set(sub(ctx, lg.id, 'matches').doc(), {
      division_id: divisionId, phase: 'season', round: m.round, side_a: m.side_a, side_b: m.side_b,
      games: [], wo_winner: null, status: 'scheduled', scheduled_date: null, court: '',
      created_at: ts(ctx), updated_at: ts(ctx),
    })),
  ];
  for (let i = 0; i < escritas.length; i += LOTE) {
    const batch = ctx.db.batch();
    escritas.slice(i, i + LOTE).forEach((w) => w(batch));
    await batch.commit();
  }
  const fim = ctx.db.batch();
  if (lg.status === 'open' && data.start === true) fim.update(ref(ctx, lg.id), { status: 'running', updated_at: ts(ctx) });
  auditoria(ctx, fim, actor, 'league_schedule', { league_id: lg.id, division_id: divisionId, matches: novos.length });
  await fim.commit();
  return { matches: novos.length };
}

async function result(ctx, actor, data) {
  const lg = await liga(ctx, data.leagueId);
  await exigeGerir(ctx, actor, lg);
  if (['finished', 'cancelled'].includes(lg.status)) falha('failed-precondition', 'A liga está encerrada: reabra para mudar um placar.');
  const jogo = await sub(ctx, lg.id, 'matches').doc(texto(data.matchId, 128)).get();
  if (!jogo.exists) falha('not-found', 'Jogo não encontrado.');
  if (data.clear === true) {
    const b = ctx.db.batch();
    b.update(jogo.ref, { games: [], wo_winner: null, dreambreaker: null, status: 'scheduled', recorded_by: null, recorded_at: null, updated_at: ts(ctx) });
    auditoria(ctx, b, actor, 'league_result_cleared', { league_id: lg.id, match_id: jogo.id });
    await b.commit();
    return { ok: true };
  }
  // Na escada o jogo é de duplas comum; nas equipes, o confronto (`lines` jogos e o DreamBreaker).
  const regras = jogo.data().phase === 'ladder' ? {} : P.resultRules(lg.format);
  const r = P.validateResult({ games: data.games, wo_winner: data.wo_winner, dreambreaker: data.dreambreaker }, regras);
  if (!r.ok) falha('invalid-argument', `Placar inválido (${r.error}).`);
  const patch = { games: r.games, wo_winner: r.wo_winner, dreambreaker: r.dreambreaker, status: 'done', recorded_by: actor.uid, recorded_at: ts(ctx), updated_at: ts(ctx) };
  if (P.isIsoDate(data.played_date)) patch.scheduled_date = data.played_date;
  const b = ctx.db.batch();
  b.update(jogo.ref, patch);
  auditoria(ctx, b, actor, 'league_result', { league_id: lg.id, match_id: jogo.id, games: r.games, wo_winner: r.wo_winner, dreambreaker: r.dreambreaker });
  await b.commit();
  return { ok: true };
}

/**
 * ESCADA: gera a próxima sessão da divisão com quem veio (`present`). A escada
 * é refeita dos jogos (`leagueLadder.js`), os presentes entram na ordem dela e
 * são cortados em quadras. Sessão aberta sem nenhum placar é REFEITA (outra
 * lista de presença); com placar, só depois de fechada.
 */
async function session(ctx, actor, data) {
  const lg = await liga(ctx, data.leagueId);
  await exigeGerir(ctx, actor, lg);
  if (!LD.isLadderFormat(lg.format)) falha('failed-precondition', 'Só a escada joga por sessão.');
  if (['finished', 'cancelled', 'draft'].includes(lg.status)) falha('failed-precondition', 'Abra a liga antes de gerar uma sessão.');
  const divisionId = texto(data.divisionId, 128);
  const div = await sub(ctx, lg.id, 'divisions').doc(divisionId).get();
  if (!div.exists) falha('not-found', 'Divisão não encontrada.');
  const [entries, jogos] = await Promise.all([
    sub(ctx, lg.id, 'entries').where('division_id', '==', divisionId).get(),
    sub(ctx, lg.id, 'matches').where('division_id', '==', divisionId).get(),
  ]);
  const inscricoes = entries.docs.map((d) => ({ id: d.id, ...d.data() }));
  const todos = jogos.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  const sessoes = [...new Set(todos.filter((m) => m.phase === 'ladder').map((m) => m.session))].sort((a, b) => a - b);
  const ultima = sessoes[sessoes.length - 1];
  const daUltima = todos.filter((m) => m.phase === 'ladder' && m.session === ultima);
  const fechada = daUltima.length > 0 && daUltima.every((m) => LD.matchWinner(m) != null);
  const comPlacar = daUltima.some((m) => m.status === 'done');
  if (ultima != null && !fechada && comPlacar) falha('failed-precondition', `Lance todos os placares da sessão ${ultima} antes de gerar a próxima.`);
  const refazer = ultima != null && !fechada;
  const numero = refazer ? ultima : (ultima || 0) + 1;
  const base = refazer ? todos.filter((m) => !(m.phase === 'ladder' && m.session === ultima)) : todos;
  const escada = LD.computeLadder(inscricoes, base, lg.standings).order;
  const ativos = new Set(inscricoes.filter((e) => e.status === 'active').map((e) => e.id));
  const pedidos = Array.isArray(data.present) ? new Set(data.present.map((x) => texto(x, 128))) : ativos;
  const presentes = escada.filter((id) => ativos.has(id) && pedidos.has(id));
  const g = LD.buildSessionGroups(lg.format, presentes);
  if (!g.ok) {
    falha('failed-precondition', g.error === 'too_few'
      ? 'Poucos presentes para formar uma quadra.'
      : `Com ${presentes.length} presentes as quadras não fecham: marque mais ou menos presentes.`);
  }
  const novos = LD.sessionMatches(lg.format, g.groups);
  const escritas = [
    ...(refazer ? daUltima.map((m) => (b) => b.delete(m.ref)) : []),
    ...novos.map((m) => (b) => b.set(sub(ctx, lg.id, 'matches').doc(), {
      division_id: divisionId, phase: 'ladder', session: numero, group: m.group, round: m.round,
      team_a: m.team_a, team_b: m.team_b, side_a: null, side_b: null,
      games: [], wo_winner: null, status: 'scheduled', scheduled_date: null, court: '',
      created_at: ts(ctx), updated_at: ts(ctx),
    })),
  ];
  for (let i = 0; i < escritas.length; i += LOTE) {
    const batch = ctx.db.batch();
    escritas.slice(i, i + LOTE).forEach((w) => w(batch));
    await batch.commit();
  }
  const fim = ctx.db.batch();
  if (lg.status === 'open' && data.start === true) fim.update(ref(ctx, lg.id), { status: 'running', updated_at: ts(ctx) });
  const porId = new Map(inscricoes.map((e) => [e.id, e]));
  const link = `/ligas/${lg.id}/rodadas`;
  g.groups.forEach((ids, q) => ids.forEach((id) => (porId.get(id).player_uids || []).forEach((uid) => {
    if (uid !== actor.uid) {
      aviso(ctx, fim, uid, {
        title: tx('Sessão {n} da liga', { n: numero }),
        message: tx('Na liga {liga}, você joga na quadra {q}.', { liga: lg.name, q: q + 1 }),
        link,
      });
    }
  })));
  auditoria(ctx, fim, actor, 'league_session', { league_id: lg.id, division_id: divisionId, session: numero, redo: refazer, present: presentes.length });
  await fim.commit();
  return { session: numero, groups: g.groups.length, matches: novos.length, redo: refazer };
}

async function staff(ctx, actor, data) {
  const lg = await liga(ctx, data.leagueId);
  await exigeGerir(ctx, actor, lg);
  const admins = new Set(lg.admins || []);
  if (data.add) {
    const uid = texto(data.add, 128);
    await atleta(ctx, uid);
    if (admins.size >= MAX_ADMINS) falha('failed-precondition', `No máximo ${MAX_ADMINS} organizadores.`);
    admins.add(uid);
  }
  if (data.remove) {
    if (data.remove === lg.creator_uid) falha('failed-precondition', 'Quem criou a liga não sai da organização.');
    admins.delete(data.remove);
  }
  const m = await membros(ctx, lg.id, { ...lg, admins: [...admins] });
  const ever = [...new Set([...(lg.ever_uids || []), ...admins])];
  const b = ctx.db.batch();
  b.update(ref(ctx, lg.id), { admins: [...admins], member_uids: m.member_uids, ever_uids: ever, updated_at: ts(ctx) });
  auditoria(ctx, b, actor, 'league_staff', { league_id: lg.id, add: data.add || null, remove: data.remove || null });
  await b.commit();
  return { ok: true };
}

const ACOES = {
  create, update, status, division_save: divisionSave, division_remove: divisionRemove,
  register, withdraw, entry_add: entryAdd, schedule, session, result, staff,
};

/** Despacho pela chave PRÓPRIA (`'constructor'` não é ação — docs/47 §1.1). */
async function leagues(ctx, actor, data = {}) {
  const fn = Object.hasOwn(ACOES, data && data.action) ? ACOES[data.action] : undefined;
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  return fn(ctx, actor, data);
}

module.exports = { leagues, ACOES, COL, MAX_ENTRIES, MAX_DIVISIONS };
