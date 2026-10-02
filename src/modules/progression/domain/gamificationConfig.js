/**
 * gamificationConfig — a configuração da gamificação que o ADMIN controla.
 *
 * Mora em `platform_settings/gamification` (coleção que já existe: leitura
 * pública, escrita só do admin). Documento ausente = padrões abaixo, então a
 * gamificação funciona sem ninguém ter configurado nada — e o admin só mexe no
 * que quer mudar.
 *
 * A flag `gamification_v2` continua sendo o interruptor MESTRE. Esta
 * configuração é o que o admin ajusta DENTRO dela: ligar ou desligar cada
 * módulo, os prêmios da temporada e do duelo, os limiares do antifarm. Cada
 * valor aqui é lido por quem o impõe (a tela esconde o módulo desligado; o
 * servidor lê os prêmios e os limiares) — nenhum é decorativo.
 *
 * Lógica pura, sem I/O.
 */

/**
 * Os módulos que o admin pode ligar/desligar. O id é CONTRATO (está gravado no
 * documento de configuração): nunca renomeie.
 *
 * @type {Readonly<Record<string, { label: string, description: string, grupo: string }>>}
 */
export const GAMIFICATION_MODULES = Object.freeze({
  missions_weekly: {
    label: 'Missões da semana',
    description: 'Cinco missões por semana, medidas pela atividade real, com bônus ao completar todas.',
    grupo: 'jornada',
  },
  missions_monthly: {
    label: 'Missões do mês',
    description: 'Missões longas, de acompanhamento mensal, com bônus ao completar todas.',
    grupo: 'jornada',
  },
  onboarding: {
    label: 'Primeiros passos',
    description: 'O roteiro dos primeiros dias para quem acabou de chegar, com XP por etapa.',
    grupo: 'jornada',
  },
  weekly_review: {
    label: 'Revisão da semana e do mês',
    description: 'O resumo do que a pessoa fez, com marcos e comparação com o período anterior.',
    grupo: 'jornada',
  },
  celebrations: {
    label: 'Celebrações (marcos)',
    description: 'Avisos de comemoração quando alguém sobe de tier, bate recorde ou conquista algo raro.',
    grupo: 'jornada',
  },
  hall_of_fame: {
    label: 'Hall da Fama e temporada',
    description: 'Placar público da temporada, com nome e foto de quem aceitou aparecer.',
    grupo: 'competicao',
  },
  duels: {
    label: 'Duelo da semana',
    description: 'Cada semana o servidor emparelha atletas de nível parecido para um duelo de vitórias.',
    grupo: 'competicao',
  },
  challenges: {
    label: 'Desafios e eventos',
    description: 'Desafios da plataforma, de clubes, de arenas e de professores, com placar e prêmios.',
    grupo: 'competicao',
  },
  rewards: {
    label: 'Recompensas',
    description: 'Benefícios reais (aula experimental, desconto, prioridade) liberados por marcos.',
    grupo: 'competicao',
  },
  match_reviews: {
    label: 'Avaliação pós-jogo',
    description: 'Depois do jogo, cada lado avalia o companheiro e os adversários com estrelas e tags.',
    grupo: 'social',
  },
  partner_letters: {
    label: 'Carta ao companheiro',
    description: 'Uma frase para o parceiro de dupla, anônima por padrão.',
    grupo: 'social',
  },
  social_bonds: {
    label: 'Rivais, crews e mentorias',
    description: 'Vínculos entre atletas: rivalidade saudável, grupos de dupla e mentoria.',
    grupo: 'social',
  },
  supply_panels: {
    label: 'Engajamento de professores, arenas e clubes',
    description: 'Health score, metas do mês e sugestões para quem oferece aulas, quadras e comunidade.',
    grupo: 'oferta',
  },
});

export const GAMIFICATION_MODULE_GROUPS = Object.freeze([
  { id: 'jornada', label: 'Jornada do atleta' },
  { id: 'competicao', label: 'Competição e recompensas' },
  { id: 'social', label: 'Social' },
  { id: 'oferta', label: 'Quem oferece (professor, arena, clube)' },
]);

/** Padrões de tudo o que é numérico. Cada um tem faixa válida em `LIMITES`. */
export const DEFAULT_GAMIFICATION_CONFIG = Object.freeze({
  schemaVersion: 1,
  /** módulo → ligado. Ausente = ligado (a flag mestra já é o freio). */
  modules: Object.freeze(Object.fromEntries(
    Object.keys(GAMIFICATION_MODULES).map((id) => [id, true]),
  )),
  /** Prêmios de XP da temporada mensal, lidos pelo servidor ao fechar o mês. */
  season: Object.freeze({
    prizeTop1: 1000,
    prizeTop10Percent: 500,
    prizeParticipation: 50,
    /** Tier mínimo para aparecer no placar público. */
    publicMinTier: 'Jogador',
  }),
  duels: Object.freeze({
    winnerXp: 200,
    participationXp: 50,
    /** Quantos pontos de nível (2.0–8.0) a dupla do duelo pode ter de diferença. */
    maxLevelGap: 1.0,
  }),
  reviews: Object.freeze({
    /** Quantas avaliações a pessoa precisa ter para a nota virar pública. */
    minForPublicScore: 5,
    /** Quantos dias depois do jogo ainda dá para avaliar. */
    windowDays: 14,
  }),
  /** Limiares do antifarm — o servidor marca para revisão, nunca pune sozinho. */
  antiFarm: Object.freeze({
    xpJumpPerDay: 5000,
    kudosRingMin: 5,
    /** XP acima do que a atividade verificada pelo servidor sustenta (fator). */
    unverifiedXpFactor: 3,
  }),
  notifications: Object.freeze({
    weeklyReview: true,
    duels: true,
    challengeResults: true,
  }),
});

