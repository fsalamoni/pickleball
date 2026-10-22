/**
 * FEDERAÇÕES — enums, rótulos e nomes de coleção (lógica pura).
 *
 * A federação é a entidade que filia atletas, chancela torneios e mantém o
 * ranking oficial de uma região (flag `federations`). Tudo usa o prefixo
 * `federation_`. Os valores dos enums são gravados no banco — nunca renomeie
 * um valor, só acrescente.
 */
import { tk } from '@/core/i18n';

export const FED_COLLECTIONS = Object.freeze({
  federations: 'federations',
  staff: 'federation_staff',
  adminGrants: 'federation_admin_grants',
  plans: 'federation_plans',
  members: 'federation_members',
  charges: 'federation_charges',
  cardIndex: 'federation_card_index',
  affiliations: 'federation_affiliations',
  results: 'federation_results',
  rankings: 'federation_rankings',
  points: 'federation_points',
  transfers: 'federation_transfers',
  documents: 'federation_documents_submitted',
  imports: 'federation_imports',
  courses: 'federation_courses',
  enrollments: 'federation_course_enrollments',
  credentials: 'federation_credentials',
  sanctions: 'federation_sanctions',
  reports: 'federation_reports',
  news: 'federation_news',
  officialDocs: 'federation_docs',
  followers: 'federation_followers',
  events: 'federation_events',
  comments: 'federation_comments',
  invites: 'federation_invites',
  referees: 'federation_referees',
  assignments: 'federation_assignments',
  elections: 'federation_elections',
  candidacies: 'federation_candidacies',
  electionVoters: 'federation_election_voters',
  electionEndorsements: 'federation_election_endorsements',
  ballots: 'federation_ballots',
});

/** O convite para filiar vale por 30 dias (a mesma conta do servidor). */
export const FED_INVITE_DAYS = 30;
export const FED_INVITE_MAX = 50;

/** O convite ainda está esperando a resposta da pessoa? */
export const isInvitePending = (inv, now = Date.now()) => Boolean(inv) && inv.status === 'pending' && Number(inv.expires_at_ms) > now;

/** Id determinístico da inscrição em curso: `{courseId}_{uid}`. */
export const fedEnrollmentDocId = (courseId, uid) => `${courseId}_${uid}`;

/** Id determinístico da filiação de clube/arena: `{fedId}_{club|arena}_{orgId}`. */
export const fedOrgDocId = (fedId, kind, orgId) => `${fedId}_${kind}_${orgId}`;
/** Id determinístico do resultado enviado: `{fedId}_{tournamentId}_{modalityId}`. */
export const fedResultDocId = (fedId, tournamentId, modalityId) => `${fedId}_${tournamentId}_${modalityId}`;
/** Id determinístico do ranking da temporada: `{fedId}_{ano}`. */
export const fedRankingDocId = (fedId, season) => `${fedId}_${season}`;
/** Id determinístico do lançamento de pontos: `{resultId}_{uid}` (um por atleta por categoria de torneio). */
export const fedPointsDocId = (resultId, uid) => `${resultId}_${uid}`;

/** Id determinístico das relações únicas (equipe e filiação): `{fedId}_{uid}`. */
export const fedUserDocId = (fedId, uid) => `${fedId}_${uid}`;

/** Nível da federação. */
export const FEDERATION_LEVEL = Object.freeze({
  STATE: 'state',
  REGIONAL: 'regional',
  NATIONAL: 'national',
});

export const FEDERATION_LEVEL_LABELS = Object.freeze({
  state: tk('Estadual'),
  regional: tk('Regional'),
  national: tk('Nacional'),
});

/** Estado da federação. Nasce `pending` até o admin da plataforma aprovar. */
export const FEDERATION_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
});

export const FEDERATION_STATUS_LABELS = Object.freeze({
  pending: tk('Em análise'),
  approved: tk('Aprovada'),
  rejected: tk('Recusada'),
  suspended: tk('Suspensa'),
});

