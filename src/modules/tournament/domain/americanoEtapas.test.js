import { describe, it, expect } from 'vitest';
import {
  etapaGroupSizes, numerosQueFecham, etapaGroupName, etapaOfMatch, grupoSemEtapa,
  encounterCounts, coGroupCounts, gamesPlayedBy, planEtapaGroups, planEtapas, buildEtapaMatches, etapasProgress,
  etapaParticipants, firstEtapaDraw, nextEtapa, simulateEtapas, explainAmericanoEtapas,
  normalizeEtapaCount, normalizeEtapaGroupSize, americanoFecha, etapasResumo, etapaBotaoTexto,
} from './americanoEtapas.js';
import { normalizePhase } from './phases.js';
import { TOURNAMENT_STAGE_TYPE } from './constants.js';

const fase = (extra = {}) => normalizePhase({ type: TOURNAMENT_STAGE_TYPE.AMERICANO_ETAPAS, ...extra });
const atletas = (n) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

/** Grava a etapa como o serviço gravaria: ids nos lados, tudo decidido. */
function gravar(jogos, { status = 'finished' } = {}) {
  return jogos.map((m, i) => ({
    id: `m${i}`, ...m, side_a_ids: [].concat(m.side_a), side_b_ids: [].concat(m.side_b), status,
  }));
}

/** Etapas inteiras, uma depois da outra, com o mesmo motor do avanço. */
function jogarEtapas(n, extra = {}) {
  const f = fase(extra);
  const ids = atletas(n);
  let jogos = gravar(firstEtapaDraw(ids, f, { seed: 'teste' }).matches);
  for (;;) {
    const r = nextEtapa(jogos, f, { seed: 'teste' });
    if (r.complete) break;
    if (r.error || r.pending) throw new Error(r.error || 'pendente');
    jogos = [...jogos, ...gravar(r.matches)];
  }
  return { jogos, fase: f };
}

describe('configuração da fase', () => {
  it('normaliza etapas (1–12, padrão 3) e o tamanho do grupo (4, 5, 8 ou 9)', () => {
    expect(normalizeEtapaCount(undefined)).toBe(3);
    expect(normalizeEtapaCount(0)).toBe(1);
    expect(normalizeEtapaCount(40)).toBe(12);
    expect(normalizeEtapaGroupSize(undefined)).toBe(4);
    expect(normalizeEtapaGroupSize(6)).toBe(5);
    expect(normalizeEtapaGroupSize(9)).toBe(9);
  });

  it('⭐ a fase é SEMPRE em grupos (nunca "grupo único", que apagaria a etapa dos jogos)', () => {
    const f = fase({ division_mode: 'single' });
    expect(f.division_mode).toBe('max_per_group');
    expect(f.max_per_group).toBe(4);
    expect(f.etapa_count).toBe(3);
  });

  it('as outras fases NÃO ganham etapa_count (nenhum campo a mais no banco)', () => {
    expect('etapa_count' in normalizePhase({ type: TOURNAMENT_STAGE_TYPE.GROUPS })).toBe(false);
    expect('etapa_count' in normalizePhase({ type: TOURNAMENT_STAGE_TYPE.AMERICANO })).toBe(false);
  });
});

describe('tamanhos dos grupos — só os que fecham um Americano', () => {
  it('8 → 4+4; 9 → 5+4; 10 → 5+5; 12 → 4+4+4; 13 → 5+4+4', () => {
    expect(etapaGroupSizes(8)).toEqual([4, 4]);
    expect(etapaGroupSizes(9)).toEqual([5, 4]);
    expect(etapaGroupSizes(10)).toEqual([5, 5]);
    expect(etapaGroupSizes(12)).toEqual([4, 4, 4]);
    expect(etapaGroupSizes(13)).toEqual([5, 4, 4]);
  });

  it('6, 7 e 11 não fecham com grupos de 4/5 — e a tela diz o número que fecharia', () => {
    [6, 7, 11, 3].forEach((n) => expect(etapaGroupSizes(n)).toBeNull());
    expect(numerosQueFecham(11)).toEqual({ abaixo: 10, acima: 12 });
  });

  it('todo grupo sai de um tamanho que fecha o Americano', () => {
    for (let n = 4; n <= 60; n += 1) {
      const s = etapaGroupSizes(n);
      if (!s) continue;
      expect(s.reduce((a, b) => a + b, 0)).toBe(n);
      s.forEach((t) => expect(americanoFecha(t)).toBe(true));
    }
  });

  it('grupos de 8 também (16 → 8+8)', () => {
    expect(etapaGroupSizes(16, 8)).toEqual([8, 8]);
  });
});

