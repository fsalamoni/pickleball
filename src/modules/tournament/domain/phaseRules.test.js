import { describe, it, expect } from 'vitest';
import { describePhaseRules, changedPhaseRules } from './phaseRules.js';
import { TOURNAMENT_STAGE_TYPE } from './constants.js';
import { CROSS_GROUP_METHOD } from './crossGroup.js';
import { DIRECT_ENTRY_MODE } from './directEntry.js';

const grupos = { type: TOURNAMENT_STAGE_TYPE.GROUPS, group_count: 3 };
const chave = { type: TOURNAMENT_STAGE_TYPE.KNOCKOUT };

function chaves(res) {
  return res.rows.map((r) => r.key);
}

describe('describePhaseRules — só mostra o que se aplica', () => {
  it('fase de grupos no meio do torneio mostra divisão, turnos, classificados, repescagem, desempate e comparação', () => {
    const res = describePhaseRules(grupos, { isFirst: true, isLast: false });
    expect(chaves(res)).toEqual([
      'divisao', 'turnos', 'classificados', 'repescagem', 'desempate', 'entre_grupos',
    ]);
  });

  it('a ÚLTIMA fase não fala de quem passa, de repescagem nem de comparação entre grupos', () => {
    const res = describePhaseRules(grupos, { isFirst: true, isLast: true });
    expect(chaves(res)).not.toContain('classificados');
    expect(chaves(res)).not.toContain('repescagem');
    expect(chaves(res)).not.toContain('entre_grupos');
  });

  it('a PRIMEIRA fase não fala de entrada direta — não há fase anterior para pular', () => {
    const res = describePhaseRules(grupos, { isFirst: true, isLast: false });
    expect(chaves(res)).not.toContain('entrada_direta');
  });

  it('a partir da segunda fase, entrada direta sempre aparece (mesmo sem ninguém)', () => {
    const res = describePhaseRules(chave, { isFirst: false, isLast: true });
    const linha = res.rows.find((r) => r.key === 'entrada_direta');
    expect(linha).toBeTruthy();
    expect(linha.changed).toBe(false);
    expect(linha.value).toMatch(/Ninguém/);
  });

  it('com UM grupo só não há repescagem nem comparação entre grupos', () => {
    const res = describePhaseRules(
      { type: TOURNAMENT_STAGE_TYPE.GROUPS, group_count: 1 },
      { isFirst: true, isLast: false },
    );
    expect(chaves(res)).not.toContain('repescagem');
    expect(chaves(res)).not.toContain('entre_grupos');
  });

  it('fase de chave não fala de desempate de grupo, e fala da montagem da chave', () => {
    const res = describePhaseRules(chave, { isFirst: true, isLast: true });
    expect(chaves(res)).not.toContain('desempate');
    expect(chaves(res)).toContain('chave');
  });
});

