/**
 * CONTAS DO CLUBE-ASSOCIAÇÃO (Bloco D1) — leitura direta e as ações do servidor
 * (`clubAccounts`). Ninguém grava pelo navegador: a regra é `write: if false`
 * nas três espécies (`budgets`, `ledger`, `reports`).
 *
 * Leitura: a coleção inteira de uma espécie (a equipe das contas); o público lê
 * só a cópia publicada (`pub == true`) — o filtro é o que deixa a regra provar a
 * consulta sem índice composto. Ordenação em memória.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { CLUB_X, CLUB_X_KIND as K } from '../domain/association.js';
import { chamar } from './associationService.js';

const toDoc = (d) => ({ id: d.id, ...d.data() });
const kindCol = (clubId, kind) => collection(db, CLUB_X, clubId, kind);

async function todos(clubId, kind) {
  if (!clubId) return [];
  return (await getDocs(kindCol(clubId, kind))).docs.map(toDoc);
}

async function publicados(clubId, kind) {
  if (!clubId) return [];
  return (await getDocs(query(kindCol(clubId, kind), where('pub', '==', true)))).docs.map(toDoc);
}

/** Equipe das contas (financeiro, conselho fiscal, administração): tudo. */
export const listClubBudgets = async (clubId) => (await todos(clubId, K.budgets)).filter((b) => !b.copy_of); // a cópia pública (`{ano}_pub`) não é um orçamento
export const listClubLedger = (clubId) => todos(clubId, K.ledger);
export const listClubAccountReports = (clubId) => todos(clubId, K.reports);

/** Quem vê a página do clube: só o publicado. */
export const listClubPublicBudgets = (clubId) => publicados(clubId, K.budgets);
export const listClubPublicAccountReports = (clubId) => publicados(clubId, K.reports);

/** Todas as ações (orçamento, lançamento, prestação, parecer, arquivo) são do servidor. */
export const clubAccountsAction = (payload) => chamar('clubAccounts', payload, { timeout: 120_000 });
