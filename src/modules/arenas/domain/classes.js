/**
 * Domínio: aulas e professores da arena.
 *
 * PURO, sem I/O.
 *
 * ## O que faltava
 *
 * **A aula não ocupava a quadra**, embora o catálogo prometesse que "a aula
 * deixa de ser combinada por fora e passa a ocupar a grade". Ela tinha data e
 * horário e nenhuma quadra: dava para marcar aula às 19h e vender a mesma
 * quadra às 19h, e os dois só descobriam no dia.
 *
 * **A aula não tinha professor.** `normalizeClassInput` não guardava
 * `coach_id`: a agenda dizia "aula em grupo, nível iniciante, 19h" e ninguém
 * sabia com quem.
 *
 * **O professor da arena era um nome solto.** `arena_coaches` guardava nome,
 * bio e foto — nenhum vínculo com a conta da pessoa na plataforma. O professor
 * não conseguia ver a própria agenda, e o catálogo prometia exatamente isso.
 */

export const COACH_LEVEL = Object.freeze({
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  PRO: 'pro',
});

export const CLASS_FORMAT = Object.freeze({
  PRIVATE: 'private',
  GROUP: 'group',
  CLINIC: 'clinic',
});

export const CLASS_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

/** Normaliza input de coach. */
export function normalizeCoachInput(input = {}) {
  const errors = {};
  const name = String(input.name || '').trim();
  if (!name) errors.name = 'Nome obrigatório.';
  const level = Object.values(COACH_LEVEL).includes(input.level) ? input.level : COACH_LEVEL.INTERMEDIATE;
  const pricePerHour = Number(input.price_per_hour);
  const bio = String(input.bio || '').trim().slice(0, 1000);
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      name,
      level,
      bio,
      price_per_hour: Number.isFinite(pricePerHour) && pricePerHour >= 0 ? pricePerHour : 0,
      specialties: Array.isArray(input.specialties) ? input.specialties.slice(0, 10) : [],
      photo_url: String(input.photo_url || '').trim(),
      active: input.active !== false,
      /**
       * A conta da pessoa na plataforma.
       *
       * Sem isto o professor da arena era um NOME SOLTO: não conseguia ver a
       * própria agenda, não aparecia como professor para o aluno e o
       * histórico ficava em dois lugares. É opcional porque a arena pode
       * cadastrar quem ainda não tem conta — mas é o vínculo que faz o
       * módulo cumprir o que promete ao professor.
       */
      user_id: String(input.user_id || '').trim() || null,
      /**
       * Professor PARCEIRO (de fora) paga comissão; o da casa, não.
       * `marketplace` é o módulo que trata disso.
       */
      partner: Boolean(input.partner),
    },
  };
}

/** Normaliza input de class. */
export function normalizeClassInput(input = {}) {
  const errors = {};
  const date = String(input.date || '').trim();
  if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) errors.date = 'Data inválida.';
  const start = String(input.start || '').trim();
  if (!start.match(/^\d{2}:\d{2}$/)) errors.start = 'Horário inválido.';
  const end = String(input.end || '').trim();
  if (!end.match(/^\d{2}:\d{2}$/)) errors.end = 'Horário inválido.';
  const maxStudents = Number(input.max_students);
  if (!Number.isFinite(maxStudents) || maxStudents < 1 || maxStudents > 50) errors.max_students = '1-50 alunos.';
  const price = Number(input.price) || 0;
  if (price < 0) errors.price = 'Preço inválido.';
  // Fim antes do início passava batido e virava uma aula de duração negativa,
  // que bloquearia a quadra por nada (ou por tudo, dependendo de quem lê).
  if (!errors.start && !errors.end && end <= start) errors.end = 'A aula termina depois de começar.';
  // Aula sem professor era o padrão: a agenda dizia "grupo, iniciante, 19h" e
  // ninguém sabia com quem. Ainda é opcional (a arena pode marcar antes de
  // saber quem dá), mas agora o campo existe e a tela cobra.
  const coachId = String(input.coach_id || '').trim();
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      date, start, end,
      max_students: Number.isFinite(maxStudents) ? maxStudents : 1,
      price,
      format: Object.values(CLASS_FORMAT).includes(input.format) ? input.format : CLASS_FORMAT.GROUP,
      level: Object.values(COACH_LEVEL).includes(input.level) ? input.level : COACH_LEVEL.BEGINNER,
      notes: String(input.notes || '').trim().slice(0, 500),
      coach_id: coachId || null,
      coach_name: String(input.coach_name || '').trim().slice(0, 80),
      /** A quadra que a aula OCUPA. Vazio = não bloqueia nada. */
      court_id: String(input.court_id || '').trim() || null,
      status: Object.values(CLASS_STATUS).includes(input.status) ? input.status : CLASS_STATUS.SCHEDULED,
    },
  };
}

