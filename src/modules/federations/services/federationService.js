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
import { deleteObject, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, functions, storage } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { t } from '@/core/i18n';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  AFFILIATION_STATUS, FED_COLLECTIONS as C, FED_PERMISSION, FEDERATION_STATUS, RESULT_STATUS, STAFF_ROLE, fedOrgDocId, fedRankingDocId, fedResultDocId, fedUserDocId,
} from '../domain/constants.js';
import { affiliationDecision, affiliationState, buildAffiliationRequest } from '../domain/affiliations.js';
import { SANCTION_WITHDRAW_PATCH, buildSanctionRequest, sanctionDecision, sanctionState } from '../domain/sanction.js';
import { normalizeRankingConfig, resultSeason, tournamentDay } from '../domain/officialRanking.js';
import { permissionsOf } from '../domain/staff.js';
import { modalityPlacement, registrationAllPeople } from '@/modules/tournament/domain/podium.js';
import { fedModuleOn, normalizeFederationBranding, normalizeFederationRules, normalizeModules, validateFederationInput, validateFederationPayment, validateFederationPublicInput } from '../domain/federation.js';
import { documentStoragePath, validateDocumentFile } from '../domain/privateData.js';
import { validateCourseInput } from '../domain/courses.js';
import { validateReportInput } from '../domain/discipline.js';
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

/* --- PR 3: as chamadas ao servidor (quem grava transferência, inscrição, credencial e sanção é ele) --- */

/** Transferência: `request` (a pessoa), `cancel`, `approve`/`reject` (secretaria). Ver `functions/federationTransfers.js`. */
export const transferAction = (payload) => chamar('federationTransfer', payload);
/** Curso: `enroll`/`cancel` (a pessoa), `pass`/`fail` (cursos). Ver `functions/federationCourses.js`. */
export const courseAction = (payload) => chamar('federationCourse', payload);
/** Disciplina: `apply`, `decide_appeal`, `end` (disciplina); `appeal` (a pessoa). Ver `functions/federationDiscipline.js`. */
export const disciplineAction = (payload) => chamar('federationDiscipline', payload);
/** Importação de filiados por planilha (secretaria). Devolve { imported, skipped[], pending }. */
export const importMembers = (payload) => chamar('federationImportMembers', payload);
/** O arquivo de um documento enviado (base64) — quem enviou, a secretaria ou o admin; a secretaria é auditada. */
export const fetchDocumentContent = (documentId) => chamar('federationDocument', { documentId });

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

/** Só o que é da PESSOA no documento: selo no perfil, diretório, foto na verificação e (dependente) o consentimento da foto do menor. */
export async function updateMyMembershipPrefs(memberId, prefs = {}) {
  const patch = {};
  ['public_badge', 'show_in_directory', 'public_photo', 'minor_photo_consent'].forEach((k) => { if (typeof prefs[k] === 'boolean') patch[k] = prefs[k]; });
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

/* ------------------------------------------- avisos à equipe (cliente) -- */

/** Os uids da equipe com a permissão (para avisar quem pode resolver). */
async function staffUidsWith(fedId, perm) {
  const equipe = await listFederationStaff(fedId);
  return equipe.filter((s) => permissionsOf(s.role).includes(perm) || permissionsOf(s.role).includes(FED_PERMISSION.ADMIN)).map((s) => s.user_id);
}

/* ------------------------------------------- clubes e arenas filiados -- */

/** Toda filiação de organização da federação (a equipe filtra em memória). */
export async function listFederationAffiliations(fedId) {
  const q = query(collection(db, C.affiliations), where('federation_id', '==', fedId));
  return (await getDocs(q)).docs.map(toDoc);
}

/** Só os FILIADOS (aprovados) — consulta pública da página da federação. */
export async function listApprovedAffiliations(fedId) {
  const q = query(collection(db, C.affiliations), where('federation_id', '==', fedId), where('status', '==', AFFILIATION_STATUS.APPROVED));
  return (await getDocs(q)).docs.map(toDoc);
}

/** As filiações de UM clube/arena (quem gere vê todas; o público, as aprovadas). */
export async function listOrgAffiliations(kind, orgId, { approvedOnly = false } = {}) {
  if (!kind || !orgId) return [];
  const filtros = [where('kind', '==', kind), where('org_id', '==', orgId)];
  if (approvedOnly) filtros.push(where('status', '==', AFFILIATION_STATUS.APPROVED));
  return (await getDocs(query(collection(db, C.affiliations), ...filtros))).docs.map(toDoc);
}

/** Pedidos que a PESSOA fez (exportação de dados). */
export async function listAffiliationsRequestedBy(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, C.affiliations), where('requested_by', '==', uid)))).docs.map(toDoc);
}

