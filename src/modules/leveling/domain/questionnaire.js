/**
 * Formulário de auto-avaliação para nivelamento (CBPE / USAP).
 * Cada questão usa uma escala Likert 1-5 — quanto maior, mais avançada a
 * resposta. A média ponderada por categoria mapeia para o nível recomendado.
 *
 * As perguntas e o método são baseados no repositório
 *   github.com/fsalamoni/pickleball-nivelamento
 * (FORMULARIO_ANALISE.md, LIKERT_STATEMENTS_FINAL.md, PARAMETROS_DETALHADOS.md).
 */

export const LIKERT_OPTIONS = [
  { value: 1, label: 'Discordo totalmente' },
  { value: 2, label: 'Discordo' },
  { value: 3, label: 'Neutro' },
  { value: 4, label: 'Concordo' },
  { value: 5, label: 'Concordo totalmente' },
];

export const QUESTIONNAIRE = [
  {
    section: 'Fundamentos técnicos',
    weight: 1.2,
    questions: [
      { id: 'fund_forehand', text: 'Tenho um forehand consistente em ralis prolongados.' },
      { id: 'fund_backhand', text: 'Meu backhand é tão confiável quanto meu forehand.' },
      { id: 'fund_serve', text: 'Coloco o saque com profundidade e direção intencionais.' },
      { id: 'fund_return', text: 'Devolvo o saque profundo e avanço imediatamente para a NVZ.' },
      { id: 'fund_volley', text: 'Tenho controle e posicionamento em voleios.' },
      { id: 'fund_dink', text: 'Sustento sequências de dinks sem cometer erros não forçados.' },
      { id: 'fund_drive', text: 'Executo drives controlados quando há oportunidade.' },
    ],
  },
  {
    section: 'Estratégia e tática',
    weight: 1.3,
    questions: [
      { id: 'tac_patience', text: 'Tenho paciência para esperar a bola certa antes de atacar.' },
      { id: 'tac_intent', text: 'Cada golpe meu tem uma intenção tática clara.' },
      { id: 'tac_attack', text: 'Identifico oportunidades de ataque (bolas altas, posicionamento).' },
      { id: 'tac_depth', text: 'Vario profundidade dos golpes para tirar o adversário do conforto.' },
      { id: 'tac_spin', text: 'Vario a rotação (topspin, slice) para complicar o adversário.' },
      { id: 'tac_neutralize', text: 'Sei neutralizar ataques com resets para a NVZ.' },
    ],
  },
  {
    section: 'Consistência e erros',
    weight: 1.1,
    questions: [
      { id: 'con_forced', text: 'Meus erros costumam ser forçados pelo adversário, não próprios.' },
      { id: 'con_unforced', text: 'Cometo poucos erros não forçados em uma partida típica.' },
      { id: 'con_rally', text: 'Mantenho ralis longos com adversários do meu nível.' },
    ],
  },
  {
    section: 'Conhecimento de regras',
    weight: 0.9,
    questions: [
      { id: 'reg_two_bounce', text: 'Conheço e aplico corretamente a regra do duplo quique.' },
      { id: 'reg_updates', text: 'Estou por dentro das regras atualizadas (2024–2026).' },
      { id: 'reg_penalties', text: 'Conheço as penalizações e situações de falta.' },
    ],
  },
  {
    section: 'Preparação física',
    weight: 0.8,
    questions: [
      { id: 'phy_reaction', text: 'Tenho bom tempo de reação em bolas próximas à NVZ.' },
      { id: 'phy_lateral', text: 'Me desloco lateralmente com agilidade.' },
      { id: 'phy_endurance', text: 'Mantenho meu nível ao longo de partidas longas.' },
    ],
  },
  {
    section: 'Experiência',
    weight: 1.0,
    questions: [
      { id: 'exp_years', text: 'Pratico pickleball há mais de 1 ano regularmente.' },
      { id: 'exp_tournaments', text: 'Já participei de torneios oficiais.' },
      { id: 'exp_surfaces', text: 'Já joguei em superfícies e bolas diferentes (indoor/outdoor).' },
    ],
  },
];

/**
 * Calcula o nível recomendado a partir das respostas.
 * @param {Record<string, number>} answers - { questionId: 1..5 }
 * @returns {{ score: number, levelCode: string, breakdown: Array<{section: string, average: number}> }}
 */
export function calculateLevel(answers) {
  let totalWeighted = 0;
  let totalWeight = 0;
  const breakdown = [];
  QUESTIONNAIRE.forEach((section) => {
    const vals = section.questions
      .map((q) => Number(answers?.[q.id]))
      .filter((v) => Number.isFinite(v) && v >= 1 && v <= 5);
    if (vals.length === 0) return;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    breakdown.push({ section: section.section, average: avg });
    totalWeighted += avg * section.weight;
    totalWeight += section.weight;
  });
  const score = totalWeight > 0 ? totalWeighted / totalWeight : 0;

  let levelCode = 'beginner';
  if (score >= 4.6) levelCode = 'open';
  else if (score >= 4.1) levelCode = 'pro';
  else if (score >= 3.4) levelCode = 'intermediate_plus';
  else if (score >= 2.6) levelCode = 'intermediate';
  else levelCode = 'beginner';

  return { score, levelCode, breakdown };
}

/**
 * Aplica mitigação simples de viés (sandbagging / Dunning-Kruger):
 *  - Se o respondente declara muita experiência mas baixa consistência,
 *    abaixa um nível.
 *  - Se declara pouca experiência mas alta consistência, abaixa um nível
 *    (provável sobrestimação).
 */
export function applyBiasMitigation(answers, levelCode) {
  const exp =
    (Number(answers?.exp_years || 0) +
      Number(answers?.exp_tournaments || 0) +
      Number(answers?.exp_surfaces || 0)) /
    3;
  const consistency =
    (Number(answers?.con_forced || 0) +
      Number(answers?.con_unforced || 0) +
      Number(answers?.con_rally || 0)) /
    3;
  const order = ['beginner', 'intermediate', 'intermediate_plus', 'pro', 'open'];
  const idx = order.indexOf(levelCode);
  if (idx === -1) return levelCode;
  if (consistency > 4 && exp < 2 && idx > 0) return order[idx - 1];
  if (exp > 4 && consistency < 2 && idx > 0) return order[idx - 1];
  return levelCode;
}
