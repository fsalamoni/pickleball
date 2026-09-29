#!/usr/bin/env node
/**
 * Limpeza segura de e-mails legados em coleções de leitura ampla.
 *
 * Sempre roda em DRY-RUN, exceto com APPLY=1 e confirmação exata por comando.
 * Banco padrão: pickleball. Não execute delete-public antes de backfill + janela
 * de observação do código em produção.
 *
 * Uso:
 *   node scripts/privacy-legacy-email-cleanup.mjs report
 *   node scripts/privacy-legacy-email-cleanup.mjs backfill-registration-contacts
 *   node scripts/privacy-legacy-email-cleanup.mjs delete-registration-public-emails
 *   node scripts/privacy-legacy-email-cleanup.mjs delete-wide-user-emails
 */

import { initializeApp } from 'firebase-admin/app';
import {
  FieldPath, FieldValue, getFirestore,
} from 'firebase-admin/firestore';
import {
  deletionPreconditions,
  hasLegacyRegistrationPublicEmail,
  privateContactBackfillPatch,
  provisionalClaimsForLegacyRegistration,
  publicEmailDeletePatch,
  userEmailDeletePatch,
  WIDE_READ_USER_EMAIL_COLLECTIONS,
} from '../src/core/domain/legacyEmailCleanup.js';

const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'pickleball';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || undefined;
const APPLY = process.env.APPLY === '1';
const CONFIRM = String(process.env.CONFIRM || '').trim();
const PAGE_SIZE = Number(process.env.PAGE_SIZE || 250);
const LIMIT = Number(process.env.LIMIT || 0);
const command = process.argv[2] || 'report';

const COMMANDS = new Set([
  'report',
  'backfill-registration-contacts',
  'delete-registration-public-emails',
  'delete-wide-user-emails',
]);

const CONFIRMATION = Object.freeze({
  'backfill-registration-contacts': 'CRIAR_CONTATOS_PRIVADOS',
  'delete-registration-public-emails': 'APAGAR_EMAILS_PUBLICOS_LEGADOS',
  'delete-wide-user-emails': 'APAGAR_USER_EMAIL_LEGADO',
});

function printUsage() {
  console.log(`Uso:
  npm run privacy:legacy-email-cleanup -- report
  npm run privacy:legacy-email-cleanup -- backfill-registration-contacts
  npm run privacy:legacy-email-cleanup -- delete-registration-public-emails
  npm run privacy:legacy-email-cleanup -- delete-wide-user-emails

Escritas exigem APPLY=1 e CONFIRM com o valor exato do comando.`);
}

if (command === '--help' || command === '-h') {
  printUsage();
  process.exit(0);
}

if (!COMMANDS.has(command)) {
  console.error(`Comando inválido: ${command}`);
  console.error(`Comandos: ${Array.from(COMMANDS).join(', ')}`);
  process.exit(1);
}

function requireConfirmation() {
  if (!APPLY || command === 'report') return;
  const expected = CONFIRMATION[command];
  if (CONFIRM !== expected) {
    console.error(`Confirmação inválida. Para ${command}, use CONFIRM=${expected}`);
    process.exit(1);
  }
}

function logHeader() {
  console.log(`▶ Comando: ${command}`);
  console.log(`▶ Banco: ${DATABASE_ID}`);
  if (PROJECT_ID) console.log(`▶ Projeto: ${PROJECT_ID}`);
  console.log(`▶ Modo: ${APPLY ? 'APPLY (escreve no Firestore)' : 'DRY-RUN (não escreve)'}`);
  if (LIMIT > 0) console.log(`▶ Limite de documentos por coleção: ${LIMIT}`);
  console.log('');
}

async function* listDocs(collectionRef) {
  let last = null;
  let seen = 0;
  while (true) {
    let q = collectionRef.orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (last) q = q.startAfter(last.id);
    const snap = await q.get();
    if (snap.empty) return;
    for (const doc of snap.docs) {
      yield doc;
      seen += 1;
      if (LIMIT > 0 && seen >= LIMIT) return;
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) return;
  }
}

class BatchWriter {
  constructor(db) {
    this.db = db;
    this.batch = db.batch();
    this.count = 0;
    this.commits = 0;
  }

  async set(ref, data, options) {
    if (!APPLY) return;
    this.batch.set(ref, data, options);
    await this.bump();
  }

  async update(ref, data) {
    if (!APPLY) return;
    this.batch.update(ref, data);
    await this.bump();
  }

  async bump() {
    this.count += 1;
    if (this.count >= 400) await this.flush();
  }

  async flush() {
    if (!APPLY || this.count === 0) return;
    await this.batch.commit();
    this.batch = this.db.batch();
    this.count = 0;
    this.commits += 1;
  }
}

async function existingContactFor(regDoc) {
  const snap = await regDoc.ref.collection('private').doc('contact').get();
  return snap.exists ? snap.data() : {};
}

async function existingClaimIds(db, claims) {
  const ids = new Set();
  for (const claim of claims) {
    const snap = await db.collection('provisional_claims').doc(claim.id).get();
    if (snap.exists) ids.add(claim.id);
  }
  return ids;
}

