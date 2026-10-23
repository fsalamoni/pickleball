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
 * | **Apagado** | identidade (`users`, `athlete_profiles`), conta de login, fotos, tokens, notificações, favoritos, seguidores, vínculos (clube, arena, torneio, circuito), pedidos e convites, filas, gamificação pessoal, ratings materializados; do treino: itens PRIVADOS não compartilhados (e os arquivos deles), diário, planos, rotina, treinos recebidos, dúvidas que fez; configurações de divulgação do professor |
 * | **Pseudonimizado** | histórico esportivo e o que é de outras pessoas: inscrições, partidas, dias de jogo, conversas, fórum, avaliações. O uid fica; nome e foto viram "Atleta removido" / "Usuário removido" |
 * | **Retido** | auditoria, consentimentos, reservas e pagamentos (obrigação do parceiro) — com o nome minimizado; denúncias de conteúdo; aulas e pacotes vendidos como professor; **o conteúdo que a pessoa criou, com a autoria** (decisão do dono, 2026-10-09): itens de treino que outras pessoas veem (públicos, só para alunos, compartilhados) com as fotos e vídeos, treinos que enviou, respostas a dúvidas e comentários em diários de alunos, conteúdo, pacotes e loja do professor; cupons e campanhas do professor ficam, fora do ar |
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
  { col: 'coach_busy_slots', label: 'Horários ocupados de professor (público, sem aluno)' },
  { col: 'training_meta', label: 'Rotina e preferências do treino' },
  // Modelos de banner/cupom e custo interno dos vales do professor (id = uid).
  { col: 'promo_settings', label: 'Configurações de divulgação (professor)' },
  { col: 'market_carts', label: 'Carrinho do Mercado' },
  { col: 'market_addresses', label: 'Endereços salvos do Mercado' },
  // Código de confirmação do celular em andamento (id = uid).
  { col: 'phone_verifications', label: 'Confirmação do celular em andamento' },
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
  { col: 'coach_waitlist', field: 'user_id', label: 'Listas de espera de professor' },
  { col: 'coach_waitlist', field: 'coach_id', label: 'Lista de espera (como professor)' },
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
  { col: 'club_code_joins', field: 'user_id', label: 'Entradas em clube pelo código' },
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
  { col: 'coach_student_notes', field: 'coach_id', label: 'Notas privadas sobre alunos (como professor)' },
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
  { col: 'training_debriefs', field: 'uid', label: 'Balanços dos jogos' },
  // A caixa de entrada da pessoa. O que ela ENVIOU fica (RETAINED_AS_IS).
  { col: 'training_shares', field: 'to_uid', label: 'Treinos recebidos' },
  // Mercado: o que é só da pessoa.
  { col: 'market_favorites', field: 'uid', label: 'Favoritos do Mercado' },
  { col: 'market_follows', field: 'uid', label: 'Lojas seguidas no Mercado' },
  { col: 'market_saved_searches', field: 'uid', label: 'Buscas salvas do Mercado' },
  // Federações: o papel na equipe é da pessoa (a federação segue com os outros).
  { col: 'federation_staff', field: 'user_id', label: 'Papéis em equipes de federação' },
  { col: 'federation_followers', field: 'user_id', label: 'Acervos de federação que seguia' },
  // O convite para filiar é endereçado à pessoa (nome e foto copiados).
  { col: 'federation_invites', field: 'user_id', label: 'Convites para filiar em federações' },
  // Comentários em documentos e eventos de federação (as respostas oficiais
  // que a pessoa escreveu como equipe também saem) e as denúncias que fez.
  { col: 'federation_comments', field: 'user_id', label: 'Comentários em documentos e eventos de federação' },
  { col: 'federation_comment_reports', field: 'reporter_id', label: 'Denúncias de comentários de federação' },
  // O apoio a uma chapa eleitoral é da pessoa (a contagem na chapa fica).
  { col: 'federation_election_endorsements', field: 'user_id', label: 'Apoios a chapas eleitorais de federação' },
  // Acesso de suporte a federações que estava aberto (o registro do motivo
  // fica em `admin_access_logs`, que não é apagado).
  { col: 'federation_admin_grants', field: 'admin_uid', label: 'Acessos de suporte a federações abertos' },
  // E-mails, WhatsApp e SMS que a plataforma mandou para a pessoa (registro
  // de 90 dias; o resumo diário também leva o `user_id`).
  { col: 'message_outbox', field: 'user_id', label: 'Registro de e-mails e mensagens recebidos' },
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
  // O CONTEÚDO que a pessoa criou fica, com a autoria (decisão do dono,
  // 2026-10-09). O envio leva o nome de quem enviou; a dúvida, as respostas
  // do professor com o nome. Conteúdo, pacotes e loja do professor só
  // aparecem no perfil dele, que sai: ficam guardados, sem vitrine.
  { col: 'training_shares', field: 'from_uid', label: 'Treinos que enviou ou indicou (ficam com quem recebeu)' },
  { col: 'training_questions', field: 'coach_uid', label: 'Dúvidas de alunos que respondeu (ficam, com as respostas)' },
  { col: 'coach_content', field: 'coach_id', label: 'Conteúdo publicado como professor' },
  { col: 'coach_packages', field: 'coach_id', label: 'Pacotes de aula oferecidos' },
  { col: 'coach_products', field: 'coach_id', label: 'Produtos da loja do professor' },
  // A disputa é do pedido (o pedido fica, sem o nome) e não guarda nome.
  { col: 'market_disputes', field: 'buyer_uid', label: 'Problemas relatados em pedidos do Mercado' },
  // A denúncia de anúncio é sobre o conteúdo de OUTRA pessoa (como a do treino) e não guarda nome.
  { col: 'market_reports', field: 'reporter_uid', label: 'Denúncias de anúncios do Mercado que fez' },
  // Denúncia de e-mail (link do rodapé): só uids e o id do aviso, sem nome.
  { col: 'message_reports', field: 'reporter_uid', label: 'Denúncias de e-mail que fez' },
  { col: 'message_reports', field: 'sender_uid', label: 'Denúncias de e-mail sobre avisos da conta' },
  // Planos de federação são da federação; guardam só o uid de quem os salvou.
  { col: 'federation_plans', field: 'updated_by', label: 'Planos de federação que cadastrou' },
  // PR 3: o curso e a importação são da federação (quem cadastrou é só o uid
  // de equipe); a importação lista e-mails de quem AINDA não tem conta.
  { col: 'federation_courses', field: 'created_by', label: 'Cursos de federação que cadastrou' },
  { col: 'federation_imports', field: 'by', label: 'Importações de filiados que fez (como equipe)' },
  // PR 4: a notícia é da federação (quem escreveu é só o uid de equipe).
  { col: 'federation_news', field: 'created_by', label: 'Notícias de federação que escreveu (como equipe)' },
  { col: 'federation_docs', field: 'created_by', label: 'Documentos do acervo oficial de federação que preparou (como equipe; o ato publicado é registro da federação)' },
  { col: 'federation_events', field: 'created_by', label: 'Eventos do calendário oficial de federação que marcou (como equipe; o evento é da agenda da federação)' },
  { col: 'federation_budgets', field: 'created_by', label: 'Orçamentos de federação que criou (como equipe; o orçamento é da federação)' },
  { col: 'federation_ledger', field: 'created_by', label: 'Lançamentos de receita e despesa de federação que fez (como equipe; a conta é da federação)' },
  { col: 'federation_account_reports', field: 'opened_by', label: 'Prestações de contas de federação que abriu (como equipe; as contas são da federação)' },
  // Bloco 5: o contrato e o bem são da federação (quem lançou é só o uid de equipe).
  { col: 'federation_sponsor_contracts', field: 'created_by', label: 'Contratos de patrocínio de federação que lançou (como equipe; o contrato é da federação)' },
  { col: 'federation_assets', field: 'created_by', label: 'Bens do patrimônio de federação que cadastrou (como equipe; o bem é da federação)' },
  // Rodada 3: o equipamento homologado é da lista pública da federação.
  { col: 'federation_equipment', field: 'created_by', label: 'Equipamentos homologados que cadastrou (como equipe; a lista é da federação)' },
  // Rodada 3, Bloco 2: a certidão e o projeto incentivado são da própria federação.
  { col: 'federation_certificates', field: 'created_by', label: 'Certidões negativas de federação que anexou (como equipe; a certidão é da federação)' },
  // Rodada 3, Bloco 3: o pedido de selo é do clube ou da arena; as evidências
  // enviadas saem com a pasta `federacao/{uid}/` de quem pediu.
  { col: 'federation_club_seals', field: 'applicant_uid', label: 'Pedidos de selo de clube certificado que fez (como gestor; o selo é da organização)' },
  // Bloco 5 (seguro): o certificado do evento é do clube ou da arena.
  { col: 'federation_insurance_certificates', field: 'requested_by', label: 'Certificados de seguro para eventos que pediu (como gestor; o certificado é da organização)' },
  // Sedes e Copa (Bloco 3b): o edital, a candidatura (da organização), as notas
  // da comissão e a Copa são da federação; ficam com o uid para o histórico.
  { col: 'federation_host_bids', field: 'created_by', label: 'Editais de sede que criou (como equipe da federação)' },
  { col: 'federation_host_entries', field: 'applicant_uid', label: 'Candidaturas a sede que mandou (como gestor; a candidatura é da organização)' },
  { col: 'federation_host_scores', field: 'evaluator_uid', label: 'Notas que deu a propostas de sede (como comissão da federação)' },
  { col: 'federation_cups', field: 'created_by', label: 'Copas das Federações que criou (como equipe da confederação)' },
  { col: 'federation_incentive_projects', field: 'created_by', label: 'Projetos da Lei de Incentivo de federação que registrou (como equipe; o projeto é da federação)' },
  // Bloco 6: o vínculo nacional e a anuidade são entre duas federações (quem agiu é só o uid de equipe).
  { col: 'federation_national_links', field: 'opened_by', label: 'Pedidos e convites de filiação à confederação que abriu (como equipe; o vínculo é entre as federações)' },
  { col: 'federation_dues', field: 'issued_by', label: 'Anuidades da confederação que lançou (como equipe; o repasse é entre as federações)' },
]);

