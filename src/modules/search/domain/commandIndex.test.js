import { describe, it, expect } from 'vitest';
import { buscaNoMercado, commandIndex, filtrarComandos, lembrarRecente, RECENTES_MAX } from './commandIndex';

const hubs = [
  { id: 'inicio', label: 'Início', to: '/', children: [] },
  { id: 'jogar', label: 'Jogar', to: '/dia-de-jogo', children: [
    { to: '/dia-de-jogo', label: 'Hoje' }, { to: '/procura-jogo', label: 'Vagas' },
  ] },
  { id: 'arenas', label: 'Arenas', to: '/arenas', children: [{ to: '/arenas', label: 'Arenas' }] },
];

describe('commandIndex', () => {
  it('as telas saem dos hubs, com o rótulo do menu e sem destino repetido', () => {
    const { telas } = commandIndex({ hubs });
    expect(telas.map((t) => t.to)).toEqual(['/', '/dia-de-jogo', '/procura-jogo', '/arenas']);
    expect(telas.find((t) => t.to === '/procura-jogo').label).toBe('Jogar › Vagas');
    expect(telas.find((t) => t.to === '/arenas').label).toBe('Arenas');
  });
  it('as ações seguem o papel: treino, Central da arena e admin só para quem tem', () => {
    const base = commandIndex({ hubs }).acoes.map((a) => a.id);
    expect(base).toEqual(['acao:reservar', 'acao:dia-de-jogo', 'acao:entrar']);
    const tudo = commandIndex({ hubs, treinoOn: true, isPlatformAdmin: true, arenas: [{ id: 'a1', name: 'Arena Sul' }] }).acoes;
    expect(tudo.map((a) => a.id)).toContain('acao:central:a1');
    expect(tudo.find((a) => a.id === 'acao:central:a1').label).toBe('Abrir a Central da arena Arena Sul');
    expect(tudo.map((a) => a.id)).toContain('acao:admin');
  });
  it('filtra sem acento e sem termo mostra só as ações', () => {
    const indice = commandIndex({ hubs });
    expect(filtrarComandos('', indice).telas).toEqual([]);
    expect(filtrarComandos('', indice).acoes.length).toBe(3);
    const r = filtrarComandos('inicio', indice);
    expect(r.telas.map((t) => t.to)).toEqual(['/']);
    expect(filtrarComandos('VAGAS', indice).telas[0].to).toBe('/procura-jogo');
  });
  it('recentes: o último vai para o topo, sem repetir, até o teto', () => {
    let r = [];
    for (let i = 0; i < RECENTES_MAX + 2; i++) r = lembrarRecente(r, { label: `t${i}`, to: `/t${i}` });
    expect(r.length).toBe(RECENTES_MAX);
    expect(r[0].to).toBe(`/t${RECENTES_MAX + 1}`);
    r = lembrarRecente(r, { label: 'x', to: '/t3' });
    expect(r[0].to).toBe('/t3');
    expect(r.filter((x) => x.to === '/t3').length).toBe(1);
  });
});

describe('Mercado na paleta', () => {
  it('só com o Mercado ligado oferece comprar, anunciar e buscar', () => {
    expect(commandIndex({}).acoes.some((a) => a.to.startsWith('/mercado'))).toBe(false);
    const ids = commandIndex({ mercadoOn: true }).acoes.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['acao:mercado', 'acao:anunciar']));
    expect(buscaNoMercado('raquete', false)).toBeNull();
    expect(buscaNoMercado('r', true)).toBeNull();
    expect(buscaNoMercado(' raquete joola ', true).to).toBe('/mercado?q=raquete%20joola');
  });
});