/**
 * O clube/arena PEDE a filiação. A regra confere quem gere a organização, a
 * federação aprovada com o módulo ligado e `status: 'pending'`. Recusado ou
 * suspenso pede de novo: o documento antigo sai e o pedido nasce limpo.
 */
export async function requestAffiliation({ federation, kind, org, uid, message = '' }) {
  if (!fedModuleOn(federation, 'affiliations')) throw new FederationError(t('Esta federação ainda não recebe filiação de clubes e arenas.'));
  const { id, data } = buildAffiliationRequest({ federation, kind, org, uid, message });
  const ref = doc(db, C.affiliations, id);
  const atual = await getDoc(ref);
  if (atual.exists()) {
    const st = affiliationState(atual.data());
    if (!st.canRequest) throw new FederationError(st.pending ? t('O pedido já foi enviado e aguarda a federação.') : t('Esta organização já é filiada.'));
    await deleteDoc(ref);
  }
  await setDoc(ref, { ...data, requested_at: serverTimestamp(), updated_at: serverTimestamp() });
  await createAuditLog({ action: 'federation_affiliation_request', actor: { uid }, details: { federation_id: federation.id, kind, org_id: org.id } });
  const equipe = await staffUidsWith(federation.id, FED_PERMISSION.MEMBERS).catch(() => []);
  await notifyUsers(equipe, {
    type: NOTIFICATION_TYPE.FEDERATION,
    title: t('Pedido de filiação de {org}', { org: data.org_name }),
    message: kind === 'club' ? t('O clube {org} pediu filiação à {sigla}. Analise em Filiados → Clubes e arenas.', { org: data.org_name, sigla: data.federation_acronym }) : t('A arena {org} pediu filiação à {sigla}. Analise em Filiados → Clubes e arenas.', { org: data.org_name, sigla: data.federation_acronym }),
    link: `/federacoes/${federation.id}/gerir?aba=filiados-orgs`,
    actor: { uid },
  }).catch(() => 0);
  return { id, ...data };
}

/** A organização retira o pedido ou se desfilia (apaga o documento). */
export async function withdrawAffiliation(affiliation, { uid } = {}) {
  await deleteDoc(doc(db, C.affiliations, affiliation.id));
  await createAuditLog({ action: 'federation_affiliation_withdraw', actor: { uid }, details: { federation_id: affiliation.federation_id, kind: affiliation.kind, org_id: affiliation.org_id, was: affiliation.status } });
}

/** A equipe decide: aprovar, recusar, suspender. Avisa quem pediu. */
export async function decideAffiliation(affiliation, action, { uid, reason = '' } = {}) {
  const patch = affiliationDecision(action, { uid, reason });
  await updateDoc(doc(db, C.affiliations, affiliation.id), { ...patch, updated_at: serverTimestamp() });
  await createAuditLog({ action: `federation_affiliation_${action}`, actor: { uid }, details: { federation_id: affiliation.federation_id, kind: affiliation.kind, org_id: affiliation.org_id, reason: patch.review.reason } });
  const textos = {
    approve: t('{org} agora é filiado à {sigla}. O selo já aparece na página.', { org: affiliation.org_name, sigla: affiliation.federation_acronym }),
    reject: t('A {sigla} recusou a filiação de {org}. Motivo: {motivo}', { org: affiliation.org_name, sigla: affiliation.federation_acronym, motivo: patch.review.reason }),
    suspend: t('A {sigla} suspendeu a filiação de {org}. Motivo: {motivo}', { org: affiliation.org_name, sigla: affiliation.federation_acronym, motivo: patch.review.reason }),
  };
  await notifyUsers([affiliation.requested_by], {
    type: NOTIFICATION_TYPE.FEDERATION, title: t('Filiação à {sigla}', { sigla: affiliation.federation_acronym }), message: textos[action],
    link: affiliation.kind === 'club' ? `/clubes/${affiliation.org_id}` : `/arenas/${affiliation.org_id}`, actor: { uid },
  }).catch(() => 0);
  return patch;
}

