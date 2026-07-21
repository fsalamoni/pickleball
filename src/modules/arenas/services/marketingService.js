/**
 * Service: Marketing (Arena V3 — sprint 6).
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, increment, limit,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import {
  normalizeCouponInput, isCouponValid, applyCoupon, generateReferralCode,
  calculateLoyaltyPoints, classifyNps, calculateNps, CAMPAIGN_STATUS,
} from '../domain/marketing.js';

const COL_COUPONS = 'arena_coupons';
const COL_CAMPAIGNS = 'arena_campaigns';
const COL_NPS = 'arena_nps_responses';
const COL_REFERRALS = 'arena_referrals';

function str(v) { return String(v ?? '').trim(); }

/* --------------------- Coupons -------------------- */

export async function listArenaCoupons(arenaId, { onlyActive = true, lim = 100 } = {}) {
  if (!db || !arenaId) return [];
  const c = [where('arena_id', '==', arenaId)];
  if (onlyActive) c.push(where('active', '==', true));
  c.push(limit(lim));
  const snap = await getDocs(query(collection(db, COL_COUPONS), ...c));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createArenaCoupon(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const { valid, errors, value } = normalizeCouponInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  const id = doc(collection(db, COL_COUPONS)).id;
  await setDoc(doc(db, COL_COUPONS, id), {
    id, arena_id: arenaId, ...value, used_count: 0, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_coupon_created', actor, details: { arena_id: arenaId, code: value.code } });
  return id;
}

export async function useCoupon(couponId, userId) {
  if (!couponId || !userId) return;
  await updateDoc(doc(db, COL_COUPONS, couponId), {
    used_count: increment(1),
    updated_at: serverTimestamp(),
  });
}

/* --------------------- Campaigns -------------------- */

export async function listArenaCampaigns(arenaId, { lim = 50 } = {}) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_CAMPAIGNS), where('arena_id', '==', arenaId), orderBy('created_at', 'desc'), limit(lim)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createCampaign(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const id = doc(collection(db, COL_CAMPAIGNS)).id;
  await setDoc(doc(db, COL_CAMPAIGNS, id), {
    id, arena_id: arenaId,
    name: str(input.name).slice(0, 120),
    channel: input.channel || 'email',
    message: str(input.message).slice(0, 1000),
    target_audience: str(input.target_audience).slice(0, 60),
    status: CAMPAIGN_STATUS.DRAFT,
    scheduled_at: input.scheduled_at || null,
    sent_count: 0,
    created_by: actor?.uid, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_campaign_created', actor, details: { arena_id: arenaId, name: input.name } });
  return id;
}

/* --------------------- NPS -------------------- */

export async function submitNps(arenaId, userId, score, comment) {
  if (!arenaId || !userId) throw new Error('Parâmetros obrigatórios.');
  if (!Number.isFinite(score) || score < 0 || score > 10) throw new Error('Score 0-10.');
  const id = `${arenaId}_${userId}_${Date.now()}`;
  await setDoc(doc(db, COL_NPS, id), {
    id, arena_id: arenaId, user_id: userId, score, classification: classifyNps(score),
    comment: str(comment).slice(0, 500), created_at: serverTimestamp(),
  });
}

export async function getArenaNpsResponses(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_NPS), where('arena_id', '==', arenaId)));
  return snap.docs.map((d) => d.data());
}

export function getArenaNpsSummary(responses) {
  const summary = calculateNps(responses);
  return { nps: summary, count: responses.length };
}

/* --------------------- Referral -------------------- */

export async function createReferral(arenaId, userId, referredUserId) {
  if (!arenaId || !userId) return null;
  const id = `${arenaId}_${userId}_${referredUserId || 'open'}`;
  const code = generateReferralCode(userId);
  await setDoc(doc(db, COL_REFERRALS, id), {
    id, arena_id: arenaId, referrer_id: userId, referred_id: referredUserId || null,
    code, status: 'pending', created_at: serverTimestamp(),
  });
  return code;
}
