import { describe, it, expect } from 'vitest';
import { ARENA_MODULE_ID, ARENA_MODULE_META } from './modules.js';
import {
  ARENA_MODULE_DETAIL,
  ARENA_MODULE_STATUS,
  ARENA_MODULE_STATUS_META,
  arenaModuleRoute,
  arenaModuleTree,
  getArenaModule,
  isModuleReleasable,
  listArenaModuleFamilies,
  listArenaModuleIds,
  moduleConfigWithDefaults,
} from './moduleCatalog.js';

describe('moduleCatalog — integridade do catálogo', () => {
  it('detalha TODOS os módulos do catálogo (nenhum órfão)', () => {
    const semDetalhe = listArenaModuleIds().filter((id) => !ARENA_MODULE_DETAIL[id]);
    expect(semDetalhe).toEqual([]);
  });

  it('não detalha nada que não exista no catálogo', () => {
    const ids = new Set(listArenaModuleIds());
    const inventados = Object.keys(ARENA_MODULE_DETAIL).filter((id) => !ids.has(id));
    expect(inventados).toEqual([]);
  });

  it('todo id declarado em ARENA_MODULE_ID tem metadados', () => {
    const semMeta = Object.values(ARENA_MODULE_ID).filter((id) => !ARENA_MODULE_META[id]);
    expect(semMeta).toEqual([]);
  });

  it('todo filho aponta para um pai que o lista de volta', () => {
    listArenaModuleIds().forEach((id) => {
      const parent = ARENA_MODULE_META[id]?.parent;
      if (!parent) return;
      expect(ARENA_MODULE_META[parent], `pai inexistente em ${id}`).toBeTruthy();
      expect(ARENA_MODULE_META[parent].children).toContain(id);
    });
  });

  it('toda dependência declarada em requires existe no catálogo', () => {
    const ids = new Set(listArenaModuleIds());
    listArenaModuleIds().forEach((id) => {
      (ARENA_MODULE_DETAIL[id]?.requires || []).forEach((dep) => {
        expect(ids.has(dep), `${id} exige ${dep}, que não existe`).toBe(true);
      });
    });
  });

  it('nenhum módulo depende de si mesmo', () => {
    listArenaModuleIds().forEach((id) => {
      expect(ARENA_MODULE_DETAIL[id]?.requires || []).not.toContain(id);
    });
  });

  it('todo status usado tem metadados de exibição', () => {
    listArenaModuleIds().forEach((id) => {
      const status = ARENA_MODULE_DETAIL[id]?.status;
      expect(ARENA_MODULE_STATUS_META[status], `status inválido em ${id}: ${status}`).toBeTruthy();
    });
  });

  it('módulo external explica POR QUE depende de terceiro', () => {
    listArenaModuleIds()
      .filter((id) => ARENA_MODULE_DETAIL[id]?.status === ARENA_MODULE_STATUS.EXTERNAL)
      .forEach((id) => {
        expect(ARENA_MODULE_DETAIL[id].externalNote, `${id} sem externalNote`).toBeTruthy();
      });
  });

  it('família nunca tem pai, e filho nunca tem filhos', () => {
    listArenaModuleFamilies().forEach((id) => {
      expect(ARENA_MODULE_META[id].parent).toBeUndefined();
    });
    listArenaModuleIds()
      .filter((id) => ARENA_MODULE_META[id].parent)
      .forEach((id) => {
        expect(ARENA_MODULE_META[id].children || []).toEqual([]);
      });
  });

  it('todo módulo tem ao menos um público e um benefício escrito', () => {
    listArenaModuleIds().forEach((id) => {
      const mod = getArenaModule(id);
      expect(mod.audience.length, `${id} sem público`).toBeGreaterThan(0);
      expect(Object.keys(mod.benefit).length, `${id} sem benefício`).toBeGreaterThan(0);
    });
  });
});