/** Permissões de equipe — a regra e a tela perguntam por ELAS, não pelo papel. */
export const FED_PERMISSION = Object.freeze({
  /** Página, Pix, planos, módulos, equipe. */
  ADMIN: 'admin',
  /** Filiados: aprovar, recusar, suspender. */
  MEMBERS: 'members',
  /** Cobranças: confirmar pagamento. */
  FINANCE: 'finance',
  COMPETITIONS: 'competitions',
  COURSES: 'courses',
  DISCIPLINE: 'discipline',
  COMMS: 'comms',
  /** Acervo oficial: rascunhos, publicação, retificação e visibilidade (só o servidor grava — `federationAcervo`). */
  DOCS: 'docs',
  /** Pessoas da equipe: nomear, prorrogar mandato, tirar (só o servidor confere — `federationStaff`). */
  STAFF: 'staff',
  /** Conselho fiscal: lê o orçamento e as contas e registra o parecer; não lança nada. */
  FISCAL: 'fiscal',
});

/** O que cada permissão abre — é o que aparece ao montar um cargo. */
export const FED_PERMISSION_META = Object.freeze({
  admin: { label: tk('Página e configurações'), description: tk('Página pública, planos, Pix, módulos, regras e governança.') },
  members: { label: tk('Filiados'), description: tk('Pedidos de filiação, filiados, transferências, documentos e importação.') },
  finance: { label: tk('Financeiro'), description: tk('Cobranças, recebimentos e a conta Pix.') },
  competitions: { label: tk('Competições'), description: tk('Chancela de torneios, resultados e ranking oficial.') },
  courses: { label: tk('Cursos e arbitragem'), description: tk('Cursos, inscrições, credenciais, quadro de árbitros e escalas.') },
  discipline: { label: tk('Disciplina e ouvidoria'), description: tk('Sanções e manifestações da ouvidoria.') },
  comms: { label: tk('Comunicação'), description: tk('Notícias, avisos, cupons e campanhas.') },
  docs: { label: tk('Acervo oficial'), description: tk('Normas, atos, atas, editais e documentos de transparência: rascunho, publicação, retificação e visibilidade.') },
  staff: { label: tk('Equipe'), description: tk('Nomeia pessoas para cargos sem poder de admin master, prorroga mandatos e tira da equipe.') },
  fiscal: { label: tk('Conselho fiscal'), description: tk('Lê o orçamento, os lançamentos e as prestações de contas e registra o parecer. Não lança nem aprova pagamento.') },
});

/** Mandato: o máximo que o cargo pode durar sem alerta (Lei 14.597/2023, art. 36: até 4 anos). */
export const STAFF_TERM_MAX_MONTHS = 48;
/** Avisos antes de o mandato vencer (dias). */
export const STAFF_TERM_WARN_DAYS = Object.freeze([30, 7, 1]);
/** Um admin da plataforma entra numa federação por no máximo estas horas. */
export const FED_ADMIN_ACCESS_HOURS = Object.freeze([1, 2, 4, 8]);

/** Os papéis da equipe (D3: os 8 das federações reais; dá para usar só dois). */
export const STAFF_ROLE = Object.freeze({
  PRESIDENT: 'president',
  DIRECTOR: 'director',
  SECRETARY: 'secretary',
  TREASURER: 'treasurer',
  COMPETITIONS: 'competitions',
  REFEREES: 'referees',
  DISCIPLINE: 'discipline',
  COMMUNICATION: 'communication',
  FISCAL_COUNCIL: 'fiscal_council',
});

export const STAFF_ROLE_LABELS = Object.freeze({
  president: tk('Presidente'),
  director: tk('Diretor(a)'),
  secretary: tk('Secretaria'),
  treasurer: tk('Financeiro'),
  competitions: tk('Competições'),
  referees: tk('Arbitragem e cursos'),
  discipline: tk('Disciplina'),
  communication: tk('Comunicação'),
  fiscal_council: tk('Conselho fiscal'),
});

export const STAFF_ROLE_DESCRIPTIONS = Object.freeze({
  president: tk('Admin master: tudo, inclusive montar os cargos e passar a administração.'),
  director: tk('Tudo na Central, menos montar os cargos e mexer nos admins master.'),
  secretary: tk('Filiados e acervo: aprova filiações e publica atos, atas e editais.'),
  treasurer: tk('Cobranças: confirma pagamentos e vê o financeiro.'),
  competitions: tk('Chancela de torneios, calendário e ranking oficial.'),
  referees: tk('Cursos, árbitros e credenciais.'),
  discipline: tk('Sanções e ouvidoria.'),
  communication: tk('Avisos, notícias, cupons e campanhas.'),
  fiscal_council: tk('Lê o orçamento e as contas e dá o parecer sobre a prestação de contas.'),
});

