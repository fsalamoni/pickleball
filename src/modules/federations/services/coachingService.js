/**
 * LICENÇA DE PROFESSOR e PROTEÇÃO DE MENORES (Bloco 4) — leituras e
 * chamadas. Toda escrita é do SERVIDOR (`federationCoaching`); a régua pura é
 * `domain/coachLicenses.js` e `domain/safeguarding.js`.
 */
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/core/config/firebase';
import { t } from '@/core/i18n';
import { FED_COLLECTIONS as C, REPORT_KIND } from '../domain/constants.js';
import { documentStoragePath, validateDocumentFile } from '../domain/privateData.js';
import { chamar } from './federationService.js';

const toDoc = (d) => ({ id: d.id, ...d.data() });

/** As licenças de uma federação (equipe dos cursos ou admin). */
export async function listFederationCoachLicenses(fedId) {
  const q = query(collection(db, C.coachLicenses), where('federation_id', '==', fedId));
  return (await getDocs(q)).docs.map(toDoc);
}

/**
 * As denúncias de proteção de menor de uma federação. A consulta FIXA o tipo:
 * é o que deixa a regra provar a permissão `safeguarding` (a disciplina não lê).
 */
export async function listMinorReports(fedId) {
  const q = query(collection(db, C.reports), where('federation_id', '==', fedId), where('kind', '==', REPORT_KIND.MINOR_PROTECTION));
  return (await getDocs(q)).docs.map(toDoc);
}

/** O selo público do professor (`null` = nenhuma licença válida à mostra). */
export async function getCoachBadges(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, C.coachBadges, uid));
  return snap.exists() ? toDoc(snap) : null;
}

/** Os professores credenciados por uma federação (público). */
export async function listCredentialedCoaches(fedId) {
  const q = query(collection(db, C.coachBadges), where('federation_ids', 'array-contains', fedId));
  return (await getDocs(q)).docs.map(toDoc);
}

/** Toda ação da licença e da proteção: `{ action, federationId, ... }`. */
export const coachingAction = (payload) => chamar('federationCoaching', payload);

/**
 * Envia a certidão de antecedentes: o arquivo sobe para a pasta da PRÓPRIA
 * pessoa no Storage (só ela lê) e o servidor registra o envio e avisa o
 * responsável. Decidida a conferência, o servidor apaga o arquivo.
 */
export async function submitBackground({ fedId, uid, file, issuedAt }) {
  const erro = validateDocumentFile(file);
  if (erro) throw new Error(erro);
  if (!storage || !uid) throw new Error(t('Firebase não está configurado neste ambiente.'));
  const path = documentStoragePath(uid, doc(collection(db, C.safeguarding)).id, file.type);
  await uploadBytes(storageRef(storage, path), file, { contentType: file.type });
  return coachingAction({ federationId: fedId, action: 'sg_submit', issuedAt, filePath: path });
}

/** O arquivo da certidão em conferência (o servidor confere quem pode e registra quem abriu). */
export const fetchBackgroundFile = (fedId, userId) => coachingAction({ federationId: fedId, action: 'sg_file', ...(userId ? { userId } : {}) });
