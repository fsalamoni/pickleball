/**
 * Domínio puro de regras estruturadas da arena (Sprint 5).
 *
 * Substitui o `house_rules_md` (markdown livre) por uma lista
 * estruturada de regras. Cada regra tem:
 *   - id: identificador único
 *   - title: título curto (max 80)
 *   - description: texto detalhado (max 500)
 *   - category: categoria opcional (max 40)
 *   - order: posição na lista
 *
 * Vantagens sobre markdown:
 * - Validação de tamanho por campo
 * - Categorização (regras de pagamento, conduta, cancelamento...)
 * - Reordenação fácil
 * - UI pode renderizar lista numerada ou agrupada por categoria
 */

export const ARENA_RULE_TITLE_MAX = 80;
export const ARENA_RULE_DESCRIPTION_MAX = 500;
export const ARENA_RULE_CATEGORY_MAX = 40;
export const ARENA_RULES_MAX = 50;
export const ARENA_RULE_CATEGORIES = Object.freeze({
  GENERAL: 'Geral',
  CANCELLATION: 'Cancelamento',
  PAYMENT: 'Pagamento',
  CONDUCT: 'Conduta',
  EQUIPMENT: 'Equipamento',
  SAFETY: 'Segurança',
  OTHER: 'Outro',
});

const str = (v) => String(v ?? '').trim();

/** Gera ID único para uma regra. */
export function genRuleId() {
  return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normaliza e valida uma regra.
 * @returns {{ valid: boolean, error: string|null, value: object }}
 */
export function normalizeArenaRule(input = {}, index = 0) {
  const title = str(input.title);
  if (!title) {
    return { valid: false, error: `Regra #${index + 1}: título é obrigatório.`, value: {} };
  }
  if (title.length > ARENA_RULE_TITLE_MAX) {
    return { valid: false, error: `Regra #${index + 1}: título muito longo (max ${ARENA_RULE_TITLE_MAX}).`, value: { title: title.slice(0, ARENA_RULE_TITLE_MAX) } };
  }
  const description = str(input.description).slice(0, ARENA_RULE_DESCRIPTION_MAX);
  const category = str(input.category).slice(0, ARENA_RULE_CATEGORY_MAX);
  const order = Number.isInteger(Number(input.order)) ? Number(input.order) : index;
  return {
    valid: true,
    error: null,
    value: {
      id: str(input.id) || genRuleId(),
      title,
      description,
      category: category || ARENA_RULE_CATEGORIES.GENERAL,
      order,
    },
  };
}

/** Normaliza lista de regras, re-ordenando e descartando inválidas. */
export function normalizeArenaRules(rules = []) {
  if (!Array.isArray(rules)) return [];
  const valid = [];
  for (let i = 0; i < Math.min(rules.length, ARENA_RULES_MAX); i++) {
    const r = normalizeArenaRule(rules[i], i);
    if (r.valid) valid.push(r.value);
  }
  // re-ordena
  return valid
    .map((r, i) => ({ ...r, order: i }))
    .sort((a, b) => a.order - b.order);
}

/** Agrupa regras por categoria. */
export function groupRulesByCategory(rules = []) {
  const groups = {};
  for (const r of rules) {
    const cat = r.category || ARENA_RULE_CATEGORIES.GENERAL;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(r);
  }
  return groups;
}
