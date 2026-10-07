import { describe, it, expect } from 'vitest';
import {
  GROUP_FORMATION, GROUP_GENDER, GROUP_POLICY, PLAY_GROUP_LIMITS, PLAY_GROUP_COLORS, NO_GROUP,
  normalizePlayGroup, normalizePlayGroupsConfig, validatePlayGroups, isPlayGroupsActive,
  groupIdOf, groupById, levelInRange, fitsFormation, fitsLevelGap,
  matchGroupFor, suggestPlayGroupAssignments, groupForEntry,
  PLAY_GROUP_TEMPLATES, buildTemplateGroups, applyGroupNumbers, groupsConfigWarnings,
  describeGroupRules, newGroupId, groupSnapshot, withLevels,
  profileMismatch, linkedPartnerInOtherGroup,
} from './playGroups.js';

const P = (id, extra = {}) => ({ id, name: id.toUpperCase(), ...extra });
const H = (id, extra = {}) => P(id, { play_gender: 'male', ...extra });
const M = (id, extra = {}) => P(id, { play_gender: 'female', ...extra });

describe('normalizePlayGroup', () => {
  it('aplica os padrões de um grupo recém-criado', () => {
    const g = normalizePlayGroup({ id: 'a', name: '  Iniciantes  ' }, 0);
    expect(g).toEqual({
      id: 'a', name: 'Iniciantes', color: PLAY_GROUP_COLORS[0],
      level_min: null, level_max: null, gender: GROUP_GENDER.ANY,
      formation: GROUP_FORMATION.FREE, max_level_gap: null, strict: false,
      courts: [], fill: false, paused: false, join: 'open',
    });
  });

  it('dá nome e cor quando faltam, pela posição', () => {
    const g = normalizePlayGroup({ id: 'x' }, 2);
    expect(g.name).toBe('Grupo 3');
    expect(g.color).toBe(PLAY_GROUP_COLORS[2]);
  });

  it('corta o nome no limite e ignora cor desconhecida', () => {
    const g = normalizePlayGroup({ id: 'x', name: 'a'.repeat(99), color: 'magenta' }, 1);
    expect(g.name).toHaveLength(PLAY_GROUP_LIMITS.NAME_MAX);
    expect(g.color).toBe(PLAY_GROUP_COLORS[1]);
  });

  it('limita o nível a 2.0–8.0 e troca min/max invertidos', () => {
    expect(normalizePlayGroup({ id: 'x', level_min: 9, level_max: 1 }, 0))
      .toMatchObject({ level_min: 2, level_max: 8 });
    expect(normalizePlayGroup({ id: 'x', level_min: 4, level_max: 3 }, 0))
      .toMatchObject({ level_min: 3, level_max: 4 });
  });

  it('nível não numérico (inclusive vazio) é "sem limite", nunca zero', () => {
    const g = normalizePlayGroup({ id: 'x', level_min: '', level_max: null }, 0);
    expect(g.level_min).toBeNull();
    expect(g.level_max).toBeNull();
  });

  it('aceita faixa só com piso ou só com teto', () => {
    expect(normalizePlayGroup({ id: 'x', level_min: 4 }, 0))
      .toMatchObject({ level_min: 4, level_max: null });
    expect(normalizePlayGroup({ id: 'x', level_max: 3 }, 0))
      .toMatchObject({ level_min: null, level_max: 3 });
  });

  it('só aceita formação, sexo e entrada conhecidos', () => {
    const g = normalizePlayGroup({
      id: 'x', formation: 'xadrez', gender: 'alien', join: 'talvez',
    }, 0);
    expect(g).toMatchObject({ formation: 'free', gender: 'any', join: 'open' });
    expect(normalizePlayGroup({ id: 'x', formation: 'mixed', gender: 'female', join: 'closed' }, 0))
      .toMatchObject({ formation: 'mixed', gender: 'female', join: 'closed' });
  });

  it('normaliza quadras: inteiros positivos, sem repetição, em ordem', () => {
    expect(normalizePlayGroup({ id: 'x', courts: [3, '1', 1, 0, -2, 2.7, 'a'] }, 0).courts)
      .toEqual([1, 2, 3]);
    expect(normalizePlayGroup({ id: 'x', courts: 'tudo' }, 0).courts).toEqual([]);
  });

  it('a diferença máxima de nível só vale positiva e razoável', () => {
    expect(normalizePlayGroup({ id: 'x', max_level_gap: 1 }, 0).max_level_gap).toBe(1);
    expect(normalizePlayGroup({ id: 'x', max_level_gap: 0 }, 0).max_level_gap).toBeNull();
    expect(normalizePlayGroup({ id: 'x', max_level_gap: -1 }, 0).max_level_gap).toBeNull();
    expect(normalizePlayGroup({ id: 'x', max_level_gap: 'x' }, 0).max_level_gap).toBeNull();
    expect(normalizePlayGroup({ id: 'x', max_level_gap: 99 }, 0).max_level_gap).toBe(PLAY_GROUP_LIMITS.MAX_GAP);
  });

  it('só true literal liga os interruptores', () => {
    const g = normalizePlayGroup({ id: 'x', strict: 'sim', fill: 1, paused: 'true' }, 0);
    expect(g).toMatchObject({ strict: false, fill: false, paused: false });
    expect(normalizePlayGroup({ id: 'x', strict: true, fill: true, paused: true }, 0))
      .toMatchObject({ strict: true, fill: true, paused: true });
  });

  it('lixo não vira grupo', () => {
    expect(normalizePlayGroup(null, 0)).toBeNull();
    expect(normalizePlayGroup('x', 0)).toBeNull();
  });
});

