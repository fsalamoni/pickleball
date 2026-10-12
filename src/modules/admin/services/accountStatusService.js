/**
 * Suspender/bloquear/reativar e o acesso de suporte — as chamadas ao servidor.
 * Tradução de erro igual à da exclusão (função ainda não publicada etc.).
 */
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, functions } from '@/core/config/firebase';
import { deletionErrorMessage } from './accountDeletionService';

async function chamar(nome, payload) {
  if (!functions) throw new Error('Firebase não está configurado neste ambiente.');
  try {
    const { data } = await httpsCallable(functions, nome, { timeout: 60_000 })(payload);
    return data;
  } catch (err) {
    const e = new Error(err?.code === 'functions/failed-precondition' ? err.message : deletionErrorMessage(err));
    e.code = err?.code;
    throw e;
  }
}

/** @param {{ uid: string, action: 'suspend'|'block'|'reactivate', reason: string, days?: number }} p */
export const setAccountStatus = (p) => chamar('adminSetAccountStatus', p);

/** Revela campos de contato de uma conta — o servidor registra ANTES de devolver. */
export const supportReveal = (p) => chamar('adminSupportReveal', p);
