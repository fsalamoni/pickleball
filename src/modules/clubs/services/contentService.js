/**
 * VANTAGENS, COMUNICADOS E PATROCINADORES do clube-associação — I/O (Bloco C).
 *
 * A equipe de comunicação (`comms`) grava pelo navegador; a regra confere o
 * acesso. O "como usar"/código de uma vantagem fica em `bsec/{id}` (só a
 * equipe lê) e o associado em dia o recebe do SERVIDOR (`clubContent`). O
 * aviso do comunicado também é do servidor, uma vez só.
 */
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { t } from '@/core/i18n';
import { CLUB_X, CLUB_X_KIND as K } from '../domain/association.js';
import { SPONSORS_MAX, validateBenefit, validateClubNews, validateSponsor } from '../domain/content.js';
import { AssociationError, chamar } from './associationService.js';
import { isoDate } from '@/modules/federations/domain/membership.js';

const toDoc = (d) => ({ id: d.id, ...d.data() });
const kindCol = (clubId, kind) => collection(db, CLUB_X, clubId, kind);
const kindDoc = (clubId, kind, id) => doc(db, CLUB_X, clubId, kind, id);
const novoId = (clubId, kind) => doc(kindCol(clubId, kind)).id;

/* ----------------------------------------------------------------- servidor -- */

/** As vantagens do associado em dia, com o "como usar" e o código (`{ eligible, items }`). */
export const fetchMemberBenefits = (clubId) => chamar('clubContent', { clubId, action: 'benefits' }, { timeout: 30_000 });

/** O aviso do comunicado aos associados em dia — do SERVIDOR, um só por comunicado. */
export const notifyClubNews = (clubId, newsId) => chamar('clubContent', { clubId, action: 'news_notify', newsId });

/* ---------------------------------------------------------------- vantagens -- */

/** A vitrine pública (a regra só entrega `public: true` de clube publicado). */
export async function listPublicBenefits(clubId) {
  const snap = await getDocs(query(kindCol(clubId, K.benefits), where('public', '==', true)));
  return snap.docs.map(toDoc).filter((b) => b.active !== false);
}

/** Todas, inclusive as internas e as pausadas — quem gere a comunicação. */
export async function listAllBenefits(clubId) {
  return (await getDocs(kindCol(clubId, K.benefits))).docs.map(toDoc);
}

/** O "como usar" e o código de UMA vantagem (só a equipe lê). */
export async function getBenefitSecret(clubId, id) {
  const snap = await getDoc(kindDoc(clubId, K.bsec, id));
  return snap.exists() ? snap.data() : { how_to: '', code: '' };
}

/** Cria ou edita uma vantagem; o segredo vai para `bsec` (ou sai, se foi esvaziado). */
export async function saveBenefit(clubId, benefitId, input, actor = {}) {
  const v = validateBenefit(input);
  if (!v.ok) throw new AssociationError(t('Confira os campos destacados.'), v.errors);
  const id = benefitId || novoId(clubId, K.benefits);
  const agora = Date.now();
  await setDoc(kindDoc(clubId, K.benefits, id), {
    ...v.value, club_id: clubId, updated_at_ms: agora, ...(benefitId ? {} : { created_at_ms: agora, created_by: actor.uid || null }),
  }, { merge: true });
  if (v.value.has_secret) await setDoc(kindDoc(clubId, K.bsec, id), { ...v.secret, club_id: clubId, updated_at_ms: agora });
  else await deleteDoc(kindDoc(clubId, K.bsec, id));
  await createAuditLog({ action: benefitId ? 'club_benefit_update' : 'club_benefit_create', actor, details: { club_id: clubId, benefit_id: id, title: v.value.title } });
  return id;
}

export async function deleteBenefit(clubId, benefit, actor = {}) {
  await deleteDoc(kindDoc(clubId, K.benefits, benefit.id));
  await deleteDoc(kindDoc(clubId, K.bsec, benefit.id));
  await createAuditLog({ action: 'club_benefit_delete', actor, details: { club_id: clubId, benefit_id: benefit.id } });
}

