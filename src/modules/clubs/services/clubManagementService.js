/**
 * PATRIMÔNIO DO CLUBE-ASSOCIAÇÃO (Bloco E2a) — leitura direta e as ações do servidor
 * (`clubManagement`). Ninguém grava pelo navegador: a regra é `write: if false` na espécie
 * `assets`; o financeiro, a diretoria esportiva e o conselho fiscal leem.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { CLUB_X, CLUB_X_KIND as K } from '../domain/association.js';
import { chamar } from './associationService.js';

export async function listClubAssets(clubId) {
  if (!clubId) return [];
  const docs = (await getDocs(collection(db, CLUB_X, clubId, K.assets))).docs.map((d) => ({ id: d.id, ...d.data() }));
  return docs.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
}

/** `asset_save`, `asset_loan`, `asset_return`, `asset_retire`. */
export const clubManagementAction = (payload) => chamar('clubManagement', payload);