const TODAS = Object.values(FED_PERMISSION);

/** Papel → permissões. Fonte única — a cópia da regra (`fedRolePerms`) tem teste de paridade: `src/core/guards/federacaoPermissoes.test.js`. */
export const STAFF_ROLE_PERMISSIONS = Object.freeze({
  president: TODAS,
  director: TODAS,
  secretary: [FED_PERMISSION.MEMBERS, FED_PERMISSION.DOCS],
  treasurer: [FED_PERMISSION.FINANCE],
  competitions: [FED_PERMISSION.COMPETITIONS],
  referees: [FED_PERMISSION.COURSES],
  discipline: [FED_PERMISSION.DISCIPLINE],
  communication: [FED_PERMISSION.COMMS],
  fiscal_council: [FED_PERMISSION.FISCAL],
});

/**
 * As funcionalidades internas que CADA federação liga para si (sub-flags).
 * `available` já tem tela; `planned` aparece como "em breve" e não liga.
 * A filiação, a cobrança e a carteirinha não são módulo: toda federação tem.
 * `central`/`tab`/`page`: onde o módulo aparece quando ligado (a tela de
 * Módulos mostra e leva até lá; `tab` é um valor de aba da Central).
 */
export const FED_MODULE = Object.freeze({
  TOURNAMENTS: 'tournaments',
  RANKING: 'ranking',
  AFFILIATIONS: 'affiliations',
  COURSES: 'courses',
  DISCIPLINE: 'discipline',
  NEWS: 'news',
  SPONSORS: 'sponsors',
  STORE: 'store',
  PROMOS: 'promos',
  OFFICIAL_DOCS: 'official_docs',
  CALENDAR: 'calendar',
  REFEREES: 'referees',
  ACCOUNTS: 'accounts',
  ELECTIONS: 'elections',
});

export const FED_MODULE_META = Object.freeze({
  tournaments: { label: tk('Torneios chancelados'), description: tk('Organizadores pedem a chancela; a federação aprova e o torneio ganha o selo e as regras dela.'), status: 'available', central: tk('Competições → Chancelas e Resultados'), tab: 'chancelas', page: tk('Aba Competições: os torneios chancelados') },
  ranking: { label: tk('Ranking oficial'), description: tk('Pontos dos torneios chancelados por temporada, classe e faixa etária.'), status: 'available', requires: 'tournaments', central: tk('Competições → Ranking'), tab: 'ranking', page: tk('Aba Competições: o ranking oficial') },
  affiliations: { label: tk('Clubes e arenas filiados'), description: tk('Clubes e arenas pedem filiação e aparecem como filiados na página da federação.'), status: 'available', central: tk('Filiados → Clubes e arenas'), tab: 'filiados-orgs', page: tk('Aba Clubes e arenas') },
  courses: { label: tk('Cursos e credenciais'), description: tk('Cursos de arbitragem e capacitação, com certificado verificável.'), status: 'available', central: tk('Cursos (cursos e credenciais)'), tab: 'cursos', page: tk('Aba Cursos') },
  discipline: { label: tk('Disciplina e ouvidoria'), description: tk('Sanções com efeito nas inscrições e canal de denúncia com protocolo.'), status: 'available', central: tk('Disciplina (sanções e ouvidoria)'), tab: 'sancoes', page: tk('Aba Contato e ouvidoria') },
  news: { label: tk('Notícias e avisos'), description: tk('Notícias na página pública e avisos aos filiados.'), status: 'available', central: tk('Comunicação → Notícias'), tab: 'noticias', page: tk('Aba Notícias e a visão geral') },
  sponsors: { label: tk('Patrocinadores'), description: tk('Logos dos patrocinadores na página e na carteirinha.'), status: 'available', central: tk('Comunicação → Patrocinadores'), tab: 'patrocinadores', page: tk('Visão geral e carteirinha') },
  store: { label: tk('Loja oficial no Mercado'), description: tk('A federação vende uniforme e material pelo Mercado.'), status: 'available', central: tk('Configurações → Loja'), tab: 'loja', page: tk('Visão geral: o link da loja oficial') },
  promos: { label: tk('Cupons e campanhas'), description: tk('Cupons de desconto e vales para filiados, banners na página e na tela inicial.'), status: 'available', central: tk('Comunicação → Cupons e campanhas'), tab: 'divulgacao', page: tk('Visão geral e tela inicial') },
  official_docs: { label: tk('Acervo oficial e transparência'), description: tk('Normas, regulamentos, atos numerados, atas, editais e prestação de contas, com versões, código de integridade e página de transparência.'), status: 'available', central: tk('Acervo oficial (documentos e transparência)'), tab: 'acervo', page: tk('Aba Documentos e a página de transparência') },
  calendar: { label: tk('Calendário oficial'), description: tk('Agenda esportiva e institucional (assembleias, diretoria, conselho fiscal, prazos e eventos), com torneios chancelados, adiamentos com motivo e agenda para assinar no celular.'), status: 'available', central: tk('Agenda (calendário oficial)'), tab: 'agenda', page: tk('Aba Agenda e a agenda para assinar') },
  elections: { label: tk('Eleições'), description: tk('Edital, colégio eleitoral com pesos, chapas, impugnações, votação secreta pelo app, apuração e resultado publicado.'), status: 'available', central: tk('Eleições'), tab: 'eleicoes', page: tk('Aba Eleições: edital, chapas e resultado') },
  referees: { label: tk('Arbitragem'), description: tk('Quadro de árbitros por nível, disponibilidade, escalas com convocação e confirmação, impedimentos, avaliação, súmulas e diárias.'), status: 'available', central: tk('Arbitragem (quadro e escalas)'), tab: 'arbitragem', page: tk('Aba Competições: o quadro de arbitragem') },
  accounts: { label: tk('Orçamento e prestação de contas'), description: tk('Orçamento anual por categoria, receitas e despesas lançadas, orçado × realizado, parecer do conselho fiscal e contas publicadas na transparência.'), status: 'available', central: tk('Contas (orçamento e prestação de contas)'), tab: 'orcamento', page: tk('Página de transparência: orçamento e contas') },
});