describe('getArenaModule', () => {
  it('funde metadados de exibição com detalhamento', () => {
    const mod = getArenaModule(ARENA_MODULE_ID.MEMBERS_WALLET);
    expect(mod.label).toBe(ARENA_MODULE_META[ARENA_MODULE_ID.MEMBERS_WALLET].label);
    expect(mod.parent).toBe(ARENA_MODULE_ID.MEMBERS);
    expect(mod.requires).toContain(ARENA_MODULE_ID.MEMBERS);
    expect(mod.status).toBe(ARENA_MODULE_STATUS.READY);
  });

  it('devolve null para id desconhecido', () => {
    expect(getArenaModule('iot_devices')).toBeNull();
    expect(getArenaModule(undefined)).toBeNull();
  });
});

describe('arenaModuleTree', () => {
  it('devolve uma entrada por família, com os filhos completos', () => {
    const tree = arenaModuleTree();
    expect(tree.length).toBe(listArenaModuleFamilies().length);
    tree.forEach(({ family, children }) => {
      expect(family.children.length).toBe(children.length);
      children.forEach((child) => expect(child.parent).toBe(family.id));
    });
  });

  it('cobre todos os módulos: família + filhos = catálogo inteiro', () => {
    const vistos = arenaModuleTree().flatMap(({ family, children }) => [
      family.id, ...children.map((c) => c.id),
    ]);
    expect(new Set(vistos).size).toBe(listArenaModuleIds().length);
  });
});

describe('isModuleReleasable', () => {
  it('deixa liberar o que está pronto e o que depende de terceiro', () => {
    expect(isModuleReleasable(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH)).toBe(true);
    expect(isModuleReleasable(ARENA_MODULE_ID.IOT_LIGHTING)).toBe(true);
  });

  it('não deixa liberar o que ainda não existe no código', () => {
    expect(isModuleReleasable(ARENA_MODULE_ID.WHITE_LABEL_APP)).toBe(false);
  });

  it('id desconhecido nunca é liberável', () => {
    expect(isModuleReleasable('nao_existe')).toBe(false);
  });
});

describe('arenaModuleRoute', () => {
  it('substitui o arenaId na rota', () => {
    expect(arenaModuleRoute(ARENA_MODULE_ID.MEMBERS, 'a1', 'manage'))
      .toBe('/arenas/a1/gerir/membros');
    expect(arenaModuleRoute(ARENA_MODULE_ID.MEMBERS, 'a1', 'public'))
      .toBe('/arenas/a1/membros');
  });

  it('devolve null quando o módulo não tem aquela rota', () => {
    expect(arenaModuleRoute(ARENA_MODULE_ID.MEMBERS_WALLET, 'a1', 'manage')).toBeNull();
    expect(arenaModuleRoute(ARENA_MODULE_ID.MEMBERS, '', 'manage')).toBeNull();
  });
});

describe('moduleConfigWithDefaults', () => {
  const OPEN = ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH;

  it('aplica os padrões quando a arena nunca configurou', () => {
    expect(moduleConfigWithDefaults(OPEN, null)).toEqual({
      level_tolerance: 1,
      auto_confirm: true,
    });
  });

  it('mantém o que a arena gravou', () => {
    expect(moduleConfigWithDefaults(OPEN, { level_tolerance: 0.5, auto_confirm: false }))
      .toEqual({ level_tolerance: 0.5, auto_confirm: false });
  });

  it('descarta campo desconhecido (a config não guarda lixo)', () => {
    const out = moduleConfigWithDefaults(OPEN, { level_tolerance: 2, invadido: 'x' });
    expect(out).toEqual({ level_tolerance: 2, auto_confirm: true });
    expect(out).not.toHaveProperty('invadido');
  });

  it('valor inválido cai no padrão em vez de virar NaN', () => {
    expect(moduleConfigWithDefaults(OPEN, { level_tolerance: 'muito' }).level_tolerance).toBe(1);
  });

  it('módulo sem configuração devolve objeto vazio', () => {
    expect(moduleConfigWithDefaults(ARENA_MODULE_ID.MEMBERS_WALLET, { x: 1 })).toEqual({});
  });
});