describe('normalizePlayGroupsConfig', () => {
  it('dia sem o campo = sem grupos, política fila', () => {
    expect(normalizePlayGroupsConfig({})).toEqual({ groups: [], policy: GROUP_POLICY.QUEUE });
    expect(normalizePlayGroupsConfig(null)).toEqual({ groups: [], policy: GROUP_POLICY.QUEUE });
    expect(normalizePlayGroupsConfig({ play_groups: 'x' }).groups).toEqual([]);
  });

  it('descarta itens inválidos, refaz ids repetidos/ausentes e respeita o teto', () => {
    const cfg = normalizePlayGroupsConfig({
      play_groups: [{ id: 'a', name: 'A' }, null, { id: 'a', name: 'B' }, { name: 'C' }],
    });
    expect(cfg.groups).toHaveLength(3);
    expect(new Set(cfg.groups.map((g) => g.id)).size).toBe(3);

    const muitos = Array.from({ length: 30 }, (_, i) => ({ id: `g${i}`, name: `G${i}` }));
    expect(normalizePlayGroupsConfig({ play_groups: muitos }).groups)
      .toHaveLength(PLAY_GROUP_LIMITS.MAX_GROUPS);
  });

  it('política desconhecida cai na fila', () => {
    expect(normalizePlayGroupsConfig({ play_groups_policy: 'caos' }).policy).toBe('queue');
    expect(normalizePlayGroupsConfig({ play_groups_policy: 'rotate' }).policy).toBe('rotate');
    expect(normalizePlayGroupsConfig({ play_groups_policy: 'priority' }).policy).toBe('priority');
  });

  it('é idempotente: normalizar o já normalizado não muda nada', () => {
    const uma = normalizePlayGroupsConfig({
      play_groups: [{ id: 'a', level_min: 3, level_max: 4, courts: [2, 1], formation: 'mixed' }, { name: 'B' }],
      play_groups_policy: 'priority',
    });
    const duas = normalizePlayGroupsConfig({ play_groups: uma.groups, play_groups_policy: uma.policy });
    expect(duas).toEqual(uma);
  });
});

describe('validatePlayGroups (o que o organizador digitou)', () => {
  it('aceita uma configuração boa e devolve o valor normalizado para gravar', () => {
    const r = validatePlayGroups({ groups: [{ id: 'a', name: 'Avançados', level_min: 4 }], policy: 'rotate' });
    expect(r.valid).toBe(true);
    expect(r.value.play_groups_policy).toBe('rotate');
    expect(r.value.play_groups[0]).toMatchObject({ id: 'a', name: 'Avançados', level_min: 4 });
  });

  it('recusa nome repetido (ignorando caixa e espaço) — a tela não distinguiria os dois', () => {
    const r = validatePlayGroups({ groups: [{ id: 'a', name: 'Alfa' }, { id: 'b', name: ' alfa ' }] });
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/nome/i);
  });

  it('recusa nome vazio', () => {
    const r = validatePlayGroups({ groups: [{ id: 'a', name: '   ' }] });
    expect(r.valid).toBe(false);
  });

  it('recusa passar do teto de grupos', () => {
    const muitos = Array.from({ length: PLAY_GROUP_LIMITS.MAX_GROUPS + 1 }, (_, i) => ({ id: `g${i}`, name: `G${i}` }));
    expect(validatePlayGroups({ groups: muitos }).valid).toBe(false);
  });

  it('lista vazia é válida: é como se desliga os grupos', () => {
    const r = validatePlayGroups({ groups: [] });
    expect(r.valid).toBe(true);
    expect(r.value.play_groups).toEqual([]);
  });
});

