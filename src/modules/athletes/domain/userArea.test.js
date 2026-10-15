import { describe, it, expect } from 'vitest';
import {
  USER_AREA_SECTION as S, marketPendingCounts, resolveUserAreaSection, userAreaPending, userAreaSections,
} from './userArea';

const ids = (secoes) => secoes.map((s) => s.id);

describe('userAreaSections', () => {
  it('quem não tem papel vê as seções de todos, na ordem do plano', () => {
    expect(ids(userAreaSections({}))).toEqual([S.RESUMO, S.PERFIL, S.TREINO, S.JOGOS, S.TORNEIOS, S.TROFEUS]);
  });

  it('cada papel traz a sua seção — onze no total, nunca mais', () => {
    const tudo = userAreaSections({ professor: true, arenas: true, clubes: true, admin: true, mercado: true });
    expect(ids(tudo)).toEqual([
      S.RESUMO, S.PERFIL, S.TREINO, S.JOGOS, S.TORNEIOS, S.TROFEUS, S.MERCADO, S.CLUBES, S.PROFESSOR, S.ARENAS, S.ADMIN,
    ]);
    expect(tudo).toHaveLength(11);
    expect(tudo.find((s) => s.id === S.MERCADO)).toMatchObject({ grupo: 'voce', icone: 'ShoppingBag' });
    expect(tudo.find((s) => s.id === S.ARENAS)).toMatchObject({ grupo: 'gestao', dica: 'minha-area-arenas' });
  });

  it('leitura que falhou mostra a seção (é nela que aparece o erro); carregando, não', () => {
    expect(ids(userAreaSections({ arenas: 'erro' }))).toContain(S.ARENAS);
    expect(ids(userAreaSections({ arenas: undefined }))).not.toContain(S.ARENAS);
    expect(ids(userAreaSections({ arenas: false }))).not.toContain(S.ARENAS);
  });

  it('seção pedida que a pessoa não vê cai no resumo', () => {
    const secoes = userAreaSections({});
    expect(resolveUserAreaSection('arenas', secoes)).toBe(S.RESUMO);
    expect(resolveUserAreaSection('jogos', secoes)).toBe(S.JOGOS);
    expect(resolveUserAreaSection(null, secoes)).toBe(S.RESUMO);
  });

  it('⭐ link antigo (`?secao=conta`, `jogo`, `agenda`) cai na seção que o absorveu', () => {
    const secoes = userAreaSections({});
    expect(resolveUserAreaSection('conta', secoes)).toBe(S.PERFIL);
    expect(resolveUserAreaSection('jogo', secoes)).toBe(S.JOGOS);
    expect(resolveUserAreaSection('agenda', secoes)).toBe(S.JOGOS);
  });
});

describe('userAreaPending', () => {
  it('fonte desconhecida não vira zero nem item', () => {
    expect(userAreaPending({})).toEqual([]);
    expect(userAreaPending({ arenas: [{ id: 'a1', name: 'Arena', pendentes: undefined }] })).toEqual([]);
  });

  it('cada pendência leva ao lugar que resolve, com a conta certa', () => {
    const itens = userAreaPending({
      arenas: [{ id: 'a1', name: 'Arena Sol', pendentes: 2 }, { id: 'a2', pendentes: 0 }],
      aulasAResponder: 1,
      convitesClube: [{ id: 'c' }],
      convitesEvento: [{ status: 'invited' }, { status: 'going' }],
      duvidasEsperando: 0,
      treinosNaoLidos: 3,
      balancosPendentes: 2,
    });
    expect(itens.map((i) => [i.id, i.count])).toEqual([
      ['arena:a1', 2], ['aulas', 1], ['convites-clube', 1], ['convites-evento', 1], ['treinos', 3], ['balancos', 2],
    ]);
    expect(itens[5]).toMatchObject({ to: '/treino?aba=balanco', label: '2 jogos esperando o seu balanço' });
    expect(itens[0]).toMatchObject({ to: '/arenas/a1/gerir?aba=reservas', detalhe: 'Arena Sol', label: '2 pedidos de reserva esperando resposta' });
    expect(itens[2]).toMatchObject({ secao: S.CLUBES, label: '1 convite para entrar num clube' });
  });

  it('⭐ Mercado: lista desconhecida não vira zero; cada pendência leva à aba que resolve', () => {
    const now = 1_000_000;
    const contas = marketPendingCounts({
      sellerOrders: [{ status: 'placed' }, { status: 'payment_review' }, { status: 'paid' }, { status: 'ready' }, { status: 'shipped' }, { status: 'completed' }],
      sellerOffers: [{ status: 'pending', expires_at_ms: now + 1 }, { status: 'pending', expires_at_ms: now - 1 }, { status: 'countered' }],
      sellerQuestions: undefined,
      myOrders: [{ status: 'accepted' }, { status: 'shipped' }, { status: 'delivered', fulfillment: 'digital' }, { status: 'delivered', fulfillment: 'pickup' }, { status: 'placed' }],
      myOffers: [{ status: 'countered', expires_at_ms: now + 1 }, { status: 'pending' }],
    }, now);
    expect(contas).toEqual({ vendas: 4, ofertas: 1, perguntas: undefined, pagar: 1, receber: 2, contrapropostas: 1 });
    expect(marketPendingCounts({})).toEqual({ vendas: undefined, ofertas: undefined, perguntas: undefined, pagar: undefined, receber: undefined, contrapropostas: undefined });

    const itens = userAreaPending({ mercado: contas });
    expect(itens.map((i) => [i.id, i.count, i.to])).toEqual([
      ['mercado:vendas', 4, '/mercado/vender?aba=vendas'],
      ['mercado:ofertas', 1, '/mercado/vender?aba=ofertas'],
      ['mercado:pagar', 1, '/mercado/pedidos'],
      ['mercado:receber', 2, '/mercado/pedidos'],
      ['mercado:contrapropostas', 1, '/mercado/pedidos?aba=ofertas'],
    ]);
    expect(itens[0].label).toBe('4 vendas no Mercado esperando você');
    expect(userAreaPending({ mercado: marketPendingCounts({}) })).toEqual([]);
  });
});
