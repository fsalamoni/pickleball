/**
 * Configuração do Centro de Treino (`platform_settings/training`).
 * Leitura pública; escrita só do admin (regra de `platform_settings`).
 * Documento ausente vale os padrões — os mesmos da regra.
 */

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { normalizeTrainingSettings, settingsPatch, TRAINING_SETTINGS_DOC } from '../domain/settings.js';

const ref = () => doc(db, 'platform_settings', TRAINING_SETTINGS_DOC);

/** Lê a configuração (ou os padrões). Falha de leitura PROPAGA: quem mostra decide. */
export async function getTrainingSettings() {
  const snap = await getDoc(ref());
  return normalizeTrainingSettings(snap.exists() ? snap.data() : null);
}

/** Salva as chaves editáveis e audita o que mudou. */
export async function saveTrainingSettings(input, atual, { identity }) {
  const next = settingsPatch(input);
  const mudancas = Object.keys(next).filter((k) => next[k] !== atual?.[k]).map((k) => ({ key: k, from: atual?.[k] ?? null, to: next[k] }));
  await setDoc(ref(), { ...next, updated_at: serverTimestamp(), updated_by: identity.uid }, { merge: true });
  if (mudancas.length) {
    await createAuditLog({ action: 'training_settings_updated', actor: identity.actor, details: { changes: mudancas } });
  }
  return normalizeTrainingSettings(next);
}

/** Marca a semente instalada (e os itens dela que o admin apagou de propósito). */
export async function markSeed(patch) {
  await setDoc(ref(), { ...patch, updated_at: serverTimestamp() }, { merge: true });
}
