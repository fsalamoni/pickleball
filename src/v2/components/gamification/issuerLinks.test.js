import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { issuerLinks } from './issuerLinks.js';

describe('issuerLinks', () => {
  it('quem só joga não tem atalho de quem oferece', () => {
    expect(issuerLinks({})).toEqual([]);
    expect(issuerLinks({ arenas: [], coach: null, clubs: [{ id: 'c', my_role: 'member' }] })).toEqual([]);
  });

  it('cada papel leva à sua central, com a aba certa', () => {
    const l = issuerLinks({
      isAdmin: true, arenas: [{ id: 'a1', name: 'Arena Sol' }], coach: { id: 'u' },
      clubs: [{ id: 'k1', name: 'Clube Norte', my_role: 'admin' }, { id: 'k2', my_role: 'owner' }, { id: 'k3', my_role: 'member' }],
    });
    expect(l.map((x) => x.to)).toEqual([
      '/admin/painel?tab=gam-config', '/arenas/a1/gerir?aba=engajamento', '/aulas?aba=engajamento',
      '/clubes/k1?tab=atividade', '/clubes/k2?tab=atividade',
    ]);
    expect(new Set(l.map((x) => x.key)).size).toBe(l.length);
  });

  it('o admin vai para uma aba que EXISTE no console (o link com erro de digitação não dá erro: dá tela errada)', () => {
    const console = readFileSync('src/v2/pages/V2AdminConsole.jsx', 'utf8');
    // o console só abre uma aba que conste do menu: `gam-config` tem de ser uma delas
    expect(console).toContain("id: 'gam-config'");
    expect(console).toContain("tab.startsWith('gam-')");
  });

  it('as abas de destino existem nas centrais', () => {
    const arena = readFileSync('src/v2/components/arenas/arenaManageSections.js', 'utf8');
    expect(arena).toContain("value: 'engajamento'");
    const coach = readFileSync('src/v2/pages/V2CoachAgenda.jsx', 'utf8');
    expect(coach).toContain("value: 'engajamento'");
    const clube = readFileSync('src/v2/pages/V2ClubDetail.jsx', 'utf8');
    expect(clube).toContain("value: 'atividade'");
  });
});
