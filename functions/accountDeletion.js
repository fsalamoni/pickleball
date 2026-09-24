/**
 * EXCLUSÃO DE CADASTRO pelo admin da plataforma — no servidor.
 *
 * O pedido: *"há muitos cadastros de exemplo e mock que foram criados e quero
 * poder excluí-los"*.
 *
 * ## Por que no servidor
 *
 * 1. **Conta de teste é conta de verdade.** Todo `users/{uid}` nasce do login
 *    (a regra só deixa o titular criar o próprio documento). Apagar os
 *    documentos e deixar a conta do Firebase Authentication faz o cadastro
 *    VOLTAR no próximo login — `FirebaseAuthContext` recria o perfil e o
 *    espelho público sozinho. Só o Admin SDK apaga a conta de login.
 * 2. **O admin não alcança tudo pelo navegador.** Tokens de push, favoritos,
 *    votos, conversas e as fotos no Storage são do titular pelas regras — e
 *    devem continuar sendo. A exclusão precisa de privilégio de servidor, e só
 *    para isto.
 * 3. **Uma cascata não pode depender de uma aba aberta.** Se o navegador do
 *    admin fechar no meio, metade apagada é o pior resultado possível.
 *
 * ## O que acontece com cada coisa
 *
 * Segue o desenho aprovado em `docs/20-SEGURANCA-E-PRIVACIDADE/09` §4 e `11`:
 *
 * | Destino | O quê |
 * |---|---|
 * | **Apagado** | identidade (`users`, `athlete_profiles`), conta de login, fotos, tokens, notificações, favoritos, seguidores, vínculos (clube, arena, torneio, circuito), pedidos e convites, filas, gamificação pessoal, ratings materializados |
 * | **Pseudonimizado** | histórico esportivo e o que é de outras pessoas: inscrições, partidas, dias de jogo, conversas, fórum, avaliações. O uid fica; nome e foto viram "Atleta removido" / "Usuário removido" |
 * | **Retido** | auditoria, consentimentos, reservas e pagamentos (obrigação do parceiro) — com o nome minimizado |
 * | **Impede a exclusão** | ser dono de arena, rede, clube (único admin), organizador de torneio em andamento, criador de dia de jogo ativo, ter saldo em carteira |
 *
 * ## As travas
 *
 * - **Prévia antes de executar.** O modo `preview` só LÊ e devolve o
 *   relatório; o `execute` recalcula tudo de novo no servidor — nunca confia
 *   num plano que venha do navegador.
 * - **Limite por execução** (25 contas; 400 documentos por consulta).
 * - **Ordem que tolera falha**: primeiro a conta de login (sem ela o cadastro
 *   não volta), por último `users/{uid}` (enquanto ele existe o admin ainda
 *   vê a conta na lista e pode rodar de novo). Rodar duas vezes é seguro.
 * - **Nunca**: a própria conta, conta com poder de admin, e-mail de dono.
 * - **Só o dono da plataforma executa** — como a revogação de poderes. Há um
 *   achado aberto de admins extras (`16-ACHADO-ADMINS-EXTRAS.md`), e excluir é
 *   mais destrutivo que revogar.
 */

/* ------------------------------------------------------------ constantes */

/**
 * E-mails de dono. CÓPIA de `src/core/config/owners.js` — o pacote de
 * Functions é publicado isolado e não enxerga `src/`. Há teste lendo os dois
 * arquivos e exigindo a mesma lista.
 */
const OWNER_EMAILS = Object.freeze(['fsalamoni@gmail.com']);

const DELETION_BATCH_MAX = 25;
const DELETION_REASON_MIN = 5;
/** Quantos documentos cada consulta traz. Acima disso, o relatório avisa. */
const QUERY_LIMIT = 400;
const REMOVED_ATHLETE = 'Atleta removido';
const REMOVED_USER = 'Usuário removido';
const REMOVED_MESSAGE = 'Mensagem removida';

const lower = (v) => String(v || '').trim().toLowerCase();
const texto = (v) => String(v == null ? '' : v).trim();

/* ------------------------------------------------------- quem pode ------ */

function isOwnerEmail(email) {
  const e = lower(email);
  return Boolean(e) && OWNER_EMAILS.map(lower).includes(e);
}

/**
 * Esta conta pode ser excluída? Mesmas três portas da tela, conferidas de
 * novo aqui — a tela só evita o clique inútil.
 */