describe('a etapa mora no nome do grupo', () => {
  it('"Etapa 2 · Grupo A" ⇄ etapa 2', () => {
    expect(etapaGroupName(2, 0)).toBe('Etapa 2 · Grupo A');
    expect(etapaOfMatch({ group: 'Etapa 12 · Grupo C' })).toBe(12);
    expect(etapaOfMatch({ group: null })).toBe(1);
    expect(grupoSemEtapa('Etapa 3 · Grupo B')).toBe('Grupo B');
  });
});

describe('⭐ o exemplo que originou o formato: 8 atletas, grupos de 4, 3 etapas', () => {
  const { jogos } = jogarEtapas(8);

  it('9 jogos para cada um, 3 por etapa', () => {
    const porAtleta = gamesPlayedBy(jogos);
    atletas(8).forEach((id) => expect(porAtleta.get(id)).toBe(9));
    expect(new Set(jogos.map(etapaOfMatch))).toEqual(new Set([1, 2, 3]));
  });

  it('cada grupo, em cada etapa, é um Americano exato (cada dupla uma vez)', () => {
    const porGrupo = new Map();
    jogos.forEach((m) => { if (!porGrupo.has(m.group)) porGrupo.set(m.group, []); porGrupo.get(m.group).push(m); });
    expect(porGrupo.size).toBe(6);
    porGrupo.forEach((js) => {
      expect(js).toHaveLength(3);
      const duplas = new Set(js.flatMap((m) => [m.side_a, m.side_b].map((l) => [...l].sort().join('+'))));
      expect(duplas.size).toBe(6);
    });
  });

  it('⭐ a etapa 2 mistura de verdade: cada grupo novo tem 2 de cada grupo anterior', () => {
    const grupos = (etapa) => {
      const g = new Map();
      jogos.filter((m) => etapaOfMatch(m) === etapa).forEach((m) => {
        if (!g.has(m.group)) g.set(m.group, new Set());
        [...m.side_a, ...m.side_b].forEach((id) => g.get(m.group).add(id));
      });
      return [...g.values()];
    };
    const e1 = grupos(1);
    const deOnde = (id) => e1.findIndex((g) => g.has(id));
    grupos(2).forEach((g) => {
      const origem = [...g].map(deOnde);
      expect(origem.filter((o) => o === 0)).toHaveLength(2);
      expect(origem.filter((o) => o === 1)).toHaveLength(2);
    });
  });

  it('⭐ o máximo de encontros inéditos: em 3 etapas cada um encontra TODOS os outros 7', () => {
    const encontros = encounterCounts(jogos);
    // Todos os 28 pares possíveis se cruzam ao menos uma vez.
    expect(encontros.size).toBe(28);
    atletas(8).forEach((id) => {
      const conhecidos = [...encontros.keys()].filter((k) => k.split('|').includes(id));
      expect(conhecidos).toHaveLength(7);
    });
  });

  it('⭐ é o esquema descrito: na etapa 3, os pares que seguiram juntos encontram os dois que faltavam', () => {
    const encontros = encounterCounts(jogos);
    // Cada grupo da etapa 3 repete só UM par (o que esteve junto nas etapas 1
    // e 2) por grupo de origem; os outros 4 pares do grupo são inéditos.
    const e3 = new Map();
    jogos.filter((m) => etapaOfMatch(m) === 3).forEach((m) => {
      if (!e3.has(m.group)) e3.set(m.group, new Set());
      [...m.side_a, ...m.side_b].forEach((id) => e3.get(m.group).add(id));
    });
    const antes = encounterCounts(jogos.filter((m) => etapaOfMatch(m) < 3));
    e3.forEach((membros) => {
      const ids = [...membros].sort();
      let ineditos = 0;
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) if (!antes.has(`${ids[i]}|${ids[j]}`)) ineditos += 1;
      }
      expect(ineditos).toBe(4);
    });
    expect(Math.max(...encontros.values())).toBe(9);
  });
});

