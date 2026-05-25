import { SEED_DEADLINES_BRT } from '@/modules/tournament/data/seedDeadlines';
import { SEED_SCORING_TIERS, SPECIAL_BET_POINTS } from '@/modules/tournament/data/seedScoringTiers';

export const POOL_TEMPLATE_CODES = Object.freeze({
  worldCup2026: 'world_cup_2026',
  custom: 'custom',
});

export const SPORT_PRESETS = Object.freeze({
  soccer: {
    code: 'soccer',
    label: 'Futebol',
    score_label: 'Gols',
    competitor_label: 'Time',
    supports_draw: true,
    supports_penalties: true,
    max_score: 20,
    score_step: 1,
    result_unit: 'gols',
    tie_break_label: 'pênaltis',
    prediction_parameters: ['placar_exato', 'vencedor', 'empate', 'diferenca', 'gols_time', 'penaltis', 'zebra'],
  },
  volleyball: {
    code: 'volleyball',
    label: 'Vôlei',
    score_label: 'Sets',
    competitor_label: 'Equipe',
    supports_draw: false,
    supports_penalties: false,
    max_score: 5,
    score_step: 1,
    result_unit: 'sets',
    tie_break_label: 'set decisivo',
    prediction_parameters: ['placar_exato', 'vencedor', 'diferenca', 'sets_equipe', 'zebra'],
  },
  basketball: {
    code: 'basketball',
    label: 'Basquete',
    score_label: 'Pontos',
    competitor_label: 'Equipe',
    supports_draw: false,
    supports_penalties: false,
    max_score: 200,
    score_step: 1,
    result_unit: 'pontos',
    tie_break_label: 'prorrogação',
    prediction_parameters: ['placar_exato', 'vencedor', 'diferenca', 'pontos_equipe', 'zebra'],
  },
  tennis: {
    code: 'tennis',
    label: 'Tênis',
    score_label: 'Sets',
    competitor_label: 'Jogador(a)/dupla',
    supports_draw: false,
    supports_penalties: false,
    max_score: 5,
    score_step: 1,
    result_unit: 'sets',
    tie_break_label: 'set decisivo',
    prediction_parameters: ['placar_exato', 'vencedor', 'diferenca', 'sets_jogador', 'zebra'],
  },
  pickleball: {
    code: 'pickleball',
    label: 'Pickleball',
    score_label: 'Sets',
    competitor_label: 'Jogador(a)/dupla',
    supports_draw: false,
    supports_penalties: false,
    max_score: 5,
    score_step: 1,
    result_unit: 'games/sets',
    tie_break_label: 'game decisivo',
    prediction_parameters: ['placar_exato', 'vencedor', 'diferenca', 'games_sets', 'zebra'],
  },
  handball: {
    code: 'handball',
    label: 'Handebol',
    score_label: 'Gols',
    competitor_label: 'Equipe',
    supports_draw: true,
    supports_penalties: false,
    max_score: 80,
    score_step: 1,
    result_unit: 'gols',
    tie_break_label: 'prorrogação/tiros de 7m quando cadastrados no placar',
    prediction_parameters: ['placar_exato', 'vencedor', 'empate', 'diferenca', 'gols_equipe', 'zebra'],
  },
  boxing: {
    code: 'boxing',
    label: 'Boxe',
    score_label: 'Pontos/rounds',
    competitor_label: 'Lutador(a)',
    supports_draw: true,
    supports_penalties: false,
    max_score: 12,
    score_step: 1,
    result_unit: 'rounds/pontos',
    tie_break_label: 'decisão dos juízes',
    prediction_parameters: ['placar_exato', 'vencedor', 'empate', 'diferenca', 'rounds_lutador', 'zebra'],
  },
  chess: {
    code: 'chess',
    label: 'Xadrez',
    score_label: 'Pontos da partida',
    competitor_label: 'Jogador(a)',
    supports_draw: true,
    supports_penalties: false,
    max_score: 2,
    score_step: 0.5,
    result_unit: 'pontos da partida',
    tie_break_label: 'desempate cadastrado pelo admin quando houver',
    prediction_parameters: ['placar_exato', 'vencedor', 'empate', 'pontos_jogador', 'zebra'],
  },
  custom: {
    code: 'custom',
    label: 'Outro esporte',
    score_label: 'Placar',
    competitor_label: 'Competidor/equipe',
    supports_draw: true,
    supports_penalties: false,
    max_score: 999,
    score_step: 1,
    result_unit: 'placar',
    tie_break_label: 'desempate definido pelo admin',
    prediction_parameters: ['placar_exato', 'vencedor', 'empate', 'diferenca', 'pontos_competidor', 'zebra'],
  },
});