function targetBlockedReason(target, { actorUid = null } = {}) {
  const uid = texto(target && (target.uid || target.id));
  if (!uid) return 'Cadastro sem identificador.';
  if (actorUid && uid === actorUid) return 'Você não pode excluir a própria conta por aqui.';
  if (isOwnerEmail(target && target.email)) return 'Conta de dono da plataforma. Não pode ser excluída.';
  if (target && target.role === 'platform_admin') {
    return 'Conta com poder de admin. Tire o poder em Governança → Acessos antes.';
  }
  return '';
}

/** Valida o pedido que chegou do navegador. */
function validateRequest(data = {}) {
  const mode = data.mode === 'execute' ? 'execute' : 'preview';
  const uids = [...new Set((Array.isArray(data.uids) ? data.uids : [])
    .map((u) => texto(u)).filter(Boolean))];
  if (uids.length === 0) return { error: 'Escolha ao menos um cadastro.' };
  if (uids.length > DELETION_BATCH_MAX) return { error: `No máximo ${DELETION_BATCH_MAX} cadastros por vez.` };
  const reason = texto(data.reason);
  if (mode === 'execute' && reason.length < DELETION_REASON_MIN) {
    return { error: `Descreva o motivo (mínimo ${DELETION_REASON_MIN} caracteres).` };
  }
  if (mode === 'execute' && texto(data.confirm).toUpperCase() !== 'EXCLUIR') {
    return { error: 'Digite EXCLUIR para confirmar.' };
  }
  return { mode, uids, reason };
}

/* ------------------------------------------------------ o que APAGAR ---- */

/** Documentos cujo ID é o próprio uid. */
const DELETE_BY_ID = Object.freeze([
  { col: 'athlete_profiles', label: 'Perfil público no diretório' },
  { col: 'player_ratings', label: 'Rating ELO' },
  { col: 'rating_history', label: 'Histórico de rating ELO' },
  { col: 'player_skill_ratings', label: 'Rating 2.0–8.0' },
  { col: 'skill_rating_history', label: 'Histórico de rating 2.0–8.0' },
  { col: 'user_progression_v2', label: 'Progressão (gamificação)' },
  { col: 'user_streak_meta', label: 'Sequência de dias (gamificação)' },
  { col: 'user_referral_codes', label: 'Código de convite' },
  { col: 'user_referrals', label: 'Registro de quem convidou' },
  { col: 'user_kudos_index', label: 'Índice de kudos' },
  { col: 'coaches', label: 'Perfil de professor' },
  { col: 'coach_availability', label: 'Disponibilidade de professor' },
]);

/**
 * Documentos achados por UM `where` (sem índice composto) e apagados.
 * `docIdPrefix` diz que o id começa com o uid — usado só para conferência.
 */
const DELETE_BY_QUERY = Object.freeze([
  { col: 'push_tokens', field: 'user_id', label: 'Aparelhos para notificação' },
  { col: 'notifications', field: 'user_id', label: 'Notificações' },
  { col: 'arena_favorites', field: 'user_id', label: 'Arenas favoritas' },
  { col: 'coach_favorites', field: 'user_id', label: 'Professores favoritos' },
  { col: 'coach_favorites', field: 'coach_id', label: 'Favoritos em que é o professor' },
  { col: 'follows', field: 'follower_uid', label: 'Quem segue' },
  { col: 'follows', field: 'target_uid', label: 'Quem o segue' },
  { col: 'player_goals', field: 'uid', label: 'Metas pessoais' },
  { col: 'user_missions', field: 'uid', label: 'Missões (gamificação)' },
  { col: 'user_achievements_v2', field: 'uid', label: 'Conquistas (gamificação)' },
  { col: 'season_rankings', field: 'uid', label: 'Ranking da temporada' },
  { col: 'crew_members', field: 'uid', label: 'Participação em crews', counter: { col: 'crews', idField: 'crewId', field: 'membersCount' } },
  { col: 'club_members', field: 'user_id', label: 'Participação em clubes', counter: { col: 'clubs', idField: 'club_id', field: 'member_count' } },
  { col: 'club_join_requests', field: 'user_id', label: 'Pedidos para entrar em clube' },
  { col: 'club_member_invites', field: 'user_id', label: 'Convites de clube' },
  { col: 'event_invites', field: 'user_id', label: 'Convites de evento' },
  { col: 'club_event_rsvps', field: 'user_id', label: 'Presenças em evento de clube' },
  { col: 'tournament_admins', field: 'user_id', label: 'Administração de torneio' },
  { col: 'arena_managers', field: 'user_id', label: 'Gestão de arena' },
  { col: 'circuit_admins', field: 'user_id', label: 'Administração de circuito' },
  { col: 'booking_waitlist', field: 'user_id', label: 'Filas de espera de reserva' },
  { col: 'arena_waitlist', field: 'athlete_id', label: 'Filas de espera de jogo aberto' },
  { col: 'arena_members', field: 'user_id', label: 'Associação a arenas (pontos e nível)' },
  { col: 'arena_nps_responses', field: 'user_id', label: 'Respostas de satisfação' },
  { col: 'coach_arenas', field: 'coach_id', label: 'Parcerias de professor com arena' },
]);

