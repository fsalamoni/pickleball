/**
 * Service: Module States por arena (Arena V3).
 *
 * Liga/desliga módulos por arena na coleção `arena_module_states/{arenaId_moduleId}`.
 * Doc id determinístico = `${arenaId}_${moduleId}`.
 *
 * Aditivo — não mexe em nenhuma coleção existente.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { isValidModuleId, moduleStateDocId } from '../domain/modules.js';

const COL = 'arena_module_states';

/**
 * Liga ou desliga um módulo em uma arena.
 * Cria o doc se não existir; atualiza se existir.
 * Idempotente.
 *
 * @param {string} arenaId
 * @param {string} moduleId
 * @param {boolean} enabled
 * @param {Object} [config] - config específica do módulo
 * @param {Object} [actor] - user que está fazendo
 */
export async function setArenaModuleState(arenaId, moduleId, enabled, config = {}, actor = null) {
  if (!arenaId) throw new Error('arenaId é obrigatório.');
  if (!isValidModuleId(moduleId)) throw new Error(`Módulo inválido: ${moduleId}`);

  const id = moduleStateDocId(arenaId, moduleId);
  const ref = doc(db, COL, id);
  const existing = await getDoc(ref);

  const wasEnabled = existing.exists() ? existing.data().enabled : false;

  await setDoc(ref, {
    id,
    arena_id: arenaId,
    module_id: moduleId,
    enabled: !!enabled,
    config: config || {},
    enabled_at: enabled ? serverTimestamp() : null,
    enabled_by: enabled ? (actor?.uid || 'unknown') : null,
    disabled_at: !enabled ? serverTimestamp() : null,
    disabled_by: !enabled ? (actor?.uid || 'unknown') : null,
    created_at: existing.exists() ? existing.data().created_at : serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  if (wasEnabled !== !!enabled) {
    await createAuditLog({
      action: enabled ? 'arena_module_enabled' : 'arena_module_disabled',
      actor,
      details: { arena_id: arenaId, module_id: moduleId },
    });
  } else {
    await createAuditLog({
      action: 'arena_module_config_updated',
      actor,
      details: { arena_id: arenaId, module_id: moduleId, config_keys: Object.keys(config) },
    });
  }
  logger.info('arena_module_state_set', { arenaId, moduleId, enabled });
}

/**
 * Toggle rápido (true → false, false → true).
 */
export async function toggleArenaModule(arenaId, moduleId, actor = null) {
  const current = await getArenaModuleState(arenaId, moduleId);
  await setArenaModuleState(arenaId, moduleId, !current?.enabled, current?.config, actor);
}

/**
 * Lista todos os module states de uma arena.
 * @returns {Promise<Array<{id, arena_id, module_id, enabled, config, ...}>>}
 */
export async function listArenaModuleStates(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL), where('arena_id', '==', arenaId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Busca o estado de um módulo específico.
 * @returns {Promise<{enabled, config, ...}|null>}
 */
export async function getArenaModuleState(arenaId, moduleId) {
  if (!db || !arenaId || !moduleId) return null;
  const snap = await getDoc(doc(db, COL, moduleStateDocId(arenaId, moduleId)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Lista arenas que habilitaram um módulo específico.
 * Útil para o atleta achar arenas com aquele recurso.
 */
export async function listArenasWithModule(moduleId) {
  if (!db || !moduleId) return [];
  const snap = await getDocs(query(collection(db, COL), where('module_id', '==', moduleId), where('enabled', '==', true)));
  return snap.docs.map((d) => d.data().arena_id).filter(Boolean);
}
