/**
 * UNIFICAR O HISTÓRICO de uma conta EXCLUÍDA numa conta que continua — no
 * servidor.
 *
 * O pedido: *"o número 20 do ranking aparece como 'Atleta' e, quando se entra,
 * o perfil não existe. Era um usuário que tinha dois cadastros e um foi
 * excluído. Dá para identificar quem era e unificar os números na conta que
 * ficou?"*
 *
 * ## Por que isto existe
 *
 * A exclusão de cadastro (`accountDeletion.js`) apaga a identidade e
 * PSEUDONIMIZA o histórico esportivo: o uid fica nas partidas (apagá-lo
 * reescreveria o resultado e o rating dos adversários) e o nome vira "Atleta
 * removido". Isso é o certo quando a pessoa sai da plataforma. Quando a conta
 * excluída era a SEGUNDA conta de quem continua aqui, o histórico dela é da
 * conta que ficou — e é isto que devolve.
 *
 * ## O que é transferido (só o histórico ESPORTIVO)
 *
 * | Onde | O que muda |
 * |---|---|
 * | `club_event_games` (o que o ranking lê) | o uid nos lados |
 * | dias de jogo: participantes, jogos, membros | uid e o nome "Atleta removido" → o da conta |
 * | eventos de clube (legado): participantes e jogos | idem |
 * | inscrições de torneio (+ o rótulo nos grupos) | o jogador, o titular e o rótulo |
 * | torneios internos e ladder de arena | elenco e classificação |
 * | validações de nível (como aluno) | o aluno |
 *
 * Fica de fora, de propósito: o que é POSSE ou PODER (torneio, clube, dia de
 * jogo que a conta criou), o financeiro (reservas, carteira, compras — retidos
 * pela arena) e o social (conversas, fórum). Unificar números não transfere
 * propriedade.
 *
 * ## As travas
 *
 * - **Só conta EXCLUÍDA vira origem**: sem `users/{uid}` e sem conta de login.
 *   Juntar duas contas VIVAS seria tirar a história de alguém que ainda está
 *   aqui — não é o que esta ferramenta faz.
 * - **Conflito BLOQUEIA**: se as duas contas aparecem na MESMA partida ou
 *   inscrição, juntar faria a pessoa jogar contra (ou com) ela mesma. A prévia
 *   mostra onde; nada é gravado.
 * - **Prévia antes**; a execução refaz a análise no servidor (nunca age sobre
 *   plano que veio do navegador). **Só o dono executa** — como a exclusão.
 * - **Idempotente**: rodar de novo não acha mais nada da conta antiga.
 * - **Auditoria** com os documentos alterados — é o que permite desfazer.
 *
 * Os rankings se refazem sozinhos: as escritas em `club_event_games` e nas
 * inscrições acordam os gatilhos de sempre, e a função pede uma passada no
 * fim, para não depender deles.
 */

const MERGE_CONFIRM_WORD = 'UNIFICAR';
const MERGE_REASON_MIN = 5;
const QUERY_LIMIT = 400;
/** Quantos caminhos alterados vão para a auditoria (o documento tem 1 MB). */
const AUDIT_PATHS_MAX = 400;
/** O nome que a exclusão grava — é ele que volta a ser o da conta. */
const REMOVED_ATHLETE = 'Atleta removido';

const texto = (v) => String(v == null ? '' : v).trim();

/* ------------------------------------------------------- o pedido ------- */

/** Valida o pedido que chegou do navegador. */
function validateMergeRequest(data = {}) {
  const mode = data.mode === 'execute' ? 'execute' : 'preview';
  const fromUid = texto(data.fromUid);
  const intoUid = texto(data.intoUid);
  if (!fromUid || !intoUid) return { error: 'Escolha a conta excluída e a conta que fica.' };
  if (fromUid === intoUid) return { error: 'As duas contas são a mesma.' };
  const reason = texto(data.reason);
  if (mode === 'execute' && reason.length < MERGE_REASON_MIN) {
    return { error: `Descreva o motivo (mínimo ${MERGE_REASON_MIN} caracteres).` };
  }
  if (mode === 'execute' && texto(data.confirm).toUpperCase() !== MERGE_CONFIRM_WORD) {
    return { error: `Digite ${MERGE_CONFIRM_WORD} para confirmar.` };
  }
  return { mode, fromUid, intoUid, reason };
}

