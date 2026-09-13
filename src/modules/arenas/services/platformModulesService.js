/**
 * Camada 1 — o que a PLATAFORMA liberou às arenas.
 *
 * Um documento só: `platform_settings/arena_modules`, campo `modules`, um
 * mapa `{ [moduleId]: { released, mode, note, released_at, released_by } }`.
 *
 * Por que um documento e não uma coleção: a liberação é lida em TODA tela de
 * arena. Uma coleção custaria uma consulta por tela; um documento custa uma
 * leitura, cacheada. E `platform_settings` já tem regra
 * (`match /platform_settings/{docId}`: leitura pública, escrita só do admin
 * da plataforma) — **nenhuma regra nova, nenhum índice novo**.
 *
 * Por que não usar `FEATURE_FLAG`: flag é liga/desliga de CÓDIGO. Aqui são 45
 * módulos de produto, com modo de liberação e observação. Misturar os dois
 * estouraria a contagem "X ativas de Y" do painel e confundiria dois conceitos.
 * A chave-mestra (`arena_modules`) essa sim é flag — porque é código.
 */

import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { isModuleReleasable } from '../domain/moduleCatalog.js';
import { MODULE_RELEASE_MODE, normalizePlatformModules } from '../domain/moduleAccess.js';

const COL = 'platform_settings';
const DOC_ID = 'arena_modules';

function ref() {
  return doc(db, COL, DOC_ID);
}

/**
 * Lê o mapa de liberação. NUNCA lança: sem documento, sem banco ou sem
 * permissão, devolve tudo desligado — que é o comportamento seguro.
 * @returns {Promise<Record<string, { released: boolean, mode: string, note: string }>>}
 */
export async function getPlatformArenaModules() {
  try {
    if (!db) return normalizePlatformModules(null);
    const snap = await getDoc(ref());
    return normalizePlatformModules(snap.exists() ? snap.data()?.modules : null);
  } catch {
    return normalizePlatformModules(null);
  }
}

/**
 * Observa o mapa em tempo real. Devolve a função de cancelamento.
 * Em qualquer erro entrega tudo desligado e segue — nunca quebra a aplicação.
 * @param {(map: Record<string, Object>) => void} cb
 * @returns {() => void}
 */
export function subscribePlatformArenaModules(cb) {
  if (!db) {
    cb(normalizePlatformModules(null));
    return () => {};
  }
  try {
    return onSnapshot(
      ref(),
      (snap) => cb(normalizePlatformModules(snap.exists() ? snap.data()?.modules : null)),
      () => cb(normalizePlatformModules(null)),
    );
  } catch {
    cb(normalizePlatformModules(null));
    return () => {};
  }
}

/**
 * Libera (ou retira) UM módulo. Escrita com merge: nunca toca nos outros.
 *
 * Recusa liberar módulo que ainda não existe no código — a checagem do
 * catálogo também vale aqui, não só na tela, porque um documento escrito à
 * mão no console passaria por cima da interface.
 *
 * @param {string} moduleId
 * @param {{ released?: boolean, mode?: string, note?: string }} patch
 * @param {Object|null} actor
 */
export async function setArenaModuleRelease(moduleId, patch = {}, actor = null) {
  if (!moduleId) throw new Error('moduleId é obrigatório.');
  const released = Boolean(patch.released);
  if (released && !isModuleReleasable(moduleId)) {
    throw new Error('Este módulo ainda está em construção e não pode ser liberado.');
  }
  const mode = patch.mode === MODULE_RELEASE_MODE.FORCED
    ? MODULE_RELEASE_MODE.FORCED
    : MODULE_RELEASE_MODE.OPT_IN;

  await setDoc(
    ref(),
    {
      modules: {
        [moduleId]: {
          released,
          mode,
          note: typeof patch.note === 'string' ? patch.note.slice(0, 280) : '',
          released_at: released ? serverTimestamp() : null,
          released_by: released ? (actor?.uid || null) : null,
        },
      },
      updated_at: serverTimestamp(),
    },
    { merge: true },
  );

  await createAuditLog({
    action: released ? 'arena_module_released' : 'arena_module_unreleased',
    actor,
    details: { module_id: moduleId, mode },
  });
  logger.info('arena_module_release_set', { moduleId, released, mode });
}

/**
 * Libera/retira VÁRIOS módulos numa escrita só (usado por "liberar a família
 * inteira"). Uma escrita, uma auditoria — não N.
 *
 * @param {Array<{ moduleId: string, released: boolean, mode?: string }>} entries
 * @param {Object|null} actor
 */
export async function setArenaModuleReleases(entries = [], actor = null) {
  const valid = entries.filter(
    ({ moduleId, released }) => moduleId && (!released || isModuleReleasable(moduleId)),
  );
  if (valid.length === 0) return;

  const modules = {};
  valid.forEach(({ moduleId, released, mode }) => {
    modules[moduleId] = {
      released: Boolean(released),
      mode: mode === MODULE_RELEASE_MODE.FORCED
        ? MODULE_RELEASE_MODE.FORCED
        : MODULE_RELEASE_MODE.OPT_IN,
      note: '',
      released_at: released ? serverTimestamp() : null,
      released_by: released ? (actor?.uid || null) : null,
    };
  });

  await setDoc(ref(), { modules, updated_at: serverTimestamp() }, { merge: true });

  await createAuditLog({
    action: 'arena_modules_release_bulk',
    actor,
    details: {
      count: valid.length,
      released: valid.filter((e) => e.released).map((e) => e.moduleId),
      unreleased: valid.filter((e) => !e.released).map((e) => e.moduleId),
    },
  });
  logger.info('arena_modules_release_bulk', { count: valid.length });
}
