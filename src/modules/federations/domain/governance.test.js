import { describe, it, expect } from 'vitest';
import { hasGovernance, sortMinutes, validateGovernance } from './governance.js';

describe('validateGovernance', () => {
  it('aceita o conjunto completo e normaliza', () => {
    const r = validateGovernance({
      statute_url: 'https://x/estatuto.pdf', bylaws: ' Regimento ', mandate: { start: '2026-01-01', end: '2027-12-31' },
      board: [{ role: 'Presidente', name: 'Ana' }], minutes: [{ title: 'Assembleia 2026', date: '2026-03-10', url: 'https://x/ata.pdf' }],
    });
    expect(r.ok).toBe(true);
    expect(r.value.bylaws).toBe('Regimento');
    expect(r.value.board).toEqual([{ role: 'Presidente', name: 'Ana' }]);
  });
  it('recusa mandato invertido, link http, membro sem cargo e ata sem título', () => {
    const r = validateGovernance({ statute_url: 'http://x', mandate: { start: '2027-01-01', end: '2026-01-01' }, board: [{ name: 'Ana' }], minutes: [{ title: 'A' }] });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['board.0', 'mandate.end', 'minutes.0.title', 'statute_url']);
  });
});

describe('hasGovernance / sortMinutes', () => {
  it('em branco não há o que mostrar', () => {
    expect(hasGovernance(null)).toBe(false);
    expect(hasGovernance({ mandate: {}, board: [], minutes: [] })).toBe(false);
    expect(hasGovernance({ board: [{ role: 'P', name: 'A' }] })).toBe(true);
  });
  it('as atas saem da mais recente para a mais antiga', () => {
    expect(sortMinutes([{ date: '2025-01-01' }, { date: '2026-01-01' }, {}]).map((a) => a.date)).toEqual(['2026-01-01', '2025-01-01', undefined]);
  });
});