/* ------------------------------------------------------- federações ----- */

/**
 * A filiação e as cobranças ficam sem o nome; o índice do código da
 * carteirinha é APAGADO (a carteirinha de uma conta excluída não verifica);
 * os planos (`federation_plans`) são da federação e não citam a pessoa.
 */
const FED_LIVE = ['pending', 'awaiting_payment', 'active', 'expired', 'suspended'];

async function coletarFederacoes(db, uid) {
  const filiacoes = await consultar(db, 'federation_members', 'user_id', '==', uid);
  const dependentes = await consultar(db, 'federation_members', 'guardian_uid', '==', uid);
  const cobrancas = await consultar(db, 'federation_charges', 'payer_uid', '==', uid);
  const itens = [];
  const deletes = [];
  filiacoes.docs.forEach((d) => {
    const data = d.data() || {};
    if (data.card_code) deletes.push(db.collection('federation_card_index').doc(String(data.card_code)));
    // CPF, nascimento e responsável moram em `private/data`: somem com a conta.
    deletes.push(d.ref.collection('private').doc('data'));
    // A filiação viva ENCERRA: conta excluída não é filiada (a contagem de filiados e o ranking a tiravam só pelo nome).
    const encerra = FED_LIVE.includes(data.status) ? { status: 'cancelled', cancelled_at_ms: Date.now(), cancelled_by: 'account_deletion' } : {};
    itens.push({ ref: d.ref, patch: { ...encerra, user_name: REMOVED_ATHLETE, photo_url: null, card_code: null, public_badge: false, show_in_directory: false, note: '' } });
  });
  // Dependentes (menores filiados por esta conta): a filiação ENCERRA — ninguém
  // mais responde por ela; o nome do menor fica, porque a filiação é DELE, não da conta.
  dependentes.docs.forEach((d) => {
    const data = d.data() || {};
    if (data.card_code) deletes.push(db.collection('federation_card_index').doc(String(data.card_code)));
    deletes.push(d.ref.collection('private').doc('data'));
    const encerra = FED_LIVE.includes(data.status) ? { status: 'cancelled', cancelled_at_ms: Date.now(), cancelled_by: 'account_deletion' } : {};
    itens.push({ ref: d.ref, patch: { ...encerra, guardian_name: REMOVED_USER, card_code: null } });
  });
  // Clube/arena filiado por plano que esta conta representava: a filiação é da
  // ENTIDADE e continua; a conta sai do representante e outro gestor assume
  // (ação `represent`, que também passa a ele as cobranças em aberto).
  const representadas = await consultar(db, 'federation_members', 'representative_uid', '==', uid);
  const orgIds = new Set(representadas.docs.map((d) => d.id));
  representadas.docs.forEach((d) => {
    const data = d.data() || {};
    const reps = (Array.isArray(data.representatives) ? data.representatives : []).filter((r) => r && r.uid !== uid);
    itens.push({ ref: d.ref, patch: { representative_uid: null, representative_name: REMOVED_USER, representatives: reps } });
  });
  cobrancas.docs.forEach((d) => {
    const c = d.data() || {};
    // A cobrança da entidade guarda o nome DELA: só perde o pagador.
    if (orgIds.has(c.member_id)) { itens.push({ ref: d.ref, patch: { payer_uid: null } }); return; }
    if (c.payer_name !== REMOVED_ATHLETE || c.member_name) itens.push({ ref: d.ref, patch: { payer_name: REMOVED_ATHLETE, member_name: '' } });
  });
  // Resultados enviados ao ranking oficial: a linha fica como "Atleta removido"
  // e sai de `uids` — o gatilho `federationRankingRecompute` refaz a temporada
  // (`federation_rankings`, derivado, só o servidor grava) sem a conta; o
  // adversário segue com a colocação dele.
  const resultados = await consultar(db, 'federation_results', 'uids', 'array-contains', uid);
  resultados.docs.forEach((d) => {
    const data = d.data() || {};
    const rows = (data.rows || []).map((r) => (r && r.uid === uid ? { ...r, uid: null, name: REMOVED_ATHLETE, photo_url: null } : r));
    itens.push({ ref: d.ref, patch: { rows, uids: (data.uids || []).filter((u) => u !== uid) } });
  });
  // Lançamentos de pontos (`federation_points`): ficam como histórico do
  // torneio, sem uid, nome e foto; no ano ABERTO o lançamento é cancelado
  // (conta excluída não pontua mais). O ano FECHADO não muda de soma — só perde
  // o nome, aqui e no ranking gravado daquele ano.
  const { seasonClosed } = require('./federationRanking.js');
  const lancamentos = await consultar(db, 'federation_points', 'uid', '==', uid);
  lancamentos.docs.forEach((d) => {
    const data = d.data() || {};
    const cancela = !seasonClosed(data.season) && data.status === 'awarded' ? { status: 'cancelled', cancel_reason: 'account_deleted', cancelled_at_ms: Date.now() } : {};
    itens.push({ ref: d.ref, patch: { ...cancela, uid: null, name: REMOVED_ATHLETE, photo_url: null } });
  });
  const anonimiza = (rows) => (rows || []).map((l) => (l && l.uid === uid ? { ...l, uid: null, name: REMOVED_ATHLETE, photo_url: null } : l));
  const rankings = await consultar(db, 'federation_rankings', 'uids', 'array-contains', uid);
  rankings.docs.forEach((d) => {
    const data = d.data() || {};
    itens.push({ ref: d.ref, patch: { general: anonimiza(data.general), categories: (data.categories || []).map((c) => ({ ...c, rows: anonimiza(c.rows) })), uids: (data.uids || []).filter((u) => u !== uid) } });
  });
  // PR 3 — transferências e sanções (da pessoa e dos dependentes), inscrições
  // em curso e credenciais ficam sem o nome; a credencial sai do diretório e o
  // código dela deixa de verificar; a manifestação identificada na ouvidoria
  // vira anônima; os documentos enviados são APAGADOS (o arquivo vai junto,
  // pela pasta `federacao/{uid}/` em STORAGE_PREFIXES).
  const semNome = { user_name: REMOVED_ATHLETE };
  const transferencias = await consultarUniao(db, 'federation_transfers', [['user_id', '=='], ['guardian_uid', '==']], uid);
  transferencias.docs.forEach((d) => itens.push({ ref: d.ref, patch: semNome }));
  const sancoes = await consultarUniao(db, 'federation_sanctions', [['user_id', '=='], ['guardian_uid', '==']], uid);
  sancoes.docs.forEach((d) => itens.push({ ref: d.ref, patch: semNome }));
  const inscricoes = await consultar(db, 'federation_course_enrollments', 'user_id', '==', uid);
  inscricoes.docs.forEach((d) => itens.push({ ref: d.ref, patch: { ...semNome, photo_url: null } }));
  const credenciais = await consultar(db, 'federation_credentials', 'user_id', '==', uid);
  credenciais.docs.forEach((d) => {
    const data = d.data() || {};
    if (data.code) deletes.push(db.collection('federation_card_index').doc(String(data.code)));
    itens.push({ ref: d.ref, patch: { ...semNome, photo_url: null, public: false, code: null } });
  });
  const manifestacoes = await consultar(db, 'federation_reports', 'reporter_uid', '==', uid);
  manifestacoes.docs.forEach((d) => itens.push({ ref: d.ref, patch: { reporter_uid: null, anonymous: true } }));
  const documentos = await consultar(db, 'federation_documents_submitted', 'user_id', '==', uid);
  documentos.docs.forEach((d) => deletes.push(d.ref));
  // Arbitragem: o cadastro no quadro (e as notas da equipe) é APAGADO; a
  // escala fica — é o histórico do evento e a diária paga é despesa da
  // federação —, sem o nome e sem o conflito declarado; a escala em aberto
  // é cancelada (conta excluída não apita).
  const quadros = await consultar(db, 'federation_referees', 'user_id', '==', uid);
  quadros.docs.forEach((d) => { deletes.push(d.ref.collection('private').doc('staff')); deletes.push(d.ref); });
  const escalas = await consultar(db, 'federation_assignments', 'referee_uid', '==', uid);
  escalas.docs.forEach((d) => {
    const data = d.data() || {};
    const encerra = ['invited', 'confirmed'].includes(data.status) ? { status: 'cancelled', cancel_reason: 'Conta excluída.' } : {};
    itens.push({ ref: d.ref, patch: { ...encerra, referee_name: REMOVED_ATHLETE, conflict: null, decline_reason: '' } });
  });
  // Licença de professor, selo público e registro da proteção de menores
  // (Bloco 4): são da pessoa e são APAGADOS — conta excluída não dá aula nem
  // trabalha com menores; o arquivo da certidão sai com a pasta `federacao/{uid}/`.
  const licencas = await consultar(db, 'federation_coach_licenses', 'user_id', '==', uid);
  licencas.docs.forEach((d) => deletes.push(d.ref));
  deletes.push(db.collection('federation_coach_badges').doc(uid));
  const protecao = await consultar(db, 'federation_safeguarding', 'user_id', '==', uid);
  protecao.docs.forEach((d) => deletes.push(d.ref));
  // Embaixador (rodada 3, Bloco 3): a candidatura e o mandato são da pessoa e
  // são APAGADOS; a linha dela sai da lista pública da federação
  // (`federations.ambassadors_public`, chave derivada do id do documento).
  const embaixadas = await consultar(db, 'federation_ambassadors', 'user_id', '==', uid);
  const chavesPorFederacao = new Map();
  embaixadas.docs.forEach((d) => {
    deletes.push(d.ref);
    const fid = String((d.data() || {}).federation_id || '');
    if (!fid) return;
    if (!chavesPorFederacao.has(fid)) chavesPorFederacao.set(fid, new Set());
    chavesPorFederacao.get(fid).add(require('./federationSelection.js').rosterKey(d.id));
  });
  for (const [fid, chaves] of chavesPorFederacao) {
    const snap = await db.collection('federations').doc(fid).get();
    const lista = snap.exists ? (snap.data().ambassadors_public || []) : [];
    if (lista.some((a) => chaves.has(a.key))) itens.push({ ref: snap.ref, patch: { ambassadors_public: lista.filter((a) => !chaves.has(a.key)) } });
  }
  // Classificação do pickleball adaptado (rodada 3, Bloco 4b): dado de saúde
  // da pessoa, APAGADO junto com o laudo (`federacao-laudos/{uid}/`).
  const classificacoes = await consultar(db, 'federation_adapted_classifications', 'user_id', '==', uid);
  classificacoes.docs.forEach((d) => deletes.push(d.ref));
  // Ocorrências do seguro (lesão, acidente): o registro fica — a federação pode
  // estar com um sinistro aberto —, mas sem o nome e sem o relato de saúde.
  const ocorrencias = await consultarUniao(db, 'federation_incidents', [['user_id', '=='], ['guardian_uid', '==']], uid);
  ocorrencias.docs.forEach((d) => itens.push({ ref: d.ref, patch: { athlete_name: REMOVED_ATHLETE, description: '', body_part: '', history: [] } }));
  // Competições: o convite para a final é da pessoa (APAGADO; quem já confirmou
  // libera a vaga na próxima chamada); o relatório do torneio fica — é da
  // federação —, sem o nome de quem dirigiu.
  const convites = await consultar(db, 'federation_final_invites', 'user_id', '==', uid);
  convites.docs.forEach((d) => deletes.push(d.ref));
  const relatorios = await consultar(db, 'federation_tournament_reports', 'director_uid', '==', uid);
  relatorios.docs.forEach((d) => itens.push({ ref: d.ref, patch: { director_name: REMOVED_ATHLETE } }));
  // Seleção (Bloco 3): o convite da convocação é da pessoa (APAGADO); na lista
  // PÚBLICA da delegação a linha fica, sem o nome — é o histórico do campeonato.
  const { rosterKey } = require('./federationSelection.js');
  const convocados = await consultar(db, 'federation_callup_members', 'user_id', '==', uid);
  const chavesPorConvocacao = new Map();
  convocados.docs.forEach((d) => {
    deletes.push(d.ref);
    const cid = String((d.data() || {}).callup_id || '');
    if (!cid) return;
    if (!chavesPorConvocacao.has(cid)) chavesPorConvocacao.set(cid, new Set());
    chavesPorConvocacao.get(cid).add(rosterKey(d.id));
  });
  for (const [cid, chaves] of chavesPorConvocacao) {
    const snap = await db.collection('federation_callups').doc(cid).get();
    const roster = snap.exists ? (snap.data().roster || []) : [];
    if (roster.some((r) => chaves.has(r.key))) itens.push({ ref: snap.ref, patch: { roster: roster.map((r) => (chaves.has(r.key) ? { ...r, name: REMOVED_ATHLETE } : r)) } });
  }
  // Editais: a inscrição contemplada no resultado publicado ou paga FICA — o
  // pagamento é despesa da federação e está na transparência —, sem o nome, a
  // justificativa e os arquivos; a que não chegou lá é APAGADA. No edital, o
  // resultado e os pagamentos perdem o nome.
  const inscricoesEditais = await consultar(db, 'federation_grant_applications', 'user_id', '==', uid);
  const editaisTocados = new Set();
  inscricoesEditais.docs.forEach((d) => {
    const data = d.data() || {};
    if (data.grant_id) editaisTocados.add(String(data.grant_id));
    if (data.payment || data.status === 'approved') itens.push({ ref: d.ref, patch: { user_name: REMOVED_ATHLETE, text: '', files: {}, appeal: data.appeal ? { ...data.appeal, text: '' } : null } });
    else deletes.push(d.ref);
  });
  const idsInscricoes = new Set(inscricoesEditais.docs.map((d) => d.id));
  for (const gid of editaisTocados) {
    const snap = await db.collection('federation_grants').doc(gid).get();
    if (!snap.exists) continue;
    const g = snap.data() || {};
    const tira = (lista) => (lista || []).map((x) => (idsInscricoes.has(x.application_id) ? { ...x, name: REMOVED_ATHLETE } : x));
    if ([...(g.result || []), ...(g.payments || [])].some((x) => idsInscricoes.has(x.application_id))) itens.push({ ref: snap.ref, patch: { result: tira(g.result), payments: tira(g.payments) } });
  }
  // Copa das Federações (Bloco 3b): o elenco é da estadual e FICA, com a linha
  // da pessoa sem nome nem uid; na lista pública da Copa (`teams_public`, chave
  // derivada do id da filiação) a linha também perde o nome.
  const elencos = await consultar(db, 'federation_cup_teams', 'athlete_uids', 'array-contains', uid);
  const chavesPorCopa = new Map();
  elencos.docs.forEach((d) => {
    const x = d.data() || {};
    const meus = (x.athletes || []).filter((a) => a.uid === uid);
    itens.push({ ref: d.ref, patch: { athletes: (x.athletes || []).map((a) => (a.uid === uid ? { ...a, uid: null, name: REMOVED_ATHLETE } : a)), athlete_uids: (x.athlete_uids || []).filter((u) => u !== uid) } });
    if (!x.cup_id) return;
    if (!chavesPorCopa.has(x.cup_id)) chavesPorCopa.set(x.cup_id, new Set());
    meus.forEach((a) => chavesPorCopa.get(x.cup_id).add(rosterKey(a.member_id)));
  });
  for (const [cupId, chaves] of chavesPorCopa) {
    const snap = await db.collection('federation_cups').doc(String(cupId)).get();
    const times = snap.exists ? (snap.data().teams_public || []) : [];
    if (times.some((tm) => (tm.athletes || []).some((a) => chaves.has(a.key)))) {
      itens.push({ ref: snap.ref, patch: { teams_public: times.map((tm) => ({ ...tm, athletes: (tm.athletes || []).map((a) => (chaves.has(a.key) ? { ...a, name: REMOVED_ATHLETE } : a)) })) } });
    }
  }
  const truncated = [filiacoes, dependentes, cobrancas, resultados, transferencias, sancoes, inscricoes, credenciais, manifestacoes, documentos, quadros, escalas, licencas, protecao, ocorrencias, convites, relatorios, convocados, inscricoesEditais, elencos].some((r) => r.truncated);
  return { itens, deletes, truncated, count: itens.length + documentos.docs.length + quadros.docs.length + licencas.docs.length + protecao.docs.length + convites.docs.length + convocados.docs.length };
}

