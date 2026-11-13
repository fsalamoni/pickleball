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
 * `result`, `report`/`confirm` (na liga flexível, quem joga lança e o outro
 * lado confirma ou contesta), `staff`, `playoff` (a chave e as fases do mata-mata do fim da
 * temporada) e, nas escadas, `session` (a próxima sessão).
 */
const P = require('./leaguePolicy.js');
const LD = require('./leagueLadder.js');
const PO = require('./leaguePlayoff.js');
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
  // Enviar ao DUPR, quando a política deixa a escolha com quem cria (`null` = o padrão).
  if ('dupr_submit' in d) out.dupr_submit = typeof d.dupr_submit === 'boolean' ? d.dupr_submit : null;
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
 * Numa transação: a divisão, a liga e as inscrições ativas são lidas e a
 * inscrição gravada juntas, então duas pessoas disputando a última vaga no
 * mesmo instante não passam do limite (a segunda é refeita e recebe "completa").
 */
async function gravarInscricao(ctx, actor, lgAntes, data, players, { override = false, by = 'self' } = {}) {
  const divRef = sub(ctx, lgAntes.id, 'divisions').doc(texto(data.divisionId, 128));
  return ctx.db.runTransaction(async (trn) => {
    const div = await trn.get(divRef);
    const ligaSnap = await trn.get(ref(ctx, lgAntes.id));
    const todosAtivos = await trn.get(sub(ctx, lgAntes.id, 'entries').where('status', '==', 'active'));
    return gravarNaTransacao(ctx, trn, actor, { ...lgAntes, ...(ligaSnap.data() || {}), id: lgAntes.id }, data, players, { div, todosAtivos, override, by });
  });
}

function gravarNaTransacao(ctx, trn, actor, lg, data, players, { div, todosAtivos, override, by }) {
  if (!div.exists) falha('not-found', 'Divisão não encontrada.');
  const ativos = todosAtivos.docs.filter((e) => e.data().division_id === div.id);
  const max = div.data().max_entries || MAX_ENTRIES;
  if (ativos.length >= max) falha('resource-exhausted', 'A divisão está completa.');
  const jaEstao = new Set(ativos.flatMap((e) => e.data().player_uids || []));
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
  trn.set(entryRef, {
    division_id: div.id, name: nome, auto_name: !texto(data.name, 60), players, player_uids: uids, status: 'active',
    eligibility: { value: elig.value, unrated: elig.unrated, override: !elig.ok || Boolean(montagem) },
    created_by: actor.uid, added_by: by, created_at: ts(ctx),
  });
  // Quem é membro: a organização + todo atleta com inscrição ativa (as lidas
  // aqui) + os de agora — a mesma conta de `membros`, sem nova leitura.
  const membrosUids = new Set([...(lg.admins || []), ...uids]);
  todosAtivos.docs.forEach((e) => (e.data().player_uids || []).forEach((u) => u && membrosUids.add(u)));
  // `ever_uids`: todo atleta que já passou pela liga (a exclusão de conta acha
  // a liga por ele mesmo depois de a pessoa desistir).
  const ever = [...new Set([...(lg.ever_uids || []), ...uids])];
  trn.update(ref(ctx, lg.id), { member_uids: [...membrosUids], ever_uids: ever, entries_count: todosAtivos.size + 1, updated_at: ts(ctx) });
  const link = `/ligas/${lg.id}`;
  players.filter((p) => p.uid && p.uid !== actor.uid).forEach((p) => aviso(ctx, trn, p.uid, {
    title: tx('Você entrou numa liga'),
    message: tx('Você foi inscrito na liga {liga}, divisão {divisao}.', { liga: lg.name, divisao: div.data().name }),
    link,
  }));
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
    await desfazFasesSeguintes(ctx, lg, jogo, b);
    b.update(jogo.ref, { games: [], wo_winner: null, dreambreaker: null, lineups: null, status: 'scheduled', recorded_by: null, recorded_at: null, report: null, dispute: null, updated_at: ts(ctx) });
    if (jogo.data().status === 'reported') await recontaPendencias(ctx, lg, b, { fora: [jogo.id] });
    auditoria(ctx, b, actor, 'league_result_cleared', { league_id: lg.id, match_id: jogo.id });
    await b.commit();
    return { ok: true };
  }
  // Na escada o jogo é de duplas comum; nas equipes, o confronto (`lines` jogos e o DreamBreaker).
  const regras = jogo.data().phase === 'ladder' ? {} : P.resultRules(lg.format);
  const r = P.validateResult({ games: data.games, wo_winner: data.wo_winner, dreambreaker: data.dreambreaker }, regras);
  if (!r.ok) falha('invalid-argument', `Placar inválido (${r.error}).`);
  const patch = { games: r.games, wo_winner: r.wo_winner, dreambreaker: r.dreambreaker, status: 'done', recorded_by: actor.uid, recorded_at: ts(ctx), report: null, dispute: null, updated_at: ts(ctx) };
  // Equipes: quem jogou cada linha (é o que leva a linha ao ranking e ao DUPR).
  if (regras.lines) patch.lineups = r.wo_winner ? null : await escalacoes(ctx, lg, jogo.data(), data.lineups, regras.lines);
  if (P.isIsoDate(data.played_date)) patch.scheduled_date = data.played_date;
  const b = ctx.db.batch();
  await desfazFasesSeguintes(ctx, lg, jogo, b);
  b.update(jogo.ref, patch);
  if (jogo.data().status === 'reported') await recontaPendencias(ctx, lg, b, { fora: [jogo.id] });
  auditoria(ctx, b, actor, 'league_result', { league_id: lg.id, match_id: jogo.id, games: r.games, wo_winner: r.wo_winner, dreambreaker: r.dreambreaker });
  await b.commit();
  return { ok: true };
}

