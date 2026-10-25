/**
 * ASSOCIAÇÃO DO CLUBE — I/O (flag `club_association`).
 *
 * Lê `club_x/{clube}/{espécie}/{id}` direto (a regra confere o acesso) e grava
 * só o que a regra deixa o navegador gravar: planos, Pix e a própria
 * configuração em `clubs.association`. Filiação, cobrança, carteirinha e
 * cargos são do SERVIDOR (`functions/clubAssociation.js`) — as ações passam
 * por `associationAction`.
 */
import { httpsCallable } from 'firebase/functions';
import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db, functions } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { t } from '@/core/i18n';
import { CLUB_X, CLUB_X_KIND as K, validatePix, validatePlan } from '../domain/association.js';

const toDoc = (d) => ({ id: d.id, ...d.data() });
const kindCol = (clubId, kind) => collection(db, CLUB_X, clubId, kind);

/** Erro de validação com os erros por campo (o formulário mostra cada um no lugar). */
export class AssociationError extends Error {
  constructor(message, fieldErrors = {}) {
    super(message);
    this.name = 'AssociationError';
    this.fieldErrors = fieldErrors;
  }
}

/* ------------------------------------------------------------ servidor -- */

function mensagemDoServidor(err) {
  const code = String(err?.code || '');
  if (code.endsWith('unauthenticated')) return t('Entre na sua conta para continuar.');
  if (code.endsWith('permission-denied')) return t('Você não tem permissão para isso neste clube.');
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

/**
 * Uma ação da associação no servidor: `request`, `renew`, `cancel`, `leave`,
 * `declare` (da pessoa) e `approve`, `reject`, `suspend`, `reinstate`, `grant`,
 * `adopt`, `charge_confirm` (da equipe).
 */
export const associationAction = (clubId, action, extra = {}) => chamar('clubAssociation', { clubId, action, ...extra });

/** Uma ação da diretoria no servidor: `role_save`, `role_delete`, `appoint`, `extend`, `remove`. */
export const staffAction = (clubId, action, extra = {}) => chamar('clubStaff', { clubId, action, ...extra });

export const IMPORT_CHUNK = 100;

/**
 * Importa a lista de associados em fatias de 100 (o servidor confere cada pessoa):
 * devolve o total de quem entrou, quem foi pulado (com o motivo) e quantos ficaram
 * sem conta. Se uma fatia falhar, as anteriores já valeram: o erro diz quantas entraram.
 */
export async function importMembers(clubId, planId, rows) {
  const total = { imported: 0, skipped: [], pending: 0 };
  for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
    try {
      const r = await associationAction(clubId, 'import', { planId, rows: rows.slice(i, i + IMPORT_CHUNK) });
      total.imported += r.imported; total.pending += r.pending; total.skipped.push(...r.skipped);
    } catch (err) {
      err.partial = total;
      throw err;
    }
  }
  return total;
}

/** A verificação pública de uma carteirinha pelo código (sem login). */
export const verifyClubCard = (code) => chamar('clubAssociationVerify', { code }, { timeout: 30_000 });

/* ---------------------------------------------------------- leituras -- */

/** Os planos que o clube mostra ao público (a regra só entrega `public: true` de clube publicado). */
export async function listPublicPlans(clubId) {
  const snap = await getDocs(query(kindCol(clubId, K.plans), where('public', '==', true)));
  return snap.docs.map(toDoc).filter((p) => p.active !== false);
}

/** Todos os planos, inclusive os internos e os pausados — para quem gere. */
export async function listAllPlans(clubId) {
  const snap = await getDocs(kindCol(clubId, K.plans));
  return snap.docs.map(toDoc);
}

export async function getPlan(clubId, planId) {
  if (!planId) return null;
  const snap = await getDoc(doc(db, CLUB_X, clubId, K.plans, planId));
  return snap.exists() ? toDoc(snap) : null;
}

/** A filiação da própria pessoa (id = uid). `null` quando não tem. */
export async function getMyAffiliation(clubId, uid) {
  if (!clubId || !uid) return null;
  const snap = await getDoc(doc(db, CLUB_X, clubId, K.aff, uid));
  return snap.exists() ? toDoc(snap) : null;
}

/** As cobranças da própria pessoa neste clube. */
export async function listMyCharges(clubId, uid) {
  const snap = await getDocs(query(kindCol(clubId, K.charges), where('user_id', '==', uid)));
  return snap.docs.map(toDoc);
}

