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
 * | **Apagado** | identidade (`users`, `athlete_profiles`), conta de login, fotos, tokens, notificações, favoritos, seguidores, vínculos (clube, arena, torneio, circuito), pedidos e convites, filas, gamificação pessoal, ratings materializados; do treino: itens privados e só para alunos, diário, planos, rotina, envios, dúvidas que fez, fotos e vídeos (`treino/{uid}/`); do professor: conteúdo, pacotes oferecidos, loja, cupons, campanhas e configurações de divulgação |
 * | **Pseudonimizado** | histórico esportivo e o que é de outras pessoas: inscrições, partidas, dias de jogo, conversas, fórum, avaliações; itens de treino PÚBLICOS aprovados e as dúvidas que respondeu como professor. O uid fica; nome e foto viram "Atleta removido" / "Usuário removido" |
 * | **Retido** | auditoria, consentimentos, reservas e pagamentos (obrigação do parceiro) — com o nome minimizado; denúncias de conteúdo; aulas e pacotes vendidos como professor |
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
  { col: 'training_meta', label: 'Rotina e preferências do treino' },
  // Modelos de banner/cupom e custo interno dos vales do professor (id = uid).
  { col: 'promo_settings', label: 'Configurações de divulgação (professor)' },
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
  { col: 'coach_students', field: 'coach_id', label: 'Lista de alunos (como professor)' },
  { col: 'coach_clinic_signups', field: 'athlete_id', label: 'Inscrições em clínica' },
  // Notificação de OUTRA pessoa que cita esta conta ("Fulano te convidou…").
  // É operacional e expira em 90 dias; o texto costuma trazer o nome, então
  // trocar só `actor_name` não bastaria.
  { col: 'notifications', field: 'actor_id', label: 'Notificações de outras pessoas que citam a conta' },
  // A prova de inscrição provisória guarda o e-mail.
  { col: 'provisional_claims', field: 'claimed_by', label: 'Vínculos de inscrição provisória' },
  { col: 'club_internal_ratings', field: 'user_id', label: 'Rating interno de clube' },
  { col: 'club_internal_ratings_ext', field: 'user_id', label: 'Rating interno de clube (detalhe)' },
  { col: 'user_kudos', field: 'fromUid', label: 'Kudos enviados e recebidos' },
  { col: 'user_kudos', field: 'toUid', label: 'Kudos enviados e recebidos' },
  { col: 'user_rivals', field: 'userA', label: 'Rivalidades (gamificação)' },
  { col: 'user_rivals', field: 'userB', label: 'Rivalidades (gamificação)' },
  { col: 'mentorships', field: 'mentorUid', label: 'Mentorias (gamificação)' },
  { col: 'mentorships', field: 'apprenticeUid', label: 'Mentorias (gamificação)' },
  // Centro de Treino: o plano e os envios são só da pessoa (o envio é uma
  // mensagem entre duas pessoas — some dos dois lados, como a notificação).
  { col: 'training_plans', field: 'uid', label: 'Planos de treino' },
  { col: 'training_shares', field: 'from_uid', label: 'Treinos enviados e recebidos' },
  { col: 'training_shares', field: 'to_uid', label: 'Treinos enviados e recebidos' },
  // O que o PROFESSOR oferece: sem ele, a oferta não tem quem a cumpra. As
  // vendas e as aulas já dadas ficam (RETAINED_AS_IS) — são do aluno também.
  { col: 'coach_content', field: 'coach_id', label: 'Conteúdo publicado como professor' },
  { col: 'coach_packages', field: 'coach_id', label: 'Pacotes de aula oferecidos' },
  { col: 'coach_products', field: 'coach_id', label: 'Produtos da loja do professor' },
  // Cupons e campanhas do professor: seguiriam no carrossel do início
  // oferecendo aula de quem não existe mais. (O emissor da plataforma é
  // 'platform', que nunca é um uid.)
  { col: 'promo_coupons', field: 'issuer_id', label: 'Cupons do professor' },
  { col: 'promo_campaigns', field: 'issuer_id', label: 'Campanhas do professor' },
]);

/**
 * RETIDO sem mudança: só contado, para a prévia dizer que fica. Nenhum destes
 * guarda nome nem contato da pessoa — só o uid, que é o que mantém o registro
 * de pé.
 */
