/**
 * Os MODELOS de arte de cupom da arena (Onda CD).
 *
 * Moram em `arena_settings.coupon_templates` — o mesmo documento (e a mesma
 * regra) dos modelos de banner: só quem gere a arena lê e escreve. A ARTE de
 * cada cupom mora no próprio cupom (`arena_coupons.art`) e é gravada pelo
 * serviço de cupons, que a confere (`normalizeCouponInput`).
 *
 * Zero coleção nova, zero regra nova.
 */
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import {
  ARENA_TEMPLATES_MAX, COUPON_TEMPLATES_FIELD, arenaCouponTemplatesFrom,
} from '../domain/couponArt.js';
import { getOrCreateArenaSettings } from './v3SettingsService.js';

const COL_SETTINGS = 'arena_settings';

/** Os modelos de cupom da arena (só a arena lê). */
export async function getArenaCouponTemplates(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDoc(doc(db, COL_SETTINGS, arenaId));
  return snap.exists() ? arenaCouponTemplatesFrom(snap.data()) : [];
}

/**
 * Grava a lista de modelos de cupom da arena (já montada por
 * `saveArenaCouponTemplate` / `removeArenaCouponTemplate`). A lista é
 * conferida de novo aqui — quem grava confere.
 */
export async function saveArenaCouponTemplates(arenaId, lista = [], actor = null) {
  if (!db || !arenaId) throw new Error('arenaId é obrigatório.');
  const limpa = arenaCouponTemplatesFrom({ [COUPON_TEMPLATES_FIELD]: lista })
    .slice(0, ARENA_TEMPLATES_MAX)
    .map((t) => ({
      id: t.id,
      name: String(t.name || '').trim().slice(0, 40),
      design: t.design,
      created_at_ms: Number(t.created_at_ms) || Date.now(),
      updated_at_ms: Number(t.updated_at_ms) || Date.now(),
    }));
  // O documento de configurações pode não existir ainda: nasce com os padrões.
  await getOrCreateArenaSettings(arenaId);
  await updateDoc(doc(db, COL_SETTINGS, arenaId), { [COUPON_TEMPLATES_FIELD]: limpa, updated_at: serverTimestamp() });
  await createAuditLog({
    action: 'arena_coupon_templates_saved', actor, details: { arena_id: arenaId, count: limpa.length },
  });
  return limpa;
}