export const SCORING_EXPLANATION_KEYS = Object.freeze([
  'exact_score',
  'winner_plus_diff',
  'winner_plus_team_goals',
  'winner_only',
  'team_goals_only',
  'penalty_winner',
  'zebra',
  'default_bet',
  'super_bucha',
  'ranking_tiebreakers',
]);

export const SPORT_PARAMETER_LABELS = Object.freeze({
  placar_exato: 'Placar exato',
  vencedor: 'Vencedor',
  empate: 'Empate permitido',
  diferenca: 'Diferença/saldo do placar',
  gols_time: 'Gols por time',
  sets_equipe: 'Sets por equipe',
  pontos_equipe: 'Pontos por equipe',
  sets_jogador: 'Sets por jogador/dupla',
  games_sets: 'Games/sets por lado',
  gols_equipe: 'Gols por equipe',
  rounds_lutador: 'Rounds/pontos por lutador',
  pontos_jogador: 'Pontos por jogador',
  pontos_competidor: 'Pontos por competidor',
  penaltis: 'Desempate por pênaltis',
  zebra: 'Multiplicador de zebra',
});

const REGULAR_STAGE_MULTIPLIER = 1;
const PENULTIMATE_STAGE_MULTIPLIER = 1.5;
const FINAL_STAGE_MULTIPLIER = 2;

// `sf` preserves the existing spreadsheet code for Quartas; `semi` is Semifinais.
export const STAGE_ORDER = ['group', 'r16', 'qf', 'sf', 'semi', 'third', 'final'];

export const CUSTOM_STAGE_TYPES = Object.freeze({
  league: 'league',
  groups: 'groups',
  knockout: 'knockout',
  custom: 'custom',
});

export const CUSTOM_STAGE_PRESETS = Object.freeze([
  {
    code: 'regular',
    label: 'Fase inicial / temporada regular',
    phase_type: CUSTOM_STAGE_TYPES.league,
    section_label: 'Rodada/Grupo',
    allows_tiebreaker: false,
    source_stage_key: null,
  },
  {
    code: 'quarterfinal',
    label: 'Quartas de final',
    phase_type: CUSTOM_STAGE_TYPES.knockout,
    section_label: 'Chave',
    allows_tiebreaker: true,
    source_stage_key: null,
  },
  {
    code: 'semifinal',
    label: 'Semifinal',
    phase_type: CUSTOM_STAGE_TYPES.knockout,
    section_label: 'Chave',
    allows_tiebreaker: true,
    source_stage_key: null,
  },
  {
    code: 'third',
    label: 'Disputa de 3º lugar',
    phase_type: CUSTOM_STAGE_TYPES.knockout,
    section_label: 'Chave',
    allows_tiebreaker: true,
    source_stage_key: null,
  },
  {
    code: 'final',
    label: 'Final',
    phase_type: CUSTOM_STAGE_TYPES.knockout,
    section_label: 'Chave',
    allows_tiebreaker: true,
    source_stage_key: null,
  },
]);

export const DEFAULT_DEADLINE_OVERRIDES = Object.freeze({ ...SEED_DEADLINES_BRT });

export const DEFAULT_SCORING_OVERRIDES = Object.freeze(
  Object.fromEntries(
    SEED_SCORING_TIERS.map(({ stage_code, label, ...points }) => [
      stage_code,
      {
        label,
        ...points,
      },
    ]),
  ),
);

export const DEFAULT_POOL_SETTINGS = Object.freeze({
  scoring_overrides: DEFAULT_SCORING_OVERRIDES,
  deadline_overrides: DEFAULT_DEADLINE_OVERRIDES,
  special_bet_points: SPECIAL_BET_POINTS,
  zebras_enabled: true,
  sport_config: SPORT_PRESETS.soccer,
  custom_stages: CUSTOM_STAGE_PRESETS,
  rules: defaultRules(),
});