describe('isPlayGroupsActive', () => {
  const dia = { format: 'play', play_groups: [{ id: 'a', name: 'A' }] };
  it('só com a flag, o formato Play e ao menos um grupo', () => {
    expect(isPlayGroupsActive(dia, true)).toBe(true);
    expect(isPlayGroupsActive(dia, false)).toBe(false);
    expect(isPlayGroupsActive({ ...dia, format: 'americano_live' }, true)).toBe(false);
    expect(isPlayGroupsActive({ format: 'play' }, true)).toBe(false);
    expect(isPlayGroupsActive(null, true)).toBe(false);
  });
});

describe('groupIdOf / groupById', () => {
  const cfg = normalizePlayGroupsConfig({ play_groups: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });
  it('devolve o grupo do participante', () => {
    expect(groupIdOf({ play_group_id: 'b' }, cfg)).toBe('b');
  });
  it('grupo que não existe mais é "sem grupo"', () => {
    expect(groupIdOf({ play_group_id: 'sumiu' }, cfg)).toBeNull();
    expect(groupIdOf({}, cfg)).toBeNull();
    expect(groupIdOf(null, cfg)).toBeNull();
  });
  it('groupById acha ou devolve null', () => {
    expect(groupById(cfg, 'a').name).toBe('A');
    expect(groupById(cfg, 'z')).toBeNull();
    expect(groupById(cfg, NO_GROUP)).toBeNull();
  });
});

describe('levelInRange', () => {
  it('os dois extremos valem (limite compartilhado entre grupos vizinhos)', () => {
    expect(levelInRange(3, 3, 4)).toBe(true);
    expect(levelInRange(4, 3, 4)).toBe(true);
    expect(levelInRange(2.99, 3, 4)).toBe(false);
    expect(levelInRange(4.01, 3, 4)).toBe(false);
  });
  it('faixa aberta de um lado', () => {
    expect(levelInRange(7.9, 4, null)).toBe(true);
    expect(levelInRange(3.9, 4, null)).toBe(false);
    expect(levelInRange(2.1, null, 3)).toBe(true);
    expect(levelInRange(3.1, null, 3)).toBe(false);
  });
  it('sem faixa, todo mundo cabe; sem nível, ninguém é barrado', () => {
    expect(levelInRange(5, null, null)).toBe(true);
    expect(levelInRange(null, 3, 4)).toBe(true);
    expect(levelInRange(undefined, 3, 4)).toBe(true);
  });
});

describe('fitsFormation', () => {
  it('livre aceita qualquer um', () => {
    expect(fitsFormation([H('a'), H('b'), H('c'), M('d')], 'free')).toBe(true);
  });
  it('mista: metade homens, metade mulheres', () => {
    expect(fitsFormation([H('a'), H('b'), M('c'), M('d')], 'mixed')).toBe(true);
    expect(fitsFormation([H('a'), H('b'), H('c'), M('d')], 'mixed')).toBe(false);
    expect(fitsFormation([H('a'), M('b')], 'mixed')).toBe(true); // simples misto
    expect(fitsFormation([H('a'), H('b')], 'mixed')).toBe(false);
  });
  it('mesmo sexo: todos iguais', () => {
    expect(fitsFormation([H('a'), H('b'), H('c'), H('d')], 'same_sex')).toBe(true);
    expect(fitsFormation([M('a'), M('b'), M('c'), M('d')], 'same_sex')).toBe(true);
    expect(fitsFormation([H('a'), H('b'), H('c'), M('d')], 'same_sex')).toBe(false);
  });
  it('sexo desconhecido não preenche vaga de mista nem de mesmo sexo', () => {
    expect(fitsFormation([H('a'), M('b'), P('c'), P('d')], 'mixed')).toBe(false);
    expect(fitsFormation([H('a'), H('b'), H('c'), P('d')], 'same_sex')).toBe(false);
  });
  it('quantidade ímpar nunca é mista', () => {
    expect(fitsFormation([H('a'), M('b'), H('c')], 'mixed')).toBe(false);
  });
});

