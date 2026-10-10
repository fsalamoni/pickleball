import { describe, it, expect } from 'vitest';
import { bottomNavItems, treinoRecente, arenaPrincipal, TREINO_RECENTE_DIAS } from './bottomNav.js';

const AGORA = Date.parse('2026-10-10T15:00:00-03:00');
const DIA = 24 * 60 * 60 * 1000;
const ids = (p) => bottomNavItems(p).map((i) => i.id);

describe('bottomNavItems — cinco itens, o quarto muda com a pessoa', () => {
  it('atleta sem nada: Torneios é o padrão', () => {
    expect(ids({})).toEqual(['inicio', 'jogar', 'arenas', 'torneios', 'minha-area']);
  });

  it('sempre 5 itens, Início exato, Jogar abre no Dia de jogo, Minha área por último', () => {
    const itens = bottomNavItems({ ehProfessor: true });
    expect(itens).toHaveLength(5);
    expect(itens[0]).toMatchObject({ to: '/', exact: true });
    expect(itens[1].to).toBe('/dia-de-jogo');
    expect(itens[4]).toMatchObject({ to: '/perfil', label: 'Minha área' });
  });

  it('quem abriu o Treino há menos de 14 dias vê Treino', () => {
    expect(ids({ treinoUltimoAcessoMs: AGORA - 3 * DIA, agoraMs: AGORA })[3]).toBe('treino');
    expect(ids({ treinoUltimoAcessoMs: AGORA - 15 * DIA, agoraMs: AGORA })[3]).toBe('torneios');
  });

  it('torneio atual vence o treino recente', () => {
    expect(ids({ temTorneioAtual: true, treinoUltimoAcessoMs: AGORA - DIA, agoraMs: AGORA })[3]).toBe('torneios');
  });

  it('professor vê o Painel (em /aulas), mesmo com torneio e treino', () => {
    const itens = bottomNavItems({ ehProfessor: true, temTorneioAtual: true, treinoUltimoAcessoMs: AGORA, agoraMs: AGORA });
    expect(itens[3]).toMatchObject({ id: 'painel', to: '/aulas' });
  });

  it('gestor de arena vê a Central da arena com mais pendências, com o selo', () => {
    const itens = bottomNavItems({
      ehProfessor: true,
      arenas: [{ id: 'a1', pendencias: 0 }, { id: 'a2', pendencias: 3 }],
    });
    expect(itens[3]).toMatchObject({ id: 'central', to: '/arenas/a2/gerir', badge: 3 });
  });

  it('gestor sem pendência nenhuma: a primeira arena, selo 0', () => {
    expect(bottomNavItems({ arenas: [{ id: 'a1' }, { id: 'a2' }] })[3]).toMatchObject({ to: '/arenas/a1/gerir', badge: 0 });
  });

  it('arena sem id não conta', () => {
    expect(arenaPrincipal([{ pendencias: 9 }])).toBeNull();
    expect(ids({ arenas: [{}] })[3]).toBe('torneios');
  });
});

describe('treinoRecente', () => {
  it('vale até o limite, inclusive; nada ou lixo é falso', () => {
    expect(treinoRecente(AGORA - TREINO_RECENTE_DIAS * DIA, AGORA)).toBe(true);
    expect(treinoRecente(AGORA - TREINO_RECENTE_DIAS * DIA - 1, AGORA)).toBe(false);
    expect(treinoRecente(null, AGORA)).toBe(false);
    expect(treinoRecente(NaN, AGORA)).toBe(false);
    expect(treinoRecente(0, AGORA)).toBe(false);
  });
});