/**
 * A escalação de cada linha do confronto de equipe: `null` (não informada)
 * ou `{ a: [uid, uid], b: [uid, uid] }` com atletas DA equipe de cada lado.
 * Linha sem escalação conta na tabela da liga, não no ranking nem no DUPR.
 */
async function escalacoes(ctx, lg, j, raw, linhas) {
  if (raw == null) return null;
  if (!Array.isArray(raw) || raw.length !== linhas) falha('invalid-argument', 'Escalação inválida.');
  const [ea, eb] = await Promise.all([j.side_a, j.side_b].map((id) => (id ? sub(ctx, lg.id, 'entries').doc(id).get() : null)));
  const daEquipe = (e) => new Set(e && e.exists ? e.data().player_uids || [] : []);
  const A = daEquipe(ea);
  const B = daEquipe(eb);
  const dupla = (lista, equipe) => Array.isArray(lista) && lista.length === 2 && lista[0] !== lista[1]
    && lista.every((u) => typeof u === 'string' && equipe.has(u));
  const out = raw.map((l) => {
    if (l == null) return null;
    if (!dupla(l.a, A) || !dupla(l.b, B)) falha('invalid-argument', 'Na escalação, cada linha leva dois atletas de cada equipe.');
    return { a: l.a.slice(), b: l.b.slice() };
  });
  return out.some(Boolean) ? out : null;
}

/**
 * LIGA FLEXÍVEL: o lado do jogo de quem chama (`'a'`, `'b'` ou `null`),
 * pelas inscrições — só quem está na dupla lança ou confirma.
 */
async function ladoDe(ctx, lg, j, uid) {
  const [ea, eb] = await Promise.all([j.side_a, j.side_b].map((id) => (id ? sub(ctx, lg.id, 'entries').doc(id).get() : null)));
  if (ea && ea.exists && (ea.data().player_uids || []).includes(uid)) return 'a';
  if (eb && eb.exists && (eb.data().player_uids || []).includes(uid)) return 'b';
  return null;
}

async function jogoAutoLancado(ctx, actor, data) {
  const lg = await liga(ctx, data.leagueId);
  if (!(P.FORMATS[lg.format] || {}).self_report) falha('failed-precondition', 'Nesta liga, quem lança o placar é a organização.');
  if (lg.status !== 'running') falha('failed-precondition', 'A liga não está em andamento.');
  const jogo = await sub(ctx, lg.id, 'matches').doc(texto(data.matchId, 128)).get();
  if (!jogo.exists) falha('not-found', 'Jogo não encontrado.');
  const j = jogo.data();
  if (j.phase !== 'season') falha('failed-precondition', 'No playoff, quem lança o placar é a organização.');
  if (PO.matchWinner(j)) falha('failed-precondition', 'Este jogo já tem placar: fale com a organização para corrigir.');
  const lado = await ladoDe(ctx, lg, j, actor.uid);
  if (!lado) falha('permission-denied', 'Só quem joga este jogo lança ou confirma o placar.');
  return { lg, jogo, j, lado };
}

/** Os uids de um lado do jogo (pela inscrição). */
async function uidsDoLado(ctx, lg, j, side) {
  const e = await sub(ctx, lg.id, 'entries').doc(j[`side_${side}`]).get();
  return e.exists ? e.data().player_uids || [] : [];
}