describe('fitsLevelGap', () => {
  const N = (id, level) => P(id, { level_value: level });
  it('sem limite sempre cabe', () => {
    expect(fitsLevelGap([N('a', 2), N('b', 8)], null)).toBe(true);
  });
  it('a diferença é entre o maior e o menor nível conhecido', () => {
    expect(fitsLevelGap([N('a', 3), N('b', 3.4), N('c', 3.5), N('d', 3.9)], 1)).toBe(true);
    expect(fitsLevelGap([N('a', 3), N('b', 4.2)], 1)).toBe(false);
  });
  it('o limite é inclusivo, sem tropeçar em ponto flutuante', () => {
    expect(fitsLevelGap([N('a', 3.1), N('b', 3.6)], 0.5)).toBe(true);
    expect(fitsLevelGap([N('a', 3.0), N('b', 3.6)], 0.6)).toBe(true);
  });
  it('quem não tem nível não conta (e não barra ninguém)', () => {
    expect(fitsLevelGap([N('a', 3), P('b'), N('c', 3.4)], 0.5)).toBe(true);
    expect(fitsLevelGap([P('a'), P('b')], 0.5)).toBe(true);
  });
  it('lê o nível declarado quando não há nível resolvido', () => {
    expect(fitsLevelGap([P('a', { play_level: 3 }), P('b', { play_level: 5 })], 1)).toBe(false);
  });
});

describe('matchGroupFor — qual grupo combina com a pessoa', () => {
  const cfg = normalizePlayGroupsConfig({
    play_groups: [
      { id: 'ini', name: 'Iniciantes', level_min: 2, level_max: 3 },
      { id: 'int', name: 'Intermediários', level_min: 3, level_max: 4 },
      { id: 'ava', name: 'Avançados', level_min: 4, level_max: 8 },
    ],
  });

  it('escolhe pela faixa; no limite compartilhado vale o grupo de cima da lista', () => {
    expect(matchGroupFor({ level: 2.5 }, cfg).group.id).toBe('ini');
    expect(matchGroupFor({ level: 3 }, cfg).group.id).toBe('ini');
    expect(matchGroupFor({ level: 3.01 }, cfg).group.id).toBe('int');
    expect(matchGroupFor({ level: 6 }, cfg).group.id).toBe('ava');
  });

  it('sem nível conhecido não há como escolher faixa: nada (não inventa)', () => {
    const r = matchGroupFor({ level: null }, cfg);
    expect(r.group).toBeNull();
    expect(r.reason).toMatch(/nível/i);
  });

  it('fora de qualquer faixa: nada, dizendo o porquê', () => {
    const buraco = normalizePlayGroupsConfig({
      play_groups: [{ id: 'a', name: 'A', level_min: 2, level_max: 3 }, { id: 'b', name: 'B', level_min: 4, level_max: 5 }],
    });
    const r = matchGroupFor({ level: 3.5 }, buraco);
    expect(r.group).toBeNull();
    expect(r.reason).toMatch(/faixa/i);
  });

  it('o sexo do grupo é respeitado; sexo desconhecido não entra em grupo que exige', () => {
    const c = normalizePlayGroupsConfig({
      play_groups: [
        { id: 'f', name: 'Feminino', level_min: 2, level_max: 8, gender: 'female' },
        { id: 'm', name: 'Masculino', level_min: 2, level_max: 8, gender: 'male' },
      ],
    });
    expect(matchGroupFor({ level: 4, gender: 'female' }, c).group.id).toBe('f');
    expect(matchGroupFor({ level: 4, gender: 'male' }, c).group.id).toBe('m');
    const semSexo = matchGroupFor({ level: 4, gender: null }, c);
    expect(semSexo.group).toBeNull();
    expect(semSexo.reason).toMatch(/sexo/i);
  });

  it('grupo sem faixa é o "geral": só pega quem nenhuma faixa pegou', () => {
    const c = normalizePlayGroupsConfig({
      play_groups: [
        { id: 'ava', name: 'Avançados', level_min: 5, level_max: 8 },
        { id: 'soc', name: 'Social' },
      ],
    });
    expect(matchGroupFor({ level: 6 }, c).group.id).toBe('ava');
    expect(matchGroupFor({ level: 3 }, c).group.id).toBe('soc');
    expect(matchGroupFor({ level: null }, c).group.id).toBe('soc');
  });

  it('dois grupos "gerais" empatam: não chuta', () => {
    const c = normalizePlayGroupsConfig({ play_groups: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });
    const r = matchGroupFor({ level: 3 }, c);
    expect(r.group).toBeNull();
    expect(r.reason).toMatch(/vários|escolh/i);
  });

  it('onlyOpen ignora grupos fechados (entrada sozinha)', () => {
    const c = normalizePlayGroupsConfig({
      play_groups: [{ id: 'f', name: 'Fechado', level_min: 2, level_max: 8, join: 'closed' }],
    });
    expect(matchGroupFor({ level: 4 }, c, { onlyOpen: true }).group).toBeNull();
    expect(matchGroupFor({ level: 4 }, c).group.id).toBe('f');
  });
});