/* --------------------------------------------- o que IMPEDE a exclusão -- */

/**
 * Torneio nesses estados está VIVO: há gente inscrita esperando por ele.
 * Rascunho não entra — ninguém depende de um rascunho, e a conta de teste que
 * deixou um rascunho para trás não pode ficar impossível de excluir.
 */
const TOURNAMENT_LIVE = Object.freeze(['registrations_open', 'registrations_closed', 'in_progress']);

/**
 * O que IMPEDE a exclusão — puro.
 *
 * A pergunta é sempre a mesma: *excluir esta conta quebra o serviço de outra
 * pessoa?* (`09-DIREITOS-DO-TITULAR.md` §4, "exclusão de gestor de arena /
 * professor / organizador"). Se sim, o admin resolve antes — transfere ou
 * exclui a arena, o clube, o torneio — e só então exclui a conta.
 *
 * @param {{ arenas?:object[], networks?:object[], clubAdminships?:Array<{club_id:string,club_name?:string,otherAdmins:number}>,
 *           tournaments?:object[], gameDays?:object[], wallets?:object[] }} found
 * @param {string} uid
 * @param {string} hojeISO  AAAA-MM-DD
 * @returns {Array<{ label:string, detail?:string }>}
 */
function evaluateBlockers(found = {}, uid, hojeISO) {
  const out = [];
  (found.arenas || []).forEach((a) => {
    out.push({ label: `Dona da arena "${texto(a.name) || a.id}"`, detail: 'Transfira a arena para outra conta ou exclua a arena antes.' });
  });
  (found.networks || []).forEach((n) => {
    out.push({ label: `Dona da rede de arenas "${texto(n.name) || n.id}"`, detail: 'Exclua a rede antes.' });
  });
  (found.clubAdminships || []).forEach((c) => {
    if ((Number(c.otherAdmins) || 0) > 0) return;
    out.push({ label: `Única administradora do clube "${texto(c.club_name) || c.club_id}"`, detail: 'Nomeie outro admin no clube ou exclua o clube antes.' });
  });
  (found.tournaments || []).forEach((t) => {
    if (!TOURNAMENT_LIVE.includes(t.status)) return;
    out.push({ label: `Organiza o torneio "${texto(t.name) || t.id}", ainda em andamento`, detail: 'Encerre, cancele ou exclua o torneio antes.' });
  });
  (found.gameDays || []).forEach((g) => {
    if (g.status !== 'active') return;
    if (!g.date || String(g.date) < String(hojeISO)) return; // dia que já passou não prende ninguém
    const outros = (g.member_uids || []).filter((m) => m && m !== uid);
    if (outros.length === 0) return;
    out.push({ label: `Criou o dia de jogo "${texto(g.title || g.name) || g.id}", marcado para ${g.date}, com ${outros.length} inscrito(s)`, detail: 'Arquive ou exclua o dia de jogo antes.' });
  });
  (found.wallets || []).forEach((w) => {
    const saldo = Number(w.balance) || 0;
    if (saldo <= 0) return;
    out.push({ label: `Tem saldo de R$ ${saldo.toFixed(2).replace('.', ',')} na carteira de uma arena`, detail: 'O saldo é da pessoa. Resolva com a arena antes de excluir.' });
  });
  return out;
}

/* ------------------------------------------------ pseudonimização ------ */

