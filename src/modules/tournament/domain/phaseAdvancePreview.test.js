import { describe, it, expect } from 'vitest';
import { previewPhaseAdvance, describePhaseAdvance, phaseDrawIssues } from './phaseAdvancePreview.js';
import { normalizePhase } from './phases.js';
import { TOURNAMENT_STAGE_TYPE, PHASE_DIVISION_MODE } from './constants.js';

function entrant(id, extra = {}) {
  return { id, members: [id], label: id.toUpperCase(), ...extra };
}

/** Três grupos de 4, classificação já resolvida (1º..4º de cada). */
function tresGrupos() {
  return ['A', 'B', 'C'].map((letra, i) => ({
    index: i,
    name: `Grupo ${letra}`,
    ranked: [1, 2, 3, 4].map((pos) => entrant(`${letra.toLowerCase()}${pos}`)),
  }));
}

const fase = (raw, ctx) => normalizePhase(raw, ctx);

describe('previewPhaseAdvance — diz quem passa antes de gravar', () => {
  it('conta classificados diretos quando não há repescagem nem entrada direta', () => {
    const p = previewPhaseAdvance({
      rankedGroups: tresGrupos(),
      prevPhase: fase({
        type: TOURNAMENT_STAGE_TYPE.GROUPS,
        division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
        group_count: 3,
        qualifiers_per_group: 2,
      }, { isFirst: true }),
      nextPhase: fase({ type: TOURNAMENT_STAGE_TYPE.KNOCKOUT }),
      seed: 's',
    });
    expect(p.ok).toBe(true);
    expect(p.blocked).toBeNull();
    expect(p.counts).toEqual({ total: 6, qualifiers: 6, wildcards: 0, directs: 0 });
    expect(p.names.qualifiers).toHaveLength(6);
  });

  it('separa os REPESCADOS dos classificados diretos', () => {
    const p = previewPhaseAdvance({
      rankedGroups: tresGrupos(),
      prevPhase: fase({
        type: TOURNAMENT_STAGE_TYPE.GROUPS,
        division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
        group_count: 3,
        qualifiers_per_group: 2,
        wildcard_slots: 2,
      }, { isFirst: true }),
      nextPhase: fase({ type: TOURNAMENT_STAGE_TYPE.KNOCKOUT }),
      seed: 's',
    });
    expect(p.counts.total).toBe(8);
    expect(p.counts.qualifiers).toBe(6);
    expect(p.counts.wildcards).toBe(2);
    // Os repescados são terceiros colocados — nunca um 4º na frente de um 3º.
    p.names.wildcards.forEach((n) => expect(n).toMatch(/3$/));
  });

  it('separa quem entra DIRETO, e ele não vem da classificação', () => {
    const p = previewPhaseAdvance({
      rankedGroups: tresGrupos(),
      prevPhase: fase({
        type: TOURNAMENT_STAGE_TYPE.GROUPS,
        division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
        group_count: 3,
        qualifiers_per_group: 2,
      }, { isFirst: true }),
      nextPhase: fase({ type: TOURNAMENT_STAGE_TYPE.KNOCKOUT }),
      seed: 's',
      directEntrants: [entrant('campeao'), entrant('convidado')],
    });
    expect(p.counts.directs).toBe(2);
    expect(p.counts.qualifiers).toBe(6);
    expect(p.counts.total).toBe(8);
    expect(p.names.directs.sort()).toEqual(['CAMPEAO', 'CONVIDADO']);
  });

  it('bloqueia quando ninguém se classifica, com o motivo na mensagem', () => {
    const p = previewPhaseAdvance({
      rankedGroups: [],
      prevPhase: fase({ type: TOURNAMENT_STAGE_TYPE.GROUPS, qualifiers_per_group: 2 }, { isFirst: true }),
      nextPhase: fase({ type: TOURNAMENT_STAGE_TYPE.KNOCKOUT }),
      seed: 's',
    });
    expect(p.ok).toBe(false);
    expect(p.blocked.code).toBe('sem_classificados');
    expect(p.blocked.message).toMatch(/Nenhum atleta/);
  });

  it('em modalidade de equipes a mensagem fala de EQUIPES', () => {
    const p = previewPhaseAdvance({
      rankedGroups: [],
      prevPhase: fase({ type: TOURNAMENT_STAGE_TYPE.GROUPS }, { isFirst: true }),
      nextPhase: fase({ type: TOURNAMENT_STAGE_TYPE.KNOCKOUT }),
      seed: 's',
      isTeam: true,
    });
    expect(p.blocked.message).toMatch(/Nenhuma equipe/);
  });

  it('bloqueia quando o formato da próxima fase não cabe nos classificados', () => {
    const p = previewPhaseAdvance({
      rankedGroups: tresGrupos(),
      prevPhase: fase({
        type: TOURNAMENT_STAGE_TYPE.GROUPS,
        division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
        group_count: 3,
        qualifiers_per_group: 1,
      }, { isFirst: true }),
      // Americano exige ao menos 4 por grupo; só 3 se classificam.
      nextPhase: fase({ type: TOURNAMENT_STAGE_TYPE.AMERICANO }),
      seed: 's',
    });
    expect(p.ok).toBe(false);
    expect(p.blocked.code).toBe('formato_incompativel');
    expect(p.blocked.message).toMatch(/Americano exige ao menos 4/);
    // Mesmo bloqueada, a prévia já mostra QUEM se classificou — é o que
    // permite ao organizador entender o que precisa ajustar.
    expect(p.counts.total).toBe(3);
  });
});