export function buildDefaultPoolSettings(templateCode = POOL_TEMPLATE_CODES.worldCup2026, options = {}) {
  const sportConfig = buildSportConfig(options.sport_code || 'soccer', options.sport_name);
  if (templateCode === POOL_TEMPLATE_CODES.custom) {
    return {
      scoring_overrides: buildCustomScoringOverrides(),
      deadline_overrides: {},
      special_bet_points: { champion: 0, top_scorer: 0 },
      zebras_enabled: true,
      sport_config: sportConfig,
      custom_stages: clone(CUSTOM_STAGE_PRESETS),
      rules: defaultRules(sportConfig),
    };
  }
  return {
    scoring_overrides: clone(DEFAULT_SCORING_OVERRIDES),
    deadline_overrides: clone(DEFAULT_DEADLINE_OVERRIDES),
    special_bet_points: clone(SPECIAL_BET_POINTS),
    zebras_enabled: true,
    sport_config: SPORT_PRESETS.soccer,
    custom_stages: clone(CUSTOM_STAGE_PRESETS),
    rules: defaultRules(SPORT_PRESETS.soccer),
  };
}

export function normalizePoolSettings(settings = {}) {
  const sportConfig = normalizeSportConfig(settings.sport_config);
  const customStages = normalizeCustomStages(settings.custom_stages);
  return {
    scoring_overrides: {
      ...clone(DEFAULT_SCORING_OVERRIDES),
      ...buildCustomScoringOverrides(customStages),
      ...(settings.scoring_overrides || {}),
    },
    deadline_overrides: {
      ...clone(DEFAULT_DEADLINE_OVERRIDES),
      ...(settings.deadline_overrides || {}),
    },
    special_bet_points: {
      ...clone(SPECIAL_BET_POINTS),
      ...(settings.special_bet_points || {}),
    },
    zebras_enabled: settings.zebras_enabled !== false,
    sport_config: sportConfig,
    custom_stages: customStages,
    rules: normalizeRules(settings.rules, sportConfig),
  };
}

export function getPoolScoringTiers(pool) {
  const settings = normalizePoolSettings(pool?.settings);
  if (pool?.template_code === POOL_TEMPLATE_CODES.custom) {
    return settings.custom_stages.map((stage) => ({
      stage_code: stage.code,
      label: stage.label,
      ...(settings.scoring_overrides[stage.code] || buildCustomScoringOverrides([stage])[stage.code]),
    }));
  }
  return STAGE_ORDER.map((stageCode) => ({
    stage_code: stageCode,
    ...(settings.scoring_overrides[stageCode] || DEFAULT_SCORING_OVERRIDES[stageCode]),
  }));
}

export function getPoolStages(pool) {
  if (pool?.template_code === POOL_TEMPLATE_CODES.custom) {
    return normalizePoolSettings(pool?.settings).custom_stages;
  }
  return STAGE_ORDER.map((code) => ({ code, label: DEFAULT_SCORING_OVERRIDES[code]?.label || code }));
}

export function getPoolStage(pool, stageCode) {
  return getPoolStages(pool).find((stage) => stage.code === stageCode) || null;
}

export function stageAllowsTiebreaker(stage, sportConfig = SPORT_PRESETS.soccer) {
  if (!stage) return sportConfig?.supports_penalties === true;
  if (stage.allows_tiebreaker === true) return sportConfig?.supports_penalties === true;
  if (stage.allows_tiebreaker === false) return false;
  return sportConfig?.supports_penalties === true && stage.code !== 'group';
}

export function stageUsesSections(stage, matches = []) {
  return matches.some((match) => String(match.group_code || '').trim());
}

export function getStageSectionTitle(stage, sectionCode) {
  if (!sectionCode || sectionCode === '__flat') return stage?.label || 'Jogos';
  const sectionLabel = String(stage?.section_label || 'Grupo').trim();
  const normalizedLabel = sectionLabel.toLowerCase();
  if (normalizedLabel.includes('grupo') || normalizedLabel.includes('rodada') || normalizedLabel.includes('chave')) {
    return `${sectionLabel} ${sectionCode}`;
  }
  return `${sectionLabel}: ${sectionCode}`;
}

