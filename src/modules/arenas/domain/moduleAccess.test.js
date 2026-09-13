import { describe, it, expect } from 'vitest';
import { ARENA_MODULE_ID } from './modules.js';
import {
  MODULE_OFF_REASON,
  MODULE_RELEASE_MODE,
  arenaModuleSummary,
  buildArenaModuleAccess,
  indexArenaModuleStates,
  listReleasedModuleIds,
  moduleOffReasonText,
  modulesToDisableWith,
  modulesToEnableWith,
  normalizePlatformModules,
  resolveArenaModule,
} from './moduleAccess.js';

const {
  MATCHMAKING, MATCHMAKING_OPEN_MATCH, MATCHMAKING_WAITLIST,
  MEMBERS, MEMBERS_WALLET, MEMBERS_PACKAGES,
  WHITE_LABEL, WHITE_LABEL_APP,
  MULTI_UNIT, MULTI_UNIT_NETWORK, MULTI_UNIT_CROSS_BOOKING,
} = ARENA_MODULE_ID;

/** Libera uma lista de módulos (modo opt_in por padrão). */
function releasing(ids, mode = MODULE_RELEASE_MODE.OPT_IN) {
  return normalizePlatformModules(
    Object.fromEntries(ids.map((id) => [id, { released: true, mode }])),
  );
}

/** Liga uma lista de módulos na arena. */
function arenaOn(ids, config = {}) {
  return indexArenaModuleStates(
    ids.map((id) => ({ module_id: id, enabled: true, config: config[id] || {} })),
  );
}

describe('normalizePlatformModules', () => {
  it('preenche TODO o catálogo, mesmo com documento vazio', () => {
    const map = normalizePlatformModules(null);
    expect(map[MATCHMAKING]).toEqual({ released: false, mode: 'opt_in', note: '' });
    expect(Object.keys(map).length).toBeGreaterThan(40);
  });

  it('ignora chave que não existe no catálogo', () => {
    const map = normalizePlatformModules({ iot_devices: { released: true } });
    expect(map).not.toHaveProperty('iot_devices');
  });

  it('aceita booleano solto como forma curta de released', () => {
    expect(normalizePlatformModules({ [MATCHMAKING]: true })[MATCHMAKING].released).toBe(true);
  });

  it('NUNCA marca como liberado um módulo que ainda não existe no código', () => {
    const map = normalizePlatformModules({ [WHITE_LABEL_APP]: { released: true } });
    expect(map[WHITE_LABEL_APP].released).toBe(false);
  });

  it('só reconhece os dois modos conhecidos', () => {
    const map = normalizePlatformModules({
      [MATCHMAKING]: { released: true, mode: 'obrigatorio_agora' },
    });
    expect(map[MATCHMAKING].mode).toBe(MODULE_RELEASE_MODE.OPT_IN);
  });
});