describe('justiça com grupos de tamanhos diferentes', () => {
  it('⭐ 9 atletas (5+4), 4 etapas: a mistura reveza o grupo maior e os totais ficam próximos', () => {
    const { jogos } = jogarEtapas(9, { etapa_count: 4 });
    const totais = [...gamesPlayedBy(jogos).values()];
    expect(totais).toHaveLength(9);
    expect(Math.max(...totais) - Math.min(...totais)).toBeLessThanOrEqual(1);
  });
});

describe('o avanço (contrato do Mexicano e do suíço)', () => {
  const f = fase({ etapa_count: 2 });
  const primeira = gravar(firstEtapaDraw(atletas(8), f, { seed: 's' }).matches);

  it('pendente enquanto há jogo da etapa por decidir', () => {
    const umaAberta = primeira.map((m, i) => (i === 0 ? { ...m, status: 'scheduled' } : m));
    expect(nextEtapa(umaAberta, f)).toEqual({ pending: true });
    expect(etapasProgress(umaAberta, f)).toMatchObject({ atual: 1, pendentes: 1, podeGerar: false, completa: false });
  });

  it('gera a etapa 2 com rodadas DEPOIS das da etapa 1', () => {
    const r = nextEtapa(primeira, f, { seed: 's' });
    expect(r.etapa).toBe(2);
    expect(r.matches.every((m) => m.group.startsWith('Etapa 2 · '))).toBe(true);
    const ultima = Math.max(...primeira.map((m) => m.round));
    expect(Math.min(...r.matches.map((m) => m.round))).toBe(ultima + 1);
  });

  it('completa depois da última etapa pedida', () => {
    const segunda = gravar(nextEtapa(primeira, f, { seed: 's' }).matches);
    expect(nextEtapa([...primeira, ...segunda], f)).toEqual({ complete: true });
    expect(etapasProgress([...primeira, ...segunda], f)).toMatchObject({ atual: 2, total: 2, completa: true, podeGerar: false });
  });

  it('quem saiu fica fora dos grupos novos — e, se o resto não fechar, diz por quê', () => {
    expect(etapaParticipants(primeira, { excluir: ['p1'] })).not.toContain('p1');
    const r = nextEtapa(primeira, f, { excluir: ['p1'] });
    expect(r.error).toMatch(/Com 7 atletas/);
  });

  it('determinístico pela semente', () => {
    expect(nextEtapa(primeira, f, { seed: 's' }).matches).toEqual(nextEtapa(primeira, f, { seed: 's' }).matches);
  });
});

describe('2 turnos em cada etapa', () => {
  it('grupo de 4 em ida e volta: 6 jogos por etapa para cada um', () => {
    const f = fase({ round_robin_legs: 2, etapa_count: 1 });
    const { matches } = firstEtapaDraw(atletas(8), f, { seed: 'v' });
    const porAtleta = gamesPlayedBy(gravar(matches));
    expect(porAtleta.get('p1')).toBe(6);
  });
});

describe('planEtapaGroups', () => {
  it('com histórico, evita juntar quem já se encontrou', () => {
    const historico = new Map([['p1|p2', 1], ['p3|p4', 1]]);
    const grupos = planEtapaGroups(atletas(8), { sizes: [4, 4], coGroups: historico, seed: 'x' });
    const juntos = (a, b) => grupos.some((g) => g.includes(a) && g.includes(b));
    expect(juntos('p1', 'p2')).toBe(false);
    expect(juntos('p3', 'p4')).toBe(false);
  });

  it('recusa tamanhos que não somam o total', () => {
    expect(() => planEtapaGroups(atletas(8), { sizes: [4] })).toThrow();
  });

  it('buildEtapaMatches numera rodadas a partir do deslocamento', () => {
    const jogos = buildEtapaMatches([atletas(4)], { etapa: 3, roundOffset: 6, seed: 'r' });
    expect(jogos.map((m) => m.round).sort()).toEqual([7, 8, 9]);
    expect(jogos[0].group).toBe('Etapa 3 · Grupo A');
  });
});