describe('groupForEntry — entrada de quem chega', () => {
  const cfg = normalizePlayGroupsConfig({
    play_groups: [
      { id: 'ini', name: 'Iniciantes', level_min: 2, level_max: 3.5 },
      { id: 'ava', name: 'Avançados', level_min: 3.5, level_max: 8, join: 'closed' },
    ],
  });
  it('põe no grupo aberto que combina com o nível declarado', () => {
    expect(groupForEntry(cfg, { play_level: 3 })).toBe('ini');
  });
  it('nunca põe sozinho num grupo fechado', () => {
    expect(groupForEntry(cfg, { play_level: 6 })).toBeNull();
  });
  it('sem nível: sem grupo', () => {
    expect(groupForEntry(cfg, {})).toBeNull();
  });
  it('o nível resolvido vale mais que o declarado', () => {
    expect(groupForEntry(cfg, { play_level: 6, level_value: 3 })).toBe('ini');
  });
});

describe('suggestPlayGroupAssignments — "Distribuir por nível"', () => {
  const cfg = normalizePlayGroupsConfig({
    play_groups: [
      { id: 'ini', name: 'Iniciantes', level_min: 2, level_max: 3.5 },
      { id: 'ava', name: 'Avançados', level_min: 3.5, level_max: 8 },
    ],
  });
  const people = [
    P('a', { level_value: 2.5 }),
    P('b', { level_value: 5 }),
    P('c'), // sem nível
    P('d', { level_value: 3, play_group_id: 'ava' }), // já tem grupo
  ];

  it('por padrão só mexe em quem está sem grupo', () => {
    const r = suggestPlayGroupAssignments({ participants: people, config: cfg });
    expect(r.assignments.map((x) => [x.pid, x.groupId])).toEqual([['a', 'ini'], ['b', 'ava']]);
    expect(r.unmatched.map((x) => x.pid)).toEqual(['c']);
    expect(r.unmatched[0].reason).toMatch(/nível/i);
  });

  it('scope "all" redistribui até quem já tinha grupo, e só devolve o que MUDA', () => {
    const r = suggestPlayGroupAssignments({ participants: people, config: cfg, scope: 'all' });
    const mapa = Object.fromEntries(r.assignments.map((x) => [x.pid, x.groupId]));
    expect(mapa).toEqual({ a: 'ini', b: 'ava', d: 'ini' });
  });

  it('resume quantos vão para cada grupo', () => {
    const r = suggestPlayGroupAssignments({ participants: people, config: cfg });
    expect(r.byGroup).toEqual({ ini: 1, ava: 1 });
  });

  it('dupla vinculada vai JUNTA, pelo nível médio dos dois', () => {
    const duo = [
      P('x', { level_value: 3, partner_id: 'y' }),
      P('y', { level_value: 4.2, partner_id: 'x' }),
    ];
    const r = suggestPlayGroupAssignments({ participants: duo, config: cfg });
    const g = r.assignments.map((a) => a.groupId);
    expect(g).toHaveLength(2);
    expect(g[0]).toBe(g[1]);
    expect(g[0]).toBe('ava'); // média 3.6 > 3.5
  });

  it('sem grupos configurados, nada a fazer', () => {
    const r = suggestPlayGroupAssignments({ participants: people, config: { groups: [], policy: 'queue' } });
    expect(r.assignments).toEqual([]);
  });

  it('participante pausado ou em quadra também recebe grupo (o grupo é do dia, não da vez)', () => {
    const r = suggestPlayGroupAssignments({
      participants: [P('p', { level_value: 5, skip_remaining: 2 })], config: cfg,
    });
    expect(r.assignments[0].groupId).toBe('ava');
  });
});