describe('resolveArenaModule — as três camadas', () => {
  const base = {
    platformModules: releasing([MATCHMAKING, MATCHMAKING_OPEN_MATCH]),
    arenaStates: arenaOn([MATCHMAKING, MATCHMAKING_OPEN_MATCH]),
  };

  it('liga quando as três camadas dizem sim', () => {
    const r = resolveArenaModule({ ...base, masterOn: true, moduleId: MATCHMAKING_OPEN_MATCH });
    expect(r.on).toBe(true);
    expect(r.reason).toBe(MODULE_OFF_REASON.OK);
  });

  it('CAMADA 1: a chave-mestra desligada derruba tudo', () => {
    const r = resolveArenaModule({ ...base, masterOn: false, moduleId: MATCHMAKING_OPEN_MATCH });
    expect(r.on).toBe(false);
    expect(r.reason).toBe(MODULE_OFF_REASON.MASTER_OFF);
  });

  it('CAMADA 2: sem liberação da plataforma, a arena não usa nem tendo ligado', () => {
    const r = resolveArenaModule({
      masterOn: true,
      platformModules: normalizePlatformModules({}),
      arenaStates: arenaOn([MATCHMAKING, MATCHMAKING_OPEN_MATCH]),
      moduleId: MATCHMAKING_OPEN_MATCH,
    });
    expect(r.on).toBe(false);
    expect(r.reason).toBe(MODULE_OFF_REASON.NOT_RELEASED);
  });

  it('CAMADA 3: liberado mas não ligado pela arena', () => {
    const r = resolveArenaModule({
      masterOn: true,
      platformModules: base.platformModules,
      arenaStates: arenaOn([MATCHMAKING]), // família ligada, filho não
      moduleId: MATCHMAKING_OPEN_MATCH,
    });
    expect(r.on).toBe(false);
    expect(r.reason).toBe(MODULE_OFF_REASON.ARENA_OFF);
  });

  it('modo obrigatório dispensa a arena de ligar', () => {
    const r = resolveArenaModule({
      masterOn: true,
      platformModules: releasing([MATCHMAKING, MATCHMAKING_OPEN_MATCH], MODULE_RELEASE_MODE.FORCED),
      arenaStates: {},
      moduleId: MATCHMAKING_OPEN_MATCH,
    });
    expect(r.on).toBe(true);
    expect(r.mode).toBe(MODULE_RELEASE_MODE.FORCED);
  });

  it('FAMÍLIA: filho não vale se o pai não vale', () => {
    const r = resolveArenaModule({
      masterOn: true,
      platformModules: releasing([MATCHMAKING, MATCHMAKING_OPEN_MATCH]),
      arenaStates: arenaOn([MATCHMAKING_OPEN_MATCH]), // pai desligado
      moduleId: MATCHMAKING_OPEN_MATCH,
    });
    expect(r.on).toBe(false);
    expect(r.reason).toBe(MODULE_OFF_REASON.FAMILY_OFF);
    expect(r.missing).toEqual([MATCHMAKING]);
  });

  it('DEPENDÊNCIA: carteira exige membros', () => {
    const r = resolveArenaModule({
      masterOn: true,
      platformModules: releasing([MEMBERS, MEMBERS_WALLET]),
      arenaStates: arenaOn([MEMBERS_WALLET]),
      moduleId: MEMBERS_WALLET,
    });
    expect(r.on).toBe(false);
    // MEMBERS é pai E dependência: a falta do pai é o motivo mais específico.
    expect(r.reason).toBe(MODULE_OFF_REASON.FAMILY_OFF);
  });

  it('DEPENDÊNCIA cruzada de outra família é apontada pelo nome', () => {
    const ids = [MULTI_UNIT, MULTI_UNIT_NETWORK, MULTI_UNIT_CROSS_BOOKING];
    const r = resolveArenaModule({
      masterOn: true,
      platformModules: releasing(ids), // MEMBERS não liberado
      arenaStates: arenaOn(ids),
      moduleId: MULTI_UNIT_CROSS_BOOKING,
    });
    expect(r.on).toBe(false);
    expect(r.reason).toBe(MODULE_OFF_REASON.REQUIRES);
    expect(r.missing).toContain(MEMBERS);
  });

  it('módulo em construção nunca liga, nem forçado', () => {
    const r = resolveArenaModule({
      masterOn: true,
      platformModules: releasing([WHITE_LABEL, WHITE_LABEL_APP], MODULE_RELEASE_MODE.FORCED),
      arenaStates: arenaOn([WHITE_LABEL, WHITE_LABEL_APP]),
      moduleId: WHITE_LABEL_APP,
    });
    expect(r.on).toBe(false);
    expect(r.reason).toBe(MODULE_OFF_REASON.NOT_IMPLEMENTED);
  });

  it('id desconhecido devolve motivo próprio, sem estourar', () => {
    const r = resolveArenaModule({
      masterOn: true, platformModules: {}, arenaStates: {}, moduleId: 'iot_devices',
    });
    expect(r.on).toBe(false);
    expect(r.reason).toBe(MODULE_OFF_REASON.UNKNOWN);
  });

  it('entrega a configuração com os padrões do catálogo', () => {
    const r = resolveArenaModule({ ...base, masterOn: true, moduleId: MATCHMAKING_OPEN_MATCH });
    expect(r.config).toEqual({ level_tolerance: 1, auto_confirm: true });
  });

  it('entrega a configuração gravada pela arena', () => {
    const r = resolveArenaModule({
      masterOn: true,
      platformModules: base.platformModules,
      arenaStates: arenaOn(
        [MATCHMAKING, MATCHMAKING_OPEN_MATCH],
        { [MATCHMAKING_OPEN_MATCH]: { level_tolerance: 0.5 } },
      ),
      moduleId: MATCHMAKING_OPEN_MATCH,
    });
    expect(r.config.level_tolerance).toBe(0.5);
  });
});

