/**
 * MINHA CARREIRA — as METAS DA TEMPORADA (aba `metas`, docs/54 §4.10). PURO.
 *
 * A meta mora em `player_goals` (com `kind`, ver `progression.js`); aqui ficam
 * as contas das métricas da carreira, que saem da LINHA DO TEMPO já montada
 * (o mesmo item não conta duas vezes: o "É este" e os pontos da federação já
 * vêm juntados). Cada métrica diz DE ONDE conta — "torneios" aqui não é o
 * `GOAL_METRIC.TOURNAMENTS` (só os da plataforma, de toda a vida).
 *
 * O resultado declarado conta para a meta da PESSOA, nunca para ranking,
 * rating nem XP (guarda `carreiraNaoPontua`).
 */
import { t, tk } from '@/core/i18n';
import { SEASON_GOAL_METRIC } from '@/modules/progression/domain/progression.js';

const M = SEASON_GOAL_METRIC;

export const SEASON_GOAL_METRIC_LABEL = Object.freeze({
  [M.CAREER_EVENTS_PLAYED]: tk('Torneios jogados'),
  [M.CAREER_PODIUMS]: tk('Pódios'),
  [M.FEDERATED_EVENTS]: tk('Torneios federados'),
  [M.DUPR_RATING]: tk('Rating DUPR'),
});

/** De onde a métrica conta — a tela diz isso ao lado do número. */
export const SEASON_GOAL_METRIC_SOURCE = Object.freeze({
  [M.CAREER_EVENTS_PLAYED]: tk('Conta os torneios de fora e os do PickleRush dentro do prazo da meta (dia de jogo não entra).'),
  [M.CAREER_PODIUMS]: tk('Conta os pódios (1º a 3º) de fora, declarados por você, e os do PickleRush, dentro do prazo.'),
  [M.FEDERATED_EVENTS]: tk('Conta os torneios federados: os de fora que você marcou como federados e os que lançaram pontos no ranking oficial.'),
  [M.DUPR_RATING]: tk('O rating de duplas do DUPR na sua conta conectada. Vale o número de agora.'),
});

/** As métricas oferecidas: a do DUPR só com o DUPR oficial valendo (`useDuprMode`). */
export function seasonGoalMetrics({ dupr = false } = {}) {
  return [M.CAREER_EVENTS_PLAYED, M.CAREER_PODIUMS, M.FEDERATED_EVENTS, ...(dupr ? [M.DUPR_RATING] : [])];
}

/**
 * Os valores para `goalProgress`: listas de DATAS (a janela da meta recorta).
 * `timeline` nulo (ainda carregando) ⇒ `{}` (tudo desconhecido). Com fonte
 * faltando, `incompleto` lista o que faltou — a tela diz que pode ter mais.
 */
export function careerGoalValues(timeline, { duprRating = null } = {}) {
  if (!timeline) return { values: {}, incompleto: [] };
  const passados = (timeline.seasons || []).flatMap((s) => s.items).filter((i) => !i.cancelled && !i.upcoming);
  const torneios = passados.filter((i) => i.source !== 'dia_de_jogo');
  const values = {
    [M.CAREER_EVENTS_PLAYED]: torneios.map((i) => i.date),
    [M.CAREER_PODIUMS]: passados.filter((i) => i.position >= 1 && i.position <= 3).map((i) => i.date),
    [M.FEDERATED_EVENTS]: torneios.filter((i) => i.federated).map((i) => i.date),
  };
  if (duprRating !== null && duprRating !== undefined && Number.isFinite(Number(duprRating))) values[M.DUPR_RATING] = Number(duprRating);
  // As confirmações das duplas não mudam nenhuma conta das metas.
  const duplas = t('as confirmações das duplas');
  return { values, incompleto: (timeline.faltou || []).filter((f) => f !== duplas) };
}

/** As metas da temporada, separadas: ativas (prazo mais perto primeiro), concluídas e abandonadas. */
export function splitSeasonGoals(goals) {
  const comKind = (goals || []).filter((g) => g?.kind);
  const porPrazo = (a, b) => String(a.due_date || '').localeCompare(String(b.due_date || ''));
  return {
    active: comKind.filter((g) => !g.status || g.status === 'active').sort(porPrazo),
    done: comKind.filter((g) => g.status === 'done').sort(porPrazo),
    dropped: comKind.filter((g) => g.status === 'dropped').sort(porPrazo),
  };
}