/* --------------------------------------------- trocas (todas puras) ----- */

/**
 * Quem a conta destino é, para os campos de nome e foto do histórico.
 * @param {object} user documento `users/{uid}` (ou o perfil público)
 */
function identidadeDe(user) {
  return {
    name: texto(user && (user.platform_name || user.full_name || user.display_name)) || 'Atleta',
    photo: texto(user && (user.photo_url || user.photoURL)) || null,
  };
}

/** O nome do histórico só é trocado quando é o pseudônimo (ou está vazio). */
const nomeTrocavel = (nome) => !texto(nome) || texto(nome) === REMOVED_ATHLETE;

/**
 * Lista de uids: troca `from` por `into`, sem duplicar.
 * @returns {string[]|null} a lista nova, ou `null` quando nada muda
 */
function trocarNaLista(lista, from, into) {
  if (!Array.isArray(lista) || !lista.includes(from)) return null;
  const nova = [];
  lista.forEach((u) => {
    const v = u === from ? into : u;
    if (!nova.includes(v)) nova.push(v);
  });
  return nova;
}

/**
 * Espelho de jogo publicado (`club_event_games`) — é o que o ranking lê.
 * @returns {{ patch: object|null, conflict: string|null }}
 */
function mergeMirrorGame(g, from, into) {
  const a = Array.isArray(g.side_a_ids) ? g.side_a_ids : [];
  const b = Array.isArray(g.side_b_ids) ? g.side_b_ids : [];
  const todos = [...a, ...b];
  if (!todos.includes(from)) return { patch: null, conflict: null };
  if (todos.includes(into)) return { patch: null, conflict: 'As duas contas estão na mesma partida publicada.' };
  const troca = (lado) => lado.map((u) => (u === from ? into : u));
  const patch = { side_a_ids: troca(a), side_b_ids: troca(b) };
  // `side_a`/`side_b` são os uids juntados por '+', quando gravados assim.
  ['side_a', 'side_b'].forEach((k) => {
    if (typeof g[k] === 'string' && g[k].split('+').includes(from)) {
      patch[k] = g[k].split('+').map((u) => (u === from ? into : u)).join('+');
    }
  });
  return { patch, conflict: null };
}

/**
 * Lados de um jogo de dia de jogo / evento de clube. O slot é da conta antiga
 * quando `user_id === from`, quando `id === from` (organizadores que chaveiam
 * por uid) ou quando `id` é um dos participantes dela — `slot.id` é id de
 * PARTICIPANTE, não uid.
 *
 * @returns {{ patch: object|null, conflict: string|null }}
 */
function mergeGameSides(game, from, into, ident, { fromPids = new Set(), intoPids = new Set() } = {}) {
  const deFrom = (sl) => sl && typeof sl === 'object'
    && (sl.user_id === from || sl.id === from || fromPids.has(sl.id));
  const deInto = (sl) => sl && typeof sl === 'object'
    && (sl.user_id === into || sl.id === into || intoPids.has(sl.id));
  const slots = [...(Array.isArray(game.side_a) ? game.side_a : []), ...(Array.isArray(game.side_b) ? game.side_b : [])];
  if (!slots.some(deFrom)) return { patch: null, conflict: null };
  if (slots.some(deInto)) return { patch: null, conflict: 'As duas contas estão no mesmo jogo.' };
  const lado = (arr) => {
    if (!Array.isArray(arr)) return null;
    let mudou = false;
    const novo = arr.map((sl) => {
      if (!deFrom(sl)) return sl;
      const c = { ...sl, user_id: into };
      if (c.id === from) c.id = into;
      if (nomeTrocavel(c.name)) c.name = ident.name;
      if (!c.photo_url && ident.photo && 'photo_url' in sl) c.photo_url = ident.photo;
      mudou = true;
      return c;
    });
    return mudou ? novo : null;
  };
  const patch = {};
  const a = lado(game.side_a);
  const b = lado(game.side_b);
  if (a) patch.side_a = a;
  if (b) patch.side_b = b;
  return { patch: Object.keys(patch).length > 0 ? patch : null, conflict: null };
}

