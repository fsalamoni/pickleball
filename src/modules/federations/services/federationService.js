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
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  AFFILIATION_STATUS, FED_COLLECTIONS as C, FED_PERMISSION, FEDERATION_STATUS, RESULT_STATUS, STAFF_ROLE, fedOrgDocId, fedRankingDocId, fedResultDocId, fedUserDocId,
} from '../domain/constants.js';
import { affiliationDecision, affiliationState, buildAffiliationRequest } from '../domain/affiliations.js';
import { SANCTION_WITHDRAW_PATCH, buildSanctionRequest, sanctionDecision, sanctionState } from '../domain/sanction.js';
import { normalizeRankingConfig, resultSeason, tournamentDay } from '../domain/officialRanking.js';
import { permissionsOf } from '../domain/staff.js';
import { modalityPlacement, registrationAllPeople } from '@/modules/tournament/domain/podium.js';
import { fedModuleOn, normalizeFederationBranding, normalizeModules, validateFederationInput, validateFederationPayment, validateFederationPublicInput } from '../domain/federation.js';
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
