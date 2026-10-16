/**
 * Notificações push (Web/PWA) via Firebase Cloud Messaging.
 *
 * TOTALMENTE OPCIONAL E GRACIOSO: só faz algo quando
 *   (a) há chave pública VAPID: a env `VITE_FIREBASE_VAPID_KEY` do build ou,
 *       sem ela, a que o admin colou em Painel admin → Comunicações → Push
 *       (`platform_settings/messaging.push.vapid_public_key`, leitura pública),
 *   (b) o navegador suporta Service Worker + Notification + FCM,
 *   (c) o atleta concede permissão (opt-in explícito).
 * Em qualquer outro caso, todas as funções abaixo são no-op e retornam um
 * status — NADA é registrado e NADA muda para quem não optou.
 *
 * O envio dos pushes é feito por uma Cloud Function que espelha as
 * notificações in-app (coleção `notifications`) para os tokens registrados.
 */

import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { app, db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';

const ENV_VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
const VAPID_RE = /^[A-Za-z0-9_-]{40,200}$/;

let vapidPromise = null;

/** A chave pública VAPID: a do build vence; senão, a gravada pelo admin. '' sem nenhuma. */
export function getVapidKey() {
  if (ENV_VAPID_KEY) return Promise.resolve(ENV_VAPID_KEY);
  if (!vapidPromise) {
    vapidPromise = (db ? getDoc(doc(db, 'platform_settings', 'messaging')) : Promise.resolve(null))
      .then((snap) => {
        const k = snap && snap.exists() ? String(snap.data()?.push?.vapid_public_key || '') : '';
        return VAPID_RE.test(k) ? k : '';
      })
      // Falhou a leitura: não guarda o vazio, a próxima tentativa lê de novo.
      .catch(() => { vapidPromise = null; return ''; });
  }
  return vapidPromise;
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

/** Id de documento estável e válido a partir do token (hash simples). */
function tokenDocId(uid, token) {
  let h = 0;
  for (let i = 0; i < token.length; i += 1) {
    h = (Math.imul(h, 31) + token.charCodeAt(i)) | 0;
  }
  return `${uid}_${(h >>> 0).toString(36)}`;
}

/**
 * Opt-in: pede permissão, registra o token FCM e o grava em `push_tokens`.
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function enablePush(user) {
  try {
    if (!user?.uid || !db) return { ok: false, reason: 'no-user' };
    const ctx = await getMessagingSafe();
    if (!ctx) return { ok: false, reason: (await isPushConfigured()) ? 'unsupported' : 'unconfigured' };

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    // Escopo próprio e estreito: NÃO colide com o service worker do PWA (sw.js),
    // que controla a raiz "/". É o mesmo escopo que o FCM usa por padrão.
    const registration = await navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope' })
      .catch(() => undefined);

    const token = await ctx.mod.getToken(ctx.messaging, {
      vapidKey: await getVapidKey(),
      serviceWorkerRegistration: registration,
    });
    if (!token) return { ok: false, reason: 'no-token' };

    await setDoc(
      doc(db, 'push_tokens', tokenDocId(user.uid, token)),
      {
        user_id: user.uid,
        token,
        user_agent: (typeof navigator !== 'undefined' && navigator.userAgent)
          ? String(navigator.userAgent).slice(0, 300) : null,
        updated_at: serverTimestamp(),
        updated_at_ms: Date.now(),
      },
      { merge: true },
    );
    return { ok: true };
  } catch (err) {
    logger.error('enablePush falhou:', err);
    return { ok: false, reason: 'error' };
  }
}

/** Opt-out: apaga os tokens do usuário e invalida o token atual. Best-effort. */
export async function disablePush(user) {
  try {
    const ctx = await getMessagingSafe();
    if (ctx) {
      try { await ctx.mod.deleteToken(ctx.messaging); } catch { /* noop */ }
    }
    if (user?.uid && db) {
      const snap = await getDocs(query(collection(db, 'push_tokens'), where('user_id', '==', user.uid)));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
    }
    return { ok: true };
  } catch (err) {
    logger.error('disablePush falhou:', err);
    return { ok: false };
  }
}

/**
 * Escuta mensagens em primeiro plano (app aberto) para exibir um aviso in-app.
 * @param {(payload: any) => void} handler
 * @returns {Promise<() => void>} função para cancelar a escuta
 */
export async function listenForegroundPush(handler) {
  const ctx = await getMessagingSafe();
  if (!ctx) return () => {};
  try {
    return ctx.mod.onMessage(ctx.messaging, handler);
  } catch {
    return () => {};
  }
}
