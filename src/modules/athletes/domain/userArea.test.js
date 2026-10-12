import { describe, it, expect } from 'vitest';
import {
  USER_AREA_SECTION as S, resolveUserAreaSection, userAreaPending, userAreaSections,
} from './userArea';

const ids = (secoes) => secoes.map((s) => s.id);

describe('userAreaSections', () => {
  it('quem não tem papel vê as seções de todos, na ordem do plano', () => {
    expect(ids(userAreaSections({}))).toEqual([S.RESUMO, S.PERFIL, S.TREINO, S.JOGOS, S.TORNEIOS, S.TROFEUS]);
  });

  it('cada papel traz a sua seção — dez no total, nunca mais', () => {
    const tudo = userAreaSections({ professor: true, arenas: true, clubes: true, admin: true });
    expect(ids(tudo)).toEqual([
      S.RESUMO, S.PERFIL, S.TREINO, S.JOGOS, S.TORNEIOS, S.TROFEUS, S.CLUBES, S.PROFESSOR, S.ARENAS, S.ADMIN,
    ]);
    expect(tudo).toHaveLength(10);
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
});
