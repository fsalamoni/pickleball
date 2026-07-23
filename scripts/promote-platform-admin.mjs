#!/usr/bin/env node
/**
 * Promove (ou remove) um user a platform admin.
 *
 * Uso:
 *   node scripts/promote-platform-admin.mjs grant <uid|email>
 *   node scripts/promote-platform-admin.mjs revoke <uid|email>
 *
 * IMPORTANTE: este script altera o Firestore direto. Use com cuidado.
 * Requer que você tenha credenciais de service account com permissão
 * de escrita em users/{uid}.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'pickleball';
const [, , action, target] = process.argv;

if (!['grant', 'revoke'].includes(action) || !target) {
  console.error('Uso: node scripts/promote-platform-admin.mjs <grant|revoke> <uid|email>');
  process.exit(1);
}

async function resolveUid(db) {
  if (!target.includes('@')) return target;
  const snap = await db.collection('users').where('email_lc', '==', target.toLowerCase()).limit(1).get();
  if (snap.empty) throw new Error(`Email ${target} não encontrado em users/.`);
  return snap.docs[0].id;
}

async function main() {
  initializeApp({ databaseId: DATABASE_ID });
  const db = getFirestore();
  const uid = await resolveUid(db);

  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`users/${uid} não existe.`);

  if (action === 'grant') {
    await ref.update({
      role: 'platform_admin',
      role_updated_at: FieldValue.serverTimestamp(),
    });
    console.log(`✅ users/${uid} promovido a platform_admin.`);
  } else {
    await ref.update({
      role: FieldValue.delete(),
      role_updated_at: FieldValue.serverTimestamp(),
    });
    console.log(`✅ users/${uid} removido de platform_admin.`);
  }
}

main().catch((err) => {
  console.error('✗ Erro:', err.message);
  process.exit(1);
});