const RETAINED_AS_IS = Object.freeze([
  // Moderação: a denúncia é sobre o conteúdo de OUTRA pessoa, e o admin
  // precisa dela para decidir; a que é sobre o conteúdo da conta conta a
  // história do que foi moderado. Como a auditoria, fica.
  { col: 'training_reports', field: 'reporter_uid', label: 'Denúncias de conteúdo que fez' },
  { col: 'training_reports', field: 'item_author_uid', label: 'Denúncias sobre o conteúdo da conta' },
  // O lado PROFESSOR das aulas e vendas (o do aluno está em PSEUDO_SPECS):
  // nenhum dos dois documentos guarda o nome do professor.
  { col: 'coach_lessons', field: 'coach_id', label: 'Aulas particulares dadas (como professor)' },
  { col: 'coach_package_sales', field: 'coach_id', label: 'Pacotes de aula vendidos (como professor)' },
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

/* ------------------------------------ trocas específicas (puras) ------- */

/** Troca `name`→rótulo e limpa `clear`, quando `data[idField] === uid`. */
const campos = (idField, name, clear = [], label = REMOVED_ATHLETE) => (d, uid) => (
  patchFlatFields(d, uid, [{ idField, name, clear }], label)
);

/**
 * Inscrição de torneio. Troca nome, foto e e-mail do LADO da pessoa, os
 * membros de time, e RECALCULA o rótulo "A / B" — é ele que o quadro, a
 * impressão e o telão mostram, e trocar só o nome deixaria o rótulo com o
 * nome antigo. O rótulo segue `buildRegistrationLabel` (cliente): dupla é
 * "A / B", individual é "A", e time usa o nome do time (não mexe).
 */
function patchRegistration(reg, uid) {
  const patch = {};
  ['player_a', 'player_b'].forEach((p) => {
    if (reg[`${p}_user_id`] !== uid) return;
    if (`${p}_name` in reg && reg[`${p}_name`] !== REMOVED_ATHLETE) patch[`${p}_name`] = REMOVED_ATHLETE;
    [`${p}_photo`, `${p}_email`, `${p}_email_lc`].forEach((f) => {
      if (f in reg && reg[f] != null && reg[f] !== '') patch[f] = null;
    });
  });
  if (Array.isArray(reg.members)) {
    const membros = patchArrayItems(reg.members, uid, { idKeys: ['user_id'], name: ['name'], clear: ['photo_url'] });
    if (membros) patch.members = membros;
  } else if ((patch.player_a_name || patch.player_b_name) && typeof reg.label === 'string') {
    const a = patch.player_a_name || reg.player_a_name || '—';
    const b = patch.player_b_name || reg.player_b_name || '—';
    const rotulo = reg.label.includes(' / ') ? `${a} / ${b}` : a;
    if (rotulo !== reg.label) patch.label = rotulo;
  }
  const lado = reg.player_a_user_id === uid || reg.player_b_user_id === uid;
  if (lado && Array.isArray(reg.migrated_from_emails) && reg.migrated_from_emails.length > 0) {
    patch.migrated_from_emails = [];
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Os lados de um jogo (dia de jogo ou evento de clube).
 *
 * ⚠️ `slot.id` é o id do DOCUMENTO DE PARTICIPANTE, não o uid. A pessoa é
 * reconhecida por `slot.user_id === uid`, por `slot.id` ser um dos
 * participantes dela, ou (lados antigos) por `slot.id === uid`. E ao trocar o
 * nome, o uid é GRAVADO no lado (`user_id`): o ranking resolve a pessoa por
 * nome único como último recurso, e dois "Atleta removido" no mesmo dia
 * seriam indistinguíveis — é o que `sealParticipantUidIntoGames` já faz.
 */
function patchGameSides(game, uid, participantIds = new Set()) {
  const dela = (sl) => sl && typeof sl === 'object'
    && (sl.user_id === uid || sl.id === uid || participantIds.has(sl.id));
  const lado = (arr) => {
    if (!Array.isArray(arr)) return null;
    let mudou = false;
    const novo = arr.map((sl) => {
      if (!dela(sl)) return sl;
      const c = { ...sl };
      if (c.name !== REMOVED_ATHLETE) { c.name = REMOVED_ATHLETE; mudou = true; }
      if (c.photo_url) { c.photo_url = null; mudou = true; }
      if (c.user_id !== uid) { c.user_id = uid; mudou = true; }
      return c;
    });
    return mudou ? novo : null;
  };
  const patch = {};
  const a = lado(game.side_a);
  const b = lado(game.side_b);
  if (a) patch.side_a = a;
  if (b) patch.side_b = b;
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Mensagem (conversa ou evento de clube): o CONTEÚDO sai (09 §4). */
function patchMessage(msg, uid) {
  if (!msg || msg.sender_id !== uid) return null;
  const patch = {};
  if (msg.sender_name !== REMOVED_USER) patch.sender_name = REMOVED_USER;
  if (msg.sender_photo) patch.sender_photo = null;
  if (msg.text !== REMOVED_MESSAGE) patch.text = REMOVED_MESSAGE;
  // Os anexos moram em `uploads/{uid}/chat/…`, que é apagado junto: um anexo
  // listado apontaria para um arquivo que não existe mais.
  if (Array.isArray(msg.attachments) && msg.attachments.length > 0) patch.attachments = [];
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Conversa: o membro vira "Usuário removido"; a última mensagem também. */
function patchConversation(conv, uid) {
  const patch = {};
  const membros = patchArrayItems(conv.members, uid, {
    idKeys: ['uid'], name: ['name'], clear: ['photo_url'], label: REMOVED_USER,
  });
  if (membros) patch.members = membros;
  const ult = conv.last_message;
  if (ult && ult.sender_id === uid && (ult.sender_name !== REMOVED_USER || ult.text !== REMOVED_MESSAGE)) {
    patch.last_message = { ...ult, sender_name: REMOVED_USER, text: REMOVED_MESSAGE, has_attachments: false };
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Reserva de quadra: titular e participantes (inclusive quem recusou). */
function patchBooking(b, uid) {
  const patch = {};
  if (b.athlete_id === uid) {
    if ('athlete_name' in b && b.athlete_name !== REMOVED_ATHLETE) patch.athlete_name = REMOVED_ATHLETE;
    if (b.athlete_photo) patch.athlete_photo = null;
  }
  const parts = patchArrayItems(b.participants, uid, { idKeys: ['athlete_id'], name: ['name'], clear: ['photo'] });
  if (parts) patch.participants = parts;
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Torneio interno da arena: elenco e classificação final. */
function patchInternalTournament(t, uid) {
  const patch = {};
  const roster = patchArrayItems(t.roster, uid, { idKeys: ['user_id'], name: ['name'], clear: ['photo_url'] });
  if (roster) patch.roster = roster;
  const fin = patchArrayItems(t.final_standings, uid, { idKeys: ['user_id'], name: ['name'] });
  if (fin) patch.final_standings = fin;
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Ranking de duplas / rating de dupla de clube (nomes em vetor paralelo). */
function patchPairRanking(d, uid) {
  const patch = {};
  const players = patchArrayItems(d.players, uid, { idKeys: ['uid'], name: ['name'], clear: ['photo'] });
  if (players) patch.players = players;
  const nomes = patchParallelNames(d.player_ids, d.display_names, uid);
  if (nomes) patch.display_names = nomes;
  if (Array.isArray(d.player_ids) && Array.isArray(d.photos)) {
    let mudou = false;
    const fotos = d.photos.map((f, i) => {
      if (d.player_ids[i] === uid && f) { mudou = true; return null; }
      return f;
    });
    if (mudou) patch.photos = fotos;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/* -------------------------------- coletores com mais de um passo ------- */

const refDe = (doc) => doc.ref;

/**
 * Dias de jogo. O pai é achado por `member_uids`, `admin_uids` e — o caminho
 * que pega quem saiu da lista — pelos jogos PUBLICADOS no ranking, que dizem
 * de que dia de jogo vieram (`club_event_games.event_id`). Participantes são
 * pseudonimizados NO LUGAR, nunca apagados: é por eles que o ranking resolve
 * quem jogou.
 */
async function coletarDiasDeJogo(db, uid) {
  const ids = new Set();
  const doc = new Map();
  for (const campo of ['member_uids', 'admin_uids']) {
    // eslint-disable-next-line no-await-in-loop
    const r = await consultar(db, 'game_days', campo, 'array-contains', uid);
    r.docs.forEach((d) => { ids.add(d.id); doc.set(d.id, d); });
  }
  for (const campo of ['side_a_ids', 'side_b_ids']) {
    // eslint-disable-next-line no-await-in-loop
    const r = await consultar(db, 'club_event_games', campo, 'array-contains', uid);
    r.docs.map((d) => d.data()).filter((g) => g.source === 'athlete_game_day' && g.event_id)
      .forEach((g) => ids.add(String(g.event_id)));
  }
  const itens = [];
  for (const id of ids) {
    let pai = doc.get(id);
    // eslint-disable-next-line no-await-in-loop
    if (!pai) pai = await db.collection('game_days').doc(id).get();
    if (!pai.exists) continue;
    const gd = pai.data();
    if (gd.created_by === uid && !gd.club_id && !gd.arena_id) {
      const p = patchFlatFields(gd, uid, [{ idField: 'created_by', name: ['creator_name'], clear: ['creator_photo'] }]);
      if (p) itens.push({ ref: pai.ref, patch: p });
    }
    // eslint-disable-next-line no-await-in-loop
    const parts = await pai.ref.collection('participants').where('user_id', '==', uid).limit(QUERY_LIMIT).get();
    const participantIds = new Set(parts.docs.map((d) => d.id));
    parts.docs.forEach((d) => {
      const p = patchFlatFields(d.data(), uid, [{ idField: 'user_id', name: ['name'], clear: ['photo_url'] }]);
      if (p) itens.push({ ref: refDe(d), patch: p });
    });
    // eslint-disable-next-line no-await-in-loop
    const jogos = await pai.ref.collection('games').limit(QUERY_LIMIT).get();
    jogos.docs.forEach((d) => {
      const p = patchGameSides(d.data(), uid, participantIds);
      if (p) itens.push({ ref: refDe(d), patch: p });
    });
  }
  return { itens, deletes: [], truncated: false };
}

/**
 * Eventos de clube. Achados por convite, presença e jogos publicados — os
 * mesmos documentos que a exclusão APAGA depois; por isso a análise inteira
 * roda antes de qualquer escrita.
 */
async function coletarEventosDeClube(db, uid) {
  const ids = new Set();
  for (const [col, campo] of [['event_invites', 'user_id'], ['club_event_rsvps', 'user_id'], ['club_events', 'created_by']]) {
    // eslint-disable-next-line no-await-in-loop
    const r = await consultar(db, col, campo, '==', uid);
    r.docs.forEach((d) => ids.add(col === 'club_events' ? d.id : String(d.data().event_id || '')));
  }
  for (const campo of ['side_a_ids', 'side_b_ids']) {
    // eslint-disable-next-line no-await-in-loop
    const r = await consultar(db, 'club_event_games', campo, 'array-contains', uid);
    r.docs.map((d) => d.data()).filter((g) => g.source !== 'athlete_game_day' && g.event_id)
      .forEach((g) => ids.add(String(g.event_id)));
  }
  ids.delete('');
  const itens = [];
  const deletes = [];
  for (const id of ids) {
    const pai = db.collection('club_events').doc(id);
    // eslint-disable-next-line no-await-in-loop
    const ev = await pai.get();
    if (!ev.exists) continue;
    const pe = patchFlatFields(ev.data(), uid, [{ idField: 'created_by', name: ['created_by_name'] }]);
    if (pe) itens.push({ ref: pai, patch: pe });
    // eslint-disable-next-line no-await-in-loop
    const parts = await pai.collection('participants').where('user_id', '==', uid).limit(QUERY_LIMIT).get();
    const participantIds = new Set(parts.docs.map((d) => d.id));
    parts.docs.forEach((d) => {
      const p = patchFlatFields(d.data(), uid, [{ idField: 'user_id', name: ['name'], clear: ['photo_url'] }]);
      if (p) itens.push({ ref: refDe(d), patch: p });
    });
    // eslint-disable-next-line no-await-in-loop
    const msgs = await pai.collection('messages').where('sender_id', '==', uid).limit(QUERY_LIMIT).get();
    msgs.docs.forEach((d) => {
      const p = patchMessage(d.data(), uid);
      if (p) itens.push({ ref: refDe(d), patch: p });
    });
    // eslint-disable-next-line no-await-in-loop
    const rsvps = await pai.collection('date_rsvps').where('user_id', '==', uid).limit(QUERY_LIMIT).get();
    rsvps.docs.forEach((d) => deletes.push(refDe(d)));
    // eslint-disable-next-line no-await-in-loop
    const jogos = await pai.collection('games').limit(QUERY_LIMIT).get();
    jogos.docs.forEach((d) => {
      const p = patchGameSides(d.data(), uid, participantIds);
      if (p) itens.push({ ref: refDe(d), patch: p });
    });
  }
  return { itens, deletes, truncated: false };
}

/**
 * Inscrições em torneio + o que COPIA o rótulo delas: o contato privado
 * (e-mail) e os grupos (`tournament_groups.entrants[].label`).
 */
async function coletarInscricoes(db, uid) {
  const r = await consultarUniao(db, 'tournament_registrations', [
    ['player_a_user_id', '=='], ['player_b_user_id', '=='], ['member_uids', 'array-contains'],
  ], uid);
  const itens = [];
  const rotulos = new Map(); // tournament_id → Map(regId → novo rótulo)
  for (const d of r.docs) {
    const reg = d.data();
    const p = patchRegistration(reg, uid);
    if (p) itens.push({ ref: d.ref, patch: p });
    if (p && p.label && reg.tournament_id) {
      if (!rotulos.has(reg.tournament_id)) rotulos.set(reg.tournament_id, new Map());
      rotulos.get(reg.tournament_id).set(d.id, p.label);
    }
    // contato privado: só os e-mails do lado da pessoa
    // eslint-disable-next-line no-await-in-loop
    const priv = await d.ref.collection('private').doc('contact').get();
    if (priv.exists) {
      const c = priv.data();
      const pc = {};
      ['player_a', 'player_b'].forEach((lado) => {
        if (reg[`${lado}_user_id`] !== uid) return;
        [`${lado}_email`, `${lado}_email_lc`].forEach((f) => { if (c[f]) pc[f] = null; });
      });
      if (Object.keys(pc).length > 0) itens.push({ ref: priv.ref, patch: pc });
    }
  }
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
      if (mudou) itens.push({ ref: g.ref, patch: { entrants: novo } });
    });
  }
  return { itens, deletes: [], truncated: r.truncated };
}

/** Conversas: o membro, a última mensagem e as mensagens da pessoa. */
async function coletarConversas(db, uid) {
  const r = await consultar(db, 'conversations', 'member_ids', 'array-contains', uid);
  const itens = [];
  for (const d of r.docs) {
    const p = patchConversation(d.data(), uid);
    if (p) itens.push({ ref: d.ref, patch: p });
    // eslint-disable-next-line no-await-in-loop
    const msgs = await d.ref.collection('messages').where('sender_id', '==', uid).limit(QUERY_LIMIT).get();
    msgs.docs.forEach((m) => {
      const pm = patchMessage(m.data(), uid);
      if (pm) itens.push({ ref: m.ref, patch: pm });
    });
  }
  return { itens, deletes: [], truncated: r.truncated };
}

/** Fórum: tópicos e comentários ficam (são do clube); o autor sai; o voto é apagado. */
async function coletarForum(db, uid) {
  const r = await consultar(db, 'club_forum_threads', 'participant_ids', 'array-contains', uid);
  const itens = [];
  const deletes = [];
  for (const d of r.docs) {
    const p = patchFlatFields(d.data(), uid, [{ idField: 'author_id', name: ['author_name'], clear: ['author_photo'] }], REMOVED_USER);
    if (p) itens.push({ ref: d.ref, patch: p });
    // eslint-disable-next-line no-await-in-loop
    const coms = await d.ref.collection('comments').where('author_id', '==', uid).limit(QUERY_LIMIT).get();
    coms.docs.forEach((c) => {
      const pc = patchFlatFields(c.data(), uid, [{ idField: 'author_id', name: ['author_name'], clear: ['author_photo'] }], REMOVED_USER);
      if (pc) itens.push({ ref: c.ref, patch: pc });
    });
    // eslint-disable-next-line no-await-in-loop
    const voto = await d.ref.collection('poll_votes').doc(uid).get();
    if (voto.exists) deletes.push(voto.ref);
  }
  return { itens, deletes, truncated: r.truncated };
}

/** Ladder: não é consultável por uid; chega-se a ele pelas arenas dos torneios internos. */
async function coletarLadders(db, uid) {
  const t = await consultar(db, 'arena_internal_tournaments', 'participants', 'array-contains', uid);
  const arenas = new Set(t.docs.map((d) => d.data().arena_id).filter(Boolean));
  const itens = [];
  for (const arenaId of arenas) {
    // eslint-disable-next-line no-await-in-loop
    const l = await db.collection('arena_ladders').where('arena_id', '==', arenaId).limit(QUERY_LIMIT).get();
    l.docs.forEach((d) => {
      const novo = patchArrayItems(d.data().rankings, uid, { idKeys: ['user_id'], name: ['name'] });
      if (novo) itens.push({ ref: d.ref, patch: { rankings: novo } });
    });
  }
  return { itens, deletes: [], truncated: false };
}

/* ---------------------------------------------- Centro de Treino ------ */

/**
 * O item de treino que OUTRAS pessoas usam: público e aprovado. Ele fica, sem
 * o nome (como o post do fórum); o resto — privado, só para alunos, público
 * ainda em revisão ou recusado — é só da pessoa e é apagado.
 */
function trainingItemStays(it) {
  return Boolean(it) && it.visibility === 'publico' && it.review === 'aprovado';
}

/**
 * O caminho no Storage de uma mídia ENVIADA: o `path` gravado ou, na cópia
 * (que guarda só o link — `copy.js` zera o caminho), o que o link de
 * download carrega em `/o/<caminho codificado>`. Link de fora ⇒ `null`.
 */
function caminhoDaMidia(m) {
  if (!m) return null;
  if (typeof m.path === 'string' && m.path) return m.path;
  if (typeof m.url !== 'string') return null;
  const achado = /\/o\/([^?#]+)/.exec(m.url);
  if (!achado) return null;
  try { return decodeURIComponent(achado[1]); } catch (_) { return null; }
}

/** A mídia aponta para um arquivo de `treino/{uid}/` que vai ser apagado. */
function midiaQueSome(m, uid, mantidos) {
  const caminho = caminhoDaMidia(m);
  return Boolean(caminho) && caminho.startsWith(`treino/${uid}/`) && !(mantidos && mantidos.has(caminho));
}

/** `{ media }` sem as mídias que vão sumir, ou nada se nenhuma some. */
function semMidiaQueSome(it, uid, mantidos) {
  if (!it || !Array.isArray(it.media)) return {};
  const media = it.media.filter((m) => !midiaQueSome(m, uid, mantidos));
  return media.length !== it.media.length ? { media } : {};
}

/**
 * Item público que fica: autoria vira "Usuário removido" (o uid fica, como em
 * todo o histórico) e saem as mídias ENVIADAS por ela — os arquivos de
 * `treino/{uid}/` são apagados junto, e um item apontando para eles
 * mostraria uma imagem quebrada. Vídeo por link (YouTube/Vimeo) fica.
 */
function patchTrainingItemAuthor(it, uid, mantidos) {
  if (!it || it.author_uid !== uid) return null;
  const patch = { ...semMidiaQueSome(it, uid, mantidos) };
  if ('author_name' in it && it.author_name !== REMOVED_USER) patch.author_name = REMOVED_USER;
  if (it.author_photo) patch.author_photo = null;
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * A cópia de OUTRA pessoa guarda o nome do original em "copiado de" — e o
 * LINK das mídias enviadas pelo original, que somem com a pasta dele.
 * ponytail: a cópia de uma cópia não é achada (nada indexa a cadeia); ali a
 * ficha mostra "não foi possível carregar" no lugar da mídia.
 */
function patchDerivedFrom(it, uid, mantidos) {
  const df = it && it.derived_from;
  const patch = { ...semMidiaQueSome(it, uid, mantidos) };
  if (df && typeof df === 'object' && df.author_name !== REMOVED_USER) {
    patch.derived_from = { ...df, author_name: REMOVED_USER };
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Tira o uid da lista de quem pode ler o item de outra pessoa. */
function patchSharedUids(it, uid) {
  if (!it || !Array.isArray(it.shared_uids) || !it.shared_uids.includes(uid)) return null;
  return { shared_uids: it.shared_uids.filter((u) => u !== uid) };
}

/** Mensagem da dúvida (`{ uid, name, text }`): o conteúdo sai, como no chat. */
function patchTrainingMessage(m, uid) {
  if (!m || m.uid !== uid) return null;
  const patch = {};
  if (m.name !== REMOVED_USER) patch.name = REMOVED_USER;
  if (m.text !== REMOVED_MESSAGE) patch.text = REMOVED_MESSAGE;
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Itens de treino que a pessoa criou: apaga os que são só dela, tira o nome
 * dos públicos aprovados e do "copiado de" das cópias de outras pessoas.
 * ponytail: uma consulta de cópias por item (nada indexa "cópias de um
 * autor"); a conta tem no máximo QUERY_LIMIT itens.
 */
async function coletarItensDeTreino(db, uid, { mantidos } = {}) {
  const r = await consultar(db, 'training_items', 'author_uid', '==', uid);
  const itens = [];
  const deletes = [];
  let truncated = r.truncated;
  for (const d of r.docs) {
    const it = d.data();
    if (trainingItemStays(it)) {
      const p = patchTrainingItemAuthor(it, uid, mantidos);
      if (p) itens.push({ ref: d.ref, patch: p });
    } else {
      deletes.push(d.ref);
    }
    // eslint-disable-next-line no-await-in-loop
    const copias = await consultar(db, 'training_items', 'derived_from.id', '==', d.id);
    truncated = truncated || copias.truncated;
    copias.docs.forEach((c) => {
      const pc = patchDerivedFrom(c.data(), uid, mantidos);
      if (pc) itens.push({ ref: c.ref, patch: pc });
    });
  }
  return { itens, deletes, truncated };
}

/**
 * Diário de treino. O da pessoa é apagado COM os comentários (subcoleção não
 * some com o pai). No diário de um aluno que ela, professora, acompanhava:
 * o compartilhamento é desfeito e os comentários DELA saem; a sessão é do
 * aluno e fica.
 */
async function coletarDiario(db, uid) {
  const itens = [];
  const deletes = [];
  const minhas = await consultar(db, 'training_sessions', 'uid', '==', uid);
  let truncated = minhas.truncated;
  for (const d of minhas.docs) {
    // eslint-disable-next-line no-await-in-loop
    const coms = await d.ref.collection('comments').limit(QUERY_LIMIT + 1).get();
    if (coms.size > QUERY_LIMIT) truncated = true;
    coms.docs.slice(0, QUERY_LIMIT).forEach((c) => deletes.push(c.ref));
    deletes.push(d.ref);
  }
  const deAlunos = await consultar(db, 'training_sessions', 'shared_coach_id', '==', uid);
  truncated = truncated || deAlunos.truncated;
  for (const d of deAlunos.docs) {
    if (d.data().uid === uid) continue;
    itens.push({ ref: d.ref, patch: { shared_coach_id: null } });
    // eslint-disable-next-line no-await-in-loop
    const coms = await d.ref.collection('comments').where('uid', '==', uid).limit(QUERY_LIMIT).get();
    coms.docs.forEach((c) => deletes.push(c.ref));
  }
  return { itens, deletes, truncated };
}

/**
 * Dúvidas. As que a pessoa FEZ são dela: somem com as mensagens. Nas que ela
 * RESPONDEU como professora, a conversa é do aluno: fica, com o nome e o
 * texto dela trocados (como no chat).
 */
async function coletarDuvidas(db, uid) {
  const itens = [];
  const deletes = [];
  const minhas = await consultar(db, 'training_questions', 'asker_uid', '==', uid);
  let truncated = minhas.truncated;
  for (const d of minhas.docs) {
    // eslint-disable-next-line no-await-in-loop
    const msgs = await d.ref.collection('messages').limit(QUERY_LIMIT + 1).get();
    if (msgs.size > QUERY_LIMIT) truncated = true;
    msgs.docs.slice(0, QUERY_LIMIT).forEach((m) => deletes.push(m.ref));
    deletes.push(d.ref);
  }
  const recebidas = await consultar(db, 'training_questions', 'coach_uid', '==', uid);
  truncated = truncated || recebidas.truncated;
  for (const d of recebidas.docs) {
    const p = patchFlatFields(d.data(), uid, [{ idField: 'coach_uid', name: ['coach_name'] }], REMOVED_USER);
    if (p) itens.push({ ref: d.ref, patch: p });
    // eslint-disable-next-line no-await-in-loop
    const msgs = await d.ref.collection('messages').where('uid', '==', uid).limit(QUERY_LIMIT).get();
    msgs.docs.forEach((m) => {
      const pm = patchTrainingMessage(m.data(), uid);
      if (pm) itens.push({ ref: m.ref, patch: pm });
    });
  }
  return { itens, deletes, truncated };
}

/**
 * O que é PSEUDONIMIZADO (o uid fica, o nome sai) ou RETIDO com o nome
 * minimizado. Cada campo abaixo foi conferido no código que ESCREVE a
 * coleção. Duas formas:
 *
 * - simples: `{ col, wheres:[[campo, op]], patch(data, uid) }`;
 * - com passos: `{ collect(db, uid) → { itens, deletes, truncated } }`.
 */
const PSEUDO_SPECS = Object.freeze([
  // histórico esportivo
  { label: 'Inscrições em torneio', collect: coletarInscricoes },
  { label: 'Dias de jogo e partidas', collect: coletarDiasDeJogo },
  { label: 'Eventos de clube e partidas', collect: coletarEventosDeClube, deleteLabel: 'Presenças em data de evento' },
  { label: 'Torneios internos de arena', col: 'arena_internal_tournaments', wheres: [['participants', 'array-contains']], patch: patchInternalTournament },
  { label: 'Ladder de arena', collect: coletarLadders },
  { label: 'Ranking de duplas', col: 'doubles_rankings', wheres: [['player_ids', 'array-contains']], patch: patchPairRanking },
  { label: 'Rating de dupla de clube', col: 'club_internal_doubles_ratings', wheres: [['player_ids', 'array-contains']], patch: patchPairRanking },
  { label: 'Rating de dupla de clube (detalhe)', col: 'club_internal_doubles_ratings_ext', wheres: [['player_ids', 'array-contains']], patch: patchPairRanking },
  { label: 'Validações de nível (como aluno)', col: 'coach_level_validations', wheres: [['student_id', '==']], patch: campos('student_id', ['student_name']) },
  { label: 'Validações de nível (como professor)', col: 'coach_level_validations', wheres: [['coach_id', '==']], patch: campos('coach_id', ['coach_name']) },
  // o que a pessoa organizou (fica, sem o nome)
  { label: 'Torneios que criou', col: 'tournaments', wheres: [['creator_uid', '==']], patch: campos('creator_uid', ['creator_name']) },
  { label: 'Avisos de torneio', col: 'tournament_announcements', wheres: [['created_by', '==']], patch: campos('created_by', ['created_by_name']) },
  { label: 'Jogos abertos que criou', col: 'open_games', wheres: [['created_by', '==']], patch: campos('created_by', ['creator_name'], ['creator_photo']) },
  { label: 'Clubes que criou', col: 'clubs', wheres: [['created_by', '==']], patch: campos('created_by', ['creator_name']) },
  { label: 'Circuitos que criou', col: 'circuits', wheres: [['created_by', '==']], patch: campos('created_by', ['created_by_name']) },
  { label: 'Vagas de jogo aberto que criou', col: 'arena_open_slots', wheres: [['created_by', '==']], patch: campos('created_by', ['created_by_name']) },
  { label: 'Clínicas que oferece', col: 'coach_clinics', wheres: [['coach_id', '==']], patch: campos('coach_id', ['coach_name']) },
  // o que é social (fica, com "Usuário removido")
  { label: 'Conversas e mensagens', collect: coletarConversas },
  { label: 'Fórum de clube', collect: coletarForum, deleteLabel: 'Votos em enquete de fórum' },
  { label: 'Publicações em clube', col: 'club_posts', wheres: [['author_id', '==']], patch: campos('author_id', ['author_name'], ['author_photo'], REMOVED_USER) },
  { label: 'Avaliações de arena', col: 'arena_reviews', wheres: [['user_id', '==']], patch: campos('user_id', ['user_name'], ['user_photo'], REMOVED_USER) },
  { label: 'Fichas de aluno de professores', col: 'coach_students', wheres: [['student_id', '==']], patch: campos('student_id', ['student_name'], ['student_email']) },
  // Centro de Treino. `cols` diz o que um coletor com passos toca — é o que o
  // guarda `exclusaoCobreColecoes` confere contra o `firestore.rules`.
  { label: 'Itens de treino públicos (autoria removida)', collect: coletarItensDeTreino, deleteLabel: 'Itens de treino privados e só para alunos', cols: ['training_items'] },
  { label: 'Acesso a itens de treino de outras pessoas', col: 'training_items', wheres: [['shared_uids', 'array-contains']], patch: patchSharedUids },
  { label: 'Diários de alunos que acompanhava', collect: coletarDiario, deleteLabel: 'Diário de treino e comentários', cols: ['training_sessions'] },
  { label: 'Dúvidas que respondeu como professor', collect: coletarDuvidas, deleteLabel: 'Dúvidas de treino e mensagens', cols: ['training_questions'] },
  // RETIDO: financeiro e operacional do parceiro (09 §4 — 5 anos)
  { label: 'Reservas de quadra', bucket: 'retained', col: 'arena_bookings', wheres: [['athlete_id', '=='], ['participant_ids', 'array-contains'], ['invited_ids', 'array-contains']], patch: patchBooking },
  { label: 'Matrículas em aula de arena', bucket: 'retained', col: 'arena_class_bookings', wheres: [['user_id', '==']], patch: campos('user_id', ['athlete_name']) },
  { label: 'Compras na loja da arena', bucket: 'retained', col: 'arena_sales', wheres: [['buyer_id', '==']], patch: campos('buyer_id', ['buyer_name']) },
  { label: 'Carteira em arena', bucket: 'retained', col: 'arena_wallets', wheres: [['user_id', '==']], patch: campos('user_id', ['user_name']) },
  { label: 'Mensalidade em arena', bucket: 'retained', col: 'arena_subscriptions', wheres: [['user_id', '==']], patch: campos('user_id', ['user_name']) },
  { label: 'Aulas particulares', bucket: 'retained', col: 'coach_lessons', wheres: [['student_id', '==']], patch: campos('student_id', ['student_name'], ['student_email']) },
  { label: 'Pacotes de aula comprados', bucket: 'retained', col: 'coach_package_sales', wheres: [['student_id', '==']], patch: campos('student_id', ['student_name']) },
]);

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
async function coletarTrocas(db, uid, spec, extra = {}) {
  if (typeof spec.collect === 'function') {
    const r = await spec.collect(db, uid, extra);
    return {
      label: spec.label, bucket: spec.bucket || 'pseudonym', itens: r.itens || [],
      deletes: r.deletes || [], deleteLabel: spec.deleteLabel || spec.label, truncated: Boolean(r.truncated),
    };
  }
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
  return { label: spec.label, bucket: spec.bucket || 'pseudonym', itens, deletes: [], truncated };
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

/**
 * As pastas da pessoa no Storage: as fotos e anexos (`uploads/`) e as fotos e
 * vídeos do treino (`treino/`, fora de `uploads/` porque tem regra própria de
 * tipo e tamanho).
 */
const STORAGE_PREFIXES = Object.freeze([(uid) => `uploads/${uid}/`, (uid) => `treino/${uid}/`]);

/**
 * Arquivos de `treino/{uid}/` que FICAM: a mídia que a pessoa, como admin,
 * enviou para itens da PLATAFORMA (autor "plataforma", `created_by` = ela). O
 * item é da plataforma e segue na biblioteca de todo mundo; apagar a pasta
 * inteira quebraria as fotos e vídeos dele.
 */
async function coletarMantidos(db, uid) {
  const r = await consultar(db, 'training_items', 'created_by', '==', uid);
  const mantidos = new Set();
  r.docs.forEach((d) => {
    const it = d.data() || {};
    if (it.author_uid === uid || !Array.isArray(it.media)) return;
    it.media.forEach((m) => {
      const caminho = caminhoDaMidia(m);
      if (caminho && caminho.startsWith(`treino/${uid}/`)) mantidos.add(caminho);
    });
  });
  return mantidos;
}

/** Quantos arquivos a pessoa tem no Storage, somando as pastas dela (sem os que ficam). */
async function contarArquivos(bucket, uid, mantidos = new Set()) {
  if (!bucket) return 0;
  let total = 0;
  for (const prefixo of STORAGE_PREFIXES) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const [files] = await bucket.getFiles({ prefix: prefixo(uid), maxResults: 1000 });
      total += files.filter((f) => !mantidos.has(f.name)).length;
    } catch (_) {
      // pasta que não deu para ler conta zero; a execução tenta apagar mesmo assim
    }
  }
  return total;
}

/**
 * Apaga as pastas da pessoa, menos os arquivos que ficam. Sem nada a manter,
 * a pasta sai de uma vez; com algo, arquivo por arquivo.
 */
async function apagarArquivos(bucket, uid, mantidos) {
  let erro = false;
  for (const prefixo of STORAGE_PREFIXES) {
    try {
      const prefix = prefixo(uid);
      const guarda = [...mantidos].some((c) => c.startsWith(prefix));
      if (!guarda) {
        // eslint-disable-next-line no-await-in-loop
        await bucket.deleteFiles({ prefix });
      } else {
        // eslint-disable-next-line no-await-in-loop
        const [files] = await bucket.getFiles({ prefix });
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(files.filter((f) => !mantidos.has(f.name)).map((f) => f.delete()));
      }
    } catch (_) {
      erro = true;
    }
  }
  return erro;
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

  const mantidos = await coletarMantidos(db, uid);
  const [authExists, storageFiles, blockers] = await Promise.all([
    auth ? contaDeLoginExiste(auth, uid) : Promise.resolve(null),
    contarArquivos(bucket, uid, mantidos),
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

  // Retido sem mudança: só contado
  const retidos = [];
  for (const spec of RETAINED_AS_IS) {
    // eslint-disable-next-line no-await-in-loop
    const r = await consultar(db, spec.col, spec.field, '==', uid);
    retidos.push({ label: spec.label, count: r.docs.length, truncated: r.truncated });
  }

  // Pseudonimizar / reter
  const trocas = [];
  for (const spec of (ctx.pseudoSpecs || PSEUDO_SPECS)) {
    // eslint-disable-next-line no-await-in-loop
    trocas.push(await coletarTrocas(db, uid, spec, { mantidos }));
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
    ...trocas.map((t) => ({ label: t.deleteLabel || t.label, count: (t.deletes || []).length })),
    ...(storageFiles > 0 ? [{ label: 'Fotos e arquivos enviados', count: storageFiles }] : []),
  ]);
  const pseudonyms = somarPorRotulo(trocas.filter((t) => t.bucket !== 'retained')
    .map((t) => ({ label: t.label, count: t.itens.length, truncated: t.truncated })));
  const retained = somarPorRotulo([
    ...trocas.filter((t) => t.bucket === 'retained')
      .map((t) => ({ label: t.label, count: t.itens.length, truncated: t.truncated })),
    ...retidos,
    ...(mantidos.size > 0 ? [{ label: 'Fotos e vídeos de itens da biblioteca da plataforma', count: mantidos.size }] : []),
  ]);

  const report = buildReport({
    uid, user, actorUid, deletes, pseudonyms, retained, blockers,
    authExists: authExists !== false, storageFiles,
  });
  return { report, plan: { user, authExists, porId, porConsulta, trocas, mantidos } };
}

/**
 * Junta atualizações para o MESMO documento e tira as de documento que também
 * será apagado. Duas especificações podem achar a mesma reserva (titular e
 * participante), e um lote com dois `update` no mesmo documento ainda
 * funcionaria — mas um `update` depois de um `delete` no mesmo lote falha.
 */
function consolidarOps(ops) {
  const apagar = new Map();
  ops.filter((o) => o.type === 'delete').forEach((o) => apagar.set(o.ref.path, o));
  const atualizar = new Map();
  ops.filter((o) => o.type !== 'delete').forEach((o) => {
    if (apagar.has(o.ref.path)) return;
    const atual = atualizar.get(o.ref.path);
    if (atual) Object.assign(atual.data, o.data);
    else atualizar.set(o.ref.path, { type: 'update', ref: o.ref, data: { ...o.data } });
  });
  // Primeiro as trocas, depois as exclusões — na ordem em que foram pedidas.
  return [...atualizar.values(), ...apagar.values()];
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
  // Mesmo com a contagem em zero: a listagem pode ter falhado na prévia, e
  // apagar uma pasta vazia não custa nada.
  const storageError = bucket ? await apagarArquivos(bucket, uid, plan.mantidos) : false;

  // 3 e 4. um lote só de operações, na ordem certa
  const ops = [];
  plan.trocas.forEach((t) => t.itens.forEach((i) => ops.push({ type: 'update', ref: i.ref, data: i.patch })));
  plan.trocas.forEach((t) => (t.deletes || []).forEach((ref) => ops.push({ type: 'delete', ref })));
  plan.porConsulta.forEach((x) => {
    x.refs.forEach((ref) => ops.push({ type: 'delete', ref }));
    x.contadores.forEach((c) => ops.push({ type: 'update', ref: c.ref, data: { [c.field]: FieldValue.increment(-1) } }));
  });
  plan.porId.filter((x) => x.exists).forEach((x) => ops.push({ type: 'delete', ref: x.ref }));
  await gravarEmLotes(db, consolidarOps(ops));

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
  RETAINED_AS_IS,
  STORAGE_PREFIXES,
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
  patchRegistration,
  patchGameSides,
  patchMessage,
  patchConversation,
  patchBooking,
  patchInternalTournament,
  patchPairRanking,
  trainingItemStays,
  patchTrainingItemAuthor,
  patchDerivedFrom,
  patchSharedUids,
  patchTrainingMessage,
  consolidarOps,
  analyzeAccount,
  executeAccountDeletion,
  hojeEmSaoPaulo,
};
