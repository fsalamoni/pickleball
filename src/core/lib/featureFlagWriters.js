/**
 * featureFlagWriters — Helpers para escrever feature flags do Firestore.
 *
 * Re-exporta setFeatureFlag de platformSettingsService e adiciona
 * lista de chaves da Arena V3 para uso em scripts/UI.
 *
 * Usado por:
 * - V2AdminBootstrap (UI de boot inicial)
 * - scripts/migrate-arena-v3-flags.mjs (CLI de migração)
 */

export { setFeatureFlag } from '@/core/services/platformSettingsService';

/** Todas as 51 feature flags da Arena V3 (1 master + 11 famílias + 39 sub-flags). */
export const ARENA_V3_FLAG_KEYS = [
  // Master
  'arena_modules',

  // Matchmaking (family + 3 sub)
  'arena_module_matchmaking',
  'arena_module_matchmaking_open_match',
  'arena_module_matchmaking_partner_finder',
  'arena_module_matchmaking_waitlist',

  // Members (family + 4 sub)
  'arena_module_members',
  'arena_module_members_tiers',
  'arena_module_members_packages',
  'arena_module_members_subscription',
  'arena_module_members_wallet',

  // PDV (family + 3 sub)
  'arena_module_pdv',
  'arena_module_pdv_catalog',
  'arena_module_pdv_pix_native',
  'arena_module_pdv_split',

  // Classes (family + 3 sub)
  'arena_module_classes',
  'arena_module_classes_catalog',
  'arena_module_classes_packages',
  'arena_module_classes_marketplace',

  // Leagues (family + 3 sub)
  'arena_module_leagues',
  'arena_module_leagues_internal',
  'arena_module_leagues_ladder',
  'arena_module_leagues_open_play',

  // Marketing (family + 4 sub)
  'arena_module_marketing',
  'arena_module_marketing_campaigns',
  'arena_module_marketing_coupons',
  'arena_module_marketing_nps',
  'arena_module_marketing_referral',

  // Operations (family + 3 sub)
  'arena_module_operations',
  'arena_module_operations_checklist',
  'arena_module_operations_inventory',
  'arena_module_operations_maintenance',

  // IoT (family + 3 sub)
  'arena_module_iot',
  'arena_module_iot_qr_kiosk',
  'arena_module_iot_lighting',
  'arena_module_iot_sensors',

  // Multi-unit (family + 3 sub)
  'arena_module_multi_unit',
  'arena_module_multi_unit_network',
  'arena_module_multi_unit_consolidated_bi',
  'arena_module_multi_unit_cross_booking',

  // White label (family + 3 sub)
  'arena_module_white_label',
  'arena_module_white_label_branding',
  'arena_module_white_label_domain',
  'arena_module_white_label_app',

  // AI (family + 3 sub)
  'arena_module_ai',
  'arena_module_ai_pricing',
  'arena_module_ai_matchmaking',
  'arena_module_ai_forecast',
];
