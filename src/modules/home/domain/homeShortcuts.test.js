import { describe, it, expect } from 'vitest';
import { homeShortcuts, saudacao, frasePrincipal, SHORTCUTS_MAX } from './homeShortcuts.js';
import { HOME_FOCUS } from './homeProfile.js';

const f = (...focos) => focos.map((focus) => ({ focus }));
const rotas = (r) => r.map((s) => s.to);

describe('homeShortcuts', () => {
  it('⭐ quem gere UMA arena vai direto à Central dela, com os pedidos no selo', () => {
    const r = homeShortcuts(f(HOME_FOCUS.ARENA), { arenas: [{ id: 'a1', name: 'Arena Sul', pending: 3 }] });
    expect(r[0]).toMatchObject({ to: '/arenas/a1/gerir', label: 'Central da arena', badge: 3, hint: '3 pedidos esperando' });
  });

  it('com duas arenas, uma porta para cada (pelo nome)', () => {
    const r = homeShortcuts(f(HOME_FOCUS.ARENA), { arenas: [{ id: 'a1', name: 'Sul' }, { id: 'a2', name: 'Norte' }, { id: 'a3' }] });
    expect(rotas(r)).toEqual(['/arenas/a1/gerir', '/arenas/a2/gerir']);
    expect(r[0].label).toBe('Sul');
  });

  it('interesse em arena sem ter arena: o caminho para cadastrar', () => {
    expect(rotas(homeShortcuts(f(HOME_FOCUS.ARENA), {}))).toEqual(['/arenas/criar']);
  });

  it('⭐ leitura das arenas FALHOU: nunca oferece cadastrar (seria duplicar)', () => {
    expect(rotas(homeShortcuts(f(HOME_FOCUS.ARENA), { arenasDesconhecidas: true }))).toEqual(['/arenas']);
  });

  it('perfil de professor sem carregar: leva ao painel, não a "ativar"', () => {
    expect(rotas(homeShortcuts(f(HOME_FOCUS.ENSINAR), { professorDesconhecido: true }))).toEqual(['/aulas']);
  });

  it('professor vai ao painel; quem quer ensinar e não é, a ativar o perfil', () => {
    expect(rotas(homeShortcuts(f(HOME_FOCUS.ENSINAR), { ehProfessor: true }))).toEqual(['/aulas']);
    expect(rotas(homeShortcuts(f(HOME_FOCUS.ENSINAR), {}))).toEqual(['/perfil/editar']);
  });

  it('primeiro o atalho principal de cada frente, depois os secundários', () => {
    const r = homeShortcuts(f(HOME_FOCUS.ORGANIZAR, HOME_FOCUS.JOGAR, HOME_FOCUS.RANKING));
    expect(rotas(r).slice(0, 3)).toEqual(['/torneios/criar', '/procura-jogo', '/ranking']);
    expect(rotas(r)).toContain('/dia-de-jogo?criar=1');
  });

  it('nunca passa do limite nem repete destino', () => {
    const todas = f(...Object.values(HOME_FOCUS));
    const r = homeShortcuts(todas, { ehProfessor: true, arenas: [{ id: 'a' }] });
    expect(r.length).toBeLessThanOrEqual(SHORTCUTS_MAX);
    expect(new Set(rotas(r)).size).toBe(r.length);
  });

  it('o admin da plataforma tem sempre a porta do painel (no lugar do último, se lotou)', () => {
    const todas = f(...Object.values(HOME_FOCUS));
    const r = homeShortcuts(todas, { isPlatformAdmin: true });
    expect(r.length).toBe(SHORTCUTS_MAX);
    expect(r[r.length - 1].to).toBe('/admin/painel');
  });
});

describe('saudacao', () => {
  it('pela hora local', () => {
    expect(saudacao(new Date(2026, 8, 26, 8))).toBe('Bom dia');
    expect(saudacao(new Date(2026, 8, 26, 14))).toBe('Boa tarde');
    expect(saudacao(new Date(2026, 8, 26, 20))).toBe('Boa noite');
    expect(saudacao(new Date(2026, 8, 26, 2))).toBe('Boa noite');
  });
});

describe('frasePrincipal', () => {
  const HOJE = '2026-09-26';
  it('compromissos de hoje, com a hora do primeiro', () => {
    const agenda = [{ dia: HOJE, hora: '19:00' }, { dia: HOJE, hora: null }];
    expect(frasePrincipal({ agenda, hoje: HOJE })).toBe('Hoje você tem 2 compromissos — o primeiro às 19:00.');
  });

  it('nada hoje: diz quando é o próximo', () => {
    expect(frasePrincipal({ agenda: [{ dia: '2026-09-27', hora: '08:00' }], hoje: HOJE }))
      .toBe('Nada marcado para hoje. O próximo é amanhã, às 08:00.');
    expect(frasePrincipal({ agenda: [{ dia: '2026-09-29', hora: null }], hoje: HOJE }))
      .toBe('Nada marcado para hoje. O próximo é em Ter, 29/09.');
  });

  it('⭐ agenda incompleta (fonte falhou) NÃO afirma que está livre', () => {
    expect(frasePrincipal({ agenda: [], hoje: HOJE, completa: false })).toBeNull();
    expect(frasePrincipal({ agenda: [], hoje: HOJE, completa: true })).toMatch(/livre/);
  });

  it('conta o que pede ação', () => {
    expect(frasePrincipal({ agenda: [{ dia: HOJE, hora: '10:00' }], hoje: HOJE, acoes: 1 }))
      .toBe('Hoje você tem um compromisso — o primeiro às 10:00. Um item pede a sua ação.');
  });
});
