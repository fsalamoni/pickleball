/**
 * Notificações push (Web/PWA) via Firebase Cloud Messaging.
 *
 * TOTALMENTE OPCIONAL E GRACIOSO: só faz algo quando
 *   (a) há chave pública VAPID: a env `VITE_FIREBASE_VAPID_KEY` do build ou,
 *       sem ela, a que o admin colou em Painel admin → Comunicações → Push
 *       (`platform_settings/messaging.push.vapid_public_key`, leitura pública),
 *   (b) o navegador suporta Service Worker + Notification + FCM,
 *   (c) a pessoa concede permissão (opt-in explícito).
 * Em qualquer outro caso, todas as funções abaixo são no-op e retornam um
 * status — NADA é registrado e NADA muda para quem não optou.
 *
 * O envio é do servidor (`pushOnNotificationCreate`), que espelha as
 * notificações in-app (coleção `notifications`) para os tokens registrados.
 * Quem mostra a notificação no aparelho é `public/firebase-messaging-sw.js`.
 */

import {
  deleteDoc, doc, getDoc, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { app, db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { PUSH_SCOPE, marcarPushAqui, pushAtivoAqui } from '@/core/lib/pushNoAparelho';

const ENV_VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
// Ponto P-256 sem compressão em base64url: 87 letras começando por "B" (a
// mesma conta de `vapidKeyProblem`, em modules/messaging/domain/policy.js).
const VAPID_RE = /^B[A-Za-z0-9_-]{86}$/;

/** A chave do push vem do build (e o painel não manda nela)? */
export const hasBuildVapidKey = Boolean(ENV_VAPID_KEY);

let vapidPromise = null;

/**
 * A chave pública VAPID: a do build vence; senão, a gravada pelo admin. ''
 * sem nenhuma. Só a chave ACHADA fica guardada na memória: o "não tem" é
 * lido de novo na próxima pergunta — senão quem abriu a tela antes de o
 * admin salvar a chave seguiria vendo "falta a chave" até recarregar.
 */
export function getVapidKey() {
  if (ENV_VAPID_KEY) return Promise.resolve(ENV_VAPID_KEY);
  if (!vapidPromise) {
    vapidPromise = (db ? getDoc(doc(db, 'platform_settings', 'messaging')) : Promise.resolve(null))
      .then((snap) => {
        const k = snap && snap.exists() ? String(snap.data()?.push?.vapid_public_key || '') : '';
        if (!VAPID_RE.test(k)) {
          vapidPromise = null;
          return '';
        }
        return k;
      })
      .catch(() => { vapidPromise = null; return ''; });
  }
  return vapidPromise;
}

/** Esquece a chave guardada (o admin acabou de trocá-la). */
export function forgetVapidKey() {
  vapidPromise = null;
}

let messagingModulePromise = null;

/** Carrega o módulo FCM sob demanda; retorna null se indisponível/não suportado. */
async function getMessagingSafe() {
  if (!app || !(await getVapidKey())) return null;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || typeof Notification === 'undefined') {
    return null;
  }
  if (!messagingModulePromise) {
    messagingModulePromise = import('firebase/messaging')
      .then(async (mod) => {
        const supported = await mod.isSupported().catch(() => false);
        if (!supported) return null;
        return { mod, messaging: mod.getMessaging(app) };
      })
      .catch(() => null);
  }
  return messagingModulePromise;
}

/** Há chave VAPID (do build ou do painel)? Sem ela, o push não é oferecido. */
export async function isPushConfigured() {
  return Boolean(await getVapidKey());
}

/** Estado da permissão do navegador: 'unsupported' | 'default' | 'granted' | 'denied'. */
export function getPermissionState() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/** O push está ativo neste aparelho para esta conta (permissão + marca)? */
export function isPushActiveHere(uid) {
  return getPermissionState() === 'granted' && pushAtivoAqui(uid);
}

/** Id de documento estável e válido a partir do token (hash simples). */
export function tokenDocId(uid, token) {
  let h = 0;
  for (let i = 0; i < token.length; i += 1) {
    h = (Math.imul(h, 31) + token.charCodeAt(i)) | 0;
  }
  return `${uid}_${(h >>> 0).toString(36)}`;
}

/**
 * Traduz a falha do navegador/FCM num motivo que a tela explica.
 * @returns {'bad_key'|'fcm_rejected'|'sw_failed'|'push_service'|'denied'|'error'}
 */
export function pushFailureReason(err) {
  const code = String(err?.code || '');
  const name = String(err?.name || '');
  const msg = String(err?.message || '');
  if (code === 'messaging/permission-blocked' || code === 'messaging/permission-default') return 'denied';
  if (name === 'InvalidAccessError' || /applicationServerKey|vapid/i.test(msg)) return 'bad_key';
  if (code === 'messaging/token-subscribe-failed' || code === 'messaging/token-update-failed') return 'fcm_rejected';
  if (code === 'messaging/failed-service-worker-registration' || code === 'messaging/invalid-sw-registration') return 'sw_failed';
  if (name === 'AbortError' || name === 'NotAllowedError' || /push service/i.test(msg)) return 'push_service';
  return 'error';
}

/** Registra (ou atualiza) o service worker do push e devolve o token deste aparelho. */
async function tokenDoAparelho(ctx) {
  // Registrar de novo também confere se há versão nova do service worker
  // (o arquivo vai sem cache) — é assim que o aparelho recebe as correções.
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: PUSH_SCOPE });
  return ctx.mod.getToken(ctx.messaging, { vapidKey: await getVapidKey(), serviceWorkerRegistration: registration });
}

