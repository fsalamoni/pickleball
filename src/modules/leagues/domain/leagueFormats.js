/**
 * Os FORMATOS de liga e as SITUAÇÕES da liga (fonte única do cliente).
 *
 * Estudo em `docs/57-LIGAS.md` §2 (DUPR e Minor League Pickleball). Os ids são
 * GRAVADOS (`leagues.format`, `leagues.status`): nunca renomeie. A cópia do
 * servidor está em `functions/leaguePolicy.js` (teste de paridade).
 *
 * `available: false` = o formato aparece no assistente como "em breve" e não
 * pode ser escolhido. As escadas jogam por SESSÃO e a posição é derivada
 * (`leagueLadder.js`). Nas EQUIPES o confronto tem `lines` jogos de duplas
 * (um game cada) e, com `dreambreaker`, o empate é decidido no DreamBreaker;
 * `composition` diz como a equipe é montada (`two_two`: 2 homens e 2
 * mulheres; `same`: todos da mesma categoria; `any`: livre). Com
 * `self_report` (a liga flexível) quem joga lança o placar e o outro lado
 * confirma; contestado, a organização decide.
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
    family: 'pairs', entry: LEAGUE_ENTRY.PAIR, players: 2, available: true, self_report: true,
    label: tk('Liga flexível'),
    summary: tk('Divisões de 5 a 8 duplas. Em cada rodada as duplas combinam o dia e o local dentro do prazo.'),
    how: tk('Cada rodada tem um prazo. As duplas combinam onde e quando jogar; uma delas lança o placar e a outra confirma. Se houver contestação, a organização decide.'),
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
    family: 'teams', entry: LEAGUE_ENTRY.TEAM, players: 4, available: true,
    composition: 'two_two', dreambreaker: true,
    lines: [
      { key: 'wd', label: tk('Duplas femininas') },
      { key: 'md', label: tk('Duplas masculinas') },
      { key: 'mx1', label: tk('Mista 1') },
      { key: 'mx2', label: tk('Mista 2') },
    ],
    label: tk('Equipes 4×4 mista (estilo MiLP)'),
    summary: tk('Equipes de 2 homens e 2 mulheres. Feminina, masculina e duas mistas até 21. Em 2 a 2, DreamBreaker.'),
    how: tk('Cada confronto entre equipes tem quatro jogos de duplas (feminina, masculina e duas mistas), um game cada. Vence a equipe que ganhar mais jogos; em 2 a 2, o DreamBreaker decide. Divisão pela soma do DUPR da equipe.'),
  },
  [LEAGUE_FORMAT.TEAM_MILP_V3]: {
    family: 'teams', entry: LEAGUE_ENTRY.TEAM, players: 3, available: true,
    composition: 'any', dreambreaker: false,
    lines: [
      { key: 'ab', label: tk('Dupla A + B') },
      { key: 'bc', label: tk('Dupla B + C') },
      { key: 'ac', label: tk('Dupla A + C') },
    ],
    label: tk('Equipes 3×3 (estilo MiLP v3)'),
    summary: tk('Equipes de 3. Três duplas (A+B, B+C, A+C): cada atleta joga duas vezes, sem repetir o parceiro.'),
    how: tk('Cada confronto entre equipes tem três jogos de duplas (A+B, B+C e A+C), um game cada. Vence a equipe que ganhar dois. Divisão pela soma do DUPR da equipe.'),
  },
  [LEAGUE_FORMAT.TEAM_V4]: {
    family: 'teams', entry: LEAGUE_ENTRY.TEAM, players: 4, available: true,
    composition: 'same', dreambreaker: true,
    lines: [
      { key: 'd12', label: tk('Dupla 1 + 2') },
      { key: 'd34', label: tk('Dupla 3 + 4') },
      { key: 'd13', label: tk('Dupla 1 + 3') },
      { key: 'd24', label: tk('Dupla 2 + 4') },
    ],
    label: tk('Equipes 4×4 do mesmo gênero'),
    summary: tk('Equipes de 4 atletas do mesmo gênero. Quatro duplas com parceiros diferentes e DreamBreaker em 2 a 2.'),
    how: tk('Cada confronto entre equipes tem quatro jogos de duplas com parceiros diferentes, um game cada. Vence a equipe que ganhar mais jogos; em 2 a 2, o DreamBreaker decide. Divisão pela soma do DUPR da equipe.'),
  },
});

/** Liga flexível: placar lançado sem resposta vale sozinho depois deste prazo (cópia no servidor). */
export const AUTO_CONFIRM_HOURS = 72;

