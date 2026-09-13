/**
 * Os atalhos dos módulos: o que aparece, o que some e o que não se repete.
 *
 * Este teste existe por causa de um defeito real: o console de marketing tinha
 * rota e NENHUM link na plataforma levava até ele — o módulo podia estar ligado
 * que ninguém achava a tela. A lista de atalhos agora vem do catálogo, e é isto
 * que garante que módulo entregue nasce alcançável.
 */
import { describe, it, expect } from 'vitest';

import { shortcutsFor } from './ArenaModuleShortcuts.jsx';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const ligados = (...ids) => {
  const set = new Set(ids);
  return (id) => set.has(id);
};

describe('atalhos dos módulos de arena', () => {
  it('módulo desligado não tem porta', () => {
    const atalhos = shortcutsFor(ligados(), 'a1', 'manage');
    expect(atalhos).toEqual([]);
  });

  it('⭐ o console de marketing é alcançável quando o módulo está ligado', () => {
    const atalhos = shortcutsFor(ligados(ARENA_MODULE_ID.MARKETING), 'a1', 'manage');
    expect(atalhos.map((a) => a.to)).toContain('/arenas/a1/gerir/marketing');
  });

  it('o :arenaId é substituído pela arena de verdade', () => {
    const atalhos = shortcutsFor(ligados(ARENA_MODULE_ID.MEMBERS), 'minha-arena', 'manage');
    expect(atalhos[0].to).toBe('/arenas/minha-arena/gerir/membros');
    expect(atalhos[0].to).not.toContain(':arenaId');
  });

  it('o público do ATLETA é outro: a rota pública, não a de gestão', () => {
    const atalhos = shortcutsFor(ligados(ARENA_MODULE_ID.MEMBERS), 'a1', 'public');
    expect(atalhos[0].to).toBe('/arenas/a1/membros');
  });

  it('⭐ módulo sem tela para este público não vira botão quebrado', () => {
    // Marketing não tem rota pública — só a arena mexe nele.
    const atalhos = shortcutsFor(ligados(ARENA_MODULE_ID.MARKETING), 'a1', 'public');
    expect(atalhos).toEqual([]);
  });

  it('⭐ dois módulos com o MESMO destino viram um botão só', () => {
    // A família avançada inteira cai em /gerir/avancado; quatro botões iguais
    // seriam ruído, não navegação.
    const atalhos = shortcutsFor(
      ligados(ARENA_MODULE_ID.MARKETING, ARENA_MODULE_ID.MARKETING_COUPONS, ARENA_MODULE_ID.MARKETING_NPS),
      'a1',
      'manage',
    );
    const destinos = atalhos.map((a) => a.to);
    expect(new Set(destinos).size).toBe(destinos.length);
  });

  it('cada atalho tem rótulo em pt-BR, não o id cru', () => {
    const atalhos = shortcutsFor(ligados(ARENA_MODULE_ID.MEMBERS), 'a1', 'manage');
    expect(atalhos[0].label).not.toBe(ARENA_MODULE_ID.MEMBERS);
    expect(atalhos[0].label.length).toBeGreaterThan(2);
  });
});
