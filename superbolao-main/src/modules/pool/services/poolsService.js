/**
 * Operações de domínio sobre Pools (bolões) e suas memberships.
 *
 * Convenção: nomes de campos no Firestore em snake_case.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  serverTimestamp,
  writeBatch,
  increment,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { generateInviteCode } from '@/core/lib/utils';
import { createAuditLog } from '@/core/services/auditService';
import { POOL_TEMPLATE_CODES, buildDefaultPoolSettings } from '@/modules/pool/domain/poolSettings';

/**
 * Cria um novo bolão. O criador vira owner automaticamente.
 * @param {{name:string, description?:string, entry_fee?:number, template_code?:string, tournament_id?:string|null, sport_code?:string, sport_name?:string}} data
 * @param {{uid:string, email:string, displayName?:string, photoURL?:string}} creator
 * @returns {Promise<string>} pool id
 */
export async function createPool(data, creator) {
  // Garante invite_code único (até 5 tentativas)
  let inviteCode = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateInviteCode();
    const existing = await getDocs(query(collection(db, 'pools'), where('invite_code', '==', candidate), limit(1)));
    if (existing.empty) {
      inviteCode = candidate;
      break;
    }
  }
  if (!inviteCode) throw new Error('Não foi possível gerar um código único de convite. Tente novamente.');

  const poolData = {
    name: data.name,
    description: data.description || '',
    invite_code: inviteCode,
    owner_user_id: creator.uid,
    entry_fee: data.entry_fee ?? 0,
    participation_info_text: data.participation_info_text || '',
    participation_qr_code_data_url: data.participation_qr_code_data_url || '',
    template_code: data.template_code || POOL_TEMPLATE_CODES.worldCup2026,
    tournament_id: data.tournament_id || null,
    settings: toFirestorePoolSettings(buildDefaultPoolSettings(data.template_code, data)),
    stats: {
      members_count: 1,
    },
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  const poolRef = doc(collection(db, 'pools'));
  const batch = writeBatch(db);
  batch.set(poolRef, poolData);
  batch.set(doc(db, 'pool_memberships', `${creator.uid}_${poolRef.id}`), buildMembershipData(creator, poolRef.id, 'owner', 'confirmed'));
  await batch.commit();
  await createAuditLog({
    action: 'pool_created',
    actor: creator,
    poolId: poolRef.id,
    details: { pool_name: data.name, entry_fee: data.entry_fee ?? 0 },
  });

  logger.info('Pool created:', poolRef.id);
  return poolRef.id;
}

function buildMembershipData(user, poolId, role, paymentStatus = 'unpaid') {
  const effectivePaymentStatus = rolePaymentStatus(role, paymentStatus);
  return {
    user_id: user.uid,
    pool_id: poolId,
    user_email_snapshot: user.email,
    user_name_snapshot: user.displayName || user.email,
    user_photo_snapshot: user.photoURL || '',
    role,
    payment_status: effectivePaymentStatus,
    payment_reported_at: null,
    payment_confirmed_at: effectivePaymentStatus === 'confirmed' ? serverTimestamp() : null,
    payment_confirmed_by: effectivePaymentStatus === 'confirmed' ? user.uid : null,
    points: 0,
    buchas: 0,
    super_buchas: 0,
    group_stage_position: null,
    joined_at: serverTimestamp(),
  };
}

/**
 * Owners/admins administrate the pool and are treated as already confirmed;
 * participants keep the payment status calculated by the pool entry flow.
 */
function rolePaymentStatus(role, paymentStatus) {
  return role === 'owner' || role === 'admin' ? 'confirmed' : paymentStatus;
}

function toFirestorePoolSettings(settings) {
  return {
    ...settings,
    deadline_overrides: Object.fromEntries(
      Object.entries(settings.deadline_overrides || {}).map(([stageCode, value]) => [
        stageCode,
        value instanceof Date ? value : value ? new Date(value) : null,
      ]),
    ),
  };
}