/* ---------------------------------------------------- PR 4: notícias -- */

/** Estado da notícia. Só `published` sai da Central. */
export const NEWS_STATUS = Object.freeze({
  DRAFT: 'draft',
  // Publica sozinha na hora marcada (`publish_at_ms`), pela varredura `federationNewsPublish`.
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

export const NEWS_STATUS_LABELS = Object.freeze({
  draft: tk('Rascunho'),
  scheduled: tk('Agendada'),
  published: tk('Publicada'),
  archived: tk('Arquivada'),
});

/** Para quem a notícia é: todo mundo (página pública) ou só os filiados ativos. */
export const NEWS_AUDIENCE = Object.freeze({
  PUBLIC: 'public',
  MEMBERS: 'members',
});

export const NEWS_AUDIENCE_LABELS = Object.freeze({
  public: tk('Pública'),
  members: tk('Só filiados'),
});

/** Faixa do patrocinador (ordem na página e na carteirinha). */
export const SPONSOR_TIER = Object.freeze({
  MAIN: 'main',
  SUPPORT: 'support',
  PARTNER: 'partner',
});

export const SPONSOR_TIER_LABELS = Object.freeze({
  main: tk('Patrocinador oficial'),
  support: tk('Apoio'),
  partner: tk('Parceiro'),
});

/** Para quem é o plano. */
export const PLAN_PERSON_TYPE = Object.freeze({
  ATHLETE: 'athlete',
  COACH: 'coach',
  REFEREE: 'referee',
});

export const PLAN_PERSON_TYPE_LABELS = Object.freeze({
  athlete: tk('Atleta'),
  coach: tk('Professor(a)'),
  referee: tk('Árbitro(a)'),
});

/** Nível de vínculo: cadastrado (grátis) ou filiado (paga e pontua). O valor gravado segue `federated`. */
export const PLAN_TIER = Object.freeze({
  REGISTERED: 'registered',
  FEDERATED: 'federated',
});

export const PLAN_TIER_LABELS = Object.freeze({
  registered: tk('Cadastrado'),
  federated: tk('Filiado'),
});

/** Como se paga: mensalidade ou anuidade. */
export const PLAN_BILLING = Object.freeze({
  MONTHLY: 'monthly',
  ANNUAL: 'annual',
});

export const PLAN_BILLING_LABELS = Object.freeze({
  monthly: tk('Mensal'),
  annual: tk('Anual'),
});

/** A anuidade vale 12 meses do pagamento ou até uma data fixa do ano (D8). */
export const PLAN_VALIDITY = Object.freeze({
  ROLLING: 'rolling',
  CALENDAR: 'calendar',
});

export const PLAN_VALIDITY_LABELS = Object.freeze({
  rolling: tk('12 meses a partir do pagamento'),
  calendar: tk('Até uma data fixa do ano'),
});

/**
 * Estado da filiação. Só o SERVIDOR muda — o atleta não "se aprova".
 * `expired` é gravado pela varredura diária; antes disso, a tela deriva
 * "vencida" da data (`membershipState`).
 */
export const MEMBER_STATUS = Object.freeze({
  PENDING: 'pending',
  AWAITING_PAYMENT: 'awaiting_payment',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
});

export const MEMBER_STATUS_LABELS = Object.freeze({
  pending: tk('Aguardando aprovação'),
  awaiting_payment: tk('Aguardando pagamento'),
  active: tk('Em dia'),
  expired: tk('Vencida'),
  suspended: tk('Suspensa'),
  cancelled: tk('Cancelada'),
  rejected: tk('Recusada'),
});

/** Cobrança: aberta → declarada pelo pagador → confirmada pelo financeiro. */
export const CHARGE_STATUS = Object.freeze({
  OPEN: 'open',
  DECLARED: 'declared',
  PAID: 'paid',
  CANCELLED: 'cancelled',
});

export const CHARGE_STATUS_LABELS = Object.freeze({
  open: tk('Em aberto'),
  declared: tk('Pagamento informado'),
  paid: tk('Pago'),
  cancelled: tk('Cancelada'),
});

/** O que gerou a cobrança. */
export const CHARGE_ORIGIN = Object.freeze({
  MEMBERSHIP: 'membership',
  RENEWAL: 'renewal',
  COURSE: 'course',
  FINE: 'fine',
});

export const CHARGE_ORIGIN_LABELS = Object.freeze({
  membership: tk('Filiação'),
  renewal: tk('Renovação'),
  course: tk('Curso'),
  fine: tk('Multa'),
});

/** Dias antes do vencimento em que a renovação é oferecida e avisada. */
export const RENEWAL_WINDOW_DAYS = 30;
/** Avisos de vencimento (dias antes). */
export const EXPIRY_NOTICE_DAYS = Object.freeze([30, 7, 1]);
/** Dias para o pagador declarar antes de a cobrança em aberto ser cancelada. */
export const CHARGE_DUE_DAYS = 10;

/** Filiação de CLUBE ou ARENA à federação (módulo `affiliations`). */
export const ORG_KIND = Object.freeze({ CLUB: 'club', ARENA: 'arena' });
export const ORG_KIND_LABELS = Object.freeze({ club: tk('Clube'), arena: tk('Arena') });

export const AFFILIATION_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
  /** A FEDERAÇÃO convidou; quem gere o clube/arena aceita (vira filiado) ou recusa. */
  INVITED: 'invited',
});

