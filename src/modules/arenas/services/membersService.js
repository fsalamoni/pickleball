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
import {
  SUBSCRIPTION_STATUS, normalizeSubscriptionInput, todayISO,
} from '../domain/subscription.js';

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
  // Sem orderBy no Firestore (o índice de arena_members é por tier, não points)
  // → ordena por pontos em memória para não falhar.
  const snap = await getDocs(query(collection(db, COL_MEMBERS), where('arena_id', '==', arenaId), limit(lim)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(b.points || 0) - Number(a.points || 0));
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
  // Índice de arena_packages é por active, não price → ordena em memória.
  const snap = await getDocs(query(collection(db, COL_PACKAGES), where('arena_id', '==', arenaId), limit(lim)));
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (onlyActive) list = list.filter((p) => p.active !== false);
  return list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
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

/* ================================================================== */
/*  O benefício do membro chegando à RESERVA                           */
/* ================================================================== */

/**
 * Tudo o que a conta do membro precisa, em UMA ida ao banco por coleção.
 *
 * Existe porque o benefício é lido em dois momentos — na tela (estimativa) e
 * no serviço (o valor que é GRAVADO) — e as duas leituras precisam ver
 * exatamente o mesmo estado. Falha em qualquer parte devolve o neutro: sem
 * membro, sem pacote, sem saldo. Benefício é bônus; nunca pode derrubar uma
 * reserva.
 *
 * @param {string} arenaId
 * @param {string} userId
 * @returns {Promise<{ member: object|null, wallet: object|null, packages: Array, tiers: Array }>}
 */
export async function getMemberContext(arenaId, userId) {
  const neutro = { member: null, wallet: null, packages: [], tiers: DEFAULT_TIERS };
  if (!db || !arenaId || !userId) return neutro;
  try {
    const [member, wallet, settings] = await Promise.all([
      getArenaMember(arenaId, userId).catch(() => null),
      getArenaWallet(arenaId, userId).catch(() => null),
      getDoc(doc(db, 'arena_settings', arenaId)).catch(() => null),
    ]);
    // Os níveis desta arena moram em `arena_settings` (que a arena PODE
    // escrever), não em `arena_tier_configs` (só o admin da plataforma
    // escreve). Ausentes, valem os padrões.
    const tiers = settings?.exists?.() ? settings.data()?.member_tiers : null;
    return {
      member: member || null,
      wallet: wallet || null,
      packages: Array.isArray(wallet?.packages) ? wallet.packages : [],
      tiers: Array.isArray(tiers) && tiers.length > 0 ? tiers : DEFAULT_TIERS,
    };
  } catch {
    return neutro;
  }
}

/**
 * Aplica o que a reserva consumiu do membro: horas de pacote, saldo da
 * carteira e os pontos ganhos. UMA escrita.
 *
 * Chamada na CONFIRMAÇÃO, nunca no pedido: queimar horas de um pedido que a
 * arena ainda pode recusar seria cobrar por um jogo que não vai acontecer.
 *
 * Idempotência é responsabilidade de quem chama (a confirmação só acontece
 * uma vez por reserva, e a transição de status é validada antes).
 *
 * @param {string} arenaId
 * @param {string} userId
 * @param {{ packagePlan?: Array<{id: string, hours: number}>, walletAmount?: number, points?: number, reference?: string }} uso
 * @param {object|null} actor
 */
export async function consumeMemberBenefit(arenaId, userId, uso = {}, actor = null) {
  if (!db || !arenaId || !userId) return;
  const plano = Array.isArray(uso.packagePlan) ? uso.packagePlan.filter((p) => p?.id && p.hours > 0) : [];
  const valorCarteira = Math.max(0, Number(uso.walletAmount) || 0);
  const pontos = Math.max(0, Math.round(Number(uso.points) || 0));
  if (plano.length === 0 && valorCarteira === 0 && pontos === 0) return;

  const wRef = doc(db, COL_WALLETS, walletId(arenaId, userId));
  const wSnap = await getDoc(wRef);
  const wallet = wSnap.exists() ? wSnap.data() : null;

  const batch = writeBatch(db);

  if (wallet && (plano.length > 0 || valorCarteira > 0)) {
    const porId = new Map(plano.map((p) => [p.id, p.hours]));
    const pacotes = (wallet.packages || []).map((p) => (
      porId.has(p.pkg_id)
        ? { ...p, used_hours: (Number(p.used_hours) || 0) + porId.get(p.pkg_id) }
        : p
    ));
    const lancamentos = [...(wallet.transactions || [])];
    if (valorCarteira > 0) {
      lancamentos.push({
        type: 'debit',
        amount: valorCarteira,
        source: str(uso.reference) || 'reserva',
        at: new Date(),
      });
    }
    if (plano.length > 0) {
      lancamentos.push({
        type: 'package_use',
        hours: plano.reduce((a, p) => a + p.hours, 0),
        source: str(uso.reference) || 'reserva',
        at: new Date(),
      });
    }
    batch.set(wRef, {
      packages: pacotes,
      transactions: lancamentos.slice(-200),
      ...(valorCarteira > 0 ? { balance: increment(-valorCarteira) } : {}),
      updated_at: serverTimestamp(),
    }, { merge: true });
  }

  if (pontos > 0) {
    batch.set(doc(db, COL_MEMBERS, memberId(arenaId, userId)), {
      points: increment(pontos),
      updated_at: serverTimestamp(),
    }, { merge: true });
  }

  await batch.commit();
  await createAuditLog({
    action: 'arena_member_benefit_applied',
    actor,
    details: {
      arena_id: arenaId,
      user_id: userId,
      package_hours: plano.reduce((a, p) => a + p.hours, 0),
      wallet_amount: valorCarteira,
      points: pontos,
      reference: uso.reference || null,
    },
  });
  logger.info('arena_member_benefit_applied', { arenaId, userId, pontos });
}

/* ================================================================== */
/*  Mensalidade                                                        */
/* ================================================================== */

/**
 * A mensalidade de UMA pessoa nesta arena. Doc id determinístico
 * (`{arenaId}_{userId}`): uma pessoa tem no máximo um plano por arena, e id
 * determinístico é o que impede dois documentos concorrentes para a mesma
 * relação.
 */
function subscriptionId(arenaId, userId) { return `${arenaId}_${userId}`; }

/** Todas as mensalidades da arena. Um `where` só — sem índice novo. */
export async function listArenaSubscriptions(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_SUBSCRIPTIONS), where('arena_id', '==', arenaId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.user_name || '').localeCompare(String(b.user_name || ''), 'pt-BR'));
}

