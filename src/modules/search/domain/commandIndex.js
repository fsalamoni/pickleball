/**
 * Índice da PALETA DE COMANDOS (plano de UX §5.4), lógica pura.
 *
 * A paleta responde a "quero fazer X" e "quero ir para Y" sem a pessoa saber
 * onde Y mora no menu. Duas fontes locais, sem consulta:
 *  - AÇÕES: verbos por papel (reservar, criar dia de jogo, entrar num jogo…);
 *  - TELAS: os hubs e as abas do menu, com o MESMO rótulo do menu — a árvore
 *    `hubs` já vem filtrada por papel pelo `useV2Nav`, então aqui não há lista
 *    de rotas escrita à mão para divergir.
 * Atletas, torneios, arenas e clubes vêm de `searchAll` (as consultas do
 * `/buscar`, sem consulta nova); a ajuda, de `searchHelp`. Cada uma é
 * agrupada pela tela.
 */
import { normalizeText } from '../../athletes/domain/globalSearch.js';

export const RECENTES_MAX = 6;

/**
 * @param {{ hubs?: Array, arenas?: Array<{id,name}>, treinoOn?: boolean,
 *           isPlatformAdmin?: boolean, mercadoOn?: boolean, rotulos?: object }} ctx
 */
export function commandIndex(ctx = {}) {
  const { hubs = [], arenas = [], treinoOn = false, isPlatformAdmin = false, mercadoOn = false } = ctx;
  const acoes = [
    { id: 'acao:reservar', label: 'Reservar quadra', to: '/arenas', icon: 'Building2' },
    { id: 'acao:dia-de-jogo', label: 'Criar dia de jogo', to: '/dia-de-jogo?criar=1', icon: 'Dices' },
    { id: 'acao:entrar', label: 'Entrar num jogo', to: '/procura-jogo', icon: 'Swords' },
    treinoOn && { id: 'acao:treino', label: 'Meus treinos', to: '/treino', icon: 'Dumbbell' },
    mercadoOn && { id: 'acao:mercado', label: 'Comprar no Mercado', to: '/mercado', icon: 'Store' },
    mercadoOn && { id: 'acao:anunciar', label: 'Anunciar no Mercado', to: '/mercado/vender', icon: 'Store' },
    ...arenas.filter((a) => a?.id).map((a) => ({
      id: `acao:central:${a.id}`, label: `Abrir a Central da arena ${a.name || ''}`.trim(), to: `/arenas/${a.id}/gerir`, icon: 'LayoutDashboard',
    })),
    isPlatformAdmin && { id: 'acao:admin', label: 'Painel admin', to: '/admin/painel', icon: 'LayoutDashboard' },
  ].filter(Boolean);

  const vistos = new Set();
  const telas = [];
  for (const hub of hubs) {
    const entradas = [{ to: hub.to, label: hub.label }, ...(hub.children || []).map((c) => ({
      to: c.to, label: c.label === hub.label ? c.label : `${hub.label} › ${c.label}`,
    }))];
    for (const e of entradas) {
      if (!e?.to || vistos.has(e.to)) continue;
      vistos.add(e.to);
      telas.push({ id: `tela:${e.to}`, label: e.label, to: e.to, icon: 'ChevronRight' });
    }
  }
  return { acoes, telas };
}

/** Os itens locais (ações e telas) que casam com o termo; sem termo, as ações. */
export function filtrarComandos(termo, indice, { limite = 6 } = {}) {
  const t = normalizeText(termo);
  const casa = (item) => !t || normalizeText(item.label).includes(t);
  return {
    acoes: indice.acoes.filter(casa).slice(0, limite),
    telas: t ? indice.telas.filter(casa).slice(0, limite) : [],
  };
}

/**
 * Com o Mercado ligado e um termo digitado, o atalho "Buscar “termo” no
 * Mercado" — a busca dos anúncios é a do próprio Mercado (filtros, ordenação),
 * então a paleta só leva até lá, sem consulta própria.
 */
export function buscaNoMercado(termo, mercadoOn) {
  const t = String(termo || '').trim();
  if (!mercadoOn || t.length < 2) return null;
  return { id: 'acao:mercado-busca', label: `Buscar “${t}” no Mercado`, to: `/mercado?q=${encodeURIComponent(t)}`, icon: 'Store' };
}

/** Guarda um destino escolhido no topo dos recentes (sem repetir, no máximo RECENTES_MAX). */
export function lembrarRecente(recentes, item) {
  if (!item?.to) return recentes || [];
  const sem = (recentes || []).filter((r) => r?.to !== item.to);
  return [{ label: item.label, to: item.to }, ...sem].slice(0, RECENTES_MAX);
}