/* --------------------------------------------- o que IMPEDE a exclusão -- */

/**
 * Torneio nesses estados está VIVO: há gente inscrita esperando por ele.
 * Rascunho não entra — ninguém depende de um rascunho, e a conta de teste que
 * deixou um rascunho para trás não pode ficar impossível de excluir.
 */
const TOURNAMENT_LIVE = Object.freeze(['registrations_open', 'registrations_closed', 'in_progress']);

/** Pedido do Mercado nesses estados acabou (cópia de `ORDER_FINAL_STATUSES`). */
const MARKET_ORDER_FINAL = Object.freeze(['completed', 'cancelled', 'expired']);
const REMOVED_SELLER = 'Vendedor removido';

/** As chaves de vendedor PESSOAIS da conta (a da arena é da arena, fica). */
const marketPersonalKeys = (uid) => ['athlete_', 'coach_', 'store_'].map((p) => `${p}${uid}`);

/**
 * O que IMPEDE a exclusão — puro.
 *
 * A pergunta é sempre a mesma: *excluir esta conta quebra o serviço de outra
 * pessoa?* (`09-DIREITOS-DO-TITULAR.md` §4, "exclusão de gestor de arena /
 * professor / organizador"). Se sim, o admin resolve antes — transfere ou
 * exclui a arena, o clube, o torneio — e só então exclui a conta.
 *
 * @param {{ arenas?:object[], networks?:object[], clubAdminships?:Array<{club_id:string,club_name?:string,otherAdmins:number}>,
 *           tournaments?:object[], gameDays?:object[], wallets?:object[], federationPresidencies?:object[] }} found
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
  const abertos = (found.marketOrders || []).filter((o) => !MARKET_ORDER_FINAL.includes(o.status));
  if (abertos.length > 0) {
    out.push({ label: `Tem ${abertos.length} pedido(s) do Mercado em andamento`, detail: 'Espere concluir ou cancele os pedidos antes.' });
  }
  (found.federationPresidencies || []).forEach((f) => {
    out.push({ label: `Presidente da federação "${texto(f.name) || f.id}"`, detail: 'Nomeie outra presidência na equipe da federação antes.' });
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
    // Antes do filtro: a linha que bateu no limite pode ter vindo zerada.
    truncated: [...(f.deletes || []), ...(f.pseudonyms || [])].some((x) => x.truncated),
  };
}

/* =================================================== leitura e gravação == */