describe('describePhaseRules — marca o que o organizador mudou', () => {
  it('fase nos padrões não tem nenhuma linha marcada', () => {
    const res = describePhaseRules(grupos, { isFirst: true, isLast: false });
    expect(res.changedCount).toBe(0);
  });

  it('tamanhos à mão marcam a divisão e definem o número de grupos', () => {
    const res = describePhaseRules(
      { ...grupos, group_count: 4, custom_group_sizes: [6, 5, 5] },
      { isFirst: true, isLast: false },
    );
    const linha = res.rows.find((r) => r.key === 'divisao');
    expect(linha.changed).toBe(true);
    expect(linha.value).toBe('À mão: 6, 5 e 5 atleta(s)');
  });

  it('ida e volta é marcada', () => {
    const res = describePhaseRules({ ...grupos, round_robin_legs: 2 }, { isFirst: true, isLast: false });
    expect(res.rows.find((r) => r.key === 'turnos').changed).toBe(true);
  });

  it('repescagem informa de qual colocação saem as vagas', () => {
    const res = describePhaseRules(
      { ...grupos, qualifiers_per_group: 2, wildcard_slots: 2 },
      { isFirst: true, isLast: false },
    );
    const linha = res.rows.find((r) => r.key === 'repescagem');
    expect(linha.changed).toBe(true);
    expect(linha.value).toBe('2 vaga(s), entre os melhores 3º colocados');
  });

  it('repescagem respeita a colocação fixada pelo organizador', () => {
    const res = describePhaseRules(
      { ...grupos, qualifiers_per_group: 1, wildcard_slots: 1, wildcard_from_position: 4 },
      { isFirst: true, isLast: false },
    );
    expect(res.rows.find((r) => r.key === 'repescagem').value).toMatch(/melhores 4º/);
  });

  it('classificados grupo a grupo aparecem um a um', () => {
    const res = describePhaseRules(
      { ...grupos, qualifiers_by_group: [2, 2, 1] },
      { isFirst: true, isLast: false },
    );
    const linha = res.rows.find((r) => r.key === 'classificados');
    expect(linha.changed).toBe(true);
    expect(linha.value).toBe('Grupo a grupo: 2, 2 e 1');
  });

  it('ordem de desempate diferente da oficial é marcada; a oficial não é', () => {
    const oficial = describePhaseRules(grupos, { isFirst: true, isLast: false });
    expect(oficial.rows.find((r) => r.key === 'desempate').changed).toBe(false);
    expect(oficial.rows.find((r) => r.key === 'desempate').value).toMatch(/Confronto direto/);

    const trocada = describePhaseRules(
      { ...grupos, tiebreak_order: ['wins', 'balance', 'head_to_head'] },
      { isFirst: true, isLast: false },
    );
    expect(trocada.rows.find((r) => r.key === 'desempate').changed).toBe(true);
  });

  it('método de comparação diferente de aproveitamento é marcado', () => {
    const res = describePhaseRules(
      { ...grupos, cross_group_method: CROSS_GROUP_METHOD.DROP_LAST },
      { isFirst: true, isLast: false },
    );
    expect(res.rows.find((r) => r.key === 'entre_grupos').changed).toBe(true);
  });

  it('entrada direta por cabeças diz QUANTOS', () => {
    const res = describePhaseRules(
      { ...chave, direct_entry: { mode: DIRECT_ENTRY_MODE.SEEDS, count: 8 } },
      { isFirst: false, isLast: true },
    );
    const linha = res.rows.find((r) => r.key === 'entrada_direta');
    expect(linha.changed).toBe(true);
    expect(linha.value).toBe('Os 8 melhores cabeças entram direto aqui');
  });

  it('entrada direta a dedo diz QUANTOS nomes', () => {
    const res = describePhaseRules(
      { ...chave, direct_entry: { mode: DIRECT_ENTRY_MODE.MANUAL, ids: ['a', 'b'] } },
      { isFirst: false, isLast: true },
    );
    expect(res.rows.find((r) => r.key === 'entrada_direta').value).toBe('2 escolhido(s) a dedo entram direto aqui');
  });

  it('changedPhaseRules devolve só o que foi mexido', () => {
    const mudadas = changedPhaseRules(
      { ...grupos, round_robin_legs: 2, wildcard_slots: 1 },
      { isFirst: true, isLast: false },
    );
    expect(mudadas.map((r) => r.key).sort()).toEqual(['repescagem', 'turnos']);
  });
});

describe('describePhaseRules — toda linha explica o porquê', () => {
  it('nenhuma linha sai sem rótulo, valor e ajuda', () => {
    const cenarios = [
      [grupos, { isFirst: true, isLast: false }],
      [chave, { isFirst: false, isLast: true }],
      [{ ...grupos, custom_group_sizes: [5, 5], wildcard_slots: 2, seed_count: 4 }, { isFirst: true, isLast: false }],
      [{ ...chave, third_place: true, seed_count: 2 }, { isFirst: false, isLast: true }],
    ];
    cenarios.forEach(([fase, ctx]) => {
      describePhaseRules(fase, ctx).rows.forEach((r) => {
        expect(r.label.length, `rótulo de ${r.key}`).toBeGreaterThan(2);
        expect(r.value.length, `valor de ${r.key}`).toBeGreaterThan(2);
        expect(r.help.length, `ajuda de ${r.key}`).toBeGreaterThan(20);
      });
    });
  });

  it('fase vazia/indefinida não quebra', () => {
    expect(() => describePhaseRules(undefined)).not.toThrow();
    expect(() => describePhaseRules(null, { isFirst: false, isLast: true })).not.toThrow();
  });
});