/** Participante (dia de jogo ou evento de clube) da conta antiga. */
function mergeParticipant(p, from, into, ident) {
  if (!p || p.user_id !== from) return null;
  const patch = { user_id: into };
  if (nomeTrocavel(p.name)) patch.name = ident.name;
  if (!p.photo_url && ident.photo) patch.photo_url = ident.photo;
  return patch;
}

/** Listas de membros do dia de jogo (quem vê o dia). Posse NÃO é transferida. */
function mergeGameDayParent(gd, from, into) {
  const patch = {};
  ['member_uids', 'invited_uids', 'admin_uids'].forEach((k) => {
    const nova = trocarNaLista(gd[k], from, into);
    if (nova) patch[k] = nova;
  });
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Inscrição de torneio. O rótulo "A / B" é recalculado com o nome novo — é ele
 * que o quadro, a impressão e o telão mostram.
 * @returns {{ patch: object|null, conflict: string|null }}
 */
function mergeRegistration(reg, from, into, ident) {
  const lados = ['player_a', 'player_b'];
  const temFrom = lados.some((p) => reg[`${p}_user_id`] === from)
    || reg.user_id === from || reg.created_by === from
    || (Array.isArray(reg.member_uids) && reg.member_uids.includes(from));
  if (!temFrom) return { patch: null, conflict: null };
  const jogadoresInto = lados.some((p) => reg[`${p}_user_id`] === into)
    || (Array.isArray(reg.member_uids) && reg.member_uids.includes(into));
  const jogadoresFrom = lados.some((p) => reg[`${p}_user_id`] === from)
    || (Array.isArray(reg.member_uids) && reg.member_uids.includes(from));
  if (jogadoresInto && jogadoresFrom) {
    return { patch: null, conflict: 'As duas contas estão na mesma inscrição.' };
  }
  const patch = {};
  lados.forEach((p) => {
    if (reg[`${p}_user_id`] !== from) return;
    patch[`${p}_user_id`] = into;
    if (nomeTrocavel(reg[`${p}_name`])) patch[`${p}_name`] = ident.name;
    if (!reg[`${p}_photo`] && ident.photo && `${p}_photo` in reg) patch[`${p}_photo`] = ident.photo;
    if (`${p}_provisional` in reg) patch[`${p}_provisional`] = false;
  });
  if (reg.user_id === from) patch.user_id = into;
  if (reg.created_by === from) patch.created_by = into;
  const membros = trocarNaLista(reg.member_uids, from, into);
  if (membros) patch.member_uids = membros;
  if (Array.isArray(reg.members)) {
    let mudou = false;
    const novos = reg.members.map((m) => {
      if (!m || m.user_id !== from) return m;
      mudou = true;
      return { ...m, user_id: into, name: nomeTrocavel(m.name) ? ident.name : m.name };
    });
    if (mudou) patch.members = novos;
  } else if ((patch.player_a_name || patch.player_b_name) && typeof reg.label === 'string') {
    const a = patch.player_a_name || reg.player_a_name || '—';
    const b = patch.player_b_name || reg.player_b_name || '—';
    const rotulo = reg.label.includes(' / ') ? `${a} / ${b}` : a;
    if (rotulo !== reg.label) patch.label = rotulo;
  }
  return { patch: Object.keys(patch).length > 0 ? patch : null, conflict: null };
}

/** Torneio interno de arena: inscritos, elenco e classificação. */
function mergeInternalTournament(t, from, into, ident) {
  const patch = {};
  const parts = trocarNaLista(t.participants, from, into);
  if (parts) patch.participants = parts;
  ['roster', 'final_standings'].forEach((k) => {
    if (!Array.isArray(t[k])) return;
    let mudou = false;
    const novo = t[k].map((x) => {
      if (!x || x.user_id !== from) return x;
      mudou = true;
      return { ...x, user_id: into, name: nomeTrocavel(x.name) ? ident.name : x.name };
    });
    if (mudou) patch[k] = novo;
  });
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Ladder de arena: a linha da conta antiga passa a ser da conta que fica. */
function mergeLadder(l, from, into, ident) {
  if (!Array.isArray(l.rankings) || !l.rankings.some((r) => r && r.user_id === from)) return null;
  if (l.rankings.some((r) => r && r.user_id === into)) {
    // As duas no mesmo ladder: soma os pontos numa linha só.
    const deFrom = l.rankings.find((r) => r && r.user_id === from);
    const rankings = l.rankings
      .filter((r) => !(r && r.user_id === from))
      .map((r) => (r && r.user_id === into
        ? { ...r, points: (Number(r.points) || 0) + (Number(deFrom.points) || 0) }
        : r));
    return { rankings };
  }
  return {
    rankings: l.rankings.map((r) => (r && r.user_id === from
      ? { ...r, user_id: into, name: nomeTrocavel(r.name) ? ident.name : r.name }
      : r)),
  };
}

/* ------------------------------------------------- leitura ------------- */

async function consultar(db, col, field, op, value) {
  const snap = await db.collection(col).where(field, op, value).limit(QUERY_LIMIT + 1).get();
  return { docs: snap.docs.slice(0, QUERY_LIMIT), truncated: snap.size > QUERY_LIMIT };
}

/**
 * Analisa a unificação: só LÊ. Devolve o relatório para a tela e as operações
 * para a execução — que chama esta mesma função de novo.
 *
 * @param {{ db: object, auth?: object }} ctx
 * @param {string} fromUid conta excluída
 * @param {string} intoUid conta que fica
 */
async function analyzeMerge(ctx, fromUid, intoUid) {
  const { db, auth } = ctx;
  const bloqueios = [];

  // As duas pontas.
  const [fromUser, intoUser, intoPerfil] = await Promise.all([
    db.collection('users').doc(fromUid).get(),
    db.collection('users').doc(intoUid).get(),
    db.collection('athlete_profiles').doc(intoUid).get(),
  ]);
  if (fromUser.exists) {
    bloqueios.push('A conta de origem ainda EXISTE. Só se unifica o histórico de uma conta que já foi excluída.');
  }
  if (auth) {
    try {
      await auth.getUser(fromUid);
      bloqueios.push('A conta de origem ainda tem login ativo. Exclua o cadastro antes de unificar.');
    } catch (err) {
      if (!err || err.code !== 'auth/user-not-found') {
        bloqueios.push('Não foi possível conferir o login da conta de origem. Tente de novo.');
      }
    }
  }
  if (!intoUser.exists) bloqueios.push('A conta que fica não existe.');
  const intoData = intoUser.exists ? intoUser.data() : {};
  const ident = identidadeDe({ ...(intoPerfil.exists ? intoPerfil.data() : {}), ...intoData });

  // Quem era a conta excluída: a auditoria da exclusão (é a única prova).
  let excluida = null;
  try {
    const audit = await consultar(db, 'audit_logs', 'user_id', '==', fromUid);
    const doc = audit.docs.map((d) => d.data()).find((a) => a.action === 'admin_account_deleted');
    if (doc) {
      excluida = {
        name: texto(doc.user_name) || null,
        email: texto(doc.user_email) || null,
        deleted_at_ms: Number(doc.created_at_ms) || null,
      };
    }
  } catch (_) { /* sem auditoria a prévia segue: o admin decide pelo resto */ }

  const ops = [];
  const conflitos = [];
  const contagem = {};
  let truncado = false;
  const somar = (rotulo) => { contagem[rotulo] = (contagem[rotulo] || 0) + 1; };
  const atualizar = (ref, patch, rotulo) => { ops.push({ ref, data: patch }); somar(rotulo); };

  // 1) Jogos publicados — o que o ranking lê.
  const eventosDia = new Set();
  const eventosClube = new Set();
  const vistos = new Set();
  for (const campo of ['side_a_ids', 'side_b_ids']) {
    // eslint-disable-next-line no-await-in-loop
    const r = await consultar(db, 'club_event_games', campo, 'array-contains', fromUid);
    truncado = truncado || r.truncated;
    r.docs.forEach((d) => {
      if (vistos.has(d.id)) return;
      vistos.add(d.id);
      const g = d.data();
      if (g.event_id) (g.source === 'athlete_game_day' ? eventosDia : eventosClube).add(String(g.event_id));
      const { patch, conflict } = mergeMirrorGame(g, fromUid, intoUid);
      if (conflict) conflitos.push({ path: d.ref.path, motivo: conflict });
      else if (patch) atualizar(d.ref, patch, 'Jogos publicados no ranking');
    });
  }

  // 2) Dias de jogo (modulares: atleta, arena, clube).
  const membros = await consultar(db, 'game_days', 'member_uids', 'array-contains', fromUid);
  truncado = truncado || membros.truncated;
  membros.docs.forEach((d) => eventosDia.add(d.id));
  for (const id of eventosDia) {
    const ref = db.collection('game_days').doc(id);
    // eslint-disable-next-line no-await-in-loop
    const pai = await ref.get();
    if (!pai.exists) continue;
    const pp = mergeGameDayParent(pai.data(), fromUid, intoUid);
    if (pp) atualizar(ref, pp, 'Dias de jogo (quem vê o dia)');
    // eslint-disable-next-line no-await-in-loop
    const [partsFrom, partsInto, jogos] = await Promise.all([
      ref.collection('participants').where('user_id', '==', fromUid).limit(QUERY_LIMIT).get(),
      ref.collection('participants').where('user_id', '==', intoUid).limit(QUERY_LIMIT).get(),
      ref.collection('games').limit(QUERY_LIMIT).get(),
    ]);
    const fromPids = new Set(partsFrom.docs.map((x) => x.id));
    const intoPids = new Set(partsInto.docs.map((x) => x.id));
    partsFrom.docs.forEach((x) => {
      const p = mergeParticipant(x.data(), fromUid, intoUid, ident);
      if (p) atualizar(x.ref, p, 'Participações em dia de jogo');
    });
    jogos.docs.forEach((x) => {
      const { patch, conflict } = mergeGameSides(x.data(), fromUid, intoUid, ident, { fromPids, intoPids });
      if (conflict) conflitos.push({ path: x.ref.path, motivo: conflict });
      else if (patch) atualizar(x.ref, patch, 'Jogos de dia de jogo');
    });
  }

  // 3) Eventos de clube (datas legadas).
  for (const id of eventosClube) {
    const ref = db.collection('club_events').doc(id);
    // eslint-disable-next-line no-await-in-loop
    const ev = await ref.get();
    if (!ev.exists) continue;
    // eslint-disable-next-line no-await-in-loop
    const [partsFrom, partsInto, jogos] = await Promise.all([
      ref.collection('participants').where('user_id', '==', fromUid).limit(QUERY_LIMIT).get(),
      ref.collection('participants').where('user_id', '==', intoUid).limit(QUERY_LIMIT).get(),
      ref.collection('games').limit(QUERY_LIMIT).get(),
    ]);
    const fromPids = new Set(partsFrom.docs.map((x) => x.id));
    const intoPids = new Set(partsInto.docs.map((x) => x.id));
    partsFrom.docs.forEach((x) => {
      const p = mergeParticipant(x.data(), fromUid, intoUid, ident);
      if (p) atualizar(x.ref, p, 'Participações em evento de clube');
    });
    jogos.docs.forEach((x) => {
      const { patch, conflict } = mergeGameSides(x.data(), fromUid, intoUid, ident, { fromPids, intoPids });
      if (conflict) conflitos.push({ path: x.ref.path, motivo: conflict });
      else if (patch) atualizar(x.ref, patch, 'Jogos de evento de clube');
    });
  }

  // 4) Inscrições de torneio (+ o rótulo copiado nos grupos).
  const inscricoes = new Map();
  for (const [campo, op] of [['player_a_user_id', '=='], ['player_b_user_id', '=='], ['user_id', '=='], ['member_uids', 'array-contains']]) {
    // eslint-disable-next-line no-await-in-loop
    const r = await consultar(db, 'tournament_registrations', campo, op, fromUid);
    truncado = truncado || r.truncated;
    r.docs.forEach((d) => inscricoes.set(d.ref.path, d));
  }
  const rotulos = new Map();
  inscricoes.forEach((d) => {
    const reg = d.data();
    const { patch, conflict } = mergeRegistration(reg, fromUid, intoUid, ident);
    if (conflict) { conflitos.push({ path: d.ref.path, motivo: conflict }); return; }
    if (!patch) return;
    atualizar(d.ref, patch, 'Inscrições em torneio');
    if (patch.label && reg.tournament_id) {
      if (!rotulos.has(reg.tournament_id)) rotulos.set(reg.tournament_id, new Map());
      rotulos.get(reg.tournament_id).set(d.id, patch.label);
    }
  });
  for (const [tid, porReg] of rotulos) {
    // eslint-disable-next-line no-await-in-loop
    const grupos = await db.collection('tournament_groups').where('tournament_id', '==', tid).limit(QUERY_LIMIT).get();
    grupos.docs.forEach((g) => {
      const entrants = g.data().entrants;
      if (!Array.isArray(entrants)) return;
      let mudou = false;
      const novo = entrants.map((e) => {
        if (e && porReg.has(e.id) && e.label !== porReg.get(e.id)) { mudou = true; return { ...e, label: porReg.get(e.id) }; }
        return e;
      });
      if (mudou) atualizar(g.ref, { entrants: novo }, 'Nomes nos grupos de torneio');
    });
  }

  // 5) Torneios internos e ladder de arena.
  const internos = await consultar(db, 'arena_internal_tournaments', 'participants', 'array-contains', fromUid);
  truncado = truncado || internos.truncated;
  const arenas = new Set();
  internos.docs.forEach((d) => {
    const t = d.data();
    if (Array.isArray(t.participants) && t.participants.includes(intoUid)) {
      conflitos.push({ path: d.ref.path, motivo: 'As duas contas estão inscritas no mesmo torneio interno.' });
      return;
    }
    if (t.arena_id) arenas.add(t.arena_id);
    const p = mergeInternalTournament(t, fromUid, intoUid, ident);
    if (p) atualizar(d.ref, p, 'Torneios internos de arena');
  });
  for (const arenaId of arenas) {
    // eslint-disable-next-line no-await-in-loop
    const l = await db.collection('arena_ladders').where('arena_id', '==', arenaId).limit(QUERY_LIMIT).get();
    l.docs.forEach((d) => {
      const p = mergeLadder(d.data(), fromUid, intoUid, ident);
      if (p) atualizar(d.ref, p, 'Ladder de arena');
    });
  }

  // 6) Validações de nível (como aluno).
  const validacoes = await consultar(db, 'coach_level_validations', 'student_id', '==', fromUid);
  truncado = truncado || validacoes.truncated;
  validacoes.docs.forEach((d) => {
    const v = d.data();
    const patch = { student_id: intoUid };
    if (nomeTrocavel(v.student_name)) patch.student_name = ident.name;
    atualizar(d.ref, patch, 'Validações de nível');
  });

  const consolidado = consolidar(ops);
  const report = {
    fromUid,
    intoUid,
    excluida,
    destino: { name: ident.name, email: texto(intoData.email) || null },
    bloqueios,
    conflitos: conflitos.slice(0, 50),
    conflitosTotal: conflitos.length,
    itens: Object.entries(contagem).map(([label, count]) => ({ label, count })),
    total: consolidado.length,
    truncado,
    podeUnificar: bloqueios.length === 0 && conflitos.length === 0 && consolidado.length > 0,
  };
  return { report, ops: consolidado };
}

/** Junta as trocas do MESMO documento (dois caminhos podem achar o mesmo). */
function consolidar(ops) {
  const porCaminho = new Map();
  ops.forEach((o) => {
    const atual = porCaminho.get(o.ref.path);
    if (atual) Object.assign(atual.data, o.data);
    else porCaminho.set(o.ref.path, { ref: o.ref, data: { ...o.data } });
  });
  return [...porCaminho.values()];
}

/**
 * Executa a unificação. Refaz a análise aqui dentro e só grava se não houver
 * bloqueio nem conflito.
 *
 * @param {{ db: object, auth?: object }} ctx
 * @param {{ fromUid: string, intoUid: string, reason: string, actor: object,
 *           FieldValue: object, requestRankingRecompute?: Function, logger?: object }} p
 */
async function executeMerge(ctx, { fromUid, intoUid, reason, actor, FieldValue, requestRankingRecompute, logger }) {
  const { db } = ctx;
  const { report, ops } = await analyzeMerge(ctx, fromUid, intoUid);
  if (!report.podeUnificar) return { status: 'blocked', report };

  for (let i = 0; i < ops.length; i += 400) {
    const lote = db.batch();
    ops.slice(i, i + 400).forEach((op) => lote.update(op.ref, op.data));
    // eslint-disable-next-line no-await-in-loop
    await lote.commit();
  }

  // Auditoria: quem, de onde, para onde, e ONDE mexeu — é o que permite desfazer.
  const agora = Date.now();
  await db.collection('audit_logs').add({
    log_number: Number(`${agora}${Math.floor(Math.random() * 900 + 100)}`),
    action: 'admin_account_history_merged',
    action_label: 'Histórico de conta excluída unificado',
    actor_id: actor.uid,
    actor_name: actor.name || actor.email || actor.uid,
    actor_email: actor.email || '',
    tournament_id: null,
    user_id: intoUid,
    user_name: report.destino.name,
    user_email: report.destino.email || '',
    details: {
      reason,
      from_uid: fromUid,
      into_uid: intoUid,
      deleted_account_name: report.excluida ? report.excluida.name : null,
      itens: report.itens,
      documentos: ops.length,
      caminhos: ops.slice(0, AUDIT_PATHS_MAX).map((o) => o.ref.path),
      caminhos_truncados: ops.length > AUDIT_PATHS_MAX,
    },
    created_at_ms: agora,
    created_at: FieldValue.serverTimestamp(),
  });

  // Os gatilhos já acordam com as escritas; esta passada é a garantia.
  let ranking = null;
  if (typeof requestRankingRecompute === 'function') {
    try {
      ranking = await requestRankingRecompute(db, 'unificacao-de-conta', { logger });
    } catch (err) {
      if (logger) logger.error('Unificação: recálculo do ranking falhou (a recuperação agendada refaz).', err);
    }
  }
  return { status: 'merged', report, documentos: ops.length, ranking: ranking ? Boolean(ranking.ran) : null };
}

module.exports = {
  MERGE_CONFIRM_WORD,
  MERGE_REASON_MIN,
  REMOVED_ATHLETE,
  validateMergeRequest,
  identidadeDe,
  trocarNaLista,
  mergeMirrorGame,
  mergeGameSides,
  mergeParticipant,
  mergeGameDayParent,
  mergeRegistration,
  mergeInternalTournament,
  mergeLadder,
  consolidar,
  analyzeMerge,
  executeMerge,
};
