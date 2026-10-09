/**
 * Compartilhar e indicar itens de treino (`training_shares`).
 *
 * Dois tipos, e a diferença é de QUEM pode mandar:
 * - `indicacao` — qualquer pessoa indica um item a outro atleta;
 * - `aluno` — EXCLUSIVO do professor, para os SEUS alunos ativos (a regra
 *   confere `coach_students/{professor}_{aluno}` com status `active`).
 *
 * Indicar um item privado dá ao destinatário acesso de leitura àquele item
 * (`shared_uids`); indicar um item público não muda o item.
 */

import { isPubliclyListed, VISIBILITY } from './visibility.js';

export const SHARE_KIND = Object.freeze({ INDICACAO: 'indicacao', ALUNO: 'aluno' });
export const SHARE_KIND_LABELS = Object.freeze({ indicacao: 'Indicação', aluno: 'Do seu professor' });
export const SHARE_NOTE_MAX = 500;
export const SHARE_DONE_NOTE_MAX = 300;
export const MAX_RECIPIENTS = 30;

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const isoDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : null);

/**
 * O destinatário precisa entrar em `shared_uids` para conseguir ler?
 * Público na biblioteca: não. Item "alunos" mandado para aluno: não.
 */
export function needsSharedAccess(item = {}, { kind } = {}) {
  if (isPubliclyListed(item)) return false;
  if (kind === SHARE_KIND.ALUNO && item.visibility === VISIBILITY.ALUNOS) return false;
  return true;
}

/**
 * Pode compartilhar este item? Só o próprio item ou um item público da
 * biblioteca — compartilhar o que recebeu de outra pessoa espalharia
 * conteúdo privado sem o autor saber.
 * @returns {{ ok: boolean, reason: string }}
 */
export function canShareItem(item = {}, { uid } = {}) {
  if (!uid) return { ok: false, reason: 'Entre na sua conta.' };
  if (item.legacy) return { ok: false, reason: 'Este conteúdo antigo não pode ser compartilhado por aqui.' };
  if (item.author_uid === uid) return { ok: true, reason: '' };
  if (isPubliclyListed(item)) return { ok: true, reason: '' };
  return { ok: false, reason: 'Só dá para indicar os seus itens ou os públicos da biblioteca.' };
}

/** Monta os documentos de compartilhamento para cada destinatário. */
export function buildShares({ item, from, toUids = [], kind = SHARE_KIND.INDICACAO, note = '', dueDate = null }) {
  const uniq = [...new Set(toUids.filter((u) => u && u !== from.uid))].slice(0, MAX_RECIPIENTS);
  return uniq.map((to_uid) => ({
    from_uid: from.uid,
    from_name: str(from.name, 80) || 'Atleta',
    from_role: from.role === 'professor' ? 'professor' : 'atleta',
    to_uid,
    item_id: item.id,
    item_title: str(item.title, 120),
    item_kind: str(item.kind, 20),
    kind: kind === SHARE_KIND.ALUNO ? SHARE_KIND.ALUNO : SHARE_KIND.INDICACAO,
    note: str(note, SHARE_NOTE_MAX),
    due_date: kind === SHARE_KIND.ALUNO ? isoDate(dueDate) : null,
    read_at: null,
    done_at: null,
    done_note: '',
  }));
}

const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : (typeof t?.seconds === 'number' ? t.seconds * 1000 : 0));

/**
 * Caixa de entrada: do professor primeiro (com prazo mais perto antes),
 * depois indicações; dentro, mais recente primeiro. Concluídos ao fim.
 */
export function sortInbox(shares = []) {
  return [...shares].sort((a, b) => {
    if (!!a.done_at !== !!b.done_at) return a.done_at ? 1 : -1;
    if (a.kind !== b.kind) return a.kind === SHARE_KIND.ALUNO ? -1 : 1;
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    if (!!a.due_date !== !!b.due_date) return a.due_date ? -1 : 1;
    return ms(b.created_at) - ms(a.created_at);
  });
}

export function unreadCount(shares = []) {
  return shares.filter((s) => !s.read_at && !s.done_at).length;
}

/** Prazo em texto: "para hoje", "para amanhã", "atrasado 2 dias", "até 12/10". */
export function dueLabel(dueDate, today) {
  if (!dueDate) return '';
  const d = (s) => new Date(`${s}T12:00:00`);
  const diff = Math.round((d(dueDate) - d(today)) / 86400000);
  if (diff === 0) return 'para hoje';
  if (diff === 1) return 'para amanhã';
  if (diff < 0) return diff === -1 ? 'era para ontem' : `era para ${-diff} dias atrás`;
  const [, m, dd] = dueDate.split('-');
  return `até ${dd}/${m}`;
}