async function reportRegistrations(db) {
  const stats = {
    scanned: 0,
    withPublicEmail: 0,
    contactPatches: 0,
    missingClaims: 0,
    safeToDelete: 0,
    unsafeToDelete: 0,
  };

  for await (const doc of listDocs(db.collection('tournament_registrations'))) {
    stats.scanned += 1;
    const reg = { id: doc.id, ...doc.data() };
    if (!hasLegacyRegistrationPublicEmail(reg)) continue;
    stats.withPublicEmail += 1;
    const contact = await existingContactFor(doc);
    const contactPatch = privateContactBackfillPatch(reg, contact);
    const claims = provisionalClaimsForLegacyRegistration(reg, contact);
    const existingClaims = await existingClaimIds(db, claims);
    const preconditions = deletionPreconditions(reg, contact, existingClaims);
    if (Object.keys(contactPatch).length > 0) stats.contactPatches += 1;
    stats.missingClaims += preconditions.missingClaims.length;
    if (preconditions.ok) stats.safeToDelete += 1;
    else stats.unsafeToDelete += 1;
  }
  return stats;
}

async function backfillRegistrationContacts(db) {
  const stats = { scanned: 0, legacy: 0, contactWrites: 0, claimWrites: 0 };
  const writer = new BatchWriter(db);

  for await (const doc of listDocs(db.collection('tournament_registrations'))) {
    stats.scanned += 1;
    const reg = { id: doc.id, ...doc.data() };
    if (!hasLegacyRegistrationPublicEmail(reg)) continue;
    stats.legacy += 1;

    const contact = await existingContactFor(doc);
    const patch = privateContactBackfillPatch(reg, contact);
    if (Object.keys(patch).length > 0) {
      stats.contactWrites += 1;
      await writer.set(
        doc.ref.collection('private').doc('contact'),
        { ...patch, updated_at: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }

    const claims = provisionalClaimsForLegacyRegistration(reg, { ...contact, ...patch });
    for (const claim of claims) {
      const ref = db.collection('provisional_claims').doc(claim.id);
      const snap = await ref.get();
      if (snap.exists) continue;
      stats.claimWrites += 1;
      await writer.set(ref, { ...claim.data, created_at: FieldValue.serverTimestamp() });
    }
  }
  await writer.flush();
  return { ...stats, commits: writer.commits };
}

async function deleteRegistrationPublicEmails(db) {
  const stats = { scanned: 0, legacy: 0, deleted: 0, skippedUnsafe: 0 };
  const writer = new BatchWriter(db);

  for await (const doc of listDocs(db.collection('tournament_registrations'))) {
    stats.scanned += 1;
    const reg = { id: doc.id, ...doc.data() };
    if (!hasLegacyRegistrationPublicEmail(reg)) continue;
    stats.legacy += 1;

    const contact = await existingContactFor(doc);
    const claims = provisionalClaimsForLegacyRegistration(reg, contact);
    const existingClaims = await existingClaimIds(db, claims);
    const preconditions = deletionPreconditions(reg, contact, existingClaims);
    if (!preconditions.ok) {
      stats.skippedUnsafe += 1;
      continue;
    }

    stats.deleted += 1;
    await writer.update(doc.ref, publicEmailDeletePatch(FieldValue.delete()));
  }
  await writer.flush();
  return { ...stats, commits: writer.commits };
}

async function reportWideUserEmail(db) {
  const stats = {};
  for (const collectionName of WIDE_READ_USER_EMAIL_COLLECTIONS) {
    stats[collectionName] = { scanned: 0, withUserEmail: 0 };
    for await (const doc of listDocs(db.collection(collectionName))) {
      stats[collectionName].scanned += 1;
      if (Object.keys(userEmailDeletePatch(doc.data(), true)).length > 0) {
        stats[collectionName].withUserEmail += 1;
      }
    }
  }
  return stats;
}

async function deleteWideUserEmail(db) {
  const stats = {};
  const writer = new BatchWriter(db);
  for (const collectionName of WIDE_READ_USER_EMAIL_COLLECTIONS) {
    stats[collectionName] = { scanned: 0, deleted: 0 };
    for await (const doc of listDocs(db.collection(collectionName))) {
      stats[collectionName].scanned += 1;
      const patch = userEmailDeletePatch(doc.data(), FieldValue.delete());
      if (Object.keys(patch).length === 0) continue;
      stats[collectionName].deleted += 1;
      await writer.update(doc.ref, patch);
    }
  }
  await writer.flush();
  return { ...stats, commits: writer.commits };
}

async function main() {
  requireConfirmation();
  logHeader();
  const app = initializeApp(PROJECT_ID ? { projectId: PROJECT_ID } : undefined);
  const db = getFirestore(app, DATABASE_ID);

  if (command === 'report') {
    const registrations = await reportRegistrations(db);
    const wide = await reportWideUserEmail(db);
    console.log(JSON.stringify({ registrations, wide }, null, 2));
    return;
  }
  if (command === 'backfill-registration-contacts') {
    console.log(JSON.stringify(await backfillRegistrationContacts(db), null, 2));
    return;
  }
  if (command === 'delete-registration-public-emails') {
    console.log(JSON.stringify(await deleteRegistrationPublicEmails(db), null, 2));
    return;
  }
  if (command === 'delete-wide-user-emails') {
    console.log(JSON.stringify(await deleteWideUserEmail(db), null, 2));
  }
}

main().catch((err) => {
  console.error('✗ Erro:', err);
  process.exit(1);
});