export const AFFILIATION_STATUS_LABELS = Object.freeze({
  pending: tk('Aguardando aprovação'),
  approved: tk('Filiado'),
  rejected: tk('Recusado'),
  suspended: tk('Suspenso'),
  invited: tk('Convite da federação'),
});

/** Chancela de um torneio (módulo `tournaments`): o organizador PEDE, a federação decide. */
export const SANCTION_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVOKED: 'revoked',
});

export const SANCTION_STATUS_LABELS = Object.freeze({
  pending: tk('Chancela pedida'),
  approved: tk('Chancelado'),
  rejected: tk('Chancela recusada'),
  revoked: tk('Chancela revogada'),
});

/** Peso do torneio no ranking oficial (multiplicador dos pontos). */
export const SANCTION_TIER = Object.freeze({
  REGIONAL: 'regional',
  STATE: 'state',
  MAJOR: 'major',
});

export const SANCTION_TIER_LABELS = Object.freeze({
  regional: tk('Etapa regional'),
  state: tk('Etapa estadual'),
  major: tk('Campeonato principal'),
});

/** Resultado de categoria enviado ao ranking oficial. */
export const RESULT_STATUS = Object.freeze({ SENT: 'sent', REJECTED: 'rejected' });

export const RESULT_STATUS_LABELS = Object.freeze({
  sent: tk('No ranking'),
  rejected: tk('Recusado pela federação'),
});

