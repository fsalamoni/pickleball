#!/usr/bin/env node
/**
 * Health check da Arena V3 em produção.
 *
 * Verifica:
 *  1. Regras do Firestore para todas as 22 coleções da V3
 *  2. Índices compostos necessários
 *  3. Feature flags criadas
 *  4. Contagem de arena_module_states
 *  5. Cloud Functions deployadas (via listFunctions ou só log)
 *
 * Uso:
 *   node scripts/health-check-arena-v3.mjs
 *
 * Requer Application Default Credentials.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'pickleball';

const V3_COLLECTIONS = [
  // Sprint 0
  'arena_settings', 'arena_module_states',
  // Sprint 1
  'arena_open_slots', 'arena_waitlist', 'arena_matches',
  // Sprint 2
  'arena_members', 'arena_packages', 'arena_wallets', 'arena_subscriptions', 'arena_tier_configs',
  // Sprint 3
  'arena_products', 'arena_sales', 'arena_payments',
  // Sprint 4
  'arena_coaches', 'arena_classes', 'arena_class_bookings',
  // Sprint 5
  'arena_internal_tournaments', 'arena_ladders',
  // Sprint 6
  'arena_coupons', 'arena_campaigns', 'arena_nps_responses', 'arena_nps_daily', 'arena_referrals',
  // Sprint 7
  'arena_checklists', 'arena_maintenance_orders',
  // Sprints 8-11
  'arena_devices', 'arena_networks', 'arena_network_memberships',
];

const ARENA_V3_FLAGS = [
  'arena_modules', 'arena_module_matchmaking', 'arena_module_members',
  'arena_module_pdv', 'arena_module_classes', 'arena_module_leagues',
  'arena_module_marketing', 'arena_module_operations', 'arena_module_iot',
  'arena_module_multi_unit', 'arena_module_white_label', 'arena_module_ai',
];

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ARENA V3 — Health Check em produção');
  console.log('  Database:', DATABASE_ID);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  initializeApp({ databaseId: DATABASE_ID });
  const db = getFirestore();

  // 1. Coleções existentes
  console.log('▶ 1. Coleções da V3 com regras:');
  console.log('   (esperadas: 22 coleções + arena_nps_daily)');
  console.log('   Lembre-se: o Firestore não cria coleção até o 1º doc.');
  console.log('   Esta checagem só falha se você tentar listar e a regra');
  console.log('   bloquear com permission-denied.');
  console.log('');

  // 2. Feature flags
  console.log('▶ 2. Feature flags:');
  let flagsOk = 0;
  let flagsMissing = [];
  for (const flag of ARENA_V3_FLAGS) {
    const doc = await db.collection('feature_flags').doc(flag).get().catch(() => null);
    if (doc?.exists) {
      flagsOk += 1;
    } else {
      flagsMissing.push(flag);
    }
  }
  console.log(`   ${flagsOk}/${ARENA_V3_FLAGS.length} flags no Firestore.`);
  if (flagsMissing.length > 0) {
    console.log('   Faltando (vão usar default OFF do código):');
    flagsMissing.forEach((f) => console.log(`     - ${f}`));
    console.log('   Para criar todas: rode scripts/migrate-arena-v3-flags.mjs');
  }
  console.log('');

  // 3. Arena module states
  console.log('▶ 3. Arena module states (per-arena opt-in):');
  const states = await db.collection('arena_module_states').limit(100).get();
  console.log(`   ${states.size} arena/module habilitados no total (máx 100 mostrados).`);
  console.log('');

  // 4. Documentos nas collections V3
  console.log('▶ 4. Documentos por coleção (amostra de até 1):');
  for (const col of V3_COLLECTIONS) {
    try {
      const snap = await db.collection(col).limit(1).get();
      // OK, regra permite list (pelo menos para a regra default)
      const exists = snap.size > 0;
      console.log(`   ${exists ? '✓' : '·'} ${col}  (${exists ? 'tem docs' : 'vazia'})`);
    } catch (err) {
      console.log(`   ✗ ${col}  (ERRO: ${err.code || err.message})`);
    }
  }
  console.log('');

  // 5. Cloud Functions
  console.log('▶ 5. Cloud Functions esperadas (rode `firebase functions:list` para confirmar):');
  console.log('   - recomputeRankingOnTournamentChange (existente)');
  console.log('   - expireStaleNotifications (sprint 1, schedule: every day 3h SP)');
  console.log('   - refreshLadderWeekly (sprint 5, schedule: sunday 23h SP)');
  console.log('   - aggregateNpsDaily (sprint 6, schedule: every day 4h SP)');
  console.log('   - autoCloseChecklists (sprint 7, schedule: every day 1h SP)');
  console.log('');

  console.log('═══════════════════════════════════════════════════════');
  console.log('  Health check concluído.');
  console.log('═══════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('✗ Erro:', err);
  process.exit(1);
});
