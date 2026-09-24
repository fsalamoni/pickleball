/**
 * Os atalhos dos módulos: o que aparece, o que some e o que não se repete.
 *
 * Este teste existe por causa de um defeito real: o console de marketing tinha
 * rota e NENHUM link na plataforma levava até ele — o módulo podia estar ligado
 * que ninguém achava a tela. A lista de atalhos vem do catálogo, e é isto que
 * garante que módulo entregue nasce alcançável.
 *
 * Desde a I-8 (2026-09-24) todo módulo com tela está INTEGRADO à arena (aba na
 * Central, seção na página pública) e não vira atalho. A regra genérica — o
 * que aparece, o que não se repete, o que não quebra — é provada com um
 * catálogo de EXEMPLO; o catálogo real é conferido à parte.
 */
import { describe, it, expect } from 'vitest';

import { shortcutsFor } from './ArenaModuleShortcuts.jsx';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { getArenaModule, listArenaModuleIds } from '@/modules/arenas/domain/moduleCatalog';

const ligados = (...ids) => {
  const set = new Set(ids);
  return (id) => set.has(id);
};

/** Um catálogo de exemplo, com módulos AINDA não integrados. */
const EXEMPLO = {
  novo: { label: 'Módulo novo', manage: '/arenas/:arenaId/gerir/novo', public: '/arenas/:arenaId/novo' },
  so_gestao: { label: 'Só gestão', manage: '/arenas/:arenaId/gerir/so-gestao' },
  gemeo: { label: 'Gêmeo', manage: '/arenas/:arenaId/gerir/novo' },
  integrado: { label: 'Integrado', manage: '/arenas/:arenaId/gerir/integrado', native: true },
  sem_tela: { label: 'Sem tela' },
};
const opcoes = { ids: Object.keys(EXEMPLO), getModule: (id) => EXEMPLO[id] || null };
const todos = () => true;

describe('atalhos dos módulos de arena — a regra (catálogo de exemplo)', () => {
  it('módulo desligado não tem porta', () => {
    expect(shortcutsFor(ligados(), 'a1', 'manage', opcoes)).toEqual([]);
  });

  it('⭐ módulo com tela própria, ainda não integrado, é alcançável quando está ligado', () => {
    const atalhos = shortcutsFor(ligados('novo'), 'a1', 'manage', opcoes);
    expect(atalhos.map((a) => a.to)).toEqual(['/arenas/a1/gerir/novo']);
  });

  it('o :arenaId é substituído pela arena de verdade', () => {
    const [atalho] = shortcutsFor(ligados('novo'), 'minha-arena', 'manage', opcoes);
    expect(atalho.to).toBe('/arenas/minha-arena/gerir/novo');
    expect(atalho.to).not.toContain(':arenaId');
  });

  it('o público do ATLETA é outro: a rota pública, não a de gestão', () => {
    const [atalho] = shortcutsFor(ligados('novo'), 'a1', 'public', opcoes);
    expect(atalho.to).toBe('/arenas/a1/novo');
  });

  it('⭐ módulo sem tela para este público não vira botão quebrado', () => {
    expect(shortcutsFor(ligados('so_gestao', 'sem_tela'), 'a1', 'public', opcoes)).toEqual([]);
  });

  it('⭐ módulo INTEGRADO à arena não vira atalho para fora', () => {
    expect(shortcutsFor(ligados('integrado'), 'a1', 'manage', opcoes)).toEqual([]);
  });

  it('⭐ dois módulos com o MESMO destino viram um botão só', () => {
    const destinos = shortcutsFor(ligados('novo', 'gemeo'), 'a1', 'manage', opcoes).map((a) => a.to);
    expect(destinos).toEqual(['/arenas/a1/gerir/novo']);
  });

  it('cada atalho tem o rótulo do catálogo, não o id cru', () => {
    const [atalho] = shortcutsFor(ligados('so_gestao'), 'a1', 'manage', opcoes);
    expect(atalho.label).toBe('Só gestão');
  });

  it('sem arena, nenhum atalho', () => {
    expect(shortcutsFor(todos, '', 'manage', opcoes)).toEqual([]);
  });
});

describe('atalhos dos módulos de arena — o catálogo de hoje', () => {
  it('⭐ com TUDO ligado, nenhum módulo leva para fora da arena (todos integrados)', () => {
    expect(shortcutsFor(todos, 'a1', 'manage')).toEqual([]);
    expect(shortcutsFor(todos, 'a1', 'public')).toEqual([]);
  });

  it('⭐ todo módulo com tela está marcado como integrado (native)', () => {
    const soltos = listArenaModuleIds()
      .map((id) => ({ id, mod: getArenaModule(id) }))
      .filter(({ mod }) => (mod?.manage || mod?.public) && !mod?.native)
      .map(({ id }) => id);
    expect(soltos).toEqual([]);
  });

  it('a I-8 integrou operação, equipamentos, presença, rede, marca e inteligência', () => {
    for (const id of [
      ARENA_MODULE_ID.OPERATIONS, ARENA_MODULE_ID.IOT, ARENA_MODULE_ID.IOT_QR_KIOSK,
      ARENA_MODULE_ID.MULTI_UNIT, ARENA_MODULE_ID.WHITE_LABEL, ARENA_MODULE_ID.AI,
    ]) {
      expect(getArenaModule(id)?.native, id).toBe(true);
    }
  });
});
