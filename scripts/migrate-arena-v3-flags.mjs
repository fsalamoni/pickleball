#!/usr/bin/env node
/**
 * Script de migração: Arena V3 Feature Flags → Firestore.
 *
 * Cria (ou atualiza) documentos em `feature_flags` com `value: false`
 * (default) para todas as 50+ flags da V3. Se a flag já existir, mantém
 * o valor atual (não sobrescreve).
 *
 * USAR QUANDO: você quer que TODAS as flags da V3 comecem OFF no Firestore
 * e sejam gerenciáveis pelo painel admin. Se você não rodar este script,
 * o código usa os defaults do `DEFAULT_FEATURE_FLAGS` em runtime mesmo,
 * mas o painel admin não vai conseguir alterná-las.
 *
 * Como rodar:
 *   node scripts/migrate-arena-v3-flags.mjs
 *
 * Requer credenciais: o script usa Application Default Credentials.
 * Em CI, defina GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json.
 *
 * Para deploy em produção (uma vez só):
 *   firebase functions:secrets:set GCLOUD_PROJECT  # ou use o default
 *   node scripts/migrate-arena-v3-flags.mjs
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FLAGS_SOURCE = join(__dirname, '..', 'src', 'core', 'featureFlags.js');

const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'pickleball';

// 50 feature flags da Arena V3. Mantido em sincronia com src/core/featureFlags.js
// (sub-familias). Se você adicionar uma nova flag aqui, adicione em
// src/core/featureFlags.js também.
const ARENA_V3_FLAGS = [
  // Master + families
  'arena_modules',
  'arena_module_matchmaking',
  'arena_module_members',
  'arena_module_pdv',
  'arena_module_classes',
  'arena_module_leagues',
  'arena_module_marketing',
  'arena_module_operations',
  'arena_module_iot',
  'arena_module_multi_unit',
  'arena_module_white_label',
  'arena_module_ai',
  // Matchmaking (4 sub-flags)
  'arena_module_matchmaking_open_match',
  'arena_module_matchmaking_partner_finder',
  'arena_module_matchmaking_waitlist',
  'arena_module_matchmaking_notifications',
  // Members (4)
  'arena_module_members_tiers',
  'arena_module_members_packages',
  'arena_module_members_subscription',
  'arena_module_members_wallet',
  // PDV (3)
  'arena_module_pdv_catalog',
  'arena_module_pdv_pix_native',
  'arena_module_pdv_split',
  // Classes (3)
  'arena_module_classes_catalog',
  'arena_module_classes_packages',
  'arena_module_classes_marketplace',
  // Leagues (4)
  'arena_module_leagues_internal',
  'arena_module_leagues_ladder',
  'arena_module_leagues_open_play',
  'arena_module_leagues_prizing',
  // Marketing (4)
  'arena_module_marketing_campaigns',
  'arena_module_marketing_loyalty',
  'arena_module_marketing_coupons',
  'arena_module_marketing_referral',
  'arena_module_marketing_nps',
  // Operations (4)
  'arena_module_operations_checklist',
  'arena_module_operations_maintenance',
  'arena_module_operations_inventory',
  'arena_module_operations_staff',
  // IoT (4)
  'arena_module_iot_qr_kiosk',
  'arena_module_iot_lighting',
  'arena_module_iot_sensors',
  'arena_module_iot_video_replay',
  // Multi-unit (3)
  'arena_module_multi_unit_network',
  'arena_module_multi_unit_consolidated_bi',
  'arena_module_multi_unit_cross_booking',
  // White label (3)
  'arena_module_white_label_branding',
  'arena_module_white_label_domain',
  'arena_module_white_label_app',
  // AI (3)
  'arena_module_ai_pricing',
  'arena_module_ai_matchmaking',
  'arena_module_ai_forecast',
];

async function main() {
  console.log('▶ Migração de Feature Flags Arena V3 → Firestore');
  console.log('  Database:', DATABASE_ID);
  console.log('  Flags a processar:', ARENA_V3_FLAGS.length);
  console.log('');

  initializeApp({ databaseId: DATABASE_ID });
  const db = getFirestore();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const flagKey of ARENA_V3_FLAGS) {
    const ref = db.collection('feature_flags').doc(flagKey);
    const snap = await ref.get();
    if (snap.exists) {
      skipped += 1;
      console.log(`  ⏭ ${flagKey} (já existe, valor=${snap.data().value})`);
      continue;
    }
    await ref.set({
      key: flagKey,
      value: false,
      family: 'arena_v3',
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      source: 'migrate-arena-v3-flags.mjs',
    });
    created += 1;
    console.log(`  ✓ ${flagKey} (criada, default OFF)`);
  }

  // Também atualiza o FLAGS_MIGRATION_VERSION se existir no projeto
  const migrationRef = db.collection('feature_flags_meta').doc('migration');
  await migrationRef.set(
    {
      last_arena_v3_migration: Timestamp.now(),
      arena_v3_flags_count: ARENA_V3_FLAGS.length,
    },
    { merge: true },
  );

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  Resultado:');
  console.log(`    Criadas:  ${created}`);
  console.log(`    Já existiam: ${skipped}`);
  console.log(`    Atualizadas (meta): ${updated}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');
  console.log('Próximos passos:');
  console.log('  1. Painel admin → feature flags da V3 já podem ser alternadas.');
  console.log('  2. Para ativar uma flag por arena, use a página /arenas/:id/gerir/modulos');
  console.log('     ou crie doc em arena_module_states/{arenaId}_{moduleId} com enabled: true.');
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ Erro na migração:', err);
  process.exit(1);
});
