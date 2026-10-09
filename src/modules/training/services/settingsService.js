/**
 * Configuração do Centro de Treino (`platform_settings/training`).
 * Leitura pública; escrita só do admin (regra de `platform_settings`).
 * Documento ausente vale os padrões — os mesmos da regra.
 */

import { arrayRemove, arrayUnion, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
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

/**
 * Verifica (ou tira a verificação de) um professor: o público dele passa a
 * entrar na biblioteca sem fila. A regra confere a lista — o que já foi
 * aprovado não muda; a próxima edição de quem saiu da lista volta à fila.
 */
export async function setProfessorVerified(uid, verified, { identity, name = '' }) {
  if (!identity?.isAdmin) throw new Error('Só a equipe da plataforma verifica professores.');
  if (!uid) throw new Error('Professor sem conta.');
  await setDoc(ref(), {
    verified_professors: verified ? arrayUnion(uid) : arrayRemove(uid),
    updated_at: serverTimestamp(),
    updated_by: identity.uid,
  }, { merge: true });
  await createAuditLog({
    action: verified ? 'training_professor_verified' : 'training_professor_unverified',
    actor: identity.actor,
    details: { uid, name: String(name || '').slice(0, 80) },
  });
}

/** Marca a semente instalada (e os itens dela que o admin apagou de propósito). */
export async function markSeed(patch) {
  await setDoc(ref(), { ...patch, updated_at: serverTimestamp() }, { merge: true });
}