/**
 * `pending_confirm` da liga: quantos placares cada conta tem a confirmar
 * (é o que a Minha área mostra). Refeito a cada mudança — os jogos "a
 * confirmar" do banco, sem os que esta operação mexe (`fora`), mais os que
 * ela deixa a confirmar (`novos`: listas de uids).
 */
async function recontaPendencias(ctx, lg, batch, { fora = [], novos = [] } = {}) {
  if (!(P.FORMATS[lg.format] || {}).self_report) return;
  const tirar = new Set(fora);
  const snap = await sub(ctx, lg.id, 'matches').where('status', '==', 'reported').get();
  const listas = snap.docs.filter((d) => !tirar.has(d.id)).map((d) => (d.data().report || {}).confirm_uids || []).concat(novos);
  const mapa = {};
  listas.forEach((uids) => uids.forEach((u) => { mapa[u] = (mapa[u] || 0) + 1; }));
  batch.update(ref(ctx, lg.id), { pending_confirm: mapa });
}

async function avisaLado(ctx, batch, lg, j, side, msg) {
  const e = await sub(ctx, lg.id, 'entries').doc(j[`side_${side}`]).get();
  (e.exists ? e.data().player_uids || [] : []).forEach((uid) => aviso(ctx, batch, uid, msg));
}

/**
 * LIGA FLEXÍVEL: um lado lança o placar (`report`, nunca W.O. — esse é da
 * organização). O jogo fica "a confirmar" e o outro lado é avisado. Quem lançou
 * pode corrigir enquanto o outro não responde; depois de contestado, qualquer
 * lado lança de novo.
 */
async function report(ctx, actor, data) {
  const { lg, jogo, j, lado } = await jogoAutoLancado(ctx, actor, data);
  if (j.status === 'reported' && j.report && j.report.side !== lado) falha('failed-precondition', 'O outro lado já lançou o placar: confirme ou conteste.');
  const r = P.validateResult({ games: data.games, dreambreaker: data.dreambreaker }, P.resultRules(lg.format));
  if (!r.ok) falha('invalid-argument', `Placar inválido (${r.error}).`);
  const outro = lado === 'a' ? 'b' : 'a';
  const confirmam = await uidsDoLado(ctx, lg, j, outro);
  const b = ctx.db.batch();
  b.update(jogo.ref, {
    status: 'reported', dispute: null,
    report: { games: r.games, dreambreaker: r.dreambreaker, side: lado, by: actor.uid, played_date: P.isIsoDate(data.played_date) ? data.played_date : null, at: ts(ctx), at_ms: ctx.now, confirm_uids: confirmam },
    updated_at: ts(ctx),
  });
  await recontaPendencias(ctx, lg, b, { fora: [jogo.id], novos: [confirmam] });
  await avisaLado(ctx, b, lg, j, outro, {
    title: tx('Confirme o placar'),
    message: tx('O outro lado lançou o placar do seu jogo na liga {liga}. Confirme ou conteste; sem resposta em {n} horas, ele vale.', { liga: lg.name, n: P.AUTO_CONFIRM_HOURS }),
    link: `/ligas/${lg.id}/rodadas`,
  });
  auditoria(ctx, b, actor, 'league_result_reported', { league_id: lg.id, match_id: jogo.id, games: r.games, side: lado });
  await b.commit();
  return { ok: true };
}

/**
 * LIGA FLEXÍVEL: o OUTRO lado confirma (o placar vale, como se a organização o
 * lançasse) ou contesta com o motivo (a organização é avisada e decide pelo
 * `result`, que sempre vence).
 */
/** O placar lançado passa a valer (confirmado pelo outro lado ou pelo prazo: `por` nulo). */
function valeOLancado(ctx, b, lg, jogo, j, por) {
  b.update(jogo.ref, {
    games: j.report.games, dreambreaker: j.report.dreambreaker || null, wo_winner: null, status: 'done',
    ...(j.report.played_date ? { scheduled_date: j.report.played_date } : {}),
    recorded_by: j.report.by, confirmed_by: por, auto_confirmed: !por, recorded_at: ts(ctx), report: null, dispute: null, updated_at: ts(ctx),
  });
}