/* ------------------------------------------------- chancela de torneios -- */

/** Os torneios (não arquivados) ligados à federação — pendentes e chancelados; a tela separa. */
export async function listFederationTournaments(fedId) {
  const q = query(collection(db, 'tournaments'), where('federation_id', '==', fedId), where('archived', '==', false));
  return (await getDocs(q)).docs.map(toDoc);
}

/** O organizador PEDE a chancela (o patch que a regra aceita: pendente, por quem pede). */
export async function requestSanction(tournament, { federation, uid, tier, requiresMembership }) {
  if (!fedModuleOn(federation, 'tournaments')) throw new FederationError(t('Esta federação ainda não chancela torneios.'));
  const st = sanctionState(tournament);
  if (!st.canRequest) throw new FederationError(st.pending ? t('A chancela já foi pedida e aguarda a federação.') : t('Este torneio já é chancelado.'));
  const patch = buildSanctionRequest({ federation, uid, tier, requiresMembership });
  await updateDoc(doc(db, 'tournaments', tournament.id), { ...patch, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'tournament_sanction_request', actor: { uid }, tournamentId: tournament.id, details: { federation_id: federation.id, tier: patch.federation_sanction.tier } });
  const equipe = await staffUidsWith(federation.id, FED_PERMISSION.COMPETITIONS).catch(() => []);
  await notifyUsers(equipe, {
    type: NOTIFICATION_TYPE.FEDERATION, title: t('Pedido de chancela: {torneio}', { torneio: tournament.name }),
    message: t('O torneio {torneio} pediu a chancela da {sigla}. Analise em Competições → Chancelas.', { torneio: tournament.name, sigla: patch.federation_sanction.federation_acronym }),
    link: `/federacoes/${federation.id}/gerir?aba=chancelas`, actor: { uid },
  }).catch(() => 0);
  return patch;
}

/** O organizador retira o pedido pendente (o torneio volta a ser sem federação). */
export async function withdrawSanction(tournament, { uid } = {}) {
  if (!sanctionState(tournament).canWithdraw) throw new FederationError(t('Só um pedido pendente pode ser retirado.'));
  await updateDoc(doc(db, 'tournaments', tournament.id), { ...SANCTION_WITHDRAW_PATCH, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'tournament_sanction_withdraw', actor: { uid }, tournamentId: tournament.id, details: { federation_id: tournament.federation_id } });
}

/** Competições decide: aprovar (com peso e exigência de filiação), recusar, revogar. Avisa quem pediu. */
export async function decideSanction(tournament, action, { uid, reason = '', tier = null, requiresMembership = null } = {}) {
  const patch = sanctionDecision(tournament, action, { uid, reason, tier, requiresMembership });
  await updateDoc(doc(db, 'tournaments', tournament.id), { ...patch, updated_at: serverTimestamp() });
  await createAuditLog({ action: `tournament_sanction_${action}`, actor: { uid }, tournamentId: tournament.id, details: { federation_id: tournament.federation_id, reason: patch.federation_sanction.reason, tier: patch.federation_sanction.tier } });
  const sigla = patch.federation_sanction.federation_acronym || '';
  const textos = {
    approve: t('A {sigla} chancelou o torneio {torneio}. Ao fim de cada categoria, envie o resultado ao ranking oficial.', { sigla, torneio: tournament.name }),
    reject: t('A {sigla} recusou a chancela do torneio {torneio}. Motivo: {motivo}', { sigla, torneio: tournament.name, motivo: patch.federation_sanction.reason }),
    revoke: t('A {sigla} revogou a chancela do torneio {torneio}. Motivo: {motivo}', { sigla, torneio: tournament.name, motivo: patch.federation_sanction.reason }),
  };
  const destino = [tournament.federation_sanction?.requested_by, tournament.creator_uid].filter(Boolean);
  await notifyUsers(destino, { type: NOTIFICATION_TYPE.FEDERATION, title: t('Chancela: {torneio}', { torneio: tournament.name }), message: textos[action], link: `/torneios/${tournament.id}`, actor: { uid } }).catch(() => 0);
  return patch;
}

