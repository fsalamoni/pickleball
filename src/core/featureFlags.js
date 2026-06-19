/**
 * Catálogo de feature flags da plataforma.
 *
 * As flags são guardadas em um único documento do Firestore
 * (`platform_settings/global`, campo `feature_flags`) e podem ser ligadas/
 * desligadas em tempo de execução pelo admin master na página de Métricas.
 *
 * TODAS as flags nascem DESLIGADAS (`false`). Enquanto uma flag está desligada
 * a funcionalidade associada fica completamente invisível e inerte — nada do
 * comportamento já existente é alterado. Isso garante que estas implementações
 * sejam puramente aditivas.
 */

export const FEATURE_FLAG = Object.freeze({
  /**
   * Torneios em múltiplas fases: permite ao admin do torneio configurar uma
   * modalidade com várias fases encadeadas (grupos/americano/mata-mata/etc.),
   * com divisão em grupos equilibrados, qualificação de classificados e
   * progressão automática entre as fases. Inscrição segue em lista única.
   */
  MULTI_PHASE_TOURNAMENTS: 'multi_phase_tournaments',
});

/** Metadados de exibição para o painel de flags (admin master). */
export const FEATURE_FLAG_META = Object.freeze({
  [FEATURE_FLAG.MULTI_PHASE_TOURNAMENTS]: {
    label: 'Torneios em múltiplas fases',
    description:
      'Habilita a configuração de modalidades com várias fases encadeadas '
      + '(grupos, americano, mata-mata, dupla eliminação, suíço), com divisão '
      + 'em grupos equilibrados por gênero e nível, sorteio ou seleção manual, '
      + 'qualificação de classificados e progressão automática entre fases. '
      + 'A inscrição continua em lista única por modalidade.',
  },
});

/** Valor padrão (todas as flags desligadas). */
export const DEFAULT_FEATURE_FLAGS = Object.freeze(
  Object.fromEntries(Object.values(FEATURE_FLAG).map((key) => [key, false])),
);

/**
 * Normaliza um mapa de flags vindo do Firestore, garantindo booleanos e
 * preenchendo as ausentes com `false`. Ignora chaves desconhecidas.
 * @param {Record<string, unknown>|null|undefined} raw
 * @returns {Record<string, boolean>}
 */
export function normalizeFeatureFlags(raw) {
  const out = { ...DEFAULT_FEATURE_FLAGS };
  if (raw && typeof raw === 'object') {
    Object.values(FEATURE_FLAG).forEach((key) => {
      if (typeof raw[key] === 'boolean') out[key] = raw[key];
    });
  }
  return out;
}