/** Lançamento de pontos no histórico do atleta (`federation_points`) — valor gravado. */
export const POINTS_STATUS = Object.freeze({ AWARDED: 'awarded', CANCELLED: 'cancelled' });

/** Por que um lançamento foi cancelado (valor gravado — nunca renomeie). */
export const POINTS_CANCEL_REASON = Object.freeze({
  RESULT_REJECTED: 'result_rejected',
  RESULT_DELETED: 'result_deleted',
  NOT_IN_RESULT: 'not_in_result',
  ACCOUNT_DELETED: 'account_deleted',
});

export const POINTS_CANCEL_REASON_LABELS = Object.freeze({
  result_rejected: tk('Resultado recusado pela federação'),
  result_deleted: tk('Resultado retirado do ranking'),
  not_in_result: tk('Saiu do resultado reenviado'),
  account_deleted: tk('Conta excluída'),
});

/**
 * Como o ranking oficial pontua, por padrão. A federação troca tudo em
 * Central → Competições → Ranking (`federations.ranking_config`); a cópia do
 * servidor (`functions/federationRanking.js`) tem teste de paridade.
 */
export const DEFAULT_RANKING_CONFIG = Object.freeze({
  /** Pontos por colocação (1º…8º); abaixo disso vale `participation`. */
  points_by_place: Object.freeze({ 1: 100, 2: 70, 3: 50, 4: 40, 5: 30, 6: 30, 7: 25, 8: 25 }),
  /** Pontos por ter jogado a categoria (quem ficou fora dos 8). */
  participation: 10,
  /** Quantos melhores resultados somam na temporada (0 = todos). */
  best_n: 6,
  /** Peso por tipo de torneio. */
  tier_multipliers: Object.freeze({ regional: 1, state: 1.5, major: 2 }),
  /** Só o federado em dia na data do torneio pontua (D12). `false` = todo mundo pontua. */
  members_only: true,
});

/* ------------------------------------------------- PR 3: dados privados -- */

/** Menor de 18 é menor; abaixo disto só o RESPONSÁVEL filia (D7). */
export const MINOR_AGE = 18;
export const GUARDIAN_ONLY_AGE = 12;

/** Documentos que um plano pode exigir (`requires_docs[]`) — valor gravado. */
export const DOC_KIND = Object.freeze({
  ID: 'identidade',
  MEDICAL: 'atestado',
  ADDRESS: 'comprovante_residencia',
  GUARDIAN: 'autorizacao_responsavel',
  OTHER: 'outro',
});

export const DOC_KIND_LABELS = Object.freeze({
  identidade: tk('Documento de identidade'),
  atestado: tk('Atestado médico'),
  comprovante_residencia: tk('Comprovante de residência'),
  autorizacao_responsavel: tk('Autorização do responsável'),
  outro: tk('Outro documento'),
});

