/**
 * "Precisa de você" do Painel admin: o que está esperando uma decisão do admin,
 * reunido num lugar só. Antes cada fila morava numa aba (revisão de treino,
 * denúncias, sinais da gamificação…) e o admin tinha de lembrar de abrir cada uma.
 *
 * Puro. Regra que importa: fonte que não carregou é `desconhecido`, NUNCA zero —
 * "nada pendente" dito sobre uma consulta que falhou é a mentira de sempre.
 */
import { t, tk, tn } from '../../../core/i18n/index.js';

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
    { id: 'revisao', tab: 'treino-revisao', label: tk('Conteúdo de treino esperando revisão'), qtd: (n) => tn(n, '{n} item', '{n} itens') },
    { id: 'denuncias', tab: 'treino-denuncias', label: tk('Denúncias de treino abertas'), qtd: (n) => tn(n, '{n} denúncia', '{n} denúncias') },
    { id: 'sinais', tab: 'gam-integrity', label: tk('Sinais de integridade na gamificação'), qtd: (n) => tn(n, '{n} sinal', '{n} sinais') },
    { id: 'cartas', tab: 'gam-integrity', label: tk('Cartas denunciadas'), qtd: (n) => tn(n, '{n} carta', '{n} cartas') },
    { id: 'ranking', tab: 'overview', label: tk('Recálculo do ranking com erro'), qtd: (n) => tn(n, '{n} erro', '{n} erros') },
    { id: 'suspensoes', tab: 'records', label: tk('Suspensões com prazo vencido (reativar ou bloquear)'), qtd: (n) => tn(n, '{n} conta', '{n} contas') },
    // Só existe com o Mercado ligado: sem a fonte, a linha nem aparece.
    { id: 'lojas', tab: 'mercado-lojas', label: tk('Lojas do Mercado esperando aprovação'), qtd: (n) => tn(n, '{n} loja', '{n} lojas'), opcional: true },
    { id: 'disputasMercado', tab: 'mercado-disputas', label: tk('Problemas em pedidos do Mercado'), qtd: (n) => tn(n, '{n} pedido', '{n} pedidos'), opcional: true },
    { id: 'federacoes', tab: 'federacoes', label: tk('Federações esperando aprovação'), qtd: (n) => tn(n, '{n} federação', '{n} federações'), opcional: true },
    { id: 'denunciasMercado', tab: 'mercado-anuncios', label: tk('Anúncios do Mercado denunciados'), qtd: (n) => tn(n, '{n} anúncio', '{n} anúncios'), opcional: true },
  ].filter((d) => !d.opcional || d.id in fontes);
  return defs.map((d) => {
    const f = fontes[d.id];
    if (!lida(f)) return { id: d.id, tab: d.tab, label: t(d.label), count: null, atencao: false, detalhe: t('Não deu para verificar agora') };
    const n = f.count;
    return {
      id: d.id, tab: d.tab, label: t(d.label), count: n, atencao: n > 0,
      detalhe: n > 0 ? d.qtd(n) : t('Nada para decidir'),
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
