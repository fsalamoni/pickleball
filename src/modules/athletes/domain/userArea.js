/**
 * MINHA ÁREA (flag `user_hub`): o `/perfil` como a central da pessoa.
 *
 * Duas respostas puras, para a tela não decidir nada sozinha:
 *  - `userAreaSections(papeis, flags)`: as seções que ESTA pessoa vê, na
 *    ordem do plano aprovado. Seção que não é do papel não existe — e, como a
 *    tela só monta a seção aberta, também não consulta nada.
 *  - `userAreaPending(fontes)`: a faixa "Precisa de você". Fonte `undefined`
 *    (não carregou OU falhou) não entra e NUNCA vira zero — a faixa não afirma
 *    "tudo em dia" sem saber. As contas são as MESMAS das telas que resolvem.
 *
 * Papel: `true` (é), `false` (não é), `'erro'` (a leitura falhou) ou
 * `undefined` (carregando). Seção de papel aparece com `true` e com `'erro'` —
 * no segundo caso é ela que mostra a falha e o "Tentar de novo", em vez de a
 * pessoa achar que perdeu a arena.
 */

import { t, tn, tk } from '@/core/i18n';

export const USER_AREA_SECTION = Object.freeze({
  RESUMO: 'resumo',
  /** Perfil e conta (eram duas seções até a Fase 3 do plano de UX, 2026-10-11). */
  PERFIL: 'perfil',
  TREINO: 'treino',
  /** Meus jogos: o que vem e o que foi (eram "Jogo" e "Agenda"). */
  JOGOS: 'jogos',
  TORNEIOS: 'torneios',
  TROFEUS: 'trofeus',
  /** Mercado (flag `marketplace`): comprando e vendendo. */
  MERCADO: 'mercado',
  FEDERACOES: 'federacoes',
  CLUBES: 'clubes',
  PROFESSOR: 'professor',
  ARENAS: 'arenas',
  ADMIN: 'admin',
});

/** Ids antigos nos links guardados (`?secao=`): caem na seção que os absorveu. */
const SECAO_ANTIGA = Object.freeze({ jogo: 'jogos', agenda: 'jogos', conta: 'perfil' });

/** As duas linhas da barra: o que é da pessoa e o que ela gere. */
export const USER_AREA_GROUPS = Object.freeze([
  { id: 'voce', label: tk('Você') },
  { id: 'gestao', label: tk('Gerencio') },
]);

const S = USER_AREA_SECTION;

/**
 * Ordem = a do plano. `quem`: 'todos' ou um papel (`professor`, `arenas`,
 * `clubes`, `admin`).
 */
const META = Object.freeze([
  { id: S.RESUMO, label: tk('Resumo'), icone: 'LayoutGrid', grupo: 'voce', quem: 'todos' },
  { id: S.PERFIL, label: tk('Perfil e conta'), icone: 'User', grupo: 'voce', quem: 'todos' },
  { id: S.TREINO, label: tk('Treino'), icone: 'Dumbbell', grupo: 'voce', quem: 'todos' },
  { id: S.JOGOS, label: tk('Meus jogos'), icone: 'Swords', grupo: 'voce', quem: 'todos' },
  { id: S.TORNEIOS, label: tk('Torneios'), icone: 'Trophy', grupo: 'voce', quem: 'todos' },
  { id: S.TROFEUS, label: tk('Troféus'), icone: 'Medal', grupo: 'voce', quem: 'todos' },
  { id: S.MERCADO, label: tk('Mercado'), icone: 'ShoppingBag', grupo: 'voce', quem: 'mercado' },
  { id: S.FEDERACOES, label: tk('Federações'), icone: 'Landmark', grupo: 'voce', quem: 'federacoes' },
  { id: S.CLUBES, label: tk('Clubes'), icone: 'Users', grupo: 'voce', quem: 'clubes' },
  { id: S.PROFESSOR, label: tk('Professor'), icone: 'GraduationCap', grupo: 'gestao', quem: 'professor' },
  { id: S.ARENAS, label: tk('Arenas'), icone: 'Building2', grupo: 'gestao', quem: 'arenas' },
  { id: S.ADMIN, label: tk('Admin'), icone: 'LayoutDashboard', grupo: 'gestao', quem: 'admin' },
]);

const temPapel = (v) => v === true || v === 'erro';