export function applyPoolDeadlineOverrides(stages, pool) {
  const settings = normalizePoolSettings(pool?.settings);
  return stages.map((stage) => ({
    ...stage,
    bet_lock_at: settings.deadline_overrides[stage.code] || stage.bet_lock_at,
  }));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildSportConfig(code, customName = '') {
  const preset = SPORT_PRESETS[code] || SPORT_PRESETS.custom;
  return {
    ...preset,
    code: preset.code,
    label: preset.code === 'custom' && customName ? customName : preset.label,
  };
}

function normalizeSportConfig(config = {}) {
  if (!config || typeof config !== 'object') return SPORT_PRESETS.soccer;
  const preset = SPORT_PRESETS[config.code] || SPORT_PRESETS.custom;
  return {
    ...preset,
    ...config,
    code: config.code || preset.code,
    label: config.label || preset.label,
    max_score: Number(config.max_score || preset.max_score || 20),
    score_step: Number(config.score_step || preset.score_step || 1),
    result_unit: config.result_unit || preset.result_unit || config.score_label || preset.score_label,
    tie_break_label: config.tie_break_label || preset.tie_break_label || 'desempate',
    prediction_parameters: Array.isArray(config.prediction_parameters) && config.prediction_parameters.length
      ? config.prediction_parameters
      : preset.prediction_parameters,
    supports_draw: config.supports_draw !== false,
    supports_penalties: config.supports_penalties === true,
  };
}

function normalizeCustomStages(stages) {
  const source = Array.isArray(stages) && stages.length ? stages : CUSTOM_STAGE_PRESETS;
  return source
    .map((stage, index) => {
      const code = normalizeStageCode(stage.code || `stage_${index + 1}`);
      const label = String(stage.label || stage.name || `Fase ${index + 1}`).trim();
      const phaseType = normalizeCustomStageType(stage.phase_type || code || label);
      return {
        code,
        label,
        phase_type: phaseType,
        section_label: String(stage.section_label || defaultSectionLabel(phaseType)).trim(),
        allows_tiebreaker: Boolean(stage.allows_tiebreaker ?? phaseType === CUSTOM_STAGE_TYPES.knockout),
        source_stage_key: stage.source_stage_key ? String(stage.source_stage_key) : null,
      };
    })
    .filter((stage) => stage.code && stage.label);
}

function buildCustomScoringOverrides(stages = CUSTOM_STAGE_PRESETS) {
  return Object.fromEntries(
    normalizeCustomStages(stages).map((stage, index) => {
      const multiplier = customStagePointsMultiplier(index, stages.length);
      return [
        stage.code,
        {
          label: stage.label,
          exact_score: Math.round(10 * multiplier),
          winner_plus_diff: Math.round(7 * multiplier),
          winner_plus_team_goals: Math.round(5 * multiplier),
          winner_only: Math.round(4 * multiplier),
          team_goals_only: Math.round(2 * multiplier),
          penalty_winner: index > 0 ? Math.round(2 * multiplier) : 0,
        },
      ];
    }),
  );
}

function customStagePointsMultiplier(index, totalStages) {
  if (index >= totalStages - 1) return FINAL_STAGE_MULTIPLIER;
  if (index >= Math.max(0, totalStages - 2)) return PENULTIMATE_STAGE_MULTIPLIER;
  return REGULAR_STAGE_MULTIPLIER;
}

function defaultRules(sportConfig = SPORT_PRESETS.soccer) {
  return {
    general_text: `Palpites só são aceitos até o prazo de cada jogo ou fase. Após o fechamento, ficam imutáveis e serão revelados automaticamente quando aplicável.`,
    scoring_text: `A pontuação compara o palpite com o resultado oficial de ${sportConfig.score_label.toLowerCase()}: placar exato, vencedor com diferença, vencedor com pontuação parcial, apenas vencedor e pontuação parcial. Em fases com pênaltis/desempate, o placar do desempate conta como um jogo extra sem empate possível.`,
    tiebreaker_text: 'Critérios de desempate: maior número de buchas, maior número de super buchas e, persistindo o empate, melhor posição por pontos.',
    default_bet_text: 'Jogos sem palpite salvo contam como 0x0 para fins de pontuação.',
    result_text: 'O admin do bolão é responsável por cadastrar jogos, prazos e resultados oficiais que alimentam o ranking.',
    custom_sections: [],
  };
}

export function getScoringExplanationRows(pool) {
  const settings = normalizePoolSettings(pool?.settings);
  const sport = settings.sport_config;
  const unit = String(sport.result_unit || sport.score_label || 'placar').toLowerCase();
  const tieBreak = sport.supports_penalties ? sport.tie_break_label || 'pênaltis' : 'desempate';
  return [
    {
      key: 'exact_score',
      title: 'Bucha (placar exato)',
      short: 'Acerta integralmente o placar oficial dos dois lados.',
      example: `Se o resultado oficial for A 2 x 1 B, só pontua como Bucha quem palpitou exatamente 2 x 1. Em empate, se o oficial for 1 x 1, só é Bucha o palpite 1 x 1.`,
      caveat: `Vale para qualquer unidade configurada (${unit}). É também o principal critério de desempate do ranking.`,
    },
    {
      key: 'winner_plus_diff',
      title: 'Vencedor + diferença',
      short: 'Acerta quem venceu/empatou e também a diferença entre os placares.',
      example: 'Se o oficial for A 3 x 1 B, palpites 2 x 0, 4 x 2 ou 5 x 3 acertam vencedor + diferença, porque A venceu por 2.',
      caveat: sport.supports_draw
        ? 'Quando o jogo empata, qualquer empate não exato entra aqui: oficial 1 x 1 e palpite 2 x 2 acertam empate + diferença zero.'
        : 'Em esportes sem empate, palpites empatados são bloqueados; esta regra vale apenas para vitória com a mesma diferença.',
    },
    {
      key: 'winner_plus_team_goals',
      title: `Vencedor + ${unit} de um lado`,
      short: `Acerta o vencedor e acerta exatamente o número de ${unit} de pelo menos um competidor.`,
      example: 'Se o oficial for A 3 x 1 B, o palpite 3 x 0 acerta A vencedor e os 3 de A; o palpite 4 x 1 acerta A vencedor e o 1 de B.',
      caveat: 'Não se aplica quando o palpite já for Bucha ou vencedor + diferença, pois o sistema usa sempre a melhor hipótese de acerto disponível na ordem da tabela.',
    },
    {
      key: 'winner_only',
      title: 'Apenas vencedor',
      short: 'Acerta somente o lado vencedor, sem acertar diferença nem placar parcial.',
      example: 'Se o oficial for A 3 x 1 B, o palpite 1 x 0 acerta apenas que A venceu.',
      caveat: sport.supports_draw ? 'Para empate, esta hipótese não é usada: empate não exato entra como vencedor + diferença zero.' : 'Em esportes sem empate, sempre deve haver um vencedor no palpite e no resultado.',
    },
    {
      key: 'team_goals_only',
      title: `Apenas ${unit} de um lado`,
      short: `Erra o vencedor/empate, mas acerta exatamente o número de ${unit} de um competidor.`,
      example: 'Se o oficial for A 3 x 1 B, o palpite 3 x 4 erra o vencedor, mas acerta os 3 de A; o palpite 0 x 1 erra o vencedor, mas acerta o 1 de B.',
      caveat: 'Se não acertar vencedor, diferença nem placar de qualquer lado, a pontuação do jogo é zero.',
    },
    {
      key: 'penalty_winner',
      title: `Desempate (${tieBreak})`,
      short: 'Quando o jogo oficial tiver desempate registrado, o placar do desempate é calculado como um jogo extra sem possibilidade de empate.',
      example: `Se o jogo normal terminar empatado e o ${tieBreak} oficial for A 4 x 2 B, um palpite 4 x 2 faz Bucha extra; 5 x 3 acerta vencedor + diferença; 4 x 3 acerta vencedor + placar de A; e 3 x 2 acerta apenas o placar de B.`,
      caveat: sport.supports_penalties ? 'O palpite de pênaltis pode ser salvo mesmo que o palpite do tempo normal/prorrogação não seja empate. O valor desta linha é usado para "apenas vencedor"; os demais acertos usam os valores normais da fase como extra.' : 'Este parâmetro fica desativado para esportes/modalidades configurados sem desempate por pênaltis.',
    },
    {
      key: 'zebra',
      title: 'Zebra',
      short: 'Multiplica os pontos do jogo quando o admin marca um competidor como zebra e ela vence ou avança no desempate.',
      example: 'Se B for zebra 3x e vencer 1 x 0, um palpite correto em B tem seus pontos de acerto multiplicados por 3.',
      caveat: 'Não basta a zebra estar marcada: o usuário precisa ter palpitado vitória/avanço da zebra e a zebra precisa vencer/avançar oficialmente.',
    },
    {
      key: 'default_bet',
      title: 'Jogo sem palpite',
      short: 'Quem não salvar palpite entra no processamento como 0 x 0.',
      example: 'Se o usuário não palpitar e o oficial for 0 x 0, ele pontua como Bucha; se o oficial for 1 x 0, recebe zero, salvo se alguma regra de placar parcial se aplicar ao 0.',
      caveat: 'O palpite ausente não é exceção manual: ele é calculado automaticamente pela mesma regra de todos os demais palpites.',
    },
    {
      key: 'super_bucha',
      title: 'Super Bucha',
      short: 'É critério de desempate, não uma pontuação extra própria.',
      example: 'Uma Bucha vira Super Bucha quando também acerta o desempate, quando envolve zebra aplicada ou, na Copa 2026, quando o usuário acerta o campeão.',
      caveat: 'A pontuação exibida vem das linhas da tabela; a Super Bucha apenas melhora a posição em empates do ranking.',
    },
    {
      key: 'ranking_tiebreakers',
      title: 'Desempate do ranking',
      short: 'O ranking ordena por pontos e, em seguida, por critérios de acerto.',
      example: 'Se dois usuários têm a mesma pontuação, fica à frente quem tiver mais Buchas; persistindo, quem tiver mais Super Buchas; persistindo, melhor posição conforme as regras do ranking.',
      caveat: 'Participantes com pagamento pendente podem não aparecer no ranking até confirmação, conforme regra do bolão.',
    },
  ];
}

export function getSportParameterRows(settingsOrPool) {
  const settings = settingsOrPool?.settings ? normalizePoolSettings(settingsOrPool.settings) : normalizePoolSettings(settingsOrPool);
  const sport = settings.sport_config;
  const parameterLabels = (sport.prediction_parameters || []).map((key) => SPORT_PARAMETER_LABELS[key] || key);
  return [
    ['Esporte/modalidade', sport.label],
    ['Unidade do placar', sport.score_label],
    ['Competidor', sport.competitor_label],
    ['Placar máximo por lado', String(sport.max_score)],
    ['Incremento permitido', String(sport.score_step)],
    ['Empate no placar', sport.supports_draw ? 'permitido' : 'bloqueado'],
    ['Desempate por pênaltis/avanço', sport.supports_penalties ? 'habilitado' : 'desabilitado'],
    ['Parâmetros ativos', parameterLabels.join(', ') || 'Placar, vencedor e ranking'],
  ];
}

export function normalizeScoreValue(value, sportConfig = SPORT_PRESETS.soccer) {
  const maxScore = Number(sportConfig.max_score || 20);
  const step = Number(sportConfig.score_step || 1);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const clamped = Math.max(0, Math.min(maxScore, numeric));
  if (!Number.isFinite(step) || step <= 0) return Math.floor(clamped);
  return Number((Math.round(clamped / step) * step).toFixed(4));
}

export function isDrawAllowedForSport(sportConfig = SPORT_PRESETS.soccer) {
  return sportConfig.supports_draw !== false;
}

export function validateSportScorePair(home, away, sportConfig = SPORT_PRESETS.soccer) {
  const normalizedHome = normalizeScoreValue(home, sportConfig);
  const normalizedAway = normalizeScoreValue(away, sportConfig);
  if (!isDrawAllowedForSport(sportConfig) && normalizedHome === normalizedAway) {
    return {
      ok: false,
      message: `${sportConfig.label || 'Este esporte'} não permite empate neste bolão. Informe um vencedor no placar.`,
    };
  }
  return { ok: true, home: normalizedHome, away: normalizedAway };
}

function normalizeRules(rules = {}, sportConfig = SPORT_PRESETS.soccer) {
  const defaults = defaultRules(sportConfig);
  return {
    ...defaults,
    ...(rules || {}),
    custom_sections: Array.isArray(rules?.custom_sections) ? rules.custom_sections : [],
  };
}

function normalizeStageCode(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
}

function normalizeCustomStageType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (Object.values(CUSTOM_STAGE_TYPES).includes(normalized)) return normalized;
  if (/(quarter|semi|final|mata|playoff|knockout|third)/i.test(normalized)) return CUSTOM_STAGE_TYPES.knockout;
  if (/(group|grupo)/i.test(normalized)) return CUSTOM_STAGE_TYPES.groups;
  if (/(regular|league|turno|rodada|temporada)/i.test(normalized)) return CUSTOM_STAGE_TYPES.league;
  return CUSTOM_STAGE_TYPES.custom;
}

function defaultSectionLabel(phaseType) {
  if (phaseType === CUSTOM_STAGE_TYPES.league) return 'Rodada/Grupo';
  if (phaseType === CUSTOM_STAGE_TYPES.groups) return 'Grupo';
  if (phaseType === CUSTOM_STAGE_TYPES.knockout) return 'Chave';
  return 'Seção';
}
