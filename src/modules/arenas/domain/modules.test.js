import { describe, it, expect } from 'vitest';
import {
  ARENA_MODULE_ID,
  ARENA_MODULE_META,
  canArenaUseModule,
  findParentModule,
  getChildModules,
  isParentModule,
  isChildModule,
  listRootModules,
  indexModuleStates,
  moduleStateDocId,
  listAllModules,
  isValidModuleId,
} from './modules.js';

describe('ARENA_MODULE_ID', () => {
  it('todos os ids são strings', () => {
    Object.values(ARENA_MODULE_ID).forEach((id) => {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  it('não tem ids duplicados', () => {
    const ids = Object.values(ARENA_MODULE_ID);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('tem pelo menos 30 módulos definidos', () => {
    expect(Object.keys(ARENA_MODULE_ID).length).toBeGreaterThanOrEqual(30);
  });
});

describe('ARENA_MODULE_META', () => {
  it('todos os módulos têm meta correspondente', () => {
    Object.values(ARENA_MODULE_ID).forEach((id) => {
      expect(ARENA_MODULE_META[id]).toBeDefined();
      expect(ARENA_MODULE_META[id].label).toBeTruthy();
      expect(ARENA_MODULE_META[id].description).toBeTruthy();
      expect(ARENA_MODULE_META[id].icon).toBeTruthy();
      expect(ARENA_MODULE_META[id].color).toBeTruthy();
    });
  });

  it('filhos referenciam pais que existem', () => {
    Object.entries(ARENA_MODULE_META).forEach(([id, meta]) => {
      if (meta.parent) {
        expect(ARENA_MODULE_META[meta.parent]).toBeDefined();
        expect(meta.parent).not.toBe(id);  // não pode ser pai de si mesmo
      }
    });
  });

  it('pais só referenciam filhos que existem', () => {
    Object.entries(ARENA_MODULE_META).forEach(([id, meta]) => {
      if (Array.isArray(meta.children)) {
        meta.children.forEach((childId) => {
          expect(ARENA_MODULE_META[childId]).toBeDefined();
        });
      }
    });
  });
});

describe('findParentModule', () => {
  it('retorna parent quando é filho', () => {
    expect(findParentModule(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH)).toBe(ARENA_MODULE_ID.MATCHMAKING);
  });
  it('retorna null para módulo raiz', () => {
    expect(findParentModule(ARENA_MODULE_ID.MATCHMAKING)).toBeNull();
  });
  it('retorna null para id desconhecido', () => {
    expect(findParentModule('unknown')).toBeNull();
  });
});

describe('getChildModules', () => {
  it('retorna filhos quando tem', () => {
    const children = getChildModules(ARENA_MODULE_ID.MATCHMAKING);
    expect(children).toContain(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH);
    expect(children).toContain(ARENA_MODULE_ID.MATCHMAKING_PARTNER_FINDER);
    expect(children).toContain(ARENA_MODULE_ID.MATCHMAKING_WAITLIST);
  });
  it('retorna array vazio para módulo sem filhos', () => {
    expect(getChildModules(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH)).toEqual([]);
  });
});

describe('isParentModule / isChildModule', () => {
  it('identifica pais corretamente', () => {
    expect(isParentModule(ARENA_MODULE_ID.MATCHMAKING)).toBe(true);
    expect(isParentModule(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH)).toBe(false);
  });
  it('identifica filhos corretamente', () => {
    expect(isChildModule(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH)).toBe(true);
    expect(isChildModule(ARENA_MODULE_ID.MATCHMAKING)).toBe(false);
  });
});

describe('listRootModules', () => {
  it('retorna apenas módulos raiz', () => {
    const roots = listRootModules();
    expect(roots).toContain(ARENA_MODULE_ID.MATCHMAKING);
    expect(roots).toContain(ARENA_MODULE_ID.MEMBERS);
    expect(roots).not.toContain(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH);
  });
});

describe('canArenaUseModule', () => {
  it('retorna false quando platformFlags é null', () => {
    const r = canArenaUseModule({ platformFlags: null, moduleState: { enabled: true }, moduleId: 'matchmaking' });
    expect(r).toBe(false);
  });

  it('retorna false quando master switch (arena_modules) está off', () => {
    const r = canArenaUseModule({
      platformFlags: { arena_modules: false, arena_module_matchmaking: true },
      moduleState: { enabled: true },
      moduleId: 'matchmaking',
    });
    expect(r).toBe(false);
  });

  it('retorna false quando sub-flag pai está off', () => {
    const r = canArenaUseModule({
      platformFlags: { arena_modules: true, arena_module_matchmaking: false, arena_module_matchmaking_open_match: true },
      moduleState: { enabled: true },
      moduleId: 'matchmaking_open_match',
    });
    expect(r).toBe(false);
  });

  it('retorna false quando sub-flag específica está off', () => {
    const r = canArenaUseModule({
      platformFlags: { arena_modules: true, arena_module_matchmaking: true, arena_module_matchmaking_open_match: false },
      moduleState: { enabled: true },
      moduleId: 'matchmaking_open_match',
    });
    expect(r).toBe(false);
  });

  it('retorna false quando arena não habilitou', () => {
    const r = canArenaUseModule({
      platformFlags: { arena_modules: true, arena_module_matchmaking: true },
      moduleState: { enabled: false },
      moduleId: 'matchmaking',
    });
    expect(r).toBe(false);
  });

  it('retorna false quando moduleState é null', () => {
    const r = canArenaUseModule({
      platformFlags: { arena_modules: true, arena_module_matchmaking: true },
      moduleState: null,
      moduleId: 'matchmaking',
    });
    expect(r).toBe(false);
  });

  it('retorna true quando todas as condições satisfeitas (módulo raiz)', () => {
    const r = canArenaUseModule({
      platformFlags: { arena_modules: true, arena_module_matchmaking: true },
      moduleState: { enabled: true },
      moduleId: 'matchmaking',
    });
    expect(r).toBe(true);
  });

  it('retorna true quando todas as condições satisfeitas (módulo filho)', () => {
    const r = canArenaUseModule({
      platformFlags: { arena_modules: true, arena_module_matchmaking: true, arena_module_matchmaking_open_match: true },
      moduleState: { enabled: true },
      moduleId: 'matchmaking_open_match',
    });
    expect(r).toBe(true);
  });
});

describe('indexModuleStates', () => {
  it('indexa array em mapa por module_id', () => {
    const arr = [
      { module_id: 'matchmaking', enabled: true, config: { min: 0 } },
      { module_id: 'pdv', enabled: false, config: {} },
    ];
    const out = indexModuleStates(arr);
    expect(out.matchmaking.enabled).toBe(true);
    expect(out.matchmaking.config).toEqual({ min: 0 });
    expect(out.pdv.enabled).toBe(false);
  });
  it('retorna {} para input inválido', () => {
    expect(indexModuleStates(null)).toEqual({});
    expect(indexModuleStates(undefined)).toEqual({});
    expect(indexModuleStates('not an array')).toEqual({});
  });
  it('ignora items sem module_id', () => {
    const arr = [{ enabled: true }, { module_id: 'pdv', enabled: true }];
    const out = indexModuleStates(arr);
    expect(out.pdv).toBeDefined();
    expect(Object.keys(out).length).toBe(1);
  });
});

describe('moduleStateDocId', () => {
  it('gera id determinístico', () => {
    expect(moduleStateDocId('arena_123', 'matchmaking')).toBe('arena_123_matchmaking');
  });
});

describe('listAllModules', () => {
  it('retorna todos os ids', () => {
    const all = listAllModules();
    expect(all).toEqual(Object.values(ARENA_MODULE_ID));
    expect(all.length).toBeGreaterThanOrEqual(30);
  });
});

describe('isValidModuleId', () => {
  it('aceita id conhecido', () => {
    expect(isValidModuleId(ARENA_MODULE_ID.MATCHMAKING)).toBe(true);
  });
  it('rejeita id desconhecido', () => {
    expect(isValidModuleId('not_a_module')).toBe(false);
    expect(isValidModuleId('')).toBe(false);
    expect(isValidModuleId(null)).toBe(false);
  });
});
