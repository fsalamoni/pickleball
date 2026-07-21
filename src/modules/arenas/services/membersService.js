/**
 * Service: Members & Packages (Arena V3 — sprint 2).
 *
 * CRUD para:
 * - arena_members (relação atleta-arena)
 * - arena_packages (pacotes pré-pagos)
 * - arena_wallets (saldo do atleta na arena)
 * - arena_subscriptions (mensalidades)
 * - arena_tier_configs (config de tiers)
 *
 * ADITIVO. Não mexe em arenas/{id} nem em nenhuma coleção existente.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, writeBatch, increment, limit,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  normalizeMemberInput, normalizePackageInput, computeTier, addPoints,
  isPackageValid, getPackageRemainingHours, consumePackageHours,
  calculateCashbackPct, calculateCashback, DEFAULT_TIERS, MEMBER_TIER,
} from '../domain/members.js';

const COL_MEMBERS = 'arena_members';
const COL_PACKAGES = 'arena_packages';
const COL_WALLETS = 'arena_wallets';
const COL_SUBSCRIPTIONS = 'arena_subscriptions';
const COL_TIER_CONFIGS = 'arena_tier_configs';

function memberId(arenaId, userId) { return `${arenaId}_${userId}`; }
function walletId(arenaId, userId) { return `${arenaId}_${userId}`; }
function str(v) { return String(v ?? '').trim(); }
function displayName(u, p) {
  return p?.platform_name || p?.full_name || u?.displayName || u?.email || 'Atleta';
}

/* -------------------------- Members --------------------------- */

