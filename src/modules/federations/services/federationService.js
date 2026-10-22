/**
 * FEDERAÇÕES — leitura e escrita direta no Firestore (federação, planos,
 * preferências do filiado, declaração de pagamento) e as chamadas ao
 * servidor (`federationReview`, `federationMembership`, `federationStaff`,
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
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, limit, writeBatch,
} from 'firebase/firestore';
import { deleteObject, ref as storageRef, uploadBytes, uploadBytesResumable } from 'firebase/storage';
import { db, functions, storage } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { t } from '@/core/i18n';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  AFFILIATION_STATUS, FED_COLLECTIONS as C, FED_PERMISSION, FEDERATION_STATUS, NEWS_AUDIENCE, NEWS_STATUS, RESULT_STATUS, fedRankingDocId, fedResultDocId, fedUserDocId,
} from '../domain/constants.js';
import { isoDate } from '../domain/membership.js';
import { affiliationAcceptPatch, affiliationDecision, affiliationState, buildAffiliationInvite, buildAffiliationRequest, canInviteOrg } from '../domain/affiliations.js';
import { SANCTION_ORIGIN, SANCTION_WITHDRAW_PATCH, buildSanctionRequest, sanctionDecision, sanctionState } from '../domain/sanction.js';
import { normalizeRankingConfig, resultSeason, seasonClosed, seasonLastDay, tournamentDay, validateTiers } from '../domain/officialRanking.js';
import { staffPerms } from '../domain/staff.js';
import { modalityPlacement, registrationAllPeople } from '@/modules/tournament/domain/podium.js';
import { availableModules, fedModuleOn, isFederationPublic, normalizeFederationBranding, normalizeFederationRules, normalizeModules, validateFederationInput, validateFederationPayment, validateFederationPublicInput } from '../domain/federation.js';
import { docLabel, documentStoragePath, validateDocumentFile } from '../domain/privateData.js';
import { validateCourseInput } from '../domain/courses.js';
import { validateReportInput } from '../domain/discipline.js';
import { validateNewsInput } from '../domain/news.js';
import { validateSponsors } from '../domain/sponsors.js';
import { validateGovernance } from '../domain/governance.js';
import { DOC_STATUS, DOC_VISIBILITY, acervoUploadPath, validateAcervoFile } from '../domain/acervo.js';
import { validatePlanInput } from '../domain/plans.js';
import { validateMemberTypes } from '../domain/memberTypes.js';
import { normalizeDefaultModules, validateDocKinds, validateTierTemplates } from '../domain/platformCatalog.js';
import { canDeclarePayment } from '../domain/charges.js';

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

export async function chamar(nome, payload, { timeout = 60_000 } = {}) {
  if (!functions) throw new Error(t('Firebase não está configurado neste ambiente.'));
  try {
    const { data } = await httpsCallable(functions, nome, { timeout })(payload);
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
  try {
    const snap = await getDoc(doc(db, C.federations, id));
    return snap.exists() ? toDoc(snap) : null;
  } catch (e) {
    // Oculta (ainda não publicada), pendente ou suspensa: a regra recusa a
    // leitura a quem não é dela — para a tela é "indisponível", não "falhou".
    if (e?.code === 'permission-denied') return null;
    throw e;
  }
}

/** Pela URL pública. Só a PUBLICADA (aprovada + aberta pelo admin dela) tem página. */
export async function getFederationBySlug(slug) {
  const s = String(slug || '').toLowerCase();
  if (!s) return null;
  const q = query(collection(db, C.federations), where('slug', '==', s), where('status', '==', FEDERATION_STATUS.APPROVED), where('published', '==', true), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : toDoc(snap.docs[0]);
}

/**
 * O diretório: as publicadas (aprovadas pela plataforma e abertas pelo admin
 * dela). Duas igualdades — a regra é provável e não pede índice composto.
 * Filtro de região e ordenação ficam na tela.
 */
export async function listPublicFederations() {
  const q = query(collection(db, C.federations), where('status', '==', FEDERATION_STATUS.APPROVED), where('published', '==', true));
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

/**
 * O endereço já é de uma federação PUBLICADA? Só as publicadas são legíveis
 * por todo mundo, e a consulta precisa ser provável pela regra: sem os filtros
 * de `status` e `published` o Firestore a recusava e a conferência "passava"
 * em silêncio. A colisão com uma aprovada ainda oculta (ou um pedido pendente)
 * é conferida pelo SERVIDOR na aprovação, e de novo aqui ao publicar.
 */
async function slugEmUso(slug, ignorarId = null) {
  const q = query(collection(db, C.federations), where('slug', '==', slug), where('status', '==', FEDERATION_STATUS.APPROVED), where('published', '==', true), limit(5));
  const snap = await getDocs(q);
  return snap.docs.some((d) => d.id !== ignorarId);
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

/**
 * Publicar (abrir ao público) ou tirar do ar. Só o admin da federação, e só a
 * aprovada (a regra confere). Ao publicar, o endereço não pode estar em uso
 * por outra federação já publicada.
 */
export async function setFederationPublished(federation, published, { uid } = {}) {
  if (!federation?.id) throw new FederationError(t('Federação não encontrada.'));
  if (federation.status !== FEDERATION_STATUS.APPROVED) throw new FederationError(t('A federação precisa estar aprovada pela plataforma para ser publicada.'));
  const abrir = Boolean(published);
  if (abrir && federation.slug && (await slugEmUso(federation.slug, federation.id))) {
    throw new FederationError(t('O endereço desta federação já está em uso por outra federação publicada. Troque o endereço em Página antes de publicar.'));
  }
  const patch = abrir
    ? { published: true, published_at: serverTimestamp(), published_by: uid || null, updated_at: serverTimestamp() }
    : { published: false, unpublished_at: serverTimestamp(), unpublished_by: uid || null, updated_at: serverTimestamp() };
  await updateDoc(doc(db, C.federations, federation.id), patch);
  await createAuditLog({ action: abrir ? 'federation_publish' : 'federation_unpublish', actor: { uid }, details: { federation_id: federation.id, slug: federation.slug || '' } });
}

/**
 * Liga ou desliga UM módulo da federação. Grava só o campo dele
 * (`modules.<id>`): com o mapa inteiro, dois toques seguidos antes da
 * releitura faziam o segundo gravar o mapa antigo e desligar o primeiro.
 */
export async function setFederationModule(id, moduleId, on, { uid } = {}) {
  if (!availableModules().includes(moduleId)) throw new Error(t('Este módulo ainda não pode ser ligado.'));
  const valor = on === true;
  await updateDoc(doc(db, C.federations, id), { [`modules.${moduleId}`]: valor, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'federation_modules_update', actor: { uid }, details: { federation_id: id, module: moduleId, on: valor } });
  return valor;
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
 * Equipe: cargos, nomeações, mandatos e admins master — SÓ pelo servidor
 * (`federationStaff`), que confere quem pode e que sempre sobra um admin
 * master. Ações: `role_save` (`role`), `role_delete` (`roleId`), `appoint`
 * (`userId`, `roleId`, `termStart`, `termEnd`), `extend` (`userId`,
 * `termEnd`, `reason`, `act`), `remove` (`userId`, `reason`) e `transfer`
 * (`userId`, `roleId`, `leave`).
 */
export const staffAction = (federationId, action, payload = {}) => chamar('federationStaff', { federationId, action, ...payload });

/**
 * Admin da plataforma: abre (`grant`, com motivo e horas) ou encerra (`end`)
 * o acesso a uma federação. O motivo vai para o registro interno da
 * plataforma (`admin_access_logs`).
 */
export const federationAdminAccess = (federationId, action, payload = {}) => chamar('federationAdminAccess', { federationId, action, ...payload });

/** O acesso de suporte do admin a esta federação (ou nulo). */
export async function getMyFederationGrant(fedId, uid) {
  if (!fedId || !uid) return null;
  const snap = await getDoc(doc(db, C.adminGrants, fedUserDocId(fedId, uid)));
  return snap.exists() ? toDoc(snap) : null;
}

/** Admin da plataforma: os acessos às federações (o registro interno), mais recentes primeiro. */
export async function listFederationAccessLogs() {
  const q = query(collection(db, 'admin_access_logs'), where('action', '==', 'federation_access'), limit(200));
  return (await getDocs(q)).docs.map(toDoc).sort((a, b) => (b.at_ms || 0) - (a.at_ms || 0));
}

/* -------------------------------------------------------------- planos -- */

export async function listFederationPlans(fedId) {
  const q = query(collection(db, C.plans), where('federation_id', '==', fedId));
  return (await getDocs(q)).docs.map(toDoc);
}

export async function savePlan(fedId, input, { uid, planId = null, catalog, currentType = null } = {}) {
  const r = validatePlanInput(input, catalog ? { catalog, currentType } : { currentType });
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

/* ------------------------------------------- configuração da plataforma -- */

/** `platform_settings/federations` (legível por todos): o catálogo de tipos de filiação. */
export async function getFederationPlatformSettings() {
  const snap = await getDoc(doc(db, 'platform_settings', 'federations'));
  return snap.exists() ? snap.data() : {};
}

/** Só o admin da plataforma grava (regra). O tipo nativo nunca sai; o rótulo vazio volta ao padrão. */
export async function saveFederationMemberTypes(list, { uid } = {}) {
  const r = validateMemberTypes(list);
  if (!r.ok) throw new FederationError(t('Confira os campos destacados.'), r.errors);
  await setDoc(doc(db, 'platform_settings', 'federations'), { member_types: r.value, updated_at: serverTimestamp(), updated_by: uid || null }, { merge: true });
  await createAuditLog({ action: 'federation_member_types_save', actor: { uid }, details: { count: r.value.length } });
  return r.value;
}

/**
 * As outras partes da configuração geral (Etapa 5): documentos sugeridos,
 * modelos de categorias de torneio e módulos que nascem ligados. Cada uma
 * grava só a sua chave, validada pela mesma régua da tela.
 */
const CATALOGO = {
  doc_kinds: { validar: validateDocKinds, acao: 'federation_doc_kinds_save' },
  tournament_tier_templates: { validar: validateTierTemplates, acao: 'federation_tier_templates_save' },
  default_modules: { validar: (raw) => ({ ok: true, errors: {}, value: normalizeDefaultModules(raw) }), acao: 'federation_default_modules_save' },
};

export async function saveFederationPlatformCatalog(key, input, { uid } = {}) {
  const c = CATALOGO[key];
  if (!c) throw new FederationError(t('Configuração desconhecida.'));
  const r = c.validar(input);
  if (!r.ok) throw new FederationError(r.errors.list || t('Confira os campos destacados.'), r.errors);
  await setDoc(doc(db, 'platform_settings', 'federations'), { [key]: r.value, updated_at: serverTimestamp(), updated_by: uid || null }, { merge: true });
  await createAuditLog({ action: c.acao, actor: { uid }, details: { count: Array.isArray(r.value) ? r.value.length : Object.values(r.value).filter(Boolean).length } });
  return r.value;
}

/* ------------------------------------------------------------ filiados -- */

/** As filiações POR PLANO de um clube/arena, em todas as federações (quem gere a entidade lê). */
export async function listOrgMemberships(kind, orgId) {
  if (!kind || !orgId) return [];
  const q = query(collection(db, C.members), where('org_kind', '==', kind), where('org_id', '==', orgId));
  return (await getDocs(q)).docs.map(toDoc);
}

/** Os documentos enviados por um clube/arena filiado (todos os gestores veem). */
export async function listOrgDocuments(kind, orgId) {
  if (!kind || !orgId) return [];
  const q = query(collection(db, C.documents), where('org_kind', '==', kind), where('org_id', '==', orgId));
  return (await getDocs(q)).docs.map(toDoc);
}

export async function getMembership(fedId, uid) {
  if (!fedId || !uid) return null;
  const snap = await getDoc(doc(db, C.members, fedUserDocId(fedId, uid)));
  return snap.exists() ? toDoc(snap) : null;
}

/** As filiações da pessoa, em todas as federações. */
/** Os convites para filiar desta federação (a secretaria). */
export async function listFederationInvites(fedId) {
  const q = query(collection(db, C.invites), where('federation_id', '==', fedId));
  return (await getDocs(q)).docs.map(toDoc).sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
}

/** Os convites que a pessoa recebeu (todas as federações). */
export async function listMyFederationInvites(uid) {
  if (!uid) return [];
  const q = query(collection(db, C.invites), where('user_id', '==', uid));
  return (await getDocs(q)).docs.map(toDoc);
}

/** O cadastro da pessoa nos quadros de arbitragem (todas as federações) — Minha área e exportação. */
export async function listMyRefereeRosters(uid) {
  if (!uid) return [];
  const q = query(collection(db, C.referees), where('user_id', '==', uid));
  return (await getDocs(q)).docs.map(toDoc);
}

/** As escalas de arbitragem da pessoa (todas as federações) — Minha área e exportação. */
export async function listMyAssignments(uid) {
  if (!uid) return [];
  const q = query(collection(db, C.assignments), where('referee_uid', '==', uid));
  return (await getDocs(q)).docs.map(toDoc);
}

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

/* ------------------------------------------- a PASTA do filiado (Etapa 3) -- */
// Cada leitura filtra pela FEDERAÇÃO (é o campo que a regra confere na equipe)
// e pela pessoa ou filiação — duas igualdades, sem índice composto.

const daFederacao = (col, fedId, campo, valor) => (fedId && valor
  ? getDocs(query(collection(db, col), where('federation_id', '==', fedId), where(campo, '==', valor))).then((s) => s.docs.map(toDoc))
  : Promise.resolve([]));

/** As cobranças de uma filiação (filiação, cursos, multas) — financeiro, secretaria, conselho fiscal e admin. */
export const listMemberCharges = (fedId, memberId) => daFederacao(C.charges, fedId, 'member_id', memberId);
/** As sanções de uma filiação — disciplina e admin. */
export const listMemberSanctions = (fedId, memberId) => daFederacao(C.sanctions, fedId, 'member_id', memberId);
/** As inscrições em curso da pessoa aqui — cursos, financeiro e admin. */
export const listPersonEnrollments = (fedId, uid) => daFederacao(C.enrollments, fedId, 'user_id', uid);
/** As credenciais da pessoa aqui — cursos e admin. */
export const listPersonCredentials = (fedId, uid) => daFederacao(C.credentials, fedId, 'user_id', uid);
/** Os lançamentos de pontos da pessoa no ranking oficial daqui (leitura pública). */
export const listPersonPoints = (fedId, uid) => daFederacao(C.points, fedId, 'uid', uid);

/**
 * As pessoas da entidade: os membros do clube (com o papel) ou os gestores da
 * arena. As duas coleções têm leitura aberta à conta logada.
 */
export async function listOrgPeople(kind, orgId) {
  if (!orgId || !['club', 'arena'].includes(kind)) return [];
  const q = kind === 'club'
    ? query(collection(db, 'club_members'), where('club_id', '==', orgId))
    : query(collection(db, 'arena_managers'), where('arena_id', '==', orgId));
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
export async function declarePayment(charge, { note = '', file = null, uid = null } = {}) {
  if (!canDeclarePayment(charge)) throw new FederationError(t('Esta cobrança não está mais em aberto.'));
  const dados = { status: 'declared', declared_at: serverTimestamp(), declared_note: String(note || '').trim().slice(0, 300) };
  // O comprovante (opcional) vai para a pasta de QUEM PAGA — só ele lê no Storage; o financeiro o abre pelo servidor (auditado).
  if (file) {
    const erro = validateDocumentFile(file);
    if (erro) throw new FederationError(erro, { file: erro });
    if (!storage || !uid) throw new FederationError(t('Firebase não está configurado neste ambiente.'));
    const path = documentStoragePath(uid, doc(collection(db, C.charges)).id, file.type);
    await uploadBytes(storageRef(storage, path), file, { contentType: file.type });
    dados.declared_proof = { path, name: String(file.name || '').slice(0, 120), content_type: file.type, size: Number(file.size) || 0 };
  }
  await updateDoc(doc(db, C.charges, charge.id), dados);
}

/** O comprovante do "Já paguei", pelo servidor (quem paga e o financeiro/secretaria). */
export const fetchChargeProof = (chargeId) => chamar('federationDocument', { chargeId });

/* ------------------------------------------- avisos à equipe (cliente) -- */

/** Os uids da equipe com a permissão (para avisar quem pode resolver). */
async function staffUidsWith(fedId, perm) {
  const equipe = await listFederationStaff(fedId);
  return equipe.filter((s) => staffPerms(s).includes(perm) || staffPerms(s).includes(FED_PERMISSION.ADMIN)).map((s) => s.user_id);
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
    message: kind === 'club' ? t('O clube {org} pediu filiação à {sigla}. Analise em Filiados e cadastrados → Vínculos de clubes e arenas.', { org: data.org_name, sigla: data.federation_acronym }) : t('A arena {org} pediu filiação à {sigla}. Analise em Filiados e cadastrados → Vínculos de clubes e arenas.', { org: data.org_name, sigla: data.federation_acronym }),
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

/** Quem gere a organização (para o aviso do convite): admins do clube ou gestores da arena. */
async function orgManagerUids(kind, orgId) {
  const q = kind === 'club'
    ? query(collection(db, 'club_members'), where('club_id', '==', orgId), where('role', '==', 'admin'))
    : query(collection(db, 'arena_managers'), where('arena_id', '==', orgId));
  return [...new Set((await getDocs(q)).docs.map((d) => d.data().user_id).filter(Boolean))];
}

const linkDaOrg = (kind, orgId) => (kind === 'club' ? `/clubes/${orgId}?tab=admin` : `/arenas/${orgId}/gerir?aba=federacao`);

/**
 * A FEDERAÇÃO convida um clube/arena (equipe com `members` ou `admin`). Não
 * filia: quem gere a organização aceita ou recusa. Recusado antes pode ser
 * convidado de novo (o documento antigo sai).
 */
export async function inviteAffiliation({ federation, kind, org, uid, message = '' }) {
  if (!fedModuleOn(federation, 'affiliations')) throw new FederationError(t('Ligue o módulo "Clubes e arenas filiados" para convidar.'));
  const { id, data } = buildAffiliationInvite({ federation, kind, org, uid, message });
  const ref = doc(db, C.affiliations, id);
  const atual = await getDoc(ref);
  if (atual.exists()) {
    if (!canInviteOrg(atual.data())) throw new FederationError(t('Esta organização já é filiada, já pediu ou já tem convite.'));
    await deleteDoc(ref);
  }
  await setDoc(ref, { ...data, invited_at: serverTimestamp(), updated_at: serverTimestamp() });
  await createAuditLog({ action: 'federation_affiliation_invite', actor: { uid }, details: { federation_id: federation.id, kind, org_id: org.id } });
  const gestores = await orgManagerUids(kind, org.id).catch(() => []);
  await notifyUsers(gestores, {
    type: NOTIFICATION_TYPE.FEDERATION,
    title: t('A {sigla} convidou {org} para se filiar', { sigla: data.federation_acronym || data.federation_name, org: data.org_name }),
    message: kind === 'club' ? t('Aceite ou recuse em Gestão do clube → Federação. Aceito, o clube vira filiado na hora.') : t('Aceite ou recuse na Central da arena → Equipe e parceiros → Federação. Aceito, a arena vira filiada na hora.'),
    link: linkDaOrg(kind, org.id),
    actor: { uid },
  }).catch(() => 0);
  return { id, ...data };
}

/** A equipe cancela o convite ainda não respondido. */
export async function cancelAffiliationInvite(affiliation, { uid } = {}) {
  await deleteDoc(doc(db, C.affiliations, affiliation.id));
  await createAuditLog({ action: 'federation_affiliation_invite_cancel', actor: { uid }, details: { federation_id: affiliation.federation_id, kind: affiliation.kind, org_id: affiliation.org_id } });
}

/** Quem gere a organização responde ao convite: aceitar filia na hora; recusar apaga o convite. */
export async function answerAffiliationInvite(affiliation, accept, { uid } = {}) {
  const ref = doc(db, C.affiliations, affiliation.id);
  if (accept) await updateDoc(ref, { ...affiliationAcceptPatch(uid), updated_at: serverTimestamp() });
  else await deleteDoc(ref);
  await createAuditLog({ action: accept ? 'federation_affiliation_invite_accept' : 'federation_affiliation_invite_decline', actor: { uid }, details: { federation_id: affiliation.federation_id, kind: affiliation.kind, org_id: affiliation.org_id } });
  const equipe = await staffUidsWith(affiliation.federation_id, FED_PERMISSION.MEMBERS).catch(() => []);
  await notifyUsers(equipe.filter((x) => x !== uid), {
    type: NOTIFICATION_TYPE.FEDERATION,
    title: accept ? t('{org} aceitou o convite', { org: affiliation.org_name }) : t('{org} recusou o convite', { org: affiliation.org_name }),
    message: accept ? t('{org} agora é filiado à {sigla}. O selo já aparece na página.', { org: affiliation.org_name, sigla: affiliation.federation_acronym }) : t('O convite de filiação foi recusado. Dá para convidar de novo depois.'),
    link: `/federacoes/${affiliation.federation_id}/gerir?aba=filiados-orgs`,
    actor: { uid },
  }).catch(() => 0);
}

/* ------------------------------------------------- chancela de torneios -- */

/**
 * Os torneios (não arquivados) ligados à federação — pendentes e chancelados;
 * a tela separa. O arquivado sai em memória: 🐞 a consulta pedia
 * `archived == false`, e torneio nasce SEM o campo — nenhum pedido novo
 * chegava a Chancelas nem à página da federação.
 */
export async function listFederationTournaments(fedId) {
  const q = query(collection(db, 'tournaments'), where('federation_id', '==', fedId));
  return (await getDocs(q)).docs.map(toDoc).filter((tt) => tt.archived !== true);
}

/** O organizador PEDE a chancela (o patch que a regra aceita: pendente, por quem pede). */
export async function requestSanction(tournament, { federation, uid, tier, requiresMembership, silent = false }) {
  if (!fedModuleOn(federation, 'tournaments')) throw new FederationError(t('Esta federação ainda não chancela torneios.'));
  // A regra só aceita o pedido a federação PÚBLICA (§17): dizer o porquê em vez de "permissão negada".
  if (!isFederationPublic(federation)) throw new FederationError(t('A federação ainda não está pública. Torne-a pública em Página pública → Publicação para receber ou criar torneios.'));
  const st = sanctionState(tournament);
  if (!st.canRequest) throw new FederationError(st.pending ? t('A chancela já foi pedida e aguarda a federação.') : t('Este torneio já é chancelado.'));
  const patch = buildSanctionRequest({ federation, uid, tier, requiresMembership });
  await updateDoc(doc(db, 'tournaments', tournament.id), { ...patch, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'tournament_sanction_request', actor: { uid }, tournamentId: tournament.id, details: { federation_id: federation.id, tier: patch.federation_sanction.tier } });
  if (silent) return patch;
  const equipe = await staffUidsWith(federation.id, FED_PERMISSION.COMPETITIONS).catch(() => []);
  await notifyUsers(equipe, {
    type: NOTIFICATION_TYPE.FEDERATION, title: t('Pedido de chancela: {torneio}', { torneio: tournament.name }),
    message: t('O torneio {torneio} pediu a chancela da {sigla}. Analise em Competições → Chancelas.', { torneio: tournament.name, sigla: patch.federation_sanction.federation_acronym }),
    link: `/federacoes/${federation.id}/gerir?aba=chancelas`, actor: { uid },
  }).catch(() => 0);
  return patch;
}

/**
 * Torneio REALIZADO pela federação: quem é de competições cria o torneio
 * (`/torneios/criar?federacao=`) e ele sai já chancelado, com a categoria e a
 * origem `federation`. Dois passos que a regra já aceita, sem regra nova: o
 * pedido (como qualquer organizador, sem avisar a equipe) e a aprovação (como
 * competições). Falhando a aprovação, o pedido fica na fila de Chancelas.
 */
export async function startFederationTournament(tournament, { federation, uid, tier, requiresMembership = false }) {
  const pedido = await requestSanction(tournament, { federation, uid, tier, requiresMembership, silent: true });
  return decideSanction({ ...tournament, ...pedido }, 'approve', { uid, tier, requiresMembership, federation, origin: SANCTION_ORIGIN.FEDERATION });
}

/** O organizador retira o pedido pendente (o torneio volta a ser sem federação). */
export async function withdrawSanction(tournament, { uid } = {}) {
  if (!sanctionState(tournament).canWithdraw) throw new FederationError(t('Só um pedido pendente pode ser retirado.'));
  await updateDoc(doc(db, 'tournaments', tournament.id), { ...SANCTION_WITHDRAW_PATCH, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'tournament_sanction_withdraw', actor: { uid }, tournamentId: tournament.id, details: { federation_id: tournament.federation_id } });
}

/**
 * Competições decide: aprovar (com a categoria da federação, quem realiza e a
 * exigência de filiação), recusar, revogar. Avisa quem pediu. `federation` é
 * a federação carregada: é dela que saem as categorias que valem.
 */
export async function decideSanction(tournament, action, { uid, reason = '', tier = null, requiresMembership = null, federation = null, origin = null } = {}) {
  const patch = sanctionDecision(tournament, action, { uid, reason, tier, requiresMembership, federation, origin });
  await updateDoc(doc(db, 'tournaments', tournament.id), { ...patch, updated_at: serverTimestamp() });
  // Revogada a chancela, o que já foi enviado ao ranking oficial sai dele (o gatilho refaz a temporada).
  if (action === 'revoke') {
    const enviados = await getDocs(query(collection(db, C.results), where('federation_id', '==', tournament.federation_id), where('tournament_id', '==', tournament.id)));
    const lote = writeBatch(db);
    // Ano já fechado é imutável (a regra recusaria e derrubaria o lote inteiro): o ponto daquele ano fica.
    enviados.docs.filter((d) => d.data().status === RESULT_STATUS.SENT && !seasonClosed(d.data().season)).forEach((d) => lote.update(d.ref, { status: RESULT_STATUS.REJECTED, review: { by: uid, reason: patch.federation_sanction.reason || t('Chancela revogada'), at_ms: Date.now() }, updated_at: serverTimestamp() }));
    await lote.commit();
  }
  await createAuditLog({ action: `tournament_sanction_${action}`, actor: { uid }, tournamentId: tournament.id, details: { federation_id: tournament.federation_id, reason: patch.federation_sanction.reason, tier: patch.federation_sanction.tier, origin: patch.federation_sanction.origin } });
  // O torneio que a própria federação cria e aprova não avisa ninguém: quem decidiu é quem organiza.
  const destinoDaDecisao = [tournament.federation_sanction?.requested_by, tournament.creator_uid].filter((x) => x && x !== uid);
  if (!destinoDaDecisao.length) return patch;
  const sigla = patch.federation_sanction.federation_acronym || '';
  const textos = {
    approve: t('A {sigla} chancelou o torneio {torneio}. Ao fim de cada categoria, envie o resultado ao ranking oficial.', { sigla, torneio: tournament.name }),
    reject: t('A {sigla} recusou a chancela do torneio {torneio}. Motivo: {motivo}', { sigla, torneio: tournament.name, motivo: patch.federation_sanction.reason }),
    revoke: t('A {sigla} revogou a chancela do torneio {torneio}. Motivo: {motivo}', { sigla, torneio: tournament.name, motivo: patch.federation_sanction.reason }),
  };
  await notifyUsers([...new Set(destinoDaDecisao)], { type: NOTIFICATION_TYPE.FEDERATION, title: t('Chancela: {torneio}', { torneio: tournament.name }), message: textos[action], link: `/torneios/${tournament.id}`, actor: { uid } }).catch(() => 0);
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
 * Os LANÇAMENTOS de pontos da pessoa no ranking oficial, em todas as
 * federações e anos (até os cancelados, com o motivo). Só o servidor grava;
 * a leitura é pública, como o ranking.
 */
export async function listMyFederationPoints(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, C.points), where('uid', '==', uid)))).docs.map(toDoc);
}

/** Mensagem para quem tenta mexer num ano que já fechou. */
const anoFechado = (season) => t('A temporada {ano} do ranking oficial fechou em {data} e não muda mais.', { ano: season, data: seasonLastDay(season).split('-').reverse().join('/') });

/**
 * O organizador ENVIA (ou reenvia) o resultado de uma categoria ao ranking
 * oficial. A colocação sai de `modalityPlacement` — a MESMA conta do pódio e
 * dos cartões (`docs/43`). Só quem tem conta entra em `uids` (quem pontua).
 */
export async function sendFederationResult({ tournament, modality, matches, registrations, uid }) {
  const st = sanctionState(tournament);
  if (!st.approved) throw new FederationError(t('O torneio precisa da chancela aprovada para enviar resultados.'));
  // `allRounds`: no mata-mata quem caiu nas quartas é 5º, nas oitavas 9º… — a tabela da categoria pontua cada rodada.
  const colocacao = modalityPlacement({ modality, tournament, matches, allRounds: true });
  const rows = [];
  (registrations || []).forEach((reg) => {
    const c = colocacao.get(String(reg.id));
    if (!c || (c.position == null && c.played === 0)) return;
    registrationAllPeople(reg).forEach((p) => rows.push({ uid: p.user_id || null, name: String(p.name || '').slice(0, 120), photo_url: p.photo_url || null, position: c.position, played: c.played, won: c.won, registration_id: reg.id }));
  });
  if (!rows.length) throw new FederationError(t('Ainda não há resultado nesta categoria.'));
  rows.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  const id = fedResultDocId(st.federationId, tournament.id, modality.id);
  const season = resultSeason(tournament);
  if (seasonClosed(season)) throw new FederationError(anoFechado(season));
  // O ano de um resultado já enviado nunca muda (a regra recusa): mudou a data do torneio de ano, o envio antigo fica onde está.
  const anterior = await getDoc(doc(db, C.results, id));
  if (anterior.exists() && Number(anterior.data().season) !== season) {
    throw new FederationError(t('Este resultado já está no ranking de {ano}. A data do torneio mudou de ano: peça à federação para retirar o envio antes de mandar de novo.', { ano: anterior.data().season }));
  }
  const data = {
    federation_id: st.federationId, federation_acronym: st.acronym, tournament_id: tournament.id, tournament_name: String(tournament.name || '').slice(0, 120),
    modality_id: modality.id, modality_name: String(modality.name || '').slice(0, 120),
    gender_category: modality.gender_category || 'open', age_category: modality.age_category || 'open', format: modality.format || 'doubles',
    tier: st.tier, tier_label: st.tierShort, date: tournamentDay(tournament), season,
    rows: rows.slice(0, 400), uids: [...new Set(rows.slice(0, 400).map((r) => r.uid).filter(Boolean))],
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
  if (seasonClosed(result.season)) throw new FederationError(anoFechado(result.season));
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

/** A configuração do ranking (admin e competições). Vale para os próximos lançamentos; o ano aberto é somado de novo (o "melhores N"), o que já foi lançado e os anos fechados não mudam. */
export async function updateRankingConfig(fedId, input, { uid } = {}) {
  const cfg = normalizeRankingConfig(input);
  if (cfg.tiers_explicit) {
    const v = validateTiers(cfg.tiers);
    if (!v.ok) throw new FederationError(v.geral);
  }
  // Grava só as categorias PRÓPRIAS; as três de antes são derivadas na leitura (nunca viram cópia).
  const { tiers_explicit: proprias, tiers, ...regras } = cfg;
  const value = { ...regras, tiers: proprias ? tiers : [] };
  await updateDoc(doc(db, C.federations, fedId), { ranking_config: value, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'federation_ranking_config', actor: { uid }, details: { federation_id: fedId, ...regras, tiers: value.tiers.map((tt) => [tt.id, tt.code, tt.group, tt.points_by_place[1], tt.active].join('|')) } });
  return value;
}

/* ============================ PR 3: dados privados, dependentes, documentos ============================ */

/** As filiações dos DEPENDENTES que a pessoa filiou (menores, `user_id` nulo). */
export async function listMyDependents(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, C.members), where('guardian_uid', '==', uid)))).docs.map(toDoc);
}

/**
 * Os dados PRIVADOS das filiações da pessoa e dos dependentes dela
 * (`federation_members/{id}/private/data`: CPF, nascimento, responsável) —
 * para a exportação LGPD. O dono lê; só o servidor grava.
 */
export async function listMyMembersPrivate(uid) {
  if (!uid) return [];
  const [minhas, deps] = await Promise.all([listMyMemberships(uid), listMyDependents(uid)]);
  const lidos = await Promise.all([...minhas, ...deps].map(async (m) => {
    const snap = await getDoc(doc(db, C.members, m.id, 'private', 'data'));
    return snap.exists() ? { member_id: m.id, federation_id: m.federation_id, ...snap.data() } : null;
  }));
  return lidos.filter(Boolean);
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
export async function uploadMemberDocument({ member, kind, file, uid, docKey = null, label = null }) {
  const erro = validateDocumentFile(file);
  if (erro) throw new FederationError(erro, { file: erro });
  if (!storage) throw new FederationError(t('Firebase não está configurado neste ambiente.'));
  const ref = doc(collection(db, C.documents));
  const storage_path = documentStoragePath(uid, ref.id, file.type);
  await uploadBytes(storageRef(storage, storage_path), file, { contentType: file.type });
  const data = {
    federation_id: member.federation_id, member_id: member.id, user_id: uid, kind, storage_path,
    content_type: file.type, size: Number(file.size) || 0, file_name: String(file.name || '').slice(0, 120),
    // Documento PRÓPRIO do plano ("outro documento" com nome): a chave liga o arquivo ao pedido e o nome vai junto para a secretaria.
    ...(docKey && docKey !== kind ? { doc_key: String(docKey).slice(0, 24) } : {}),
    ...(label ? { label: String(label).trim().slice(0, 80) } : {}),
    // Clube/arena filiado: o documento é da ENTIDADE (todos os gestores veem); a regra confere contra a filiação.
    ...(member.org_kind ? { org_kind: member.org_kind, org_id: member.org_id } : {}),
    status: 'pending', review: null, created_at: serverTimestamp(), created_at_ms: Date.now(), updated_at: serverTimestamp(),
  };
  await setDoc(ref, data);
  await createAuditLog({ action: 'federation_document_upload', actor: { uid }, details: { federation_id: member.federation_id, member_id: member.id, kind, document_id: ref.id } });
  return { id: ref.id, ...data };
}

/**
 * Sobe os arquivos escolhidos no pedido para a filiação já gravada (`arquivos`
 * por chave do documento). Um que falhe não desfaz o pedido: devolve os nomes
 * que faltaram para a tela dizer.
 */
export async function uploadChosenDocuments({ docs, arquivos, member, uid }) {
  const escolhidos = (docs || []).filter((d) => arquivos?.[d.key]);
  const falhas = [];
  for (const d of escolhidos) {
    try {
      await uploadMemberDocument({ member, kind: d.kind, docKey: d.key, label: d.label, file: arquivos[d.key], uid });
    } catch { falhas.push(docLabel(d)); }
  }
  return { enviados: escolhidos.length - falhas.length, falhas, total: escolhidos.length };
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
    message: status === 'approved' ? t('A federação aceitou o documento: {doc}.', { doc: docLabel(docu) }) : t('A federação recusou o documento {doc}. Motivo: {motivo}. Envie outro.', { doc: docLabel(docu), motivo }),
    // Leva aonde se envia outro: a filiação do clube/arena (tela da entidade) ou "Minha filiação" na página da federação.
    link: docu.org_kind ? `/federacoes/${docu.federation_id}/filiar?entidade=${docu.org_kind}:${docu.org_id}` : `/federacoes/${docu.federation_id}?aba=minha`,
    actor: { uid },
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

/* ===================================================== PR 4: notícias, patrocinadores, governança ===================================================== */

/** Todas as notícias da federação, rascunhos inclusive (equipe `comms`/`admin`). */
export async function listFederationNews(fedId) {
  return (await getDocs(query(collection(db, C.news), where('federation_id', '==', fedId)))).docs.map(toDoc);
}

/** As notícias PÚBLICAS publicadas (a página, dentro e fora do app). Três igualdades: a regra prova sem índice. */
export async function listPublicNews(fedId) {
  if (!fedId) return [];
  const q = query(collection(db, C.news), where('federation_id', '==', fedId), where('status', '==', NEWS_STATUS.PUBLISHED), where('audience', '==', NEWS_AUDIENCE.PUBLIC));
  return (await getDocs(q)).docs.map(toDoc);
}

/** As notícias "só filiados" publicadas — só para quem tem filiação ATIVA (a regra confere). */
export async function listMemberNews(fedId) {
  if (!fedId) return [];
  const q = query(collection(db, C.news), where('federation_id', '==', fedId), where('status', '==', NEWS_STATUS.PUBLISHED), where('audience', '==', NEWS_AUDIENCE.MEMBERS));
  return (await getDocs(q)).docs.map(toDoc);
}

export async function saveNews(federation, input, { uid, newsId = null } = {}) {
  if (!fedModuleOn(federation, 'news')) throw new FederationError(t('Esta federação não tem o módulo de notícias ligado.'));
  const r = validateNewsInput(input);
  if (!r.ok) throw new FederationError(t('Confira os campos destacados.'), r.errors);
  const data = { ...r.value, federation_id: federation.id, federation_acronym: federation.acronym || '', updated_at: serverTimestamp(), updated_by: uid || null };
  if (data.status === NEWS_STATUS.PUBLISHED && !data.published_at) data.published_at = isoDate(); // o dia LOCAL (à noite o UTC já é amanhã)
  if (newsId) {
    await updateDoc(doc(db, C.news, newsId), data);
  } else {
    const ref = await addDoc(collection(db, C.news), { ...data, created_by: uid || null, created_at: serverTimestamp(), created_at_ms: Date.now() });
    newsId = ref.id;
  }
  await createAuditLog({ action: 'federation_news_save', actor: { uid }, details: { federation_id: federation.id, news_id: newsId, title: data.title, status: data.status, audience: data.audience } });
  return { id: newsId, ...data };
}

export async function deleteNews(news, { uid } = {}) {
  await deleteDoc(doc(db, C.news, news.id));
  await createAuditLog({ action: 'federation_news_delete', actor: { uid }, details: { federation_id: news.federation_id, news_id: news.id } });
}

/** O aviso da notícia aos filiados ativos — do SERVIDOR (`federationNews`), um só por notícia. */
export const notifyNews = (newsId) => chamar('federationNews', { newsId });

/** Os patrocinadores (campo da federação; a página e a carteirinha mostram com o módulo ligado) — permissão `admin`. */
export async function updateFederationSponsors(id, sponsors, { uid } = {}) {
  const r = validateSponsors(sponsors);
  if (!r.ok) throw new FederationError(t('Confira os campos destacados.'), r.errors);
  await updateDoc(doc(db, C.federations, id), { sponsors: r.value, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'federation_sponsors_update', actor: { uid }, details: { federation_id: id, count: r.value.length } });
  return r.value;
}

/** Governança (estatuto, mandato, diretoria, atas) — pública; permissão `admin`. */
export async function updateFederationGovernance(id, input, { uid } = {}) {
  const r = validateGovernance(input);
  if (!r.ok) throw new FederationError(t('Confira os campos destacados.'), r.errors);
  await updateDoc(doc(db, C.federations, id), { governance: r.value, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'federation_governance_update', actor: { uid }, details: { federation_id: id, board: r.value.board.length, minutes: r.value.minutes.length } });
  return r.value;
}

/* ===================================================== Acervo oficial (módulo `official_docs`) ===================================================== */

/** Tudo do acervo, rascunhos inclusive (permissão `docs`/`admin`; a regra confere). */
export async function listFederationDocsAll(fedId) {
  if (!fedId) return [];
  return (await getDocs(query(collection(db, C.officialDocs), where('federation_id', '==', fedId)))).docs.map(toDoc);
}

/** Os publicados de UMA visibilidade. Três igualdades: a regra prova (público / filiado ativo / equipe) sem índice. */
export async function listPublishedDocs(fedId, visibility = DOC_VISIBILITY.PUBLIC) {
  if (!fedId) return [];
  const q = query(collection(db, C.officialDocs), where('federation_id', '==', fedId), where('status', '==', DOC_STATUS.PUBLISHED), where('visibility', '==', visibility));
  return (await getDocs(q)).docs.map(toDoc);
}

export async function getOfficialDoc(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, C.officialDocs, id));
  return snap.exists() ? toDoc(snap) : null;
}

/** Sigo o acervo desta federação? (`{fed}_{uid}`; o `get` do documento ausente é permitido ao próprio.) */
export async function getAcervoFollow(fedId, uid) {
  if (!fedId || !uid) return null;
  const snap = await getDoc(doc(db, C.followers, `${fedId}_${uid}`));
  return snap.exists() ? toDoc(snap) : null;
}

/** Seguir/deixar de seguir: o servidor avisa quem segue quando a federação publica ou retifica. */
export async function setAcervoFollow(fedId, uid, seguir) {
  const ref = doc(db, C.followers, `${fedId}_${uid}`);
  if (seguir) await setDoc(ref, { federation_id: fedId, user_id: uid, created_at: serverTimestamp() });
  else await deleteDoc(ref);
}

/** Os acervos que sigo (exportação de dados). */
export async function listMyAcervoFollows(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, C.followers), where('user_id', '==', uid)))).docs.map(toDoc);
}