describe('⭐ planejar as etapas que faltam JUNTAS acha a mistura perfeita quando ela existe', () => {
  it('16 atletas em grupos de 4, 5 etapas: cada par se encontra exatamente uma vez', () => {
    const plano = planEtapas(atletas(16), { sizes: [4, 4, 4, 4], etapas: 5, seed: 'afim' });
    const juntos = new Map();
    plano.forEach((grupos) => grupos.forEach((g) => {
      for (let i = 0; i < g.length; i += 1) {
        for (let j = i + 1; j < g.length; j += 1) {
          const k = [g[i], g[j]].sort().join('|');
          juntos.set(k, (juntos.get(k) || 0) + 1);
        }
      }
    }));
    expect(juntos.size).toBe(120);
    expect(Math.max(...juntos.values())).toBe(1);
  });

  it('coGroupCounts conta quem esteve no mesmo grupo (pelo nome do grupo do jogo)', () => {
    const jogos = gravar(buildEtapaMatches([['a', 'b', 'c', 'd']], { etapa: 1, seed: 'c' }));
    const c = coGroupCounts(jogos);
    expect(c.size).toBe(6);
    expect([...c.values()].every((v) => v === 1)).toBe(true);
  });
});

describe('previsão e explicação (antes do sorteio)', () => {
  it('8 atletas, 3 etapas: 9 jogos cada, todos se encontram', () => {
    const sim = simulateEtapas(8, fase());
    expect(sim.jogosPorAtleta).toEqual({ min: 9, max: 9 });
    expect(sim.totalJogos).toBe(18);
    expect(sim.encontrosIneditos).toBe(28);
    expect(sim.conheceTodos).toBeLessThanOrEqual(3);
  });

  it('explicação em linguagem de quadra', () => {
    const e = explainAmericanoEtapas(8, fase());
    expect(e.status).toBe('ok');
    expect(e.lines.join(' ')).toMatch(/2 grupos de 4/);
    expect(e.lines.join(' ')).toMatch(/9 jogos para cada atleta/);
  });

  it('número que não fecha: erro com a sugestão', () => {
    const e = explainAmericanoEtapas(11, fase());
    expect(e.status).toBe('error');
    expect(e.lines[0]).toMatch(/Com 10 ou 12 atletas, fecha/);
  });

  it('um grupo só: avisa que não há mistura', () => {
    expect(explainAmericanoEtapas(5, fase()).status).toBe('warn');
  });
});

describe('o que a tela diz', () => {
  it('a situação das etapas e o rótulo do botão', () => {
    expect(etapasResumo({ atual: 0 })).toBeNull();
    expect(etapasResumo({ atual: 1, total: 3, pendentes: 4, proxima: 2 })).toMatch(/faltam 4 jogos para gerar a etapa 2/);
    expect(etapasResumo({ atual: 1, total: 3, pendentes: 0, proxima: 2, podeGerar: true })).toMatch(/etapa 2 pode ser gerada/);
    expect(etapasResumo({ atual: 3, total: 3, pendentes: 1 })).toMatch(/Última etapa/);
    expect(etapasResumo({ atual: 3, total: 3, pendentes: 0, completa: true })).toMatch(/classificação final/);
    expect(etapaBotaoTexto({ proxima: 2, total: 3 })).toBe('Gerar etapa 2 de 3');
  });
});

describe('a flag decide se o formato é OFERECIDO', () => {
  it('só com a flag ligada ele entra na lista de escolha; a compatibilidade não depende dela', async () => {
    const { availableStageTypes, STAGE_TYPES_BY_FORMAT } = await import('./constants.js');
    expect(availableStageTypes('singles', true)).not.toContain('americano_etapas');
    expect(availableStageTypes('singles', true, { americanoEtapas: true })).toContain('americano_etapas');
    expect(availableStageTypes('doubles', true, { americanoEtapas: true })).not.toContain('americano_etapas');
    expect(STAGE_TYPES_BY_FORMAT.singles).toContain('americano_etapas');
  });
});
