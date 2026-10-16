/**
 * AVISOS POR E-MAIL E CELULAR — as escritas e as chamadas ao servidor.
 *
 *  - A configuração do admin (`platform_settings/messaging`) é gravada daqui
 *    (a regra só deixa o admin) e vai para a auditoria; o servidor normaliza
 *    ao ler, então o que chega torto vira o padrão.
 *  - As chaves dos provedores NUNCA passam por aqui como leitura: são
 *    gravadas pela função `messagingAdmin` em `platform_secrets` (fechada a
 *    todos pela regra), e o painel só sabe se estão configuradas.
 *  - As escolhas da pessoa vão em `users/{uid}.notification_channels`.
 *  - O número de celular CONFIRMADO só o servidor grava (código por SMS ou
 *    WhatsApp, `messagingUser`).
 * Ver docs/49-AVISOS-POR-EMAIL-E-CELULAR.md.
 */
import { httpsCallable } from 'firebase/functions';
import { sendEmailVerification } from 'firebase/auth';
import {
  arrayRemove, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { auth, db, functions } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { deletionErrorMessage } from '@/modules/admin/services/accountDeletionService';
import { t } from '@/core/i18n';
import { normalizeSettings } from '../domain/policy';

export const MESSAGING_SETTINGS_DOC = ['platform_settings', 'messaging'];
export const MESSAGING_STATUS_DOC = ['platform_settings', 'messaging_status'];

async function chamar(nome, payload, timeout = 60_000) {
  if (!functions) throw new Error(t('Firebase não está configurado neste ambiente.'));
  try {
    const { data } = await httpsCallable(functions, nome, { timeout })(payload);
    return data;
  } catch (err) {
    const code = String(err?.code || '').replace('functions/', '');
    // As mensagens do servidor saem em português; com catálogo, traduzem.
    const msg = ['failed-precondition', 'invalid-argument', 'resource-exhausted', 'not-found', 'unavailable'].includes(code) && err?.message
      ? t(err.message)
      : deletionErrorMessage(err);
    const e = new Error(msg);
    e.code = code;
    throw e;
  }
}

/** Painel admin → Comunicações (a função confere se é o admin da plataforma). */
export const messagingAdmin = (action, extra = {}) => chamar('messagingAdmin', { action, ...extra }, 120_000);

/** Configurações da pessoa: celular por código, confirmar e-mail, teste. */
export const messagingUser = (action, extra = {}) => chamar('messagingUser', { action, ...extra });

/**
 * Confirmar o e-mail: pelo domínio da plataforma quando o e-mail está pronto;
 * senão (ou se o provedor falhar), pelo e-mail do Firebase, como sempre.
 * @returns {Promise<{ already?: boolean, via: 'plataforma'|'firebase' }>}
 */
export async function sendVerificationEmail() {
  let r = null;
  try { r = await messagingUser('email_verify_send'); } catch { r = null; }
  if (r?.handled) return { already: Boolean(r.already), via: 'plataforma' };
  if (!auth?.currentUser) throw new Error(t('Entre de novo na sua conta e tente outra vez.'));
  await sendEmailVerification(auth.currentUser);
  return { via: 'firebase' };
}

/**
 * "Esqueci a senha" pelo nosso provedor. Nunca lança: qualquer falha devolve
 * `{ handled: false }` e quem chamou usa o e-mail do Firebase, como sempre.
 */
export async function requestPasswordResetEmail(email, lang) {
  try {
    // Só chama o servidor quando o admin ligou: sem isso, todo "esqueci a
    // senha" esperaria a função acordar para ouvir "use o Firebase".
    const s = await getDoc(doc(db, ...MESSAGING_SETTINGS_DOC));
    const e = (s.exists() && s.data()?.email) || {};
    if (e.enabled !== true || e.login_emails !== true) return { handled: false };
    const r = await chamar('messagingAuthEmail', { action: 'password_reset', email, lang }, 20_000);
    return r && r.handled ? r : { handled: false };
  } catch {
    return { handled: false };
  }
}

/** A configuração crua (como está gravada) e a normalizada (o que vale). */
export async function getMessagingSettings() {
  const s = await getDoc(doc(db, ...MESSAGING_SETTINGS_DOC));
  const raw = s.exists() ? s.data() || {} : {};
  return { raw, settings: normalizeSettings(raw) };
}

/** O estado que o servidor gravou (domínio, verificação, modelos do WhatsApp). */
export async function getMessagingStatus() {
  const s = await getDoc(doc(db, ...MESSAGING_STATUS_DOC));
  return s.exists() ? s.data() || {} : {};
}

/**
 * Grava uma parte da configuração (merge profundo) e registra na auditoria
 * QUAIS campos mudaram — os valores ficam no próprio documento.
 * @param {object} patch  ex.: { email: { domain: 'picklerush.com.br' } }
 * @param {string} section  ex.: 'email' (só para a auditoria)
 */
export async function saveMessagingSettings(patch, { actor, section }) {
  await setDoc(doc(db, ...MESSAGING_SETTINGS_DOC), { ...patch, updated_at_ms: Date.now(), updated_by: actor?.uid || null }, { merge: true });
  const campos = Object.entries(patch).flatMap(([k, v]) => (
    v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).map((c) => `${k}.${c}`) : [k]
  ));
  await createAuditLog({ action: 'messaging_settings_saved', actor, details: { section, fields: campos.slice(0, 40) } });
}

/**
 * As escolhas da pessoa (merge no mapa `notification_channels`). `patch`
 * usa caminhos com ponto para não apagar o resto do mapa:
 * `{ 'email.on': false }`, `{ 'email.areas.torneios': 'diario' }`.
 */
export async function saveMyChannels(uid, patch) {
  const dados = Object.fromEntries(Object.entries(patch).map(([k, v]) => [`notification_channels.${k}`, v]));
  await updateDoc(doc(db, 'users', uid), dados);
}

/** Desbloqueia quem a pessoa tinha bloqueado (pelo "Denunciar" do e-mail). */
export async function unblockSender(uid, senderUid) {
  await updateDoc(doc(db, 'users', uid), { 'notification_channels.blocked_senders': arrayRemove(senderUid) });
}

/** Os nomes públicos (diretório de atletas) de uma lista de contas: { uid: nome }. */
export async function listPublicNames(uids) {
  const unicos = [...new Set((uids || []).filter(Boolean))];
  const out = {};
  for (let i = 0; i < unicos.length; i += 30) {
    const fatia = unicos.slice(i, i + 30);
    // eslint-disable-next-line no-await-in-loop
    const snap = await getDocs(query(collection(db, 'athlete_profiles'), where('__name__', 'in', fatia)));
    snap.docs.forEach((d) => { out[d.id] = d.data()?.platform_name || ''; });
  }
  return out;
}

/** O que a plataforma mandou para a pessoa (e-mail, WhatsApp, SMS) — para a exportação. */
export async function listMyMessageLog(uid) {
  const snap = await getDocs(query(collection(db, 'message_outbox'), where('user_id', '==', uid)));
  return snap.docs.map((d) => {
    const x = d.data() || {};
    return {
      id: d.id, kind: x.kind || 'notice', channel: x.channel || '', status: x.status || '', area: x.area || '',
      to: x.to_masked || '', created_at_ms: x.created_at_ms || null, sent_at_ms: x.sent_at_ms || null,
    };
  }).sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
}