/* ------------------------------------------------- resultados e ranking -- */

export async function listFederationResults(fedId) {
  return (await getDocs(query(collection(db, C.results), where('federation_id', '==', fedId)))).docs.map(toDoc);
}

/** Os resultados de UM torneio (a tela do organizador sabe o que já foi enviado). */
export async function listTournamentFederationResults(tournamentId) {
  if (!tournamentId) return [];
  return (await getDocs(query(collection(db, C.results), where('tournament_id', '==', tournamentId)))).docs.map(toDoc);
}

/** Os resultados em que a PESSOA aparece (exportação de dados). */
export async function listResultsWith(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, C.results), where('uids', 'array-contains', uid)))).docs.map(toDoc);
}

/**
 * O organizador ENVIA (ou reenvia) o resultado de uma categoria ao ranking
 * oficial. A colocação sai de `modalityPlacement` — a MESMA conta do pódio e
 * dos cartões (`docs/43`). Só quem tem conta entra em `uids` (quem pontua).
 */
export async function sendFederationResult({ tournament, modality, matches, registrations, uid }) {
  const st = sanctionState(tournament);
  if (!st.approved) throw new FederationError(t('O torneio precisa da chancela aprovada para enviar resultados.'));
  const colocacao = modalityPlacement({ modality, tournament, matches });
  const rows = [];
  (registrations || []).forEach((reg) => {
    const c = colocacao.get(String(reg.id));
    if (!c || (c.position == null && c.played === 0)) return;
    registrationAllPeople(reg).forEach((p) => rows.push({ uid: p.user_id || null, name: String(p.name || '').slice(0, 120), photo_url: p.photo_url || null, position: c.position, played: c.played, won: c.won, registration_id: reg.id }));
  });
  if (!rows.length) throw new FederationError(t('Ainda não há resultado nesta categoria.'));
  rows.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  const id = fedResultDocId(st.federationId, tournament.id, modality.id);
  const data = {
    federation_id: st.federationId, federation_acronym: st.acronym, tournament_id: tournament.id, tournament_name: String(tournament.name || '').slice(0, 120),
    modality_id: modality.id, modality_name: String(modality.name || '').slice(0, 120),
    gender_category: modality.gender_category || 'open', age_category: modality.age_category || 'open', format: modality.format || 'doubles',
    tier: st.tier, date: tournamentDay(tournament), season: resultSeason(tournament),
    rows: rows.slice(0, 400), uids: [...new Set(rows.map((r) => r.uid).filter(Boolean))],
    status: RESULT_STATUS.SENT, sent_by: uid, sent_at: serverTimestamp(), review: null, updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, C.results, id), data);
  await createAuditLog({ action: 'federation_result_send', actor: { uid }, tournamentId: tournament.id, details: { federation_id: st.federationId, modality_id: modality.id, rows: data.rows.length } });
  return { id, ...data };
}

/** Competições recusa (com motivo) ou readmite um resultado. */
export async function reviewFederationResult(result, action, { uid, reason = '' } = {}) {
  const status = action === 'reject' ? RESULT_STATUS.REJECTED : RESULT_STATUS.SENT;
  const motivo = String(reason || '').trim().slice(0, 500);
  if (status === RESULT_STATUS.REJECTED && motivo.length < 3) throw new FederationError(t('Diga o motivo (mínimo 3 caracteres).'));
  await updateDoc(doc(db, C.results, result.id), { status, review: status === RESULT_STATUS.REJECTED ? { by: uid || null, at_ms: Date.now(), reason: motivo } : null, updated_at: serverTimestamp() });
  await createAuditLog({ action: `federation_result_${action}`, actor: { uid }, tournamentId: result.tournament_id, details: { federation_id: result.federation_id, modality_id: result.modality_id, reason: motivo } });
  if (status === RESULT_STATUS.REJECTED && result.sent_by) {
    await notifyUsers([result.sent_by], {
      type: NOTIFICATION_TYPE.FEDERATION, title: t('Resultado recusado: {torneio}', { torneio: result.tournament_name }),
      message: t('A {sigla} recusou o resultado de {categoria}. Motivo: {motivo}', { sigla: result.federation_acronym || '', categoria: result.modality_name, motivo: motivo }),
      link: `/torneios/${result.tournament_id}`, actor: { uid },
    }).catch(() => 0);
  }
}