/** Pausa ou reativa (a vantagem pausada some da vitrine e do associado, sem se perder). */
export async function setBenefitActive(clubId, benefitId, active) {
  await setDoc(kindDoc(clubId, K.benefits, benefitId), { active: !!active, updated_at_ms: Date.now() }, { merge: true });
}

/* -------------------------------------------------------------- comunicados -- */

/** Os públicos (publicados). */
export async function listPublicClubNews(clubId) {
  return (await getDocs(query(kindCol(clubId, K.news), where('public', '==', true)))).docs.map(toDoc);
}

/** Os "só associados" publicados — qualquer membro do clube lê; a regra prova pelas duas igualdades. */
export async function listMemberClubNews(clubId) {
  return (await getDocs(query(kindCol(clubId, K.news), where('status', '==', 'published'), where('audience', '==', 'members')))).docs.map(toDoc);
}

/** Todos, rascunhos inclusive — a comunicação. */
export async function listAllClubNews(clubId) {
  return (await getDocs(kindCol(clubId, K.news))).docs.map(toDoc);
}

export async function saveClubNews(club, input, { uid, newsId = null } = {}) {
  const v = validateClubNews(input);
  if (!v.ok) throw new AssociationError(t('Confira os campos destacados.'), v.errors);
  const data = { ...v.value, club_id: club.id, updated_at_ms: Date.now(), updated_by: uid || null };
  if (data.status === 'published' && !data.published_at) data.published_at = isoDate(); // o dia LOCAL (à noite o UTC já é amanhã)
  const id = newsId || novoId(club.id, K.news);
  await setDoc(kindDoc(club.id, K.news, id), { ...data, ...(newsId ? {} : { created_at_ms: Date.now(), created_by: uid || null }) }, { merge: true });
  await createAuditLog({ action: 'club_news_save', actor: { uid }, details: { club_id: club.id, news_id: id, title: data.title, status: data.status, audience: data.audience } });
  return { id, ...data };
}

export async function deleteClubNews(clubId, news, { uid } = {}) {
  await deleteDoc(kindDoc(clubId, K.news, news.id));
  await createAuditLog({ action: 'club_news_delete', actor: { uid }, details: { club_id: clubId, news_id: news.id } });
}

/* ------------------------------------------------------------ patrocinadores -- */

export async function listPublicSponsors(clubId) {
  return (await getDocs(query(kindCol(clubId, K.sponsors), where('public', '==', true)))).docs.map(toDoc);
}

export async function listAllSponsors(clubId) {
  return (await getDocs(kindCol(clubId, K.sponsors))).docs.map(toDoc);
}

/** `total` = quantos já existem (a lista é curta: a página e a carteirinha os mostram). */
export async function saveSponsor(clubId, sponsorId, input, { actor = {}, total = 0 } = {}) {
  if (!sponsorId && total >= SPONSORS_MAX) throw new AssociationError(t('No máximo {n} patrocinadores.', { n: SPONSORS_MAX }));
  const v = validateSponsor(input);
  if (!v.ok) throw new AssociationError(t('Confira os campos destacados.'), v.errors);
  const id = sponsorId || novoId(clubId, K.sponsors);
  await setDoc(kindDoc(clubId, K.sponsors, id), { ...v.value, club_id: clubId, updated_at_ms: Date.now() }, { merge: true });
  await createAuditLog({ action: sponsorId ? 'club_sponsor_update' : 'club_sponsor_create', actor, details: { club_id: clubId, sponsor_id: id, name: v.value.name } });
  return id;
}

export async function deleteSponsor(clubId, sponsor, actor = {}) {
  await deleteDoc(kindDoc(clubId, K.sponsors, sponsor.id));
  await createAuditLog({ action: 'club_sponsor_delete', actor, details: { club_id: clubId, sponsor_id: sponsor.id } });
}
