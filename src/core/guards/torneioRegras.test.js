/**
 * AS REGRAS DO TORNEIO TÊM UMA FONTE.
 *
 * Dois defeitos desta família custaram caro e nenhum teste de comportamento os
 * pegava, porque cada arquivo, isolado, "funcionava":
 *
 *  1. o comparador de classificação existia DUPLICADO (em `ranking.js` e em
 *     `phaseProgression.js`), e as duas cópias estavam igualmente erradas —
 *     nenhuma tinha confronto direto, que o regulamento põe logo depois das
 *     vitórias;
 *  2. a chave era preenchida da ESQUERDA para a DIREITA, o que amontoava os
 *     inscritos na metade de cima e criava partidas de ninguém contra ninguém.
 *
 * Este guarda lê o CÓDIGO-FONTE, no estilo de `indicesCompostos.test.js` e
 * `diaDeJogoUniforme.test.js`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const ler = (p) => readFileSync(p, 'utf8');

/** Tira comentários, para não acusar um texto que só EXPLICA a regra. */
const semComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .join('\n');

describe('⭐ o desempate tem UMA fonte', () => {
  const CONSUMIDORES = [
    'src/modules/tournament/domain/ranking.js',
    'src/modules/tournament/domain/phaseProgression.js',
  ];

  CONSUMIDORES.forEach((caminho) => {
    it(`⭐ ${caminho.split('/').pop()} classifica por \`tiebreak.js\``, () => {
      expect(semComentarios(ler(caminho))).toContain('rankByOfficialCriteria');
    });

    it(`${caminho.split('/').pop()} NÃO tem um comparador próprio`, () => {
      const src = semComentarios(ler(caminho));
      // A assinatura da cópia antiga: comparar wins e depois montar o saldo à
      // mão. Se isto voltar, voltou a segunda verdade.
      expect(src, `${caminho} reintroduziu um comparador próprio`)
        .not.toMatch(/y\.wins\s*-\s*x\.wins/);
      expect(src).not.toMatch(/function compareStats\s*\(/);
    });
  });

  it('⭐ a fonte única implementa o confronto direto', () => {
    const src = ler('src/modules/tournament/domain/tiebreak.js');
    expect(src).toContain('head_to_head');
    expect(src).toContain('miniTable');
    expect(src).toContain('DEFAULT_TIEBREAK_ORDER');
  });
});

describe('⭐ a chave é preenchida pela posição canônica', () => {
  const MOTORES = [
    'src/modules/tournament/domain/draw.js',
    'src/modules/tournament/domain/doubleElimination.js',
  ];

  MOTORES.forEach((caminho) => {
    it(`⭐ ${caminho.split('/').pop()} posiciona por \`seedSlot\``, () => {
      expect(semComentarios(ler(caminho))).toContain('seedSlot(');
    });

    it(`${caminho.split('/').pop()} NÃO despeja nos slots vazios da esquerda para a direita`, () => {
      const src = semComentarios(ler(caminho));
      // O padrão do defeito: varrer os slots e enfiar quem sobrou no primeiro
      // buraco. Isso amontoa na metade de cima e cria par vazio.
      expect(src, `${caminho} voltou a preencher a chave em varredura`)
        .not.toMatch(/if\s*\(\s*slots\[i\]\s*===\s*null\s*\)\s*slots\[i\]\s*=/);
      expect(src).not.toMatch(/rest\.shift\(\)/);
    });
  });

  it('⭐ a ordem canônica existe e é exportada', () => {
    expect(ler('src/modules/tournament/domain/draw.js')).toContain('export function bracketSeedOrder');
  });
});

describe('⭐ comparar grupos desiguais não é feito à mão', () => {
  it('⭐ a progressão entre fases usa `crossGroup.js`', () => {
    const src = semComentarios(ler('src/modules/tournament/domain/phaseProgression.js'));
    expect(src).toContain('rankAcrossGroups');
    expect(src).toContain('selectWildcards');
  });

  it('⭐ o explicador de grupos usa o planejador, não uma conta própria', () => {
    const src = semComentarios(ler('src/modules/tournament/domain/formatExplain.js'));
    expect(src).toContain('describeGroupPlan');
    // 🐞 O conselho inútil que isto substituiu.
    expect(src, 'voltou o "use um número múltiplo de N"').not.toMatch(/múltiplo de/);
  });
});

describe('⭐ o guia público não ensina uma regra que a plataforma não usa', () => {
  // Um guia que ensina o desempate errado é pior que nenhum: quem organiza
  // decora e depois não consegue explicar a tela.
  const GUIA = 'src/v2/pages/V2FormatsGuide.jsx';

  it('⭐ a classificação sai da fonte única, não de um texto escrito à mão', () => {
    const src = semComentarios(ler(GUIA));
    expect(src).toContain('describeTiebreakOrder');
  });

  it('⭐ o guia não repete a ordem ANTIGA (sem confronto direto)', () => {
    const src = semComentarios(ler(GUIA));
    expect(src, 'o guia voltou a listar a ordem antiga à mão')
      .not.toMatch(/saldo de\s*\n?\s*pontos \(a favor − contra\), pontos marcados/);
  });

  it('⭐ o guia fala do número incomum de inscritos e da entrada direta', () => {
    const src = ler(GUIA);
    expect(src).toContain('aproveitamento');
    expect(src).toContain('bye');
    expect(src).toContain('pular fases');
  });
});

describe('⭐ toda configuração de fase é ADITIVA', () => {
  it('⭐ uma fase vazia recebe padrões inertes', async () => {
    const { normalizePhase } = await import('@/modules/tournament/domain/phases');
    const p = normalizePhase({});
    expect(p.round_robin_legs).toBe(1);
    expect(p.custom_group_sizes).toEqual([]);
    expect(p.qualifiers_by_group).toEqual([]);
    expect(p.wildcard_slots).toBe(0);
    expect(p.wildcard_from_position).toBe(0);
    expect(p.tiebreak_order).toEqual([]);
    expect(p.cross_group_method).toBe('rate');
    expect(p.direct_entry).toEqual({ mode: 'none', count: 0, ids: [] });
  });

  it('⭐ os controles do admin têm explicação — nenhum campo mudo', async () => {
    const { TIEBREAK_CRITERIA } = await import('@/modules/tournament/domain/tiebreak');
    const { CROSS_GROUP_METHOD_HELP } = await import('@/modules/tournament/domain/crossGroup');
    const { DIRECT_ENTRY_MODE_HELP } = await import('@/modules/tournament/domain/directEntry');
    TIEBREAK_CRITERIA.forEach((c) => expect(c.help?.length, c.key).toBeGreaterThan(20));
    Object.entries(CROSS_GROUP_METHOD_HELP).forEach(([k, v]) => expect(v.length, k).toBeGreaterThan(40));
    Object.entries(DIRECT_ENTRY_MODE_HELP).forEach(([k, v]) => expect(v.length, k).toBeGreaterThan(30));
  });
});