/** Calcula comissão do instrutor. */
export function calculateCommission(price, pct = 50) {
  if (!Number.isFinite(price) || price < 0) return 0;
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return 0;
  return Math.round(price * pct / 100 * 100) / 100;
}


/* ================================================================== */
/*  A aula OCUPA a quadra                                             */
/* ================================================================== */

export const CLASS_FORMAT_META = Object.freeze({
  [CLASS_FORMAT.PRIVATE]: { label: 'Individual', hint: 'Um aluno, atenção inteira.' },
  [CLASS_FORMAT.GROUP]: { label: 'Em grupo', hint: 'Turma pequena, preço menor por pessoa.' },
  [CLASS_FORMAT.CLINIC]: { label: 'Clínica', hint: 'Evento pontual, com tema.' },
});

export const COACH_LEVEL_META = Object.freeze({
  [COACH_LEVEL.BEGINNER]: { label: 'Iniciante' },
  [COACH_LEVEL.INTERMEDIATE]: { label: 'Intermediário' },
  [COACH_LEVEL.ADVANCED]: { label: 'Avançado' },
  [COACH_LEVEL.PRO]: { label: 'Competição' },
});

/** A aula ainda vai acontecer? Cancelada e concluída não ocupam mais nada. */
export function isClassOpen(cls) {
  return (cls?.status || CLASS_STATUS.SCHEDULED) === CLASS_STATUS.SCHEDULED;
}

/** Quantas vagas ainda há nesta aula. */
export function classSeatsLeft(cls) {
  const teto = Math.max(0, Number(cls?.max_students) || 0);
  const usados = Math.max(0, Number(cls?.enrolled) || 0);
  return Math.max(0, teto - usados);
}

/**
 * Os bloqueios de calendário que as aulas implicam — DERIVADOS.
 *
 * Derivado, e não gravado, pela mesma razão do dia de jogo: `arena_classes` é
 * legível por qualquer conta autenticada, então a tela do atleta monta a
 * verdade a partir da FONTE. Cópia gravada que falhe deixaria o calendário
 * oferecendo uma quadra ocupada — foi o defeito da Onda AF, e não se repete.
 *
 * Aula SEM quadra não bloqueia nada: a arena pode registrar uma aula que
 * acontece na areia ao lado, e fechar a quadra por causa dela seria inventar
 * ocupação.
 *
 * O nome do professor vai no `notes` porque é o que o atleta precisa ler no
 * calendário ("Aula com o Rafa" explica o horário fechado); nome de ALUNO
 * nunca entra — a lista de matriculados não é pública.
 *
 * @param {Array<object>} classes
 * @returns {Array<object>} no formato de `arena_unavailabilities`
 */
export function classBlocks(classes = []) {
  if (!Array.isArray(classes)) return [];
  return classes
    .filter((c) => c && isClassOpen(c) && c.court_id && c.date && c.start && c.end)
    .map((c) => ({
      id: `aula:${c.id}`,
      derivado: true,
      arena_id: c.arena_id,
      court_id: c.court_id,
      date: c.date,
      start_time: c.start,
      end_time: c.end,
      source: 'class',
      class_id: c.id,
      notes: c.coach_name ? `Aula com ${c.coach_name}` : 'Aula',
    }));
}

