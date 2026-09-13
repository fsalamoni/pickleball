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
  writeBatch,
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
 * Liga/desliga VÁRIOS módulos de uma arena numa escrita só.
 *
 * Existe por causa da cascata: ligar a carteira liga membros junto, e desligar
 * membros derruba carteira, pacotes e mensalidade. Fazer isso em N escritas
 * deixaria a arena num estado inconsistente se a terceira falhasse — e a tela
 * mostraria metade ligada. Aqui é lote: tudo ou nada.
 *
 * @param {string} arenaId
 * @param {Array<{ moduleId: string, enabled: boolean, config?: Object }>} entries
 * @param {Object|null} actor
 * @param {{ reason?: string }} [meta] — por que a mudança aconteceu (auditoria)
 */
export async function setArenaModuleStates(arenaId, entries = [], actor = null, meta = {}) {
  if (!arenaId) throw new Error('arenaId é obrigatório.');
  const valid = entries.filter((e) => e?.moduleId && isValidModuleId(e.moduleId));
  if (valid.length === 0) return;

  // Lê o que já existe para preservar created_at e a config de quem não muda.
  const existing = await Promise.all(
    valid.map((e) => getDoc(doc(db, COL, moduleStateDocId(arenaId, e.moduleId)))),
  );

  const batch = writeBatch(db);
  valid.forEach((entry, i) => {
    const id = moduleStateDocId(arenaId, entry.moduleId);
    const prev = existing[i];
    const enabled = Boolean(entry.enabled);
    batch.set(doc(db, COL, id), {
      id,
      arena_id: arenaId,
      module_id: entry.moduleId,
      enabled,
      config: entry.config || (prev.exists() ? prev.data().config : null) || {},
      enabled_at: enabled ? serverTimestamp() : null,
      enabled_by: enabled ? (actor?.uid || null) : null,
      disabled_at: enabled ? null : serverTimestamp(),
      disabled_by: enabled ? null : (actor?.uid || null),
      created_at: prev.exists() ? prev.data().created_at : serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  });
  await batch.commit();

  await createAuditLog({
    action: 'arena_modules_changed',
    actor,
    details: {
      arena_id: arenaId,
      enabled: valid.filter((e) => e.enabled).map((e) => e.moduleId),
      disabled: valid.filter((e) => !e.enabled).map((e) => e.moduleId),
      reason: meta.reason || null,
    },
  });
  logger.info('arena_module_states_set', { arenaId, count: valid.length });
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