async function confirm(ctx, actor, data) {
  const { lg, jogo, j, lado } = await jogoAutoLancado(ctx, actor, data);
  if (j.status !== 'reported' || !j.report) falha('failed-precondition', 'Não há placar a confirmar neste jogo.');
  if (j.report.side === lado) falha('failed-precondition', 'Quem confirma é o outro lado do jogo.');
  const b = ctx.db.batch();
  await recontaPendencias(ctx, lg, b, { fora: [jogo.id] });
  if (data.accept === true) {
    valeOLancado(ctx, b, lg, jogo, j, actor.uid);
    aviso(ctx, b, j.report.by, { title: tx('Placar confirmado'), message: tx('O placar que você lançou na liga {liga} foi confirmado.', { liga: lg.name }), link: `/ligas/${lg.id}/classificacao` });
    auditoria(ctx, b, actor, 'league_result_confirmed', { league_id: lg.id, match_id: jogo.id, games: j.report.games });
  } else {
    const motivo = texto(data.reason, 300);
    if (motivo.length < 3) falha('invalid-argument', 'Diga o que está errado no placar.');
    b.update(jogo.ref, { status: 'disputed', dispute: { by: actor.uid, side: lado, reason: motivo, at: ts(ctx) }, updated_at: ts(ctx) });
    const gestores = new Set([...(lg.admins || []), j.report.by]);
    gestores.forEach((uid) => aviso(ctx, b, uid, {
      title: tx('Placar contestado'),
      message: tx('Um placar da liga {liga} foi contestado: {motivo}', { liga: lg.name, motivo }),
      link: `/ligas/${lg.id}/rodadas`,
    }));
    auditoria(ctx, b, actor, 'league_result_disputed', { league_id: lg.id, match_id: jogo.id, reason: motivo });
  }
  await b.commit();
  return { ok: true };
}

/**
 * PLAYOFF: mudar o placar de uma fase muda quem avança. A fase seguinte ainda
 * sem placar é APAGADA (sai de novo, com os vencedores certos); com placar,
 * a mudança é recusada — apague antes o placar da fase seguinte.
 */
async function desfazFasesSeguintes(ctx, lg, jogo, batch) {
  const j = jogo.data();
  if (j.phase !== 'playoff') return;
  const doPlayoff = await sub(ctx, lg.id, 'matches').where('division_id', '==', j.division_id).where('phase', '==', 'playoff').get();
  const depois = doPlayoff.docs.filter((d) => (Number(d.data().round) || 0) > (Number(j.round) || 0));
  if (depois.some((d) => PO.matchWinner(d.data()))) {
    falha('failed-precondition', 'A fase seguinte do playoff já tem placar: apague-o antes de mudar este.');
  }
  depois.forEach((d) => batch.delete(d.ref));
}

/**
 * PLAYOFF (mata-mata do fim da temporada), divisão a divisão. Sem chave: monta
 * a 1ª fase com `seeds` (as inscrições ATIVAS da divisão na ordem da tabela —
 * a tela manda a classificação que mostra; quem organiza responde por ela e a
 * ordem vai para a auditoria). Com a fase fechada: gera a próxima com os
 * vencedores (e a disputa do 3º lugar antes da final, se ligada). `reseed`
 * refaz a chave enquanto nenhum jogo dela tem placar.
 */
