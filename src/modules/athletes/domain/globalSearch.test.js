import { describe, it, expect } from 'vitest';
import { normalizeText, searchAll } from './globalSearch.js';

describe('normalizeText', () => {
  it('remove acentos e baixa a caixa', () => {
    expect(normalizeText('São Paulo')).toBe('sao paulo');
  });
});

const sources = {
  athletes: [{ id: 'a1', platform_name: 'João Silva', city: 'Floripa' }, { id: 'a2', platform_name: 'Maria', city: 'Curitiba' }],
  tournaments: [{ id: 't1', name: 'Open de Floripa', city: 'Florianópolis' }],
  arenas: [{ id: 'ar1', name: 'Arena Floripa', city: 'Floripa' }],
  clubs: [{ id: 'c1', name: 'Clube do Pickle', city: 'Floripa' }],
};

describe('searchAll', () => {
  it('exige ao menos 2 caracteres', () => {
    expect(searchAll('f', sources).total).toBe(0);
  });

  it('agrupa resultados por tipo e casa sem acento', () => {
    const { groups, total } = searchAll('floripa', sources);
    const types = groups.map((g) => g.type);
    expect(types).toContain('athlete');
    expect(types).toContain('tournament');
    expect(types).toContain('arena');
    expect(types).toContain('club');
    expect(total).toBe(4);
  });

  it('gera links e títulos corretos', () => {
    const { groups } = searchAll('joão', sources);
    const athlete = groups.find((g) => g.type === 'athlete').items[0];
    expect(athlete.to).toBe('/atletas/a1');
    expect(athlete.title).toBe('João Silva');
  });

  it('omite grupos sem resultado', () => {
    const { groups } = searchAll('maria', sources);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('athlete');
  });

  it('respeita perGroup', () => {
    const many = { athletes: Array.from({ length: 20 }, (_, i) => ({ id: `a${i}`, platform_name: `Atleta Teste ${i}` })) };
    const { groups } = searchAll('atleta', many, { perGroup: 5 });
    expect(groups[0].items).toHaveLength(5);
  });
});