/** O ranking da temporada (gravado pelo servidor). `null` = ainda não há. */
export async function getFederationRanking(fedId, season) {
  if (!fedId || !season) return null;
  const snap = await getDoc(doc(db, C.rankings, fedRankingDocId(fedId, season)));
  return snap.exists() ? toDoc(snap) : null;
}

/** A configuração do ranking (admin e competições). O servidor refaz as temporadas ao gravar. */
export async function updateRankingConfig(fedId, input, { uid } = {}) {
  const value = normalizeRankingConfig(input);
  await updateDoc(doc(db, C.federations, fedId), { ranking_config: value, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'federation_ranking_config', actor: { uid }, details: { federation_id: fedId, ...value } });
  return value;
}

/* ============================ PR 3: dados privados, dependentes, documentos ============================ */

/** As filiações dos DEPENDENTES que a pessoa filiou (menores, `user_id` nulo). */
export async function listMyDependents(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, C.members), where('guardian_uid', '==', uid)))).docs.map(toDoc);
}

/** CPF, responsável — o próprio/responsável e a secretaria (`private/data`). `null` se não há. */
export async function getMemberPrivate(memberId) {
  if (!memberId) return null;
  const snap = await getDoc(doc(db, C.members, memberId, 'private', 'data'));
  return snap.exists() ? snap.data() : null;
}

/**
 * A secretaria REVELA o CPF: a leitura é a mesma, mas fica registrada
 * (`federation_member_private_reveal`, com motivo) — como o suporte do admin.
 */
export async function revealMemberPrivate(member, { uid, reason = '' } = {}) {
  const motivo = String(reason || '').trim().slice(0, 300);
  if (motivo.length < 5) throw new FederationError(t('Diga o motivo (mínimo 5 caracteres).'));
  const priv = await getMemberPrivate(member.id);
  await createAuditLog({ action: 'federation_member_private_reveal', actor: { uid }, userId: member.user_id || null, details: { federation_id: member.federation_id, member_id: member.id, reason: motivo } });
  return priv;
}

/** Os documentos que a PESSOA enviou (dela e dos dependentes). */
export async function listMyDocuments(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, C.documents), where('user_id', '==', uid)))).docs.map(toDoc);
}

/** Todos os documentos enviados à federação (secretaria). */
export async function listFederationDocuments(fedId) {
  return (await getDocs(query(collection(db, C.documents), where('federation_id', '==', fedId)))).docs.map(toDoc);
}

/**
 * Envia um documento (PDF/imagem até 5 MB) para `federacao/{uid}/{id}.{ext}` e
 * registra. O caminho leva o uid de quem envia: a regra do Storage e a da
 * coleção conferem, e a exclusão de conta apaga a pasta.
 */
export async function uploadMemberDocument({ member, kind, file, uid }) {
  const erro = validateDocumentFile(file);
  if (erro) throw new FederationError(erro, { file: erro });
  if (!storage) throw new FederationError(t('Firebase não está configurado neste ambiente.'));
  const ref = doc(collection(db, C.documents));
  const storage_path = documentStoragePath(uid, ref.id, file.type);
  await uploadBytes(storageRef(storage, storage_path), file, { contentType: file.type });
  const data = {
    federation_id: member.federation_id, member_id: member.id, user_id: uid, kind, storage_path,
    content_type: file.type, size: Number(file.size) || 0, file_name: String(file.name || '').slice(0, 120),
    status: 'pending', review: null, created_at: serverTimestamp(), created_at_ms: Date.now(), updated_at: serverTimestamp(),
  };
  await setDoc(ref, data);
  await createAuditLog({ action: 'federation_document_upload', actor: { uid }, details: { federation_id: member.federation_id, member_id: member.id, kind, document_id: ref.id } });
  return { id: ref.id, ...data };
}

