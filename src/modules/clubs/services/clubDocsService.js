/**
 * ACERVO DO CLUBE-ASSOCIAÇÃO (Bloco D2) — leitura direta e as ações do servidor
 * (`clubDocs`). Ninguém grava pelo navegador: a regra é `write: if false` na espécie
 * `docs`.
 *
 * Leitura: a equipe do acervo lê a coleção inteira (rascunhos inclusive); o público lê
 * só `pub == true` e o membro do clube só `members == true` — o filtro é o que deixa a
 * regra provar a consulta sem índice composto. Ordenação em memória.
 */
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { CLUB_X, CLUB_X_KIND as K } from '../domain/association.js';
import { chamar } from './associationService.js';

const toDoc = (d) => ({ id: d.id, ...d.data() });
const docsCol = (clubId) => collection(db, CLUB_X, clubId, K.docs);

/** A equipe do acervo (`docs`/`admin`): tudo, rascunhos inclusive. */
export async function listClubDocsAll(clubId) {
  if (!clubId) return [];
  return (await getDocs(docsCol(clubId))).docs.map(toDoc);
}

/** Quem vê a página do clube: o público (`pub`) ou, sendo membro, tudo o que é de associados (`members`, que inclui o público). */
export async function listClubReadableDocs(clubId, { member = false } = {}) {
  if (!clubId) return [];
  const q = query(docsCol(clubId), where(member ? 'members' : 'pub', '==', true));
  return (await getDocs(q)).docs.map(toDoc);
}

export async function getClubDoc(clubId, docId) {
  if (!clubId || !docId) return null;
  const snap = await getDoc(doc(db, CLUB_X, clubId, K.docs, docId));
  return snap.exists() ? toDoc(snap) : null;
}

/** As ações do acervo são do SERVIDOR (numeração, cópia oficial, SHA-256): prazo longo para vídeo grande. */
export const clubDocsAction = (payload) => chamar('clubDocs', payload, { timeout: 540_000 });

/** O arquivo de um documento sem link público (associado, equipe, rascunho), em base64. */
export const fetchClubDocFile = ({ clubId, docId, path }) => clubDocsAction({ clubId, action: 'file', docId, path });
