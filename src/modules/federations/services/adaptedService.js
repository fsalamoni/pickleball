/**
 * PICKLEBALL ADAPTADO (rodada 3, Bloco 4b) — leituras e chamadas. A
 * classificação só o SERVIDOR grava (`federationAdapted`); a régua pura é
 * `domain/adapted.js`. A comissão consulta por `federation_id` e a pessoa por
 * `user_id` (os campos que a regra confere). O laudo sobe para a pasta de
 * quem envia (`federacao/{uid}/`) e o servidor o copia para a pasta fechada.
 */
import { collection, doc, getDocs, query, where } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/core/config/firebase';
import { t } from '@/core/i18n';
import { FED_COLLECTIONS as C } from '../domain/constants.js';
import { documentStoragePath, validateDocumentFile } from '../domain/privateData.js';
import { chamar } from './federationService.js';

// A da PESSOA mora no serviço geral: a exportação (LGPD) a lê de lá.
export { listMyAdaptedClassifications } from './federationService.js';

/** Uma ação do servidor (`classes_save`, `request`, `withdraw`, `decide`, `revoke`, `report_file`, `check`). */
export const adaptedAction = (federationId, action, payload = {}) => chamar('federationAdapted', { ...payload, federationId, action }, { timeout: 120_000 });

export async function listAdaptedClassifications(fedId) {
  const snap = await getDocs(query(collection(db, C.adaptedClassifications), where('federation_id', '==', fedId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => Number(b.updated_at_ms || 0) - Number(a.updated_at_ms || 0));
}

/** Sobe o laudo e pede a classificação. */
export async function requestClassification({ fedId, uid, file, classId, note }) {
  const erro = validateDocumentFile(file);
  if (erro) throw new Error(erro);
  if (!storage || !uid) throw new Error(t('Firebase não está configurado neste ambiente.'));
  const path = documentStoragePath(uid, doc(collection(db, C.adaptedClassifications)).id, file.type);
  await uploadBytes(storageRef(storage, path), file, { contentType: file.type });
  return adaptedAction(fedId, 'request', { class_id: classId, note, filePath: path, fileName: file.name });
}

/** A conferência dos inscritos de uma modalidade adaptada (quem organiza o torneio). */
export const checkAdaptedModality = (tournamentId, modalityId) => chamar('federationAdapted', { action: 'check', tournamentId, modalityId }, { timeout: 120_000 });
