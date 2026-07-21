/**
 * Service: Settings por arena (Arena V3).
 *
 * CRUD da coleção `arena_settings/{arenaId}`.
 * 1:1 com arena. Auto-cria defaults se não existir.
 * Acesso: gestor da arena + platform admin.
 *
 * Aditivo — não mexe em arenas/{id} nem em nenhuma coleção existente.
 */

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { normalizeArenaSettings } from '../domain/settings.js';

const COL = 'arena_settings';

function str(v) {
  return String(v ?? '').trim();
}

/**
 * Busca settings da arena; se não existir, cria com defaults e retorna.
 * Idempotente.
 *
 * @param {string} arenaId
 * @returns {Promise<{id: string, ...settings, _isDefault: boolean}>}
 */
export async function getOrCreateArenaSettings(arenaId) {
  if (!db || !arenaId) {
    throw new Error('arenaId é obrigatório.');
  }
  const ref = doc(db, COL, arenaId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data(), _isDefault: false };
  }
  // Auto-cria com defaults
  const { value } = normalizeArenaSettings({});
  const payload = {
    ...value,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    updated_by: 'system',
  };
  await setDoc(ref, payload);
  logger.info('arena_settings_created', { arenaId });
  return { id: arenaId, ...payload, _isDefault: true };
}

/**
 * Busca settings existentes; retorna null se não existir.
 */
export async function getArenaSettings(arenaId) {
  if (!db || !arenaId) return null;
  const snap = await getDoc(doc(db, COL, arenaId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Atualiza settings (merge profundo).
 */
export async function updateArenaSettings(arenaId, updates, actor) {
  if (!arenaId) throw new Error('arenaId é obrigatório.');
  if (!updates || typeof updates !== 'object') {
    throw new Error('Updates inválidos.');
  }

  // Garante que existe antes de atualizar
  await getOrCreateArenaSettings(arenaId);

  const { valid, errors, value } = normalizeArenaSettings(updates);
  if (!valid) {
    const firstError = Object.values(errors)[0] || 'Dados inválidos.';
    throw new Error(firstError);
  }

  const ref = doc(db, COL, arenaId);
  await setDoc(ref, {
    ...value,
    updated_at: serverTimestamp(),
    updated_by: actor?.uid || 'unknown',
  }, { merge: true });

  await createAuditLog({
    action: 'arena_settings_updated',
    actor,
    details: { arena_id: arenaId, sections: Object.keys(updates) },
  });
  logger.info('arena_settings_updated', { arenaId, sections: Object.keys(updates) });
}