/** Quem enviou apaga (enquanto em análise): o arquivo e o registro. */
export async function deleteMyDocument(docu) {
  if (storage) await deleteObject(storageRef(storage, docu.storage_path)).catch(() => undefined);
  await deleteDoc(doc(db, C.documents, docu.id));
}

/** A secretaria aceita ou recusa (com motivo). Avisa quem enviou. */
export async function reviewDocument(docu, action, { uid, reason = '' } = {}) {
  const status = action === 'approve' ? 'approved' : 'rejected';
  const motivo = String(reason || '').trim().slice(0, 500);
  if (status === 'rejected' && motivo.length < 3) throw new FederationError(t('Diga o motivo (mínimo 3 caracteres).'));
  await updateDoc(doc(db, C.documents, docu.id), { status, review: { by: uid || null, at_ms: Date.now(), reason: motivo }, updated_at: serverTimestamp() });
  await createAuditLog({ action: `federation_document_${action}`, actor: { uid }, userId: docu.user_id, details: { federation_id: docu.federation_id, member_id: docu.member_id, kind: docu.kind, reason: motivo } });
  await notifyUsers([docu.user_id], {
    type: NOTIFICATION_TYPE.FEDERATION, title: status === 'approved' ? t('Documento aceito') : t('Documento recusado'),
    message: status === 'approved' ? t('A federação aceitou o documento enviado.') : t('A federação recusou o documento enviado. Motivo: {motivo}. Envie outro.', { motivo }),
    link: '/perfil?secao=federacoes', actor: { uid },
  }).catch(() => 0);
  return status;
}

/** As regras da federação (CPF, carência e prazo das transferências) — permissão `admin`. */
export async function updateFederationRules(fedId, input, { uid } = {}) {
  const value = normalizeFederationRules(input);
  await updateDoc(doc(db, C.federations, fedId), { rules: value, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'federation_rules_update', actor: { uid }, details: { federation_id: fedId, ...value } });
  return value;
}

/* ================================================= PR 3: transferências ================================================= */

/** As transferências da pessoa (as dela e as dos dependentes). */
export async function listMyTransfers(uid) {
  if (!uid) return [];
  const [minhas, deps] = await Promise.all([
    getDocs(query(collection(db, C.transfers), where('user_id', '==', uid))),
    getDocs(query(collection(db, C.transfers), where('guardian_uid', '==', uid))),
  ]);
  const vistos = new Set();
  return [...minhas.docs, ...deps.docs].filter((d) => !vistos.has(d.id) && vistos.add(d.id)).map(toDoc);
}

/** As transferências pedidas NESTA federação (secretaria). */
export async function listFederationTransfers(fedId) {
  return (await getDocs(query(collection(db, C.transfers), where('federation_id', '==', fedId)))).docs.map(toDoc);
}

/** As trocas de federação em que esta é o DESTINO (a secretaria acompanha quem está chegando). */
export async function listIncomingTransfers(fedId) {
  return (await getDocs(query(collection(db, C.transfers), where('to_federation_id', '==', fedId)))).docs.map(toDoc);
}

/** Os relatórios das importações (e-mails pendentes de conta). */
export async function listFederationImports(fedId) {
  return (await getDocs(query(collection(db, C.imports), where('federation_id', '==', fedId)))).docs.map(toDoc);
}

/* ======================================================= PR 3: cursos ======================================================= */

/** Todos os cursos da federação, rascunhos inclusive (equipe `courses`/`admin`). */
export async function listFederationCourses(fedId) {
  return (await getDocs(query(collection(db, C.courses), where('federation_id', '==', fedId)))).docs.map(toDoc);
}

/** Os cursos que o público vê: tudo menos rascunho (a regra só deixa listar o que não é rascunho). */
export async function listPublicCourses(fedId) {
  if (!fedId) return [];
  const q = query(collection(db, C.courses), where('federation_id', '==', fedId), where('status', 'in', ['open', 'closed', 'done', 'cancelled']));
  return (await getDocs(q)).docs.map(toDoc);
}