describe('buildArenaModuleAccess', () => {
  it('resolve o catálogo inteiro numa passada', () => {
    const access = buildArenaModuleAccess({
      masterOn: true,
      platformModules: releasing([MATCHMAKING, MATCHMAKING_OPEN_MATCH, MATCHMAKING_WAITLIST]),
      arenaStates: arenaOn([MATCHMAKING, MATCHMAKING_OPEN_MATCH]),
    });
    expect(access.isOn(MATCHMAKING_OPEN_MATCH)).toBe(true);
    expect(access.isOn(MATCHMAKING_WAITLIST)).toBe(false);
    expect(access.reasonFor(MATCHMAKING_WAITLIST)).toBe(MODULE_OFF_REASON.ARENA_OFF);
    expect(access.enabledIds).toEqual([MATCHMAKING, MATCHMAKING_OPEN_MATCH]);
    expect(access.releasedIds).toHaveLength(3);
  });

  it('chave-mestra desligada zera tudo, inclusive a lista de liberados', () => {
    const access = buildArenaModuleAccess({
      masterOn: false,
      platformModules: releasing([MATCHMAKING]),
      arenaStates: arenaOn([MATCHMAKING]),
    });
    expect(access.enabledIds).toEqual([]);
    expect(access.releasedIds).toEqual([]);
  });

  it('mapa vazio não quebra', () => {
    const access = buildArenaModuleAccess({ masterOn: true });
    expect(access.isOn(MATCHMAKING)).toBe(false);
    expect(access.configOf(MATCHMAKING)).toEqual({});
    expect(access.missingFor('nada')).toEqual([]);
  });
});

describe('modulesToEnableWith', () => {
  it('lista pai e dependências que faltam, na ordem de gravação', () => {
    const ctx = {
      platformModules: releasing([MEMBERS, MEMBERS_WALLET]),
      arenaStates: {},
    };
    expect(modulesToEnableWith(MEMBERS_WALLET, ctx)).toEqual([MEMBERS]);
  });

  it('não repete o que já está ligado', () => {
    const ctx = {
      platformModules: releasing([MEMBERS, MEMBERS_WALLET]),
      arenaStates: arenaOn([MEMBERS]),
    };
    expect(modulesToEnableWith(MEMBERS_WALLET, ctx)).toEqual([]);
  });

  it('resolve cadeia de mais de um nível, dependência antes do dependente', () => {
    const ctx = {
      platformModules: releasing([MULTI_UNIT, MULTI_UNIT_NETWORK, MULTI_UNIT_CROSS_BOOKING, MEMBERS]),
      arenaStates: {},
    };
    const order = modulesToEnableWith(MULTI_UNIT_CROSS_BOOKING, ctx);
    expect(order).toContain(MULTI_UNIT);
    expect(order).toContain(MULTI_UNIT_NETWORK);
    expect(order).toContain(MEMBERS);
    expect(order.indexOf(MULTI_UNIT)).toBeLessThan(order.indexOf(MULTI_UNIT_NETWORK));
    expect(order).not.toContain(MULTI_UNIT_CROSS_BOOKING);
  });

  it('modo obrigatório já conta como ligado', () => {
    const ctx = {
      platformModules: releasing([MEMBERS, MEMBERS_WALLET], MODULE_RELEASE_MODE.FORCED),
      arenaStates: {},
    };
    expect(modulesToEnableWith(MEMBERS_WALLET, ctx)).toEqual([]);
  });
});

