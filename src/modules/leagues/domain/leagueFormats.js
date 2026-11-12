/**
 * Os FORMATOS de liga e as SITUAÇÕES da liga (fonte única do cliente).
 *
 * Estudo em `docs/57-LIGAS.md` §2 (DUPR e Minor League Pickleball). Os ids são
 * GRAVADOS (`leagues.format`, `leagues.status`): nunca renomeie. A cópia do
 * servidor está em `functions/leaguePolicy.js` (teste de paridade).
 *
 * `available: false` = o formato aparece no assistente como "em breve" e não
 * pode ser escolhido: as equipes chegam na entrega seguinte. As escadas jogam
 * por SESSÃO e a posição é derivada (`leagueLadder.js`).
 */
import { tk } from '@/core/i18n';

export const LEAGUE_FORMAT = Object.freeze({
  DIVISIONAL_PAIRS: 'divisional_pairs',
  DIVISIONAL_SINGLES: 'divisional_singles',
  FLEX_PAIRS: 'flex_pairs',
  LADDER_PAIRS: 'ladder_pairs',
  LADDER_INDIVIDUAL: 'ladder_individual',
  TEAM_MILP: 'team_milp',
  TEAM_MILP_V3: 'team_milp_v3',
  TEAM_V4: 'team_v4_gendered',
});

/** Como se entra na liga. Gravado em `leagues.entry_type`. */
export const LEAGUE_ENTRY = Object.freeze({ PAIR: 'pair', SINGLE: 'single', TEAM: 'team', INDIVIDUAL: 'individual' });

/** Agrupamento no assistente (o que a pessoa procura primeiro). */
export const LEAGUE_FORMAT_FAMILY = Object.freeze({
  PAIRS: { id: 'pairs', label: tk('Duplas fixas') },
  INDIVIDUAL: { id: 'individual', label: tk('Individual') },
  TEAMS: { id: 'teams', label: tk('Equipes') },
});

