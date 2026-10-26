/**
 * SELEÇÃO DO CLUBE (Bloco E3) — as chamadas ao servidor (`clubSelection`) e a leitura da lista
 * PÚBLICA das delegações. A regra é `write: if false` em `callups` e `callup_members`; a
 * diretoria esportiva lê direto, a pessoa vê os próprios convites pela ação `mine`.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { CLUB_X } from './../domain/association.js';
import { chamar } from './associationService.js';

/** `list`, `members`, `save`, `publish`, `close`, `cancel`, `add`, `remove`, `member_update`, `mine`, `answer`. */
export const clubSelectionAction = (payload) => chamar('clubSelection', payload);

/**
 * As convocações abertas ou encerradas do clube (`pub == true`), com a lista de confirmados SEM
 * uid. A igualdade em `pub` é o que prova a regra para a consulta; a ordem é em memória.
 */
export async function listPublicCallups(clubId) {
  const snap = await getDocs(query(collection(db, CLUB_X, clubId, 'callups'), where('pub', '==', true)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.starts_at).localeCompare(String(a.starts_at)));
}
