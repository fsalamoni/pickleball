/**
 * FEDERAÇÕES — leitura e escrita direta no Firestore (federação, equipe,
 * planos, preferências do filiado, declaração de pagamento) e as chamadas ao
 * servidor (`federationReview`, `federationMembership`,
 * `federationChargeConfirm`, `federationVerify`).
 *
 * O estado da filiação, o número, a validade, o código da carteirinha e toda
 * cobrança NASCEM no servidor: o atleta não "se aprova" nem "se paga". A
 * REGRA é a defesa; este serviço monta o documento que ela aceita e diz
 * antes, com a frase certa, o que seria recusado.
 *
 * Toda consulta é de igualdade/`in` — nenhum índice composto; a ordenação é
 * em memória (domínio).
 */
import { httpsCallable } from 'firebase/functions';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, limit,
} from 'firebase/firestore';
import { db, functions } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { t } from '@/core/i18n';
import { FED_COLLECTIONS as C, FEDERATION_STATUS, STAFF_ROLE, fedUserDocId } from '../domain/constants.js';
import { normalizeFederationBranding, normalizeModules, validateFederationInput, validateFederationPayment, validateFederationPublicInput } from '../domain/federation.js';
import { validatePlanInput } from '../domain/plans.js';
import { canDeclarePayment } from '../domain/charges.js';
import { canChangeStaff } from '../domain/staff.js';

const toDoc = (d) => ({ id: d.id, ...d.data() });

/** Erro de validação com os erros por campo (o formulário mostra cada um no lugar). */
export class FederationError extends Error {
  constructor(message, fieldErrors = {}) {
    super(message);
    this.name = 'FederationError';
    this.fieldErrors = fieldErrors;
  }
}

/* ------------------------------------------------------------ servidor -- */

function mensagemDoServidor(err) {
  const code = String(err?.code || '');
  if (code.endsWith('unauthenticated')) return t('Entre na sua conta para continuar.');
  if (code.endsWith('permission-denied')) return t('Você não tem permissão para isso.');
  if (code.endsWith('not-found')) return t('Não encontramos o que você pediu. Pode ter sido removido.');
  if (code.endsWith('failed-precondition') || code.endsWith('invalid-argument') || code.endsWith('already-exists')) return err?.message || t('Não foi possível concluir.');
  if (code.endsWith('unavailable') || code.endsWith('deadline-exceeded')) return t('Sem conexão com o servidor. Tente de novo.');
  return err?.message || t('Não foi possível concluir. Tente de novo.');
}

async function chamar(nome, payload) {
  if (!functions) throw new Error(t('Firebase não está configurado neste ambiente.'));
  try {
    const { data } = await httpsCallable(functions, nome, { timeout: 60_000 })(payload);
    return data;
  } catch (err) {
    const e = new Error(mensagemDoServidor(err));
    e.code = err?.code;
    throw e;
  }
}

/** Admin da plataforma: aprova, recusa, suspende, verifica, marca como oficial. */
export const reviewFederation = ({ federationId, action, reason = '' }) => chamar('federationReview', { federationId, action, reason });

/**
 * Filiação: `request` (a própria pessoa), `renew`, `cancel`, e as da equipe
 * (`approve`, `reject`, `suspend`, `reinstate`). Ver `functions/federations.js`.
 */
export const membershipAction = (payload) => chamar('federationMembership', payload);

/** Financeiro: `confirm` ou `cancel` uma cobrança. */
export const chargeAction = ({ chargeId, action, note = '' }) => chamar('federationChargeConfirm', { chargeId, action, note });

/** Verificação pública da carteirinha — devolve só o mínimo (sem conta). */
export const verifyCard = (code) => chamar('federationVerify', { code });

/* ----------------------------------------------------------- federação -- */

export async function getFederation(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, C.federations, id));
  return snap.exists() ? toDoc(snap) : null;
}