describe('modelos de atalho', () => {
  it('há três modelos, com nome e descrição', () => {
    expect(PLAY_GROUP_TEMPLATES.map((t) => t.id)).toEqual(['by_level', 'by_formation', 'blank']);
    PLAY_GROUP_TEMPLATES.forEach((t) => {
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
    });
  });

  it('"por nível" cria faixas que se encostam, sem buraco', () => {
    const gs = buildTemplateGroups('by_level');
    expect(gs.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < gs.length; i += 1) expect(gs[i].level_min).toBe(gs[i - 1].level_max);
    expect(gs[0].level_min).toBe(2);
    expect(gs[gs.length - 1].level_max).toBe(8);
  });

  it('"por tipo de dupla" cria mistas, masculinas e femininas com a formação certa', () => {
    const gs = buildTemplateGroups('by_formation');
    expect(gs.map((g) => g.formation)).toEqual(['mixed', 'same_sex', 'same_sex']);
    expect(gs.map((g) => g.gender)).toEqual(['any', 'male', 'female']);
  });

  it('"em branco" cria dois grupos livres', () => {
    const gs = buildTemplateGroups('blank');
    expect(gs).toHaveLength(2);
    gs.forEach((g) => expect(g.formation).toBe('free'));
  });

  it('todo modelo sai válido, com ids únicos e cores distintas', () => {
    PLAY_GROUP_TEMPLATES.forEach((t) => {
      const gs = buildTemplateGroups(t.id);
      expect(validatePlayGroups({ groups: gs }).valid).toBe(true);
      expect(new Set(gs.map((g) => g.id)).size).toBe(gs.length);
      expect(new Set(gs.map((g) => g.color)).size).toBe(gs.length);
    });
  });

  it('modelo desconhecido = nada', () => {
    expect(buildTemplateGroups('xx')).toEqual([]);
  });
});

describe('newGroupId', () => {
  it('é estável em formato e diferente a cada chamada', () => {
    const a = newGroupId();
    const b = newGroupId();
    expect(a).toMatch(/^g[a-z0-9]{6}$/);
    expect(a).not.toBe(b);
  });
  it('aceita um gerador para ser determinístico', () => {
    expect(newGroupId(() => 0.5)).toBe(newGroupId(() => 0.5));
  });
});

describe('applyGroupNumbers — a fila de CADA grupo tem a sua numeração', () => {
  const cfg = normalizePlayGroupsConfig({ play_groups: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });
  const mk = () => {
    const order = [
      { id: 'p1', play_group_id: 'a', orderNo: 1 },
      { id: 'p2', play_group_id: 'b', orderNo: 2 },
      { id: 'p3', play_group_id: 'a', orderNo: 3 },
      { id: 'p4', orderNo: 4 },
      { id: 'p5', play_group_id: 'sumiu', orderNo: 5 },
    ];
    return { order, inCourt: [], unavailable: [], all: order.map((p) => ({ ...p })) };
  };

  it('numera dentro do grupo e preserva a ordem de entrada global', () => {
    const v = applyGroupNumbers(mk(), cfg);
    const byId = Object.fromEntries(v.order.map((p) => [p.id, p]));
    expect(byId.p1.groupNo).toBe(1);
    expect(byId.p3.groupNo).toBe(2);
    expect(byId.p2.groupNo).toBe(1);
    expect(byId.p1.orderNo).toBe(1);
    expect(byId.p3.orderNo).toBe(3);
  });

  it('quem está sem grupo (ou com grupo que não existe) tem fila própria', () => {
    const v = applyGroupNumbers(mk(), cfg);
    const byId = Object.fromEntries(v.order.map((p) => [p.id, p]));
    expect(byId.p4.groupNo).toBe(1);
    expect(byId.p5.groupNo).toBe(2);
    expect(byId.p4.group_id).toBeNull();
    expect(byId.p5.group_id).toBeNull();
  });

  it('anota o grupo resolvido em `all` também, e não muta a entrada', () => {
    const entrada = mk();
    const v = applyGroupNumbers(entrada, cfg);
    expect(v.all.find((p) => p.id === 'p3').groupNo).toBe(2);
    expect(entrada.order[0].groupNo).toBeUndefined();
  });

  it('sem grupos configurados devolve a MESMA view', () => {
    const v = mk();
    expect(applyGroupNumbers(v, { groups: [], policy: 'queue' })).toBe(v);
  });
});