/** As ações do acervo são do SERVIDOR (numeração, cópia oficial, SHA-256): prazo longo para vídeo grande. */
export const acervoAction = (payload) => chamar('federationAcervo', payload, { timeout: 540_000 });

/* ===================================================== Calendário oficial (módulo `calendar`) ===================================================== */

/** Os eventos de UMA visibilidade. Duas igualdades: a regra prova (público / filiado ativo / equipe) sem índice. */
export async function listFederationEvents(fedId, visibility = 'public') {
  if (!fedId) return [];
  const q = query(collection(db, C.events), where('federation_id', '==', fedId), where('visibility', '==', visibility));
  return (await getDocs(q)).docs.map(toDoc);
}

export async function getFederationEvent(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, C.events, id));
  return snap.exists() ? toDoc(snap) : null;
}

/** As ações da agenda são do SERVIDOR (motivo, histórico, aviso a quem segue). */
export const agendaAction = (payload) => chamar('federationAgenda', payload);

/* ===================================================== Comentários (acervo e agenda) ===================================================== */

/** A lista de um documento (`doc`) ou evento (`event`), pelo servidor — também sem conta. */
export const listFederationComments = ({ federationId, kind, targetId }) => chamar('federationCommentsList', { federationId, kind, targetId });

/** Comentar, responder (equipe), denunciar, ocultar, reabrir, apagar, abrir/fechar, fila da moderação. */
export const commentAction = (payload) => chamar('federationComments', payload);