export const DOC_STATUS = Object.freeze({ PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' });
export const DOC_STATUS_LABELS = Object.freeze({ pending: tk('Em análise'), approved: tk('Aceito'), rejected: tk('Recusado') });
/** Tamanho máximo de um documento enviado (a regra do Storage confere). */
export const DOC_MAX_BYTES = 5 * 1024 * 1024;

/* --------------------------------------------------- PR 3: transferência -- */

/** Troca de CLUBE representado (a própria federação decide) ou de FEDERAÇÃO (a antiga libera — D9). */
export const TRANSFER_KIND = Object.freeze({ CLUB: 'club', FEDERATION: 'federation' });
export const TRANSFER_KIND_LABELS = Object.freeze({ club: tk('Troca de clube'), federation: tk('Troca de federação') });

export const TRANSFER_STATUS = Object.freeze({ PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected', CANCELLED: 'cancelled' });
export const TRANSFER_STATUS_LABELS = Object.freeze({
  pending: tk('Aguardando a federação'),
  approved: tk('Aprovada'),
  rejected: tk('Recusada'),
  cancelled: tk('Cancelada'),
});

/** Prazo para a federação antiga responder; silêncio = liberada (D9). */
export const TRANSFER_RELEASE_DAYS = 15;
/** Carência padrão entre transferências (a federação troca em `rules.transfer_cooldown_days`). */
export const TRANSFER_COOLDOWN_DAYS = 90;

/* ------------------------------------------------------- PR 3: importação -- */

export const IMPORT_MAX_ROWS = 500;

/* ----------------------------------------------------------- PR 3: cursos -- */

export const COURSE_KIND = Object.freeze({ REFEREE: 'referee', COACH: 'coach', CLINIC: 'clinic', WORKSHOP: 'workshop' });
export const COURSE_KIND_LABELS = Object.freeze({
  referee: tk('Arbitragem'),
  coach: tk('Formação de treinador'),
  clinic: tk('Clínica'),
  workshop: tk('Workshop'),
});

export const COURSE_STATUS = Object.freeze({ DRAFT: 'draft', OPEN: 'open', CLOSED: 'closed', DONE: 'done', CANCELLED: 'cancelled' });
export const COURSE_STATUS_LABELS = Object.freeze({
  draft: tk('Rascunho'),
  open: tk('Inscrições abertas'),
  closed: tk('Inscrições encerradas'),
  done: tk('Realizado'),
  cancelled: tk('Cancelado'),
});

export const ENROLLMENT_STATUS = Object.freeze({
  AWAITING_PAYMENT: 'awaiting_payment',
  CONFIRMED: 'confirmed',
  PASSED: 'passed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});
export const ENROLLMENT_STATUS_LABELS = Object.freeze({
  awaiting_payment: tk('Aguardando pagamento'),
  confirmed: tk('Inscrito'),
  passed: tk('Aprovado'),
  failed: tk('Não aprovado'),
  cancelled: tk('Cancelada'),
});

export const CREDENTIAL_STATUS = Object.freeze({ ACTIVE: 'active', EXPIRED: 'expired', REVOKED: 'revoked' });
export const CREDENTIAL_STATUS_LABELS = Object.freeze({ active: tk('Válida'), expired: tk('Vencida'), revoked: tk('Revogada') });

/* ------------------------------------------------------- PR 3: disciplina -- */

export const DISCIPLINE_KIND = Object.freeze({ WARNING: 'warning', SUSPENSION: 'suspension', FINE: 'fine', EXCLUSION: 'exclusion' });
export const DISCIPLINE_KIND_LABELS = Object.freeze({
  warning: tk('Advertência'),
  suspension: tk('Suspensão'),
  fine: tk('Multa'),
  exclusion: tk('Exclusão'),
});

/** A sanção: aplicada → (recurso) → mantida / revertida; `ended` quando acaba antes. */
export const DISCIPLINE_STATUS = Object.freeze({ ACTIVE: 'active', APPEALED: 'appealed', UPHELD: 'upheld', OVERTURNED: 'overturned', ENDED: 'ended' });
export const DISCIPLINE_STATUS_LABELS = Object.freeze({
  active: tk('Em vigor'),
  appealed: tk('Com recurso'),
  upheld: tk('Recurso negado'),
  overturned: tk('Revertida'),
  ended: tk('Encerrada'),
});

/** Ouvidoria: o assunto da manifestação. */
export const REPORT_KIND = Object.freeze({ CONDUCT: 'conduct', REFEREE: 'referee', ORGANIZATION: 'organization', OTHER: 'other' });
export const REPORT_KIND_LABELS = Object.freeze({
  conduct: tk('Conduta de atleta ou dirigente'),
  referee: tk('Arbitragem'),
  organization: tk('Organização de torneio'),
  other: tk('Outro assunto'),
});

export const REPORT_STATUS = Object.freeze({ OPEN: 'open', IN_REVIEW: 'in_review', CLOSED: 'closed' });
export const REPORT_STATUS_LABELS = Object.freeze({ open: tk('Recebida'), in_review: tk('Em apuração'), closed: tk('Concluída') });
export const REPORT_MAX_CHARS = 2000;