/**
 * Troca, num objeto, os campos de nome/foto/contato que pertencem a `uid`.
 * Pura: devolve o patch (ou `null` quando nada muda).
 *
 * `specs` é uma lista de `{ idField, name?, photo?, email?, phone? }`: se
 * `data[idField] === uid`, os campos listados são trocados. É o formato de
 * inscrição de dupla (`player_a_user_id` + `player_a_name`…).
 */
function patchFlatFields(data, uid, specs, label = REMOVED_ATHLETE) {
  const patch = {};
  (specs || []).forEach((s) => {
    if (!data || data[s.idField] !== uid) return;
    (s.name || []).forEach((f) => { if (f in data && data[f] !== label) patch[f] = label; });
    (s.clear || []).forEach((f) => { if (f in data && data[f] != null && data[f] !== '') patch[f] = null; });
  });
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Troca, dentro de um vetor de objetos, os itens que são de `uid`.
 * Devolve o vetor novo, ou `null` quando nada mudou.
 */
function patchArrayItems(arr, uid, { idKeys = ['uid', 'user_id', 'id'], name = [], clear = [], label = REMOVED_ATHLETE } = {}) {
  if (!Array.isArray(arr)) return null;
  let mudou = false;
  const novo = arr.map((item) => {
    if (!item || typeof item !== 'object') return item;
    if (!idKeys.some((k) => item[k] === uid)) return item;
    const copia = { ...item };
    name.forEach((f) => { if (f in copia && copia[f] !== label) { copia[f] = label; mudou = true; } });
    clear.forEach((f) => { if (f in copia && copia[f] != null && copia[f] !== '') { copia[f] = null; mudou = true; } });
    return copia;
  });
  return mudou ? novo : null;
}

/**
 * Nomes em vetor PARALELO a um vetor de ids (`player_names[i]` é de
 * `player_ids[i]`). Devolve o vetor novo ou `null`.
 */
function patchParallelNames(ids, names, uid, label = REMOVED_ATHLETE) {
  if (!Array.isArray(ids) || !Array.isArray(names)) return null;
  let mudou = false;
  const novo = names.map((n, i) => {
    if (ids[i] === uid && n !== label) { mudou = true; return label; }
    return n;
  });
  return mudou ? novo : null;
}

/* ----------------------------------------------------- o relatório ----- */

/**
 * Monta o relatório de UMA conta a partir do que foi encontrado. Pura.
 *
 * @param {{ uid:string, user:object|null, actorUid?:string,
 *           deletes:Array<{label:string,count:number,truncated?:boolean}>,
 *           pseudonyms:Array<{label:string,count:number,truncated?:boolean}>,
 *           retained:Array<{label:string,count:number}>,
 *           blockers:Array<{label:string,detail?:string}>,
 *           authExists?:boolean, storageFiles?:number }} f
 */
function buildReport(f) {
  const user = f.user || null;
  const blockedBy = targetBlockedReason({ ...(user || {}), uid: f.uid }, { actorUid: f.actorUid });
  const blockers = [...(blockedBy ? [{ label: blockedBy }] : []), ...(f.blockers || [])];
  const soma = (xs) => (xs || []).reduce((s, x) => s + (Number(x.count) || 0), 0);
  const deletes = (f.deletes || []).filter((x) => x.count > 0);
  const pseudonyms = (f.pseudonyms || []).filter((x) => x.count > 0);
  const retained = (f.retained || []).filter((x) => x.count > 0);
  return {
    uid: f.uid,
    name: texto(user && (user.full_name || user.display_name || user.name)) || '(sem nome)',
    email: texto(user && user.email),
    exists: Boolean(user),
    authExists: f.authExists !== false,
    storageFiles: Number(f.storageFiles) || 0,
    blockers,
    canDelete: blockers.length === 0,
    deletes,
    pseudonyms,
    retained,
    totals: {
      apagar: soma(deletes) + (user ? 1 : 0),
      pseudonimizar: soma(pseudonyms),
      reter: soma(retained),
    },
    truncated: [...deletes, ...pseudonyms].some((x) => x.truncated),
  };
}

/* =================================================== leitura e gravação == */

/**
 * O que é PSEUDONIMIZADO (o uid fica, o nome sai) ou RETIDO com o nome
 * minimizado. Cada item: `{ col, wheres:[[campo, op]], bucket, label, patch }`
 * ou, para subcoleções, `{ parent, parentWheres, sub, subWheres?, … }`.
 * `patch(data, uid)` é puro e devolve o que trocar (ou `null`).
 *
 * Preenchido abaixo, a partir do formato REAL de cada coleção.
 */
const PSEUDO_SPECS = [];

/** Uma consulta de um `where` só, com limite. */
async function consultar(db, col, field, op, uid) {
  const snap = await db.collection(col).where(field, op, uid).limit(QUERY_LIMIT + 1).get();
  return { docs: snap.docs.slice(0, QUERY_LIMIT), truncated: snap.size > QUERY_LIMIT };
}

/** Várias consultas sobre a mesma coleção, sem repetir documento. */
async function consultarUniao(db, col, wheres, uid) {
  const vistos = new Map();
  let truncated = false;
  for (const [field, op] of wheres) {
    // eslint-disable-next-line no-await-in-loop
    const r = await consultar(db, col, field, op, uid);
    truncated = truncated || r.truncated;
    r.docs.forEach((d) => { if (!vistos.has(d.ref.path)) vistos.set(d.ref.path, d); });
  }
  return { docs: [...vistos.values()], truncated };
}

/** Coleta as trocas de UMA especificação de pseudonimização. */
async function coletarTrocas(db, uid, spec) {
  const itens = [];
  let truncated = false;
  const aplicar = (d) => {
    const patch = spec.patch(d.data() || {}, uid);
    if (patch) itens.push({ ref: d.ref, patch });
  };
  if (spec.parent) {
    const pais = await consultarUniao(db, spec.parent, spec.parentWheres, uid);
    truncated = pais.truncated;
    for (const pai of pais.docs) {
      let q = pai.ref.collection(spec.sub);
      if (spec.subWheres && spec.subWheres.length === 1) {
        const [f, op] = spec.subWheres[0];
        q = q.where(f, op, uid);
      }
      // eslint-disable-next-line no-await-in-loop
      const snap = await q.limit(QUERY_LIMIT + 1).get();
      if (snap.size > QUERY_LIMIT) truncated = true;
      snap.docs.slice(0, QUERY_LIMIT).forEach(aplicar);
    }
  } else {
    const r = await consultarUniao(db, spec.col, spec.wheres, uid);
    truncated = r.truncated;
    r.docs.forEach(aplicar);
  }
  return { label: spec.label, bucket: spec.bucket || 'pseudonym', itens, truncated };
}

/** A conta de login existe? `null` quando não deu para saber. */
async function contaDeLoginExiste(auth, uid) {
  try {
    await auth.getUser(uid);
    return true;
  } catch (err) {
    if (err && err.code === 'auth/user-not-found') return false;
    return null;
  }
}

/** Quantos arquivos a pessoa tem no Storage (`uploads/{uid}/…`). */
async function contarArquivos(bucket, uid) {
  if (!bucket) return 0;
  try {
    const [files] = await bucket.getFiles({ prefix: `uploads/${uid}/`, maxResults: 1000 });
    return files.length;
  } catch (_) {
    return 0;
  }
}

/** Busca o que pode IMPEDIR a exclusão. */
async function buscarImpedimentos(db, uid, hojeISO) {
  const docs = async (col, field) => (await consultar(db, col, field, '==', uid)).docs
    .map((d) => ({ id: d.id, ...d.data() }));

  const [arenas, networks, tournaments, gameDays, wallets, clubes] = await Promise.all([
    docs('arenas', 'owner_id'),
    docs('arena_networks', 'owner_id'),
    docs('tournaments', 'creator_uid'),
    docs('game_days', 'created_by'),
    docs('arena_wallets', 'user_id'),
    docs('club_members', 'user_id'),
  ]);

  const clubAdminships = [];
  for (const m of clubes.filter((c) => c.role === 'admin' && c.club_id)) {
    // eslint-disable-next-line no-await-in-loop
    const outros = await db.collection('club_members').where('club_id', '==', m.club_id).limit(200).get();
    // eslint-disable-next-line no-await-in-loop
    const clube = await db.collection('clubs').doc(m.club_id).get();
    if (!clube.exists) continue; // clube que já não existe não prende ninguém
    clubAdminships.push({
      club_id: m.club_id,
      club_name: clube.data().name,
      otherAdmins: outros.docs.filter((d) => d.data().role === 'admin' && d.data().user_id !== uid).length,
    });
  }

  return evaluateBlockers({ arenas, networks, clubAdminships, tournaments, gameDays, wallets }, uid, hojeISO);
}

/**
 * Analisa UMA conta: o relatório para a tela e o plano para a execução.
 * Só LÊ. É o modo prévia — e a execução chama esta mesma função de novo,
 * para nunca agir sobre um plano que veio de fora.
 */
async function analyzeAccount(ctx, uid, { actorUid = null, hojeISO } = {}) {
  const { db, auth, bucket } = ctx;
  const userSnap = await db.collection('users').doc(uid).get();
  const user = userSnap.exists ? userSnap.data() : null;

  const [authExists, storageFiles, blockers] = await Promise.all([
    auth ? contaDeLoginExiste(auth, uid) : Promise.resolve(null),
    contarArquivos(bucket, uid),
    buscarImpedimentos(db, uid, hojeISO),
  ]);

  // Apagar por id
  const porId = [];
  for (const spec of DELETE_BY_ID) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection(spec.col).doc(uid).get();
    porId.push({ spec, ref: snap.ref, exists: snap.exists });
  }

  // Apagar por consulta (e os contadores dos pais)
  const porConsulta = [];
  for (const spec of DELETE_BY_QUERY) {
    // eslint-disable-next-line no-await-in-loop
    const r = await consultar(db, spec.col, spec.field, '==', uid);
    const contadores = [];
    if (spec.counter) {
      for (const d of r.docs) {
        const paiId = d.data()[spec.counter.idField];
        if (!paiId) continue;
        // eslint-disable-next-line no-await-in-loop
        const pai = await db.collection(spec.counter.col).doc(String(paiId)).get();
        // Contador de pai que não existe não é mexido: `update` num documento
        // ausente derrubaria o lote inteiro.
        if (pai.exists) contadores.push({ ref: pai.ref, field: spec.counter.field });
      }
    }
    porConsulta.push({ spec, refs: r.docs.map((d) => d.ref), truncated: r.truncated, contadores });
  }

  // Pseudonimizar / reter
  const trocas = [];
  for (const spec of (ctx.pseudoSpecs || PSEUDO_SPECS)) {
    // eslint-disable-next-line no-await-in-loop
    trocas.push(await coletarTrocas(db, uid, spec));
  }

  // Por rótulo: duas especificações com o mesmo rótulo (seguidores e
  // seguidos, por exemplo) viram uma linha só no relatório.
  const somarPorRotulo = (linhas) => {
    const m = new Map();
    linhas.forEach((l) => {
      const atual = m.get(l.label) || { label: l.label, count: 0, truncated: false };
      atual.count += l.count;
      atual.truncated = atual.truncated || Boolean(l.truncated);
      m.set(l.label, atual);
    });
    return [...m.values()];
  };

  const deletes = somarPorRotulo([
    ...porId.map((x) => ({ label: x.spec.label, count: x.exists ? 1 : 0 })),
    ...porConsulta.map((x) => ({ label: x.spec.label, count: x.refs.length, truncated: x.truncated })),
    ...(storageFiles > 0 ? [{ label: 'Fotos e arquivos enviados', count: storageFiles }] : []),
  ]);
  const pseudonyms = somarPorRotulo(trocas.filter((t) => t.bucket !== 'retained')
    .map((t) => ({ label: t.label, count: t.itens.length, truncated: t.truncated })));
  const retained = somarPorRotulo(trocas.filter((t) => t.bucket === 'retained')
    .map((t) => ({ label: t.label, count: t.itens.length, truncated: t.truncated })));

  const report = buildReport({
    uid, user, actorUid, deletes, pseudonyms, retained, blockers,
    authExists: authExists !== false, storageFiles,
  });
  return { report, plan: { user, authExists, porId, porConsulta, trocas } };
}