/** Pela URL pública. Só aprovada tem página; o slug é único entre as aprovadas. */
export async function getFederationBySlug(slug) {
  const s = String(slug || '').toLowerCase();
  if (!s) return null;
  const q = query(collection(db, C.federations), where('slug', '==', s), where('status', '==', FEDERATION_STATUS.APPROVED), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : toDoc(snap.docs[0]);
}

/** O diretório: as aprovadas. Filtro de região e ordenação ficam na tela. */
export async function listPublicFederations() {
  const q = query(collection(db, C.federations), where('status', '==', FEDERATION_STATUS.APPROVED));
  return (await getDocs(q)).docs.map(toDoc);
}

/** Admin: todas, em qualquer estado (a fila de aprovação sai daqui). */
export async function listAllFederations() {
  return (await getDocs(collection(db, C.federations))).docs.map(toDoc);
}

/** As que a pessoa pediu (pendente, recusada…): só o criador vê a própria fora de aprovada. */
export async function listFederationsCreatedBy(uid) {
  if (!uid) return [];
  const q = query(collection(db, C.federations), where('created_by', '==', uid));
  return (await getDocs(q)).docs.map(toDoc);
}

/** CNPJ completo, razão social — só a equipe (admin) e o admin da plataforma. */
export async function getFederationPrivate(id) {
  const snap = await getDoc(doc(db, C.federations, id, 'private', 'data'));
  return snap.exists() ? snap.data() : null;
}

async function slugEmUso(slug, ignorarId = null) {
  const q = query(collection(db, C.federations), where('slug', '==', slug), limit(5));
  const snap = await getDocs(q);
  return snap.docs.some((d) => d.id !== ignorarId && d.data().status !== FEDERATION_STATUS.REJECTED);
}

/**
 * Pede a abertura. Nasce `pending`; o admin da plataforma aprova
 * (`federationReview`), e só então a página existe e a equipe é criada.
 */
export async function applyFederation(uid, input, { userName = '' } = {}) {
  const r = validateFederationInput(input);
  if (!r.ok) throw new FederationError(t('Confira os campos destacados.'), r.errors);
  if (await slugEmUso(r.value.public.slug)) throw new FederationError(t('Este endereço já está em uso por outra federação.'), { slug: t('Escolha outro endereço.') });
  const data = {
    ...r.value.public,
    status: FEDERATION_STATUS.PENDING,
    verified: false,
    official: false,
    branding: normalizeFederationBranding(input.branding || {}),
    payment: {},
    modules: normalizeModules({}),
    member_count: 0,
    created_by: uid,
    created_by_name: String(userName || '').slice(0, 120),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, C.federations), data);
  await setDoc(doc(db, C.federations, ref.id, 'private', 'data'), { ...r.value.private, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'federation_apply', actor: { uid }, details: { federation_id: ref.id, name: data.name, slug: data.slug } });
  return { id: ref.id, ...data };
}

/** A página pública (nome, sobre, contato, marca) — quem tem a permissão `admin` na equipe. */
export async function updateFederationProfile(id, input, { uid } = {}) {
  const atual = await getFederation(id);
  if (!atual) throw new FederationError(t('Federação não encontrada.'));
  const r = validateFederationPublicInput({ ...atual, ...input });
  if (!r.ok) throw new FederationError(t('Confira os campos destacados.'), r.errors);
  if (r.value.slug !== atual.slug && await slugEmUso(r.value.slug, id)) throw new FederationError(t('Este endereço já está em uso por outra federação.'), { slug: t('Escolha outro endereço.') });
  const patch = { ...r.value, updated_at: serverTimestamp() };
  if (input.branding) patch.branding = normalizeFederationBranding(input.branding);
  await updateDoc(doc(db, C.federations, id), patch);
  await createAuditLog({ action: 'federation_update', actor: { uid }, details: { federation_id: id, fields: Object.keys(patch) } });
  return patch;
}

/** O Pix para receber filiações. */
export async function updateFederationPayment(id, input, { uid } = {}) {
  const r = validateFederationPayment(input);
  if (!r.valid) throw new FederationError(r.error, { pix_key: r.error });
  await updateDoc(doc(db, C.federations, id), { payment: r.value, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'federation_payment_update', actor: { uid }, details: { federation_id: id, pix_key_type: r.value.pix_key_type } });
  return r.value;
}

/** Os módulos internos que a federação liga para si. */
export async function updateFederationModules(id, modules, { uid } = {}) {
  const value = normalizeModules(modules);
  await updateDoc(doc(db, C.federations, id), { modules: value, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'federation_modules_update', actor: { uid }, details: { federation_id: id, modules: value } });
  return value;
}

/* -------------------------------------------------------------- equipe -- */

export async function listFederationStaff(fedId) {
  const q = query(collection(db, C.staff), where('federation_id', '==', fedId));
  return (await getDocs(q)).docs.map(toDoc);
}

/** Os papéis da pessoa em todas as federações (uma consulta). */
export async function listMyStaffRoles(uid) {
  if (!uid) return [];
  const q = query(collection(db, C.staff), where('user_id', '==', uid));
  return (await getDocs(q)).docs.map(toDoc);
}

/**
 * Acrescenta ou troca o papel de alguém. Quem chama é conferido pela REGRA
 * (`fedHas(admin)`; presidente só por presidente); aqui a mesma conta diz
 * antes o motivo da recusa.
 */