export const formatMeta = (format) => LEAGUE_FORMAT_META[format] || null;
export const formatAvailable = (format) => formatMeta(format)?.available === true;
export const playersPerEntry = (format) => formatMeta(format)?.players || 0;
export const isTeamFormat = (format) => formatMeta(format)?.entry === LEAGUE_ENTRY.TEAM;

/**
 * O grupo do DUPR de cada formato (os do TORNEIO, `docs/57-LIGAS.md` §14):
 * equipes são confrontos de equipe, a escada individual é um Americano e o
 * resto são duplas/simples fixas. Cópia no servidor (`functions/leagueRanking.js`).
 */
export function leagueDuprBucket(format) {
  if (isTeamFormat(format)) return 'tournament_team';
  if (format === LEAGUE_FORMAT.LADDER_INDIVIDUAL) return 'tournament_rotation';
  return 'tournament_fixed';
}

/** As posições (na ordem da inscrição) de cada linha das equipes 3×3 e 4×4 do mesmo gênero. */
const POSICOES_DA_LINHA = Object.freeze({
  ab: [0, 1], bc: [1, 2], ac: [0, 2], d12: [0, 1], d34: [2, 3], d13: [0, 2], d24: [1, 3],
});

/**
 * A escalação SUGERIDA de um lado em cada linha do confronto: a dupla que a
 * linha pede pela ordem da equipe (A+B, 1+3…) e, na MiLP, as duas mulheres, os
 * dois homens e as mistas 1ª+1º e 2ª+2º. `null` quando não dá para saber (atleta
 * sem conta, gênero desconhecido). A organização troca antes de salvar.
 *
 * @param {string} format
 * @param {Array<{ uid?: string|null, gender?: string|null }>} players
 * @returns {Array<string[]|null>} uma dupla (uids) por linha
 */
export function suggestedLineup(format, players) {
  const linhas = formatMeta(format)?.lines || [];
  const ps = Array.isArray(players) ? players : [];
  const mulheres = ps.filter((p) => p?.gender === 'female');
  const homens = ps.filter((p) => p?.gender === 'male');
  const dupla = (x, y) => (x?.uid && y?.uid && x.uid !== y.uid ? [x.uid, y.uid] : null);
  return linhas.map((l) => {
    if (POSICOES_DA_LINHA[l.key]) return dupla(ps[POSICOES_DA_LINHA[l.key][0]], ps[POSICOES_DA_LINHA[l.key][1]]);
    if (mulheres.length !== 2 || homens.length !== 2) return null;
    if (l.key === 'wd') return dupla(mulheres[0], mulheres[1]);
    if (l.key === 'md') return dupla(homens[0], homens[1]);
    if (l.key === 'mx1') return dupla(mulheres[0], homens[0]);
    if (l.key === 'mx2') return dupla(mulheres[1], homens[1]);
    return null;
  });
}

/** As duplas possíveis de uma equipe (só quem tem conta), para escolher a escalação. */
export function teamPairs(players) {
  const ps = (Array.isArray(players) ? players : []).filter((p) => p?.uid);
  const out = [];
  ps.forEach((x, i) => ps.slice(i + 1).forEach((y) => out.push([x.uid, y.uid])));
  return out;
}

/** Como o placar do confronto é conferido: `lines` jogos exatos e o DreamBreaker no empate. */
export function resultRules(format) {
  const m = formatMeta(format);
  return { lines: m?.lines?.length || 0, dreambreaker: m?.dreambreaker === true };
}

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