/** A identidade de um bloqueio de aula, para não contar o mesmo duas vezes. */
function chaveDaAula(b) {
  return [b?.class_id, b?.court_id, b?.date, b?.start_time, b?.end_time].join('|');
}

/**
 * Os bloqueios que a tela já tem mais os que as aulas implicam.
 *
 * Use para calcular STATUS. **Não** use para LISTAR bloqueios numa tela de
 * gestão — o derivado não tem documento.
 */
export function mergeClassBlocks(blocks = [], classes = []) {
  const base = Array.isArray(blocks) ? blocks : [];
  const jaTem = new Set(base.filter((b) => b?.class_id).map(chaveDaAula));
  const faltando = classBlocks(classes).filter((b) => !jaTem.has(chaveDaAula(b)));
  return faltando.length === 0 ? base : [...base, ...faltando];
}

/* ================================================================== */
/*  Pacote de aulas                                                   */
/* ================================================================== */

/** Quantas aulas cabem num pacote. Mais que isso vira mensalidade. */
export const CLASS_PACKAGE_MAX = 24;

/**
 * O preço e o desconto de um pacote de N aulas.
 *
 * O argumento de venda do pacote é o preço POR AULA — "R$ 90 a aula, contra
 * R$ 110 avulsa". Sem esse número na tela o aluno compara um total grande com
 * um valor pequeno e desiste.
 *
 * @param {{ sessions?: number, price?: number, single_price?: number }} pkg
 * @returns {{ sessions: number, price: number, perSession: number, savingPct: number }}
 */
export function classPackagePrice(pkg = {}) {
  const sessions = Math.max(1, Math.min(CLASS_PACKAGE_MAX, Math.trunc(Number(pkg.sessions) || 1)));
  const price = Math.max(0, Math.round((Number(pkg.price) || 0) * 100) / 100);
  const perSession = Math.round((price / sessions) * 100) / 100;
  const avulsa = Math.max(0, Number(pkg.single_price) || 0);
  const savingPct = avulsa > 0 && perSession < avulsa
    ? Math.round(((avulsa - perSession) / avulsa) * 100)
    : 0;
  return { sessions, price, perSession, savingPct };
}

/**
 * Quantas aulas do pacote ainda restam.
 * `used` nunca passa de `sessions` — um saldo negativo na tela assusta e não
 * ajuda ninguém.
 */
export function classPackageLeft(booking) {
  const total = Math.max(0, Number(booking?.sessions) || 0);
  const usadas = Math.max(0, Number(booking?.sessions_used) || 0);
  return Math.max(0, total - usadas);
}

/* ================================================================== */
/*  Comissão                                                          */
/* ================================================================== */

/** O que a arena fica, por padrão, numa aula de professor parceiro. */
export const DEFAULT_ARENA_COMMISSION_PCT = 20;

/**
 * A divisão de uma aula entre a arena e o professor.
 *
 * A comissão vem da CONFIGURAÇÃO do módulo (`marketplace.commission_pct`), não
 * de um número no código: o serviço gravava 50% fixo, ignorando o que a arena
 * tinha configurado — e 50% é muito diferente dos 20% padrão.
 *
 * Professor da CASA não paga comissão: o dinheiro já é da arena. Cobrar
 * comissão de si mesma faria o relatório mentir.
 *
 * @param {number} price
 * @param {{ commissionPct?: number, partner?: boolean }} [opts]
 * @returns {{ total: number, arena: number, coach: number, pct: number }}
 */
export function classSplit(price, { commissionPct = DEFAULT_ARENA_COMMISSION_PCT, partner = true } = {}) {
  const total = Math.max(0, Math.round((Number(price) || 0) * 100) / 100);
  const pct = partner
    ? Math.min(90, Math.max(0, Number(commissionPct) || 0))
    : 0;
  const arena = Math.round(total * (pct / 100) * 100) / 100;
  return { total, arena, coach: Math.round((total - arena) * 100) / 100, pct };
}
