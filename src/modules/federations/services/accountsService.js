/**
 * CONTAS DA FEDERAÇÃO (módulo `accounts`) — leitura direta e as ações do
 * servidor (`federationAccounts`). Ninguém grava pelo navegador: a regra é
 * `write: if false` nas três coleções.
 *
 * Toda consulta é de igualdade (`federation_id`, e `pub == true` para o
 * público): a regra prova sem índice composto; a ordenação é em memória.
 */
import { collection, doc, getDocs, query, where } from 'firebase/firestore';
import { deleteObject, ref as storageRef, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '@/core/config/firebase';
import { t } from '@/core/i18n';
import { ACCOUNTS_COLLECTIONS as C, ACCOUNT_FILE_MAX, ACCOUNT_FILE_TYPES } from '../domain/accounts.js';
import { FederationError, chamar } from './federationService.js';

const toDoc = (d) => ({ id: d.id, ...d.data() });

async function porFederacao(col, fedId, soPublicados = false) {
  if (!fedId) return [];
  const filtros = [where('federation_id', '==', fedId)];
  if (soPublicados) filtros.push(where('pub', '==', true));
  return (await getDocs(query(collection(db, col), ...filtros))).docs.map(toDoc);
}

/** Equipe das contas (financeiro, conselho fiscal, admin): tudo. */
export const listBudgets = (fedId) => porFederacao(C.budgets, fedId);
export const listLedger = (fedId) => porFederacao(C.ledger, fedId);
export const listAccountReports = (fedId) => porFederacao(C.reports, fedId);

/** Quem vê a federação: só o publicado. */
export const listPublicBudgets = (fedId) => porFederacao(C.budgets, fedId, true);
export const listPublicAccountReports = (fedId) => porFederacao(C.reports, fedId, true);

/** Todas as ações (orçamento, lançamento, prestação, parecer, arquivo) são do servidor. */
export const accountsAction = (payload) => chamar('federationAccounts', payload, { timeout: 120_000 });

const EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * Envia a nota/recibo/demonstração para `federacao-contas/{uid}/{id}.{ext}`
 * (só quem envia lê). Ao lançar ou salvar, o servidor copia para a pasta
 * oficial e apaga este.
 */
export function uploadAccountFile({ uid, file, onProgress }) {
  if (!file || !ACCOUNT_FILE_TYPES.includes(file.type) || !(file.size > 0) || file.size > ACCOUNT_FILE_MAX) {
    const msg = t('Anexo inválido: PDF ou imagem de até 9 MB.');
    return Promise.reject(new FederationError(msg, { file: msg }));
  }
  if (!storage || !uid) return Promise.reject(new FederationError(t('Firebase não está configurado neste ambiente.')));
  const path = `federacao-contas/${uid}/${doc(collection(db, C.ledger)).id}.${EXT[file.type]}`;
  const tarefa = uploadBytesResumable(storageRef(storage, path), file, { contentType: file.type });
  return new Promise((resolve, reject) => {
    tarefa.on('state_changed',
      (s) => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0),
      reject,
      () => resolve({ name: String(file.name || 'arquivo').slice(0, 120), path, size: Number(file.size) || 0, content_type: file.type }));
  });
}

/** Desfaz um envio que não chegou a ser lançado (só a pasta de quem enviou). */
export async function discardAccountUpload(path) {
  if (!storage || !/^federacao-contas\//.test(String(path || ''))) return;
  await deleteObject(storageRef(storage, path)).catch(() => {});
}