describe('describePhaseAdvance — a frase do cabeçalho', () => {
  const base = {
    rankedGroups: tresGrupos(),
    prevPhase: normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.GROUPS,
      division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      group_count: 3,
      qualifiers_per_group: 2,
    }, { isFirst: true }),
    nextPhase: normalizePhase({ type: TOURNAMENT_STAGE_TYPE.KNOCKOUT }),
    seed: 's',
  };

  it('só classificados: não inventa repescagem nem entrada direta', () => {
    const frase = describePhaseAdvance(previewPhaseAdvance(base));
    expect(frase).toBe('6 atletas na chaves (mata-mata): 6 classificado(s).');
    expect(frase).not.toMatch(/repescagem|direto/);
  });

  it('com repescagem e entrada direta, nomeia as três origens', () => {
    const p = previewPhaseAdvance({
      ...base,
      prevPhase: normalizePhase({
        type: TOURNAMENT_STAGE_TYPE.GROUPS,
        division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
        group_count: 3,
        qualifiers_per_group: 2,
        wildcard_slots: 2,
      }, { isFirst: true }),
      directEntrants: [entrant('x')],
    });
    const frase = describePhaseAdvance(p);
    expect(frase).toMatch(/2 por repescagem/);
    expect(frase).toMatch(/1 entrando direto/);
  });

  it('em equipes, fala de equipes', () => {
    expect(describePhaseAdvance(previewPhaseAdvance(base), { isTeam: true })).toMatch(/equipes/);
  });

  it('sem ninguém, não mente', () => {
    expect(describePhaseAdvance(null)).toBe('Ninguém se classificou ainda.');
  });
});

describe('phaseDrawIssues — saiu do serviço para a tela também poder perguntar', () => {
  const grupo = (n) => ({ name: 'A', entrants: Array.from({ length: n }, (_, i) => ({ id: `p${i}` })) });

  it('grupo com menos de 2 é problema em qualquer formato', () => {
    expect(phaseDrawIssues({ type: TOURNAMENT_STAGE_TYPE.GROUPS }, [grupo(1)])).toHaveLength(1);
    expect(phaseDrawIssues({ type: TOURNAMENT_STAGE_TYPE.GROUPS }, [grupo(2)])).toHaveLength(0);
  });

  it('Americano exige 4 e um número compatível', () => {
    expect(phaseDrawIssues({ type: TOURNAMENT_STAGE_TYPE.AMERICANO }, [grupo(3)])[0]).toMatch(/ao menos 4/);
    expect(phaseDrawIssues({ type: TOURNAMENT_STAGE_TYPE.AMERICANO }, [grupo(6)])[0]).toMatch(/incompatível/);
    expect(phaseDrawIssues({ type: TOURNAMENT_STAGE_TYPE.AMERICANO }, [grupo(8)])).toHaveLength(0);
  });

  it('em equipes a unidade da mensagem muda', () => {
    const [msg] = phaseDrawIssues({ type: TOURNAMENT_STAGE_TYPE.GROUPS }, [grupo(1)], { isTeam: true });
    expect(msg).toMatch(/equipe\(s\)/);
  });

  it('lista vazia não quebra', () => {
    expect(phaseDrawIssues({ type: TOURNAMENT_STAGE_TYPE.GROUPS }, undefined)).toEqual([]);
  });
});
