#!/usr/bin/env node
/**
 * Verifica se um user é platform admin no Firestore.
 * Útil para diagnosticar problemas de permissão em produção.
 *
 * Uso:
 *   node scripts/check-platform-admin.mjs <uid>
 *   node scripts/check-platform-admin.mjs me@email.com
 *
 * Se passar UID: checa direto.
 * Se passar email: busca em users por email_lc.
 * Sem argumentos: lista todos os platform admins.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'pickleball';
const arg = process.argv[2];

async function main() {
  initializeApp({ databaseId: DATABASE_ID });
  const db = getFirestore();

  if (!arg) {
    console.log('▶ Listando platform admins do banco', DATABASE_ID);
    const snap = await db.collection('users').where('role', '==', 'platform_admin').get();
    if (snap.empty) {
      console.log('  ⚠ Nenhum user com role=platform_admin encontrado.');
      console.log('  Para criar um: edite o doc users/{seuUid} e adicione role: "platform_admin"');
      process.exit(0);
    }
    snap.docs.forEach((d) => {
      const u = d.data();
      console.log(`  ✓ ${d.id}  ${u.email || ''}  ${u.full_name || u.platform_name || ''}`);
    });
    return;
  }

  let uid = arg;
  if (arg.includes('@')) {
    const snap = await db.collection('users').where('email_lc', '==', arg.toLowerCase()).limit(1).get();
    if (snap.empty) {
      console.log(`✗ Nenhum user com email ${arg}.`);
      process.exit(1);
    }
    uid = snap.docs[0].id;
  }

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    console.log(`✗ users/${uid} não existe.`);
    process.exit(1);
  }
  const u = userDoc.data();
  const isAdmin = u.role === 'platform_admin';
  console.log('');
  console.log(`UID:    ${uid}`);
  console.log(`Email:  ${u.email || '—'}`);
  console.log(`Nome:   ${u.full_name || u.platform_name || '—'}`);
  console.log(`Role:   ${u.role || '—'}`);
  console.log('');
  if (isAdmin) {
    console.log('✅ Este user É platform admin (acesso total ao Painel).');
  } else {
    console.log('❌ Este user NÃO é platform admin.');
    console.log('   Para promover, edite users/' + uid + ' e adicione o campo:');
    console.log('     role: "platform_admin"');
  }

  // Verifica também arena_managers (gestor de arena específica)
  const mgrs = await db.collection('arena_managers').where('user_id', '==', uid).get();
  if (!mgrs.empty) {
    console.log('');
    console.log(`É gestor de ${mgrs.size} arena(s):`);
    mgrs.docs.forEach((d) => {
      const m = d.data();
      console.log(`  - ${m.arena_id} (${m.role || 'manager'})`);
    });
  }
}

main().catch((err) => {
  console.error('✗ Erro:', err);
  process.exit(1);
});