/** Os meus comentários (exportação de dados; a regra só deixa ler os próprios). */
export async function listMyFederationComments(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, C.comments), where('user_id', '==', uid)))).docs.map(toDoc);
}

/* ---- Eleições (módulo `elections`): só o servidor grava — `functions/federationElections.js` ---- */

/** Toda ação da eleição (edital, chapas, voto, apuração), pelo servidor. */
export const electionAction = (payload) => chamar('federationElections', payload);

/** Onde estou no colégio eleitoral (meu peso, se já votei — nunca em quem). Também exportação de dados. */
export async function listMyElectionVoters(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, C.electionVoters), where('user_id', '==', uid)))).docs.map(toDoc);
}

/** As chapas em que estou. */
export async function listMyCandidacies(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, C.candidacies), where('member_uids', 'array-contains', uid)))).docs.map(toDoc);
}

/** Os apoios que dei a chapas. */
export async function listMyElectionEndorsements(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, C.electionEndorsements), where('user_id', '==', uid)))).docs.map(toDoc);
}

/** O arquivo de um documento sem link público (filiado, equipe, rascunho), em base64. */
export const fetchAcervoFile = ({ federationId, docId, path }) => acervoAction({ federationId, action: 'file', docId, path });

/** Desfaz um envio que não chegou a entrar num rascunho salvo (só a pasta de quem enviou). */
export async function discardAcervoUpload(path) {
  if (!storage || !/^federacao-acervo\//.test(String(path || ''))) return;
  await deleteObject(storageRef(storage, path)).catch(() => {});
}

/**
 * Envia o arquivo do RASCUNHO para `federacao-acervo/{uid}/{id}.{ext}` (só quem
 * envia lê). Ao publicar, o servidor copia para a pasta oficial e apaga este.
 */
export function uploadAcervoFile({ uid, file, onProgress }) {
  const { error: erro } = validateAcervoFile(file);
  if (erro) return Promise.reject(new FederationError(erro, { file: erro }));
  if (!storage || !uid) return Promise.reject(new FederationError(t('Firebase não está configurado neste ambiente.')));
  const path = acervoUploadPath(uid, doc(collection(db, C.officialDocs)).id, file.type);
  const tarefa = uploadBytesResumable(storageRef(storage, path), file, { contentType: file.type });
  return new Promise((resolve, reject) => {
    tarefa.on('state_changed',
      (s) => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0),
      reject,
      () => resolve({ name: String(file.name || 'arquivo').slice(0, 120), path, size: Number(file.size) || 0, content_type: file.type }));
  });
}
