import { describe, it, expect } from 'vitest';
import { normalizePlayGroupsConfig, NO_GROUP } from './playGroups.js';
import {
  pickGroupedMatch, explainGroups, describeNoMatch, lastGroupIdFromGames, makeGroupsDrawer,
  buildGroupedPlayView, courtHasMatch,
} from './playGroupsDraw.js';
import { buildPlayNextMatch } from './gamePlay.js';

const cfg = (groups, policy = 'queue') => normalizePlayGroupsConfig({
  play_groups: groups, play_groups_policy: policy,
});
const mk = (id, gid = null, extra = {}) => ({
  id, name: id.toUpperCase(), play_group_id: gid, ...extra,
});
const H = (id, gid, extra = {}) => mk(id, gid, { play_gender: 'male', ...extra });
const F = (id, gid, extra = {}) => mk(id, gid, { play_gender: 'female', ...extra });
const pick = (pool, config, extra = {}) => pickGroupedMatch(pool, {
  config, court: 1, slots: 4, ...extra,
});

describe('pickGroupedMatch — um grupo só', () => {
  it('sem regra nenhuma escolhe exatamente como o Play de sempre', () => {
    const pool = ['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => mk(id, 'a'));
    const r = pick(pool, cfg([{ id: 'a', name: 'A' }]));
    expect(r.groupId).toBe('a');
    expect(r.ids).toEqual(buildPlayNextMatch(pool));
  });

  it('gente demais de outro grupo não entra na conta', () => {
    const pool = [mk('a1', 'a'), mk('b1', 'b'), mk('a2', 'a'), mk('b2', 'b'), mk('a3', 'a'), mk('a4', 'a')];
    const r = pick(pool, cfg([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]));
    expect(r.groupId).toBe('a');
    expect(r.ids).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  it('com menos gente que a partida pede, não há partida', () => {
    const pool = ['a1', 'a2', 'a3'].map((id) => mk(id, 'a'));
    expect(pick(pool, cfg([{ id: 'a', name: 'A' }]))).toBeNull();
  });

  it('no simples (2 vagas) entram os dois primeiros do grupo', () => {
    const pool = ['a1', 'a2', 'a3'].map((id) => mk(id, 'a'));
    const r = pick(pool, cfg([{ id: 'a', name: 'A' }]), { slots: 2 });
    expect(r.ids).toEqual(['a1', 'a2']);
  });
});

describe('quem está sem grupo', () => {
  it('joga entre si, em formação livre — nunca fica parado', () => {
    const pool = ['u1', 'u2', 'u3', 'u4'].map((id) => mk(id));
    const r = pick(pool, cfg([{ id: 'a', name: 'A' }]));
    expect(r).toEqual({ ids: ['u1', 'u2', 'u3', 'u4'], groupId: null });
  });

  it('grupo que não existe mais conta como sem grupo', () => {
    const pool = ['u1', 'u2', 'u3', 'u4'].map((id) => mk(id, 'sumiu'));
    expect(pick(pool, cfg([{ id: 'a', name: 'A' }])).groupId).toBeNull();
  });
});

describe('política: por tempo de espera (padrão)', () => {
  const config = cfg([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);

  it('entra o grupo cujo primeiro da fila espera há mais tempo', () => {
    const pool = [
      mk('b1', 'b'), mk('a1', 'a'), mk('b2', 'b'), mk('a2', 'a'),
      mk('b3', 'b'), mk('a3', 'a'), mk('b4', 'b'), mk('a4', 'a'),
    ];
    expect(pick(pool, config).groupId).toBe('b');
    expect(pick([...pool.slice(1), pool[0]], config).groupId).toBe('a');
  });

  it('grupo sem partida pronta não atrapalha: joga o outro, mesmo esperando há menos', () => {
    const pool = [mk('b1', 'b'), mk('b2', 'b'), mk('a1', 'a'), mk('a2', 'a'), mk('a3', 'a'), mk('a4', 'a')];
    const r = pick(pool, config);
    expect(r.groupId).toBe('a');
    expect(r.ids).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  it('empate resolve pela ordem da lista de grupos', () => {
    // mesmo rank nunca ocorre numa fila; o desempate vale quando o ranking é igual por fill
    const pool = [mk('a1', 'a'), mk('a2', 'a'), mk('a3', 'a'), mk('a4', 'a'),
      mk('b1', 'b'), mk('b2', 'b'), mk('b3', 'b'), mk('b4', 'b')];
    expect(pick(pool, config).groupId).toBe('a');
  });
});

describe('política: prioridade', () => {
  const config = cfg([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 'priority');
  const pool = [
    ...['b1', 'b2', 'b3', 'b4'].map((id) => mk(id, 'b')),
    ...['a1', 'a2', 'a3', 'a4'].map((id) => mk(id, 'a')),
  ];
  it('o grupo de cima da lista ocupa a quadra, mesmo esperando há menos', () => {
    expect(pick(pool, config).groupId).toBe('a');
  });
  it('quando o de cima não preenche, joga o de baixo', () => {
    expect(pick(pool.filter((p) => p.id !== 'a4'), config).groupId).toBe('b');
  });
  it('quem está sem grupo é o último da prioridade', () => {
    const p2 = [...['u1', 'u2', 'u3', 'u4'].map((id) => mk(id)), ...pool];
    expect(pick(p2, config).groupId).toBe('a');
  });
});

describe('política: revezamento', () => {
  const config = cfg([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }], 'rotate');
  const mkG = (g) => ['1', '2', '3', '4'].map((n) => mk(`${g}${n}`, g));
  const pool = [...mkG('a'), ...mkG('b'), ...mkG('c')];

  it('depois do grupo que jogou por último vem o seguinte da lista', () => {
    expect(pick(pool, config, { lastGroupId: 'a' }).groupId).toBe('b');
    expect(pick(pool, config, { lastGroupId: 'b' }).groupId).toBe('c');
  });
  it('dá a volta ao fim da lista', () => {
    expect(pick(pool, config, { lastGroupId: 'c' }).groupId).toBe('a');
  });
  it('sem partida anterior começa pelo primeiro grupo', () => {
    expect(pick(pool, config, { lastGroupId: undefined }).groupId).toBe('a');
  });
  it('pula o grupo da vez se ele não tem partida pronta', () => {
    const semB = pool.filter((p) => !p.id.startsWith('b'));
    expect(pick(semB, config, { lastGroupId: 'a' }).groupId).toBe('c');
  });
  it('revezar vale mesmo com o outro esperando há mais tempo', () => {
    const cC_primeiro = [...mkG('c'), ...mkG('a'), ...mkG('b')];
    expect(pick(cC_primeiro, config, { lastGroupId: 'a' }).groupId).toBe('b');
  });
});

describe('grupo em pausa e quadras do grupo', () => {
  it('grupo em pausa não entra no sorteio', () => {
    const config = cfg([{ id: 'a', name: 'A', paused: true }, { id: 'b', name: 'B' }]);
    const pool = [...['a1', 'a2', 'a3', 'a4'].map((id) => mk(id, 'a')), ...['b1', 'b2', 'b3', 'b4'].map((id) => mk(id, 'b'))];
    expect(pick(pool, config).groupId).toBe('b');
    expect(pick(pool.slice(0, 4), config)).toBeNull();
  });

  it('o grupo só ocupa as quadras que são dele', () => {
    const config = cfg([{ id: 'a', name: 'A', courts: [1] }, { id: 'b', name: 'B', courts: [2] }]);
    const pool = [...['a1', 'a2', 'a3', 'a4'].map((id) => mk(id, 'a')), ...['b1', 'b2', 'b3', 'b4'].map((id) => mk(id, 'b'))];
    expect(pick(pool, config, { court: 1 }).groupId).toBe('a');
    expect(pick(pool, config, { court: 2 }).groupId).toBe('b');
    expect(pick(pool.slice(0, 4), config, { court: 2 })).toBeNull();
  });

  it('quadra de ninguém: só quem está sem grupo joga nela', () => {
    const config = cfg([{ id: 'a', name: 'A', courts: [1] }]);
    const pool = [...['a1', 'a2', 'a3', 'a4'].map((id) => mk(id, 'a')), ...['u1', 'u2', 'u3', 'u4'].map((id) => mk(id))];
    expect(pick(pool, config, { court: 3 }).groupId).toBeNull();
  });
});

describe('o grupo escolhido à mão (forceGroupId)', () => {
  const config = cfg([{ id: 'a', name: 'A', courts: [1] }, { id: 'b', name: 'B' }], 'priority');
  const pool = [
    ...['b1', 'b2', 'b3', 'b4'].map((id) => mk(id, 'b')),
    ...['a1', 'a2', 'a3', 'a4'].map((id) => mk(id, 'a')),
    ...['u1', 'u2', 'u3', 'u4'].map((id) => mk(id)),
  ];
  it('vale por cima da política', () => {
    expect(pick(pool, config, { forceGroupId: 'b' }).groupId).toBe('b');
  });
  it('vale por cima das quadras do grupo', () => {
    expect(pick(pool, config, { court: 2, forceGroupId: 'a' }).groupId).toBe('a');
  });
  it('NO_GROUP escolhe a fila de quem está sem grupo', () => {
    expect(pick(pool, config, { forceGroupId: NO_GROUP }).groupId).toBeNull();
  });
  it('se o grupo escolhido não tem partida, não troca por outro: não há partida', () => {
    expect(pick(pool.filter((p) => p.id !== 'b4'), config, { forceGroupId: 'b' })).toBeNull();
  });
  it('grupo que não existe é ignorado: segue a política', () => {
    expect(pick(pool, config, { forceGroupId: 'zzz' }).groupId).toBe('a');
  });
});

describe('formação exigida × preferida', () => {
  const mista = (strict) => cfg([{ id: 'a', name: 'Mistas', formation: 'mixed', strict }]);
  const mista2 = (strict) => cfg([{ id: 'a', name: 'Mistas', formation: 'mixed', strict }]);

  it('exigida: forma 2 homens + 2 mulheres mesmo com os homens esperando mais', () => {
    const pool = [H('h1', 'a'), H('h2', 'a'), H('h3', 'a'), H('h4', 'a'), F('f1', 'a'), F('f2', 'a')];
    const r = pick(pool, mista(true));
    expect(r.ids).toEqual(['h1', 'h2', 'f1', 'f2']);
  });

  it('exigida: sem mulher suficiente não há partida — a fila espera', () => {
    const pool = [H('h1', 'a'), H('h2', 'a'), H('h3', 'a'), H('h4', 'a'), F('f1', 'a')];
    expect(pick(pool, mista(true))).toBeNull();
  });

  it('preferida: sem mulher suficiente completa com o que há (não trava a quadra)', () => {
    const pool = [H('h1', 'a'), H('h2', 'a'), H('h3', 'a'), H('h4', 'a'), F('f1', 'a')];
    expect(pick(pool, mista2(false)).ids).toEqual(['h1', 'h2', 'h3', 'h4']);
  });

  it('preferida: havendo como, forma a mista', () => {
    const pool = [H('h1', 'a'), H('h2', 'a'), H('h3', 'a'), H('h4', 'a'), F('f1', 'a'), F('f2', 'a')];
    expect(pick(pool, mista2(false)).ids).toEqual(['h1', 'h2', 'f1', 'f2']);
  });

  it('mesmo sexo exigido: pula quem não completa e joga os que completam', () => {
    const config = cfg([{ id: 'a', name: 'Mesmo sexo', formation: 'same_sex', strict: true }]);
    const pool = [H('h1', 'a'), F('f1', 'a'), F('f2', 'a'), H('h2', 'a'), F('f3', 'a'), F('f4', 'a')];
    expect(pick(pool, config).ids).toEqual(['f1', 'f2', 'f3', 'f4']);
  });

  it('quem espera há mais tempo e PODE jogar entra primeiro', () => {
    const config = cfg([{ id: 'a', name: 'Mesmo sexo', formation: 'same_sex', strict: true }]);
    const pool = [H('h1', 'a'), F('f1', 'a'), F('f2', 'a'), F('f3', 'a'), F('f4', 'a'), H('h2', 'a'), H('h3', 'a'), H('h4', 'a'), H('h5', 'a')];
    // h1 sozinho não forma partida ainda... com h2..h5 forma: h1 é o primeiro que PODE jogar
    expect(pick(pool, config).ids).toEqual(['h1', 'h2', 'h3', 'h4']);
  });

  it('sexo desconhecido não preenche vaga de mista exigida', () => {
    const pool = [H('h1', 'a'), F('f1', 'a'), mk('x1', 'a'), mk('x2', 'a')];
    expect(pick(pool, mista(true))).toBeNull();
  });

  it('janela larga o bastante para achar quem está no fim da fila', () => {
    const homens = Array.from({ length: 7 }, (_, i) => H(`h${i + 1}`, 'a'));
    const pool = [...homens, F('f1', 'a'), F('f2', 'a')];
    expect(pick(pool, mista(true)).ids).toEqual(['h1', 'h2', 'f1', 'f2']);
  });
});

describe('diferença máxima de nível', () => {
  const N = (id, level, gid = 'a') => mk(id, gid, { level_value: level });
  const exigida = (strict) => cfg([{ id: 'a', name: 'Nível', max_level_gap: 0.5, strict }]);

  it('exigida: só junta quem está dentro do limite', () => {
    const pool = [N('p1', 3.0), N('p2', 5.0), N('p3', 3.2), N('p4', 3.4), N('p5', 3.3)];
    expect(pick(pool, exigida(true)).ids).toEqual(['p1', 'p3', 'p4', 'p5']);
  });

  it('exigida: se ninguém forma partida dentro do limite, não há partida', () => {
    const pool = [N('p1', 3.0), N('p2', 5.0), N('p3', 3.2), N('p4', 5.1)];
    expect(pick(pool, exigida(true))).toBeNull();
  });

  it('preferida: tenta o limite e, se não dá, joga o que há', () => {
    const pool = [N('p1', 3.0), N('p2', 5.0), N('p3', 3.2), N('p4', 5.1)];
    expect(pick(pool, exigida(false)).ids).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('quem não tem nível conhecido não barra ninguém', () => {
    const pool = [N('p1', 3.0), mk('p2', 'a'), N('p3', 3.2), N('p4', 3.4)];
    expect(pick(pool, exigida(true)).ids).toEqual(['p1', 'p2', 'p3', 'p4']);
  });
});

describe('completar com quem está sem grupo (fill)', () => {
  it('faltando gente no grupo, completa — o grupo vem primeiro', () => {
    const config = cfg([{ id: 'a', name: 'A', fill: true }]);
    const pool = [mk('u1'), mk('a1', 'a'), mk('a2', 'a'), mk('u2'), mk('a3', 'a')];
    const r = pick(pool, config);
    expect(r.groupId).toBe('a');
    expect(r.ids).toEqual(['u1', 'a1', 'a2', 'a3']);
  });

  it('sem o interruptor, não completa: o grupo espera e os sem grupo jogam entre si', () => {
    const config = cfg([{ id: 'a', name: 'A' }]);
    const pool = [mk('a1', 'a'), mk('a2', 'a'), mk('a3', 'a'), mk('u1'), mk('u2')];
    expect(pick(pool, config)).toBeNull();
  });

  it('nunca vira uma partida só de gente sem grupo atribuída ao grupo', () => {
    const config = cfg([{ id: 'a', name: 'A', fill: true }]);
    const pool = [mk('u1'), mk('u2'), mk('u3'), mk('u4')];
    expect(pick(pool, config).groupId).toBeNull();
  });
});

describe('dupla vinculada dentro dos grupos', () => {
  it('o vínculo com alguém de OUTRO grupo é ignorado no sorteio (não trava ninguém)', () => {
    const config = cfg([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
    const pool = [mk('a1', 'a', { partner_id: 'b1' }), mk('b1', 'b', { partner_id: 'a1' }),
      mk('a2', 'a'), mk('a3', 'a'), mk('a4', 'a')];
    const r = pick(pool, config);
    expect(r.groupId).toBe('a');
    expect(r.ids).toContain('a1');
  });

  it('dupla do mesmo grupo continua entrando junta', () => {
    const config = cfg([{ id: 'a', name: 'A' }]);
    const pool = [mk('a1', 'a', { partner_id: 'a2' }), mk('a3', 'a'), mk('a2', 'a', { partner_id: 'a1' }), mk('a4', 'a'), mk('a5', 'a')];
    const r = pick(pool, config);
    expect(r.ids).toContain('a1');
    expect(r.ids).toContain('a2');
  });

  it('parceiro que está em quadra (fora da fila) segue fazendo o outro aguardar', () => {
    const config = cfg([{ id: 'a', name: 'A' }]);
    const pool = [mk('a1', 'a', { partner_id: 'noCourt' }), mk('a2', 'a'), mk('a3', 'a'), mk('a4', 'a'), mk('a5', 'a')];
    expect(pick(pool, config).ids).toEqual(['a2', 'a3', 'a4', 'a5']);
  });
});

describe('lastGroupIdFromGames', () => {
  it('o grupo da partida mais recente', () => {
    const games = [
      { order: 1, group_id: 'a' }, { order: 3, group_id: 'b' }, { order: 2, group_id: 'c' },
    ];
    expect(lastGroupIdFromGames(games)).toBe('b');
  });
  it('partida sem grupo conta como "sem grupo" (null)', () => {
    expect(lastGroupIdFromGames([{ order: 1, group_id: 'a' }, { order: 2 }])).toBeNull();
  });
  it('sem partidas, desconhecido (undefined)', () => {
    expect(lastGroupIdFromGames([])).toBeUndefined();
    expect(lastGroupIdFromGames(undefined)).toBeUndefined();
  });
});

describe('makeGroupsDrawer — a peça que a previsão e o serviço usam', () => {
  const config = cfg([
    { id: 'a', name: 'Alfa', color: 'rose' },
    { id: 'm', name: 'Mistas', formation: 'mixed' },
    { id: 's', name: 'Mesmo', formation: 'same_sex' },
  ]);
  const drawer = makeGroupsDrawer(config, { games: [{ order: 5, group_id: 'a' }], courtGroups: { 2: 'm' } });

  it('guarda a última partida e o grupo escolhido por quadra', () => {
    expect(drawer.lastGroupId).toBe('a');
    expect(drawer.courtGroups).toEqual({ 2: 'm' });
  });
  it('dá o retrato do grupo (para a partida e para a tela)', () => {
    expect(drawer.meta('a')).toEqual({ id: 'a', name: 'Alfa', color: 'rose' });
    expect(drawer.meta(null)).toBeNull();
    expect(drawer.meta('zzz')).toBeNull();
  });
  it('diz como as duplas se formam em cada grupo', () => {
    expect(drawer.pairingOf('a')).toBe('default');
    expect(drawer.pairingOf('m')).toBe('mixed');
    expect(drawer.pairingOf('s')).toBe('same_sex');
    expect(drawer.pairingOf(null)).toBe('default');
  });
  it('escolhe pelo mesmo caminho de pickGroupedMatch', () => {
    const pool = ['a1', 'a2', 'a3', 'a4'].map((id) => mk(id, 'a'));
    expect(drawer.pick({ pool, court: 1, slots: 4 })).toEqual(pick(pool, config, { lastGroupId: 'a' }));
  });
  it('usa a quadra escolhida à mão quando o chamador não força outra', () => {
    const pool = [...['a1', 'a2', 'a3', 'a4'].map((id) => mk(id, 'a')), ...['m1', 'm2'].map((id) => H(id, 'm')), ...['m3', 'm4'].map((id) => F(id, 'm'))];
    expect(drawer.pick({ pool, court: 2, slots: 4 }).groupId).toBe('m');
  });
});

describe('explainGroups — por que o grupo joga (ou não)', () => {
  const view = (order, extra = {}) => ({ order, inCourt: [], unavailable: [], ...extra });
  const ex = (v, config, extra = {}) => explainGroups({ view: v, config, slots: 4, ...extra });
  const by = (list, id) => list.find((e) => e.id === id);

  it('pronto quando já há partida para a próxima quadra livre', () => {
    const config = cfg([{ id: 'a', name: 'A' }]);
    const r = ex(view(['a1', 'a2', 'a3', 'a4'].map((id) => mk(id, 'a'))), config);
    expect(by(r, 'a')).toMatchObject({ status: 'ready', waiting: 4 });
  });

  it('faltam jogadores: diz quantos', () => {
    const config = cfg([{ id: 'a', name: 'A' }]);
    const r = ex(view(['a1', 'a2'].map((id) => mk(id, 'a'))), config);
    expect(by(r, 'a')).toMatchObject({ status: 'short', missing: 2 });
    expect(by(r, 'a').reason).toMatch(/Faltam 2 jogadores/);
  });

  it('falta um: no singular', () => {
    const config = cfg([{ id: 'a', name: 'A' }]);
    const r = ex(view(['a1', 'a2', 'a3'].map((id) => mk(id, 'a'))), config);
    expect(by(r, 'a').reason).toMatch(/Falta 1 jogador\b/);
  });

  it('mista exigida sem mulheres: diz quem falta', () => {
    const config = cfg([{ id: 'a', name: 'Mistas', formation: 'mixed', strict: true }]);
    const r = ex(view([H('h1', 'a'), H('h2', 'a'), H('h3', 'a'), H('h4', 'a'), F('f1', 'a')]), config);
    const e = by(r, 'a');
    expect(e.status).toBe('blocked');
    expect(e.reason).toMatch(/Falta 1 mulher/);
    expect(e.reason).toMatch(/duplas mistas/);
  });

  it('mesmo sexo exigido sem completar', () => {
    const config = cfg([{ id: 'a', name: 'Mesmo', formation: 'same_sex', strict: true }]);
    const r = ex(view([H('h1', 'a'), H('h2', 'a'), F('f1', 'a'), F('f2', 'a')]), config);
    expect(by(r, 'a').status).toBe('blocked');
    expect(by(r, 'a').reason).toMatch(/mesmo sexo/);
  });

  it('diferença de nível exigida', () => {
    const config = cfg([{ id: 'a', name: 'Nível', max_level_gap: 0.5, strict: true }]);
    const N = (id, l) => mk(id, 'a', { level_value: l });
    const r = ex(view([N('p1', 3), N('p2', 5), N('p3', 3), N('p4', 5)]), config);
    expect(by(r, 'a').status).toBe('blocked');
    expect(by(r, 'a').reason).toMatch(/diferença de nível/i);
  });

  it('regra apenas preferida nunca bloqueia', () => {
    const config = cfg([{ id: 'a', name: 'Mistas', formation: 'mixed', strict: false }]);
    const r = ex(view([H('h1', 'a'), H('h2', 'a'), H('h3', 'a'), H('h4', 'a')]), config);
    expect(by(r, 'a').status).toBe('ready');
  });

  it('grupo em pausa e grupo sem ninguém', () => {
    const config = cfg([{ id: 'a', name: 'A', paused: true }, { id: 'b', name: 'B' }]);
    const r = ex(view(['a1', 'a2', 'a3', 'a4'].map((id) => mk(id, 'a'))), config);
    expect(by(r, 'a').status).toBe('paused');
    expect(by(r, 'b').status).toBe('empty');
  });

  it('todos do grupo em quadra: nada a esperar agora', () => {
    const config = cfg([{ id: 'a', name: 'A' }]);
    const r = ex(view([], { inCourt: ['a1', 'a2', 'a3', 'a4'].map((id) => mk(id, 'a')) }), config);
    expect(by(r, 'a')).toMatchObject({ status: 'idle', inCourt: 4, waiting: 0 });
    expect(by(r, 'a').reason).toMatch(/em quadra/i);
  });

  it('as quadras livres não são deste grupo', () => {
    const config = cfg([{ id: 'a', name: 'A', courts: [1, 2] }]);
    const r = ex(view(['a1', 'a2', 'a3', 'a4'].map((id) => mk(id, 'a'))), config, { freeCourts: [3] });
    expect(by(r, 'a').status).toBe('no_court');
  });

  it('conta com quem está sem grupo quando o grupo completa', () => {
    const config = cfg([{ id: 'a', name: 'A', fill: true }]);
    const r = ex(view([mk('a1', 'a'), mk('a2', 'a'), mk('a3', 'a'), mk('u1')]), config);
    expect(by(r, 'a').status).toBe('ready');
    const r2 = ex(view([mk('a1', 'a'), mk('a2', 'a'), mk('u1')]), config);
    expect(by(r2, 'a')).toMatchObject({ status: 'short', missing: 1 });
  });

  it('"Sem grupo" só aparece quando tem gente', () => {
    const config = cfg([{ id: 'a', name: 'A' }]);
    expect(by(ex(view([mk('a1', 'a')]), config), null)).toBeUndefined();
    const r = ex(view([mk('a1', 'a'), mk('u1')]), config);
    expect(by(r, null)).toMatchObject({ name: 'Sem grupo', waiting: 1 });
  });

  it('conta pausados do grupo', () => {
    const config = cfg([{ id: 'a', name: 'A' }]);
    const r = ex(view([mk('a1', 'a')], { unavailable: [mk('a2', 'a', { skip_remaining: 2 })] }), config);
    expect(by(r, 'a')).toMatchObject({ total: 2, waiting: 1, pausados: 1 });
  });
});

describe('describeNoMatch — a mensagem quando nenhum grupo joga', () => {
  it('junta o motivo de cada grupo com gente esperando', () => {
    const config = cfg([{ id: 'a', name: 'Alfa' }, { id: 'b', name: 'Beta', formation: 'mixed', strict: true }]);
    const view = {
      order: [mk('a1', 'a'), H('b1', 'b'), H('b2', 'b'), H('b3', 'b'), H('b4', 'b')],
      inCourt: [], unavailable: [],
    };
    const txt = describeNoMatch(explainGroups({ view, config, slots: 4 }));
    expect(txt).toMatch(/Alfa/);
    expect(txt).toMatch(/Beta/);
    expect(txt).toMatch(/mulher/);
  });
  it('ninguém esperando', () => {
    const config = cfg([{ id: 'a', name: 'A' }]);
    expect(describeNoMatch(explainGroups({ view: { order: [], inCourt: [], unavailable: [] }, config, slots: 4 })))
      .toMatch(/ninguém/i);
  });
});

describe('buildGroupedPlayView — a visão do Play com grupos, num lugar só', () => {
  const config = cfg([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 'priority');
  const participants = [
    mk('b1', 'b', { available_since: 1 }), mk('b2', 'b', { available_since: 2 }),
    mk('b3', 'b', { available_since: 3 }), mk('b4', 'b', { available_since: 4 }),
    mk('a1', 'a', { available_since: 10 }), mk('a2', 'a', { available_since: 11 }),
    mk('a3', 'a', { available_since: 12 }), mk('a4', 'a', { available_since: 13 }),
    mk('u1', null, { available_since: 20 }),
  ];

  it('a ordem de entrada segue a política e cada fila tem a sua numeração', () => {
    const drawer = makeGroupsDrawer(config, { games: [], participants });
    const v = buildGroupedPlayView({ participants, games: [], courts: 1, drawer });
    // prioridade: o grupo A primeiro, mesmo esperando há menos tempo
    expect(v.order.slice(0, 4).map((p) => p.id)).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(v.order.find((p) => p.id === 'b1').groupNo).toBe(1);
    expect(v.order.find((p) => p.id === 'a3').groupNo).toBe(3);
    expect(v.order.find((p) => p.id === 'u1')).toMatchObject({ group_id: null, groupNo: 1 });
  });

  it('quem está em quadra e quem está pausado também carregam o grupo', () => {
    const jogo = {
      id: 'g', status: 'open', court: 1, order: 1,
      side_a: [{ id: 'a1' }, { id: 'a2' }], side_b: [{ id: 'a3' }, { id: 'a4' }],
    };
    const pausado = { ...participants[0], skip_remaining: 2 };
    const lista = [pausado, ...participants.slice(1)];
    const drawer = makeGroupsDrawer(config, { games: [jogo], participants: lista });
    const v = buildGroupedPlayView({ participants: lista, games: [jogo], courts: 2, drawer });
    expect(v.inCourt.map((p) => p.group_id)).toEqual(['a', 'a', 'a', 'a']);
    expect(v.unavailable[0].group_id).toBe('b');
  });
});

describe('courtHasMatch — o botão "Criar jogo" desta quadra', () => {
  const config = cfg([{ id: 'a', name: 'A', courts: [1] }, { id: 'b', name: 'B', courts: [2] }]);
  const fila = [...['a1', 'a2', 'a3', 'a4'].map((id) => mk(id, 'a'))];
  const drawer = makeGroupsDrawer(config, { games: [] });

  it('há partida quando um grupo que pode usar a quadra preenche', () => {
    expect(courtHasMatch(drawer, { order: fila, court: 1, kind: 'doubles' })).toBe(true);
  });
  it('não há quando a quadra não é de nenhum grupo com gente', () => {
    expect(courtHasMatch(drawer, { order: fila, court: 2, kind: 'doubles' })).toBe(false);
  });
  it('no simples bastam dois, e a dupla vinculada não conta', () => {
    const dois = [mk('a1', 'a', { partner_id: 'a2' }), mk('a2', 'a', { partner_id: 'a1' })];
    expect(courtHasMatch(drawer, { order: dois, court: 1, kind: 'singles' })).toBe(true);
    expect(courtHasMatch(drawer, { order: dois, court: 1, kind: 'doubles' })).toBe(false);
  });
  it('o grupo escolhido à mão para a quadra é o que vale', () => {
    const forcado = makeGroupsDrawer(config, { games: [], courtGroups: { 1: 'b' } });
    expect(courtHasMatch(forcado, { order: fila, court: 1, kind: 'doubles' })).toBe(false);
  });
});