/** Este aparelho já tem a inscrição do push (alguém o ativou aqui)? */
async function temInscricao() {
  try {
    const reg = await navigator.serviceWorker.getRegistration(PUSH_SCOPE);
    return Boolean(reg && await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}

function gravarToken(uid, token) {
  return setDoc(
    doc(db, 'push_tokens', tokenDocId(uid, token)),
    {
      user_id: uid,
      token,
      user_agent: (typeof navigator !== 'undefined' && navigator.userAgent)
        ? String(navigator.userAgent).slice(0, 300) : null,
      updated_at: serverTimestamp(),
      updated_at_ms: Date.now(),
    },
    { merge: true },
  );
}

/**
 * Opt-in: pede permissão, registra o token FCM e o grava em `push_tokens`.
 * @returns {Promise<{ ok: boolean, reason?: string, detail?: string }>}
 */
export async function enablePush(user) {
  try {
    if (!user?.uid || !db) return { ok: false, reason: 'no-user' };
    const ctx = await getMessagingSafe();
    if (!ctx) return { ok: false, reason: (await isPushConfigured()) ? 'unsupported' : 'unconfigured' };

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const token = await tokenDoAparelho(ctx);
    if (!token) return { ok: false, reason: 'no-token' };
    await gravarToken(user.uid, token);
    marcarPushAqui(user.uid, true);
    return { ok: true };
  } catch (err) {
    logger.error('enablePush falhou:', err);
    return { ok: false, reason: pushFailureReason(err), detail: String(err?.message || err).slice(0, 300) };
  }
}

/**
 * Renova o push deste aparelho ao abrir o app: atualiza o service worker e
 * regrava o token (o navegador troca a inscrição de tempos em tempos, e o
 * token antigo para de receber). Só age para quem ATIVOU o push aqui: a marca
 * desta conta ou, para quem ativou antes de a marca existir, o próprio token
 * deste aparelho já gravado em nome dela. Nunca pede permissão.
 */
export async function refreshPush(user) {
  try {
    if (!user?.uid || !db || getPermissionState() !== 'granted') return { ok: false };
    // Sem a marca e sem inscrição, ninguém ativou o push aqui: não cria nada.
    if (!pushAtivoAqui(user.uid) && !(await temInscricao())) return { ok: false };
    const ctx = await getMessagingSafe();
    if (!ctx) return { ok: false };
    const token = await tokenDoAparelho(ctx);
    if (!token) return { ok: false };
    let minha = pushAtivoAqui(user.uid);
    if (!minha) {
      // Sem a marca: só continua se este aparelho já era desta conta.
      minha = await getDoc(doc(db, 'push_tokens', tokenDocId(user.uid, token)))
        .then((s) => s.exists())
        .catch(() => false);
    }
    if (!minha) return { ok: false };
    await gravarToken(user.uid, token);
    marcarPushAqui(user.uid, true);
    return { ok: true };
  } catch (err) {
    logger.warn('refreshPush falhou:', err);
    return { ok: false };
  }
}

/**
 * Opt-out DESTE aparelho: apaga o token dele e cancela a inscrição. Os outros
 * aparelhos da pessoa continuam recebendo. Best-effort.
 */
export async function disablePush(user) {
  try {
    const ctx = (await temInscricao()) ? await getMessagingSafe() : null;
    if (ctx) {
      const token = await tokenDoAparelho(ctx).catch(() => null);
      if (token && user?.uid && db) {
        await deleteDoc(doc(db, 'push_tokens', tokenDocId(user.uid, token))).catch(() => {});
      }
      try { await ctx.mod.deleteToken(ctx.messaging); } catch { /* noop */ }
    }
    return { ok: true };
  } catch (err) {
    logger.error('disablePush falhou:', err);
    return { ok: false };
  } finally {
    marcarPushAqui(user?.uid, false);
  }
}
