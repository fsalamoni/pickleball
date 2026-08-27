/**
 * Catálogo de feature flags da plataforma.
 *
 * As flags são guardadas em um único documento do Firestore
 * (`platform_settings/global`, campo `feature_flags`) e podem ser ligadas/
 * desligadas em tempo de execução pelo admin master na página de Métricas.
 *
 * NOTA: as funcionalidades que estavam LIGADAS em produção foram convertidas
 * em código permanente — deixaram de ser flags. Resta apenas a flag abaixo,
 * que segue DESLIGADA por padrão. O documento do Firestore pode ainda conter
 * chaves antigas: `normalizeFeatureFlags` as ignora (só lê chaves conhecidas),
 * então nada precisa ser alterado no banco.
 */

export const FEATURE_FLAG = Object.freeze({
  /**
   * Integração OFICIAL com o DUPR (fase 2 — reservado): puxar o rating por ID
   * e enviar partidas. Exige acesso de parceiro/clube DUPR e um backend com
   * credenciais. Sem efeito enquanto a integração não for implementada.
   */
  DUPR_OFFICIAL_SYNC: 'dupr_official_sync',
});

/** Metadados de exibição para o painel de flags (admin master). */
export const FEATURE_FLAG_META = Object.freeze({
  [FEATURE_FLAG.DUPR_OFFICIAL_SYNC]: {
    label: 'DUPR oficial (fase 2 — reservado)',
    description:
      'Reservado para a integração OFICIAL com o DUPR (puxar rating por ID e '
      + 'enviar partidas). Exige acesso de parceiro/clube DUPR e backend com '
      + 'credenciais. Sem efeito enquanto a integração não for implementada.',
  },
});

/** Valor padrão (todas as flags desligadas). */
export const DEFAULT_FEATURE_FLAGS = Object.freeze(
  Object.fromEntries(Object.values(FEATURE_FLAG).map((key) => [key, false])),
);

/** Todas as chaves de flag conhecidas (fonte única de verdade para contagens). */
export const ALL_FLAG_KEYS = Object.freeze(Object.values(FEATURE_FLAG));

/**
 * Conta flags de forma consistente em toda a UI: `total` é o número de flags
 * definidas em `FEATURE_FLAG`; `active` são as ligadas dentre elas (ignora
 * chaves órfãs no mapa do Firestore). Use este helper em TODA exibição de
 * "X ativas de Y" para não divergir entre telas.
 * @param {Record<string, boolean>|null|undefined} flags
 * @returns {{ total: number, active: number }}
 */
export function countFlags(flags) {
  const total = ALL_FLAG_KEYS.length;
  const active = ALL_FLAG_KEYS.filter((key) => Boolean(flags?.[key])).length;
  return { total, active };
}

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
