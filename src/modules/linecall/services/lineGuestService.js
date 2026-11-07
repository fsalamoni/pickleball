/**
 * A câmera CONVIDADA, sem conta (docs/53 §5c).
 *
 * Quem organiza a quadra gera um convite por posição: um token aleatório que
 * vai só no link (no FRAGMENTO, `#t=…`, que o navegador não manda a servidor
 * nenhum) e cujo hash SHA-256 é o id de `{quadra}/line_invites/{hash}` — a
 * regra confere quem organiza e a validade de até 12 h. O celular que abre o
 * link vira a câmera daquela posição sem login: o sinal e as marcações vão
 * pela função `lineGuest`, que confere o convite a cada chamada.
 */
import { httpsCallable } from 'firebase/functions';
import { collection, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, functions } from '@/core/config/firebase';
import { hostPath, lineCallFields } from './lineCallSync.js';

export const GUEST_HOURS = [3, 6, 12];
export const GUEST_PATH = '/linhas/convidado';

const invitesCol = (host) => collection(db, hostPath(host), 'line_invites');

const base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Gera o convite de uma posição; devolve o token (só para o link) e a validade. */
export async function createGuestInvite(host, position, hours = 6) {
  const token = base64url(crypto.getRandomValues(new Uint8Array(24)));
  const hash = await sha256Hex(token);
  const expMs = Date.now() + Math.min(12, Math.max(1, hours)) * 3600000;
  await setDoc(doc(invitesCol(host), hash), { position, exp_ms: expMs, created_at: serverTimestamp() });
  return { token, hash, expMs };
}

/** Quem organiza cancela o convite: a câmera convidada é recusada no próximo sinal. */
export function revokeGuestInvite(host, hash) {
  return deleteDoc(doc(invitesCol(host), hash));
}

export function guestLink(host, token) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${GUEST_PATH}#h=${encodeURIComponent(hostPath(host))}&t=${token}`;
}

/** Lê o fragmento do link (`#h=…&t=…`). */
export function parseGuestHash(hash) {
  const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const host = p.get('h') || '';
  const token = p.get('t') || '';
  return host && token ? { host, token } : null;
}

const chamar = (data) => httpsCallable(functions, 'lineGuest', { timeout: 20_000 })(data).then((r) => r.data);

export const peekGuest = ({ host, token }) => chamar({ action: 'peek', host, token });

/** O destino do `useLineCallSession` para a câmera convidada. */
export function guestSink({ host, token }) {
  return {
    uid: 'convidado',
    name: 'Convidado',
    upsert: (c) => chamar({
      action: 'beat', host, token,
      cam: { calibrated: c.calibrated, analyzing: c.analyzing, fps: c.fps, battery: c.battery, charging: c.charging, checkCm: c.checkCm },
    }),
    remove: () => chamar({ action: 'leave', host, token }),
    post: (m) => chamar({ action: 'call', host, token, call: lineCallFields(m) }),
    // A calibração pela central (docs/53 §5d): sem conta não há assinatura do
    // banco, então a câmera pergunta ao servidor de tempos em tempos.
    calib: {
      write: (fields) => chamar({ action: 'calib', host, token, fields }),
      watch: (cb, onError) => {
        const ler = () => chamar({ action: 'calib', host, token }).then(cb, onError);
        ler();
        const id = setInterval(ler, GUEST_CALIB_POLL_MS);
        return () => clearInterval(id);
      },
      // Sair do ar (`leave`) já apaga a foto e o resto.
      remove: () => Promise.resolve(),
    },
  };
}

/** De quanto em quanto tempo a câmera convidada pergunta pela central (ms). */
export const GUEST_CALIB_POLL_MS = 4000;
