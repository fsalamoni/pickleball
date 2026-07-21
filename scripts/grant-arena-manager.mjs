#!/usr/bin/env node
/**
 * Concede papel de gestor para um user em uma arena específica.
 *
 * Cria documento em arena_managers/{arenaId}_{uid} com role=manager.
 * O doc ID é determinístico, conforme as Firestore Rules esperam
 * (função isArenaManager).
 *
 * Uso:
 *   node scripts/grant-arena-manager.mjs grant <arenaId> <uid|email>
 *   node scripts/grant-arena-manager.mjs revoke <arenaId> <uid|email>
 *   node scripts/grant-arena-manager.mjs list <arenaId>
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'pickleball';
const [, , action, arenaId, target] = process.argv;

async function resolveUid(db) {
  if (!target.includes('@')) return target;
  const snap = await db.collection('users').where('email_lc', '==', target.toLowerCase()).limit(1).get();
  if (snap.empty) throw new Error(`Email ${target} não encontrado em users/.`);
  return snap.docs[0].id;
}

async function main() {
  initializeApp({ databaseId: DATABASE_ID });
  const db = getFirestore();

  if (action === 'list' && arenaId) {
    const snap = await db.collection('arena_managers').where('arena_id', '==', arenaId).get();
    if (snap.empty) {
      console.log(`Nenhum gestor em ${arenaId}.`);
      return;
    }
    console.log(`Gestores de ${arenaId}:`);
    for (const d of snap.docs) {
      const m = d.data();
      const userDoc = await db.collection('users').doc(m.user_id).get().catch(() => null);
      const name = userDoc?.exists ? (userDoc.data().full_name || userDoc.data().email || '—') : '—';
      console.log(`  - ${m.user_id} (${m.role || 'manager'})  ${name}`);
    }
    return;
  }

  if (!['grant', 'revoke'].includes(action) || !arenaId || !target) {
    console.error('Uso:');
    console.error('  node scripts/grant-arena-manager.mjs grant <arenaId> <uid|email>');
    console.error('  node scripts/grant-arena-manager.mjs revoke <arenaId> <uid|email>');
    console.error('  node scripts/grant-arena-manager.mjs list <arenaId>');
    process.exit(1);
  }

  const uid = await resolveUid(db);
  const docId = `${arenaId}_${uid}`;

  if (action === 'grant') {
    await db.collection('arena_managers').doc(docId).set({
      arena_id: arenaId,
      user_id: uid,
      role: 'manager',
      created_at: Timestamp.now(),
    }, { merge: true });
    console.log(`✅ ${uid} agora é manager de ${arenaId} (doc: arena_managers/${docId}).`);
  } else {
    await db.collection('arena_managers').doc(docId).delete();
    console.log(`✅ ${uid} removido de managers de ${arenaId}.`);
  }
}

main().catch((err) => {
  console.error('✗ Erro:', err.message);
  process.exit(1);
});