/** Grava operações em lotes de 400 (o limite do Firestore é 500). */
async function gravarEmLotes(db, ops) {
  let gravadas = 0;
  for (let i = 0; i < ops.length; i += 400) {
    const lote = db.batch();
    ops.slice(i, i + 400).forEach((op) => {
      if (op.type === 'delete') lote.delete(op.ref);
      else lote.update(op.ref, op.data);
    });
    // eslint-disable-next-line no-await-in-loop
    await lote.commit();
    gravadas += Math.min(400, ops.length - i);
  }
  return gravadas;
}

/**
 * Exclui UMA conta. Refaz a análise aqui dentro — nunca age sobre plano de
 * fora — e segue a ordem que tolera falha:
 *
 *   1. conta de login  (sem ela o cadastro não volta sozinho)
 *   2. arquivos no Storage
 *   3. pseudonimizar e reter (o histórico que é de outras pessoas)
 *   4. apagar o que é só dela
 *   5. `users/{uid}` — POR ÚLTIMO: enquanto ele existe, o admin ainda vê a
 *      conta na lista e pode rodar de novo para terminar
 *   6. auditoria
 */
async function executeAccountDeletion(ctx, uid, { actor, reason, hojeISO, FieldValue }) {
  const { db, auth, bucket } = ctx;
  const { report, plan } = await analyzeAccount(ctx, uid, { actorUid: actor && actor.uid, hojeISO });
  if (!report.canDelete) return { uid, status: 'blocked', report };

  // 1. conta de login
  let authDeleted = false;
  if (auth && plan.authExists !== false) {
    try {
      await auth.deleteUser(uid);
      authDeleted = true;
    } catch (err) {
      if (!err || err.code !== 'auth/user-not-found') {
        return { uid, status: 'error', report, error: 'Não foi possível excluir a conta de login. Nada foi apagado.' };
      }
    }
  }

  // 2. arquivos
  let storageError = false;
  if (bucket && report.storageFiles > 0) {
    try {
      await bucket.deleteFiles({ prefix: `uploads/${uid}/` });
    } catch (_) {
      storageError = true;
    }
  }

  // 3 e 4. um lote só de operações, na ordem certa
  const ops = [];
  plan.trocas.forEach((t) => t.itens.forEach((i) => ops.push({ type: 'update', ref: i.ref, data: i.patch })));
  plan.porConsulta.forEach((x) => {
    x.refs.forEach((ref) => ops.push({ type: 'delete', ref }));
    x.contadores.forEach((c) => ops.push({ type: 'update', ref: c.ref, data: { [c.field]: FieldValue.increment(-1) } }));
  });
  plan.porId.filter((x) => x.exists).forEach((x) => ops.push({ type: 'delete', ref: x.ref }));
  await gravarEmLotes(db, ops);

  // 5. por último, o cadastro
  if (plan.user) await db.collection('users').doc(uid).delete();

  // 6. auditoria — mesmo formato de `createAuditLog`, do cliente. Ela é
  // RETIDA (09 §4): é a única prova de que a exclusão foi feita direito.
  const agora = Date.now();
  await db.collection('audit_logs').add({
    log_number: Number(`${agora}${Math.floor(Math.random() * 900 + 100)}`),
    action: 'admin_account_deleted',
    action_label: 'Cadastro excluído pelo admin',
    actor_id: actor.uid,
    actor_name: actor.name || actor.email || actor.uid,
    actor_email: actor.email || '',
    tournament_id: null,
    user_id: uid,
    user_name: report.name,
    user_email: report.email,
    details: {
      reason,
      conta_de_login_excluida: authDeleted,
      arquivos_excluidos: storageError ? 0 : report.storageFiles,
      falha_nos_arquivos: storageError,
      apagados: report.deletes.map((d) => ({ item: d.label, qtd: d.count })),
      pseudonimizados: report.pseudonyms.map((d) => ({ item: d.label, qtd: d.count })),
      retidos: report.retained.map((d) => ({ item: d.label, qtd: d.count })),
      parcial: report.truncated,
    },
    created_at_ms: agora,
    created_at: FieldValue.serverTimestamp(),
  });

  return { uid, status: report.truncated ? 'partial' : 'deleted', report, storageError };
}

/** A data de hoje em São Paulo, `AAAA-MM-DD`. */
function hojeEmSaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

module.exports = {
  OWNER_EMAILS,
  DELETION_BATCH_MAX,
  DELETION_REASON_MIN,
  QUERY_LIMIT,
  REMOVED_ATHLETE,
  REMOVED_USER,
  REMOVED_MESSAGE,
  DELETE_BY_ID,
  DELETE_BY_QUERY,
  TOURNAMENT_LIVE,
  evaluateBlockers,
  isOwnerEmail,
  targetBlockedReason,
  validateRequest,
  patchFlatFields,
  patchArrayItems,
  patchParallelNames,
  buildReport,
  PSEUDO_SPECS,
  analyzeAccount,
  executeAccountDeletion,
  hojeEmSaoPaulo,
};
