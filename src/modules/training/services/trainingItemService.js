/**
 * Itens de treino (`training_items`): biblioteca, criação, edição e a
 * moderação do admin.
 *
 * A REGRA do Firestore é a defesa (autoria, revisão, visibilidade, cópia
 * trancada); este serviço só monta o documento que ela aceita e diz ANTES o
 * que seria recusado, com a frase certa. O que a regra não consegue conferir
 * fica aqui: menor de idade publicando vai sempre para revisão e o limite de
 * itens esperando revisão por pessoa.
 *
 * Toda consulta é por igualdade/array-contains — nenhum índice composto.
 */

import {
  arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { listCoachContent } from '@/modules/coaches/services/contentService';
import { getCoach } from '@/modules/coaches/services/coachService';
import { normalizeItemInput, fromCoachContent } from '../domain/trainingItem.js';
import {
  AUTHOR_ROLE, PLATFORM_AUTHOR, REVIEW, VISIBILITY, authorRoleFor, canEditItem, reviewFor,
  visibilityOptionsFor,
} from '../domain/visibility.js';
import { derivedFromFor } from '../domain/copy.js';
import { deleteTrainingMedia } from './mediaUploadService.js';
import { markSeed } from './settingsService.js';

export const TRAINING_ITEMS = 'training_items';
const SHARES = 'training_shares';

const toItem = (d) => ({ id: d.id, ...d.data() });
const str = (v, max) => String(v ?? '').trim().slice(0, max);

/** Erro de validação com os erros por campo (o editor mostra cada um no lugar). */
export class TrainingItemError extends Error {
  constructor(message, fieldErrors = {}) {
    super(message);
    this.name = 'TrainingItemError';
    this.fieldErrors = fieldErrors;
  }
}

/** Biblioteca pública: publicado, aprovado e não oculto. */
export async function listPublicItems() {
  const q = query(
    collection(db, TRAINING_ITEMS),
    where('visibility', '==', VISIBILITY.PUBLICO),
    where('review', '==', REVIEW.APROVADO),
    where('hidden', '==', false),
  );
  return (await getDocs(q)).docs.map(toItem);
}

/** Tudo o que eu criei (inclusive pendente, recusado e oculto). */
export async function listMyItems(uid) {
  if (!uid) return [];
  const q = query(collection(db, TRAINING_ITEMS), where('author_uid', '==', uid));
  return (await getDocs(q)).docs.map(toItem);
}

/** O que outras pessoas compartilharam comigo (inclusive itens privados delas). */
export async function listSharedWithMe(uid) {
  if (!uid) return [];
  const q = query(
    collection(db, TRAINING_ITEMS),
    where('shared_uids', 'array-contains', uid),
    where('hidden', '==', false),
  );
  return (await getDocs(q)).docs.map(toItem);
}

/**
 * "Dos meus professores": os itens "Meus alunos" de cada professor com quem
 * tenho vínculo ATIVO, mais o conteúdo antigo dele (`coach_content`, só
 * leitura, sem migração). Um professor que falha não derruba os outros: a
 * resposta diz que ficou incompleta.
 *
 * @param {string[]} coachIds professores com vínculo ativo
 * @returns {Promise<{ items: object[], incompleto: boolean }>}
 */
export async function listCoachItems(coachIds = []) {
  const ids = [...new Set(coachIds.filter(Boolean))];
  const porProfessor = await Promise.allSettled(ids.map(async (coachId) => {
    const q = query(
      collection(db, TRAINING_ITEMS),
      where('author_uid', '==', coachId),
      where('visibility', '==', VISIBILITY.ALUNOS),
      where('hidden', '==', false),
    );
    const [novos, antigos, coach] = await Promise.all([
      getDocs(q),
      listCoachContent(coachId),
      getCoach(coachId).catch(() => null), // só o nome: sem ele, o item mostra "Professor"
    ]);
    const nome = coach?.display_name || '';
    return [...novos.docs.map(toItem), ...antigos.map((c) => fromCoachContent(c, nome))];
  }));
  const items = porProfessor.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
  return { items, incompleto: porProfessor.some((r) => r.status === 'rejected') };
}

/**
 * Um item. Para quem não pode ler (ou se não existe — a regra não distingue),
 * devolve `reason: 'indisponivel'`; outras falhas SOBEM (a tela diz que falhou).
 * @returns {Promise<{ item: object|null, reason: ''|'indisponivel' }>}
 */
export async function getItem(id) {
  if (!id) return { item: null, reason: 'indisponivel' };
  try {
    const snap = await getDoc(doc(db, TRAINING_ITEMS, id));
    return snap.exists() ? { item: toItem(snap), reason: '' } : { item: null, reason: 'indisponivel' };
  } catch (err) {
    if (err?.code === 'permission-denied') return { item: null, reason: 'indisponivel' };
    throw err;
  }
}

const isMinor = (ageYears) => Number.isFinite(ageYears) && ageYears < 18;

async function assertPendingRoom(uid, settings, ignoreId = null) {
  const limite = Number(settings?.max_pending_per_user) || 5;
  const pendentes = (await listMyItems(uid)).filter((i) => i.review === REVIEW.PENDENTE && i.id !== ignoreId);
  if (pendentes.length >= limite) {
    throw new TrainingItemError(
      `Você já tem ${pendentes.length} itens esperando revisão. Aguarde a equipe revisar antes de publicar outro — ou salve como "Só eu".`,
    );
  }
}

/**
 * A revisão que vale para esta escrita, com as duas travas que a regra não
 * vê: menor de idade publica sempre via revisão.
 */
function decideReview({ visibility, role, settings, identity, previousReview = null, adminKeeps = false }) {
  if (identity.isAdmin) {
    return reviewFor({ visibility, role, settings, isAdmin: true, adminReview: adminKeeps ? previousReview : null });
  }
  const review = reviewFor({ visibility, role, settings, previousReview });
  if (review === REVIEW.APROVADO && isMinor(identity.ageYears)) return REVIEW.PENDENTE;
  return review;
}

function assertVisibility(visibility, role, settings, { isAdmin }) {
  const options = role === AUTHOR_ROLE.PLATAFORMA ? [VISIBILITY.PUBLICO, VISIBILITY.PRIVADO] : visibilityOptionsFor(role);
  if (!options.includes(visibility)) {
    throw new TrainingItemError(visibility === VISIBILITY.ALUNOS
      ? 'Só professores podem deixar um item visível aos alunos.'
      : 'Escolha quem pode ver este item.');
  }
  if (visibility === VISIBILITY.PUBLICO && role === AUTHOR_ROLE.ATLETA && settings?.allow_public_athlete === false && !isAdmin) {
    throw new TrainingItemError('A publicação de itens por atletas está pausada. Salve como "Só eu" e compartilhe com quem quiser.');
  }
}

/**
 * Cria um item.
 *
 * @param {object} input conteúdo do editor (+ `visibility`)
 * @param {object} ctx
 * @param {{ uid: string, name: string, photo?: string|null, isAdmin: boolean, isCoach: boolean,
 *   ageYears?: number|null, actor: object }} ctx.identity
 * @param {object} ctx.settings `platform_settings/training` normalizado
 * @param {boolean} [ctx.asPlatform] admin criando conteúdo da PickleRush
 * @param {object|null} [ctx.source] o item original, em "Copiar e adaptar"
 * @param {boolean} [ctx.aiAssisted]
 * @param {boolean} [ctx.featured] só admin
 * @param {{ slug: string, version: number }|null} [ctx.seed] semente da plataforma (id fixo)
 * @param {boolean} [ctx.silent] sem auditoria por item (a instalação em lote audita uma vez)
 * @returns {Promise<string>} id criado
 */
export async function createItem(input, { identity, settings, asPlatform = false, source = null, aiAssisted = false, featured = false, seed = null, silent = false }) {
  if (!identity?.uid) throw new TrainingItemError('Entre na sua conta.');
  const { valid, errors, value } = normalizeItemInput(input);
  if (!valid) throw new TrainingItemError('Revise os campos destacados.', errors);

  const role = authorRoleFor({ asPlatform, isAdmin: identity.isAdmin, isCoach: identity.isCoach });
  const visibility = input.visibility || VISIBILITY.PRIVADO;
  assertVisibility(visibility, role, settings, { isAdmin: identity.isAdmin });

  const derived_from = source ? derivedFromFor(source, identity.uid) : null;
  if (derived_from?.locked && visibility === VISIBILITY.PUBLICO) {
    throw new TrainingItemError('Esta é a adaptação de um item que não é público. Ela pode ser sua ou dos seus alunos, mas não pode ir para a biblioteca.');
  }

  const review = decideReview({ visibility, role, settings, identity });
  if (review === REVIEW.PENDENTE) await assertPendingRoom(identity.uid, settings);

  const platform = role === AUTHOR_ROLE.PLATAFORMA;
  const ref = seed ? doc(db, TRAINING_ITEMS, `pickle_${seed.slug}`) : doc(collection(db, TRAINING_ITEMS));
  const data = {
    ...value,
    author_uid: platform ? PLATFORM_AUTHOR : identity.uid,
    author_role: role,
    author_name: platform ? 'PickleRush' : (str(identity.name, 80) || 'Atleta'),
    author_photo: platform ? null : (identity.photo || null),
    created_by: identity.uid,
    visibility,
    review,
    hidden: false,
    featured: identity.isAdmin ? !!featured : false,
    shared_uids: [],
    derived_from,
    ai_assisted: !!aiAssisted,
    schema_version: 1,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  if (seed) Object.assign(data, { seed_slug: str(seed.slug, 80), seed_version: Number(seed.version) || 1 });
  await setDoc(ref, data);
  if (silent) return ref.id;
  await createAuditLog({
    action: 'training_item_created',
    actor: identity.actor,
    details: { item_id: ref.id, kind: value.kind, visibility, review, author_role: role, copied_from: derived_from?.id || null },
  });
  return ref.id;
}

/**
 * Edita um item (o autor, ou o admin em qualquer item).
 * Autor editando conteúdo público aprovado volta para a revisão quando o
 * papel dele passa por revisão (a regra exige). O admin mantém a revisão.
 *
 * @returns {Promise<{ review: string }>}
 */
export async function updateItem(item, input, { identity, settings, aiAssisted = false }) {
  if (!canEditItem(item, { uid: identity?.uid, isAdmin: identity?.isAdmin })) throw new TrainingItemError('Você não pode editar este item.');
  if (item.legacy) throw new TrainingItemError('Este conteúdo antigo é editado na área do professor.');
  const { valid, errors, value } = normalizeItemInput(input);
  if (!valid) throw new TrainingItemError('Revise os campos destacados.', errors);

  const role = item.author_role;
  const visibility = input.visibility || item.visibility;
  assertVisibility(visibility, role, settings, { isAdmin: identity.isAdmin });
  if (item.derived_from?.locked && visibility === VISIBILITY.PUBLICO && !identity.isAdmin) {
    throw new TrainingItemError('Esta é a adaptação de um item que não é público e não pode ir para a biblioteca.');
  }

  const review = decideReview({
    visibility, role, settings, identity,
    previousReview: item.review,
    adminKeeps: item.visibility === VISIBILITY.PUBLICO,
  });
  if (review === REVIEW.PENDENTE && item.review !== REVIEW.PENDENTE && !identity.isAdmin) {
    await assertPendingRoom(identity.uid, settings, item.id);
  }

  const patch = { ...value, visibility, review, updated_at: serverTimestamp() };
  const isOwnEdit = item.author_uid === identity.uid;
  if (isOwnEdit) {
    patch.author_name = str(identity.name, 80) || item.author_name || 'Atleta';
    patch.author_photo = identity.photo || null;
  }
  // Usou a IA ao editar: o selo "IA" entra. Nunca sai — o texto ainda veio dela.
  if (aiAssisted) patch.ai_assisted = true;
  // Item da semente editado pelo admin: a próxima atualização da semente não o sobrescreve.
  if (identity.isAdmin && item.seed_slug) patch.seed_customized = true;
  await updateDoc(doc(db, TRAINING_ITEMS, item.id), patch);
  await createAuditLog({
    action: 'training_item_updated',
    actor: identity.actor,
    details: { item_id: item.id, visibility, review, by_admin: identity.isAdmin && !isOwnEdit },
  });
  return { review };
}

/**
 * Exclui um item. O autor apaga também os arquivos que enviou; os
 * compartilhamentos que apontam para ele são apagados (a caixa de entrada não
 * fica com um item que não abre). Nada disso derruba a exclusão.
 */
export async function deleteItem(item, { identity }) {
  if (!canEditItem(item, { uid: identity?.uid, isAdmin: identity?.isAdmin })) throw new TrainingItemError('Você não pode excluir este item.');
  await deleteDoc(doc(db, TRAINING_ITEMS, item.id));

  const isOwn = item.author_uid === identity.uid;
  const sharesQ = isOwn
    ? query(collection(db, SHARES), where('from_uid', '==', identity.uid), where('item_id', '==', item.id))
    : query(collection(db, SHARES), where('item_id', '==', item.id));
  const limpezas = [
    getDocs(sharesQ).then(async (snap) => {
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }),
  ];
  // Item da semente apagado de propósito: a atualização da semente não o recria.
  if (item.seed_slug) limpezas.push(markSeed({ seed_removed: arrayUnion(item.seed_slug) }));
  // Só quem enviou apaga o arquivo (regra do Storage): o próprio item, ou o da
  // plataforma que este admin montou. Arquivo de outra pessoa fica no armazenamento.
  for (const m of item.media || []) {
    if (m?.source === 'upload' && m.path && String(m.path).startsWith(`treino/${identity.uid}/`)) {
      limpezas.push(deleteTrainingMedia(m.path));
    }
  }
  await Promise.allSettled(limpezas);
  await createAuditLog({
    action: 'training_item_deleted',
    actor: identity.actor,
    details: { item_id: item.id, title: item.title, author_uid: item.author_uid, by_admin: identity.isAdmin && !isOwn },
  });
}

/** Dá acesso de leitura a mais pessoas (indicação de item privado). */
export async function addSharedReaders(item, uids = []) {
  const atual = Array.isArray(item.shared_uids) ? item.shared_uids : [];
  const novos = uids.filter((u) => u && !atual.includes(u));
  if (!novos.length) return;
  if (atual.length + novos.length > 50) {
    throw new TrainingItemError('Este item já foi compartilhado com muitas pessoas. Deixe-o visível aos seus alunos ou publique na biblioteca.');
  }
  await updateDoc(doc(db, TRAINING_ITEMS, item.id), { shared_uids: arrayUnion(...novos), updated_at: serverTimestamp() });
}

// ── Admin ───────────────────────────────────────────────────────────────

/**
 * Todos os itens (só o admin lê a coleção inteira).
 * ponytail: lê a coleção inteira; paginar com cursor quando passar de alguns milhares.
 */
export async function listAllItems() {
  return (await getDocs(collection(db, TRAINING_ITEMS))).docs.map(toItem);
}

const notifyAuthor = (item, { title, message, link }, identity) => {
  if (!item.author_uid || item.author_uid === PLATFORM_AUTHOR || item.author_uid === identity.uid) return Promise.resolve(0);
  return notifyUsers([item.author_uid], {
    title, message, link, type: NOTIFICATION_TYPE.TRAINING_REVIEW,
    actor: { uid: identity.uid, name: 'Equipe PickleRush' },
    data: { item_id: item.id },
  }).catch(() => 0);
};

/** Aprova ou recusa um item da fila, com nota ao autor (que é avisado). */
export async function reviewItem(item, decision, note, { identity }) {
  if (!identity?.isAdmin) throw new TrainingItemError('Só a equipe da plataforma revisa.');
  if (![REVIEW.APROVADO, REVIEW.RECUSADO].includes(decision)) throw new TrainingItemError('Decisão inválida.');
  const review_note = str(note, 500);
  await updateDoc(doc(db, TRAINING_ITEMS, item.id), {
    review: decision, review_note, reviewed_by: identity.uid, reviewed_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: decision === REVIEW.APROVADO ? 'training_item_approved' : 'training_item_rejected',
    actor: identity.actor,
    details: { item_id: item.id, title: item.title, author_uid: item.author_uid, note: review_note },
  });
  await notifyAuthor(item, decision === REVIEW.APROVADO
    ? { title: 'Seu item foi publicado', message: `"${item.title}" está na biblioteca de treinos.${review_note ? ` Nota da equipe: ${review_note}` : ''}`, link: `/treino/item/${item.id}` }
    : { title: 'Seu item não foi aprovado', message: `"${item.title}" não entrou na biblioteca.${review_note ? ` Motivo: ${review_note}` : ''} Você pode editar e enviar de novo.`, link: `/treino/item/${item.id}` },
  identity);
}

/** Oculta (com motivo) ou volta a mostrar. Oculto some de todo lugar, menos para o autor e o admin. */
export async function setItemHidden(item, hidden, reason, { identity }) {
  if (!identity?.isAdmin) throw new TrainingItemError('Só a equipe da plataforma oculta itens.');
  const hidden_reason = hidden ? str(reason, 300) : '';
  if (hidden && !hidden_reason) throw new TrainingItemError('Diga o motivo — o autor vai ler.');
  await updateDoc(doc(db, TRAINING_ITEMS, item.id), { hidden: !!hidden, hidden_reason, updated_at: serverTimestamp() });
  await createAuditLog({
    action: hidden ? 'training_item_hidden' : 'training_item_unhidden',
    actor: identity.actor,
    details: { item_id: item.id, title: item.title, author_uid: item.author_uid, reason: hidden_reason },
  });
  await notifyAuthor(item, hidden
    ? { title: 'Seu item foi ocultado', message: `"${item.title}" saiu da biblioteca. Motivo: ${hidden_reason}`, link: `/treino/item/${item.id}` }
    : { title: 'Seu item voltou a aparecer', message: `"${item.title}" está visível de novo.`, link: `/treino/item/${item.id}` },
  identity);
}

/** Destaca (ou tira o destaque) na biblioteca. */
export async function setItemFeatured(item, featured, { identity }) {
  if (!identity?.isAdmin) throw new TrainingItemError('Só a equipe da plataforma destaca itens.');
  await updateDoc(doc(db, TRAINING_ITEMS, item.id), { featured: !!featured, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'training_item_featured', actor: identity.actor, details: { item_id: item.id, featured: !!featured } });
}
