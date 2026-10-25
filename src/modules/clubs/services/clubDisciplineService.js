/**
 * DISCIPLINA E OUVIDORIA DO CLUBE-ASSOCIAÇÃO (Bloco E1) — leitura direta e as ações do
 * servidor (`clubDiscipline`). Ninguém grava pelo navegador: a regra é `write: if false`
 * nas espécies `cases` (sanções) e `ombud` (ouvidoria).
 *
 * Leitura: a disciplina (e a administração) lê tudo; a pessoa lê só as SUAS sanções, e a
 * consulta leva a igualdade `user_id == eu` (é o que deixa a regra prová-la sem índice).
 * A ouvidoria só a disciplina lê; quem enviou acompanha o ESTADO pelo protocolo, no servidor.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { CLUB_X, CLUB_X_KIND as K } from '../domain/association.js';
import { chamar } from './associationService.js';

const toDoc = (d) => ({ id: d.id, ...d.data() });

export async function listClubCases(clubId) {
  if (!clubId) return [];
  return (await getDocs(collection(db, CLUB_X, clubId, K.cases))).docs.map(toDoc);
}

/** As sanções da própria pessoa neste clube. */
export async function listMyClubCases(clubId, uid) {
  if (!clubId || !uid) return [];
  return (await getDocs(query(collection(db, CLUB_X, clubId, K.cases), where('user_id', '==', uid)))).docs.map(toDoc);
}

export async function listClubOmbud(clubId) {
  if (!clubId) return [];
  return (await getDocs(collection(db, CLUB_X, clubId, K.ombud))).docs.map(toDoc);
}

/** `apply`, `appeal`, `decide_appeal`, `end`, `report`, `report_status`, `report_update`. */
export const clubDisciplineAction = (payload) => chamar('clubDiscipline', payload);