/** Faixa válida de cada número editável (o admin não consegue sair dela). */
export const GAMIFICATION_CONFIG_LIMITS = Object.freeze({
  'season.prizeTop1': [0, 5000],
  'season.prizeTop10Percent': [0, 5000],
  'season.prizeParticipation': [0, 1000],
  'duels.winnerXp': [0, 1000],
  'duels.participationXp': [0, 500],
  'duels.maxLevelGap': [0.25, 3],
  'reviews.minForPublicScore': [3, 20],
  'reviews.windowDays': [1, 60],
  'antiFarm.xpJumpPerDay': [500, 50000],
  'antiFarm.kudosRingMin': [3, 30],
  'antiFarm.unverifiedXpFactor': [1.5, 10],
});

const TIERS_PUBLICOS = ['Calouro', 'Aprendiz', 'Jogador', 'Regular', 'Veterano', 'Expert', 'Elite', 'Lenda', 'Imortal'];

function numero(valor, padrao, [min, max]) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, n));
}

function inteiro(valor, padrao, faixa) {
  return Math.round(numero(valor, padrao, faixa));
}

function bool(valor, padrao) {
  return typeof valor === 'boolean' ? valor : padrao;
}

/**
 * Normaliza o documento lido do banco: preenche o que falta com os padrões,
 * limita cada número à sua faixa e descarta o que não é conhecido. Nunca lança
 * — configuração quebrada não pode derrubar a gamificação.
 *
 * @param {object|null|undefined} bruto
 * @returns {typeof DEFAULT_GAMIFICATION_CONFIG}
 */
export function normalizeGamificationConfig(bruto) {
  const d = DEFAULT_GAMIFICATION_CONFIG;
  const src = bruto && typeof bruto === 'object' ? bruto : {};
  const L = GAMIFICATION_CONFIG_LIMITS;
  const mods = src.modules && typeof src.modules === 'object' ? src.modules : {};
  return {
    schemaVersion: 1,
    modules: Object.fromEntries(
      Object.keys(GAMIFICATION_MODULES).map((id) => [id, bool(mods[id], d.modules[id])]),
    ),
    season: {
      prizeTop1: inteiro(src.season?.prizeTop1, d.season.prizeTop1, L['season.prizeTop1']),
      prizeTop10Percent: inteiro(src.season?.prizeTop10Percent, d.season.prizeTop10Percent, L['season.prizeTop10Percent']),
      prizeParticipation: inteiro(src.season?.prizeParticipation, d.season.prizeParticipation, L['season.prizeParticipation']),
      publicMinTier: TIERS_PUBLICOS.includes(src.season?.publicMinTier) ? src.season.publicMinTier : d.season.publicMinTier,
    },
    duels: {
      winnerXp: inteiro(src.duels?.winnerXp, d.duels.winnerXp, L['duels.winnerXp']),
      participationXp: inteiro(src.duels?.participationXp, d.duels.participationXp, L['duels.participationXp']),
      maxLevelGap: numero(src.duels?.maxLevelGap, d.duels.maxLevelGap, L['duels.maxLevelGap']),
    },
    reviews: {
      minForPublicScore: inteiro(src.reviews?.minForPublicScore, d.reviews.minForPublicScore, L['reviews.minForPublicScore']),
      windowDays: inteiro(src.reviews?.windowDays, d.reviews.windowDays, L['reviews.windowDays']),
    },
    antiFarm: {
      xpJumpPerDay: inteiro(src.antiFarm?.xpJumpPerDay, d.antiFarm.xpJumpPerDay, L['antiFarm.xpJumpPerDay']),
      kudosRingMin: inteiro(src.antiFarm?.kudosRingMin, d.antiFarm.kudosRingMin, L['antiFarm.kudosRingMin']),
      unverifiedXpFactor: numero(src.antiFarm?.unverifiedXpFactor, d.antiFarm.unverifiedXpFactor, L['antiFarm.unverifiedXpFactor']),
    },
    notifications: {
      weeklyReview: bool(src.notifications?.weeklyReview, d.notifications.weeklyReview),
      duels: bool(src.notifications?.duels, d.notifications.duels),
      challengeResults: bool(src.notifications?.challengeResults, d.notifications.challengeResults),
    },
  };
}

/** O módulo está ligado nesta configuração? Módulo desconhecido = desligado. */
export function isModuleOn(config, moduleId) {
  if (!Object.prototype.hasOwnProperty.call(GAMIFICATION_MODULES, moduleId)) return false;
  return (config || DEFAULT_GAMIFICATION_CONFIG).modules?.[moduleId] !== false;
}

/**
 * Diferenças entre duas configurações, para a auditoria dizer o que mudou
 * (e o admin enxergar o que está prestes a salvar).
 *
 * @returns {Array<{ chave: string, de: unknown, para: unknown }>}
 */
export function diffGamificationConfig(antes, depois) {
  const a = normalizeGamificationConfig(antes);
  const b = normalizeGamificationConfig(depois);
  const out = [];
  const achatar = (obj, prefixo = '') => Object.entries(obj).flatMap(([k, v]) => (
    v && typeof v === 'object' ? achatar(v, `${prefixo}${k}.`) : [[`${prefixo}${k}`, v]]
  ));
  const mapaA = new Map(achatar(a));
  achatar(b).forEach(([chave, valor]) => {
    if (mapaA.get(chave) !== valor) out.push({ chave, de: mapaA.get(chave), para: valor });
  });
  return out;
}
