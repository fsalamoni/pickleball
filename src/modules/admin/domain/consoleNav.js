/**
 * A navegação do Painel admin (Fase 3.4 do plano de UX): a busca de
 * configuração ("onde ligo X?"), os ids antigos de aba e o que uma ação em
 * massa sobre as flags vai mudar — tudo puro, testado sem montar a tela.
 */
import { normalizeLocality as normalizar } from '../../../core/domain/locality.js';

/** Abas que mudaram de lugar continuam abrindo (links em avisos e favoritos). */
export const ADMIN_TAB_ALIASES = Object.freeze({
  // Perfis entrou em Cadastros (uma pessoa, um lugar).
  profiles: 'records',
});

/** A aba de verdade pedida na URL, ou `overview` quando não existe. */
export function resolveAdminTab(pedida, allTabs = []) {
  const alvo = ADMIN_TAB_ALIASES[pedida] || pedida;
  return allTabs.some((t) => t.id === alvo) ? alvo : 'overview';
}

/**
 * Busca de configuração: casa no nome da aba, no da seção e nas palavras-chave,
 * sem acento e sem caixa. Vazia, devolve nada (a lista inteira já está na
 * barra). Ordem: começa com o termo primeiro, depois contém.
 * @returns {{ id: string, label: string, secao: string, secaoId: string }[]}
 */
export function searchAdminTabs(sections = [], query = '') {
  const q = normalizar(query);
  if (!q) return [];
  const out = [];
  for (const s of sections) {
    for (const t of s.tabs) {
      const alvos = [t.label, s.label, ...(t.keywords || [])].map(normalizar);
      const comeca = alvos.some((a) => a.startsWith(q));
      const contem = comeca || alvos.some((a) => a.includes(q));
      if (contem) out.push({ id: t.id, label: t.label, secao: s.label, secaoId: s.id, peso: comeca ? 0 : 1 });
    }
  }
  return out.sort((a, b) => a.peso - b.peso).map(({ peso: _p, ...r }) => r);
}

/** As flags que uma ação em massa de fato muda (as já no estado pedido ficam). */
export function flagsQueMudam(keys = [], flags = {}, ligar) {
  return keys.filter((k) => Boolean(flags?.[k]) !== Boolean(ligar));
}