export async function getPool(poolId) {
  const snap = await getDoc(doc(db, 'pools', poolId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function updatePool(poolId, updates, actor = null) {
  await updateDoc(doc(db, 'pools', poolId), {
    ...updates,
    updated_at: serverTimestamp(),
  });
  if (actor) {
    await createAuditLog({
      action: hasParticipationInfoUpdate(updates) ? 'participation_info_updated' : 'pool_updated',
      actor,
      poolId,
      details: { changed_fields: Object.keys(updates) },
    });
  }
}

/**
 * Soft delete: marca o bolão como excluído. O pool some para todos os usuários,
 * mas os dados permanecem no banco para auditoria e possível restauração.
 * Apenas owner/admin do pool podem chamar (validado por Security Rules).
 */
export async function softDeletePool(poolId, actor = null) {
  await updateDoc(doc(db, 'pools', poolId), {
    deleted: true,
    deleted_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  if (actor) {
    await createAuditLog({ action: 'pool_deleted', actor, poolId });
  }
}

/**
 * Restaura um bolão que foi soft-deletado. Apenas platform admin.
 */
export async function restorePool(poolId) {
  await updateDoc(doc(db, 'pools', poolId), {
    deleted: false,
    deleted_at: null,
    updated_at: serverTimestamp(),
  });
}

/**
 * Hard delete: remove o bolão e TODOS os dados associados permanentemente.
 * Apenas platform admin. Executado em lote para garantir atomicidade parcial.
 *
 * Remove:
 *  - pool_memberships onde pool_id == poolId
 *  - bets onde pool_id == poolId
 *  - special_bets onde pool_id == poolId
 *  - processed_scores onde pool_id == poolId
 *  - pool_stage_aggregates onde pool_id == poolId
 *  - pool_competitors e pool_matches onde pool_id == poolId
 *  - o próprio documento pools/{poolId}
 */
export async function permanentDeletePool(poolId) {
  const batch = writeBatch(db);

  // 1. Memberships
  const membersSnap = await getDocs(
    query(collection(db, 'pool_memberships'), where('pool_id', '==', poolId)),
  );
  membersSnap.docs.forEach((d) => batch.delete(d.ref));

  // 2. Bets
  const betsSnap = await getDocs(
    query(collection(db, 'bets'), where('pool_id', '==', poolId)),
  );
  betsSnap.docs.forEach((d) => batch.delete(d.ref));

  // 3. Special bets
  const specialSnap = await getDocs(
    query(collection(db, 'special_bets'), where('pool_id', '==', poolId)),
  );
  specialSnap.docs.forEach((d) => batch.delete(d.ref));

  // 4. Processed scores
  const scoresSnap = await getDocs(
    query(collection(db, 'processed_scores'), where('pool_id', '==', poolId)),
  );
  scoresSnap.docs.forEach((d) => batch.delete(d.ref));

  // 5. Pool stage aggregates
  const aggSnap = await getDocs(
    query(collection(db, 'pool_stage_aggregates'), where('pool_id', '==', poolId)),
  );
  aggSnap.docs.forEach((d) => batch.delete(d.ref));

  // 6. Custom pool competitors and matches
  const competitorsSnap = await getDocs(
    query(collection(db, 'pool_competitors'), where('pool_id', '==', poolId)),
  );
  competitorsSnap.docs.forEach((d) => batch.delete(d.ref));

  const matchesSnap = await getDocs(
    query(collection(db, 'pool_matches'), where('pool_id', '==', poolId)),
  );
  matchesSnap.docs.forEach((d) => batch.delete(d.ref));

  // 7. Pool document
  batch.delete(doc(db, 'pools', poolId));

  await batch.commit();
  logger.info(`Hard deleted pool ${poolId} with all associated data`);
}
/**
 * Cria membership na coleção `pool_memberships` com docId determinístico
 * `${userId}_${poolId}` (mesmo padrão do CAOCIPP).
 */
export async function createMembership(user, poolId, role = 'participant') {
  const membershipId = `${user.uid}_${poolId}`;
  const membershipRef = doc(db, 'pool_memberships', membershipId);

  await setDoc(membershipRef, buildMembershipData(user, poolId, role, role === 'participant' ? 'unpaid' : 'confirmed'));

  return membershipId;
}

export async function ensureOwnerMembership(poolId, user) {
  const membershipId = `${user.uid}_${poolId}`;
  const membershipRef = doc(db, 'pool_memberships', membershipId);
  const snapshot = await getDoc(membershipRef);
  if (snapshot.exists()) return membershipId;

  await setDoc(membershipRef, buildMembershipData(user, poolId, 'owner', 'confirmed'));
  return membershipId;
}

/**
 * Ingressa em um bolão via invite code. Atomicamente:
 *   1. Verifica que o código existe
 *   2. Verifica que o usuário ainda não é membro
 *   3. Cria membership
 *   4. Incrementa stats.members_count
 */
export async function joinPoolByInvite(inviteCode, user) {
  const code = String(inviteCode || '').toUpperCase().trim();
  if (!code) throw new Error('Informe um código de convite.');

  const snapshot = await getDocs(query(collection(db, 'pools'), where('invite_code', '==', code), limit(1)));
  if (snapshot.empty) throw new Error('Código de convite inválido.');

  const poolDoc = snapshot.docs[0];
  const poolId = poolDoc.id;
  const poolData = poolDoc.data();
  const membershipId = `${user.uid}_${poolId}`;
  const paymentStatus = Number(poolData.entry_fee || 0) > 0 ? 'unpaid' : 'confirmed';

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(doc(db, 'pool_memberships', membershipId));
    if (existing.exists()) {
      throw new Error('Você já participa deste bolão.');
    }
    tx.set(doc(db, 'pool_memberships', membershipId), {
      ...buildMembershipData(user, poolId, 'participant', paymentStatus),
      invite_code_used: code,
    });
    tx.update(doc(db, 'pools', poolId), {
      'stats.members_count': increment(1),
      updated_at: serverTimestamp(),
    });
  });

  return poolId;
}

export async function reportPayment(pool, membership, actor) {
  if (!pool?.id || !membership?.id || !actor?.uid) throw new Error('Dados de pagamento inválidos.');
  if (membership.user_id !== actor.uid) throw new Error('Você só pode informar seu próprio pagamento.');
  if (membership.payment_status === 'confirmed') throw new Error('Pagamento já confirmado.');

  await updateDoc(doc(db, 'pool_memberships', membership.id), {
    payment_status: 'reported',
    payment_reported_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'payment_reported',
    actor,
    poolId: pool.id,
    userId: membership.user_id,
    userName: membership.user_name_snapshot,
    userEmail: membership.user_email_snapshot,
    details: { pool_name: pool.name, entry_fee: pool.entry_fee || 0 },
  });
}

export async function confirmMemberPayment(pool, membership, actor) {
  if (!pool?.id || !membership?.id || !actor?.uid) throw new Error('Dados de confirmação inválidos.');

  await updateDoc(doc(db, 'pool_memberships', membership.id), {
    payment_status: 'confirmed',
    payment_confirmed_at: serverTimestamp(),
    payment_confirmed_by: actor.uid,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'payment_confirmed',
    actor,
    poolId: pool.id,
    userId: membership.user_id,
    userName: membership.user_name_snapshot,
    userEmail: membership.user_email_snapshot,
    details: { pool_name: pool.name, entry_fee: pool.entry_fee || 0 },
  });
}

export async function leavePool(poolId, userId) {
  const membershipId = `${userId}_${poolId}`;
  const batch = writeBatch(db);
  batch.delete(doc(db, 'pool_memberships', membershipId));
  batch.update(doc(db, 'pools', poolId), {
    'stats.members_count': increment(-1),
    updated_at: serverTimestamp(),
  });
  await batch.commit();
}

/**
 * Separates participation-instruction edits from general pool settings in audit logs.
 */
function hasParticipationInfoUpdate(updates) {
  return 'participation_info_text' in updates || 'participation_qr_code_data_url' in updates;
}
