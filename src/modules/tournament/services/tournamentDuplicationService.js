/**
 * Duplicação de torneios (camada de serviço).
 *
 * Orquestra a criação do novo torneio a partir de um existente, copiando
 * seletivamente: definições, modalidades (uma a uma) e, por modalidade, o
 * conjunto de inscritos. Puramente aditivo — não altera o torneio de origem.
 *
 * Ordem das escritas (importante por causa das regras do Firestore):
 *  1. Cria o torneio + o doc de admin/owner (via `createTournament`). Só depois
 *     desse commit o ator é reconhecido como admin do novo torneio.
 *  2. Cria cada modalidade selecionada (via `createModality`, que normaliza a
 *     configuração) — exige que o passo 1 já esteja confirmado.
 *  3. Copia as inscrições das modalidades marcadas, em lotes.
 *
 * Nunca copia sorteio (grupos/jogos/ranking): a duplicação é de definições,
 * modalidades e inscritos apenas.
 */

import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { createTournament } from './tournamentService.js';
import { createModality } from './modalityService.js';
import {
  duplicatedTournamentFields,
  duplicatedModalityFields,
  duplicatedRegistrationFields,
  copyableRegistrations,
} from '../domain/duplication.js';

const REGISTRATIONS_COL = 'tournament_registrations';
const SAFE_BATCH_WRITE_SIZE = 450; // abaixo do limite de 500 operações por batch do Firestore

/**
 * Duplica um torneio conforme a seleção do admin.
 *
 * @param {object} actor usuário autenticado (será o owner do novo torneio)
 * @param {object} params
 * @param {object} params.source torneio de origem
 * @param {boolean} params.copyDefinitions copiar as definições do torneio
 * @param {string} [params.name] nome do novo torneio
 * @param {Array<{ modality: object, copyRegistrations: boolean, registrations?: object[] }>} params.modalities
 *   modalidades selecionadas, cada uma com suas inscrições já carregadas
 * @returns {Promise<{ tournamentId: string, modalityCount: number, registrationCount: number }>}
 */
export async function duplicateTournament(actor, params) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  const { source, copyDefinitions = true, name, modalities = [] } = params || {};
  if (!source?.id) throw new Error('Torneio de origem inválido.');

  // 1) Novo torneio + owner (o commit interno habilita o ator como admin).
  const tournamentId = await createTournament(
    actor,
    duplicatedTournamentFields(source, { copyDefinitions, name }),
  );

  // 2) Modalidades selecionadas (createModality normaliza a configuração).
  let registrationCount = 0;
  let modalityCount = 0;
  const registrationWrites = [];

  for (const entry of modalities) {
    if (!entry?.modality) continue;
    const newModalityId = await createModality(
      tournamentId,
      duplicatedModalityFields(entry.modality),
      actor,
    );
    modalityCount += 1;

    if (entry.copyRegistrations) {
      const regs = copyableRegistrations(entry.registrations || []);
      for (const reg of regs) {
        const newId = doc(collection(db, REGISTRATIONS_COL)).id;
        registrationWrites.push({
          ref: doc(db, REGISTRATIONS_COL, newId),
          payload: {
            id: newId,
            tournament_id: tournamentId,
            modality_id: newModalityId,
            created_by: actor.uid,
            created_by_role: 'admin',
            ...duplicatedRegistrationFields(reg),
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          },
        });
      }
    }
  }

  // 3) Inscrições em lotes seguros.
  for (let i = 0; i < registrationWrites.length; i += SAFE_BATCH_WRITE_SIZE) {
    const batch = writeBatch(db);
    registrationWrites.slice(i, i + SAFE_BATCH_WRITE_SIZE).forEach(({ ref, payload }) => {
      batch.set(ref, payload);
    });
    await batch.commit();
    registrationCount += Math.min(SAFE_BATCH_WRITE_SIZE, registrationWrites.length - i);
  }

  await createAuditLog({
    action: 'tournament_duplicated',
    actor,
    details: {
      source_tournament_id: source.id,
      tournament_id: tournamentId,
      copy_definitions: Boolean(copyDefinitions),
      modality_count: modalityCount,
      registration_count: registrationCount,
    },
  });

  return { tournamentId, modalityCount, registrationCount };
}
