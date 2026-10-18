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
});

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
  courses: { label: tk('Cursos e credenciais'), description: tk('Cursos de arbitragem e capacitação, com certificado verificável.'), status: 'planned' },
  discipline: { label: tk('Disciplina e ouvidoria'), description: tk('Sanções com efeito nas inscrições e canal de denúncia com protocolo.'), status: 'planned' },
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
});

export const CHARGE_ORIGIN_LABELS = Object.freeze({
  membership: tk('Filiação'),
  renewal: tk('Renovação'),
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
