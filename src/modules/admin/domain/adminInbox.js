/**
 * "Precisa de você" do Painel admin: o que está esperando uma decisão do admin,
 * reunido num lugar só. Antes cada fila morava numa aba (revisão de treino,
 * denúncias, sinais da gamificação…) e o admin tinha de lembrar de abrir cada uma.
 *
 * Puro. Regra que importa: fonte que não carregou é `desconhecido`, NUNCA zero —
 * "nada pendente" dito sobre uma consulta que falhou é a mentira de sempre.
 */

/** Uma fonte lida: `{ ok: true, count }` ou `{ ok: false }` (carregando ou falhou). */
const lida = (f) => f && f.ok === true && Number.isFinite(f.count);

/**
 * @param {Record<string, { ok: boolean, count?: number }>} fontes
 *   revisao, denuncias, sinais, cartas, ranking (ranking: count 1 = problema na última passada), suspensoes,
 *   lojas, disputasMercado, denunciasMercado (opcionais: só com o Mercado ligado)
 * @returns {Array<{ id: string, tab: string, label: string, count: number|null, atencao: boolean, detalhe: string }>}
 */
export function buildInbox(fontes = {}) {
  const defs = [
    { id: 'revisao', tab: 'treino-revisao', label: 'Conteúdo de treino esperando revisão', um: 'item', varios: 'itens' },
    { id: 'denuncias', tab: 'treino-denuncias', label: 'Denúncias de treino abertas', um: 'denúncia', varios: 'denúncias' },
    { id: 'sinais', tab: 'gam-integrity', label: 'Sinais de integridade na gamificação', um: 'sinal', varios: 'sinais' },
    { id: 'cartas', tab: 'gam-integrity', label: 'Cartas denunciadas', um: 'carta', varios: 'cartas' },
    { id: 'ranking', tab: 'overview', label: 'Recálculo do ranking com erro', um: 'erro', varios: 'erros' },
    { id: 'suspensoes', tab: 'records', label: 'Suspensões com prazo vencido (reativar ou bloquear)', um: 'conta', varios: 'contas' },
    // Só existe com o Mercado ligado: sem a fonte, a linha nem aparece.
    { id: 'lojas', tab: 'mercado-lojas', label: 'Lojas do Mercado esperando aprovação', um: 'loja', varios: 'lojas', opcional: true },
    { id: 'disputasMercado', tab: 'mercado-disputas', label: 'Problemas em pedidos do Mercado', um: 'pedido', varios: 'pedidos', opcional: true },
    { id: 'denunciasMercado', tab: 'mercado-anuncios', label: 'Anúncios do Mercado denunciados', um: 'anúncio', varios: 'anúncios', opcional: true },
  ].filter((d) => !d.opcional || d.id in fontes);
  return defs.map((d) => {
    const f = fontes[d.id];
    if (!lida(f)) return { id: d.id, tab: d.tab, label: d.label, count: null, atencao: false, detalhe: 'Não deu para verificar agora' };
    const n = f.count;
    return {
      id: d.id, tab: d.tab, label: d.label, count: n, atencao: n > 0,
      detalhe: n > 0 ? `${n} ${n === 1 ? d.um : d.varios}` : 'Nada para decidir',
    };
  });
}

/** Quantas pendências cada aba tem (só as lidas e acima de zero) — vira o selo da barra. */
export function inboxBadges(itens = []) {
  const out = {};
  for (const i of itens) if (i.count > 0) out[i.tab] = (out[i.tab] || 0) + i.count;
  return out;
}

/** Total de pendências conhecidas e se alguma fonte ficou sem resposta. */
export function inboxTotals(itens = []) {
  return {
    total: itens.reduce((a, i) => a + (i.count > 0 ? i.count : 0), 0),
    incompleto: itens.some((i) => i.count === null),
  };
}