describe('modulesToDisableWith', () => {
  it('desligar a família derruba os filhos LIGADOS', () => {
    const ctx = {
      platformModules: releasing([MEMBERS, MEMBERS_WALLET, MEMBERS_PACKAGES]),
      arenaStates: arenaOn([MEMBERS, MEMBERS_WALLET]),
    };
    const caem = modulesToDisableWith(MEMBERS, ctx);
    expect(caem).toContain(MEMBERS_WALLET);
    expect(caem).not.toContain(MEMBERS_PACKAGES); // não estava ligado
    expect(caem).not.toContain(MEMBERS); // o próprio nunca entra
  });

  it('derruba também quem depende de fora da família', () => {
    const ids = [MULTI_UNIT, MULTI_UNIT_NETWORK, MULTI_UNIT_CROSS_BOOKING, MEMBERS];
    const ctx = { platformModules: releasing(ids), arenaStates: arenaOn(ids) };
    expect(modulesToDisableWith(MEMBERS, ctx)).toContain(MULTI_UNIT_CROSS_BOOKING);
  });

  it('desligar folha não derruba ninguém', () => {
    const ctx = {
      platformModules: releasing([MEMBERS, MEMBERS_WALLET]),
      arenaStates: arenaOn([MEMBERS, MEMBERS_WALLET]),
    };
    expect(modulesToDisableWith(MEMBERS_WALLET, ctx)).toEqual([]);
  });
});

describe('arenaModuleSummary', () => {
  it('conta total, liberados, ligados e obrigatórios', () => {
    const s = arenaModuleSummary({
      masterOn: true,
      platformModules: normalizePlatformModules({
        [MATCHMAKING]: { released: true },
        [MATCHMAKING_OPEN_MATCH]: { released: true },
        [MEMBERS]: { released: true, mode: MODULE_RELEASE_MODE.FORCED },
      }),
      arenaStates: arenaOn([MATCHMAKING]),
    });
    expect(s.total).toBeGreaterThan(40);
    expect(s.released).toBe(3);
    expect(s.forced).toBe(1);
    expect(s.enabled).toBe(2); // MATCHMAKING (ligado) + MEMBERS (obrigatório)
  });
});

describe('moduleOffReasonText', () => {
  it('fala diferente com o admin da plataforma e com a arena', () => {
    const p = moduleOffReasonText(MODULE_OFF_REASON.MASTER_OFF, { audience: 'platform' });
    const a = moduleOffReasonText(MODULE_OFF_REASON.MASTER_OFF, { audience: 'arena' });
    expect(p).not.toBe(a);
    expect(p).toMatch(/Funcionalidades/);
  });

  it('nomeia o módulo que falta, em português', () => {
    const txt = moduleOffReasonText(MODULE_OFF_REASON.REQUIRES, { missing: [MEMBERS] });
    expect(txt).toContain('Membros');
  });

  it('motivo ok não gera texto', () => {
    expect(moduleOffReasonText(MODULE_OFF_REASON.OK)).toBe('');
  });
});

describe('listReleasedModuleIds', () => {
  it('devolve na ordem do catálogo', () => {
    const ids = listReleasedModuleIds(releasing([MEMBERS, MATCHMAKING]));
    expect(ids).toEqual([MATCHMAKING, MEMBERS]);
  });

  it('mapa ausente devolve lista vazia', () => {
    expect(listReleasedModuleIds(null)).toEqual([]);
  });
});