/**
 * @param {{ professor?: boolean|'erro', arenas?: boolean|'erro', clubes?: boolean|'erro', admin?: boolean, mercado?: boolean, federacoes?: boolean|'erro' }} papeis
 *   `mercado` = a flag `marketplace` ligada; `federacoes` = a flag `federations` ligada E a pessoa tem filiação ou papel
 * @returns {Array<{ id: string, label: string, icone: string, grupo: string, dica: string }>}
 */
export function userAreaSections(papeis = {}) {
  return META
    .filter((s) => s.quem === 'todos' || temPapel(papeis[s.quem]))
    .map(({ id, label, icone, grupo }) => ({ id, label, icone, grupo, dica: `minha-area-${id}` }));
}

/** A seção pedida na URL (ou a que absorveu um id antigo), se esta pessoa a vê; senão o resumo. */
export function resolveUserAreaSection(pedida, secoes = []) {
  const id = SECAO_ANTIGA[pedida] || pedida;
  return secoes.some((s) => s.id === id) ? id : S.RESUMO;
}

const lista = (x) => (Array.isArray(x) ? x : undefined);

/** Mercado: os estados em que a VENDA espera o vendedor (a mesma conta do Resumo de `/mercado/vender`). */
const VENDA_ESPERA_VENDEDOR = ['placed', 'payment_review', 'paid', 'ready'];
const ofertaViva = (o, now) => !(Number(o?.expires_at_ms) && now > Number(o.expires_at_ms));

/**
 * As contas do Mercado para a faixa. Cada lista `undefined` (não carregou,
 * falhou ou a pessoa não vende) devolve `undefined` na conta — nunca zero.
 *
 * @param {{ sellerOrders?: object[], sellerOffers?: object[], sellerQuestions?: object[], myOrders?: object[], myOffers?: object[] }} l
 */
export function marketPendingCounts(l = {}, now = Date.now()) {
  const conta = (x, fn) => lista(x)?.filter(fn).length;
  return {
    vendas: conta(l.sellerOrders, (o) => VENDA_ESPERA_VENDEDOR.includes(o?.status)),
    ofertas: conta(l.sellerOffers, (o) => o?.status === 'pending' && ofertaViva(o, now)),
    perguntas: conta(l.sellerQuestions, (q) => q?.status === 'open'),
    pagar: conta(l.myOrders, (o) => o?.status === 'accepted'),
    // Vale-presente entregue já está na conta: não há o que confirmar.
    receber: conta(l.myOrders, (o) => ['shipped', 'ready'].includes(o?.status) || (o?.status === 'delivered' && o?.fulfillment !== 'digital')),
    contrapropostas: conta(l.myOffers, (o) => o?.status === 'countered' && ofertaViva(o, now)),
  };
}

const MERCADO_PENDENCIAS = [
  ['vendas', '/mercado/vender?aba=vendas'],
  ['ofertas', '/mercado/vender?aba=ofertas'],
  ['perguntas', '/mercado/vender?aba=perguntas'],
  ['pagar', '/mercado/pedidos'],
  ['receber', '/mercado/pedidos'],
  ['contrapropostas', '/mercado/pedidos?aba=ofertas'],
];
const numero = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);

/**
 * "Precisa de você". Cada item leva ao lugar que resolve: `to` (outra tela)
 * ou `secao` (uma seção da Minha área).
 *
 * @param {{
 *   arenas?: Array<{ id: string, name?: string, pendentes?: number }>,
 *   convitesClube?: object[],
 *   convitesEvento?: object[],
 *   aulasAResponder?: number,
 *   treinosNaoLidos?: number,
 *   duvidasEsperando?: number,
 *   mercado?: ReturnType<typeof marketPendingCounts>,
 *   federacoes?: { pagar?: number, vencendo?: number, vencida?: number },
 * }} fontes cada uma `undefined` quando não carregou ou falhou
 * @returns {Array<{ id: string, count: number, label: string, detalhe?: string, to?: string, secao?: string }>}
 */