describe('groupsConfigWarnings', () => {
  const cfgDe = (groups) => normalizePlayGroupsConfig({ play_groups: groups });

  it('configuração sã não avisa nada', () => {
    const cfg = cfgDe([{ id: 'a', name: 'A', level_min: 2, level_max: 5 }, { id: 'b', name: 'B', level_min: 5, level_max: 8 }]);
    const participants = [P('p', { play_group_id: 'a' }), P('q', { play_group_id: 'b' })];
    expect(groupsConfigWarnings(cfg, { courts: 2, participants })).toEqual([]);
  });

  it('avisa a quadra que nenhum grupo pode usar', () => {
    const cfg = cfgDe([{ id: 'a', name: 'A', courts: [1] }, { id: 'b', name: 'B', courts: [1, 2] }]);
    const w = groupsConfigWarnings(cfg, { courts: 3, participants: [P('p', { play_group_id: 'a' }), P('q', { play_group_id: 'b' })] });
    expect(w.find((x) => x.key === 'quadra-3')).toBeTruthy();
    expect(w.find((x) => x.key === 'quadra-1')).toBeFalsy();
  });

  it('avisa buraco entre faixas de nível', () => {
    const cfg = cfgDe([{ id: 'a', name: 'A', level_min: 2, level_max: 3 }, { id: 'b', name: 'B', level_min: 4, level_max: 8 }]);
    const w = groupsConfigWarnings(cfg, { courts: 1, participants: [P('p', { play_group_id: 'a' }), P('q', { play_group_id: 'b' })] });
    expect(w.some((x) => x.key.startsWith('faixa'))).toBe(true);
  });

  it('avisa grupo sem ninguém', () => {
    const cfg = cfgDe([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
    const w = groupsConfigWarnings(cfg, { courts: 1, participants: [P('p', { play_group_id: 'a' })] });
    expect(w.some((x) => x.key === 'vazio-b')).toBe(true);
    expect(w.some((x) => x.key === 'vazio-a')).toBe(false);
  });

  it('avisa quem não tem sexo informado num grupo que exige (formação mista ou de mesmo sexo)', () => {
    const cfg = cfgDe([{ id: 'a', name: 'Mistas', formation: 'mixed', strict: true }]);
    const w = groupsConfigWarnings(cfg, {
      courts: 1,
      participants: [P('p', { play_group_id: 'a' }), H('q', { play_group_id: 'a' })],
    });
    const aviso = w.find((x) => x.key === 'sexo-a');
    expect(aviso).toBeTruthy();
    expect(aviso.text).toMatch(/1/);
  });

  it('avisa que todo mundo está pausado', () => {
    const cfg = cfgDe([{ id: 'a', name: 'A', paused: true }]);
    const w = groupsConfigWarnings(cfg, { courts: 1, participants: [P('p', { play_group_id: 'a' })] });
    expect(w.some((x) => x.key === 'todos-pausados')).toBe(true);
  });
});

describe('describeGroupRules / groupSnapshot', () => {
  it('um grupo sem regra nenhuma só tem o nome', () => {
    expect(describeGroupRules(normalizePlayGroup({ id: 'a', name: 'A' }, 0))).toEqual([]);
  });
  it('resume o que está configurado, em linguagem de quadra', () => {
    const g = normalizePlayGroup({
      id: 'a', level_min: 3, level_max: 4, gender: 'female', formation: 'mixed',
      max_level_gap: 0.5, strict: true, courts: [1, 2], fill: true, paused: true, join: 'closed',
    }, 0);
    const txt = describeGroupRules(g).map((c) => c.label).join(' | ');
    expect(txt).toMatch(/3\.0.*4\.0/);
    expect(txt).toMatch(/mist/i);
    expect(txt).toMatch(/0\.5/);
    expect(txt).toMatch(/quadras? 1, 2/i);
    expect(txt).toMatch(/mulheres/i);
    expect(txt).toMatch(/pausa/i);
    expect(txt).toMatch(/exige/i);
  });
  it('só piso ou só teto de nível', () => {
    expect(describeGroupRules(normalizePlayGroup({ id: 'a', level_min: 4 }, 0))[0].label).toMatch(/4\.0\+/);
    expect(describeGroupRules(normalizePlayGroup({ id: 'a', level_max: 3 }, 0))[0].label).toMatch(/até 3\.0/i);
  });
  it('o snapshot gravado na partida leva só id, nome e cor', () => {
    const g = normalizePlayGroup({ id: 'a', name: 'Alfa', color: 'rose', level_min: 3 }, 0);
    expect(groupSnapshot(g)).toEqual({ group_id: 'a', group_name: 'Alfa', group_color: 'rose' });
    expect(groupSnapshot(null)).toEqual({ group_id: null, group_name: null, group_color: null });
  });
});

describe('withLevels — o nível resolvido, só em memória', () => {
  it('põe `level_value` em quem tem nível conhecido e não mexe nos outros', () => {
    const lista = [P('a'), P('b', { play_level: 3 }), P('c')];
    const r = withLevels(lista, { a: 4.2, c: Number.NaN });
    expect(r[0].level_value).toBe(4.2);
    expect(r[1]).toBe(lista[1]);
    expect(r[2]).toBe(lista[2]);
  });
  it('não muta a lista de entrada', () => {
    const lista = [P('a')];
    withLevels(lista, { a: 4 });
    expect(lista[0].level_value).toBeUndefined();
  });
  it('sem mapa devolve a mesma lista', () => {
    const lista = [P('a')];
    expect(withLevels(lista, null)).toBe(lista);
    expect(withLevels(lista, {})).toBe(lista);
  });
});

describe('profileMismatch — a pessoa está fora do perfil do grupo?', () => {
  const g = normalizePlayGroup({ id: 'a', level_min: 3, level_max: 4, gender: 'female' }, 0);
  it('dentro do perfil: nada', () => {
    expect(profileMismatch(M('x', { level_value: 3.5 }), g)).toBeNull();
  });
  it('nível fora da faixa', () => {
    expect(profileMismatch(M('x', { level_value: 5 }), g)).toBe('nivel');
  });
  it('sexo diferente do grupo', () => {
    expect(profileMismatch(H('x', { level_value: 3.5 }), g)).toBe('sexo');
  });
  it('dado que falta não é "fora do perfil" (não acusa sem saber)', () => {
    expect(profileMismatch(P('x'), g)).toBeNull();
  });
  it('sem grupo ou grupo livre, nunca', () => {
    expect(profileMismatch(H('x', { level_value: 9 }), null)).toBeNull();
    expect(profileMismatch(H('x', { level_value: 9 }), normalizePlayGroup({ id: 'b' }, 0))).toBeNull();
  });
});

describe('linkedPartnerInOtherGroup', () => {
  const cfg = normalizePlayGroupsConfig({ play_groups: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });
  const a1 = P('a1', { play_group_id: 'a', partner_id: 'b1' });
  const b1 = P('b1', { play_group_id: 'b', partner_id: 'a1' });
  const a2 = P('a2', { play_group_id: 'a', partner_id: 'a3' });
  const a3 = P('a3', { play_group_id: 'a', partner_id: 'a2' });
  it('devolve o parceiro quando está em outro grupo', () => {
    expect(linkedPartnerInOtherGroup(a1, [a1, b1, a2, a3], cfg)).toBe(b1);
  });
  it('mesmo grupo: nada', () => {
    expect(linkedPartnerInOtherGroup(a2, [a1, b1, a2, a3], cfg)).toBeNull();
  });
  it('vínculo que não é mútuo ou sem dupla: nada', () => {
    expect(linkedPartnerInOtherGroup(P('z', { partner_id: 'b1' }), [b1], cfg)).toBeNull();
    expect(linkedPartnerInOtherGroup(P('z'), [b1], cfg)).toBeNull();
  });
});