async function playoff(ctx, actor, data) {
  const lg = await liga(ctx, data.leagueId);
  await exigeGerir(ctx, actor, lg);
  if (lg.status !== 'running') falha('failed-precondition', 'O playoff é da liga em andamento.');
  if (LD.isLadderFormat(lg.format)) falha('failed-precondition', 'A escada não tem playoff.');
  const season = P.normalizeSeason(lg.season);
  if (!season.playoff.enabled) falha('failed-precondition', 'Ligue o playoff na temporada antes.');
  const divisionId = texto(data.divisionId, 128);
  const [entries, jogos] = await Promise.all([
    sub(ctx, lg.id, 'entries').where('division_id', '==', divisionId).where('status', '==', 'active').get(),
    sub(ctx, lg.id, 'matches').where('division_id', '==', divisionId).where('phase', '==', 'playoff').get(),
  ]);
  const atuais = jogos.docs.map((d) => ({ ...d.data(), ref: d.ref }));
  let novos;
  let apagar = [];
  if (!atuais.length || data.reseed === true) {
    if (atuais.some((m) => PO.matchWinner(m))) falha('failed-precondition', 'O playoff já tem placar: a chave não é refeita.');
    const ativos = new Set(entries.docs.map((d) => d.id));
    const seeds = [...new Set((Array.isArray(data.seeds) ? data.seeds : []).map((s) => texto(s, 128)))];
    if (seeds.some((s) => !ativos.has(s))) falha('invalid-argument', 'A chave tem uma inscrição que não está ativa nesta divisão.');
    novos = PO.playoffFirstRound(seeds, season.playoff.size);
    if (!novos.length) falha('failed-precondition', 'O playoff precisa de pelo menos 2 inscrições.');
    apagar = atuais;
  } else {
    const st = PO.playoffState(atuais, { thirdPlace: season.playoff.third_place });
    if (st.stage === 'playing') falha('failed-precondition', 'Termine os jogos desta fase antes de gerar a próxima.');
    if (st.stage === 'done') falha('failed-precondition', 'O playoff desta divisão já terminou.');
    novos = st.next;
  }
  const b = ctx.db.batch();
  apagar.forEach((m) => b.delete(m.ref));
  novos.forEach((m) => b.set(sub(ctx, lg.id, 'matches').doc(), {
    division_id: divisionId, phase: 'playoff', round: m.round, slot: m.slot, third: m.third === true,
    ...(m.seed_a ? { seed_a: m.seed_a, seed_b: m.seed_b } : {}),
    side_a: m.side_a, side_b: m.side_b, games: [], wo_winner: null, dreambreaker: null,
    status: 'scheduled', scheduled_date: null, court: '', created_at: ts(ctx), updated_at: ts(ctx),
  }));
  const porId = new Map(entries.docs.map((d) => [d.id, d.data()]));
  const link = `/ligas/${lg.id}/playoff`;
  const avisados = new Set();
  novos.flatMap((m) => [m.side_a, m.side_b]).flatMap((id) => porId.get(id)?.player_uids || []).forEach((uid) => {
    if (avisados.has(uid)) return;
    avisados.add(uid);
    aviso(ctx, b, uid, {
      title: tx('Você está no playoff'),
      message: tx('Saiu o seu próximo jogo do playoff da liga {liga}.', { liga: lg.name }),
      link,
    });
  });
  auditoria(ctx, b, actor, 'league_playoff', {
    league_id: lg.id, division_id: divisionId, round: novos[0].round, matches: novos.length,
    ...(novos[0].round === 1 ? { seeds: novos.flatMap((m) => [m.side_a, m.side_b]) } : {}),
  });
  await b.commit();
  return { matches: novos.length, round: novos[0].round };
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
  register, withdraw, entry_add: entryAdd, schedule, session, result, report, confirm, staff, playoff,
};

/** Despacho pela chave PRÓPRIA (`'constructor'` não é ação — docs/47 §1.1). */
async function leagues(ctx, actor, data = {}) {
  const fn = Object.hasOwn(ACOES, data && data.action) ? ACOES[data.action] : undefined;
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  return fn(ctx, actor, data);
}

/**
 * Varredura (`leagueAutoConfirmWorker`): na liga flexível em andamento, o
 * placar lançado sem resposta em `AUTO_CONFIRM_HOURS` passa a valer — como se
 * o outro lado confirmasse. Os dois lados são avisados. Devolve quantos valeram.
 */
async function runAutoConfirm(ctx) {
  const limite = ctx.now - P.AUTO_CONFIRM_HOURS * 3600 * 1000;
  const ligas = await ctx.db.collection(COL).where('status', '==', 'running').get();
  let total = 0;
  for (const l of ligas.docs) {
    const lg = { id: l.id, ...l.data() };
    if (!(P.FORMATS[lg.format] || {}).self_report) continue;
    const snap = await sub(ctx, lg.id, 'matches').where('status', '==', 'reported').get();
    const vencidos = snap.docs.filter((d) => {
      const r = d.data().report;
      return r && Number.isFinite(r.at_ms) && r.at_ms <= limite;
    }).slice(0, 100);
    if (!vencidos.length) continue;
    const b = ctx.db.batch();
    for (const d of vencidos) {
      const j = d.data();
      valeOLancado(ctx, b, lg, d, j, null);
      const msg = {
        title: tx('Placar valeu'),
        message: tx('Sem resposta em {n} horas, o placar lançado do seu jogo na liga {liga} passou a valer.', { n: P.AUTO_CONFIRM_HOURS, liga: lg.name }),
        link: `/ligas/${lg.id}/classificacao`,
      };
      aviso(ctx, b, j.report.by, msg);
      (j.report.confirm_uids || []).forEach((u) => aviso(ctx, b, u, msg));
      auditoria(ctx, b, { uid: 'system', name: 'Sistema' }, 'league_result_auto_confirmed', { league_id: lg.id, match_id: d.id, games: j.report.games });
    }
    await recontaPendencias(ctx, lg, b, { fora: vencidos.map((d) => d.id) });
    await b.commit();
    total += vencidos.length;
  }
  return total;
}

module.exports = { leagues, runAutoConfirm, ACOES, COL, MAX_ENTRIES, MAX_DIVISIONS };