/* ------------------------------------ trocas específicas (puras) ------- */

/** Troca `name`→rótulo e limpa `clear`, quando `data[idField] === uid`. */
const campos = (idField, name, clear = [], label = REMOVED_ATHLETE) => (d, uid) => (
  patchFlatFields(d, uid, [{ idField, name, clear }], label)
);

/** Chapa eleitoral de federação: o nome da pessoa sai da composição, de quem registrou e das impugnações que fez. */
function patchCandidacy(d, uid) {
  const patch = {};
  const members = patchArrayItems(d.members, uid, { name: ['name'], label: REMOVED_USER });
  if (members) patch.members = members;
  const challenges = patchArrayItems(d.challenges, uid, { idKeys: ['by_uid'], name: ['by_name'], label: REMOVED_USER });
  if (challenges) patch.challenges = challenges;
  if (d.submitted_by === uid && d.submitted_by_name && d.submitted_by_name !== REMOVED_USER) patch.submitted_by_name = REMOVED_USER;
  return Object.keys(patch).length ? patch : null;
}

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
 * O item de treino que a pessoa criou PARA OUTRAS: público (em qualquer etapa
 * da revisão), só para alunos ou compartilhado com alguém. Ele fica, com o
 * nome de quem criou (decisão do dono, 2026-10-09: "o conteúdo criado não
 * deve ser excluído e deve permanecer indicando a autoria"). Só o privado que
 * ninguém mais recebeu é apagado — esse é só dela.
 */
function trainingItemStays(it) {
  if (!it) return false;
  return it.visibility !== 'privado' || (Array.isArray(it.shared_uids) && it.shared_uids.length > 0);
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

/**
 * O arquivo fica? `mantidos` guarda caminhos e, quando não deu para saber
 * tudo o que fica (consulta no limite), a PASTA inteira (termina em `/`).
 */
function fica(mantidos, caminho) {
  if (!mantidos) return false;
  return mantidos.has(caminho) || [...mantidos].some((c) => c.endsWith('/') && caminho.startsWith(c));
}

/** A mídia aponta para um arquivo de `treino/{uid}/` que vai ser apagado. */
function midiaQueSome(m, uid, mantidos) {
  const caminho = caminhoDaMidia(m);
  return Boolean(caminho) && caminho.startsWith(`treino/${uid}/`) && !fica(mantidos, caminho);
}

/** `{ media }` sem as mídias que vão sumir, ou nada se nenhuma some. */
function semMidiaQueSome(it, uid, mantidos) {
  if (!it || !Array.isArray(it.media)) return {};
  const media = it.media.filter((m) => !midiaQueSome(m, uid, mantidos));
  return media.length !== it.media.length ? { media } : {};
}

/**
 * Item que fica: o nome de autor fica, as fotos e vídeos dele também (os
 * arquivos entram em `coletarMantidos`). Só a FOTO de perfil sai — ela mora
 * em `uploads/{uid}/`, que é apagada, e viraria uma imagem quebrada.
 */
function patchTrainingItemAuthor(it, uid) {
  if (!it || it.author_uid !== uid || !it.author_photo) return null;
  return { author_photo: null };
}

/**
 * A cópia de OUTRA pessoa guarda o nome do original em "copiado de" (fica: é
 * a autoria) e o LINK das mídias enviadas pelo original. As do item que é
 * apagado somem com a pasta; as do item que fica, não.
 * ponytail: a cópia de uma cópia não é achada (nada indexa a cadeia); ali a
 * ficha mostra "não foi possível carregar" no lugar da mídia.
 */
function patchDerivedFrom(it, uid, mantidos) {
  const patch = semMidiaQueSome(it, uid, mantidos);
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Tira o uid da lista de quem pode ler o item de outra pessoa. */
/**
 * Bloqueio de envio (devolução, reclamação, PARAR): o bloqueio fica — o id do
 * documento é o hash do endereço, e é por ele que o envio confere —, mas o
 * endereço em claro e a conta saem.
 */
function patchSuppression(d, uid) {
  const ids = Array.isArray(d && d.user_ids) ? d.user_ids : [];
  if (!ids.includes(uid)) return null;
  return { address: null, masked: null, user_ids: ids.filter((u) => u !== uid) };
}

/** Avisos que a pessoa mandou a outras (o registro é de quem recebeu). */
function patchOutboxSender(d, uid) {
  if (!d || d.sent_by !== uid) return null;
  return { sent_by: null, k_sender: null, k_pair: null };
}

function patchSharedUids(it, uid) {
  if (!it || !Array.isArray(it.shared_uids) || !it.shared_uids.includes(uid)) return null;
  return { shared_uids: it.shared_uids.filter((u) => u !== uid) };
}

/**
 * Itens de treino que a pessoa criou: os que outras pessoas veem ficam, com a
 * autoria; os privados não compartilhados são apagados. Nas cópias de outras
 * pessoas saem só os links das mídias que somem.
 * ponytail: uma consulta de cópias por item (nada indexa "cópias de um
 * autor"); a conta tem no máximo QUERY_LIMIT itens.
 */
async function coletarItensDeTreino(db, uid, { mantidos } = {}) {
  const r = await consultar(db, 'training_items', 'author_uid', '==', uid);
  const itens = [];
  const deletes = [];
  let count = 0;
  let truncated = r.truncated;
  for (const d of r.docs) {
    const it = d.data();
    if (trainingItemStays(it)) {
      count += 1;
      const p = patchTrainingItemAuthor(it, uid);
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
  return { itens, deletes, truncated, count };
}

/**
 * Diário de treino. O da pessoa é apagado COM os comentários (subcoleção não
 * some com o pai). No diário de um aluno que ela, professora, acompanhava:
 * o compartilhamento é desfeito; a sessão é do aluno e os comentários DELA
 * ficam, com o nome (o que ela escreveu para o aluno é conteúdo criado).
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
  }
  return { itens, deletes, truncated };
}

/**
 * Dúvidas que a pessoa FEZ: são dela e somem com as mensagens. As que ela
 * respondeu como professora ficam como estão (RETAINED_AS_IS): as respostas
 * são conteúdo criado, com o nome.
 */
async function coletarDuvidas(db, uid) {
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
  return { itens: [], deletes, truncated };
}

/**
 * Cupom e campanha do PROFESSOR ficam (são conteúdo criado), mas saem do ar:
 * seguiriam no carrossel do início oferecendo aula de quem não existe mais.
 * O emissor da plataforma é 'platform', que nunca é um uid.
 */
const foraDoAr = (campo) => (d, uid) => (
  d && d.issuer_id === uid && d[campo] !== false ? { [campo]: false } : null
);

/** A campanha sai do ar também na página dela (a sem banner seguiria "valendo"). */
function patchCoachCampaign(d, uid) {
  if (!d || d.issuer_id !== uid) return null;
  if (d.status === 'cancelled' && d.banner_active === false) return null;
  return { status: 'cancelled', banner_active: false };
}

/**
 * A ficha de aluno de um professor, quando o ALUNO é excluído: o nome sai e o
 * vínculo encerra — o professor deixou de ser professor dele. Fica na lista
 * do professor como histórico ("A conta do aluno foi excluída"), sem convite.
 */
function patchCoachStudentLink(d, uid) {
  if (!d || d.student_id !== uid) return null;
  const patch = campos('student_id', ['student_name'], ['student_email'])(d, uid) || {};
  if (d.status !== 'ended') Object.assign(patch, { status: 'ended', ended_at: new Date(), ended_by: uid });
  // Mesmo já encerrado: é o motivo que tira o "Convidar de novo" e deixa o
  // professor remover a ficha. Quem encerrou e quando ficam.
  if (d.ended_reason !== 'conta_excluida') patch.ended_reason = 'conta_excluida';
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Mercado, como VENDEDOR pessoal (atleta, professor, loja): a ficha fica
 * (pedidos e avaliações apontam para ela), sem o nome e suspensa; o Pix
 * (`private/data`) some; os anúncios saem do ar. Os pedidos VENDIDOS ficam
 * (histórico do comprador) sem o nome do vendedor. Os COMPRADOS ficam sem o
 * nome e sem o endereço (`private/shipping`) — nenhum está em andamento: o
 * impedimento cuida disso.
 */
async function coletarMercado(db, uid) {
  const itens = [];
  const deletes = [];
  let truncated = false;
  for (const key of marketPersonalKeys(uid)) {
    // eslint-disable-next-line no-await-in-loop
    const seller = await db.collection('market_sellers').doc(key).get();
    if (seller.exists) {
      const s = seller.data() || {};
      if (s.display_name !== REMOVED_SELLER || s.status !== 'suspended') {
        itens.push({ ref: seller.ref, patch: { display_name: REMOVED_SELLER, status: 'suspended', bio: null, logo_url: null, banner_url: null } });
      }
      // eslint-disable-next-line no-await-in-loop
      const pix = await seller.ref.collection('private').doc('data').get();
      if (pix.exists) deletes.push(pix.ref);
    }
    // eslint-disable-next-line no-await-in-loop
    const [anuncios, vendas] = await Promise.all([
      consultar(db, 'market_listings', 'seller_key', '==', key),
      consultar(db, 'market_orders', 'seller_key', '==', key),
    ]);
    truncated = truncated || anuncios.truncated || vendas.truncated;
    anuncios.docs.forEach((d) => {
      const l = d.data() || {};
      const patch = {};
      if (l.seller_name !== REMOVED_SELLER) patch.seller_name = REMOVED_SELLER;
      if (!['closed', 'removed'].includes(l.status)) patch.status = 'closed';
      if (Object.keys(patch).length) itens.push({ ref: d.ref, patch });
    });
    vendas.docs.forEach((d) => {
      if ((d.data() || {}).seller_name !== REMOVED_SELLER) itens.push({ ref: d.ref, patch: { seller_name: REMOVED_SELLER } });
    });
    // Os cupons da loja saem com ela (ninguém mais compra dela). Os vales
    // que ela vendeu ficam: o saldo é de quem ganhou.
    // eslint-disable-next-line no-await-in-loop
    const cupons = await consultar(db, 'market_coupons', 'seller_key', '==', key);
    truncated = truncated || cupons.truncated;
    cupons.docs.forEach((d) => deletes.push(d.ref));
  }
  // Vale-presente que comprou ou tem: o saldo fica (é dinheiro), os nomes e o
  // recado saem. ponytail: o contador de uso de cupom (`market_coupon_uses/{uid}`
  // em lojas de outros) fica — é só um número sob o uid, sem nome.
  const vales = await consultarUniao(db, 'market_gift_cards', [['buyer_uid', '=='], ['holder_uid', '==']], uid);
  truncated = truncated || vales.truncated;
  vales.docs.forEach((d) => {
    const v = d.data() || {};
    if (v.recipient_name || v.from_name || v.message) itens.push({ ref: d.ref, patch: { recipient_name: '', from_name: '', message: '' } });
  });
  const compras = await consultar(db, 'market_orders', 'buyer_uid', '==', uid);
  truncated = truncated || compras.truncated;
  for (const d of compras.docs) {
    if ((d.data() || {}).buyer_name !== REMOVED_USER) itens.push({ ref: d.ref, patch: { buyer_name: REMOVED_USER } });
    // eslint-disable-next-line no-await-in-loop
    const endereco = await d.ref.collection('private').doc('shipping').get();
    if (endereco.exists) deletes.push(endereco.ref);
  }
  return { itens, deletes, truncated, count: itens.length };
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
  { label: 'Fichas de aluno de professores (vínculo encerrado)', col: 'coach_students', wheres: [['student_id', '==']], patch: patchCoachStudentLink },
  // Centro de Treino. `cols` diz o que um coletor com passos toca — é o que o
  // guarda `exclusaoCobreColecoes` confere contra o `firestore.rules`.
  { label: 'Itens de treino que criou (ficam, com a autoria)', bucket: 'retained', collect: coletarItensDeTreino, deleteLabel: 'Itens de treino privados, não compartilhados', cols: ['training_items'] },
  { label: 'Acesso a itens de treino de outras pessoas', col: 'training_items', wheres: [['shared_uids', 'array-contains']], patch: patchSharedUids },
  { label: 'Diários de alunos que acompanhava (os comentários ficam)', bucket: 'retained', collect: coletarDiario, deleteLabel: 'Diário de treino e comentários', cols: ['training_sessions'] },
  { label: 'Dúvidas de treino que fez', collect: coletarDuvidas, deleteLabel: 'Dúvidas de treino que fez e mensagens', cols: ['training_questions'] },
  { label: 'Cupons do professor (ficam, fora do ar)', bucket: 'retained', col: 'promo_coupons', wheres: [['issuer_id', '==']], patch: foraDoAr('active'), countAll: true },
  { label: 'Campanhas do professor (ficam, fora do ar)', bucket: 'retained', col: 'promo_campaigns', wheres: [['issuer_id', '==']], patch: patchCoachCampaign, countAll: true },
  // Federações: a filiação e as cobranças FICAM (obrigação da federação, como
  // a mensalidade da arena), sem o nome; a carteirinha deixa de verificar
  // (`coletarFederacoes` apaga o índice do código). Federação que a pessoa
  // pediu para abrir fica, com "Usuário removido" em quem pediu.
  { label: 'Filiações em federações (ficam, sem o nome)', bucket: 'retained', collect: coletarFederacoes, deleteLabel: 'Códigos de carteirinha, dados reservados e documentos enviados a federações', cols: ['federation_members', 'federation_charges', 'federation_card_index', 'federation_results', 'federation_points', 'federation_rankings', 'federation_transfers', 'federation_sanctions', 'federation_course_enrollments', 'federation_credentials', 'federation_reports', 'federation_documents_submitted', 'federation_referees', 'federation_assignments', 'federation_coach_licenses', 'federation_coach_badges', 'federation_safeguarding', 'federation_ambassadors', 'federation_adapted_classifications', 'federation_incidents', 'federation_final_invites', 'federation_tournament_reports', 'federation_callups', 'federation_callup_members', 'federation_grants', 'federation_grant_applications', 'federation_cup_teams'] },
  // A filiação do clube/arena é da organização; quem pediu vira "Usuário removido".
  { label: 'Pedidos de filiação de clube/arena que fez', bucket: 'retained', col: 'federation_affiliations', wheres: [['requested_by', '==']], patch: campos('requested_by', [], [], REMOVED_USER) },
  { label: 'Federações que pediu para abrir', bucket: 'retained', col: 'federations', wheres: [['created_by', '==']], patch: campos('created_by', ['created_by_name'], [], REMOVED_USER) },
  // Eleições de federação: o eleitor do colégio (registro de que votou) e as
  // chapas FICAM, sem o nome — são parte do resultado oficial. A cédula
  // (`federation_ballots`) não tem uid nem nome: não há o que tirar dela.
  { label: 'Eleições de federação em que estava no colégio (ficam, sem o nome)', bucket: 'retained', col: 'federation_election_voters', wheres: [['user_id', '==']], patch: (d) => (d.kind === 'person' && d.name !== REMOVED_USER ? { name: REMOVED_USER } : null), cols: ['federation_ballots'] },
  { label: 'Chapas eleitorais de federação (ficam, sem o nome)', bucket: 'retained', col: 'federation_candidacies', wheres: [['member_uids', 'array-contains']], patch: patchCandidacy },
  { label: 'Comissões eleitorais de federação (ficam, sem o nome)', bucket: 'retained', col: 'federation_elections', wheres: [['commission_uids', 'array-contains']], patch: (d, uid) => { const commission = patchArrayItems(d.commission, uid, { name: ['name'], label: REMOVED_USER }); return commission ? { commission } : null; } },
  // Mercado
  { label: 'Vendas e compras no Mercado (ficam, sem o nome)', bucket: 'retained', collect: coletarMercado, deleteLabel: 'Chave Pix e endereços de entrega do Mercado', cols: ['market_sellers', 'market_listings', 'market_orders', 'market_coupons', 'market_gift_cards'] },
  { label: 'Ofertas feitas no Mercado', col: 'market_offers', wheres: [['buyer_uid', '==']], patch: campos('buyer_uid', ['buyer_name'], [], REMOVED_USER) },
  { label: 'Perguntas feitas no Mercado', col: 'market_questions', wheres: [['asker_uid', '==']], patch: campos('asker_uid', ['asker_name'], [], REMOVED_USER) },
  { label: 'Avaliações no Mercado', col: 'market_reviews', wheres: [['author_uid', '==']], patch: campos('author_uid', ['author_name'], [], REMOVED_USER) },
  // E-mail e celular
  { label: 'Bloqueios de envio (ficam, sem o endereço)', bucket: 'retained', col: 'message_suppressions', wheres: [['user_ids', 'array-contains']], patch: patchSuppression },
  { label: 'Avisos que mandou por e-mail ou celular (ficam com quem recebeu)', col: 'message_outbox', wheres: [['sent_by', '==']], patch: patchOutboxSender },
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
      label: spec.label, bucket: spec.bucket || 'pseudonym', itens: r.itens || [], count: r.count,
      deletes: r.deletes || [], deleteLabel: spec.deleteLabel || spec.label, truncated: Boolean(r.truncated),
    };
  }
  const itens = [];
  let truncated = false;
  let vistos = 0;
  const aplicar = (d) => {
    vistos += 1;
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
  // `countAll`: a linha conta o que FICA, mude ou não (o cupom já desligado também fica).
  return {
    label: spec.label, bucket: spec.bucket || 'pseudonym', itens, deletes: [], truncated,
    count: spec.countAll ? vistos : undefined,
  };
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
 * tipo e tamanho), as fotos do Mercado e os documentos enviados a federações
 * (`federacao/`).
 */
const STORAGE_PREFIXES = Object.freeze([(uid) => `uploads/${uid}/`, (uid) => `treino/${uid}/`, (uid) => `mercado/${uid}/`, (uid) => `federacao/${uid}/`, (uid) => `federacao-acervo/${uid}/`, (uid) => `federacao-laudos/${uid}/`]);

/** Os links de arquivo dentro de um campo (a arte do cupom, o banner). */
function linksEm(valor, acc = []) {
  if (typeof valor === 'string') acc.push(valor);
  else if (Array.isArray(valor)) valor.forEach((v) => linksEm(v, acc));
  else if (valor && typeof valor === 'object') Object.values(valor).forEach((v) => linksEm(v, acc));
  return acc;
}

/** Cupons e campanhas que FICAM com a arte enviada pela pessoa (em `uploads/{uid}/`). */
const ARTE_QUE_FICA = Object.freeze([
  { col: 'promo_coupons', wheres: [['issuer_id', '=='], ['created_by', '==']] },
  { col: 'promo_campaigns', wheres: [['issuer_id', '=='], ['created_by', '==']] },
  { col: 'arena_campaigns', wheres: [['created_by', '==']] },
]);

/**
 * Arquivos que FICAM nas pastas da pessoa: a mídia dos itens de treino que
 * ficam — os dela que outras pessoas veem e os da PLATAFORMA que ela, como
 * admin, enviou — e a arte dos cupons e campanhas que ficam. Apagar a pasta
 * inteira quebraria as imagens deles.
 * Consulta no limite ⇒ não dá para saber tudo o que fica, e a PASTA inteira
 * fica (`treino/{uid}/` ou `uploads/{uid}/`); a exclusão sai parcial.
 * ponytail: com mais de QUERY_LIMIT itens que ficam a pasta nunca é apagada;
 * paginar as consultas se isso acontecer.
 */
async function coletarMantidos(db, uid) {
  const mantidos = new Set();
  let incompleto = false;
  const treino = `treino/${uid}/`;
  const uploads = `uploads/${uid}/`;
  const r = await consultarUniao(db, 'training_items', [['created_by', '=='], ['author_uid', '==']], uid);
  if (r.truncated) { mantidos.add(treino); incompleto = true; }
  r.docs.forEach((d) => {
    const it = d.data() || {};
    if ((it.author_uid === uid && !trainingItemStays(it)) || !Array.isArray(it.media)) return;
    it.media.forEach((m) => {
      const caminho = caminhoDaMidia(m);
      if (caminho && caminho.startsWith(treino)) mantidos.add(caminho);
    });
  });
  for (const { col, wheres } of ARTE_QUE_FICA) {
    // eslint-disable-next-line no-await-in-loop
    const a = await consultarUniao(db, col, wheres, uid);
    if (a.truncated) { mantidos.add(uploads); incompleto = true; }
    a.docs.forEach((d) => {
      const doc = d.data() || {};
      linksEm([doc.art, doc.banner]).forEach((url) => {
        const caminho = caminhoDaMidia({ url });
        if (caminho && caminho.startsWith(uploads)) mantidos.add(caminho);
      });
    });
  }
  return { mantidos, incompleto };
}

/** Quantos arquivos a pessoa tem no Storage, somando as pastas dela (sem os que ficam). */
async function contarArquivos(bucket, uid, mantidos = new Set()) {
  if (!bucket) return 0;
  let total = 0;
  for (const prefixo of STORAGE_PREFIXES) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const [files] = await bucket.getFiles({ prefix: prefixo(uid), maxResults: 1000 });
      total += files.filter((f) => !fica(mantidos, f.name)).length;
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
        await Promise.all(files.filter((f) => !fica(mantidos, f.name)).map((f) => f.delete()));
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

  const pedidosVenda = async () => (await Promise.all(marketPersonalKeys(uid).map((k) => consultar(db, 'market_orders', 'seller_key', '==', k))))
    .flatMap((r) => r.docs.map((d) => ({ id: d.id, ...d.data() })));
  const [arenas, networks, tournaments, gameDays, wallets, clubes, comprados, vendidos, fedStaff] = await Promise.all([
    docs('arenas', 'owner_id'),
    docs('arena_networks', 'owner_id'),
    docs('tournaments', 'creator_uid'),
    docs('game_days', 'created_by'),
    docs('arena_wallets', 'user_id'),
    docs('club_members', 'user_id'),
    docs('market_orders', 'buyer_uid'),
    pedidosVenda(),
    docs('federation_staff', 'user_id'),
  ]);
  const marketOrders = [...comprados, ...vendidos];

  // Único admin master de federação aprovada: a federação ficaria sem quem a governa.
  const { isMaster } = require('./federationStaffPolicy.js');
  const federationPresidencies = [];
  for (const st of fedStaff.filter((x) => isMaster(x) && x.federation_id)) {
    // eslint-disable-next-line no-await-in-loop
    const fed = await db.collection('federations').doc(st.federation_id).get();
    if (!fed.exists || fed.data().status !== 'approved') continue;
    // eslint-disable-next-line no-await-in-loop
    const outros = await db.collection('federation_staff').where('federation_id', '==', st.federation_id).get();
    if (outros.docs.some((d) => d.data().user_id !== uid && isMaster(d.data()))) continue;
    federationPresidencies.push({ id: fed.id, name: fed.data().name });
  }

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

  return evaluateBlockers({ arenas, networks, clubAdminships, tournaments, gameDays, wallets, marketOrders, federationPresidencies }, uid, hojeISO);
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

  const { mantidos, incompleto } = await coletarMantidos(db, uid);
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
    ...trocas.map((t) => ({ label: t.deleteLabel || t.label, count: (t.deletes || []).length, truncated: t.truncated })),
    // Lista do que fica incompleta: a pasta fica e a exclusão sai parcial.
    ...(storageFiles > 0 || incompleto ? [{ label: 'Fotos e arquivos enviados', count: storageFiles, truncated: incompleto }] : []),
  ]);
  const arquivosQueFicam = [...mantidos].filter((c) => !c.endsWith('/')).length;
  // `count` quando o coletor conta o que FICA (nem tudo o que fica muda).
  const linha = (t) => ({ label: t.label, count: t.count ?? t.itens.length, truncated: t.truncated });
  const pseudonyms = somarPorRotulo(trocas.filter((t) => t.bucket !== 'retained').map(linha));
  const retained = somarPorRotulo([
    ...trocas.filter((t) => t.bucket === 'retained').map(linha),
    ...retidos,
    ...(arquivosQueFicam > 0 ? [{ label: 'Fotos, vídeos e artes do conteúdo que fica', count: arquivosQueFicam }] : []),
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
  patchSuppression,
  patchOutboxSender,
  trainingItemStays,
  patchTrainingItemAuthor,
  patchDerivedFrom,
  patchSharedUids,
  patchCoachStudentLink,
  patchCoachCampaign,
  fica,
  consolidarOps,
  analyzeAccount,
  executeAccountDeletion,
  hojeEmSaoPaulo,
};
