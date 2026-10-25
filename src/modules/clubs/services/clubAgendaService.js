/**
 * AGENDA OFICIAL DO CLUBE-ASSOCIAÇÃO (Bloco D2b) — leitura direta e as ações do servidor
 * (`clubAgenda`). Ninguém grava pelo navegador: a regra é `write: if false` na espécie
 * `events`.
 *
 * Leitura: a equipe da agenda (`docs`/`sports`/`admin`) lê a coleção inteira (o "só a
 * equipe" inclusive); o público lê só `pub == true` e o membro do clube só
 * `members == true` — o filtro é o que deixa a regra provar a consulta sem índice
 * composto. Ordenação em memória.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { CLUB_X, CLUB_X_KIND as K } from '../domain/association.js';
import { chamar } from './associationService.js';

const toDoc = (d) => ({ id: d.id, ...d.data() });
const eventsCol = (clubId) => collection(db, CLUB_X, clubId, K.events);

/** A equipe da agenda: tudo, o "só a equipe" inclusive. */
export async function listClubEventsAll(clubId) {
  if (!clubId) return [];
  return (await getDocs(eventsCol(clubId))).docs.map(toDoc);
}

/** Quem vê a página do clube: o público (`pub`) ou, sendo membro, tudo o que é de associados (`members`, que inclui o público). */
export async function listClubReadableEvents(clubId, { member = false } = {}) {
  if (!clubId) return [];
  const q = query(eventsCol(clubId), where(member ? 'members' : 'pub', '==', true));
  return (await getDocs(q)).docs.map(toDoc);
}

export const clubAgendaAction = (payload) => chamar('clubAgenda', payload);