/** Todas as filiações (secretaria e financeiro). */
export async function listAffiliations(clubId) {
  const snap = await getDocs(kindCol(clubId, K.aff));
  return snap.docs.map(toDoc);
}

/** Todas as cobranças (financeiro e secretaria). */
export async function listCharges(clubId) {
  const snap = await getDocs(kindCol(clubId, K.charges));
  return snap.docs.map(toDoc);
}

/** A chave Pix do clube (financeiro). `null` quando ainda não cadastrou. */
export async function getPix(clubId) {
  const snap = await getDoc(doc(db, CLUB_X, clubId, K.cfg, 'pix'));
  return snap.exists() ? snap.data() : null;
}

/** Os cargos e as permissões de quem trabalha no clube (só o administrador lista). */
export async function listStaff(clubId) {
  const snap = await getDocs(kindCol(clubId, K.staff));
  return snap.docs.map(toDoc);
}

/** Os cargos montados pelo clube (`null` quando nunca montou: valem os modelos). */
export async function getRoles(clubId) {
  const snap = await getDoc(doc(db, CLUB_X, clubId, K.roles, 'list'));
  return snap.exists() && Array.isArray(snap.data().roles) ? snap.data().roles : null;
}

/** As importações já feitas (quem ficou sem conta): só a secretaria lê. */
export async function listImports(clubId) {
  const snap = await getDocs(kindCol(clubId, K.imports));
  return snap.docs.map(toDoc).sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
}

/** O cargo da própria pessoa (para saber o que mostrar). `null` quando não tem. */
export async function getMyStaff(clubId, uid) {
  if (!clubId || !uid) return null;
  const snap = await getDoc(doc(db, CLUB_X, clubId, K.staff, uid));
  return snap.exists() ? toDoc(snap) : null;
}

/* ----------------------------------------------------------- escritas -- */

/** Cria ou edita um plano. `planId` vazio cria. */
export async function savePlan(clubId, planId, input, actor = {}) {
  const v = validatePlan(input);
  if (!v.ok) throw new AssociationError(t('Confira os campos do plano.'), v.errors);
  const data = { ...v.value, club_id: clubId, updated_at_ms: Date.now() };
  let id = planId;
  if (planId) {
    await setDoc(doc(db, CLUB_X, clubId, K.plans, planId), data, { merge: true });
  } else {
    const ref = await addDoc(kindCol(clubId, K.plans), { ...data, created_at_ms: Date.now(), created_by: actor.uid || null });
    id = ref.id;
  }
  await createAuditLog({ action: planId ? 'club_plan_update' : 'club_plan_create', actor, details: { club_id: clubId, plan_id: id } });
  return id;
}

/** Pausa ou reativa um plano (plano não se apaga: quem já é do plano continua nele). */
export async function setPlanActive(clubId, planId, active) {
  await updateDoc(doc(db, CLUB_X, clubId, K.plans, planId), { active: !!active, updated_at_ms: Date.now() });
}

/** Grava a chave Pix e o recebedor. */
export async function savePix(clubId, input, actor = {}) {
  const v = validatePix(input);
  if (!v.ok) throw new AssociationError(t('Confira a chave Pix.'), v.errors);
  await setDoc(doc(db, CLUB_X, clubId, K.cfg, 'pix'), { ...v.value, updated_at_ms: Date.now() });
  await createAuditLog({ action: 'club_pix_update', actor, details: { club_id: clubId } });
}

/**
 * A configuração da associação no documento do clube. Só as chaves tocadas
 * (caminho com ponto): ligar a associação não regrava o resto do clube.
 * Abrir ao público liga a página pública do clube junto — sem ela não há onde
 * mostrar os planos.
 */
export async function saveAssociationSettings(clubId, patch, actor = {}) {
  const upd = {};
  if ('enabled' in patch) upd['association.enabled'] = !!patch.enabled;
  if ('published' in patch) {
    upd['association.published'] = !!patch.published;
    if (patch.published) upd.is_public = true;
  }
  if ('intro' in patch) upd['association.intro'] = String(patch.intro || '').trim().slice(0, 600);
  if ('color' in patch) upd['association.color'] = String(patch.color || '').trim().slice(0, 9);
  if (!Object.keys(upd).length) return;
  await updateDoc(doc(db, 'clubs', clubId), { ...upd, updated_at: new Date() });
  await createAuditLog({ action: 'club_association_settings', actor, details: { club_id: clubId, ...patch } });
}
