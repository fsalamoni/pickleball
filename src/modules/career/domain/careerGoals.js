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
import { itemPodiums } from './timeline.js';

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
  // O plano que passou sem resposta (`pending`) não é torneio jogado.
  const torneios = passados.filter((i) => i.source !== 'dia_de_jogo' && !i.pending);
  const values = {
    [M.CAREER_EVENTS_PLAYED]: torneios.map((i) => i.date),
    // Uma data por PÓDIO (a mesma conta da temporada): ouro e prata no mesmo torneio são dois.
    [M.CAREER_PODIUMS]: passados.flatMap((i) => itemPodiums(i).map(() => i.date)),
    [M.FEDERATED_EVENTS]: torneios.filter((i) => i.federated).map((i) => i.date),
  };
  // Lançado só com o ANO (modo lista): a data gravada é 1º de janeiro, e a janela
  // da meta pode deixá-lo de fora (ou contar o que foi antes dela). A tela avisa.
  const soAno = {};
  torneios.filter((i) => i.datePrecision === 'year').forEach((i) => {
    const y = String(i.date).slice(0, 4);
    soAno[y] = (soAno[y] || 0) + 1;
  });
  if (duprRating !== null && duprRating !== undefined && Number.isFinite(Number(duprRating))) values[M.DUPR_RATING] = Number(duprRating);
  // As confirmações das duplas não mudam nenhuma conta das metas.
  const duplas = t('as confirmações das duplas');
  return { values, incompleto: (timeline.faltou || []).filter((f) => f !== duplas), soAno };
}

/**
 * Quantos torneios lançados só com o ano podem estar FORA da conta desta meta:
 * os dos anos que a janela `since → due_date` cruza. Zero para meta que não é
 * de contagem da carreira (o rating DUPR não tem janela).
 */
export function yearOnlyInGoalWindow(goal, soAno = {}) {
  if (!goal || goal.metric === M.DUPR_RATING || !Object.values(M).includes(goal.metric)) return 0;
  const de = String(goal.since || '').slice(0, 4) || '0000';
  const ate = String(goal.due_date || '').slice(0, 4) || '9999';
  return Object.entries(soAno).filter(([y]) => y >= de && y <= ate).reduce((s, [, n]) => s + n, 0);
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