export async function getMemberSubscription(arenaId, userId) {
  if (!db || !arenaId || !userId) return null;
  const snap = await getDoc(doc(db, COL_SUBSCRIPTIONS, subscriptionId(arenaId, userId)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Cria ou ajusta o plano de um membro.
 *
 * Preserva `paid_months` e `started_on` de um plano que já existia: mudar o
 * valor não pode apagar o histórico de quem já pagou.
 */
export async function setMemberSubscription(arenaId, userId, input, actor) {
  if (!arenaId || !userId) throw new Error('arenaId e userId são obrigatórios.');
  const { valid, errors, value } = normalizeSubscriptionInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');

  const id = subscriptionId(arenaId, userId);
  const ref = doc(db, COL_SUBSCRIPTIONS, id);
  const anterior = await getDoc(ref);
  const antes = anterior.exists() ? anterior.data() : null;

  await setDoc(ref, {
    id,
    arena_id: arenaId,
    user_id: userId,
    user_name: str(input.user_name) || antes?.user_name || '',
    ...value,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    started_on: antes?.started_on || str(input.started_on) || todayISO(),
    paid_months: Array.isArray(antes?.paid_months) ? antes.paid_months : [],
    created_at: antes?.created_at || serverTimestamp(),
    updated_at: serverTimestamp(),
  }, { merge: true });

  await createAuditLog({
    action: antes ? 'arena_subscription_updated' : 'arena_subscription_created',
    actor,
    details: { arena_id: arenaId, user_id: userId, price: value.price, billing_day: value.billing_day },
  });
  return id;
}

/**
 * Registra (ou desfaz) o pagamento de um mês.
 *
 * `paid` false serve para o engano — a arena marcou o mês errado e precisa
 * voltar atrás sem apagar o plano.
 */
export async function setSubscriptionMonthPaid(arenaId, userId, month, paid, actor) {
  if (!arenaId || !userId || !/^\d{4}-\d{2}$/.test(String(month || ''))) {
    throw new Error('Informe o mês no formato AAAA-MM.');
  }
  const ref = doc(db, COL_SUBSCRIPTIONS, subscriptionId(arenaId, userId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Este membro não tem mensalidade.');
  const atual = new Set(snap.data()?.paid_months || []);
  if (paid) atual.add(month); else atual.delete(month);

  await updateDoc(ref, {
    paid_months: [...atual].sort(),
    last_payment_at: paid ? serverTimestamp() : (snap.data()?.last_payment_at || null),
    updated_at: serverTimestamp(),
  });

  if (paid) {
    try {
      notifyUsers([userId], {
        title: 'Mensalidade recebida',
        message: `A arena registrou o pagamento de ${month}.`,
        type: NOTIFICATION_TYPE.GENERIC,
        link: `/arenas/${arenaId}/membros`,
        actor,
      });
    } catch (err) { logger.info('notify subscription paid failed', { err: err?.code }); }
  }

  await createAuditLog({
    action: paid ? 'arena_subscription_month_paid' : 'arena_subscription_month_unpaid',
    actor,
    details: { arena_id: arenaId, user_id: userId, month },
  });
}

/** Encerra a mensalidade. O histórico de pagamentos permanece. */
export async function cancelMemberSubscription(arenaId, userId, actor) {
  if (!arenaId || !userId) return;
  await updateDoc(doc(db, COL_SUBSCRIPTIONS, subscriptionId(arenaId, userId)), {
    status: SUBSCRIPTION_STATUS.CANCELLED,
    cancelled_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'arena_subscription_cancelled',
    actor,
    details: { arena_id: arenaId, user_id: userId },
  });
}
