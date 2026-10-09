/**
 * Biblioteca inicial PickleRush (a "semente") e a importação em lote do admin.
 *
 * A semente mora em `content/seed.js` e é carregada SÓ por import dinâmico
 * (são dezenas de itens; ninguém que não seja admin baixa isso). Instalar é
 * idempotente: cria o que falta, atualiza o que ganhou versão nova e NÃO
 * mexe no que o admin editou (`seed_customized`) nem recria o que ele apagou
 * (`seed_removed`).
 */

import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { normalizeItemInput } from '../domain/trainingItem.js';
import { PLATFORM_AUTHOR } from '../domain/visibility.js';
import { createItem, TRAINING_ITEMS } from './trainingItemService.js';
import { markSeed } from './settingsService.js';

/** @returns {Promise<{ version: number, items: object[] }>} */
export async function loadSeed() {
  const mod = await import('../content/seed.js');
  return { version: mod.SEED_VERSION, items: mod.SEED_ITEMS };
}

async function platformItemsBySlug() {
  const snap = await getDocs(query(collection(db, TRAINING_ITEMS), where('author_uid', '==', PLATFORM_AUTHOR)));
  const map = new Map();
  snap.docs.forEach((d) => { const v = d.data(); if (v.seed_slug) map.set(v.seed_slug, { id: d.id, ...v }); });
  return map;
}

/**
 * O que a instalação faria agora (a tela mostra antes de confirmar).
 * @returns {Promise<{ version: number, create: object[], update: object[], keep: object[], removed: object[] }>}
 */
export async function planSeedInstall(settings) {
  const [{ version, items }, existentes] = await Promise.all([loadSeed(), platformItemsBySlug()]);
  const removidos = new Set(settings?.seed_removed || []);
  const plan = { version, create: [], update: [], keep: [], removed: [] };
  for (const it of items) {
    const atual = existentes.get(it.slug);
    if (!atual) (removidos.has(it.slug) ? plan.removed : plan.create).push(it);
    else if (!atual.seed_customized && (atual.seed_version || 0) < (it.version || 1)) plan.update.push({ ...it, id: atual.id });
    else plan.keep.push(it);
  }
  return plan;
}

/**
 * Instala/atualiza a semente.
 * @param {{ identity: object, settings: object, restoreRemoved?: boolean, onProgress?: (n: number, total: number) => void }} p
 * @returns {Promise<{ created: number, updated: number, failed: Array<{ slug: string, error: string }> }>}
 */
export async function installSeed({ identity, settings, restoreRemoved = false, onProgress }) {
  if (!identity?.isAdmin) throw new Error('Só a equipe da plataforma instala a biblioteca inicial.');
  const plan = await planSeedInstall(settings);
  const criar = restoreRemoved ? [...plan.create, ...plan.removed] : plan.create;
  const total = criar.length + plan.update.length;
  const failed = [];
  let n = 0;
  let created = 0;
  let updated = 0;
  for (const it of criar) {
    try {
      await createItem({ ...it, visibility: 'publico' }, {
        identity, settings, asPlatform: true, featured: !!it.featured, seed: { slug: it.slug, version: it.version || 1 }, silent: true,
      });
      created += 1;
    } catch (err) {
      failed.push({ slug: it.slug, error: err?.message || 'erro' });
    }
    onProgress?.(++n, total);
  }
  for (const it of plan.update) {
    const { valid, errors, value } = normalizeItemInput(it);
    if (!valid) { failed.push({ slug: it.slug, error: Object.values(errors).join(' ') }); onProgress?.(++n, total); continue; }
    try {
      await updateDoc(doc(db, TRAINING_ITEMS, it.id), { ...value, seed_version: it.version || 1, updated_at: serverTimestamp() });
      updated += 1;
    } catch (err) {
      failed.push({ slug: it.slug, error: err?.message || 'erro' });
    }
    onProgress?.(++n, total);
  }
  await markSeed({
    seed_installed_version: plan.version,
    seed_installed_at: serverTimestamp(),
    ...(restoreRemoved ? { seed_removed: [] } : {}),
  });
  await createAuditLog({
    action: 'training_seed_installed',
    actor: identity.actor,
    details: { version: plan.version, created, updated, failed: failed.length },
  });
  return { created, updated, failed };
}

/**
 * Importa itens já validados (`parseItemsJson`) — como conteúdo da plataforma
 * ou do próprio admin.
 * @returns {Promise<{ created: number, failed: Array<{ title: string, error: string }> }>}
 */
export async function importItems(values = [], { identity, settings, asPlatform = true, visibility = 'publico' }) {
  if (!identity?.isAdmin) throw new Error('Só a equipe da plataforma importa em lote.');
  let created = 0;
  const failed = [];
  for (const v of values) {
    try {
      await createItem({ ...v, visibility }, { identity, settings, asPlatform, silent: true });
      created += 1;
    } catch (err) {
      failed.push({ title: v.title || '(sem título)', error: err?.message || 'erro' });
    }
  }
  await createAuditLog({ action: 'training_items_imported', actor: identity.actor, details: { created, failed: failed.length } });
  return { created, failed };
}
