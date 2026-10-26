/**
 * PROTEÇÃO DE MENORES DO CLUBE (Bloco E2b) — as chamadas ao servidor (`clubSafeguarding`). Nada
 * é lido nem gravado direto: a regra é `write: if false` nas espécies `safeguard` e `minors`, e
 * a leitura direta é só da disciplina — a pessoa vê o que é dela pela ação `me`, que não devolve
 * o caminho do arquivo.
 */
import { collection, doc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/core/config/firebase';
import { t } from '@/core/i18n';
import { validateDocumentFile } from '@/modules/federations/domain/privateData.js';
import { CLUB_X } from '../domain/association.js';
import { certidaoStoragePath } from '../domain/safeguarding.js';
import { chamar } from './associationService.js';

/** `me`, `pledge`, `sg_submit`, `guardian_save`, `sg_rules`, `sg_overview`, `sg_verify`, `sg_revoke`, `sg_designate`, `sg_file`, `minors_overview`. */
export const clubSafeguardingAction = (payload) => chamar('clubSafeguarding', payload);

/**
 * Envia a certidão de antecedentes: o arquivo sobe para a pasta da PRÓPRIA pessoa no Storage
 * (só ela lê) e o servidor registra o envio e avisa a disciplina. Decidida a conferência, o
 * servidor apaga o arquivo.
 */
export async function submitClubBackground({ clubId, uid, file, issuedAt }) {
  const erro = validateDocumentFile(file);
  if (erro) throw new Error(erro);
  if (!storage || !uid) throw new Error(t('Firebase não está configurado neste ambiente.'));
  const path = certidaoStoragePath(uid, doc(collection(db, CLUB_X)).id, file.type);
  await uploadBytes(storageRef(storage, path), file, { contentType: file.type });
  return clubSafeguardingAction({ clubId, action: 'sg_submit', issuedAt, filePath: path });
}

/** O arquivo da certidão em conferência (o servidor confere quem pode e registra quem abriu). */
export const fetchClubBackgroundFile = (clubId, userId) => clubSafeguardingAction({ clubId, action: 'sg_file', ...(userId ? { userId } : {}) });
