/**
 * Contas do painel admin → Treino (puras): filtro e contagem de TODOS os
 * itens, a fila de revisão e a ordem das denúncias.
 */

import { ITEM_KINDS } from '@/modules/training/domain/taxonomy';
import { normalizeText, timeMs } from '@/modules/training/domain/trainingItem';
import { REVIEW, VISIBILITY } from '@/modules/training/domain/visibility';

export const EMPTY_ADMIN_FILTERS = Object.freeze({ q: '', kind: '', role: '', visibility: '', review: '', estado: '' });

/** Estados que viram chip (cada um é um recorte, não uma exclusão). */
export const ADMIN_ESTADOS = Object.freeze({
  ocultos: 'Ocultos',
  destaques: 'Destaques',
  semente: 'Biblioteca inicial',
  ia: 'Com ajuda de IA',
});

const ESTADO_TESTE = {
  ocultos: (it) => it.hidden === true,
  destaques: (it) => it.featured === true,
  semente: (it) => !!it.seed_slug,
  ia: (it) => it.ai_assisted === true,
};

/** Os itens do admin, filtrados. Busca no título, autor, id e slug da semente. */
export function filterAdminItems(items = [], f = EMPTY_ADMIN_FILTERS) {
  const termos = normalizeText(f.q).split(/\s+/).filter(Boolean);
  return items.filter((it) => {
    if (f.kind && it.kind !== f.kind) return false;
    if (f.role && it.author_role !== f.role) return false;
    if (f.visibility && it.visibility !== f.visibility) return false;
    if (f.review && it.review !== f.review) return false;
    if (f.estado && !ESTADO_TESTE[f.estado]?.(it)) return false;
    if (!termos.length) return true;
    const alvo = normalizeText([it.title, it.author_name, it.id, it.seed_slug].filter(Boolean).join(' '));
    return termos.every((t) => alvo.includes(t));
  });
}

/** Mais recentes primeiro (o que acabou de mudar é o que se procura). */
export function sortAdminItems(items = []) {
  return [...items].sort((a, b) => (timeMs(b.updated_at || b.created_at) - timeMs(a.updated_at || a.created_at)));
}

/** É da fila de revisão? */
export const isPendingReview = (it) => it.visibility === VISIBILITY.PUBLICO && it.review === REVIEW.PENDENTE && !it.legacy;

/** A fila: os públicos pendentes, os mais ANTIGOS primeiro (quem espera há mais tempo). */
export function reviewQueue(items = []) {
  return items.filter(isPendingReview).sort((a, b) => timeMs(a.updated_at || a.created_at) - timeMs(b.updated_at || b.created_at));
}

/**
 * Totais para o topo do painel.
 * @returns {{ total: number, byKind: Record<string, number>, byRole: Record<string, number>,
 *   pendentes: number, ocultos: number, destaques: number, semente: number }}
 */
export function adminItemCounts(items = []) {
  const byKind = Object.fromEntries(ITEM_KINDS.map((k) => [k, 0]));
  const byRole = { plataforma: 0, professor: 0, atleta: 0 };
  let pendentes = 0;
  let ocultos = 0;
  let destaques = 0;
  let semente = 0;
  for (const it of items) {
    if (byKind[it.kind] !== undefined) byKind[it.kind] += 1;
    if (byRole[it.author_role] !== undefined) byRole[it.author_role] += 1;
    if (isPendingReview(it)) pendentes += 1;
    if (it.hidden === true) ocultos += 1;
    if (it.featured === true) destaques += 1;
    if (it.seed_slug) semente += 1;
  }
  return { total: items.length, byKind, byRole, pendentes, ocultos, destaques, semente };
}

/** Denúncias: abertas primeiro (as mais antigas na frente); as decididas, as mais novas primeiro. */
export function sortReports(reports = []) {
  const abertas = reports.filter((r) => r.status === 'aberta')
    .sort((a, b) => timeMs(a.created_at) - timeMs(b.created_at));
  const outras = reports.filter((r) => r.status !== 'aberta')
    .sort((a, b) => timeMs(b.resolved_at || b.created_at) - timeMs(a.resolved_at || a.created_at));
  return { abertas, outras };
}

/** Quantas denúncias ABERTAS cada item tem. */
export function openReportsByItem(reports = []) {
  const m = new Map();
  for (const r of reports) if (r.status === 'aberta' && r.item_id) m.set(r.item_id, (m.get(r.item_id) || 0) + 1);
  return m;
}