export async function listArenaMembers(arenaId, { limit: lim = 200 } = {}) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_MEMBERS), where('arena_id', '==', arenaId), orderBy('points', 'desc'), limit(lim)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getArenaMember(arenaId, userId) {
  if (!arenaId || !userId) return null;
  const snap = await getDoc(doc(db, COL_MEMBERS, memberId(arenaId, userId)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addArenaMember(arenaId, target, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  if (!target?.user_id) throw new Error('user_id obrigatório.');
  const norm = normalizeMemberInput(target);
  const id = memberId(arenaId, target.user_id);
  const ref = doc(db, COL_MEMBERS, id);
  await setDoc(ref, {
    id,
    arena_id: arenaId,
    ...norm,
    joined_at: serverTimestamp(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  // Cria wallet zerado também
  await setDoc(doc(db, COL_WALLETS, walletId(arenaId, target.user_id)), {
    id: walletId(arenaId, target.user_id),
    arena_id: arenaId,
    user_id: target.user_id,
    user_name: norm.user_name,
    balance: 0,
    points: 0,
    total_spent: 0,
    transactions: [],
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  try {
    notifyUsers([target.user_id], {
      title: 'Você é membro!',
      message: `Agora você faz parte do programa de membros da arena.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: `/arenas/${arenaId}/membros`,
      actor,
    });
  } catch (err) { logger.info('notify add member failed', { err: err?.code }); }
  await createAuditLog({ action: 'arena_member_added', actor, details: { arena_id: arenaId, user_id: target.user_id } });
  return id;
}

export async function removeArenaMember(arenaId, userId, actor) {
  if (!arenaId || !userId) return;
  await deleteDoc(doc(db, COL_MEMBERS, memberId(arenaId, userId)));
  await createAuditLog({ action: 'arena_member_removed', actor, details: { arena_id: arenaId, user_id: userId } });
}

export async function addPointsToMember(arenaId, userId, points, actor) {
  if (!arenaId || !userId) return null;
  const m = await getArenaMember(arenaId, userId);
  if (!m) return null;
  const { points: total, tier } = addPoints(m.points || 0, points);
  await updateDoc(doc(db, COL_MEMBERS, memberId(arenaId, userId)), {
    points: total,
    tier: tier.id,
    updated_at: serverTimestamp(),
  });
  return { points: total, tier };
}

/* -------------------------- Packages -------------------------- */

export async function listArenaPackages(arenaId, { onlyActive = true, lim = 100 } = {}) {
  if (!db || !arenaId) return [];
  const constraints = [where('arena_id', '==', arenaId)];
  if (onlyActive) constraints.push(where('active', '==', true));
  constraints.push(orderBy('price', 'asc'));
  constraints.push(limit(lim));
  const snap = await getDocs(query(collection(db, COL_PACKAGES), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createArenaPackage(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const { valid, errors, value } = normalizePackageInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  const id = doc(collection(db, COL_PACKAGES)).id;
  await setDoc(doc(db, COL_PACKAGES, id), {
    id, arena_id: arenaId, ...value, sold_count: 0, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_package_created', actor, details: { arena_id: arenaId, name: value.name } });
  return id;
}

export async function updateArenaPackage(pkgId, updates, actor) {
  if (!pkgId) return;
  await updateDoc(doc(db, COL_PACKAGES, pkgId), { ...updates, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'arena_package_updated', actor, details: { pkg_id: pkgId } });
}

export async function deleteArenaPackage(pkgId, actor) {
  if (!pkgId) return;
  await deleteDoc(doc(db, COL_PACKAGES, pkgId));
  await createAuditLog({ action: 'arena_package_deleted', actor, details: { pkg_id: pkgId } });
}

/**
 * Atleta compra um pacote (sandbox: registra intent).
 * Cria registro em arena_wallets/{user_id}.packages[].
 */
export async function purchasePackage(arenaId, pkgId, user, profile) {
  if (!arenaId || !pkgId) throw new Error('arenaId/pkgId obrigatórios.');
  if (!user?.uid) throw new Error('Faça login.');

  const pkgSnap = await getDoc(doc(db, COL_PACKAGES, pkgId));
  if (!pkgSnap.exists()) throw new Error('Pacote não encontrado.');
  const pkg = { id: pkgSnap.id, ...pkgSnap.data() };
  if (!pkg.active) throw new Error('Pacote indisponível.');

  const expiresMs = Date.now() + (pkg.validity_days || 60) * 86_400_000;
  const walletRef = doc(db, COL_WALLETS, walletId(arenaId, user.uid));
  const walletSnap = await getDoc(walletRef);

  const purchase = {
    pkg_id: pkgId,
    pkg_name: pkg.name,
    total_hours: pkg.hours,
    used_hours: 0,
    purchased_at: serverTimestamp(),
    expires_at: new Date(expiresMs),
  };

  if (walletSnap.exists()) {
    const w = walletSnap.data();
    const packages = [...(w.packages || []), purchase];
    await updateDoc(walletRef, {
      packages,
      updated_at: serverTimestamp(),
    });
  } else {
    await setDoc(walletRef, {
      id: walletId(arenaId, user.uid),
      arena_id: arenaId,
      user_id: user.uid,
      user_name: displayName(user, profile),
      balance: 0,
      points: 0,
      total_spent: pkg.price,
      packages: [purchase],
      transactions: [{
        type: 'package_purchase',
        amount: pkg.price,
        pkg_id: pkgId,
        pkg_name: pkg.name,
        at: serverTimestamp(),
      }],
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  }

  // Cria member se não existir
  const member = await getArenaMember(arenaId, user.uid);
  if (!member) {
    await addArenaMember(arenaId, { user_id: user.uid, user_name: displayName(user, profile), user_photo: profile?.photo_url || user.photoURL || '' }, user);
  } else {
    // soma pontos (1 ponto por R$)
    const points = Math.floor(pkg.price);
    await addPointsToMember(arenaId, user.uid, points, user);
  }

  await createAuditLog({ action: 'arena_package_purchased', actor: user, details: { arena_id: arenaId, pkg_id: pkgId, price: pkg.price } });
  return purchase;
}

/** Consome horas de um pacote ativo do user. */
export async function consumePackage(arenaId, userId, hours, actor) {
  if (!arenaId || !userId || !hours) return null;
  const walletRef = doc(db, COL_WALLETS, walletId(arenaId, userId));
  const snap = await getDoc(walletRef);
  if (!snap.exists()) return null;
  const w = snap.data();
  const now = Date.now();
  const packages = (w.packages || []).map((p) => {
    if (isPackageValid(p, now) && getPackageRemainingHours(p) >= hours) {
      return consumePackageHours(p, hours);
    }
    return p;
  });
  await updateDoc(walletRef, { packages, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'arena_package_consumed', actor, details: { arena_id: arenaId, hours } });
}

/* -------------------------- Wallet -------------------------- */

export async function getArenaWallet(arenaId, userId) {
  if (!arenaId || !userId) return null;
  const snap = await getDoc(doc(db, COL_WALLETS, walletId(arenaId, userId)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function creditWallet(arenaId, userId, amount, source, actor) {
  if (!arenaId || !userId || !Number.isFinite(amount) || amount <= 0) return;
  const walletRef = doc(db, COL_WALLETS, walletId(arenaId, userId));
  const tx = {
    type: 'credit',
    amount,
    source: str(source).slice(0, 60),
    at: serverTimestamp(),
  };
  await setDoc(walletRef, {
    balance: increment(amount),
    transactions: [...((await getDoc(walletRef)).data()?.transactions || []), tx],
    updated_at: serverTimestamp(),
  }, { merge: true });
  await createAuditLog({ action: 'arena_wallet_credited', actor, details: { arena_id: arenaId, user_id: userId, amount, source } });
}

export async function applyCashback(arenaId, userId, amount, actor) {
  if (!arenaId || !userId || !Number.isFinite(amount) || amount <= 0) return null;
  const walletRef = doc(db, COL_WALLETS, walletId(arenaId, userId));
  const snap = await getDoc(walletRef);
  if (!snap.exists()) return null;
  const w = snap.data();
  const totalSpent = (w.total_spent || 0) + amount;
  const cashback = calculateCashback(amount, w.total_spent || 0);
  if (cashback <= 0) {
    await updateDoc(walletRef, { total_spent: totalSpent, updated_at: serverTimestamp() });
    return null;
  }
  const tx = {
    type: 'cashback',
    amount: cashback,
    pct: calculateCashbackPct(w.total_spent || 0),
    source: 'booking',
    at: serverTimestamp(),
  };
  await updateDoc(walletRef, {
    total_spent: totalSpent,
    balance: increment(cashback),
    transactions: [...(w.transactions || []), tx],
    updated_at: serverTimestamp(),
  });
  return cashback;
}