export async function setStaffRole(fedId, { userId, userName = '', role, federationName = '', federationAcronym = '' }, { actor, actorRole, targetRole = null }) {
  if (!Object.values(STAFF_ROLE).includes(role)) throw new FederationError(t('Papel inválido.'));
  if (!canChangeStaff({ actorRole, targetRole, newRole: role, isSelf: actor.uid === userId })) {
    throw new FederationError(t('Só o presidente pode passar ou tirar a presidência.'));
  }
  const ref = doc(db, C.staff, fedUserDocId(fedId, userId));
  const atual = await getDoc(ref);
  const data = {
    federation_id: fedId, federation_name: String(federationName || '').slice(0, 120), federation_acronym: String(federationAcronym || '').slice(0, 12),
    user_id: userId, user_name: String(userName || '').slice(0, 120), role,
    added_by: atual.exists() ? atual.data().added_by : actor.uid, updated_at: serverTimestamp(),
    ...(atual.exists() ? {} : { created_at: serverTimestamp() }),
  };
  await setDoc(ref, data, { merge: true });
  await createAuditLog({ action: 'federation_staff_set', actor, userId, details: { federation_id: fedId, role } });
  return { id: ref.id, ...data };
}

export async function removeStaff(fedId, userId, { actor, actorRole, targetRole }) {
  if (targetRole === STAFF_ROLE.PRESIDENT) throw new FederationError(t('Passe a presidência antes de tirar o presidente.'));
  if (actor.uid !== userId && !canChangeStaff({ actorRole, targetRole, newRole: targetRole })) {
    throw new FederationError(t('Você não tem permissão para isso.'));
  }
  await deleteDoc(doc(db, C.staff, fedUserDocId(fedId, userId)));
  await createAuditLog({ action: 'federation_staff_remove', actor, userId, details: { federation_id: fedId } });
}

/* -------------------------------------------------------------- planos -- */

export async function listFederationPlans(fedId) {
  const q = query(collection(db, C.plans), where('federation_id', '==', fedId));
  return (await getDocs(q)).docs.map(toDoc);
}

export async function savePlan(fedId, input, { uid, planId = null } = {}) {
  const r = validatePlanInput(input);
  if (!r.ok) throw new FederationError(t('Confira os campos destacados.'), r.errors);
  const data = { ...r.value, federation_id: fedId, updated_at: serverTimestamp(), updated_by: uid || null };
  if (planId) {
    await updateDoc(doc(db, C.plans, planId), data);
  } else {
    const ref = await addDoc(collection(db, C.plans), { ...data, created_at: serverTimestamp() });
    planId = ref.id;
  }
  await createAuditLog({ action: 'federation_plan_save', actor: { uid }, details: { federation_id: fedId, plan_id: planId, name: data.name } });
  return { id: planId, ...data };
}

/** Plano não se apaga (filiações apontam para ele): desativa. */
export const setPlanActive = (planId, active, { uid } = {}) => updateDoc(doc(db, C.plans, planId), { active: Boolean(active), updated_at: serverTimestamp(), updated_by: uid || null });

/* ------------------------------------------------------------ filiados -- */

export async function getMembership(fedId, uid) {
  if (!fedId || !uid) return null;
  const snap = await getDoc(doc(db, C.members, fedUserDocId(fedId, uid)));
  return snap.exists() ? toDoc(snap) : null;
}

/** As filiações da pessoa, em todas as federações. */
export async function listMyMemberships(uid) {
  if (!uid) return [];
  const q = query(collection(db, C.members), where('user_id', '==', uid));
  return (await getDocs(q)).docs.map(toDoc);
}

/** A equipe: todos os filiados da federação (filtro de estado em memória). */
export async function listFederationMembers(fedId) {
  const q = query(collection(db, C.members), where('federation_id', '==', fedId));
  return (await getDocs(q)).docs.map(toDoc);
}

/** Só o que é da PESSOA no documento: mostrar o selo no perfil, aparecer no diretório, foto na verificação. */
export async function updateMyMembershipPrefs(memberId, prefs = {}) {
  const patch = {};
  ['public_badge', 'show_in_directory', 'public_photo'].forEach((k) => { if (typeof prefs[k] === 'boolean') patch[k] = prefs[k]; });
  if (!Object.keys(patch).length) return;
  await updateDoc(doc(db, C.members, memberId), { ...patch, prefs_updated_at: serverTimestamp() });
}

/* ----------------------------------------------------------- cobranças -- */

export async function listMyCharges(uid) {
  if (!uid) return [];
  const q = query(collection(db, C.charges), where('payer_uid', '==', uid));
  return (await getDocs(q)).docs.map(toDoc);
}

export async function listFederationCharges(fedId) {
  const q = query(collection(db, C.charges), where('federation_id', '==', fedId));
  return (await getDocs(q)).docs.map(toDoc);
}

export async function getCharge(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, C.charges, id));
  return snap.exists() ? toDoc(snap) : null;
}

/**
 * "Já paguei": o pagador só DECLARA (`declared_at` + observação). Confirmar é
 * do financeiro, pelo servidor. Declarado ≠ pago.
 */
export async function declarePayment(charge, { note = '' } = {}) {
  if (!canDeclarePayment(charge)) throw new FederationError(t('Esta cobrança não está mais em aberto.'));
  await updateDoc(doc(db, C.charges, charge.id), {
    status: 'declared', declared_at: serverTimestamp(), declared_note: String(note || '').trim().slice(0, 300),
  });
}
