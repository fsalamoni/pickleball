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
  plans: 'federation_plans',
  members: 'federation_members',
  charges: 'federation_charges',
  cardIndex: 'federation_card_index',
  affiliations: 'federation_affiliations',
  results: 'federation_results',
  rankings: 'federation_rankings',
  transfers: 'federation_transfers',
  documents: 'federation_documents_submitted',
  imports: 'federation_imports',
  courses: 'federation_courses',
  enrollments: 'federation_course_enrollments',
  credentials: 'federation_credentials',
  sanctions: 'federation_sanctions',
  reports: 'federation_reports',
});

/** Id determinístico da inscrição em curso: `{courseId}_{uid}`. */
export const fedEnrollmentDocId = (courseId, uid) => `${courseId}_${uid}`;

/** Id determinístico da filiação de clube/arena: `{fedId}_{club|arena}_{orgId}`. */
export const fedOrgDocId = (fedId, kind, orgId) => `${fedId}_${kind}_${orgId}`;
/** Id determinístico do resultado enviado: `{fedId}_{tournamentId}_{modalityId}`. */
export const fedResultDocId = (fedId, tournamentId, modalityId) => `${fedId}_${tournamentId}_${modalityId}`;
/** Id determinístico do ranking da temporada: `{fedId}_{ano}`. */
export const fedRankingDocId = (fedId, season) => `${fedId}_${season}`;

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
});

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
});

export const STAFF_ROLE_DESCRIPTIONS = Object.freeze({
  president: tk('Tudo. Só o presidente (ou o admin da plataforma) troca o presidente.'),
  director: tk('Tudo, menos trocar o presidente.'),
  secretary: tk('Filiados: aprova, recusa, suspende e vê os pedidos.'),
  treasurer: tk('Cobranças: confirma pagamentos e vê o financeiro.'),
  competitions: tk('Chancela de torneios, calendário e ranking oficial.'),
  referees: tk('Cursos, árbitros e credenciais.'),
  discipline: tk('Sanções e ouvidoria.'),
  communication: tk('Avisos, notícias, cupons e campanhas.'),
});

const TODAS = Object.values(FED_PERMISSION);

/** Papel → permissões. Fonte única — a cópia da regra (`fedHas`) tem teste de paridade. */
export const STAFF_ROLE_PERMISSIONS = Object.freeze({
  president: TODAS,
  director: TODAS,
  secretary: [FED_PERMISSION.MEMBERS],
  treasurer: [FED_PERMISSION.FINANCE],
  competitions: [FED_PERMISSION.COMPETITIONS],
  referees: [FED_PERMISSION.COURSES],
  discipline: [FED_PERMISSION.DISCIPLINE],
  communication: [FED_PERMISSION.COMMS],
});

/**
 * As funcionalidades internas que CADA federação liga para si (sub-flags).
 * `available` já tem tela; `planned` aparece como "em breve" e não liga.
 * A filiação, a cobrança e a carteirinha não são módulo: toda federação tem.
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
});

export const FED_MODULE_META = Object.freeze({
  tournaments: { label: tk('Torneios chancelados'), description: tk('Organizadores pedem a chancela; a federação aprova e o torneio ganha o selo e as regras dela.'), status: 'available' },
  ranking: { label: tk('Ranking oficial'), description: tk('Pontos dos torneios chancelados por temporada, classe e faixa etária.'), status: 'available' },
  affiliations: { label: tk('Clubes e arenas filiados'), description: tk('Clubes e arenas pedem filiação e aparecem como filiados na página da federação.'), status: 'available' },
  courses: { label: tk('Cursos e credenciais'), description: tk('Cursos de arbitragem e capacitação, com certificado verificável.'), status: 'available' },
  discipline: { label: tk('Disciplina e ouvidoria'), description: tk('Sanções com efeito nas inscrições e canal de denúncia com protocolo.'), status: 'available' },
  news: { label: tk('Notícias e avisos'), description: tk('Notícias na página pública e avisos aos filiados.'), status: 'planned' },
  sponsors: { label: tk('Patrocinadores'), description: tk('Logos dos patrocinadores na página e na carteirinha.'), status: 'planned' },
  store: { label: tk('Loja oficial no Mercado'), description: tk('A federação vende uniforme e material pelo Mercado.'), status: 'planned' },
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

/** Nível de vínculo: cadastrado (grátis) ou federado (paga e pontua). */
export const PLAN_TIER = Object.freeze({
  REGISTERED: 'registered',
  FEDERATED: 'federated',
});

export const PLAN_TIER_LABELS = Object.freeze({
  registered: tk('Cadastrado'),
  federated: tk('Federado'),
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
});

export const AFFILIATION_STATUS_LABELS = Object.freeze({
  pending: tk('Aguardando aprovação'),
  approved: tk('Filiado'),
  rejected: tk('Recusado'),
  suspended: tk('Suspenso'),
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
