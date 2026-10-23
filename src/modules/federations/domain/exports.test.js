import { describe, expect, it } from 'vitest';
import { assetsCsv, membersCsv, rankingCsv, resultsCsv } from './exports';

describe('planilhas da federação', () => {
  it('filiados: uma linha por filiação, sem fórmula e com a situação de hoje', () => {
    const csv = membersCsv([
      { user_name: '=Ana', member_number: 'FGP-2026-000001', tier: 'federated', plan_name: 'Atleta', status: 'active', valid_from: '2026-01-01', valid_until: '2099-12-31' },
      { org_name: 'Clube X', tier: 'registered', status: 'active', valid_until: '2020-01-01' },
    ]).split('\n');
    expect(csv).toHaveLength(3);
    expect(csv[1]).toContain(`"'=Ana"`);
    expect(csv[1]).toContain('"01/01/2026"');
    expect(csv[2]).toContain('"Clube X"');
    expect(csv[2]).toContain('"Cadastrados"');
    expect(csv[2]).toContain('"Vencida"');
  });

  it('resultados: uma linha por atleta, em ordem de colocação', () => {
    const csv = resultsCsv([{ tournament_name: 'Aberto', date: '2026-05-02', modality_name: 'Duplas', status: 'sent', rows: [{ name: 'B', position: 2 }, { name: 'A', position: 1, played: 3, won: 3 }] }]).split('\n');
    expect(csv).toHaveLength(3);
    expect(csv[1]).toMatch(/"1";"A";"3";"3"$/);
    expect(csv[2]).toContain('"B"');
  });

  it('ranking: o geral e cada classe, com a coluna da classe', () => {
    const csv = rankingCsv({ season: 2026, general: [{ name: 'A', position: 1, points: 100 }], categories: [{ key: 'm', rows: [{ name: 'A', position: 1, points: 60 }] }] }, { classLabel: () => 'Masculina' }).split('\n');
    expect(csv).toHaveLength(3);
    expect(csv[1]).toContain('"Geral"');
    expect(csv[2]).toContain('"Masculina"');
    expect(rankingCsv(null).split('\n')).toHaveLength(1);
  });
});

describe('patrimônio em planilha', () => {
  it('uma linha por bem, com emprestados e situação', () => {
    const csv = assetsCsv([{ name: '=Rede', category: 'nets', quantity: 4, condition: 'good', acquired_at: '2026-01-02', value_cents: 150000, loans: [{ id: 'l1', quantity: 1 }] }, { name: 'Placar', status: 'retired', quantity: 1 }], '2026-10-23');
    const linhas = csv.split('\n');
    expect(linhas).toHaveLength(3);
    expect(linhas[1]).toContain(`"'=Rede"`);
    expect(linhas[1]).toContain('"1500,00"');
    expect(linhas[1]).toContain('"02/01/2026"');
    expect(linhas[2]).toContain('"Baixado"');
  });
});