export function userAreaPending(fontes = {}) {
  const itens = [];

  for (const a of lista(fontes.arenas) || []) {
    const n = numero(a?.pendentes);
    if (!a?.id || !n) continue;
    itens.push({
      id: `arena:${a.id}`, count: n, detalhe: a.name || t('Arena'),
      label: tn(n, '{n} pedido de reserva esperando resposta', '{n} pedidos de reserva esperando resposta'),
      to: `/arenas/${a.id}/gerir?aba=reservas`,
    });
  }

  const aulas = numero(fontes.aulasAResponder);
  if (aulas) {
    itens.push({
      id: 'aulas', count: aulas, to: '/aulas?aba=agenda',
      label: tn(aulas, '{n} pedido de aula esperando resposta', '{n} pedidos de aula esperando resposta'),
    });
  }

  const convites = lista(fontes.convitesClube);
  if (convites?.length) {
    itens.push({
      id: 'convites-clube', count: convites.length, secao: S.CLUBES,
      label: tn(convites.length, '{n} convite para entrar num clube', '{n} convites para entrar em clubes'),
    });
  }

  // Convite de evento só "precisa de você" enquanto não foi respondido.
  const eventos = lista(fontes.convitesEvento)?.filter((i) => i?.status === 'invited');
  if (eventos?.length) {
    itens.push({
      id: 'convites-evento', count: eventos.length, secao: S.CLUBES,
      label: tn(eventos.length, '{n} convite para evento de clube', '{n} convites para eventos de clube'),
    });
  }

  const duvidas = numero(fontes.duvidasEsperando);
  if (duvidas) {
    itens.push({
      id: 'duvidas', count: duvidas, to: '/treino?aba=duvidas',
      label: tn(duvidas, '{n} dúvida de treino esperando você', '{n} dúvidas de treino esperando você'),
    });
  }

  const treinos = numero(fontes.treinosNaoLidos);
  if (treinos) {
    itens.push({
      id: 'treinos', count: treinos, to: '/treino?aba=recebidos',
      label: tn(treinos, '{n} treino recebido para ver', '{n} treinos recebidos para ver'),
    });
  }

  // Só chega aqui quem ligou o balanço do jogo para si (flag `game_debrief`).
  const balancos = numero(fontes.balancosPendentes);
  if (balancos) {
    itens.push({
      id: 'balancos', count: balancos, to: '/treino?aba=balanco',
      label: tn(balancos, '{n} jogo esperando o seu balanço', '{n} jogos esperando o seu balanço'),
    });
  }

  // tn com literais (o guarda de idiomas lê as chaves daqui).
  const rotulo = {
    vendas: (n) => tn(n, '{n} venda no Mercado esperando você', '{n} vendas no Mercado esperando você'),
    ofertas: (n) => tn(n, '{n} oferta no Mercado para responder', '{n} ofertas no Mercado para responder'),
    perguntas: (n) => tn(n, '{n} pergunta de comprador sem resposta', '{n} perguntas de comprador sem resposta'),
    pagar: (n) => tn(n, '{n} compra esperando o seu Pix', '{n} compras esperando o seu Pix'),
    receber: (n) => tn(n, '{n} compra para confirmar o recebimento', '{n} compras para confirmar o recebimento'),
    contrapropostas: (n) => tn(n, '{n} contraproposta do vendedor para responder', '{n} contrapropostas do vendedor para responder'),
  };
  for (const [id, to] of MERCADO_PENDENCIAS) {
    const n = numero(fontes.mercado?.[id]);
    if (n) itens.push({ id: `mercado:${id}`, count: n, to, label: rotulo[id](n) });
  }

  // Federações: a cobrança espera o Pix; a filiação vencendo ou vencida espera a renovação.
  const fedRotulo = {
    pagar: (n) => tn(n, '{n} cobrança da federação esperando o seu Pix', '{n} cobranças de federação esperando o seu Pix'),
    vencendo: (n) => tn(n, '{n} filiação vencendo em 30 dias', '{n} filiações vencendo em 30 dias'),
    vencida: (n) => tn(n, '{n} filiação vencida para renovar', '{n} filiações vencidas para renovar'),
  };
  for (const id of ['pagar', 'vencendo', 'vencida']) {
    const n = numero(fontes.federacoes?.[id]);
    if (n) itens.push({ id: `federacoes:${id}`, count: n, secao: S.FEDERACOES, label: fedRotulo[id](n) });
  }

  return itens;
}

/** O ano em que a conta foi criada (o "Membro desde"), ou `null`. */
export function memberSince(profile) {
  const ts = profile?.created_at;
  const date = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.getFullYear();
}