export const LEAGUE_FORMAT_META = Object.freeze({
  [LEAGUE_FORMAT.DIVISIONAL_PAIRS]: {
    family: 'pairs', entry: LEAGUE_ENTRY.PAIR, players: 2, available: true,
    label: tk('Duplas por divisão'),
    summary: tk('A dupla se inscreve na divisão do seu nível e enfrenta todas as outras da divisão, uma rodada por data.'),
    how: tk('Pontos corridos dentro da divisão: cada dupla enfrenta todas as outras, uma rodada por data.'),
  },
  [LEAGUE_FORMAT.FLEX_PAIRS]: {
    family: 'pairs', entry: LEAGUE_ENTRY.PAIR, players: 2, available: true,
    label: tk('Liga flexível'),
    summary: tk('Divisões de 5 a 8 duplas. Em cada rodada as duplas combinam o dia e o local dentro do prazo.'),
    how: tk('Cada rodada tem um prazo. As duplas combinam onde e quando jogar, e a organização lança o placar até o fim do prazo.'),
  },
  [LEAGUE_FORMAT.DIVISIONAL_SINGLES]: {
    family: 'individual', entry: LEAGUE_ENTRY.SINGLE, players: 1, available: true,
    label: tk('Simples por divisão'),
    summary: tk('Cada atleta se inscreve sozinho na divisão do seu nível e enfrenta todos os outros em simples.'),
    how: tk('Pontos corridos dentro da divisão: cada atleta enfrenta todos os outros, uma rodada por data.'),
  },
  [LEAGUE_FORMAT.LADDER_PAIRS]: {
    family: 'pairs', entry: LEAGUE_ENTRY.PAIR, players: 2, available: true,
    label: tk('Escada de duplas'),
    summary: tk('A cada sessão, grupos de 3 a 5 duplas pela posição na escada. A 1ª do grupo sobe e a última desce.'),
    how: tk('Em cada sessão as duplas presentes são divididas em grupos pela posição na escada, e cada dupla enfrenta as outras do grupo. A 1ª de cada grupo sobe para o de cima e a última desce. Quem falta fica no mesmo lugar.'),
  },
  [LEAGUE_FORMAT.LADDER_INDIVIDUAL]: {
    family: 'individual', entry: LEAGUE_ENTRY.INDIVIDUAL, players: 1, available: true,
    label: tk('Escada individual (King of the Court)'),
    summary: tk('Quadras de 4 ou 5 pela posição na escada, num Americano: cada um joga com cada outro da quadra. O 1º sobe e o último desce.'),
    how: tk('Em cada sessão os presentes são divididos em quadras de 4 ou 5 pela posição na escada, e cada quadra joga um Americano (cada um forma dupla com cada outro uma vez). O 1º de cada quadra sobe para a de cima e o último desce. Quem falta fica no mesmo lugar.'),
  },
  [LEAGUE_FORMAT.TEAM_MILP]: {
    family: 'teams', entry: LEAGUE_ENTRY.TEAM, players: 4, available: false,
    label: tk('Equipes 4×4 mista (estilo MiLP)'),
    summary: tk('Equipes de 2 homens e 2 mulheres. Feminina, masculina e duas mistas até 21. Em 2 a 2, DreamBreaker.'),
    how: tk('Divisão pela soma do DUPR da equipe (12 a 22).'),
  },
  [LEAGUE_FORMAT.TEAM_MILP_V3]: {
    family: 'teams', entry: LEAGUE_ENTRY.TEAM, players: 3, available: false,
    label: tk('Equipes 3×3 (estilo MiLP v3)'),
    summary: tk('Equipes de 3. Três duplas (A+B, B+C, A+C): cada atleta joga duas vezes, sem repetir o parceiro.'),
    how: tk('Divisão pela soma do DUPR da equipe (9 a 15).'),
  },
  [LEAGUE_FORMAT.TEAM_V4]: {
    family: 'teams', entry: LEAGUE_ENTRY.TEAM, players: 4, available: false,
    label: tk('Equipes 4×4 do mesmo gênero'),
    summary: tk('Equipes de 4 atletas do mesmo gênero. Quatro duplas com parceiros diferentes e DreamBreaker em 2 a 2.'),
    how: tk('Divisão pela soma do DUPR da equipe.'),
  },
});

export const formatMeta = (format) => LEAGUE_FORMAT_META[format] || null;
export const formatAvailable = (format) => formatMeta(format)?.available === true;
export const playersPerEntry = (format) => formatMeta(format)?.players || 0;

/** Situação da liga. Gravado em `leagues.status`. */
export const LEAGUE_STATUS = Object.freeze({
  DRAFT: 'draft', OPEN: 'open', RUNNING: 'running', FINISHED: 'finished', CANCELLED: 'cancelled',
});

export const LEAGUE_STATUS_LABELS = Object.freeze({
  draft: tk('Rascunho'),
  open: tk('Inscrições abertas'),
  running: tk('Em andamento'),
  finished: tk('Encerrada'),
  cancelled: tk('Cancelada'),
});

/** Para onde a liga pode ir a partir de cada situação (o servidor tem a cópia). */
export const LEAGUE_STATUS_NEXT = Object.freeze({
  draft: ['open', 'cancelled'],
  open: ['draft', 'running', 'cancelled'],
  running: ['open', 'finished', 'cancelled'],
  finished: ['running'],
  cancelled: [],
});

export const canMoveStatus = (from, to) => (LEAGUE_STATUS_NEXT[from] || []).includes(to);

/** A liga aparece para quem não organiza? (rascunho e cancelada, não). */
export const isLeaguePublic = (league) => ['open', 'running', 'finished'].includes(league?.status)
  && league?.visibility !== 'unlisted';

/** Regra de pontos da classificação. Gravado em `leagues.standings`. */
export const DEFAULT_LEAGUE_POINTS = Object.freeze({ win: 3, loss: 1, wo_loss: 0 });