export async function saveCourse(federation, input, { uid, courseId = null } = {}) {
  if (!fedModuleOn(federation, 'courses')) throw new FederationError(t('Esta federação não tem o módulo de cursos ligado.'));
  const r = validateCourseInput(input);
  if (!r.ok) throw new FederationError(t('Confira os campos destacados.'), r.errors);
  const data = { ...r.value, federation_id: federation.id, federation_acronym: federation.acronym || '', updated_at: serverTimestamp(), updated_by: uid || null };
  if (courseId) {
    await updateDoc(doc(db, C.courses, courseId), data);
  } else {
    const ref = await addDoc(collection(db, C.courses), { ...data, enrolled_count: 0, created_by: uid || null, created_at: serverTimestamp(), created_at_ms: Date.now() });
    courseId = ref.id;
  }
  await createAuditLog({ action: 'federation_course_save', actor: { uid }, details: { federation_id: federation.id, course_id: courseId, name: data.name, status: data.status } });
  return { id: courseId, ...data };
}

/** Curso sem inscrito se apaga (permissão `admin`); com inscrito, cancele. */
export async function deleteCourse(course, { uid } = {}) {
  if (Number(course.enrolled_count) > 0) throw new FederationError(t('Este curso tem inscritos: cancele em vez de apagar.'));
  await deleteDoc(doc(db, C.courses, course.id));
  await createAuditLog({ action: 'federation_course_delete', actor: { uid }, details: { federation_id: course.federation_id, course_id: course.id } });
}

/** Os inscritos de um curso (equipe). As duas igualdades deixam a regra provável. */
export async function listCourseEnrollments(courseId, fedId) {
  if (!courseId || !fedId) return [];
  return (await getDocs(query(collection(db, C.enrollments), where('course_id', '==', courseId), where('federation_id', '==', fedId)))).docs.map(toDoc);
}

/** As inscrições em curso da pessoa. */
export async function listMyEnrollments(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, C.enrollments), where('user_id', '==', uid)))).docs.map(toDoc);
}

export async function listMyCredentials(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, C.credentials), where('user_id', '==', uid)))).docs.map(toDoc);
}

/** Todas as credenciais emitidas pela federação (equipe). */
export async function listFederationCredentials(fedId) {
  return (await getDocs(query(collection(db, C.credentials), where('federation_id', '==', fedId)))).docs.map(toDoc);
}

/** O diretório PÚBLICO de credenciados: só quem marcou `public`, válidas. */
export async function listPublicCredentials(fedId) {
  if (!fedId) return [];
  const q = query(collection(db, C.credentials), where('federation_id', '==', fedId), where('public', '==', true), where('status', '==', 'active'));
  return (await getDocs(q)).docs.map(toDoc);
}

/** A pessoa escolhe se a credencial aparece no diretório público (e com foto). */
export async function setCredentialPublic(credId, prefs = {}) {
  const patch = {};
  ['public', 'public_photo'].forEach((k) => { if (typeof prefs[k] === 'boolean') patch[k] = prefs[k]; });
  if (!Object.keys(patch).length) return;
  await updateDoc(doc(db, C.credentials, credId), { ...patch, prefs_updated_at: serverTimestamp() });
}

/** Cursos/admin revoga (com motivo) ou devolve uma credencial. */
export async function reviewCredential(cred, action, { uid, reason = '' } = {}) {
  const status = action === 'revoke' ? 'revoked' : 'active';
  const motivo = String(reason || '').trim().slice(0, 500);
  if (status === 'revoked' && motivo.length < 3) throw new FederationError(t('Diga o motivo (mínimo 3 caracteres).'));
  await updateDoc(doc(db, C.credentials, cred.id), { status, review: status === 'revoked' ? { by: uid || null, at_ms: Date.now(), reason: motivo } : null, updated_at: serverTimestamp() });
  await createAuditLog({ action: `federation_credential_${action}`, actor: { uid }, userId: cred.user_id, details: { federation_id: cred.federation_id, credential_id: cred.id, reason: motivo } });
  if (status === 'revoked') {
    await notifyUsers([cred.user_id], {
      type: NOTIFICATION_TYPE.FEDERATION, title: t('Credencial revogada — {sigla}', { sigla: cred.federation_acronym || '' }),
      message: t('A credencial "{curso}" foi revogada. Motivo: {motivo}', { curso: cred.course_name || '', motivo }), link: '/perfil?secao=federacoes', actor: { uid },
    }).catch(() => 0);
  }
  return status;
}

