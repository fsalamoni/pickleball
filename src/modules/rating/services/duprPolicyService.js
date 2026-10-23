/**
 * Política do DUPR (`platform_settings/dupr_policy`): quem vê a integração
 * (piloto só com os admins ou todo mundo) e as regras de envio de partidas.
 * Legível por todos (a regra de `platform_settings` é `read: if true`), escrita
 * só pelo admin da plataforma. O servidor lê o MESMO documento
 * (`functions/duprPolicy.js`, paridade travada em teste).
 */
import { collection, doc, getDoc, getDocs, query, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { normalizeDuprPolicy } from '@/modules/rating/domain/duprPolicy';

const ref = () => doc(db, 'platform_settings', 'dupr_policy');

/** Lê a política (normalizada). Sem documento, vale o padrão: envio desligado, piloto. */
export async function getDuprPolicy() {
  if (!db) return normalizeDuprPolicy(null);
  const snap = await getDoc(ref());
  return normalizeDuprPolicy(snap.exists() ? snap.data() : null);
}

/**
 * Espelhos públicos de quem conectou a conta DUPR (`dupr_verified`, gravado só
 * pelo servidor). Uma igualdade só: sem índice composto; a ordem é na tela
 * (`buildOfficialDuprRanking`).
 */
export async function listVerifiedDuprProfiles() {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, 'athlete_profiles'), where('dupr_verified', '==', true)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** O espelho DUPR de UMA pessoa (`athlete_profiles/{uid}`), ou null. */
export async function getDuprMirror(uid) {
  if (!db || !uid) return null;
  const snap = await getDoc(doc(db, 'athlete_profiles', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { verified: d.dupr_verified === true, dupr_id: d.dupr_id || '', doubles: d.dupr_rating ?? null, singles: d.dupr_rating_singles ?? null };
}

/** Grava a política inteira (normalizada antes) e registra na auditoria. */
export async function saveDuprPolicy(policy, actor) {
  const p = normalizeDuprPolicy(policy);
  await setDoc(ref(), { ...p, updated_at: serverTimestamp(), updated_by: actor?.uid || null });
  await createAuditLog({ action: 'dupr_policy_changed', actor, details: p });
  return p;
}