/* ================================================= PR 3: disciplina e ouvidoria ================================================= */

/** As sanções da pessoa (e dos dependentes) — só ela vê (D11). */
export async function listMySanctions(uid) {
  if (!uid) return [];
  const [minhas, deps] = await Promise.all([
    getDocs(query(collection(db, C.sanctions), where('user_id', '==', uid))),
    getDocs(query(collection(db, C.sanctions), where('guardian_uid', '==', uid))),
  ]);
  const vistos = new Set();
  return [...minhas.docs, ...deps.docs].filter((d) => !vistos.has(d.id) && vistos.add(d.id)).map(toDoc);
}

export async function listFederationSanctions(fedId) {
  return (await getDocs(query(collection(db, C.sanctions), where('federation_id', '==', fedId)))).docs.map(toDoc);
}

/**
 * Abre uma manifestação na ouvidoria. Anônima NÃO grava quem enviou (nem o
 * servidor sabe); o protocolo é o id do documento, e é com ele que a pessoa
 * acompanha. Avisa a disciplina da federação.
 */
export async function createReport({ federation, uid, input }) {
  if (!fedModuleOn(federation, 'discipline')) throw new FederationError(t('Esta federação não tem ouvidoria ligada.'));
  const r = validateReportInput(input);
  if (!r.ok) throw new FederationError(t('Confira os campos destacados.'), r.errors);
  const data = {
    federation_id: federation.id, federation_acronym: federation.acronym || '', kind: r.value.kind, body: r.value.body, tournament_name: r.value.tournament_name,
    anonymous: r.value.anonymous, reporter_uid: r.value.anonymous ? null : uid, status: 'open', created_at: serverTimestamp(), created_at_ms: Date.now(), updated_at: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, C.reports), data);
  const equipe = await staffUidsWith(federation.id, FED_PERMISSION.DISCIPLINE).catch(() => []);
  await notifyUsers(equipe, {
    type: NOTIFICATION_TYPE.FEDERATION, title: t('Nova manifestação na ouvidoria'),
    message: t('Chegou uma manifestação à ouvidoria da {sigla}. Veja em Disciplina → Ouvidoria.', { sigla: federation.acronym || '' }),
    link: `/federacoes/${federation.id}/gerir?aba=ouvidoria`, actor: { uid },
  }).catch(() => 0);
  return { id: ref.id, ...data };
}

/** Pelo protocolo (o id): quem o tem acompanha — anônima qualquer conta, a identificada só quem enviou. */
export async function getReportById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, C.reports, id));
  return snap.exists() ? toDoc(snap) : null;
}

/** As manifestações identificadas da pessoa (exportação e Minha área). */
export async function listMyReports(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, C.reports), where('reporter_uid', '==', uid)))).docs.map(toDoc);
}

export async function listFederationReports(fedId) {
  return (await getDocs(query(collection(db, C.reports), where('federation_id', '==', fedId)))).docs.map(toDoc);
}

/** A disciplina muda o estado e anota (as anotações só a equipe lê — quem enviou vê só o estado). */
export async function updateReport(rep, { status, notes, uid } = {}) {
  const patch = { updated_at: serverTimestamp(), handled_by: uid || null };
  if (['open', 'in_review', 'closed'].includes(status)) patch.status = status;
  if (typeof notes === 'string') patch.notes = notes.trim().slice(0, 2000);
  await updateDoc(doc(db, C.reports, rep.id), patch);
  await createAuditLog({ action: 'federation_report_update', actor: { uid }, details: { federation_id: rep.federation_id, report_id: rep.id, status: patch.status || rep.status } });
}
